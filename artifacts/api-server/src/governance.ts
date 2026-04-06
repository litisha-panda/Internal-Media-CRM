/**
 * Governance Engine
 *
 * Runs on a schedule inside the API server process (5-minute tick).
 * Responsibilities:
 *   1. IR escalation hops   — advance escDept along ESC_CHAIN every 12h after SLA breach
 *   2. Stalled deal flagging — set atRisk=true when lastContact is STALL_DAYS stale
 *   3. Attendance check     — record present/absent for every SALES REP at 23:30 IST
 *   4. Task overdue flagging — mark tasks status="Overdue" when past dueDate
 *   5. Task reminders       — notify assignee 24h before due date
 *
 * All date/time operations use Asia/Kolkata wall-clock time via ./lib/date.ts.
 *
 * NOTE: In production, replace setInterval with pg_cron or an external scheduler.
 */

import {
  db,
  internalRequests,
  deals,
  users,
  touchpoints,
  attendanceRecords,
  tasks,
  ESC_CHAIN,
  ESC_HOP_HOURS,
  STALL_DAYS,
  TASK_REMINDER_HOURS,
  CLOSED_STAGES,
} from "@workspace/db";
import { eq, and, ne, lt, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import {
  todayIST,
  hoursSince,
  daysSince,
  isAttendanceWindow,
  nowISO,
} from "./lib/date";
import { createNotification } from "./lib/notifications";
import { logActivity } from "./lib/activityLog";

// ── 1. Escalation hops ────────────────────────────────────────────────────────

async function runEscalationHops(): Promise<void> {
  try {
    const openReqs = await db
      .select()
      .from(internalRequests)
      .where(
        and(
          ne(internalRequests.status, "Done"),
          ne(internalRequests.status, "Withdrawn"),
        ),
      );

    for (const req of openReqs) {
      const raisedAt   = req.raisedAt ?? req.createdAt?.toISOString();
      const ageHours   = hoursSince(raisedAt);
      const slaHours   = req.slaHours ?? 48;

      if (ageHours < slaHours) continue;

      const history        = (req.escHistory as any[]) ?? [];
      const currentEscDept = req.escDept;
      const escalatedAt    = req.escalatedAt;

      if (!currentEscDept) {
        const firstHop = ESC_CHAIN[0];
        const now = nowISO();
        await db
          .update(internalRequests)
          .set({
            escDept:     firstHop,
            escalatedAt: now,
            escHistory:  [...history, { from: null, to: firstHop, at: now, reason: "SLA breached" }],
            status:      "Overdue",
            updatedAt:   new Date(),
          })
          .where(eq(internalRequests.id, req.id));

        void logActivity({
          action:     "ir.escalated",
          entityType: "internal_request",
          entityId:   req.id,
          meta:       { to: firstHop, reason: "SLA breached" },
        });
        logger.info({ id: req.id, to: firstHop }, "IR escalated (first hop)");
        continue;
      }

      const hopAge     = hoursSince(escalatedAt);
      if (hopAge < ESC_HOP_HOURS) continue;

      const currentIdx = ESC_CHAIN.indexOf(currentEscDept as typeof ESC_CHAIN[number]);
      if (currentIdx === -1 || currentIdx >= ESC_CHAIN.length - 1) continue;

      const nextHop = ESC_CHAIN[currentIdx + 1];
      const now = nowISO();
      await db
        .update(internalRequests)
        .set({
          escDept:     nextHop,
          escalatedAt: now,
          escHistory:  [...history, { from: currentEscDept, to: nextHop, at: now, reason: `${ESC_HOP_HOURS}h hop` }],
          updatedAt:   new Date(),
        })
        .where(eq(internalRequests.id, req.id));

      void logActivity({
        action:     "ir.escalation_hop",
        entityType: "internal_request",
        entityId:   req.id,
        meta:       { from: currentEscDept, to: nextHop },
      });
      logger.info({ id: req.id, from: currentEscDept, to: nextHop }, "IR escalation hop");
    }
  } catch (err) {
    logger.error({ err }, "governance: escalation hops failed");
  }
}

// ── 2. Stalled deal flagging ──────────────────────────────────────────────────

async function runStalledDeals(): Promise<void> {
  try {
    const allDeals = await db.select().from(deals);

    for (const deal of allDeals) {
      if (CLOSED_STAGES.has(deal.stage ?? "")) continue;

      const idle           = daysSince(deal.lastContact ?? deal.createdAt?.toISOString());
      const shouldBeAtRisk = idle >= STALL_DAYS;

      if (shouldBeAtRisk !== deal.atRisk) {
        await db
          .update(deals)
          .set({ atRisk: shouldBeAtRisk, updatedAt: new Date() })
          .where(eq(deals.id, deal.id));

        if (shouldBeAtRisk) {
          void logActivity({
            action:     "deal.at_risk_flagged",
            entityType: "deal",
            entityId:   deal.id,
            region:     deal.region,
            meta:       { idleDays: Math.round(idle), client: deal.clientCompany },
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "governance: stalled deal flagging failed");
  }
}

// ── 3. Attendance records (11:30 PM IST rule) ─────────────────────────────────

async function runAttendanceCheck(): Promise<void> {
  const d = todayIST(); // IST wall-clock date
  try {
    const reps = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "SALES REP"), eq(users.status, "active")));

    for (const rep of reps) {
      const existing = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.userId, rep.id), eq(attendanceRecords.date, d)))
        .limit(1);

      if (existing.length > 0) continue;

      const logged = await db
        .select({ id: touchpoints.id })
        .from(touchpoints)
        .where(
          and(
            eq(touchpoints.loggedByUserId, rep.id),
            eq(touchpoints.date, d),
          ),
        )
        .limit(1);

      const status = logged.length > 0 ? "present" : "absent";
      await db.insert(attendanceRecords).values({
        id:       `att_${rep.id}_${d}`,
        userId:   rep.id,
        userName: rep.name,
        region:   rep.region,
        date:     d,
        status,
        note:     status === "absent" ? "No touchpoint logged by 23:30 IST" : null,
      }).onConflictDoNothing();

      void logActivity({
        action:     `attendance.${status}`,
        userId:     rep.id,
        userName:   rep.name,
        userRole:   "SALES REP",
        region:     rep.region,
        entityType: "attendance_record",
        entityId:   `att_${rep.id}_${d}`,
        meta:       { date: d },
      });

      if (status === "absent") {
        void createNotification({
          userId:     rep.id,
          type:       "attendance_absent",
          title:      "No touchpoint logged today",
          body:       `You have not logged any touchpoint for ${d}. Please log a touchpoint or raise an exception.`,
          entityType: "attendance_record",
          entityId:   `att_${rep.id}_${d}`,
        });
        logger.info({ userId: rep.id, name: rep.name, date: d }, "Attendance: absent");
      }
    }
  } catch (err) {
    logger.error({ err }, "governance: attendance check failed");
  }
}

