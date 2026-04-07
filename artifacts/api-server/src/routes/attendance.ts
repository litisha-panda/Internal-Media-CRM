import { Router } from "express";
import { db, attendanceRecords, attendanceExceptions, users } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activityLog";
import { runAttendanceCheck } from "../governance";

const router = Router();

// ─── GET /api/attendance-records ──────────────────────────────────────────────
// ?dateFrom=YYYY-MM-DD  (optional)
// ?dateTo=YYYY-MM-DD    (optional)
// Scope: SALES REP = own records, REGION HEAD = own region, elevated = all

router.get("/attendance-records", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { dateFrom, dateTo } = req.query as Record<string, string>;
    const conditions: any[] = [];

    if (u.role === "SALES REP") {
      conditions.push(eq(attendanceRecords.userId, u.id));
    } else if (u.role === "REGION HEAD" && u.region) {
      conditions.push(eq(attendanceRecords.region, u.region));
    }

    if (dateFrom) conditions.push(gte(attendanceRecords.date, dateFrom));
    if (dateTo)   conditions.push(lte(attendanceRecords.date, dateTo));

    const rows = conditions.length
      ? await db
          .select()
          .from(attendanceRecords)
          .where(and(...conditions))
          .orderBy(desc(attendanceRecords.date))
      : await db
          .select()
          .from(attendanceRecords)
          .orderBy(desc(attendanceRecords.date))
          .limit(500);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/attendance/simulate-eod ────────────────────────────────────────
// Admin / RH: runs the attendance compliance check for today and writes to DB.
// The governance engine normally does this at 23:30 IST; this endpoint enables
// demo use any time.

router.post("/attendance/simulate-eod", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    if (!["ADMIN", "CRO", "SALES HEAD", "REGION HEAD"].includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Only admin/management can trigger EOD check" });
    }

    await runAttendanceCheck();

    void logActivity({
      userId: u.id, userName: u.name, userRole: u.role,
      action: "attendance.simulate_eod",
      meta: { triggeredBy: u.name },
    });

    res.json({ ok: true, message: "EOD attendance check completed and written to DB" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/attendance-exceptions ───────────────────────────────────────────
// Scope: SALES REP = own, REGION HEAD = region, elevated = all

router.get("/attendance-exceptions", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const conditions: any[] = [];

    if (u.role === "SALES REP") {
      conditions.push(eq(attendanceExceptions.userId, u.id));
    } else if (u.role === "REGION HEAD" && u.region) {
      conditions.push(eq(attendanceExceptions.region, u.region));
    }

    const rows = conditions.length
      ? await db
          .select()
          .from(attendanceExceptions)
          .where(and(...conditions))
          .orderBy(desc(attendanceExceptions.createdAt))
      : await db
          .select()
          .from(attendanceExceptions)
          .orderBy(desc(attendanceExceptions.createdAt))
          .limit(500);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/attendance-exceptions ──────────────────────────────────────────
// Rep submits an exception request for an absent/partial day.
// Starts the chain at stage "RH".

router.post("/attendance-exceptions", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { date, reason, notes, attendanceRecordId } = req.body;

    if (!date || !reason) {
      return void res.status(400).json({ ok: false, error: "date and reason are required" });
    }

    const existing = await db
      .select({ id: attendanceExceptions.id })
      .from(attendanceExceptions)
      .where(and(eq(attendanceExceptions.userId, u.id), eq(attendanceExceptions.date, String(date))))
      .limit(1);

    if (existing.length) {
      return void res.status(409).json({
        ok: false,
        error: "An exception request already exists for this date",
      });
    }

    const id = `aex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row = {
      id,
      attendanceRecordId: attendanceRecordId ? String(attendanceRecordId) : null,
      userId:      u.id,
      userName:    u.name,
      region:      u.region ?? null,
      date:        String(date),
      reason:      String(reason),
      notes:       notes ? String(notes) : null,
      currentStage: "RH",
      stageHistory: [] as any[],
      status:      "pending",
      grantedBy:   null as string | null,
      grantedAt:   null as string | null,
    };

    await db.insert(attendanceExceptions).values(row);

    void logActivity({
      userId: u.id, userName: u.name, userRole: u.role,
      action: "attendance_exception.raised",
      entityType: "attendance_exception", entityId: id,
      meta: { date, reason },
    });

    res.status(201).json({ ok: true, data: row });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── PATCH /api/attendance-exceptions/:id/action ──────────────────────────────
// Approve or reject an exception at each stage.
// Chain: RH → NSH → CRO → Admin
// Admin can always approve/reject, skipping chain stages.

const CHAIN = ["RH", "NSH", "CRO", "Admin"] as const;
const STAGE_ROLE: Record<string, string> = {
  RH:    "REGION HEAD",
  NSH:   "SALES HEAD",
  CRO:   "CRO",
  Admin: "ADMIN",
};

router.patch("/attendance-exceptions/:id/action", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { action, note } = req.body as { action: "approve" | "reject"; note?: string };

    if (!["approve", "reject"].includes(action)) {
      return void res.status(400).json({ ok: false, error: "action must be 'approve' or 'reject'" });
    }

    const rows = await db
      .select()
      .from(attendanceExceptions)
      .where(eq(attendanceExceptions.id, req.params["id"]!))
      .limit(1);

    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    const exc = rows[0]!;

    if (exc.status !== "pending") {
      return void res.status(400).json({ ok: false, error: `Exception is already ${exc.status}` });
    }

    const currentStage = exc.currentStage!;
    const expectedRole = STAGE_ROLE[currentStage];

    if (u.role !== "ADMIN" && u.role !== expectedRole) {
      return void res.status(403).json({
        ok: false,
        error: `Only ${expectedRole} (or Admin) can act at stage ${currentStage}`,
      });
    }

    const historyEntry = {
      stage:    currentStage,
      action,
      by:       u.name,
      byUserId: u.id,
      at:       new Date().toISOString(),
      note:     note || null,
    };

    const history = [...(exc.stageHistory ?? []), historyEntry];
    let updates: Record<string, any> = { updatedAt: new Date(), stageHistory: history };

    if (action === "reject") {
      updates.status      = "rejected";
      updates.currentStage = "Rejected";
      updates.grantedBy   = u.name;
      updates.grantedAt   = new Date().toISOString();
    } else {
      const currentIdx = CHAIN.indexOf(currentStage as (typeof CHAIN)[number]);
      const isLast = u.role === "ADMIN" || currentIdx === CHAIN.length - 1;

      if (isLast) {
        updates.status       = "granted";
        updates.currentStage = "Granted";
        updates.grantedBy    = u.name;
        updates.grantedAt    = new Date().toISOString();

        if (exc.attendanceRecordId) {
          await db
            .update(attendanceRecords)
            .set({
              status: "present",
              note:   `Exception granted by ${u.name} (${exc.reason})`,
            })
            .where(eq(attendanceRecords.id, exc.attendanceRecordId));
        }
      } else {
        updates.currentStage = CHAIN[currentIdx + 1];
      }
    }

    await db.update(attendanceExceptions).set(updates).where(eq(attendanceExceptions.id, exc.id));

    void logActivity({
      userId: u.id, userName: u.name, userRole: u.role,
      action: `attendance_exception.${action}`,
      entityType: "attendance_exception", entityId: exc.id,
      meta: { stage: currentStage, date: exc.date },
    });

    res.json({ ok: true, data: { ...exc, ...updates } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/attendance-records/:id/grant-exception ─────────────────────────
// Admin/CXO: direct override — grant exception without chain, marks record present.

router.post("/attendance-records/:id/grant-exception", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    if (!["ADMIN", "CXO", "CEO", "CRO"].includes(u.role)) {
      return void res.status(403).json({ ok: false, error: "Only Admin or CXO can grant exceptions directly" });
    }

    const { reason } = req.body;
    if (!reason?.trim()) {
      return void res.status(400).json({ ok: false, error: "reason is required" });
    }

    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, req.params["id"]!))
      .limit(1);

    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    const rec = rows[0]!;

    const updated = await db
      .update(attendanceRecords)
      .set({ status: "present", note: `Exception granted by ${u.name}: ${String(reason).trim()}` })
      .where(eq(attendanceRecords.id, rec.id))
      .returning();

    const excId = `aex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(attendanceExceptions).values({
      id:                  excId,
      attendanceRecordId:  rec.id,
      userId:              rec.userId,
      userName:            rec.userName,
      region:              rec.region,
      date:                rec.date,
      reason:              String(reason).trim(),
      notes:               "Directly granted by Admin/CXO",
      currentStage:        "Granted",
      stageHistory:        [{
        stage: "Admin", action: "approve",
        by: u.name, byUserId: u.id,
        at: new Date().toISOString(), note: String(reason).trim(),
      }],
      status:    "granted",
      grantedBy: u.name,
      grantedAt: new Date().toISOString(),
    });

    void logActivity({
      userId: u.id, userName: u.name, userRole: u.role,
      action: "attendance_exception.direct_grant",
      entityType: "attendance_record", entityId: rec.id,
      meta: { date: rec.date, reason },
    });

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
