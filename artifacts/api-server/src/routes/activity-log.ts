/**
 * Activity Log API — read-only, restricted to elevated roles.
 */
import { Router } from "express";
import { db, activityLog } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const ALLOWED = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY", "REGION HEAD"];

// GET /api/activity-log?entityType=deal&entityId=xxx&userId=xxx&limit=100
router.get("/activity-log", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    if (!ALLOWED.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized to view activity log" });
    }

    const { entityType, entityId, userId, limit } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (entityType) conditions.push(eq(activityLog.entityType, entityType));
    if (entityId)   conditions.push(eq(activityLog.entityId,   entityId));
    if (userId)     conditions.push(eq(activityLog.userId,     userId));

    // REGION HEAD scoped to their own region
    if (u.role === "REGION HEAD" && u.region) {
      conditions.push(eq(activityLog.region, u.region));
    }

    const pageLimit = Math.min(parseInt(limit ?? "100", 10) || 100, 500);

    const rows = conditions.length
      ? await db.select().from(activityLog).where(and(...conditions)).orderBy(desc(activityLog.createdAt)).limit(pageLimit)
      : await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(pageLimit);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
