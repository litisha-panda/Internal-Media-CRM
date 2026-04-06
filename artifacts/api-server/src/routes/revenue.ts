import { Router } from "express";
import { db, revenueEntries } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ── Issue #2: RH scope is by region, not by repId ───────────────────────────
function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP")   return eq(revenueEntries.repId,  user.repId!);
  if (role === "REGION HEAD") return eq(revenueEntries.region, user.region!);
  return undefined; // SALES HEAD, CRO, SALES STRATEGY, ADMIN see all
}

// GET /api/revenue — list entries (scoped by role)
router.get("/revenue", requireAuth, async (req, res) => {
  try {
    const { quarter, fiscalYear } = req.query as Record<string, string>;
    const conditions: any[] = [];

    const scopeCond = scopeCondition(req.user!);
    if (scopeCond) conditions.push(scopeCond);
    if (quarter)    conditions.push(eq(revenueEntries.quarter, quarter));
    if (fiscalYear) conditions.push(eq(revenueEntries.fiscalYear, fiscalYear));

    const rows = conditions.length
      ? await db.select().from(revenueEntries).where(and(...conditions)).orderBy(desc(revenueEntries.createdAt))
      : await db.select().from(revenueEntries).orderBy(desc(revenueEntries.createdAt));

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/revenue/achieved — aggregated achieved per rep (excludes reversed entries)
router.get("/revenue/achieved", requireAuth, async (req, res) => {
  try {
    const { quarter, fiscalYear } = req.query as Record<string, string>;

    // ACHIEVED = is_reversed=false AND reversal_of IS NULL
    const conditions: any[] = [
      eq(revenueEntries.isReversed, false),
      sql`${revenueEntries.reversalOf} IS NULL`,
    ];
    const scopeCond = scopeCondition(req.user!);
    if (scopeCond)  conditions.push(scopeCond);
    if (quarter)    conditions.push(eq(revenueEntries.quarter, quarter));
    if (fiscalYear) conditions.push(eq(revenueEntries.fiscalYear, fiscalYear));

    const rows = await db
      .select({
        repId:  revenueEntries.repId,
        region: revenueEntries.region,
        total:  sql<number>`SUM(${revenueEntries.amount})`,
        count:  sql<number>`COUNT(*)`,
      })
      .from(revenueEntries)
      .where(and(...conditions))
      .groupBy(revenueEntries.repId, revenueEntries.region);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/revenue/:id — single entry
router.get("/revenue/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(revenueEntries)
      .where(eq(revenueEntries.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/revenue — create a new immutable revenue entry
router.post("/revenue", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const {
      id, clientCompany, zohoAccountId, dealType,
      amount, invoiceRef, date, quarter, fiscalYear,
      notes, reversalOf, dealId,
    } = req.body;

    if (!id || !clientCompany || amount === undefined) {
      return void res.status(400).json({ ok: false, error: "id, clientCompany, and amount are required" });
    }

    // ── Issue #3: force ownership from session for SALES REP ────────────────
    const authorRepId  = u.role === "SALES REP" ? u.repId!  : (req.body.repId  ?? u.repId ?? 0);
    const authorRegion = u.role === "SALES REP" ? u.region! : (req.body.region ?? u.region ?? null);

    const isReversal = !!reversalOf;

    const row = await db
      .insert(revenueEntries)
      .values({
        id,
        repId:         authorRepId,
        region:        authorRegion,
        clientCompany,
        zohoAccountId: zohoAccountId ?? null,
        dealType:      dealType ?? null,
        amount:        Number(amount),
        invoiceRef:    invoiceRef ?? null,
        date:          date ?? null,
        quarter:       quarter ?? null,
        fiscalYear:    fiscalYear ?? "FY26",
        notes:         notes ?? null,
        isReversed:    false,
        reversalOf:    reversalOf ?? null,
        dealId:        dealId ?? null,
      })
      .onConflictDoNothing()
      .returning();

    // If this is a reversal entry, mark the original as reversed
    if (isReversal) {
      await db
        .update(revenueEntries)
        .set({ isReversed: true, updatedAt: new Date() })
        .where(eq(revenueEntries.id, reversalOf));
    }

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/revenue/:id/notes — explicit notes-only endpoint (convenience alias)
router.patch("/revenue/:id/notes", requireAuth, async (req, res) => {
  try {
    const { notes } = req.body;
    if (notes === undefined) return void res.status(400).json({ ok: false, error: "notes field required" });

    const updated = await db
      .update(revenueEntries)
      .set({ notes, updatedAt: new Date() })
      .where(eq(revenueEntries.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/revenue/:id — general PATCH: only `notes` field is mutable (immutability rule)
router.patch("/revenue/:id", requireAuth, async (req, res) => {
  try {
    const { notes } = req.body; // all other fields intentionally ignored
    const updated = await db
      .update(revenueEntries)
      .set({ notes: notes ?? null, updatedAt: new Date() })
      .where(eq(revenueEntries.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
