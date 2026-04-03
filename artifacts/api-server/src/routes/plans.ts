import { Router }     from "express";
import { db }          from "@workspace/db";
import { plans }       from "@workspace/db";
import { eq, and }     from "drizzle-orm";
import { randomUUID }  from "crypto";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const GLOBAL_ROLES   = new Set(["NSH", "ADMIN", "CRO", "SALES HEAD", "SALES STRATEGY"]);
const TERMINAL       = new Set(["Done"]);
const VALID_STATUSES = new Set(["Planned", "Done", "Cancelled", "Confirmed", "Declined"]);

// ─── GET /api/plans ───────────────────────────────────────────────────────────
// Returns plans scoped by role:
//   SALES REP   — own plans (by rep_user_id = me OR rep_id = user.repId)
//   REGION HEAD — all plans in their region
//   Global roles — all plans
router.get("/plans", requireAuth, async (req, res) => {
  const user = req.user!;
  try {
    let rows = await db.select().from(plans);

    if (user.role === "SALES REP") {
      rows = rows.filter(p =>
        p.repUserId === user.id ||
        (user.repId != null && p.repId === user.repId),
      );
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(p => p.region === user.region);
    }
    // global roles see all

    // Sort by date desc, then time
    rows.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time ?? "").localeCompare(b.time ?? "");
    });

    res.json({ ok: true, plans: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /plans error");
    res.status(500).json({ ok: false, error: "Failed to list plans" });
  }
});

// ─── POST /api/plans ──────────────────────────────────────────────────────────
// Create a new plan entry. The calling user is the rep unless repId is supplied
// and the caller has elevated role.
router.post("/plans", requireAuth, async (req, res) => {
  const user = req.user!;
  const body = req.body ?? {};

  const {
    date,
    time,
    clientAgencyName,
    contactName,
    phone,
    agenda,
    pitchType,
    meetingType,
    status,
    isUnplanned,
    needsMeet,
    autoCreatedFrom,
    assignedByName,
    assignedDept,
    dealId,
    touchpointId,
    requestedBy,
    requestedByName,
    loggedMeetingId,
    // allow caller to override repId / repUserId / region for cross-rep assigns
    repId:       bodyRepId,
    repUserId:   bodyRepUserId,
    repName:     bodyRepName,
    region:      bodyRegion,
  } = body;

  if (!date) {
    res.status(400).json({ ok: false, error: "date is required" });
    return;
  }

  // Determine the rep owner of this plan
  const repUserId        = bodyRepUserId ?? user.id;
  const repId: number | null =
    bodyRepId != null ? Number(bodyRepId) : (user.repId ?? null);
  const repName: string  = bodyRepName ?? user.name ?? "";
  const region: string   = bodyRegion  ?? user.region ?? "";

  const id = randomUUID();

  try {
    const [created] = await db.insert(plans).values({
      id,
      repUserId,
      repId,
      repName,
      region,
      date:             String(date),
      time:             time ?? null,
      clientAgencyName: clientAgencyName ?? null,
      contactName:      contactName      ?? null,
      phone:            phone            ?? null,
      agenda:           agenda           ?? null,
      pitchType:        pitchType        ?? null,
      meetingType:      meetingType      ?? "Physical",
      status:           VALID_STATUSES.has(status) ? status : "Planned",
      loggedMeetingId:  loggedMeetingId  ?? null,
      isUnplanned:      isUnplanned      ?? false,
      needsMeet:        needsMeet        ?? false,
      autoCreatedFrom:  autoCreatedFrom  ?? null,
      assignedByName:   assignedByName   ?? null,
      assignedDept:     assignedDept     ?? null,
      dealId:           dealId           ?? null,
      touchpointId:     touchpointId     ?? null,
      requestedBy:      requestedBy      != null ? Number(requestedBy) : null,
      requestedByName:  requestedByName  ?? null,
    }).returning();

    res.status(201).json({ ok: true, plan: created });
  } catch (err) {
    req.log.error({ err }, "POST /plans error");
    res.status(500).json({ ok: false, error: "Failed to create plan" });
  }
});

// ─── PATCH /api/plans/:id ─────────────────────────────────────────────────────
// Partial update — accepts any subset of mutable fields (status, date, time,
// clientAgencyName, contactName, phone, agenda, pitchType, loggedMeetingId).
// SALES REP may only update their own plans.
router.patch("/plans/:id", requireAuth, async (req, res) => {
  const user   = req.user!;
  const planId = req.params.id;
  const body   = req.body ?? {};

  try {
    const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
    if (!plan) {
      res.status(404).json({ ok: false, error: "Plan not found" });
      return;
    }

    // Access check
    if (user.role === "SALES REP") {
      const isOwn =
        plan.repUserId === user.id ||
        (user.repId != null && plan.repId === user.repId);
      if (!isOwn) {
        res.status(403).json({ ok: false, error: "Access denied" });
        return;
      }
    } else if (user.role === "REGION HEAD") {
      if (plan.region !== user.region) {
        res.status(403).json({ ok: false, error: "Access denied" });
        return;
      }
    }

    // Terminal check
    if (TERMINAL.has(plan.status) && body.status && body.status !== plan.status) {
      res.status(409).json({
        ok:    false,
        error: `Plan is '${plan.status}' — terminal status cannot be changed`,
      });
      return;
    }

    // Build update payload — only include keys that were sent
    const patch: Partial<typeof plans.$inferInsert> = { updatedAt: new Date() };

    if (body.status !== undefined && VALID_STATUSES.has(body.status)) {
      patch.status = body.status;
    }
    if (body.date             !== undefined) patch.date             = body.date;
    if (body.time             !== undefined) patch.time             = body.time;
    if (body.clientAgencyName !== undefined) patch.clientAgencyName = body.clientAgencyName;
    if (body.contactName      !== undefined) patch.contactName      = body.contactName;
    if (body.phone            !== undefined) patch.phone            = body.phone;
    if (body.agenda           !== undefined) patch.agenda           = body.agenda;
    if (body.pitchType        !== undefined) patch.pitchType        = body.pitchType;
    if (body.meetingType      !== undefined) patch.meetingType      = body.meetingType;
    if (body.loggedMeetingId  !== undefined) patch.loggedMeetingId  = body.loggedMeetingId;
    if (body.needsMeet        !== undefined) patch.needsMeet        = body.needsMeet;
    if (body.assignedDept     !== undefined) patch.assignedDept     = body.assignedDept;

    const [updated] = await db.update(plans)
      .set(patch)
      .where(eq(plans.id, planId))
      .returning();

    res.json({ ok: true, plan: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /plans/:id error");
    res.status(500).json({ ok: false, error: "Failed to update plan" });
  }
});

export default router;
