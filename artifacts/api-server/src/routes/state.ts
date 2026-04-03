import { Router } from "express";
import { db, appStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

// Complete list of operational blobs to wipe on reset-all.
// Any new otv_* key added to the system must be added here too.
const OTV_EMPTY_STATE: Record<string, unknown> = {
  otv_absence:        [],
  otv_att:            {},
  otv_clientAccounts: [],   // Part 1: client account threads
  otv_deals:          [],
  otv_internalReqs:   [],
  otv_ipProposals:    [],
  otv_liveRoles:      [],
  otv_masterClients:  [],
  otv_meetings:       [],
  otv_pendingUsers:   [],
  otv_plans:          [],
  otv_properties:     [],
  otv_reps:           [],
  otv_revenueEntries: [],
  otv_savedROs:       [],
  otv_targetSubs:     [],
  otv_tasks:          [],
  otv_touchpoints:    [],   // Part 1: touchpoints / meeting log
  otv_wplans:         [],
  otv_adminConfig:    {},   // reset to defaults; getAdminConfig() merges with DEFAULT_CONFIG
};

// ─── POST /api/state/reset-all ───────────────────────────────────────────────
// Wipes all operational app_state blobs.
// Gate: session must be authenticated AND have ADMIN role.
// The client must also supply confirmText="RESET" to prevent accidental triggers.
router.post("/state/reset-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { confirmText } = (req.body ?? {}) as { confirmText?: string };

    if (confirmText !== "RESET") {
      res.status(400).json({ ok: false, error: "confirmText must be exactly 'RESET'" });
      return;
    }

    const resetLog = {
      triggeredBy:     req.user!.id,
      triggeredByName: req.user!.name,
      triggeredByEmail: req.user!.email,
      role:            req.user!.role,
      at:              new Date().toISOString(),
      action:          "reset-all",
    };

    // Log the reset before wiping (record survives the wipe)
    await db
      .insert(appStateTable)
      .values({ key: "otv_resetLog", value: resetLog as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appStateTable.key,
        set: { value: resetLog as object, updatedAt: new Date() },
      });

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

// ─── GET /api/state/:key ─────────────────────────────────────────────────────
// Requires authentication — state blobs contain sensitive operational data.
router.get("/state/:key", requireAuth, async (req, res) => {
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

// ─── PUT /api/state/:key ─────────────────────────────────────────────────────
// Requires authentication — any logged-in user may persist their own state blob.
// (reset-all, which clears all blobs, is separately admin-gated above.)
router.put("/state/:key", requireAuth, async (req, res) => {
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
