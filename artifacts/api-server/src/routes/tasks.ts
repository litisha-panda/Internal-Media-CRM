import { Router } from "express";
import { db, tasks, internalRequests } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ─── Role constants ───────────────────────────────────────────────────────────
// Canonical role names. "NATIONAL SALES HEAD" is NOT valid — use "SALES HEAD".
const ELEVATED_ALL  = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY", "REGION HEAD"];
const ELEVATED_MGMT = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY"];

// ─── Issue #5: dept → canonical receiving role ───────────────────────────────
// Internal requests are routed to a role, not a free-text dept string.
const DEPT_TO_ROLE: Record<string, string> = {
  "NSH":              "SALES HEAD",
  "Sales Strategy":   "SALES STRATEGY",
  "CRO":              "CRO",
  "Region Head":      "REGION HEAD",
  "Digital":          "DIGI OPS",
  "Admin":            "ADMIN",
};

function routeFromDept(dept: string | undefined | null): string | null {
  if (!dept) return null;
  return DEPT_TO_ROLE[dept] ?? null;
}

// ─── Scope conditions ─────────────────────────────────────────────────────────

function taskScopeCondition(user: any) {
  if (ELEVATED_ALL.includes(user.role)) return undefined; // elevated roles see all tasks
  return or(
    eq(tasks.assignedToUserId, user.id),
    eq(tasks.assignedBy, user.name),
    ...(user.repId ? [eq(tasks.repId, user.repId!)] : []),
  );
}

function reqScopeCondition(user: any) {
  if (ELEVATED_MGMT.includes(user.role)) return undefined; // SALES HEAD/CRO/Strategy/Admin see all
  if (user.role === "REGION HEAD") {
    // RH sees: their own requests + requests routed to REGION HEAD
    return or(
      eq(internalRequests.raisedBy, user.id),
      eq(internalRequests.routedToRole, "REGION HEAD"),
    );
  }
  // SALES REP sees their own raised requests
  return or(
    eq(internalRequests.raisedBy, user.id),
    ...(user.repId ? [eq(internalRequests.repId, user.repId!)] : []),
  );
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

// GET /api/tasks — scoped list
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

// GET /api/tasks/:id
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

// POST /api/tasks — create
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
        // ── Issue #3: for SALES REP, repId always comes from session ──────────
        repId:            u.role === "SALES REP" ? u.repId : (body.repId ?? u.repId ?? null),
        clientCompany:    body.clientCompany     ?? null,
        priority:         body.priority          ?? "Medium",
        status:           body.status            ?? "Open",
        dueDate:          body.dueDate           ?? null,
        createdAt:        body.createdAt         ?? new Date().toISOString(),
        assignedBy:       u.name,           // always from session — issue #3
        assignedByName:   u.name,           // always from session
        fromMeetingLog:   body.fromMeetingLog ?? false,
        actionType:       body.actionType    ?? null,
        dealId:           body.dealId        ?? null,
        notes:            body.notes         ?? null,
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/tasks/:id — update status, notes, dueDate
router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const { id: _id, createdAt: _ca, assignedBy: _ab, assignedByName: _abn, repId: _ri, ...rest } = req.body;
    const updated = await db
      .update(tasks)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(tasks.id, String(req.params["id"])))
      .returning();

    if (!updated.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── INTERNAL REQUESTS ───────────────────────────────────────────────────────

// GET /api/internal-requests — scoped list
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

// GET /api/internal-requests/:id
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

    // ── Issue #5: derive routedToRole from dept — backend owns routing ────────
    const resolvedRoutedToRole = routeFromDept(body.dept);

    const row = await db
      .insert(internalRequests)
      .values({
        id:           body.id,
        type:         body.type          ?? null,
        dept:         body.dept          ?? null,
        routedToRole: resolvedRoutedToRole,  // backend-derived, not client-supplied
        subject:      body.subject,
        details:      body.details       ?? null,
        raisedBy:     u.id,           // always from session — issue #3
        raisedByName: u.name,         // always from session
        repId:        u.role === "SALES REP" ? u.repId : (body.repId ?? u.repId ?? null),
        dealId:       body.dealId        ?? null,
        clientCompany:body.clientCompany ?? null,
        status:       body.status        ?? "Pending",
        raisedAt:     body.raisedAt      ?? new Date().toISOString(),
        slaHours:     body.slaHours      ?? 48,
        resolvedAt:   null,
        resolverNote: null,
        priority:     body.priority      ?? "Medium",
        dueDate:      body.dueDate       ?? null,
        notes:        body.notes         ?? null,
        acceptedAt:   null,
        escDept:      null,    // governance engine will set this when SLA is breached
        escalatedAt:  null,
        escHistory:   [],
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/internal-requests/:id — update status + resolver note
router.patch("/internal-requests/:id", requireAuth, async (req, res) => {
  try {
    // Strip immutable ownership fields and backend-owned fields
    const { id: _id, createdAt: _ca, raisedAt: _ra, raisedBy: _rb, raisedByName: _rbn,
            routedToRole: _rtr, ...rest } = req.body;
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
