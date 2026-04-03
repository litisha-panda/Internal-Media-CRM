import { Router }          from "express";
import { db, deals, clientAccounts, revenueEntries } from "@workspace/db";
import { eq }              from "drizzle-orm";
import { requireAuth }     from "../middlewares/requireAuth";

const router = Router();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  "Prospect",
  "In Discussion",
  "Negotiation",
  "Mail Confirmed",
  "RO Received",
  "Lost",
] as const;

const DEAL_TYPES = [
  "Linear TV",
  "IPs",
  "Digital",
  "Media Solutions",
  "Integrated Packages",
] as const;

const PRIORITIES = ["Regular", "High", "Strategic"] as const;

type Stage = (typeof DEAL_STAGES)[number];

const STAGE_RANK: Record<Stage, number> = {
  "Prospect":       0,
  "In Discussion":  1,
  "Negotiation":    2,
  "Mail Confirmed": 3,
  "RO Received":    4,
  "Lost":           5,
};

const TERMINAL: Set<Stage> = new Set(["Lost", "RO Received"]);

const GLOBAL_VIEW_ROLES = new Set(["SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN", "DIGI OPS"]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isValidStage(s: string): s is Stage {
  return (DEAL_STAGES as readonly string[]).includes(s);
}

function canAccessDeal(
  deal: { repUserId: string; region: string },
  user: NonNullable<Express.Request["user"]>,
): boolean {
  if (GLOBAL_VIEW_ROLES.has(user.role)) return true;
  if (user.role === "REGION HEAD")      return deal.region === user.region;
  if (user.role === "SALES REP")        return deal.repUserId === user.id;
  return false;
}

async function fetchDeal(id: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return rows[0] ?? null;
}

// ─── POST /api/deals ─────────────────────────────────────────────────────────
// Create a new deal (opportunity) under an existing client account.
// Identity is derived from the session. The client account must already exist
// and must belong to the calling rep (or be accessible to their region head / admin).
//
// What is NOT stored on deals:
//   • pipelineAmount — not stored. COMMITTED / IN PLAY are derived from deals.amount+stage.
//   • targetAmount   — not stored. That belongs to target_submissions / target_clients.
//   • lastDealMeetingDate — not stored on deals. Lives on client_accounts, set by touchpoints.
router.post("/deals", requireAuth, async (req, res) => {
  const user = req.user!;

  if (!["SALES REP", "REGION HEAD", "ADMIN"].includes(user.role)) {
    res.status(403).json({ ok: false, error: "Only Sales Reps, Region Heads, and Admins can create deals" });
    return;
  }

  const {
    clientAccountId,
    dealType,
    quarter,
    amount: rawAmount,
    priority,
    contactName,
    designation,
    contactLevel,
    phone,
    email,
    agencyName,
    zohoAgencyId,
    nextStep,
    nextStepDate,
    notes,
  } = (req.body ?? {}) as {
    clientAccountId?: string;
    dealType?:        string;
    quarter?:         string;
    amount?:          number;
    priority?:        string;
    contactName?:     string;
    designation?:     string;
    contactLevel?:    string;
    phone?:           string;
    email?:           string;
    agencyName?:      string;
    zohoAgencyId?:    string;
    nextStep?:        string;
    nextStepDate?:    string;
    notes?:           string;
  };

  // ── Validation ────────────────────────────────────────────────────────────
  if (!clientAccountId?.trim()) {
    res.status(400).json({ ok: false, error: "clientAccountId is required" });
    return;
  }
  if (!dealType?.trim() || !(DEAL_TYPES as readonly string[]).includes(dealType)) {
    res.status(400).json({ ok: false, error: `dealType must be one of: ${DEAL_TYPES.join(", ")}` });
    return;
  }
  if (!quarter?.trim()) {
    res.status(400).json({ ok: false, error: "quarter is required (e.g. 'Q1 FY26')" });
    return;
  }
  if (priority && !(PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ ok: false, error: `priority must be one of: ${PRIORITIES.join(", ")}` });
    return;
  }

  // amount is optional (rep may not know yet), but if provided must be a positive integer
  let amt: number | null = null;
  if (rawAmount !== undefined && rawAmount !== null) {
    amt = Math.round(Number(rawAmount));
    if (!Number.isFinite(amt) || amt < 0) {
      res.status(400).json({ ok: false, error: "amount must be a non-negative integer (whole rupees)" });
      return;
    }
    if (amt === 0) amt = null; // treat 0 as unknown
  }

  try {
    // Verify the client account exists and is accessible to the caller
    const rows = await db.select().from(clientAccounts).where(eq(clientAccounts.id, clientAccountId)).limit(1);
    const acct = rows[0] ?? null;

    if (!acct) {
      res.status(404).json({ ok: false, error: "Client account not found" });
      return;
    }
    if (!canAccessDeal({ repUserId: acct.repUserId, region: acct.region }, user)) {
      res.status(403).json({ ok: false, error: "You do not have access to this client account" });
      return;
    }

    const [deal] = await db
      .insert(deals)
      .values({
        // ── Parent ────────────────────────────────────────────────────────
        clientAccountId:  acct.id,

        // ── Identity from session (not from body) ─────────────────────────
        repUserId:        acct.repUserId,      // deal always belongs to the account's rep
        repName:          acct.repName,
        region:           acct.region,
        repId:            acct.repId ?? null,

        // ── Client (denormalized from account) ────────────────────────────
        clientCompany:    acct.clientName,
        zohoAccountId:    acct.zohoAccountId ?? null,

        // ── Classification ────────────────────────────────────────────────
        dealType:         dealType.trim(),
        quarter:          quarter.trim(),
        priority:         (priority as (typeof PRIORITIES)[number]) ?? "Regular",

        // ── Opportunity value (NOT pipelineAmount / NOT targetAmount) ─────
        amount:           amt,

        // ── Stage — always starts at Prospect ─────────────────────────────
        stage:            "Prospect",
        lossReason:       null,

        // ── Contact ───────────────────────────────────────────────────────
        contactName:      contactName?.trim()  || null,
        designation:      designation?.trim()  || null,
        contactLevel:     contactLevel?.trim() || null,
        phone:            phone?.trim()        || null,
        email:            email?.trim()        || null,

        // ── Agency ────────────────────────────────────────────────────────
        agencyName:       agencyName?.trim()   || null,
        zohoAgencyId:     zohoAgencyId?.trim() || null,

        // ── Planning ──────────────────────────────────────────────────────
        nextStep:         nextStep?.trim()     || null,
        nextStepDate:     nextStepDate?.trim() || null,

        // ── Notes ─────────────────────────────────────────────────────────
        notes:            notes?.trim()        || null,

        // ── Audit ─────────────────────────────────────────────────────────
        createdByUserId:  user.id,
      })
      .returning();

    res.status(201).json({ ok: true, deal });
  } catch (err) {
    req.log.error({ err }, "POST /deals error");
    res.status(500).json({ ok: false, error: "Failed to create deal" });
  }
});

