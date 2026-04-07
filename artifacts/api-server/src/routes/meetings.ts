import { Router } from "express";
import { db, meetings, touchpoints, users } from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activityLog";
import { todayIST } from "../lib/date";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function tpId() {
  return `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Scope: SALES REP sees only their own.
 * REGION HEAD sees their region's reps.
 * Elevated roles see all.
 */
async function scopeCondition(user: any) {
  if (user.role === "SALES REP") {
    return eq(meetings.userId, user.id);
  }
  if (user.role === "REGION HEAD" && user.region) {
    const repsInRegion = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "SALES REP"), eq(users.region, user.region)));
    const ids = repsInRegion.map((r) => r.id);
    if (!ids.length) return eq(meetings.userId, "__none__");
    // Build OR — Drizzle doesn't have inArray for text easily here; filter in JS
    return eq(meetings.region, user.region);
  }
  return null; // elevated sees all
}

// ─── GET /api/meetings ────────────────────────────────────────────────────────
// ?date=YYYY-MM-DD           — single-day filter (legacy)
// ?dateFrom=YYYY-MM-DD       — range start (inclusive)
// ?dateTo=YYYY-MM-DD         — range end (inclusive)
// ?userId=...                — elevated only — filter to a specific user

router.get("/meetings", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { date, userId, dateFrom, dateTo, region } = req.query as Record<string, string>;

    const conditions: any[] = [];

    // Scope
    if (u.role === "SALES REP") {
      conditions.push(eq(meetings.userId, u.id));
    } else if (u.role === "REGION HEAD" && u.region) {
      conditions.push(eq(meetings.region, u.region));
    }
    // Elevated: no scope filter

    if (date)     conditions.push(eq(meetings.date, date));
    if (dateFrom) conditions.push(gte(meetings.date, dateFrom));
    if (dateTo)   conditions.push(lte(meetings.date, dateTo));
    if (userId && u.role !== "SALES REP") conditions.push(eq(meetings.userId, userId));
    // Explicit region filter for elevated roles (NSH / CRO / Admin) inspecting a region
    if (region && u.role !== "SALES REP" && u.role !== "REGION HEAD") {
      conditions.push(eq(meetings.region, region));
    }

    // Always order date asc, time asc — consistent for all calendar rendering paths
    const rows = conditions.length
      ? await db.select().from(meetings).where(and(...conditions)).orderBy(meetings.date, meetings.time)
      : await db.select().from(meetings).orderBy(meetings.date, meetings.time);

    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/meetings/today ──────────────────────────────────────────────────

router.get("/meetings/today", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const today = todayIST();
    const conditions: any[] = [eq(meetings.date, today)];
    if (u.role === "SALES REP") conditions.push(eq(meetings.userId, u.id));

    const rows = await db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(meetings.time);

    res.json({ ok: true, data: rows, date: today });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/meetings/tomorrow ──────────────────────────────────────────────

router.get("/meetings/tomorrow", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const conditions: any[] = [eq(meetings.date, tomorrowStr)];
    if (u.role === "SALES REP") conditions.push(eq(meetings.userId, u.id));

    const rows = await db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(meetings.time);

    res.json({ ok: true, data: rows, date: tomorrowStr });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/meetings/:id ───────────────────────────────────────────────────

router.get("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, req.params["id"]!))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/meetings ───────────────────────────────────────────────────────
// Create a scheduled meeting.

router.post("/meetings", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const {
      date,
      time,
      meetingKind,
      agencyName,
      clientName,
      brandName,
      contactName,
      contactPhone,
      mode,
      actionableType,
      agenda,
    } = req.body;

    if (!date || !clientName) {
      return void res.status(400).json({ ok: false, error: "date and clientName are required" });
    }

    const row = {
      id:             uid(),
      userId:         u.id,
      repId:          u.repId ?? null,
      region:         u.region ?? null,
      date:           String(date),
      time:           time ? String(time) : null,
      meetingKind:    meetingKind === "PR" ? "PR" : "ACTIONABLE",
      agencyName:     agencyName ? String(agencyName) : null,
      clientName:     String(clientName),
      brandName:      brandName ? String(brandName) : null,
      contactName:    contactName ? String(contactName) : null,
      contactPhone:   contactPhone ? String(contactPhone) : null,
      mode:           mode ? String(mode) : null,
      actionableType: actionableType ? String(actionableType) : null,
      agenda:         agenda ? String(agenda) : null,
      status:         "planned",
      touchpointId:   null,
    };

    await db.insert(meetings).values(row);

    await logActivity(u.id, "create", "meeting", row.id, {
      clientName: row.clientName,
      date: row.date,
      meetingKind: row.meetingKind,
    });

    res.json({ ok: true, data: row });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── PATCH /api/meetings/:id ──────────────────────────────────────────────────
// Update fields or status (edit, cancel, mark missed).

router.patch("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const meetingId = req.params["id"]!;

    const existing = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!existing.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const mtg = existing[0]!;

    // Ownership: rep can only edit own meetings
    if (u.role === "SALES REP" && mtg.userId !== u.id) {
      return void res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const {
      date, time, meetingKind, agencyName, clientName, brandName,
      contactName, contactPhone, mode, actionableType, agenda, status, touchpointId,
    } = req.body;

    const updates: Partial<typeof mtg> = { updatedAt: new Date() };
    if (date !== undefined)           updates.date = String(date);
    if (time !== undefined)           updates.time = String(time);
    if (meetingKind !== undefined)    updates.meetingKind = meetingKind === "PR" ? "PR" : "ACTIONABLE";
    if (agencyName !== undefined)     updates.agencyName = agencyName;
    if (clientName !== undefined)     updates.clientName = String(clientName);
    if (brandName !== undefined)      updates.brandName = brandName;
    if (contactName !== undefined)    updates.contactName = contactName;
    if (contactPhone !== undefined)   updates.contactPhone = contactPhone;
    if (mode !== undefined)           updates.mode = mode;
    if (actionableType !== undefined) updates.actionableType = actionableType;
    if (agenda !== undefined)         updates.agenda = agenda;
    if (status !== undefined) {
      const VALID_STATUSES = ["planned", "logged", "missed", "cancelled"];
      const s = String(status);
      if (!VALID_STATUSES.includes(s)) {
        return void res.status(400).json({
          ok: false,
          error: `Invalid status "${s}". Must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      updates.status = s;
    }
    if (touchpointId !== undefined)   updates.touchpointId = touchpointId ? String(touchpointId) : null;

    await db.update(meetings).set(updates).where(eq(meetings.id, meetingId));

    await logActivity(u.id, "update", "meeting", meetingId, updates);

    res.json({ ok: true, data: { ...mtg, ...updates } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/meetings/:id/log ───────────────────────────────────────────────
// Log a touchpoint from a scheduled meeting.
// Auto-fills meeting fields; only requires what the rep adds in the log form.

router.post("/meetings/:id/log", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const meetingId = req.params["id"]!;

    const existing = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!existing.length) return void res.status(404).json({ ok: false, error: "Meeting not found" });
    const mtg = existing[0]!;

    if (u.role === "SALES REP" && mtg.userId !== u.id) {
      return void res.status(403).json({ ok: false, error: "Not authorized" });
    }

    if (mtg.status === "logged") {
      return void res.status(409).json({ ok: false, error: "Meeting already logged" });
    }

    const {
      discussion,
      clientFeedback,
      stageUpdate,
      actionItems,
      followUpDate,
      nextMeetingDate,
      dealId,
      contactLevel,
    } = req.body;

    const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const tpRow = {
      id:                 tpId(),
      meetingId:          meetingId,
      clientAccountId:    null as string | null,
      dealId:             dealId ? String(dealId) : null,
      repId:              mtg.repId ?? u.repId ?? 0,
      region:             mtg.region ?? u.region ?? null,
      date:               mtg.date,
      time:               mtg.time ?? null,
      meetingType:        mtg.mode ?? null,
      touchpointType:     mtg.meetingKind === "PR" ? "Relationship" : "Deal Meeting",
      contactName:        mtg.contactName ?? null,
      contactDesignation: null as string | null,
      contactLevel:       contactLevel ? String(contactLevel) : null,
      whatHappened:       discussion ? String(discussion) : null,
      clientFeedback:     clientFeedback ? String(clientFeedback) : null,
      stageUpdate:        stageUpdate ? String(stageUpdate) : null,
      actionItems:        Array.isArray(actionItems) ? actionItems : [],
      loggedAt:           nowIST,
      loggedLate:         false,
      loggedByUserId:     u.id,
    };

    await db.insert(touchpoints).values(tpRow);

    // Update the meeting: status → logged, touchpointId set
    await db
      .update(meetings)
      .set({ status: "logged", touchpointId: tpRow.id, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId));

    await logActivity(u.id, "log", "meeting", meetingId, {
      touchpointId: tpRow.id,
      clientName: mtg.clientName,
    });

    res.json({ ok: true, data: { touchpoint: tpRow, meeting: { ...mtg, status: "logged", touchpointId: tpRow.id } } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/meetings/impromptu-log ─────────────────────────────────────────
// Log an unplanned (impromptu) meeting — creates the meeting row + touchpoint in one shot.

router.post("/meetings/impromptu-log", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const {
      date, time, meetingKind,
      agencyName, clientName, brandName,
      contactName, contactPhone,
      mode, actionableType, agenda,
      discussion, clientFeedback, stageUpdate, actionItems,
      followUpDate, dealId, contactLevel,
    } = req.body;

    if (!clientName) {
      return void res.status(400).json({ ok: false, error: "clientName is required" });
    }

    const today = todayIST();
    const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const meetingRow = {
      id:             uid(),
      userId:         u.id,
      repId:          u.repId ?? null,
      region:         u.region ?? null,
      date:           date ? String(date) : today,
      time:           time ? String(time) : null,
      meetingKind:    meetingKind === "PR" ? "PR" : "ACTIONABLE",
      agencyName:     agencyName ? String(agencyName) : null,
      clientName:     String(clientName),
      brandName:      brandName ? String(brandName) : null,
      contactName:    contactName ? String(contactName) : null,
      contactPhone:   contactPhone ? String(contactPhone) : null,
      mode:           mode ? String(mode) : null,
      actionableType: actionableType ? String(actionableType) : null,
      agenda:         agenda ? String(agenda) : null,
      status:         "logged",
      touchpointId:   null as string | null,
    };

    const tpRow = {
      id:                 tpId(),
      meetingId:          meetingRow.id,
      clientAccountId:    null as string | null,
      dealId:             dealId ? String(dealId) : null,
      repId:              u.repId ?? 0,
      region:             u.region ?? null,
      date:               meetingRow.date,
      time:               meetingRow.time,
      meetingType:        meetingRow.mode,
      touchpointType:     meetingRow.meetingKind === "PR" ? "Relationship" : "Deal Meeting",
      contactName:        meetingRow.contactName,
      contactDesignation: null as string | null,
      contactLevel:       contactLevel ? String(contactLevel) : null,
      whatHappened:       discussion ? String(discussion) : null,
      clientFeedback:     clientFeedback ? String(clientFeedback) : null,
      stageUpdate:        stageUpdate ? String(stageUpdate) : null,
      actionItems:        Array.isArray(actionItems) ? actionItems : [],
      loggedAt:           nowIST,
      loggedLate:         false,
      loggedByUserId:     u.id,
    };

    meetingRow.touchpointId = tpRow.id;

    await db.insert(meetings).values(meetingRow);
    await db.insert(touchpoints).values(tpRow);

    await logActivity(u.id, "log", "meeting", meetingRow.id, {
      impromptu: true,
      clientName: meetingRow.clientName,
    });

    res.json({ ok: true, data: { meeting: meetingRow, touchpoint: tpRow } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
