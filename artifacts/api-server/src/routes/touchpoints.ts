import { Router } from "express";
import { db, touchpoints, deals, clientAccounts, users } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveOwnership } from "../lib/ownership";
import { logActivity } from "../lib/activityLog";
import { todayIST } from "../lib/date";

const router = Router();

/**
 * Scope condition for touchpoints.
 *
 * SALES REP  — own touchpoints (repId match)
 * REGION HEAD — touchpoints from reps in their region
 *               Uses denormalized `region` column on touchpoints
 *               (backfilled as NULL for pre-existing rows — those will be missing from RH view
 *                until reps re-log; acceptable for new data going forward)
 * Elevated   — all touchpoints
 */
async function buildScopeCondition(user: { role: string; repId: number | null; region: string | null }) {
  if (user.role === "SALES REP") {
    return eq(touchpoints.repId, user.repId!);
  }
  if (user.role === "REGION HEAD" && user.region) {
    // Fetch repIds of active SALES REPs in this region
    const repsInRegion = await db
      .select({ repId: users.repId })
      .from(users)
      .where(
        and(
          eq(users.role,   "SALES REP"),
          eq(users.status, "active"),
          eq(users.region, user.region),
        ),
      );
    const repIds = repsInRegion
      .map((r) => r.repId)
      .filter((r): r is number => r !== null);

    if (repIds.length === 0) return null; // no reps in region → empty result
    return inArray(touchpoints.repId, repIds);
  }
  return null; // elevated roles see all
}

// GET /api/touchpoints — list (scoped by role)
router.get("/touchpoints", requireAuth, async (req, res) => {
  try {
    const { dealId, clientAccountId } = req.query as Record<string, string>;
    const conditions: any[] = [];

    const scopeCond = await buildScopeCondition(req.user!);
    if (scopeCond) conditions.push(scopeCond);
    if (dealId)           conditions.push(eq(touchpoints.dealId, dealId));
    if (clientAccountId)  conditions.push(eq(touchpoints.clientAccountId, clientAccountId));

    const rows = conditions.length
      ? await db.select().from(touchpoints).where(and(...conditions)).orderBy(desc(touchpoints.createdAt))
      : await db.select().from(touchpoints).orderBy(desc(touchpoints.createdAt));

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/touchpoints/:id — single
router.get("/touchpoints/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(touchpoints)
      .where(eq(touchpoints.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/touchpoints — log a new touchpoint
router.post("/touchpoints", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id) {
      return void res.status(400).json({ ok: false, error: "id is required" });
    }

    // ── Validate ownership — RH on-behalf actions must target reps in their region ──
    let owner: { repId: number; region: string; name: string };
    try {
      owner = await resolveOwnership(u, { repId: body.repId, region: body.region });
    } catch (e: any) {
      return void res.status(e.status ?? 400).json({ ok: false, error: e.error ?? String(e) });
    }

    const today = todayIST();
    const tpDate = body.date ?? today;

    const row = await db
      .insert(touchpoints)
      .values({
        id:                  body.id,
        clientAccountId:     body.clientAccountId     ?? null,
        dealId:              body.dealId               ?? null,
        repId:               owner.repId,
        region:              owner.region,              // server-derived, never from body directly
        date:                tpDate,
        time:                body.time                 ?? null,
        meetingType:         body.meetingType          ?? null,
        touchpointType:      body.touchpointType       ?? "Deal Meeting",
        contactName:         body.contactName          ?? null,
        contactDesignation:  body.contactDesignation   ?? null,
        contactLevel:        body.contactLevel         ?? null,
        whatHappened:        body.whatHappened         ?? null,
        clientFeedback:      body.clientFeedback        ?? null,
        stageUpdate:         body.stageUpdate          ?? null,
        actionItems:         body.actionItems           ?? [],
        loggedAt:            body.loggedAt             ?? new Date().toISOString(),
        loggedLate:          body.loggedLate            ?? false,
        loggedByUserId:      u.id,               // always from session
      })
      .onConflictDoNothing()
      .returning();

    const tp = row[0];
    if (!tp) {
      return void res.status(409).json({ ok: false, error: "Touchpoint with this id already exists" });
    }

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      region:     owner.region,
      action:     "touchpoint.logged",
      entityType: "touchpoint",
      entityId:   tp.id,
      meta:       { type: tp.touchpointType, date: tpDate, dealId: body.dealId },
    });

    // ── Calendar side-effects ─────────────────────────────────────────────────
    if (body.dealId && body.touchpointType !== "Relationship") {
      await db
        .update(deals)
        .set({ lastContact: today, lastDealMeetingDate: today, updatedAt: new Date() })
        .where(eq(deals.id, body.dealId));
    }

    if (body.clientAccountId) {
      await db
        .update(clientAccounts)
        .set({ lastContactDate: today, updatedAt: new Date() })
        .where(eq(clientAccounts.id, body.clientAccountId));
    }

    res.status(201).json({ ok: true, data: tp });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/touchpoints/:id/action-items — append or update action items only
router.patch("/touchpoints/:id/action-items", requireAuth, async (req, res) => {
  try {
    const { actionItems } = req.body;
    if (!Array.isArray(actionItems)) {
      return void res.status(400).json({ ok: false, error: "actionItems must be an array" });
    }

    const updated = await db
      .update(touchpoints)
      .set({ actionItems })
      .where(eq(touchpoints.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