// ─── GET /api/deals ──────────────────────────────────────────────────────────
// List deals — role-scoped by repUserId (UUID) and region.
// Optional query params: ?stage= ?dealType= ?quarter= ?region= ?repUserId= ?clientAccountId=
router.get("/deals", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    stage:           filterStage,
    dealType:        filterDealType,
    quarter:         filterQuarter,
    region:          filterRegion,
    repUserId:       filterRepUserId,
    clientAccountId: filterAccountId,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(deals);

    // Role-based scope
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }

    // Optional refinement
    if (filterStage && isValidStage(filterStage)) rows = rows.filter(r => r.stage === filterStage);
    if (filterDealType)   rows = rows.filter(r => r.dealType   === filterDealType);
    if (filterQuarter)    rows = rows.filter(r => r.quarter    === filterQuarter);
    if (filterRegion)     rows = rows.filter(r => r.region     === filterRegion);
    if (filterRepUserId)  rows = rows.filter(r => r.repUserId  === filterRepUserId);
    if (filterAccountId)  rows = rows.filter(r => r.clientAccountId === filterAccountId);

    rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json({ ok: true, deals: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /deals error");
    res.status(500).json({ ok: false, error: "Failed to list deals" });
  }
});

// ─── GET /api/deals/:id ──────────────────────────────────────────────────────
// Full detail — deal + linked revenue entries for the ACHIEVED figure.
router.get("/deals/:id", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    const deal = await fetchDeal(req.params.id);
    if (!deal) {
      res.status(404).json({ ok: false, error: "Deal not found" });
      return;
    }
    if (!canAccessDeal(deal, user)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    // Linked revenue entries for this deal (source of ACHIEVED — never deal.amount)
    const linkedRevenue = await db
      .select()
      .from(revenueEntries)
      .where(eq(revenueEntries.dealId, deal.id));

    const achieved = linkedRevenue.reduce((s, e) => s + (e.amount ?? 0), 0);

    res.json({ ok: true, deal, revenueEntries: linkedRevenue, achieved });
  } catch (err) {
    req.log.error({ err }, "GET /deals/:id error");
    res.status(500).json({ ok: false, error: "Failed to fetch deal" });
  }
});

