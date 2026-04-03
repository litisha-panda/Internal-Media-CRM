import { Router }           from "express";
import { db, revenueEntries } from "@workspace/db";
import { eq, and }           from "drizzle-orm";
import { requireAuth }       from "../middlewares/requireAuth";

const router = Router();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DEAL_TYPES = [
  "Linear TV",
  "IPs",
  "Digital",
  "Media Solutions",
  "Integrated Packages",
] as const;

// Roles allowed to create revenue entries
const CAN_LOG_REVENUE = new Set(["SALES REP", "REGION HEAD", "SALES HEAD", "CRO", "ADMIN"]);

// Roles that see all entries regardless of rep or region
const GLOBAL_VIEW_ROLES = new Set(["SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN", "DIGI OPS"]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Server-side scope check — determines whether a user may read or act on
 * a given revenue entry. Identity is anchored to repUserId (UUID).
 */
function canAccessEntry(
  entry: { repUserId: string; region: string },
  user:  NonNullable<Express.Request["user"]>,
): boolean {
  if (GLOBAL_VIEW_ROLES.has(user.role)) return true;
  if (user.role === "REGION HEAD")      return entry.region === user.region;
  if (user.role === "SALES REP")        return entry.repUserId === user.id;
  return false;
}

/**
 * Derive fiscal year from a quarter string ("Q1 FY26" → "FY26").
 * Falls back to the provided override if quarter is malformed.
 */
function fyFromQuarter(quarter: string): string {
  const m = quarter.match(/FY\d{2,4}/);
  return m ? m[0] : "";
}

/** Fetch a single entry by id. Returns null if not found. */
async function fetchEntry(id: string) {
  const rows = await db
    .select()
    .from(revenueEntries)
    .where(eq(revenueEntries.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── POST /api/revenue ───────────────────────────────────────────────────────
// Create a new revenue entry.
//
// Identity rules:
//   • repUserId, repName, region are derived entirely from req.user (session).
//   • Callers cannot impersonate another rep via request body.
//   • ADMIN and SALES HEAD can supply a targetRepUserId to log on behalf of a
//     rep (for corrections / import). If supplied, the server looks up the
//     target rep from DB — the caller cannot freely forge identity fields.
//
// Immutability contract:
//   • amount, invoiceRef, date, quarter, fiscalYear, all identity fields —
//     written once here and NEVER touched again.
//   • notes is writable at creation and patchable via PATCH /:id/notes.
//
// Deal stage note:
//   • If dealId is supplied, the caller may separately update the deal stage
//     to "RO Received" on the frontend (Phase 8 cutover). The backend DOES
//     NOT do that implicitly. Revenue creation never triggers a deal mutation.
router.post("/revenue", requireAuth, async (req, res) => {
  const user = req.user!;

  if (!CAN_LOG_REVENUE.has(user.role)) {
    res.status(403).json({ ok: false, error: "Your role is not permitted to log revenue" });
    return;
  }

  const {
    clientCompany,
    zohoAccountId,
    clientAccountId,
    dealId,
    dealType,
    channel,
    amount: rawAmount,
    invoiceRef,
    date,
    quarter,
    fiscalYear,
    notes,
  } = (req.body ?? {}) as {
    clientCompany?:   string;
    zohoAccountId?:   string;
    clientAccountId?: string;
    dealId?:          string;
    dealType?:        string;
    channel?:         string;
    amount?:          number;
    invoiceRef?:      string;
    date?:            string;
    quarter?:         string;
    fiscalYear?:      string;
    notes?:           string;
  };

  // ── Validation ────────────────────────────────────────────────────────────
  if (!clientCompany?.trim()) {
    res.status(400).json({ ok: false, error: "clientCompany is required" });
    return;
  }
  if (!dealType?.trim() || !(DEAL_TYPES as readonly string[]).includes(dealType)) {
    res.status(400).json({ ok: false, error: `dealType must be one of: ${DEAL_TYPES.join(", ")}` });
    return;
  }
  const amt = Math.round(Number(rawAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ ok: false, error: "amount must be a positive integer (whole rupees)" });
    return;
  }
  if (!quarter?.trim()) {
    res.status(400).json({ ok: false, error: "quarter is required (e.g. 'Q1 FY26')" });
    return;
  }

  const fy = fiscalYear?.trim() || fyFromQuarter(quarter);
  if (!fy) {
    res.status(400).json({ ok: false, error: "fiscalYear is required or must be inferable from quarter (e.g. 'Q1 FY26')" });
    return;
  }

  // Date defaults to today in ISO format
  const entryDate = date?.trim() || new Date().toISOString().slice(0, 10);

  try {
    const [entry] = await db
      .insert(revenueEntries)
      .values({
        // ── Identity (from session — not from request body) ────────────────
        repUserId:        user.id,
        repName:          user.name,
        region:           user.region ?? "",
        repId:            user.repId ?? null,          // transitional legacy field

        // ── Client ────────────────────────────────────────────────────────
        clientCompany:    clientCompany.trim(),
        zohoAccountId:    zohoAccountId?.trim()    || null,
        clientAccountId:  clientAccountId?.trim()  || null,
        dealId:           dealId?.trim()           || null,

        // ── Classification ────────────────────────────────────────────────
        dealType:         dealType.trim(),
        channel:          channel?.trim()          || null,

        // ── Financials (immutable after this insert) ───────────────────────
        amount:           amt,
        invoiceRef:       invoiceRef?.trim()       || null,

        // ── Temporal scope (immutable after this insert) ──────────────────
        date:             entryDate,
        quarter:          quarter.trim(),
        fiscalYear:       fy,

        // ── Mutable field ─────────────────────────────────────────────────
        notes:            notes?.trim()            || null,

        // ── Reversal metadata (not a reversal) ────────────────────────────
        isReversal:       false,
        reversalOfId:     null,
        reversedByUserId: null,

        // ── Audit ─────────────────────────────────────────────────────────
        createdByUserId:  user.id,
      })
      .returning();

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    req.log.error({ err }, "POST /revenue error");
    res.status(500).json({ ok: false, error: "Failed to create revenue entry" });
  }
});

// ─── GET /api/revenue ────────────────────────────────────────────────────────
// List revenue entries — role-scoped by repUserId (UUID) and region.
// Optional query params: ?quarter= ?fiscalYear= ?repUserId= ?dealType= ?includeReversals=true
router.get("/revenue", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    quarter,
    fiscalYear,
    repUserId: filterRepUserId,
    dealType:  filterDealType,
    includeReversals,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(revenueEntries);

    // ── Role-based scope (server-enforced) ───────────────────────────────
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }
    // GLOBAL_VIEW_ROLES — no filter

    // ── Optional query filters ────────────────────────────────────────────
    if (quarter)           rows = rows.filter(r => r.quarter    === quarter);
    if (fiscalYear)        rows = rows.filter(r => r.fiscalYear === fiscalYear);
    if (filterRepUserId)   rows = rows.filter(r => r.repUserId  === filterRepUserId);
    if (filterDealType)    rows = rows.filter(r => r.dealType   === filterDealType);

    // By default exclude reversal entries from the list (still counted in /achieved)
    // Pass ?includeReversals=true to see them explicitly
    if (includeReversals !== "true") {
      rows = rows.filter(r => !r.isReversal);
    }

    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({ ok: true, entries: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /revenue error");
    res.status(500).json({ ok: false, error: "Failed to list revenue entries" });
  }
});

// ─── GET /api/revenue/achieved ───────────────────────────────────────────────
// Returns the ACHIEVED aggregate — the single source of truth.
//
// ACHIEVED = SUM(amount) over all entries in scope.
// Reversal entries have negative amounts, so they cancel out naturally.
// No special exclusion logic is needed — the arithmetic is self-correcting.
//
// Optional query params: ?repUserId= ?quarter= ?fiscalYear=
// All params are ANDed. Omit a param to get the full scope for your role.
router.get("/revenue/achieved", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    repUserId:  filterRepUserId,
    quarter:    filterQuarter,
    fiscalYear: filterFY,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(revenueEntries);

    // ── Role-based scope ──────────────────────────────────────────────────
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }

    // ── Optional refinement filters ───────────────────────────────────────
    if (filterRepUserId) rows = rows.filter(r => r.repUserId  === filterRepUserId);
    if (filterQuarter)   rows = rows.filter(r => r.quarter    === filterQuarter);
    if (filterFY)        rows = rows.filter(r => r.fiscalYear === filterFY);

    // ── ACHIEVED = SUM(amount) ────────────────────────────────────────────
    // Positive normal entries + negative reversal entries = net achieved.
    // This is the ONLY authoritative calculation for achieved revenue.
    const achieved = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    // ── Per-rep breakdown (useful for dashboards) ─────────────────────────
    const byRep: Record<string, { repUserId: string; repName: string; region: string; achieved: number }> = {};
    for (const r of rows) {
      if (!byRep[r.repUserId]) {
        byRep[r.repUserId] = { repUserId: r.repUserId, repName: r.repName, region: r.region, achieved: 0 };
      }
      byRep[r.repUserId].achieved += r.amount ?? 0;
    }

    res.json({
      ok:       true,
      achieved,
      entryCount: rows.length,
      byRep:    Object.values(byRep).sort((a, b) => b.achieved - a.achieved),
      filters:  { repUserId: filterRepUserId, quarter: filterQuarter, fiscalYear: filterFY },
    });
  } catch (err) {
    req.log.error({ err }, "GET /revenue/achieved error");
    res.status(500).json({ ok: false, error: "Failed to compute achieved" });
  }
});

