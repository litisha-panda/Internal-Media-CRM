import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, users, sessions, appStateTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";
import { getAdminConfig, setAdminConfig } from "../lib/adminConfig";

const router = Router();

const BCRYPT_ROUNDS = 10;

const VALID_ROLES = [
  "SALES REP","REGION HEAD","SALES HEAD","CRO",
  "SALES STRATEGY","DIGI OPS","ADMIN",
] as const;

const VALID_REGIONS = ["North","South","East","West","National","Central"] as const;

// Roles that require a region to be specified
const REGION_REQUIRED_ROLES = new Set(["SALES REP","REGION HEAD"]);

// Derive canView from role — frontend compatibility helper (not stored in DB)
function canViewFor(role: string): "self" | "region" | "all" {
  if (role === "SALES REP")   return "self";
  if (role === "REGION HEAD") return "region";
  return "all";
}

// Safe user projection — never expose passwordHash or needsPwReset to API callers
function safeUser(u: typeof users.$inferSelect) {
  return {
    id:          u.id,
    name:        u.name,
    email:       u.email,
    role:        u.role,
    region:      u.region,
    repId:       u.repId,
    status:      u.status,
    canView:     canViewFor(u.role),
    requestedAt: u.requestedAt,
    approvedAt:  u.approvedAt,
    approvedBy:  u.approvedBy,
    createdAt:   u.createdAt,
    updatedAt:   u.updatedAt,
  };
}

// Kill all active sessions for a user immediately
async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ─── GET /api/admin/users ────────────────────────────────────────────────────
// Returns all users (pending, active, revoked), sorted: pending first, then active.
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.status, users.name);

    // Sort: pending first, then active, then revoked
    const order: Record<string, number> = { pending: 0, active: 1, revoked: 2 };
    const sorted = allUsers.sort(
      (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name),
    );

    res.json({ ok: true, users: sorted.map(safeUser) });
  } catch (err) {
    req.log.error({ err }, "admin/users GET error");
    res.status(500).json({ ok: false, error: "Failed to fetch users" });
  }
});

// ─── POST /api/admin/users/:id/approve ──────────────────────────────────────
// Activates a pending user and assigns their role + region.
router.post("/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const { role, region } = req.body as { role?: string; region?: string };

  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    res.status(400).json({ ok: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  if (REGION_REQUIRED_ROLES.has(role) && (!region || !(VALID_REGIONS as readonly string[]).includes(region))) {
    res.status(400).json({ ok: false, error: `Region is required for role '${role}'. Must be one of: ${VALID_REGIONS.join(", ")}` });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    if (existing[0].status === "active") {
      res.status(409).json({ ok: false, error: "User is already active" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({
        status:     "active",
        role,
        region:     REGION_REQUIRED_ROLES.has(role) ? (region ?? null) : null,
        approvedAt: new Date(),
        approvedBy: req.user!.id,
        updatedAt:  new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    res.json({ ok: true, user: safeUser(updated) });
  } catch (err) {
    req.log.error({ err }, "admin/users approve error");
    res.status(500).json({ ok: false, error: "Approval failed" });
  }
});

// ─── POST /api/admin/users/:id/reject ───────────────────────────────────────
// Rejects a pending signup request. Sets status=revoked, kills any sessions.
router.post("/admin/users/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);

  if (id === req.user!.id) {
    res.status(400).json({ ok: false, error: "Cannot reject your own account" });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    await invalidateUserSessions(id);

    const [updated] = await db
      .update(users)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    res.json({ ok: true, user: safeUser(updated) });
  } catch (err) {
    req.log.error({ err }, "admin/users reject error");
    res.status(500).json({ ok: false, error: "Reject failed" });
  }
});

// ─── PATCH /api/admin/users/:id/role ────────────────────────────────────────
// Changes role and/or region for an active user.
// Takes effect immediately on next request — no session kill needed
// because requireAuth re-joins live user data from DB on every request.
router.patch("/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const { role, region } = req.body as { role?: string; region?: string };

  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    res.status(400).json({ ok: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  if (REGION_REQUIRED_ROLES.has(role) && (!region || !(VALID_REGIONS as readonly string[]).includes(region))) {
    res.status(400).json({ ok: false, error: `Region is required for role '${role}'` });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({
        role,
        region:    REGION_REQUIRED_ROLES.has(role) ? (region ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Note: sessions are NOT killed. requireAuth re-reads role from DB on every
    // request, so the new role takes effect immediately without re-login.

    res.json({ ok: true, user: safeUser(updated) });
  } catch (err) {
    req.log.error({ err }, "admin/users role PATCH error");
    res.status(500).json({ ok: false, error: "Role update failed" });
  }
});

// ─── DELETE /api/admin/users/:id ────────────────────────────────────────────
// Revokes access. Soft-delete only — sets status=revoked for audit trail.
// Kills all sessions immediately.
router.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);

  if (id === req.user!.id) {
    res.status(400).json({ ok: false, error: "Cannot revoke your own account" });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    // Prevent revoking the last active ADMIN
    if (existing[0].role === "ADMIN") {
      const activeAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.status, "active")));

      if (activeAdmins.length <= 1) {
        res.status(400).json({ ok: false, error: "Cannot revoke the last active ADMIN account" });
        return;
      }
    }

    // Kill sessions first — takes effect immediately
    await invalidateUserSessions(id);

    const [updated] = await db
      .update(users)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    res.json({ ok: true, user: safeUser(updated) });
  } catch (err) {
    req.log.error({ err }, "admin/users DELETE error");
    res.status(500).json({ ok: false, error: "Revoke failed" });
  }
});

// ─── POST /api/admin/users/:id/reset-password ───────────────────────────────
// Admin sets a temporary password for any user.
// Sets needsPwReset=true so the SHA-256 bridge accepts old hash on first login,
// then upgrades to bcrypt automatically.
// Kills all sessions so the user must log in with the new password.
router.post("/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const { temporaryPassword } = req.body as { temporaryPassword?: string };

  if (!temporaryPassword || temporaryPassword.trim().length < 6) {
    res.status(400).json({ ok: false, error: "temporaryPassword must be at least 6 characters" });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    const passwordHash = await bcrypt.hash(temporaryPassword.trim(), BCRYPT_ROUNDS);

    // Kill sessions first — user must re-login with new password
    await invalidateUserSessions(id);

    await db
      .update(users)
      .set({
        passwordHash,
        needsPwReset: true,   // prompts user to set their own password on next login
        updatedAt:    new Date(),
      })
      .where(eq(users.id, id));

    res.json({ ok: true, message: "Password reset. User must log in with the temporary password." });
  } catch (err) {
    req.log.error({ err }, "admin/users reset-password error");
    res.status(500).json({ ok: false, error: "Password reset failed" });
  }
});

// ─── GET /api/admin/config ───────────────────────────────────────────────────
router.get("/admin/config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const config = await getAdminConfig();
    res.json({ ok: true, config });
  } catch (err) {
    req.log.error({ err }, "admin/config GET error");
    res.status(500).json({ ok: false, error: "Failed to read config" });
  }
});

