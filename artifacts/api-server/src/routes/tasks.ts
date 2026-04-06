import { Router } from "express";
import { db, tasks, internalRequests, users, DEPT_TO_ROLE, DEPT_SLA_HOURS, IR_SUBTYPES } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activityLog";
import { createNotification } from "../lib/notifications";

const router = Router();

// ─── Role constants ───────────────────────────────────────────────────────────
const ELEVATED_ALL  = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY", "REGION HEAD"];
const ELEVATED_MGMT = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY"];

// ─── IR routing helpers ───────────────────────────────────────────────────────

function routeFromDept(dept: string | undefined | null): string | null {
  if (!dept) return null;
  return DEPT_TO_ROLE[dept] ?? null;
}

function slaFromDept(dept: string | undefined | null): number {
  if (!dept) return 48;
  return DEPT_SLA_HOURS[dept] ?? 48;
}

function validateIRSubtype(subtype: string | undefined | null): string {
  if (!subtype) return "Support Request";
  return (IR_SUBTYPES as readonly string[]).includes(subtype) ? subtype : "Support Request";
}

// ─── Scope conditions ─────────────────────────────────────────────────────────

function taskScopeCondition(user: any) {
  if (ELEVATED_ALL.includes(user.role)) return undefined;
  return or(
    eq(tasks.assignedToUserId, user.id),
    eq(tasks.assignedBy, user.name),
    ...(user.repId ? [eq(tasks.repId, user.repId!)] : []),
  );
}

