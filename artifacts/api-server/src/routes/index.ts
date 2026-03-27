import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roParserRouter from "./ro-parser";
import claudeProxyRouter from "./claude-proxy";
import stateRouter from "./state";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roParserRouter);
router.use(claudeProxyRouter);
router.use(stateRouter);

export default router;