// ─── PUT /api/admin/config ───────────────────────────────────────────────────
router.put("/admin/config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const incoming = req.body as Record<string, unknown>;

    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      res.status(400).json({ ok: false, error: "Body must be a config object" });
      return;
    }

    const config = await setAdminConfig(incoming as any);
    res.json({ ok: true, config });
  } catch (err) {
    req.log.error({ err }, "admin/config PUT error");
    res.status(500).json({ ok: false, error: "Failed to save config" });
  }
});

// ─── POST /api/admin/reset/dev ───────────────────────────────────────────────
// Full dev reset: wipes all operational app_state blobs + all sessions.
// Users are preserved. Reset is logged before wiping.
router.post("/admin/reset/dev", requireAuth, requireAdmin, async (req, res) => {
  const { confirmText } = req.body as { confirmText?: string };

  if (confirmText !== "RESET") {
    res.status(400).json({ ok: false, error: "confirmText must be exactly 'RESET'" });
    return;
  }

  // All operational keys — complete list including previously missing ones
  const OTV_EMPTY_STATE: Record<string, unknown> = {
    otv_absence:        [],
    otv_att:            {},
    otv_clientAccounts: [],
    otv_clientMaster:   [],
    otv_deals:          [],
    otv_internalReqs:   [],
    otv_ipProposals:    [],
    otv_liveRoles:      [],   // old blob — cleared to avoid stale data
    otv_masterClients:  [],
    otv_meetings:       [],   // legacy
    otv_pendingUsers:   [],   // old blob — cleared to avoid stale data
    otv_plans:          [],
    otv_properties:     [],
    otv_reps:           [],
    otv_revenueEntries: [],
    otv_savedROs:       [],
    otv_targetSubs:     [],
    otv_tasks:          [],
    otv_touchpoints:    [],
    otv_wplans:         [],
    otv_adminConfig:    {},   // resets to defaults (getAdminConfig() merges with DEFAULT_CONFIG)
  };

  try {
    const resetEntry = {
      triggeredBy: req.user!.id,
      triggeredByName: req.user!.name,
      resetType: "dev",
      at: new Date().toISOString(),
    };

    // Log the reset first (survives the wipe)
    await db
      .insert(appStateTable)
      .values({ key: "otv_resetLog", value: resetEntry as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appStateTable.key,
        set: { value: resetEntry as object, updatedAt: new Date() },
      });

    // Wipe all operational blobs
    for (const [key, value] of Object.entries(OTV_EMPTY_STATE)) {
      await db
        .insert(appStateTable)
        .values({ key, value: value as object, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appStateTable.key,
          set: { value: value as object, updatedAt: new Date() },
        });
    }

    // Kill all sessions — forces everyone to re-login
    await db.delete(sessions);

    res.json({
      ok:      true,
      cleared: Object.keys(OTV_EMPTY_STATE),
      note:    "All sessions invalidated. Users must log in again.",
      log:     resetEntry,
    });
  } catch (err) {
    req.log.error({ err }, "admin/reset/dev error");
    res.status(500).json({ ok: false, error: "Reset failed" });
  }
});

export default router;
