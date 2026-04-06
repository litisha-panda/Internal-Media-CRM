import { Router } from "express";
import { db, deals, clientAccounts } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Stage probability map — pipeline = amount × prob / 100
// This is derived at read time, NEVER stored.
const STAGE_PROB: Record<string, number> = {
  Prospect:         10,
  Qualified:        25,
  "Proposal Sent":  40,
  Negotiation:      65,
  "Verbal Commit":  80,
  "PO Received":    90,
  "RO Received":    90,
  Won:             100,
  Lost:              0,
  Cancelled:         0,
  Archived:          0,
  "On Hold":        20,
};

function derivePipeline(deal: any) {
  const prob = STAGE_PROB[deal.stage ?? "Prospect"] ?? 10;
  return { ...deal, pipelineAmount: Math.round((deal.amount ?? 0) * prob / 100) };
}

function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP")   return eq(deals.repId,  user.repId!);
  if (role === "REGION HEAD") return eq(deals.region, user.region!);
  return undefined;
}

function caCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP")   return eq(clientAccounts.repId,  user.repId!);
  if (role === "REGION HEAD") return eq(clientAccounts.region, user.region!);
  return undefined;
}

// ─── DEALS ───────────────────────────────────────────────────────────────────

// GET /api/deals — list all deals (scoped); pipeline derived
router.get("/deals", requireAuth, async (req, res) => {
  try {
    const cond = scopeCondition(req.user!);
    const rows = cond
      ? await db.select().from(deals).where(cond).orderBy(desc(deals.updatedAt))
      : await db.select().from(deals).orderBy(desc(deals.updatedAt));
    res.json({ ok: true, data: rows.map(derivePipeline) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/deals/:id — single deal
router.get("/deals/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(deals)
      .where(eq(deals.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: derivePipeline(rows[0]) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/deals — create new deal
router.post("/deals", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.clientCompany) {
      return void res.status(400).json({ ok: false, error: "id and clientCompany required" });
    }

    // ── Issue #3: force ownership from session for SALES REP ─────────────────
    const authorRepId  = u.role === "SALES REP" ? u.repId!  : (body.repId  ?? u.repId  ?? 0);
    const authorRepNm  = u.role === "SALES REP" ? u.name    : (body.repName ?? u.name);
    const authorRegion = u.role === "SALES REP" ? u.region! : (body.region  ?? u.region ?? "");

    // ── Issue #7: outcome is always kept in sync with stage ──────────────────
    const stage = body.stage ?? "Prospect";

    const row = await db
      .insert(deals)
      .values({
        id:                    body.id,
        repId:                 authorRepId,
        repName:               authorRepNm,
        region:                authorRegion,
        clientCompany:         body.clientCompany,
        zohoAccountId:         body.zohoAccountId       ?? null,
        clientAccountId:       body.clientAccountId     ?? null,
        contactName:           body.contactName          ?? null,
        designation:           body.designation          ?? null,
        contactLevel:          body.contactLevel         ?? null,
        phone:                 body.phone                ?? null,
        email:                 body.email                ?? null,
        dealType:              body.dealType             ?? null,
        stage,
        outcome:               stage, // always mirror stage — issue #7
        amount:                body.amount               ?? 0,
        // targetAmount: intentionally omitted from normative deal model (issue #7)
        lossReason:            body.lossReason           ?? null,
        priority:              body.priority             ?? "Regular",
        quarter:               body.quarter              ?? null,
        notes:                 body.notes                ?? null,
        nextStep:              body.nextStep             ?? null,
        nextStepDate:          body.nextStepDate         ?? null,
        agencyName:            body.agencyName           ?? null,
        zohoAgencyId:          body.zohoAgencyId         ?? null,
        lastContact:           body.lastContact          ?? null,
        lastDealMeetingDate:   body.lastDealMeetingDate  ?? null,
        atRisk:                false, // governance engine sets this — not client
        awaitingApproval:      body.awaitingApproval     ?? null,
        awaitingApprovalSince: body.awaitingApprovalSince ?? null,
        reqs:                  body.reqs                 ?? [],
        auditLog:              body.auditLog             ?? [],
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: derivePipeline(row[0]) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/deals/:id — update deal (NO DELETE — use stage=Lost/Archived)
router.patch("/deals/:id", requireAuth, async (req, res) => {
  try {
    const body = req.body;
    // Strip read-only / derived fields
    const { id: _id, createdAt: _ca, pipelineAmount: _pa, targetAmount: _ta, ...rest } = body;

    // ── Issue #7: keep outcome in sync whenever stage changes ────────────────
    if (rest.stage !== undefined && rest.outcome === undefined) {
      rest.outcome = rest.stage;
    }

    const updated = await db
      .update(deals)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(deals.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: derivePipeline(updated[0]) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── CLIENT ACCOUNTS ─────────────────────────────────────────────────────────

// GET /api/client-accounts — list (scoped)
router.get("/client-accounts", requireAuth, async (req, res) => {
  try {
    const cond = caCondition(req.user!);
    const rows = cond
      ? await db.select().from(clientAccounts).where(cond).orderBy(desc(clientAccounts.updatedAt))
      : await db.select().from(clientAccounts).orderBy(desc(clientAccounts.updatedAt));
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/client-accounts/:id — single account
router.get("/client-accounts/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/client-accounts — create
router.post("/client-accounts", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.clientName) {
      return void res.status(400).json({ ok: false, error: "id and clientName required" });
    }

    // ── Issue #3: force ownership for SALES REP ──────────────────────────────
    const authorRepId  = u.role === "SALES REP" ? u.repId!  : (body.repId  ?? u.repId ?? 0);
    const authorRegion = u.role === "SALES REP" ? u.region! : (body.region ?? u.region ?? "");

    const row = await db
      .insert(clientAccounts)
      .values({
        id:                  body.id,
        clientName:          body.clientName,
        repId:               authorRepId,
        zohoAccountId:       body.zohoAccountId      ?? null,
        region:              authorRegion,
        fiscalYear:          body.fiscalYear         ?? "FY26",
        annualTarget:        body.annualTarget        ?? 0,
        currentStage:        body.currentStage        ?? "Prospect",
        lastContactDate:     body.lastContactDate     ?? null,
        lastDealMeetingDate: body.lastDealMeetingDate ?? null,
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/client-accounts/:id — update
router.patch("/client-accounts/:id", requireAuth, async (req, res) => {
  try {
    const { id: _id, createdAt: _ca, ...rest } = req.body;
    const updated = await db
      .update(clientAccounts)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(clientAccounts.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
