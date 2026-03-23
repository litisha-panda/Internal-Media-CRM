import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roParserRouter from "./ro-parser";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roParserRouter);

export default router;
