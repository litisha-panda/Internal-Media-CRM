/**
 * users.ts — PATCH /api/users/:id
 * Admin-only route to update role, manager_id, or status for any user.
 * Every change is written to audit_log.
 */
import { Router } from "express";
import { db, users, auditLog } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

const VALID_ROLES = [
  "SALES REP", "REGION HEAD", "SALES HEAD", "CRO",
  "SALES STRATEGY", "DIGI OPS", "ADMIN",
] as const;

const VALID_STATUSES = ["active", "revoked"] as const;

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
// Allowed fields: role, managerId (→ manager_id), status
// Writes one audit_log row per call.
router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id   = String(req.params["id"]);
  const body = req.body as { role?: string; managerId?: string | null; status?: string };

  const { role, status } = body;
  // Use hasOwnProperty so that { managerId: null } (clearing manager) is treated
  // as a valid field, not as "no fields provided" (null is falsy, so !null === true).
  const hasManagerId = Object.prototype.hasOwnProperty.call(body, "managerId");
  const managerId    = body.managerId;

  if (!role && !hasManagerId && status === undefined) {
    res.status(400).json({ ok: false, error: "Provide at least one of: role, managerId, status" });
    return;
  }
  if (role && !(VALID_ROLES as readonly string[]).includes(role)) {
    res.status(400).json({ ok: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }
  if (status !== undefined && !(VALID_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing.length) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }

    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    const changes: string[] = [];

    if (role) {
      patch.role = role;
      changes.push(`role→${role}`);
    }
    if (hasManagerId) {
      patch.managerId = managerId || null;
      changes.push(`managerId→${managerId || "null"}`);
    }
    if (status !== undefined) {
      patch.status = status;
      changes.push(`status→${status}`);
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    await db.insert(auditLog).values({
      actorId:      req.user!.id,
      action:       "USER_PATCH",
      targetUserId: id,
      details:      changes.join("; "),
    });

    res.json({
      ok: true,
      user: {
        id:        updated.id,
        name:      updated.name,
        email:     updated.email,
        role:      updated.role,
        region:    updated.region,
        managerId: updated.managerId,
        status:    updated.status,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "PATCH /users/:id error");
    res.status(500).json({ ok: false, error: "Update failed" });
  }
});

export default router;
