import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.post(
  "/claude",
  requireAuth,
  requireRole("ADMIN", "CRO", "SALES HEAD", "SALES STRATEGY", "DIGI OPS", "REGION HEAD"),
  async (req, res) => {
    try {
      const { model, max_tokens, system, messages, mcp_servers, ...rest } = req.body;

      const params: any = {
        model: model || "claude-opus-4-5",
        max_tokens: max_tokens || 4096,
        messages: messages || [],
        ...rest,
      };
      if (system) params.system = system;
      if (mcp_servers) params.mcp_servers = mcp_servers;

      const message = await anthropic.messages.create(params);
      res.json(message);
    } catch (err: any) {
      req.log.error({ err }, "Claude proxy error");
      console.error(err);
      res.status(500).json({ ok: false, error: "An internal error occurred" });
    }
  },
);

export default router;
