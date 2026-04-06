import { Router } from "express";
import { db, touchpoints, deals, clientAccounts } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP") return eq(touchpoints.repId, user.repId!);
  // REGION HEAD scopes to their own reps (can be further refined via query param)
  return undefined; // elevated roles see all
}

// GET /api/touchpoints — list (scoped by role)
router.get("/touchpoints", requireAuth, async (req, res) => {
  try {
    const { dealId, clientAccountId } = req.query as Record<string, string>;
    const conditions: any[] = [];

    const scopeCond = scopeCondition(req.user!);
    if (scopeCond)        conditions.push(scopeCond);
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

    // ── Issue #3: force repId from session for SALES REP ─────────────────────
    // For elevated roles (RH logging on behalf, etc.) body.repId is trusted.
    const authorRepId = u.role === "SALES REP" ? u.repId! : (body.repId ?? u.repId ?? 0);

    const row = await db
      .insert(touchpoints)
      .values({
        id:                  body.id,
        clientAccountId:     body.clientAccountId     ?? null,
        dealId:              body.dealId               ?? null,
        repId:               authorRepId,
        date:                body.date                 ?? null,
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
        loggedByUserId:      u.id, // always from session — issue #3
      })
      .onConflictDoNothing()
      .returning();

    const tp = row[0];

    // ── Issue #4: calendar side-effects ──────────────────────────────────────
    // When a Deal Meeting touchpoint is logged, update the deal's lastContact
    // and lastDealMeetingDate so staleness calculations stay current.
    if (tp && body.dealId && body.touchpointType !== "Relationship") {
      const today = new Date().toISOString().slice(0, 10);
      await db
        .update(deals)
        .set({ lastContact: today, lastDealMeetingDate: today, updatedAt: new Date() })
        .where(eq(deals.id, body.dealId));
    }

    // When any touchpoint is logged for a client account, update lastContactDate.
    if (tp && body.clientAccountId) {
      const today = new Date().toISOString().slice(0, 10);
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
