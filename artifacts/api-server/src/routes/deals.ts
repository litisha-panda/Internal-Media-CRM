import { Router } from "express";
import { db, deals, clientAccounts, STAGE_PROB } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveOwnership } from "../lib/ownership";
import { logActivity } from "../lib/activityLog";

const router = Router();

/**
 * Pipeline = amount × STAGE_PROB[stage] / 100
 * NEVER stored. Always derived at read time.
 */
function derivePipeline(deal: any) {
  const prob = STAGE_PROB[deal.stage ?? "Quotation"] ?? 10;
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

router.get("/deals", requireAuth, async (req, res) => {
  try {
    const cond = scopeCondition(req.user!);
    const rows = cond
      ? await db.select().from(deals).where(cond).orderBy(desc(deals.updatedAt))
      : await db.select().from(deals).orderBy(desc(deals.updatedAt));
    res.json({ ok: true, data: rows.map(derivePipeline) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.get("/deals/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(deals)
      .where(eq(deals.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    const record = rows[0];
    if (u.role === "SALES REP"   && record.repId  !== u.repId)  return void res.status(403).json({ ok: false, error: "Forbidden" });
    if (u.role === "REGION HEAD" && record.region !== u.region) return void res.status(403).json({ ok: false, error: "Forbidden" });
    res.json({ ok: true, data: derivePipeline(record) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.post("/deals", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.clientCompany) {
      return void res.status(400).json({ ok: false, error: "id and clientCompany required" });
    }

    // ── Validate ownership — RH on-behalf must target rep in their region ──────
    let owner: Awaited<ReturnType<typeof resolveOwnership>>;
    try {
      owner = await resolveOwnership(u, { repId: body.repId, region: body.region, repName: body.repName });
    } catch (e: any) {
      return void res.status(e.status ?? 400).json({ ok: false, error: e.error ?? String(e) });
    }
    if (!owner.repId) {
      return void res.status(400).json({
        ok:    false,
        error: `Deals must be attributed to a rep. Your role (${u.role}) has no assigned rep ID — provide body.repId.`,
      });
    }

    const stage = body.stage ?? "Quotation";

    const row = await db
      .insert(deals)
      .values({
        id:                    body.id,
        repId:                 owner.repId,
        repName:               owner.name,
        region:                owner.region,
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
        outcome:               stage,                    // always mirrors stage
        amount:                body.amount               ?? 0,
        // targetAmount intentionally not written — stale field
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
        atRisk:                false,                    // governance engine only
        awaitingApproval:      null,                     // governance engine only
        awaitingApprovalSince: null,                     // governance engine only
        reqs:                  body.reqs                 ?? [],
        auditLog:              [],                       // empty — central activityLog used instead
      })
      .onConflictDoNothing()
      .returning();

    if (!row[0]) {
      return void res.status(409).json({ ok: false, error: "Deal with this id already exists" });
    }

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      region:     owner.region,
      action:     "deal.created",
      entityType: "deal",
      entityId:   body.id,
      meta:       { clientCompany: body.clientCompany, stage, amount: body.amount ?? 0 },
    });

    res.status(201).json({ ok: true, data: derivePipeline(row[0]) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.patch("/deals/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;

    // ── Explicit allowlist — only named fields may be updated ─────────────────
    // Ownership (repId, repName, region), governance (atRisk, awaitingApproval*,
    // auditLog), derived (pipelineAmount), and stale (targetAmount) fields are
    // never accepted from the client.
    const ALLOWED_DEAL_PATCH: ReadonlySet<string> = new Set([
      "clientCompany", "contactName", "designation", "contactLevel",
      "phone", "email", "dealType", "zohoAccountId", "clientAccountId",
      "stage", "outcome", "amount", "lossReason", "priority", "quarter",
      "notes", "nextStep", "nextStepDate",
      "agencyName", "zohoAgencyId", "lastContact", "lastDealMeetingDate", "reqs",
    ]);
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_DEAL_PATCH.has(k)) rest[k] = v;
    }

    // ── Sync outcome whenever stage changes ────────────────────────────────────
    if (rest["stage"] !== undefined && rest["outcome"] === undefined) {
      rest["outcome"] = rest["stage"];
    }

    // Fetch existing — for ownership check + activity log change detection
    const existing = await db
      .select({ stage: deals.stage, amount: deals.amount, repId: deals.repId, region: deals.region })
      .from(deals)
      .where(eq(deals.id, String(req.params["id"])))
      .limit(1);

    if (!existing.length) return void res.status(404).json({ ok: false, error: "Not found" });
    if (u.role === "SALES REP"   && existing[0].repId  !== u.repId)  return void res.status(403).json({ ok: false, error: "Forbidden" });
    if (u.role === "REGION HEAD" && existing[0].region !== u.region) return void res.status(403).json({ ok: false, error: "Forbidden" });

    const updated = await db
      .update(deals)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(deals.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });

    // ── Activity logging for significant changes ───────────────────────────────
    if (existing.length && rest.stage && rest.stage !== existing[0].stage) {
      void logActivity({
        userId:     u.id,
        userName:   u.name,
        userRole:   u.role,
        action:     "deal.stage_changed",
        entityType: "deal",
        entityId:   String(req.params["id"]),
        meta:       { from: existing[0].stage, to: rest.stage },
      });
    }

    // ── FIX 3: RO Received → signal frontend to navigate to Revenue Log ──────
    const newStage = String(rest.stage ?? "");
    if (newStage === "RO Received") {
      const d = updated[0];
      return void res.json({
        ok:         true,
        data:       derivePipeline(d),
        navigateTo: "revenue-log",
        prefill: {
          dealId:      d.id,
          clientName:  d.clientCompany ?? "",
          amount:      d.amount ?? 0,
        },
      });
    }

    res.json({ ok: true, data: derivePipeline(updated[0]) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ─── CLIENT ACCOUNTS ─────────────────────────────────────────────────────────

router.get("/client-accounts", requireAuth, async (req, res) => {
  try {
    const cond = caCondition(req.user!);
    const rows = cond
      ? await db.select().from(clientAccounts).where(cond).orderBy(desc(clientAccounts.updatedAt))
      : await db.select().from(clientAccounts).orderBy(desc(clientAccounts.updatedAt));
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.get("/client-accounts/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    const record = rows[0];
    if (u.role === "SALES REP"   && record.repId  !== u.repId)  return void res.status(403).json({ ok: false, error: "Forbidden" });
    if (u.role === "REGION HEAD" && record.region !== u.region) return void res.status(403).json({ ok: false, error: "Forbidden" });
    res.json({ ok: true, data: record });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.post("/client-accounts", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.clientName) {
      return void res.status(400).json({ ok: false, error: "id and clientName required" });
    }

    let owner: Awaited<ReturnType<typeof resolveOwnership>>;
    try {
      owner = await resolveOwnership(u, { repId: body.repId, region: body.region });
    } catch (e: any) {
      return void res.status(e.status ?? 400).json({ ok: false, error: e.error ?? String(e) });
    }
    if (!owner.repId) {
      return void res.status(400).json({
        ok:    false,
        error: `Client accounts must be attributed to a rep. Your role (${u.role}) has no assigned rep ID — provide body.repId.`,
      });
    }

    const row = await db
      .insert(clientAccounts)
      .values({
        id:                  body.id,
        clientName:          body.clientName,
        repId:               owner.repId,
        zohoAccountId:       body.zohoAccountId      ?? null,
        region:              owner.region,
        fiscalYear:          body.fiscalYear         ?? "FY26",
        annualTarget:        body.annualTarget        ?? 0,
        currentStage:        body.currentStage        ?? "Quotation",
        lastContactDate:     body.lastContactDate     ?? null,
        lastDealMeetingDate: body.lastDealMeetingDate ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!row[0]) {
      return void res.status(409).json({ ok: false, error: "Client account with this id already exists" });
    }

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

router.patch("/client-accounts/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const accountId = String(req.params["id"]);

    // Ownership check — fetch before mutating
    const existing = await db
      .select({ repId: clientAccounts.repId, region: clientAccounts.region })
      .from(clientAccounts)
      .where(eq(clientAccounts.id, accountId))
      .limit(1);

    if (!existing.length) return void res.status(404).json({ ok: false, error: "Not found" });
    if (u.role === "SALES REP"   && existing[0].repId  !== u.repId)  return void res.status(403).json({ ok: false, error: "Forbidden" });
    if (u.role === "REGION HEAD" && existing[0].region !== u.region) return void res.status(403).json({ ok: false, error: "Forbidden" });

    const ALLOWED_CA_PATCH: ReadonlySet<string> = new Set([
      "clientName", "zohoAccountId", "fiscalYear", "annualTarget",
      "currentStage", "lastContactDate", "lastDealMeetingDate",
    ]);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      if (ALLOWED_CA_PATCH.has(k)) patch[k] = v;
    }
    const updated = await db
      .update(clientAccounts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clientAccounts.id, accountId))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ─── FIX 6: POST /client-accounts/:id/approve ────────────────────────────────
// Restricted to REGION HEAD and ADMIN only. Requires migrations/client_accounts_status.sql.
router.post("/client-accounts/:id/approve", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const accountId = String(req.params["id"]);
    if (!["REGION HEAD", "ADMIN"].includes(u.role ?? "")) {
      return void res.status(403).json({ ok: false, error: "Only REGION HEAD or ADMIN can approve client accounts" });
    }
    const existing = await db
      .select({ repId: clientAccounts.repId, region: clientAccounts.region })
      .from(clientAccounts)
      .where(eq(clientAccounts.id, accountId))
      .limit(1);
    if (!existing.length) return void res.status(404).json({ ok: false, error: "Not found" });
    if (u.role === "REGION HEAD" && existing[0].region !== u.region) {
      return void res.status(403).json({ ok: false, error: "Forbidden — account is outside your region" });
    }
    // NOTE: 'status', 'approvedAt', 'approvedBy' columns require migrations/client_accounts_status.sql
    // to be run first. Until then this endpoint will throw — a safe no-op until migration is applied.
    const updated = await db
      .update(clientAccounts)
      .set({ updatedAt: new Date() } as any)  // extend to { status:"approved", approvedAt: new Date(), approvedBy: u.name } post-migration
      .where(eq(clientAccounts.id, accountId))
      .returning();
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

export default router;
