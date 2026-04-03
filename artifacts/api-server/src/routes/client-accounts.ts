import { Router }          from "express";
import { db, clientAccounts, revenueEntries } from "@workspace/db";
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

type Stage = (typeof DEAL_STAGES)[number];

// Numeric rank for ordered transitions. Lost = terminal from any active stage.
const STAGE_RANK: Record<Stage, number> = {
  "Prospect":       0,
  "In Discussion":  1,
  "Negotiation":    2,
  "Mail Confirmed": 3,
  "RO Received":    4,
  "Lost":           5,
};

// Terminal stages — no further transitions allowed for any role
const TERMINAL: Set<Stage> = new Set(["Lost", "RO Received"]);

// Roles that may see all accounts regardless of rep or region
const GLOBAL_VIEW_ROLES = new Set(["SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN", "DIGI OPS"]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isValidStage(s: string): s is Stage {
  return (DEAL_STAGES as readonly string[]).includes(s);
}

function canAccessAccount(
  acct: { repUserId: string; region: string },
  user: NonNullable<Express.Request["user"]>,
): boolean {
  if (GLOBAL_VIEW_ROLES.has(user.role)) return true;
  if (user.role === "REGION HEAD")      return acct.region === user.region;
  if (user.role === "SALES REP")        return acct.repUserId === user.id;
  return false;
}

async function fetchAccount(id: string) {
  const rows = await db.select().from(clientAccounts).where(eq(clientAccounts.id, id)).limit(1);
  return rows[0] ?? null;
}

// ─── POST /api/client-accounts ───────────────────────────────────────────────
// Create a new client account (relationship record).
// Called when a rep adds their first deal with a client they haven't worked with before.
// Identity (repUserId, repName, region) is derived entirely from the session — not the body.
router.post("/client-accounts", requireAuth, async (req, res) => {
  const user = req.user!;

  if (!["SALES REP", "REGION HEAD", "ADMIN"].includes(user.role)) {
    res.status(403).json({ ok: false, error: "Only Sales Reps, Region Heads, and Admins can create client accounts" });
    return;
  }

  const { clientName, zohoAccountId } = (req.body ?? {}) as {
    clientName?:    string;
    zohoAccountId?: string;
  };

  if (!clientName?.trim()) {
    res.status(400).json({ ok: false, error: "clientName is required" });
    return;
  }

  // Prevent duplicate accounts for the same rep+client combination
  const all = await db.select().from(clientAccounts);
  const duplicate = all.find(
    a => a.repUserId === user.id && a.clientName.toLowerCase() === clientName.trim().toLowerCase(),
  );
  if (duplicate) {
    res.status(409).json({
      ok:    false,
      error: `A client account for '${clientName.trim()}' already exists for your rep record`,
      existingId: duplicate.id,
    });
    return;
  }

  try {
    const [acct] = await db
      .insert(clientAccounts)
      .values({
        repUserId:       user.id,
        repName:         user.name,
        region:          user.region ?? "",
        repId:           user.repId ?? null,
        clientName:      clientName.trim(),
        zohoAccountId:   zohoAccountId?.trim() || null,
        currentStage:    "Prospect",
        // lastContactDate / lastDealMeetingDate — intentionally not set here.
        // They are set exclusively by POST /api/touchpoints (Phase 6).
        createdByUserId: user.id,
      })
      .returning();

    res.status(201).json({ ok: true, account: acct });
  } catch (err) {
    req.log.error({ err }, "POST /client-accounts error");
    res.status(500).json({ ok: false, error: "Failed to create client account" });
  }
});

// ─── GET /api/client-accounts ────────────────────────────────────────────────
// List client accounts — role-scoped.
// Optional query params: ?stage= ?region= ?repUserId=
router.get("/client-accounts", requireAuth, async (req, res) => {
  const user = req.user!;
  const { stage, region: filterRegion, repUserId: filterRepUserId } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(clientAccounts);

    // Role-based scope
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }

    // Optional refinement
    if (stage && isValidStage(stage))   rows = rows.filter(r => r.currentStage === stage);
    if (filterRegion)                   rows = rows.filter(r => r.region === filterRegion);
    if (filterRepUserId)                rows = rows.filter(r => r.repUserId === filterRepUserId);

    rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json({ ok: true, accounts: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /client-accounts error");
    res.status(500).json({ ok: false, error: "Failed to list client accounts" });
  }
});

// ─── GET /api/client-accounts/:id ───────────────────────────────────────────
// Full detail — account + linked deals + linked revenue entries.
router.get("/client-accounts/:id", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    const acct = await fetchAccount(req.params.id);
    if (!acct) {
      res.status(404).json({ ok: false, error: "Client account not found" });
      return;
    }
    if (!canAccessAccount(acct, user)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    // Bring in linked revenue entries for this account
    const linkedRevenue = await db
      .select()
      .from(revenueEntries)
      .where(eq(revenueEntries.clientAccountId, acct.id));

    const achievedTotal = linkedRevenue.reduce((s, e) => s + (e.amount ?? 0), 0);

    res.json({
      ok:            true,
      account:       acct,
      revenueEntries: linkedRevenue,
      achieved:      achievedTotal,
    });
  } catch (err) {
    req.log.error({ err }, "GET /client-accounts/:id error");
    res.status(500).json({ ok: false, error: "Failed to fetch client account" });
  }
});

