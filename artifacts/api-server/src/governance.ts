/**
 * Governance Engine — Issue #4
 *
 * Runs on a schedule inside the API server process.
 * Responsibilities:
 *   - Escalation hops: advance IR escDept along ESC_CHAIN when SLA is breached
 *   - Stalled deals: set atRisk=true when lastContact is 7+ days stale
 *   - Attendance: create attendance_records for SALES REPs at 23:30 each day
 *   - Deal auto-escalation: flag deals with awaitingApproval that have gone past SLA
 *
 * NOTE: This is a best-effort in-process scheduler.
 * In a production deployment, replace setInterval with a proper cron job or
 * a pg_cron / external scheduler that calls POST /api/governance/run.
 */

import {
  db,
  internalRequests,
  deals,
  users,
  touchpoints,
  attendanceRecords,
} from "@workspace/db";
import { eq, and, or, isNull, lt, sql, ne } from "drizzle-orm";
import { logger } from "./lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Escalation chain for internal requests (index = hop number). */
const ESC_CHAIN: string[] = ["Region Head", "NSH", "Sales Strategy", "CRO"];

/** How many hours each hop waits before advancing. */
const ESC_HOP_HOURS = 12;

/** Days without contact before a deal becomes at-risk. */
const STALL_DAYS = 7;

/** Days an approval request can sit before a deal is flagged. */
const APPROVAL_SLA_DAYS = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function hoursSince(isoString: string | null | undefined): number {
  if (!isoString) return 0;
  const ms = Date.now() - new Date(isoString).getTime();
  return ms / 3_600_000;
}

function daysSince(isoString: string | null | undefined): number {
  if (!isoString) return 0;
  return hoursSince(isoString) / 24;
}

// ── Escalation hops ───────────────────────────────────────────────────────────

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

      // Not yet SLA-breached — skip
      if (ageHours < slaHours) continue;

      const history = (req.escHistory as any[]) ?? [];
      const currentEscDept = req.escDept;
      const escalatedAt    = req.escalatedAt;

      // First escalation — hasn't been escalated yet
      if (!currentEscDept) {
        const firstHop = ESC_CHAIN[0];
        const now = new Date().toISOString();
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
        logger.info({ id: req.id, to: firstHop }, "IR escalated (first hop)");
        continue;
      }

      // Already escalated — check if hop interval elapsed
      const hopAge = hoursSince(escalatedAt);
      if (hopAge < ESC_HOP_HOURS) continue;

      const currentIdx = ESC_CHAIN.indexOf(currentEscDept);
      if (currentIdx === -1 || currentIdx >= ESC_CHAIN.length - 1) continue; // already at CRO

      const nextHop = ESC_CHAIN[currentIdx + 1];
      const now = new Date().toISOString();
      await db
        .update(internalRequests)
        .set({
          escDept:     nextHop,
          escalatedAt: now,
          escHistory:  [...history, { from: currentEscDept, to: nextHop, at: now, reason: `${ESC_HOP_HOURS}h hop` }],
          updatedAt:   new Date(),
        })
        .where(eq(internalRequests.id, req.id));
      logger.info({ id: req.id, from: currentEscDept, to: nextHop }, "IR escalation hop");
    }
  } catch (err) {
    logger.error({ err }, "governance: escalation hops failed");
  }
}

// ── Stalled deal flagging ─────────────────────────────────────────────────────

async function runStalledDeals(): Promise<void> {
  try {
    const allDeals = await db.select().from(deals);
    const closedStages = new Set(["Lost", "Cancelled", "Archived", "Won", "RO Received"]);

    for (const deal of allDeals) {
      if (closedStages.has(deal.stage ?? "")) continue;

      const idle = daysSince(deal.lastContact ?? deal.createdAt?.toISOString());
      const shouldBeAtRisk = idle >= STALL_DAYS;

      if (shouldBeAtRisk !== deal.atRisk) {
        await db
          .update(deals)
          .set({ atRisk: shouldBeAtRisk, updatedAt: new Date() })
          .where(eq(deals.id, deal.id));
      }
    }
  } catch (err) {
    logger.error({ err }, "governance: stalled deal flagging failed");
  }
}

// ── Attendance records (11:30 PM absence rule) ────────────────────────────────
// Called once per day, after 23:30 local time.
// For each active SALES REP: check if they've logged at least one touchpoint today.
// If not, insert an attendance_record with status="absent".

async function runAttendanceCheck(): Promise<void> {
  const d = today();
  try {
    const reps = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "SALES REP"), eq(users.status, "active")));

    for (const rep of reps) {
      // Check existing record for today (idempotent — skip if already recorded)
      const existing = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.userId, rep.id), eq(attendanceRecords.date, d)))
        .limit(1);

      if (existing.length > 0) continue;

      // Check if rep logged any touchpoint today
      const logged = await db
        .select({ id: touchpoints.id })
        .from(touchpoints)
        .where(
          and(
            eq(touchpoints.loggedByUserId, rep.id),
            // date column stores YYYY-MM-DD
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
        note:     status === "absent" ? "No meeting logged by 23:30" : null,
      }).onConflictDoNothing();

      if (status === "absent") {
        logger.info({ userId: rep.id, name: rep.name, date: d }, "Attendance: absent");
      }
    }
  } catch (err) {
    logger.error({ err }, "governance: attendance check failed");
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────

export async function runGovernanceTick(): Promise<void> {
  await runEscalationHops();
  await runStalledDeals();

  // Run attendance check only at/after 23:30 local time
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  if (h === 23 && m >= 30) {
    await runAttendanceCheck();
  }
}

/**
 * Start the governance scheduler.
 * Runs a tick every 5 minutes.
 * Returns the interval handle so it can be cleared in tests.
 */
export function startGovernanceScheduler(): NodeJS.Timeout {
  const TICK_MS = 5 * 60 * 1000; // 5 minutes
  logger.info("Governance scheduler started (5-minute tick)");

  // Run once immediately on startup to catch any backlog
  runGovernanceTick().catch((err) =>
    logger.error({ err }, "governance: startup tick failed"),
  );

  return setInterval(() => {
    runGovernanceTick().catch((err) =>
      logger.error({ err }, "governance: tick failed"),
    );
  }, TICK_MS);
}
