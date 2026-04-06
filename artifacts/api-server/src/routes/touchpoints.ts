import { Router } from "express";
import { db, touchpoints } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP") return eq(touchpoints.repId, user.repId!);
  // REGION HEAD, NSH, CRO, SALES STRATEGY, ADMIN see all touchpoints
  return undefined;
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
      .where(eq(touchpoints.id, req.params.id))
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
    if (!body.id || !body.repId) {
      return void res.status(400).json({ ok: false, error: "id and repId required" });
    }

    const row = await db
      .insert(touchpoints)
      .values({
        id:                  body.id,
        clientAccountId:     body.clientAccountId     ?? null,
        dealId:              body.dealId               ?? null,
        repId:               body.repId,
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
        loggedByUserId:      u.id,
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/touchpoints/:id/action-items — append or update action items only
// Relationship touchpoints do NOT update the escalation clock; that is handled on the frontend.
router.patch("/touchpoints/:id/action-items", requireAuth, async (req, res) => {
  try {
    const { actionItems } = req.body;
    if (!Array.isArray(actionItems)) {
      return void res.status(400).json({ ok: false, error: "actionItems must be an array" });
    }

    const updated = await db
      .update(touchpoints)
      .set({ actionItems })
      .where(eq(touchpoints.id, req.params.id))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
