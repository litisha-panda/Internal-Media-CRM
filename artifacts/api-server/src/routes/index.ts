import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import roParserRouter from "./ro-parser";
import claudeProxyRouter from "./claude-proxy";
import stateRouter from "./state";
import zohoRouter from "./zoho";
import targetsRouter from "./targets";
import revenueRouter from "./revenue";
import dealsRouter from "./deals";
import touchpointsRouter from "./touchpoints";
import tasksRouter from "./tasks";
import kpiRouter from "./kpi";
import notificationsRouter from "./notifications";
import activityLogRouter from "./activity-log";
import dailyPlansRouter from "./daily-plans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(roParserRouter);
router.use(claudeProxyRouter);
router.use(stateRouter);
router.use(zohoRouter);

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

export default router;
