import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import targetsRouter from "./targets";
import revenueRouter from "./revenue";
import clientAccountsRouter from "./client-accounts";
import dealsRouter from "./deals";
import touchpointsRouter from "./touchpoints";
import tasksRouter from "./tasks";
import internalRequestsRouter from "./internal-requests";
import plansRouter from "./plans";
import roParserRouter from "./ro-parser";
import claudeProxyRouter from "./claude-proxy";
import stateRouter from "./state";
import zohoRouter from "./zoho";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(targetsRouter);
router.use(revenueRouter);
router.use(clientAccountsRouter);
router.use(dealsRouter);
router.use(touchpointsRouter);
router.use(tasksRouter);
router.use(internalRequestsRouter);
router.use(plansRouter);
router.use(roParserRouter);
router.use(claudeProxyRouter);
router.use(stateRouter);
router.use(zohoRouter);

export default router;
