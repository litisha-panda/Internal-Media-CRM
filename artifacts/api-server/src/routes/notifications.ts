import { Router } from "express";
import { db, notifications } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /api/notifications — list for authenticated user (most recent 50)
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, u.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/notifications/unread-count — badge count
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
    res.json({ ok: true, count: rows.length });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const updated = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, String(req.params["id"])),
          eq(notifications.userId, u.id),
        ),
      )
      .returning();
    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/notifications/mark-all-read — mark all as read
router.patch("/notifications/mark-all-read", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
