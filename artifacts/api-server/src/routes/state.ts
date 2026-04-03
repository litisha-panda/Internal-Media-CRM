import { Router } from "express";
import { db, appStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

// All keys that the frontend creates via usePersistedState().
// Must stay in sync with every usePersistedState() call in OTVApp.tsx.
// Missing keys here means they are NOT cleared on admin reset, leaving
// stale data that confuses the next team using the system.
const OTV_EMPTY_STATE: Record<string, unknown> = {
  otv_absence:        [],
  otv_adminConfig:    {},   // reset to defaults (getAdminConfig() merges with DEFAULT_CONFIG)
  otv_att:            {},
  otv_clientAccounts: [],   // was missing — client account thread data
  otv_deals:          [],
  otv_internalReqs:   [],
  otv_ipProposals:    [],
  otv_liveRoles:      [],   // legacy blob — cleared to prevent stale role data
  otv_masterClients:  [],
  otv_meetings:       [],
  otv_pendingUsers:   [],   // legacy blob — cleared to prevent stale pending list
  otv_plans:          [],
  otv_properties:     [],
  otv_reps:           [],
  otv_revenueEntries: [],
  otv_savedROs:       [],
  otv_targetSubs:     [],
  otv_tasks:          [],
  otv_touchpoints:    [],   // was missing — touchpoint thread data
  otv_wplans:         [],
};

router.post("/state/reset-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { confirmText } = req.body as {
      confirmText?: string;
    };

    // Role is read from the authenticated session — never from client body
    if (req.user!.role !== "ADMIN") {
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
      triggeredBy: req.user!.id,
      triggeredByName: req.user!.name,
      role: req.user!.role,
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

// Both GET and PUT are auth-gated. Without requireAuth, any unauthenticated
// caller can read all CRM data (GET) or overwrite deals/tasks/meetings (PUT)
// by directly hitting /api/state/:key with crafted JSON.
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

router.put("/state/:key", requireAuth, async (req, res) => {
  try {
    const { value } = req.body as { value: unknown };
    if (value === undefined) {
      res.status(400).json({ ok: false, error: "Missing value" });
      return;
    }

    // Reject non-object/non-array values to prevent storing primitives
    // (null, strings, numbers) as CRM state blobs.
    if (typeof value !== "object") {
      res.status(400).json({ ok: false, error: "value must be an object or array" });
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
