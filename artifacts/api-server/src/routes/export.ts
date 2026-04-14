/**
 * export.ts — GET /api/export/:type
 * Admin-only CSV export for deals, revenue, meetings, targets.
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), repId (integer)
 */
import { Router } from "express";
import { db, deals, revenueEntries, meetings, targetSubmissions } from "@workspace/db";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape  = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map(h => escape(row[h])).join(","));
  return lines.join("\r\n");
}

router.get("/export/:type", requireAuth, requireAdmin, async (req, res) => {
  const type   = String(req.params["type"]);
  const { from, to, repId } = req.query as Record<string, string | undefined>;

  const VALID = ["deals", "revenue", "meetings", "targets"] as const;
  if (!(VALID as readonly string[]).includes(type)) {
    res.status(400).json({ ok: false, error: "type must be one of: " + VALID.join(", ") });
    return;
  }

  try {
    let rows: Record<string, unknown>[] = [];
    const repFilter = repId ? parseInt(repId, 10) : null;

    if (type === "deals") {
      const conds = [];
      if (from)       conds.push(gte(sql`${deals.createdAt}::date`, sql`${from}::date`));
      if (to)         conds.push(lte(sql`${deals.createdAt}::date`, sql`${to}::date`));
      if (repFilter)  conds.push(eq(deals.repId, repFilter));
      const data = await db.select().from(deals).where(conds.length ? and(...conds) : undefined);
      rows = data.map(d => ({
        id: d.id, rep_id: d.repId, client: d.clientCompany, agency: d.agencyName,
        stage: d.stage, outcome: d.outcome, amount: d.amount, quarter: d.quarter,
        next_step_date: d.nextStepDate, created_at: d.createdAt, updated_at: d.updatedAt,
      }));
    } else if (type === "revenue") {
      const conds = [];
      if (from)       conds.push(gte(revenueEntries.date, from));
      if (to)         conds.push(lte(revenueEntries.date, to));
      if (repFilter)  conds.push(eq(revenueEntries.repId, repFilter));
      const data = await db.select().from(revenueEntries).where(conds.length ? and(...conds) : undefined);
      rows = data.map(r => ({
        id: r.id, rep_id: r.repId, client: r.clientCompany, agency: r.agencyName,
        amount: r.amount, date: r.date, quarter: r.quarter, brand: r.brand,
        notes: r.notes, created_at: r.createdAt,
      }));
    } else if (type === "meetings") {
      const conds = [];
      if (from)       conds.push(gte(meetings.date, from));
      if (to)         conds.push(lte(meetings.date, to));
      if (repFilter)  conds.push(eq(meetings.repId, repFilter));
      const data = await db.select().from(meetings).where(conds.length ? and(...conds) : undefined);
      rows = data.map(m => ({
        id: m.id, rep_id: m.repId, client: m.clientName, agency: m.agencyName,
        date: m.date, status: m.status, meeting_kind: m.meetingKind,
        actionable_type: m.actionableType, mode: m.mode,
        contact_name: m.contactName, agenda: m.agenda, created_at: m.createdAt,
      }));
    } else {
      const conds = [];
      if (from)       conds.push(gte(sql`${targetSubmissions.createdAt}::date`, sql`${from}::date`));
      if (to)         conds.push(lte(sql`${targetSubmissions.createdAt}::date`, sql`${to}::date`));
      if (repFilter)  conds.push(eq(targetSubmissions.repId, repFilter));
      const data = await db.select().from(targetSubmissions).where(conds.length ? and(...conds) : undefined);
      rows = data.map(t => ({
        id: t.id, rep_id: t.repId, quarter: t.quarter, status: t.status,
        total_target: t.totalTarget, created_at: t.createdAt,
      }));
    }

    const csv      = toCSV(rows as Record<string, unknown>[]);
    const filename = `otv-${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    req.log.error({ err }, "export error");
    res.status(500).json({ ok: false, error: "Export failed" });
  }
});

export default router;
