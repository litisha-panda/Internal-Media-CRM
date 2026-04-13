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
const MGMT_AND_RH   = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY", "REGION HEAD"];

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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
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
        status:           "Open",               // always starts Open — never trust client status
        dueDate:          body.dueDate           ?? null,
        createdAt:        new Date(),
        assignedBy:       u.name,               // always from session
        assignedByName:   u.name,               // always from session
        fromMeetingLog:   body.fromMeetingLog    ?? false,
        actionType:       body.actionType        ?? null,
        dealId:           body.dealId            ?? null,
        notes:            body.notes             ?? null,
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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── PATCH /api/tasks/:id/status ───────────────────────────────────────────────
// Allowed by: assignee, assigner (by name match), ADMIN, or elevated roles
router.patch("/tasks/:id/status", requireAuth, async (req, res) => {
  try {
    const u   = req.user!;
    const tid = String(req.params["id"]);
    const { status, notes } = req.body as { status?: string; notes?: string };

    if (!status) return void res.status(400).json({ ok: false, error: "status is required" });

    const rows = await db.select().from(tasks).where(eq(tasks.id, tid)).limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const task = rows[0];
    const isAssignee = task.assignedToUserId === u.id;
    const isAssigner = task.assignedBy === u.name;
    const isPrivileged = MGMT_AND_RH.includes(u.role);

    if (!isAssignee && !isAssigner && !isPrivileged) {
      return void res.status(403).json({ ok: false, error: "Only the task assignee, assigner, or a manager may change status" });
    }

    const updated = await db
      .update(tasks)
      .set({ status, ...(notes !== undefined && { notes }), updatedAt: new Date() })
      .where(eq(tasks.id, tid))
      .returning();

    if (status === "Done" || status === "Closed") {
      void logActivity({
        userId:     u.id,
        userName:   u.name,
        userRole:   u.role,
        action:     "task.completed",
        entityType: "task",
        entityId:   tid,
        meta:       { status },
      });
    } else {
      void logActivity({
        userId:     u.id,
        userName:   u.name,
        userRole:   u.role,
        action:     "task.status_changed",
        entityType: "task",
        entityId:   tid,
        meta:       { from: task.status, to: status },
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── PATCH /api/tasks/:id/reschedule ──────────────────────────────────────────
// Allowed by: assigner, ADMIN, or elevated roles. Assignee may NOT reschedule.
router.patch("/tasks/:id/reschedule", requireAuth, async (req, res) => {
  try {
    const u   = req.user!;
    const tid = String(req.params["id"]);
    const { dueDate } = req.body as { dueDate?: string };

    if (!dueDate) return void res.status(400).json({ ok: false, error: "dueDate (YYYY-MM-DD) is required" });

    const rows = await db.select().from(tasks).where(eq(tasks.id, tid)).limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const task = rows[0];
    const isAssigner = task.assignedBy === u.name;
    const isPrivileged = MGMT_AND_RH.includes(u.role);

    if (!isAssigner && !isPrivileged) {
      return void res.status(403).json({ ok: false, error: "Only the task assigner or a manager may reschedule this task" });
    }

    const updated = await db
      .update(tasks)
      .set({ dueDate, updatedAt: new Date() })
      .where(eq(tasks.id, tid))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "task.rescheduled",
      entityType: "task",
      entityId:   tid,
      meta:       { from: task.dueDate, to: dueDate },
    });

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── PATCH /api/tasks/:id/reassign ────────────────────────────────────────────
// Allowed by: assigner, ADMIN, or elevated roles.
router.patch("/tasks/:id/reassign", requireAuth, async (req, res) => {
  try {
    const u   = req.user!;
    const tid = String(req.params["id"]);
    const { assignedTo, assignedToUserId, assignedDept } = req.body;

    const rows = await db.select().from(tasks).where(eq(tasks.id, tid)).limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const task = rows[0];
    const isAssigner  = task.assignedBy === u.name;
    const isPrivileged = MGMT_AND_RH.includes(u.role);

    if (!isAssigner && !isPrivileged) {
      return void res.status(403).json({ ok: false, error: "Only the task assigner or a manager may reassign this task" });
    }

    const updated = await db
      .update(tasks)
      .set({
        ...(assignedTo        !== undefined && { assignedTo }),
        ...(assignedToUserId  !== undefined && { assignedToUserId }),
        ...(assignedDept      !== undefined && { assignedDept }),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, tid))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "task.reassigned",
      entityType: "task",
      entityId:   tid,
      meta:       { from: task.assignedTo, to: assignedTo },
    });

    if (assignedToUserId && assignedToUserId !== task.assignedToUserId) {
      void createNotification({
        userId:     assignedToUserId,
        type:       "task_assigned",
        title:      `Task reassigned to you: ${task.title}`,
        body:       `Reassigned by ${u.name}${task.dueDate ? ` — due ${task.dueDate}` : ""}`,
        entityType: "task",
        entityId:   tid,
      });
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── PATCH /api/tasks/:id/note ─────────────────────────────────────────────────
// Any party who can see the task may add/update notes.
router.patch("/tasks/:id/note", requireAuth, async (req, res) => {
  try {
    const tid = String(req.params["id"]);
    const { notes } = req.body as { notes?: string };
    if (notes === undefined) return void res.status(400).json({ ok: false, error: "notes is required" });

    const updated = await db
      .update(tasks)
      .set({ notes, updatedAt: new Date() })
      .where(eq(tasks.id, tid))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
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

    const resolvedRoutedToRole = routeFromDept(body.dept);
    const resolvedSlaHours     = slaFromDept(body.dept);
    const resolvedSubtype      = validateIRSubtype(body.irSubtype);

    const row = await db
      .insert(internalRequests)
      .values({
        id:            body.id,
        type:          body.type          ?? null,
        irSubtype:     resolvedSubtype,
        dept:          body.dept          ?? null,
        routedToRole:  resolvedRoutedToRole,
        subject:       body.subject,
        details:       body.details       ?? null,
        raisedBy:      u.id,
        raisedByName:  u.name,
        repId:         u.role === "SALES REP" ? u.repId : (body.repId ?? u.repId ?? null),
        dealId:        body.dealId        ?? null,
        clientCompany: body.clientCompany ?? null,
        status:        "Pending",
        raisedAt:      new Date().toISOString(),
        slaHours:      resolvedSlaHours,
        resolvedAt:    null,
        resolverNote:  null,
        priority:      body.priority      ?? "Medium",
        dueDate:       body.dueDate       ?? null,
        notes:         body.notes         ?? null,
        acceptedAt:    null,
        escDept:       null,
        escalatedAt:   null,
        escHistory:    [],
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

    if (resolvedRoutedToRole) {
      void (async () => {
        try {
          const recipients = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, resolvedRoutedToRole), eq(users.status, "active")));
          for (const r of recipients) {
            void createNotification({
              userId:     r.id,
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
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ── POST /api/internal-requests/:id/accept ────────────────────────────────────
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
    if (u.role !== "ADMIN" && ir.routedToRole && ir.routedToRole !== u.role) {
      return void res.status(403).json({
        ok: false, error: `Only ${ir.routedToRole} can accept this request (you are ${u.role})`,
      });
    }
    if (["Done", "Withdrawn", "Rejected"].includes(ir.status ?? "")) {
      return void res.status(400).json({ ok: false, error: `Cannot accept a request with status "${ir.status}"` });
    }

    const updated = await db
      .update(internalRequests)
      .set({ status: "Accepted", acceptedAt: new Date().toISOString(), updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({ userId: u.id, userName: u.name, userRole: u.role, action: "ir.accepted", entityType: "internal_request", entityId: ir.id });

    if (ir.raisedBy) {
      void createNotification({
        userId: ir.raisedBy, type: "ir_accepted",
        title: `Request accepted: ${ir.subject}`,
        body: `${u.name} has accepted your request.`,
        entityType: "internal_request", entityId: ir.id,
      });
    }
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) { console.error(err); res.status(500).json({ ok: false, error: "An internal error occurred" }); }
});

// ── POST /api/internal-requests/:id/resolve ───────────────────────────────────
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
        ok: false, error: `Only ${ir.routedToRole} can resolve this request (you are ${u.role})`,
      });
    }

    const updated = await db
      .update(internalRequests)
      .set({ status: "Done", resolvedAt: new Date().toISOString(), resolverNote: req.body.note ?? null, updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({ userId: u.id, userName: u.name, userRole: u.role, action: "ir.resolved", entityType: "internal_request", entityId: ir.id, meta: { note: req.body.note } });

    if (ir.raisedBy) {
      void createNotification({
        userId: ir.raisedBy, type: "ir_resolved",
        title: `Request resolved: ${ir.subject}`,
        body: req.body.note ?? `${u.name} marked your request as done.`,
        entityType: "internal_request", entityId: ir.id,
      });
    }
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) { console.error(err); res.status(500).json({ ok: false, error: "An internal error occurred" }); }
});

// ── POST /api/internal-requests/:id/reject ────────────────────────────────────
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
        ok: false, error: `Only ${ir.routedToRole} can reject this request (you are ${u.role})`,
      });
    }

    const updated = await db
      .update(internalRequests)
      .set({ status: "Rejected", resolvedAt: new Date().toISOString(), resolverNote: req.body.note ?? null, updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({ userId: u.id, userName: u.name, userRole: u.role, action: "ir.rejected", entityType: "internal_request", entityId: ir.id, meta: { note: req.body.note } });

    if (ir.raisedBy) {
      void createNotification({
        userId: ir.raisedBy, type: "ir_rejected",
        title: `Request rejected: ${ir.subject}`,
        body: req.body.note ?? `${u.name} rejected your request.`,
        entityType: "internal_request", entityId: ir.id,
      });
    }
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) { console.error(err); res.status(500).json({ ok: false, error: "An internal error occurred" }); }
});

// ── POST /api/internal-requests/:id/withdraw — raiser only ────────────────────
router.post("/internal-requests/:id/withdraw", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(internalRequests)
      .where(eq(internalRequests.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const ir = rows[0];

    // Only the original raiser (or ADMIN) may withdraw
    if (ir.raisedBy !== u.id && u.role !== "ADMIN") {
      return void res.status(403).json({ ok: false, error: "Only the original raiser may withdraw this request" });
    }
    if (["Done", "Rejected", "Withdrawn"].includes(ir.status ?? "")) {
      return void res.status(400).json({ ok: false, error: `Cannot withdraw a request with status "${ir.status}"` });
    }

    const updated = await db
      .update(internalRequests)
      .set({ status: "Withdrawn", resolvedAt: new Date().toISOString(), resolverNote: req.body.note ?? "Withdrawn by raiser", updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    void logActivity({ userId: u.id, userName: u.name, userRole: u.role, action: "ir.withdrawn", entityType: "internal_request", entityId: ir.id });

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) { console.error(err); res.status(500).json({ ok: false, error: "An internal error occurred" }); }
});

// ── PATCH /api/internal-requests/:id/note — any party may add notes ───────────
router.patch("/internal-requests/:id/note", requireAuth, async (req, res) => {
  try {
    const { notes } = req.body as { notes?: string };
    if (notes === undefined) return void res.status(400).json({ ok: false, error: "notes is required" });

    const updated = await db
      .update(internalRequests)
      .set({ notes, updatedAt: new Date() })
      .where(eq(internalRequests.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) { console.error(err); res.status(500).json({ ok: false, error: "An internal error occurred" }); }
});

// NOTE: Generic PATCH for both tasks and internal-requests has been intentionally removed.
// All lifecycle changes go through the specific sub-routes above.

export default router;