// ── 4. Task overdue flagging ──────────────────────────────────────────────────

async function runTaskOverdue(): Promise<void> {
  try {
    const today = todayIST();
    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          ne(tasks.status, "Done"),
          ne(tasks.status, "Cancelled"),
          ne(tasks.status, "Overdue"),
          sql`${tasks.dueDate} IS NOT NULL`,
          sql`${tasks.dueDate} < ${today}`,
        ),
      );

    for (const task of openTasks) {
      await db
        .update(tasks)
        .set({ status: "Overdue", updatedAt: new Date() })
        .where(eq(tasks.id, task.id));

      void logActivity({
        action:     "task.overdue_flagged",
        entityType: "task",
        entityId:   task.id,
        meta:       { title: task.title, dueDate: task.dueDate },
      });

      // Notify the assignee if we have their userId
      if (task.assignedToUserId) {
        void createNotification({
          userId:     task.assignedToUserId,
          type:       "task_overdue",
          title:      `Task overdue: ${task.title}`,
          body:       `Your task "${task.title}" was due on ${task.dueDate} and is now overdue.`,
          entityType: "task",
          entityId:   task.id,
        });
      }
    }

    if (openTasks.length > 0) {
      logger.info({ count: openTasks.length }, "governance: tasks marked overdue");
    }
  } catch (err) {
    logger.error({ err }, "governance: task overdue flagging failed");
  }
}

// ── 5. Task due reminders (24h window) ────────────────────────────────────────

async function runTaskReminders(): Promise<void> {
  try {
    const today    = todayIST();
    // Compute "tomorrow" in IST
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
      .format(new Date(Date.now() + 86_400_000));

    // Find tasks due tomorrow that are still open and have an assignee
    const dueSoon = await db
      .select()
      .from(tasks)
      .where(
        and(
          ne(tasks.status, "Done"),
          ne(tasks.status, "Cancelled"),
          ne(tasks.status, "Overdue"),
          sql`${tasks.dueDate} = ${tomorrow}`,
          sql`${tasks.assignedToUserId} IS NOT NULL`,
        ),
      );

    for (const task of dueSoon) {
      if (!task.assignedToUserId) continue;

      // Avoid sending duplicate reminders by checking recent notifications
      // (simple idempotency: task ID in entityId + type)
      void createNotification({
        userId:     task.assignedToUserId,
        type:       "task_due_soon",
        title:      `Task due tomorrow: ${task.title}`,
        body:       `Your task "${task.title}" is due on ${task.dueDate}.`,
        entityType: "task",
        entityId:   task.id,
      });
    }

    if (dueSoon.length > 0) {
      logger.info({ count: dueSoon.length }, "governance: task reminders sent");
    }
  } catch (err) {
    logger.error({ err }, "governance: task reminders failed");
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────

export async function runGovernanceTick(): Promise<void> {
  await runEscalationHops();
  await runStalledDeals();
  await runTaskOverdue();
  await runTaskReminders();

  // Attendance check runs only at the 23:30–23:59 IST window
  if (isAttendanceWindow()) {
    await runAttendanceCheck();
  }
}

/**
 * Start the governance scheduler.
 * Runs a tick every 5 minutes.
 * Returns the interval handle so it can be cleared in tests.
 */
export function startGovernanceScheduler(): NodeJS.Timeout {
  const TICK_MS = 5 * 60 * 1_000;
  logger.info("Governance scheduler started (5-minute tick, IST timezone)");

  runGovernanceTick().catch((err) =>
    logger.error({ err }, "governance: startup tick failed"),
  );

  return setInterval(() => {
    runGovernanceTick().catch((err) =>
      logger.error({ err }, "governance: tick failed"),
    );
  }, TICK_MS);
}
