import { Router } from "express";
import { db }     from "@workspace/db";
import { tasks }  from "@workspace/db";
import { eq }     from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ─── Status transition table ──────────────────────────────────────────────────
// Server enforces these rules — no client can force an arbitrary status.
const VALID_STATUSES = new Set([
  "Open", "In Progress", "Done", "Overdue", "Escalated",
]);
const TERMINAL = new Set(["Done"]);
const PRIVILEGED_STATUSES = new Set(["Escalated", "Overdue"]); // only RH/Admin/NSH can set these
const PRIVILEGED_ROLES    = new Set(["REGION HEAD", "NSH", "ADMIN", "CRO", "SALES HEAD", "SALES STRATEGY"]);

// Valid transitions from each status.
// Done is terminal — nothing may leave it.
// A rep can only advance to In Progress or Done; RH/Admin can also set Escalated/Overdue.
const ALLOWED_FROM: Record<string, string[]> = {
  "Open":        ["In Progress", "Done", "Escalated", "Overdue"],
  "In Progress": ["Done", "Open", "Escalated", "Overdue"],
  "Overdue":     ["Done", "In Progress", "Open"],
  "Escalated":   ["Done", "In Progress", "Open"],
  "Done":        [], // terminal
};

function isAccessible(
  task: typeof tasks.$inferSelect,
  userId: string,
  role:   string,
  region: string,
): boolean {
  if (PRIVILEGED_ROLES.has(role) && role !== "REGION HEAD") return true;
  if (role === "REGION HEAD") return task.region === region;
  // SALES REP — can see tasks they created OR are assigned to
  return task.assignedByUserId === userId || task.assignedToUserId === userId;
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
// List tasks — role-scoped.
// Query params:
//   ?status=          filter by status
//   ?actionType=      filter by action type
//   ?dealId=          filter by linked deal
//   ?clientCompany=   filter by client company name
//   ?repUserId=       filter by rep (admin/RH only — reps are silently scoped to themselves)
//   ?assignedToMe=    "true" — only tasks where assignedToUserId = calling user
router.get("/tasks", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    status:        filterStatus,
    actionType:    filterActionType,
    dealId:        filterDealId,
    clientCompany: filterClient,
    repUserId:     filterRepUserId,
    assignedToMe,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(tasks);

    // ── Role-based scope ────────────────────────────────────────────────────
    if (user.role === "SALES REP") {
      rows = rows.filter(t =>
        t.assignedByUserId === user.id || t.assignedToUserId === user.id,
      );
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(t => t.region === user.region);
    }
    // Global roles (NSH, CRO, ADMIN, SALES HEAD, SALES STRATEGY) see all.

    // ── Optional filters ─────────────────────────────────────────────────────
    if (filterStatus)     rows = rows.filter(t => t.status      === filterStatus);
    if (filterActionType) rows = rows.filter(t => t.actionType  === filterActionType);
    if (filterDealId)     rows = rows.filter(t => t.dealId      === filterDealId);
    if (filterClient)     rows = rows.filter(t =>
      t.clientCompany?.toLowerCase().includes(filterClient.toLowerCase()),
    );
    if (filterRepUserId && PRIVILEGED_ROLES.has(user.role)) {
      rows = rows.filter(t => t.assignedByUserId === filterRepUserId);
    }
    if (assignedToMe === "true") {
      rows = rows.filter(t => t.assignedToUserId === user.id);
    }

    // Newest first
    rows.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json({ ok: true, tasks: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /tasks error");
    res.status(500).json({ ok: false, error: "Failed to list tasks" });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
// Create a standalone task (Phase 8 frontend cutover).
// The touchpoints route still creates tasks as a side-effect of action-item routing;
// this endpoint supports manual task creation from the frontend.
router.post("/tasks", requireAuth, async (req, res) => {
  const user = req.user!;
  const b = (req.body ?? {}) as Record<string, any>;

  const actionType       = (b.actionType || b.action || "").trim();
  const title            = (b.title || "").trim();
  const assignedByUserId = (b.assignedByUserId || b.assignedBy || "").trim();
  const assignedByName   = (b.assignedByName || "").trim();

  if (!actionType) {
    res.status(400).json({ ok: false, error: "actionType is required" });
    return;
  }
  if (!title) {
    res.status(400).json({ ok: false, error: "title is required" });
    return;
  }
  if (!assignedByUserId) {
    res.status(400).json({ ok: false, error: "assignedByUserId is required" });
    return;
  }

  try {
    const [created] = await db.insert(tasks).values({
      actionType,
      title,
      description:      b.description     || null,
      priority:         b.priority        || "High",
      status:           "Open",
      dueDate:          b.dueDate         || null,
      assignedByUserId,
      assignedByName:   assignedByName    || user.name || "",
      assignedToUserId: b.assignedToUserId|| null,
      assignedDept:     b.assignedDept || b.dept || null,
      clientCompany:    b.clientCompany   || null,
      dealId:           b.dealId          || null,
      touchpointId:     b.touchpointId    || null,
      fromMeetingLog:   !!b.fromMeetingLog,
      region:           b.region          || user.region || null,
      repId:            b.repId           ? Number(b.repId) : null,
    }).returning();

    res.status(201).json({ ok: true, task: created });
  } catch (err) {
    req.log.error({ err }, "POST /tasks error");
    res.status(500).json({ ok: false, error: "Failed to create task" });
  }
});

// ─── PATCH /api/tasks/:id/status ──────────────────────────────────────────────
// Controlled status transition.
// Body: { status: string, note?: string }
//
// Rules:
//   - Done is terminal — no transitions out allowed.
//   - "Escalated" and "Overdue" can only be set by RH/Admin/NSH and above.
//   - Rep can only update tasks they created or are assigned to.
//   - note is optional for most transitions but strongly recommended for Escalated.
router.patch("/tasks/:id/status", requireAuth, async (req, res) => {
  const user   = req.user!;
  const taskId = req.params.id;
  const { status: newStatus, note } = (req.body ?? {}) as {
    status?: string;
    note?:   string;
  };

  if (!newStatus?.trim() || !VALID_STATUSES.has(newStatus)) {
    res.status(400).json({
      ok: false,
      error: `status must be one of: ${[...VALID_STATUSES].join(", ")}`,
    });
    return;
  }

  // Privileged status guard — reps cannot escalate
  if (PRIVILEGED_STATUSES.has(newStatus) && !PRIVILEGED_ROLES.has(user.role)) {
    res.status(403).json({
      ok: false,
      error: `Only RH / Admin / NSH can set status '${newStatus}'`,
    });
    return;
  }

  try {
    const rows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    const task = rows[0] ?? null;
    if (!task) {
      res.status(404).json({ ok: false, error: "Task not found" });
      return;
    }

    // ── Access check ─────────────────────────────────────────────────────────
    if (!isAccessible(task, user.id, user.role, user.region)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    // ── Terminal check ────────────────────────────────────────────────────────
    if (TERMINAL.has(task.status)) {
      res.status(409).json({
        ok: false,
        error: `Task is '${task.status}' — terminal status cannot be changed`,
      });
      return;
    }

    // ── Transition validity ───────────────────────────────────────────────────
    const allowed = ALLOWED_FROM[task.status] ?? [];
    if (!allowed.includes(newStatus)) {
      res.status(409).json({
        ok: false,
        error: `Cannot transition from '${task.status}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}`,
      });
      return;
    }

    const [updated] = await db.update(tasks)
      .set({
        status:          newStatus,
        statusChangedAt: new Date(),
        statusChangedBy: user.id,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    res.json({
      ok:   true,
      task: updated,
      transition: { from: task.status, to: newStatus, by: user.id, note: note ?? null },
    });
  } catch (err) {
    req.log.error({ err }, "PATCH /tasks/:id/status error");
    res.status(500).json({ ok: false, error: "Failed to update task status" });
  }
});

export default router;