function reqScopeCondition(user: any) {
  if (ELEVATED_MGMT.includes(user.role)) return undefined;
  if (user.role === "REGION HEAD") {
    return or(
      eq(internalRequests.raisedBy, user.id),
      eq(internalRequests.routedToRole, "REGION HEAD"),
    );
  }
  return or(
    eq(internalRequests.raisedBy, user.id),
    ...(user.repId ? [eq(internalRequests.repId, user.repId!)] : []),
  );
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const cond = taskScopeCondition(req.user!);
    const rows = cond
      ? await db.select().from(tasks).where(cond).orderBy(desc(tasks.updatedAt))
      : await db.select().from(tasks).orderBy(desc(tasks.updatedAt));
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.title) {
      return void res.status(400).json({ ok: false, error: "id and title required" });
    }

    const row = await db
      .insert(tasks)
      .values({
        id:               body.id,
        title:            body.title,
        description:      body.description      ?? null,
        assignedTo:       body.assignedTo        ?? null,
        assignedToUserId: body.assignedToUserId  ?? null,
        assignedDept:     body.assignedDept      ?? null,
        repId:            u.role === "SALES REP" ? u.repId : (body.repId ?? u.repId ?? null),
        clientCompany:    body.clientCompany     ?? null,
        priority:         body.priority          ?? "Medium",
        status:           body.status            ?? "Open",
        dueDate:          body.dueDate           ?? null,
        createdAt:        body.createdAt         ?? new Date().toISOString(),
        assignedBy:       u.name,
        assignedByName:   u.name,
        fromMeetingLog:   body.fromMeetingLog ?? false,
        actionType:       body.actionType    ?? null,
        dealId:           body.dealId        ?? null,
        notes:            body.notes         ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!row[0]) {
      return void res.status(409).json({ ok: false, error: "Task with this id already exists" });
    }

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "task.created",
      entityType: "task",
      entityId:   body.id,
      meta:       { title: body.title, assignedTo: body.assignedTo, dueDate: body.dueDate },
    });

    // Notify the assignee if different from creator
    if (body.assignedToUserId && body.assignedToUserId !== u.id) {
      void createNotification({
        userId:     body.assignedToUserId,
        type:       "task_assigned",
        title:      `New task: ${body.title}`,
        body:       `Assigned by ${u.name}${body.dueDate ? ` — due ${body.dueDate}` : ""}`,
        entityType: "task",
        entityId:   body.id,
      });
    }

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { id: _id, createdAt: _ca, assignedBy: _ab, assignedByName: _abn, repId: _ri, ...rest } = req.body;
    const updated = await db
      .update(tasks)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(tasks.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });

    if (rest.status === "Done") {
      void logActivity({
        userId:     u.id,
        userName:   u.name,
        userRole:   u.role,
        action:     "task.completed",
        entityType: "task",
        entityId:   String(req.params["id"]),
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── INTERNAL REQUESTS ───────────────────────────────────────────────────────

router.get("/internal-requests", requireAuth, async (req, res) => {
  try {
    const cond = reqScopeCondition(req.user!);
    const rows = cond
      ? await db.select().from(internalRequests).where(cond).orderBy(desc(internalRequests.createdAt))
      : await db.select().from(internalRequests).orderBy(desc(internalRequests.createdAt));
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/internal-requests/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(internalRequests)
      .where(eq(internalRequests.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/internal-requests — raise new request
router.post("/internal-requests", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const body = req.body;
    if (!body.id || !body.subject) {
      return void res.status(400).json({ ok: false, error: "id and subject required" });
    }

    // ── Backend-derived routing ───────────────────────────────────────────────
    const resolvedRoutedToRole = routeFromDept(body.dept);
    const resolvedSlaHours     = slaFromDept(body.dept);
    const resolvedSubtype      = validateIRSubtype(body.irSubtype);

    const row = await db
      .insert(internalRequests)
      .values({
        id:           body.id,
        type:         body.type          ?? null,
        irSubtype:    resolvedSubtype,
        dept:         body.dept          ?? null,
        routedToRole: resolvedRoutedToRole,  // backend-derived
        subject:      body.subject,
        details:      body.details       ?? null,
        raisedBy:     u.id,               // always from session
        raisedByName: u.name,
        repId:        u.role === "SALES REP" ? u.repId : (body.repId ?? u.repId ?? null),
        dealId:       body.dealId        ?? null,
        clientCompany:body.clientCompany ?? null,
        status:       "Pending",
        raisedAt:     body.raisedAt      ?? new Date().toISOString(),
        slaHours:     resolvedSlaHours,   // derived from dept, not client-supplied
        resolvedAt:   null,
        resolverNote: null,
        priority:     body.priority      ?? "Medium",
        dueDate:      body.dueDate       ?? null,
        notes:        body.notes         ?? null,
        acceptedAt:   null,
        escDept:      null,
        escalatedAt:  null,
        escHistory:   [],
      })
      .onConflictDoNothing()
      .returning();

    if (!row[0]) {
      return void res.status(409).json({ ok: false, error: "IR with this id already exists" });
    }

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "ir.raised",
      entityType: "internal_request",
      entityId:   body.id,
      meta:       { dept: body.dept, subtype: resolvedSubtype, routedToRole: resolvedRoutedToRole },
    });

    // Notify the receiving role/team — find users with matching role
    if (resolvedRoutedToRole) {
      void (async () => {
        try {
          const recipients = await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(and(eq(users.role, resolvedRoutedToRole), eq(users.status, "active")));
          for (const recipient of recipients) {
            void createNotification({
              userId:     recipient.id,
              type:       "ir_raised",
              title:      `New ${resolvedSubtype}: ${body.subject}`,
              body:       `Raised by ${u.name}${body.clientCompany ? ` for ${body.clientCompany}` : ""}`,
              entityType: "internal_request",
              entityId:   body.id,
            });
          }
        } catch { /* best-effort */ }
      })();
    }

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/internal-requests/:id/accept — only the routedToRole (or ADMIN) can accept
router.post("/internal-requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(internalRequests)
      .where(eq(internalRequests.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const ir = rows[0];

    // ── Permission: only routedToRole or ADMIN may accept ────────────────────
    if (u.role !== "ADMIN" && ir.routedToRole && ir.routedToRole !== u.role) {
      return void res.status(403).json({
        ok:    false,
        error: `Only ${ir.routedToRole} can accept this request (you are ${u.role})`,
      });
    }

    if (ir.status === "Done" || ir.status === "Withdrawn") {
      return void res.status(400).json({ ok: false, error: `Cannot accept a request with status "${ir.status}"` });
    }

    const now = new Date().toISOString();
    const updated = await db
      .update(internalRequests)
      .set({ status: "Accepted", acceptedAt: now, updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "ir.accepted",
      entityType: "internal_request",
      entityId:   ir.id,
    });

    // Notify the raiser
    if (ir.raisedBy) {
      void createNotification({
        userId:     ir.raisedBy,
        type:       "ir_accepted",
        title:      `Request accepted: ${ir.subject}`,
        body:       `${u.name} has accepted your request.`,
        entityType: "internal_request",
        entityId:   ir.id,
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/internal-requests/:id/resolve — mark as Done with resolver note
router.post("/internal-requests/:id/resolve", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(internalRequests)
      .where(eq(internalRequests.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const ir = rows[0];

    if (u.role !== "ADMIN" && ir.routedToRole && ir.routedToRole !== u.role) {
      return void res.status(403).json({
        ok:    false,
        error: `Only ${ir.routedToRole} can resolve this request (you are ${u.role})`,
      });
    }

    const now = new Date().toISOString();
    const updated = await db
      .update(internalRequests)
      .set({
        status:      "Done",
        resolvedAt:  now,
        resolverNote: req.body.note ?? null,
        updatedAt:   new Date(),
      })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "ir.resolved",
      entityType: "internal_request",
      entityId:   ir.id,
      meta:       { note: req.body.note },
    });

    if (ir.raisedBy) {
      void createNotification({
        userId:     ir.raisedBy,
        type:       "ir_resolved",
        title:      `Request resolved: ${ir.subject}`,
        body:       req.body.note ?? `${u.name} marked your request as done.`,
        entityType: "internal_request",
        entityId:   ir.id,
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/internal-requests/:id/reject
router.post("/internal-requests/:id/reject", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(internalRequests)
      .where(eq(internalRequests.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const ir = rows[0];
    if (u.role !== "ADMIN" && ir.routedToRole && ir.routedToRole !== u.role) {
      return void res.status(403).json({
        ok:    false,
        error: `Only ${ir.routedToRole} can reject this request (you are ${u.role})`,
      });
    }

    const now = new Date().toISOString();
    const updated = await db
      .update(internalRequests)
      .set({
        status:       "Rejected",
        resolvedAt:   now,
        resolverNote: req.body.note ?? null,
        updatedAt:    new Date(),
      })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "ir.rejected",
      entityType: "internal_request",
      entityId:   ir.id,
      meta:       { note: req.body.note },
    });

    if (ir.raisedBy) {
      void createNotification({
        userId:     ir.raisedBy,
        type:       "ir_rejected",
        title:      `Request rejected: ${ir.subject}`,
        body:       req.body.note ?? `${u.name} rejected your request.`,
        entityType: "internal_request",
        entityId:   ir.id,
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/internal-requests/:id — update status + resolver note
// (legacy patch — also used for field updates from frontend)
router.patch("/internal-requests/:id", requireAuth, async (req, res) => {
  try {
    const { id: _id, createdAt: _ca, raisedAt: _ra, raisedBy: _rb, raisedByName: _rbn,
            routedToRole: _rtr, irSubtype: _is, escDept: _ed, escHistory: _eh, escalatedAt: _eat,
            slaHours: _sl, ...rest } = req.body;
    const updated = await db
      .update(internalRequests)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
