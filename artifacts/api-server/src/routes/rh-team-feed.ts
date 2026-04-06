/**
 * RH Team Activity Feed
 *
 * GET /api/rh/team-feed?date=YYYY-MM-DD
 *
 * Returns a unified view of the Region Head's team activity for a given date:
 *   - plans:       tomorrow's daily plans created by team members
 *   - touchpoints: touchpoints logged for the given date by team members
 *   - compliance:  one row per active SALES REP showing their presence/absence
 *
 * Date param defaults to today IST.
 * Accessible to: REGION HEAD, SALES HEAD, CRO, SALES STRATEGY, ADMIN.
 * REGION HEAD is scoped to their own region; elevated roles see all (or filter by ?region=).
 */
import { Router } from "express";
import { db, users, touchpoints, dailyPlans } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { todayIST } from "../lib/date";

const router = Router();

const ALLOWED_ROLES = ["REGION HEAD", "SALES HEAD", "CRO", "SALES STRATEGY", "ADMIN"];

router.get("/rh/team-feed", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    if (!ALLOWED_ROLES.includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Not authorized to view team feed" });
    }

    const date: string = (req.query["date"] as string) ?? todayIST();
    const regionFilter: string | undefined = (req.query["region"] as string | undefined)
      ?? (u.role === "REGION HEAD" ? (u.region ?? undefined) : undefined);

    // ── 1. Fetch active SALES REPs in scope ───────────────────────────────────
    const repQuery = db
      .select({ id: users.id, name: users.name, region: users.region, repId: users.repId })
      .from(users)
      .where(
        regionFilter
          ? and(eq(users.role, "SALES REP"), eq(users.status, "active"), eq(users.region, regionFilter))
          : and(eq(users.role, "SALES REP"), eq(users.status, "active")),
      );

    const reps = await repQuery;

    if (reps.length === 0) {
      return void res.json({
        ok: true, date, region: regionFilter ?? "all",
        plans: [], touchpoints: [], compliance: [],
      });
    }

    const userIds = reps.map((r) => r.id);

    // ── 2. Tomorrow's plans created by team (planDate = tomorrow) ─────────────
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
      .format(new Date(Date.now() + 86_400_000));

    const plans = await db
      .select()
      .from(dailyPlans)
      .where(
        and(
          inArray(dailyPlans.userId, userIds),
          eq(dailyPlans.planDate, tomorrow),
        ),
      );

    // ── 3. Touchpoints logged for `date` by team members ─────────────────────
    const tps = await db
      .select()
      .from(touchpoints)
      .where(
        and(
          inArray(touchpoints.loggedByUserId, userIds),
          eq(touchpoints.date, date),
        ),
      );

    // ── 4. Compliance summary: one row per rep ────────────────────────────────
    const planUserIds   = new Set(plans.map((p) => p.userId));
    const tpUserIds     = new Set(tps.map((t) => t.loggedByUserId).filter(Boolean));

    const compliance = reps.map((rep) => {
      const hasTouchpoint = tpUserIds.has(rep.id);
      const hasPlan       = planUserIds.has(rep.id);
      const status        = hasTouchpoint && hasPlan ? "compliant"
                          : hasTouchpoint || hasPlan  ? "partial"
                          : "non-compliant";
      return {
        userId:         rep.id,
        repId:          rep.repId,
        name:           rep.name,
        region:         rep.region,
        hasTouchpoint,
        hasPlan,
        status,
      };
    });

    res.json({
      ok: true,
      date,
      region:      regionFilter ?? "all",
      plans,
      touchpoints: tps,
      compliance,
      summary: {
        total:         reps.length,
        compliant:     compliance.filter((c) => c.status === "compliant").length,
        partial:       compliance.filter((c) => c.status === "partial").length,
        nonCompliant:  compliance.filter((c) => c.status === "non-compliant").length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
