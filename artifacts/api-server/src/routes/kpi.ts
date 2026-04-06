/**
 * Centralized KPI endpoints.
 *
 * All dashboard screens must call these endpoints instead of computing metrics locally.
 * This ensures every screen — Rep, RH, NSH, CRO — uses identical formulas.
 *
 * GOLDEN RULES:
 *   - ACHIEVED  = SUM(revenueEntries.amount) WHERE isReversed=false AND reversalOf IS NULL
 *   - PIPELINE  = SUM(deal.amount × STAGE_PROB[deal.stage] / 100) for open deals
 *   - GAP       = frozenTarget − achieved − pipeline  (can be negative = ahead of target)
 *   - ATTD RATE = present / (present + absent) for attendance_records in period
 */
import { Router } from "express";
import {
  db,
  revenueEntries,
  targetSubmissions,
  deals,
  tasks,
  attendanceRecords,
  STAGE_PROB,
  CLOSED_STAGES,
} from "@workspace/db";
import { eq, and, sql, isNull, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ─── Shared helpers ───────────────────────────────────────────────────────────

function derivePipeline(deal: { stage: string | null; amount: number | null }): number {
  const stage = deal.stage ?? "Prospect";
  if (CLOSED_STAGES.has(stage)) return 0;
  const prob = STAGE_PROB[stage] ?? 10;
  return Math.round((deal.amount ?? 0) * prob / 100);
}

/** Compute KPI metrics for a given scope condition on revenue/deals/targets. */
async function computeKPI(opts: {
  quarter?:   string;
  fiscalYear?: string;
  repId?:     number;
  region?:    string;
}) {
  const { quarter, fiscalYear, repId, region } = opts;

  // ── 1. Achieved ──────────────────────────────────────────────────────────────
  const revConds: any[] = [
    eq(revenueEntries.isReversed, false),
    isNull(revenueEntries.reversalOf),
  ];
  if (repId)      revConds.push(eq(revenueEntries.repId,      repId));
  if (region)     revConds.push(eq(revenueEntries.region,     region));
  if (quarter)    revConds.push(eq(revenueEntries.quarter,    quarter));
  if (fiscalYear) revConds.push(eq(revenueEntries.fiscalYear, fiscalYear));

  const revRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${revenueEntries.amount}), 0)` })
    .from(revenueEntries)
    .where(and(...revConds));
  const achieved = Number(revRows[0]?.total ?? 0);

  // ── 2. Frozen target ─────────────────────────────────────────────────────────
  const tgtConds: any[] = [eq(targetSubmissions.status, "Approved")];
  if (repId)      tgtConds.push(eq(targetSubmissions.repId,   repId));
  if (region)     tgtConds.push(eq(targetSubmissions.region,  region));
  if (quarter)    tgtConds.push(eq(targetSubmissions.quarter, quarter));

  const tgtRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${targetSubmissions.frozenTarget}), 0)` })
    .from(targetSubmissions)
    .where(and(...tgtConds));
  const target = Number(tgtRows[0]?.total ?? 0);

  // ── 3. Pipeline ──────────────────────────────────────────────────────────────
  const dealConds: any[] = [];
  if (repId)      dealConds.push(eq(deals.repId,   repId));
  if (region)     dealConds.push(eq(deals.region,  region));
  if (quarter)    dealConds.push(eq(deals.quarter, quarter));

  const dealRows = dealConds.length
    ? await db.select({ stage: deals.stage, amount: deals.amount }).from(deals).where(and(...dealConds))
    : await db.select({ stage: deals.stage, amount: deals.amount }).from(deals);

  const pipeline = dealRows.reduce((sum, d) => sum + derivePipeline(d), 0);

  // ── 4. Gap ───────────────────────────────────────────────────────────────────
  const gap = target - achieved - pipeline;

  // ── 5. Open tasks overdue ────────────────────────────────────────────────────
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const overdueTasksRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        ...(repId ? [eq(tasks.repId, repId)] : []),
        ne(tasks.status, "Done"),
        ne(tasks.status, "Cancelled"),
        sql`${tasks.dueDate} < ${today}`,
      ),
    );
  const overdueTasks = overdueTasksRows.length;

  // ── 6. Attendance rate ────────────────────────────────────────────────────────
  const attConds: any[] = [];
  if (repId)  attConds.push(eq(attendanceRecords.userId, String(repId)));
  if (region) attConds.push(eq(attendanceRecords.region, region));

  const attRows = attConds.length
    ? await db.select({ status: attendanceRecords.status }).from(attendanceRecords).where(and(...attConds))
    : await db.select({ status: attendanceRecords.status }).from(attendanceRecords);

  const attPresent = attRows.filter((r) => r.status === "present").length;
  const attTotal   = attRows.length;
  const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

  return {
    achieved,
    target,
    pipeline,
    gap,
    overdueTasks,
    attendanceRate,
    attPresent,
    attAbsent: attTotal - attPresent,
    attTotal,
  };
}

// ─── Rep KPI — own data only ──────────────────────────────────────────────────
// GET /api/kpi/rep?quarter=Q1&fiscalYear=FY26
router.get("/kpi/rep", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    if (u.role !== "SALES REP") {
      return void res.status(403).json({ ok: false, error: "This endpoint is for SALES REP only. Use /kpi/rep/:repId for elevated roles." });
    }
    const { quarter, fiscalYear } = req.query as Record<string, string>;
    const kpi = await computeKPI({ quarter, fiscalYear, repId: u.repId! });
    res.json({ ok: true, repId: u.repId, repName: u.name, ...kpi });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/kpi/rep/:repId?quarter=Q1&fiscalYear=FY26  (RH+)
router.get("/kpi/rep/:repId", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const ALLOWED = ["REGION HEAD", "SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN"];
    if (!ALLOWED.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized to view other rep KPIs" });
    }
    const repId = parseInt(String(req.params["repId"]), 10);
    if (isNaN(repId)) return void res.status(400).json({ ok: false, error: "Invalid repId" });

    const { quarter, fiscalYear } = req.query as Record<string, string>;
    const kpi = await computeKPI({ quarter, fiscalYear, repId });
    res.json({ ok: true, repId, ...kpi });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/kpi/region/:region?quarter=Q1&fiscalYear=FY26  (RH of that region, SALES HEAD, CRO, ADMIN)
router.get("/kpi/region/:region", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const region = String(req.params["region"]);

    const ALLOWED = ["SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN"];
    const isRH = u.role === "REGION HEAD" && u.region === region;
    if (!isRH && !ALLOWED.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized for this region's KPIs" });
    }

    const { quarter, fiscalYear } = req.query as Record<string, string>;
    const kpi = await computeKPI({ quarter, fiscalYear, region });
    res.json({ ok: true, region, ...kpi });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/kpi/system?quarter=Q1&fiscalYear=FY26  (SALES HEAD, SALES STRATEGY, CRO, ADMIN)
router.get("/kpi/system", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const ALLOWED = ["SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN"];
    if (!ALLOWED.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized for system-wide KPIs" });
    }
    const { quarter, fiscalYear } = req.query as Record<string, string>;
    const kpi = await computeKPI({ quarter, fiscalYear });
    res.json({ ok: true, ...kpi });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
