import { Router }          from "express";
import { db }              from "@workspace/db";
import { internalRequests } from "@workspace/db";
import { eq }              from "drizzle-orm";
import { requireAuth }     from "../middlewares/requireAuth";

const router = Router();

// ─── Role helpers ─────────────────────────────────────────────────────────────
const PRIVILEGED_ROLES = new Set([
  "REGION HEAD", "NSH", "ADMIN", "CRO", "SALES HEAD", "SALES STRATEGY",
]);

function isAccessible(
  ir:     typeof internalRequests.$inferSelect,
  userId: string,
  role:   string,
  region: string,
): boolean {
  if (role === "SALES REP") return ir.raisedByUserId === userId;
  if (role === "REGION HEAD") return ir.region === region;
  return true; // all other privileged roles see everything
}

function canResolveOrReject(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}

// ─── GET /api/internal-requests ──────────────────────────────────────────────
// List internal requests — role-scoped.
// Query params:
//   ?status=       filter by status ("Pending" | "In Review" | "Resolved" | "Rejected")
//   ?type=         filter by request type ("Approval needed" | "Introduction needed" | etc.)
//   ?dealId=       filter by linked deal
//   ?repUserId=    filter by raiser (admin/RH only)
router.get("/internal-requests", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    status:    filterStatus,
    type:      filterType,
    dealId:    filterDealId,
    repUserId: filterRepUserId,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(internalRequests);

    // ── Role-based scope ─────────────────────────────────────────────────────
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.raisedByUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }
    // Global roles see all.

    // ── Optional filters ─────────────────────────────────────────────────────
    if (filterStatus)    rows = rows.filter(r => r.status === filterStatus);
    if (filterType)      rows = rows.filter(r => r.type   === filterType);
    if (filterDealId)    rows = rows.filter(r => r.dealId === filterDealId);
    if (filterRepUserId && PRIVILEGED_ROLES.has(user.role)) {
      rows = rows.filter(r => r.raisedByUserId === filterRepUserId);
    }

    // Newest first
    rows.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json({ ok: true, internalRequests: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /internal-requests error");
    res.status(500).json({ ok: false, error: "Failed to list internal requests" });
  }
});