// ─── PATCH /api/deals/:id/stage ─────────────────────────────────────────────
// Advance or change the stage of a deal.
//
// Stage transition rules (server-enforced):
//   1. Cannot change from a terminal stage (Lost, RO Received) — for any role.
//   2. "Lost" requires lossReason in the request body.
//   3. "RO Received" requires at least one linked revenue entry with net positive amount.
//      RO Received may NOT be set manually without a revenue entry — regardless of role.
//   4. Non-admin (SALES REP, REGION HEAD): may only advance to the immediately next
//      stage OR set Lost. Backward moves and stage skipping are blocked.
//   5. ADMIN: may set any stage, but rules 1, 2, and 3 still apply.
//
// Other deal fields (amount, contactName, notes, nextStep, etc.) are NOT updated here.
// This route changes stage and lossReason only.
router.patch("/deals/:id/stage", requireAuth, async (req, res) => {
  const user = req.user!;
  const { stage: newStage, lossReason } = (req.body ?? {}) as {
    stage?:       string;
    lossReason?:  string;
  };

  if (!newStage || !isValidStage(newStage)) {
    res.status(400).json({ ok: false, error: `stage must be one of: ${DEAL_STAGES.join(", ")}` });
    return;
  }

  // Rule 2: Lost requires lossReason
  if (newStage === "Lost" && !lossReason?.trim()) {
    res.status(400).json({ ok: false, error: "lossReason is required when setting stage to 'Lost'" });
    return;
  }

  try {
    const deal = await fetchDeal(req.params.id);
    if (!deal) {
      res.status(404).json({ ok: false, error: "Deal not found" });
      return;
    }
    if (!canAccessDeal(deal, user)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    const current = deal.stage as Stage;

    // Rule 1: Cannot transition out of a terminal stage
    if (TERMINAL.has(current)) {
      res.status(409).json({
        ok:    false,
        error: `Stage is '${current}' — terminal stages cannot be changed`,
      });
      return;
    }

    if (current === newStage) {
      res.status(409).json({ ok: false, error: `Deal is already at stage '${newStage}'` });
      return;
    }

    const isAdmin  = user.role === "ADMIN";
    const currRank = STAGE_RANK[current];
    const newRank  = STAGE_RANK[newStage];

    // Rule 4: Non-admin transition guard
    if (!isAdmin) {
      if (newStage === "Lost") {
        // always allowed from any non-terminal stage
      } else if (newRank !== currRank + 1) {
        res.status(409).json({
          ok:    false,
          error: newRank < currRank
            ? `Cannot move backward from '${current}' to '${newStage}' — only Admin can regress stage`
            : `Cannot skip from '${current}' to '${newStage}' — advance one stage at a time`,
        });
        return;
      }
    }

    // Rule 3: RO Received requires a linked revenue entry with net positive amount
    if (newStage === "RO Received") {
      const linked = await db
        .select()
        .from(revenueEntries)
        .where(eq(revenueEntries.dealId, deal.id));
      const netRevenue = linked.reduce((s, e) => s + (e.amount ?? 0), 0);
      if (netRevenue <= 0) {
        res.status(409).json({
          ok:    false,
          error: "Stage 'RO Received' requires at least one revenue entry linked to this deal (via dealId) with a net positive amount. Log revenue first via POST /api/revenue.",
        });
        return;
      }
    }

    const [updated] = await db
      .update(deals)
      .set({
        stage:      newStage,
        lossReason: newStage === "Lost" ? (lossReason?.trim() ?? null) : deal.lossReason,
        updatedAt:  new Date(),
      })
      .where(eq(deals.id, deal.id))
      .returning();

    res.json({ ok: true, deal: updated, previous: current });
  } catch (err) {
    req.log.error({ err }, "PATCH /deals/:id/stage error");
    res.status(500).json({ ok: false, error: "Failed to update deal stage" });
  }
});

export default router;
