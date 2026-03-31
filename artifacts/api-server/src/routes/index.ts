import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roParserRouter from "./ro-parser";
import claudeProxyRouter from "./claude-proxy";
import stateRouter from "./state";
import zohoRouter from "./zoho";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roParserRouter);
router.use(claudeProxyRouter);
router.use(stateRouter);
router.use(zohoRouter);

export default router;