// ─── PATCH /api/client-accounts/:id/stage ───────────────────────────────────
// Advance or change the relationship stage of a client account.
//
// Transition rules (server-enforced):
//   1. Cannot change from a terminal stage (Lost, RO Received) — for any role.
//   2. "Lost" may be set from any non-terminal active stage (no stage skipping rule).
//   3. "RO Received" requires at least one revenue entry linked to this client account.
//   4. Non-admin (SALES REP, REGION HEAD): may only advance to the immediately next
//      stage OR set Lost. No backward moves. No stage skipping.
//   5. ADMIN: may set any stage (but 1 and 3 still apply).
//
// lastDealMeetingDate and lastContactDate are NOT touched by this route.
// They are managed exclusively by the touchpoints route (Phase 6).
router.patch("/client-accounts/:id/stage", requireAuth, async (req, res) => {
  const user = req.user!;
  const { stage: newStage } = (req.body ?? {}) as { stage?: string };

  if (!newStage || !isValidStage(newStage)) {
    res.status(400).json({ ok: false, error: `stage must be one of: ${DEAL_STAGES.join(", ")}` });
    return;
  }

  try {
    const acct = await fetchAccount(req.params.id);
    if (!acct) {
      res.status(404).json({ ok: false, error: "Client account not found" });
      return;
    }
    if (!canAccessAccount(acct, user)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    const current = acct.currentStage as Stage;

    // Rule 1: Cannot transition out of a terminal stage
    if (TERMINAL.has(current)) {
      res.status(409).json({
        ok:    false,
        error: `Stage is '${current}' — terminal stages cannot be changed`,
      });
      return;
    }

    // No-op: already at the requested stage
    if (current === newStage) {
      res.status(409).json({ ok: false, error: `Account is already at stage '${newStage}'` });
      return;
    }

    const isAdmin  = user.role === "ADMIN";
    const currRank = STAGE_RANK[current];
    const newRank  = STAGE_RANK[newStage];

    if (!isAdmin) {
      // Non-admin: forward to immediately next stage, or Lost from any active stage
      if (newStage === "Lost") {
        // always allowed from any non-terminal stage — proceed
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

    // Rule 3: RO Received requires a linked revenue entry
    if (newStage === "RO Received") {
      const linked = await db
        .select()
        .from(revenueEntries)
        .where(eq(revenueEntries.clientAccountId, acct.id));
      const netRevenue = linked.reduce((s, e) => s + (e.amount ?? 0), 0);
      if (netRevenue <= 0) {
        res.status(409).json({
          ok:    false,
          error: "Stage 'RO Received' requires at least one revenue entry linked to this client account with a net positive amount. Log revenue first via POST /api/revenue.",
        });
        return;
      }
    }

    const [updated] = await db
      .update(clientAccounts)
      .set({ currentStage: newStage, updatedAt: new Date() })
      .where(eq(clientAccounts.id, acct.id))
      .returning();

    res.json({ ok: true, account: updated, previous: current });
  } catch (err) {
    req.log.error({ err }, "PATCH /client-accounts/:id/stage error");
    res.status(500).json({ ok: false, error: "Failed to update stage" });
  }
});

export default router;
