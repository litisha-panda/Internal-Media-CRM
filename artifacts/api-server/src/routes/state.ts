import { Router } from "express";
import { db, appStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const OTV_EMPTY_STATE: Record<string, unknown> = {
  otv_absence: [], otv_att: {}, otv_deals: [], otv_internalReqs: [],
  otv_ipProposals: [], otv_liveRoles: [], otv_masterClients: [],
  otv_meetings: [], otv_pendingUsers: [], otv_plans: [], otv_properties: [],
  otv_reps: [], otv_revenueEntries: [], otv_savedROs: [],
  otv_targetSubs: [], otv_tasks: [], otv_wplans: [],
};

router.post("/state/reset-all", async (req, res) => {
  try {
    const { confirmText, triggeredBy, role } = req.body as {
      confirmText?: string;
      triggeredBy?: string;
      role?: string;
    };

    // Must be Admin role
    if (role !== "ADMIN") {
      res.status(403).json({ ok: false, error: "Only Admin can reset all data." });
      return;
    }

    // Must type the confirmation string exactly
    if (confirmText !== "RESET") {
      res.status(400).json({ ok: false, error: "Confirmation text must be exactly 'RESET'." });
      return;
    }

    // Log the trigger before wiping
    const resetLog = {
      triggeredBy: triggeredBy || "unknown",
      role,
      at: new Date().toISOString(),
      action: "reset-all",
    };
    await db
      .insert(appStateTable)
      .values({ key: "otv_resetLog", value: resetLog as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appStateTable.key,
        set: { value: resetLog as object, updatedAt: new Date() },
      });

    // Wipe all app state
    for (const [key, value] of Object.entries(OTV_EMPTY_STATE)) {
      await db
        .insert(appStateTable)
        .values({ key, value: value as object, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appStateTable.key,
          set: { value: value as object, updatedAt: new Date() },
        });
    }

    res.json({ ok: true, cleared: Object.keys(OTV_EMPTY_STATE), log: resetLog });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/state/:key", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(appStateTable)
      .where(eq(appStateTable.key, req.params.key))
      .limit(1);

    if (rows.length === 0) {
      res.json({ ok: false, value: null });
    } else {
      res.json({ ok: true, value: rows[0].value, updatedAt: rows[0].updatedAt });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/state/:key", async (req, res) => {
  try {
    const { value } = req.body as { value: unknown };
    if (value === undefined) {
      res.status(400).json({ ok: false, error: "Missing value" });
      return;
    }

    await db
      .insert(appStateTable)
      .values({ key: req.params.key, value: value as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appStateTable.key,
        set: { value: value as object, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