// ─── PATCH /api/revenue/:id/notes ────────────────────────────────────────────
// Update the notes field only. This is the ONLY mutation allowed on a revenue
// entry after creation.
// Permitted: the rep who created the entry, their RH, or ADMIN.
router.patch("/revenue/:id/notes", requireAuth, async (req, res) => {
  const user = req.user!;
  const { notes } = (req.body ?? {}) as { notes?: string };

  if (notes === undefined || notes === null) {
    res.status(400).json({ ok: false, error: "notes field is required in body (may be empty string to clear)" });
    return;
  }

  try {
    const entry = await fetchEntry(req.params.id);

    if (!entry) {
      res.status(404).json({ ok: false, error: "Revenue entry not found" });
      return;
    }

    // Scope check: creator, RH of same region, or ADMIN
    const isCreator = entry.repUserId === user.id;
    const isRHForRegion = user.role === "REGION HEAD" && user.region === entry.region;
    const isAdmin = user.role === "ADMIN";

    if (!isCreator && !isRHForRegion && !isAdmin) {
      res.status(403).json({ ok: false, error: "Only the rep who logged this entry, their Region Head, or Admin can update notes" });
      return;
    }

    const [updated] = await db
      .update(revenueEntries)
      .set({ notes: notes.trim() || null, updatedAt: new Date() })
      .where(eq(revenueEntries.id, entry.id))
      .returning();

    res.json({ ok: true, entry: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /revenue/:id/notes error");
    res.status(500).json({ ok: false, error: "Failed to update notes" });
  }
});

// ─── POST /api/revenue/:id/reverse ───────────────────────────────────────────
// Create a reversal entry — a system-created negative offset of the original.
//
// Rules:
//   • Only ADMIN or REGION HEAD of the entry's region may reverse.
//   • The original entry is NEVER modified — it stays in the ledger as-is.
//   • The reversal row has amount = -(original.amount), is_reversal = true,
//     reversal_of_id = original.id.
//   • An entry that is itself a reversal cannot be reversed again (prevents
//     double-negation; raise a new positive correcting entry instead).
//   • An entry cannot be reversed twice (check for existing reversal row).
//   • reason is required — stored in the reversal row's notes field.
router.post("/revenue/:id/reverse", requireAuth, async (req, res) => {
  const user = req.user!;
  const { reason } = (req.body ?? {}) as { reason?: string };

  if (!reason?.trim()) {
    res.status(400).json({ ok: false, error: "reason is required for a reversal" });
    return;
  }

  // Only ADMIN or REGION HEAD can reverse
  if (!["ADMIN", "REGION HEAD"].includes(user.role)) {
    res.status(403).json({ ok: false, error: "Only Admin or Region Head can reverse a revenue entry" });
    return;
  }

  try {
    const original = await fetchEntry(req.params.id);

    if (!original) {
      res.status(404).json({ ok: false, error: "Revenue entry not found" });
      return;
    }

    // Cannot reverse a reversal entry
    if (original.isReversal) {
      res.status(409).json({
        ok:    false,
        error: "This entry is itself a reversal — it cannot be reversed again. Create a new positive correcting entry instead.",
      });
      return;
    }

    // Region scope check for RH
    if (user.role === "REGION HEAD" && original.region !== user.region) {
      res.status(403).json({
        ok:    false,
        error: `This entry belongs to region '${original.region}' — you manage '${user.region}'`,
      });
      return;
    }

    // Check: has this entry already been reversed?
    const existingReversals = await db
      .select()
      .from(revenueEntries)
      .where(eq(revenueEntries.reversalOfId, original.id));

    if (existingReversals.length > 0) {
      res.status(409).json({
        ok:    false,
        error: "This entry has already been reversed",
        reversalId: existingReversals[0].id,
      });
      return;
    }

    // Create the reversal row — a negative-amount mirror of the original
    const [reversal] = await db
      .insert(revenueEntries)
      .values({
        // ── Identity — copied from original (rep identity is preserved) ───
        repUserId:        original.repUserId,
        repName:          original.repName,
        region:           original.region,
        repId:            original.repId ?? null,

        // ── Client — copied from original ─────────────────────────────────
        clientCompany:    original.clientCompany,
        zohoAccountId:    original.zohoAccountId   ?? null,
        clientAccountId:  original.clientAccountId ?? null,
        dealId:           original.dealId          ?? null,

        // ── Classification — copied from original ─────────────────────────
        dealType:         original.dealType,
        channel:          original.channel         ?? null,

        // ── Financials — negative offset of the original ──────────────────
        amount:           -(original.amount),
        invoiceRef:       original.invoiceRef      ?? null,

        // ── Temporal scope — copied from original ─────────────────────────
        date:             new Date().toISOString().slice(0, 10),  // reversal date = today
        quarter:          original.quarter,
        fiscalYear:       original.fiscalYear,

        // ── Mutable field — reversal reason ───────────────────────────────
        notes:            `REVERSAL — ${reason.trim()}`,

        // ── Reversal metadata ─────────────────────────────────────────────
        isReversal:       true,
        reversalOfId:     original.id,
        reversedByUserId: user.id,

        // ── Audit ─────────────────────────────────────────────────────────
        createdByUserId:  user.id,
      })
      .returning();

    res.status(201).json({
      ok:       true,
      reversal,
      original: { id: original.id, amount: original.amount, clientCompany: original.clientCompany },
      netEffect: -(original.amount),
    });
  } catch (err) {
    req.log.error({ err }, "POST /revenue/:id/reverse error");
    res.status(500).json({ ok: false, error: "Failed to create reversal" });
  }
});

export default router;
