import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import roParserRouter from "./ro-parser";
import claudeProxyRouter from "./claude-proxy";
import stateRouter from "./state";
// Zoho CRM API integration removed — FIX 0
import targetsRouter from "./targets";
import revenueRouter from "./revenue";
import dealsRouter from "./deals";
import touchpointsRouter from "./touchpoints";
import tasksRouter from "./tasks";
import kpiRouter from "./kpi";
import notificationsRouter from "./notifications";
import activityLogRouter from "./activity-log";
import dailyPlansRouter from "./daily-plans";
import rhTeamFeedRouter from "./rh-team-feed";
import meetingsRouter from "./meetings";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(roParserRouter);
router.use(claudeProxyRouter);
router.use(stateRouter);
// Phase 3 — Target submissions
router.use(targetsRouter);

// Phase 4 — Revenue entries
router.use(revenueRouter);

// Phase 5 — Deals + client accounts
router.use(dealsRouter);

// Phase 6 — Touchpoints
router.use(touchpointsRouter);

// Phase 7 — Tasks + internal requests
router.use(tasksRouter);

// Phase 8 — Centralized KPI calculations
router.use(kpiRouter);

// Phase 8 — In-app notifications
router.use(notificationsRouter);

// Phase 8 — Activity audit log
router.use(activityLogRouter);

// Phase 9 — Daily plans (compliance)
router.use(dailyPlansRouter);

// Phase 9 — RH team feed (plans + touchpoints + compliance summary)
router.use(rhTeamFeedRouter);

// Phase 10 — Meetings (DB-backed scheduling + logging)
router.use(meetingsRouter);

// Phase 11 — Attendance records + exception chain
router.use(attendanceRouter);

export default router;
