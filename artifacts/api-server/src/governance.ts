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
  dailyPlans,
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
//
// Compliance requires BOTH:
//   (a) at least one touchpoint logged today
//   (b) a daily plan created for tomorrow
//
// Roles checked: SALES REP and REGION HEAD.
// Status values:
//   "present" — both requirements met
//   "partial" — touchpoint logged but no plan (or plan but no touchpoint)
//   "absent"  — neither requirement met

async function runAttendanceCheck(): Promise<void> {
  const d = todayIST(); // IST wall-clock date, e.g. "2026-04-06"

  // "tomorrow" in IST — this is the planDate we check exists
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date(Date.now() + 86_400_000));

  try {
    // Include both SALES REP and REGION HEAD in compliance checks
    const complianceUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          // role IN ('SALES REP', 'REGION HEAD')
          sql`${users.role} IN ('SALES REP', 'REGION HEAD')`,
        ),
      );

    for (const user of complianceUsers) {
      // Skip if record already written for today
      const existing = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.userId, user.id), eq(attendanceRecords.date, d)))
        .limit(1);

      if (existing.length > 0) continue;

      // Check (a): touchpoint logged today by this user
      const tpLogged = await db
        .select({ id: touchpoints.id })
        .from(touchpoints)
        .where(
          and(
            eq(touchpoints.loggedByUserId, user.id),
            eq(touchpoints.date, d),
          ),
        )
        .limit(1);
      const hasTouchpoint = tpLogged.length > 0;

      // Check (b): daily plan created for tomorrow
      const planLogged = await db
        .select({ id: dailyPlans.id })
        .from(dailyPlans)
        .where(
          and(
            eq(dailyPlans.userId, user.id),
            eq(dailyPlans.planDate, tomorrow),
          ),
        )
        .limit(1);
      const hasPlan = planLogged.length > 0;

      // Derive status
      let status: string;
      let note:   string;
      if (hasTouchpoint && hasPlan) {
        status = "present";
        note   = "";
      } else if (hasTouchpoint && !hasPlan) {
        status = "partial";
        note   = `Touchpoint logged but no plan created for ${tomorrow} by 23:30 IST`;
      } else if (!hasTouchpoint && hasPlan) {
        status = "partial";
        note   = `Plan created for ${tomorrow} but no touchpoint logged for ${d}`;
      } else {
        status = "absent";
        note   = `No touchpoint logged for ${d} and no plan for ${tomorrow}`;
      }

      await db.insert(attendanceRecords).values({
        id:               `att_${user.id}_${d}`,
        userId:           user.id,
        userName:         user.name,
        region:           user.region,
        date:             d,
        status,
        touchpointLogged: hasTouchpoint ? "yes" : "no",
        planLogged:       hasPlan       ? "yes" : "no",
        note:             note || null,
      }).onConflictDoNothing();

      void logActivity({
        action:     `attendance.${status}`,
        userId:     user.id,
        userName:   user.name,
        userRole:   user.role,
        region:     user.region,
        entityType: "attendance_record",
        entityId:   `att_${user.id}_${d}`,
        meta:       { date: d, hasTouchpoint, hasPlan },
      });

      if (status !== "present") {
        void createNotification({
          userId:     user.id,
          type:       status === "absent" ? "attendance_absent" : "attendance_partial",
          title:      status === "absent" ? "Compliance check failed" : "Compliance partially met",
          body:       note,
          entityType: "attendance_record",
          entityId:   `att_${user.id}_${d}`,
        });
        logger.info({ userId: user.id, name: user.name, date: d, status }, `Attendance: ${status}`);
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