// ─── POST /api/internal-requests ─────────────────────────────────────────────
// Create a standalone internal request (Phase 8 frontend cutover).
router.post("/internal-requests", requireAuth, async (req, res) => {
  const user = req.user!;
  const b = (req.body ?? {}) as Record<string, any>;

  const type           = (b.type || "").trim();
  const subject        = (b.subject || "").trim();
  const raisedByUserId = (b.raisedByUserId || b.raisedBy || "").trim();
  const raisedByName   = (b.raisedByName || "").trim();
  const raisedAt       = (b.raisedAt || new Date().toISOString().split("T")[0]);

  if (!type)           { res.status(400).json({ ok: false, error: "type is required" }); return; }
  if (!subject)        { res.status(400).json({ ok: false, error: "subject is required" }); return; }
  if (!raisedByUserId) { res.status(400).json({ ok: false, error: "raisedByUserId is required" }); return; }

  try {
    const [created] = await db.insert(internalRequests).values({
      type,
      dept:           b.dept          || null,
      subject,
      details:        b.details       || null,
      raisedByUserId,
      raisedByName:   raisedByName    || user.name || "",
      repId:          b.repId         ? Number(b.repId) : null,
      clientCompany:  b.clientCompany || null,
      dealId:         b.dealId        || null,
      touchpointId:   b.touchpointId  || null,
      region:         b.region        || user.region || null,
      status:         "Pending",
      raisedAt,
      slaHours:       b.slaHours      ? Number(b.slaHours) : 48,
    }).returning();

    res.status(201).json({ ok: true, internalRequest: created });
  } catch (err) {
    req.log.error({ err }, "POST /internal-requests error");
    res.status(500).json({ ok: false, error: "Failed to create internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id/acknowledge ────────────────────────────
// Move IR from Pending → In Review (Acknowledge). Any privileged role.
router.patch("/internal-requests/:id/acknowledge", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;

  if (!PRIVILEGED_ROLES.has(user.role)) {
    res.status(403).json({ ok: false, error: "Only Region Head / Admin / NSH and above can acknowledge requests" });
    return;
  }

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    const ir = rows[0] ?? null;
    if (!ir) { res.status(404).json({ ok: false, error: "Internal request not found" }); return; }
    if (ir.status === "Resolved" || ir.status === "Rejected") {
      res.status(409).json({ ok: false, error: `Request is already '${ir.status}' — cannot acknowledge` });
      return;
    }

    const [updated] = await db.update(internalRequests)
      .set({ status: "In Review" })
      .where(eq(internalRequests.id, irId))
      .returning();

    res.json({ ok: true, internalRequest: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id/acknowledge error");
    res.status(500).json({ ok: false, error: "Failed to acknowledge internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id ────────────────────────────────────────
// Update basic fields (type, dept, subject, details, clientCompany) — admin/RH only.
router.patch("/internal-requests/:id", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;
  const b = (req.body ?? {}) as Record<string, any>;

  if (!PRIVILEGED_ROLES.has(user.role)) {
    res.status(403).json({ ok: false, error: "Only Region Head / Admin / NSH and above can edit requests" });
    return;
  }

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    if (!rows[0]) { res.status(404).json({ ok: false, error: "Internal request not found" }); return; }

    const updates: Partial<typeof internalRequests.$inferInsert> = {};
    if (b.type          != null) updates.type          = b.type.trim();
    if (b.dept          != null) updates.dept          = b.dept.trim();
    if (b.subject       != null) updates.subject       = b.subject.trim();
    if (b.details       != null) updates.details       = b.details.trim();
    if (b.clientCompany != null) updates.clientCompany = b.clientCompany.trim();

    const [updated] = await db.update(internalRequests)
      .set(updates)
      .where(eq(internalRequests.id, irId))
      .returning();

    res.json({ ok: true, internalRequest: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id error");
    res.status(500).json({ ok: false, error: "Failed to update internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id/resolve ────────────────────────────────
// Resolve an internal request.
// - Allowed for: REGION HEAD / ADMIN / NSH / CRO / SALES HEAD / SALES STRATEGY
// - Body: { resolverNote: string }  — required
// - Transitions: Pending → Resolved | In Review → Resolved
// - Resolved is terminal; Rejected is terminal.
router.patch("/internal-requests/:id/resolve", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;
  const { resolverNote } = (req.body ?? {}) as { resolverNote?: string };

  if (!canResolveOrReject(user.role)) {
    res.status(403).json({
      ok: false,
      error: "Only Region Head / Admin / NSH and above can resolve internal requests",
    });
    return;
  }
  if (!resolverNote?.trim()) {
    res.status(400).json({
      ok: false,
      error: "resolverNote is required when resolving an internal request",
    });
    return;
  }

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    const ir   = rows[0] ?? null;
    if (!ir) {
      res.status(404).json({ ok: false, error: "Internal request not found" });
      return;
    }

    // Access check
    if (!isAccessible(ir, user.id, user.role, user.region)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    // Terminal check
    if (ir.status === "Resolved" || ir.status === "Rejected") {
      res.status(409).json({
        ok: false,
        error: `Request is already '${ir.status}' — terminal status cannot be changed`,
      });
      return;
    }

    const todayISO = new Date().toISOString().split("T")[0];
    const [updated] = await db.update(internalRequests)
      .set({
        status:       "Resolved",
        resolvedAt:   todayISO,
        resolvedBy:   user.id,
        resolverNote: resolverNote.trim(),
      })
      .where(eq(internalRequests.id, irId))
      .returning();

    res.json({ ok: true, internalRequest: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id/resolve error");
    res.status(500).json({ ok: false, error: "Failed to resolve internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id/reject ─────────────────────────────────
// Reject an internal request.
// - Allowed for: REGION HEAD / ADMIN / NSH / CRO / SALES HEAD / SALES STRATEGY
// - Body: { resolverNote: string }  — required (reason for rejection)
// - Transitions: Pending → Rejected | In Review → Rejected
// - Rejected is terminal.
router.patch("/internal-requests/:id/reject", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;
  const { resolverNote } = (req.body ?? {}) as { resolverNote?: string };

  if (!canResolveOrReject(user.role)) {
    res.status(403).json({
      ok: false,
      error: "Only Region Head / Admin / NSH and above can reject internal requests",
    });
    return;
  }
  if (!resolverNote?.trim()) {
    res.status(400).json({
      ok: false,
      error: "resolverNote is required when rejecting an internal request",
    });
    return;
  }

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    const ir   = rows[0] ?? null;
    if (!ir) {
      res.status(404).json({ ok: false, error: "Internal request not found" });
      return;
    }

    if (!isAccessible(ir, user.id, user.role, user.region)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    if (ir.status === "Resolved" || ir.status === "Rejected") {
      res.status(409).json({
        ok: false,
        error: `Request is already '${ir.status}' — terminal status cannot be changed`,
      });
      return;
    }

    const todayISO = new Date().toISOString().split("T")[0];
    const [updated] = await db.update(internalRequests)
      .set({
        status:       "Rejected",
        resolvedAt:   todayISO,
        resolvedBy:   user.id,
        resolverNote: resolverNote.trim(),
      })
      .where(eq(internalRequests.id, irId))
      .returning();

    res.json({ ok: true, internalRequest: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id/reject error");
    res.status(500).json({ ok: false, error: "Failed to reject internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id/withdraw ───────────────────────────────
// Withdraw an internal request (raiser or RH / Admin).
// Transitions: Pending → Withdrawn | In Review → Withdrawn
// Withdrawn is terminal.
router.patch("/internal-requests/:id/withdraw", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    const ir   = rows[0] ?? null;
    if (!ir) { res.status(404).json({ ok: false, error: "Internal request not found" }); return; }

    // Only the raiser or a privileged role may withdraw
    const isRaiser    = ir.raisedByUserId === user.id;
    const isPrivileged = PRIVILEGED_ROLES.has(user.role);
    if (!isRaiser && !isPrivileged) {
      res.status(403).json({ ok: false, error: "Only the requester or a manager can withdraw this request" });
      return;
    }

    if (ir.status === "Resolved" || ir.status === "Rejected" || ir.status === "Withdrawn") {
      res.status(409).json({ ok: false, error: `Request is already '${ir.status}' — cannot withdraw` });
      return;
    }

    const todayISO = new Date().toISOString().split("T")[0];
    const [updated] = await db.update(internalRequests)
      .set({ status: "Withdrawn", resolvedAt: todayISO, resolvedBy: user.id, resolverNote: "Withdrawn by requester" })
      .where(eq(internalRequests.id, irId))
      .returning();

    res.json({ ok: true, internalRequest: updated });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id/withdraw error");
    res.status(500).json({ ok: false, error: "Failed to withdraw internal request" });
  }
});

// ─── PATCH /api/internal-requests/:id/escalate ───────────────────────────────
// Escalate an internal request to a higher department/role.
// - Marks the original IR as Withdrawn (with resolverNote "Escalated to <dept>")
// - Creates a new Escalation IR directed at the escalated dept
// - Returns { ok, escalated: newIR, original: updatedOriginal }
// Dept escalation chain: Region Head → NSH, NSH → CXO, Sales Strategy → NSH, CXO → CXO (top)
router.patch("/internal-requests/:id/escalate", requireAuth, async (req, res) => {
  const user = req.user!;
  const irId = req.params.id;

  try {
    const rows = await db.select().from(internalRequests).where(eq(internalRequests.id, irId)).limit(1);
    const ir   = rows[0] ?? null;
    if (!ir) { res.status(404).json({ ok: false, error: "Internal request not found" }); return; }

    if (ir.status === "Resolved" || ir.status === "Rejected" || ir.status === "Withdrawn") {
      res.status(409).json({ ok: false, error: `Request is already '${ir.status}' — cannot escalate` });
      return;
    }
    if (ir.type === "Escalation") {
      res.status(409).json({ ok: false, error: "Cannot escalate an escalation request" });
      return;
    }

    // Dept escalation chain (mirrors frontend logic)
    const escalatedDept =
      ir.dept === "NSH"            ? "CXO"
      : ir.dept === "Sales Strategy"? "NSH"
      : ir.dept === "Region Head"   ? "NSH"
      : ir.dept === "CXO"           ? "CXO"
      : "Region Head";

    const todayISO = new Date().toISOString().split("T")[0];

    // 1. Mark original as Withdrawn
    const [original] = await db.update(internalRequests)
      .set({
        status:       "Withdrawn",
        resolvedAt:   todayISO,
        resolvedBy:   user.id,
        resolverNote: `Escalated to ${escalatedDept} by ${user.name || user.id}`,
      })
      .where(eq(internalRequests.id, irId))
      .returning();

    // 2. Create new escalation IR
    const [escalated] = await db.insert(internalRequests).values({
      type:           "Escalation",
      dept:           escalatedDept,
      subject:        `ESCALATION: ${ir.subject}`,
      details:        `Original request to ${ir.dept} has breached SLA. Escalating for urgent action.\n\nOriginal: ${ir.details || ""}`,
      raisedByUserId: user.id,
      raisedByName:   user.name || "",
      repId:          ir.repId,
      clientCompany:  ir.clientCompany,
      dealId:         ir.dealId,
      touchpointId:   ir.touchpointId,
      region:         ir.region || user.region || null,
      status:         "Pending",
      raisedAt:       todayISO,
      slaHours:       24,
    }).returning();

    res.json({ ok: true, escalated, original });
  } catch (err) {
    req.log.error({ err }, "PATCH /internal-requests/:id/escalate error");
    res.status(500).json({ ok: false, error: "Failed to escalate internal request" });
  }
});

export default router;

