/**
 * Daily Plans API.
 *
 * Reps (and RHs) save their plan for tomorrow here.
 * Governance checks this at 23:30 IST as part of compliance.
 *
 * One record per user per planDate — upsert on conflict.
 */
import { Router } from "express";
import { db, dailyPlans } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { todayIST } from "../lib/date";
import { logActivity } from "../lib/activityLog";

const router = Router();

// GET /api/daily-plans?planDate=YYYY-MM-DD
router.get("/daily-plans", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { planDate } = req.query as Record<string, string>;
    const conditions: any[] = [eq(dailyPlans.userId, u.id)];
    if (planDate) conditions.push(eq(dailyPlans.planDate, planDate));

    const rows = await db
      .select()
      .from(dailyPlans)
      .where(and(...conditions))
      .orderBy(desc(dailyPlans.planDate))
      .limit(30);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/daily-plans/team?planDate=YYYY-MM-DD  (RH+ only — see team plans)
router.get("/daily-plans/team", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const ALLOWED = ["REGION HEAD", "SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN"];
    if (!ALLOWED.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized to view team plans" });
    }

    const { planDate } = req.query as Record<string, string>;
    const date = planDate ?? todayIST();

    const conditions: any[] = [eq(dailyPlans.planDate, date)];
    if (u.role === "REGION HEAD" && u.region) {
      conditions.push(eq(dailyPlans.region, u.region));
    }

    const rows = await db
      .select()
      .from(dailyPlans)
      .where(and(...conditions))
      .orderBy(dailyPlans.userId);

    res.json({ ok: true, data: rows, date });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/daily-plans — upsert plan for a given date
router.post("/daily-plans", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { planDate, items } = req.body;

    if (!planDate) {
      return void res.status(400).json({ ok: false, error: "planDate (YYYY-MM-DD) is required" });
    }
    if (!Array.isArray(items)) {
      return void res.status(400).json({ ok: false, error: "items must be an array" });
    }

    const id = `plan_${u.id}_${planDate}`;
    const itemCount = items.length;

    const row = await db
      .insert(dailyPlans)
      .values({
        id,
        userId:    u.id,
        repId:     u.repId ?? null,
        userRole:  u.role,
        region:    u.region ?? null,
        planDate,
        items,
        itemCount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyPlans.userId, dailyPlans.planDate],
        set:    { items, itemCount, updatedAt: new Date() },
      })
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      region:     u.region,
      action:     "daily_plan.saved",
      entityType: "daily_plan",
      entityId:   id,
      meta:       { planDate, itemCount },
    });

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
