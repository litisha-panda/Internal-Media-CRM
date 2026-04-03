import { Router }               from "express";
import { db, targetSubmissions, targetClients } from "@workspace/db";
import { eq }                   from "drizzle-orm";
import { requireAuth }          from "../middlewares/requireAuth";

const router = Router();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "Pending RH","Pending NSH","Pending Strategy","Pending CRO","Approved","Rejected",
] as const;

type ApprovalStep = "RH" | "NSH" | "Strategy" | "CRO";

// Status required as precondition before each approval step
const REQUIRED_STATUS: Record<ApprovalStep, string> = {
  RH:       "Pending RH",
  NSH:      "Pending NSH",
  Strategy: "Pending Strategy",
  CRO:      "Pending CRO",
};

// Status each approval step transitions to on success
const NEXT_STATUS: Record<ApprovalStep, string> = {
  RH:       "Pending NSH",
  NSH:      "Pending Strategy",
  Strategy: "Pending CRO",
  CRO:      "Approved",
};

// Role required to perform each approval step
const STEP_ROLES: Record<ApprovalStep, string> = {
  RH:       "REGION HEAD",
  NSH:      "SALES HEAD",
  Strategy: "SALES STRATEGY",
  CRO:      "CRO",
};

// Roles that see all submissions regardless of rep or region
const GLOBAL_VIEW_ROLES = new Set(["SALES HEAD","SALES STRATEGY","CRO","ADMIN","DIGI OPS"]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function approvalLogEntry(
  step:   string,
  user:   Express.Request["user"],
  action: "approved" | "rejected",
  note?:  string,
) {
  return {
    step,
    byUserId: user!.id,
    byName:   user!.name,
    byRole:   user!.role,
    at:       new Date().toISOString(),
    action,
    note:     note ?? "",
  };
}

/**
 * Server-side scope check — determines whether a user may read or act on
 * a given submission.
 *
 * Identity is anchored to repUserId (UUID FK to otv_users), not the legacy
 * integer repId. Role and region are read live from req.user (DB-backed),
 * never trusted from the submission row itself.
 */
function canAccessSubmission(
  sub:  { repUserId: string; region: string },
  user: NonNullable<Express.Request["user"]>,
): boolean {
  if (GLOBAL_VIEW_ROLES.has(user.role)) return true;
  if (user.role === "REGION HEAD")       return sub.region === user.region;
  if (user.role === "SALES REP")         return sub.repUserId === user.id;
  return false;
}

/** Fetch a single submission by id. Returns null if not found. */
async function fetchSub(id: string) {
  const rows = await db
    .select()
    .from(targetSubmissions)
    .where(eq(targetSubmissions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── POST /api/targets ───────────────────────────────────────────────────────
// Create a new target submission.
// Only SALES REP and REGION HEAD can submit (always for themselves).
// Rep identity is taken entirely from the session token — callers cannot
// impersonate another rep via the request body.
router.post("/targets", requireAuth, async (req, res) => {
  const user = req.user!;

  if (!["SALES REP", "REGION HEAD"].includes(user.role)) {
    res.status(403).json({ ok: false, error: "Only Sales Reps and Region Heads can submit targets" });
    return;
  }

  const { quarter, fiscalYear, clients, note } = (req.body ?? {}) as {
    quarter?:    string;
    fiscalYear?: string;
    clients?:    Array<{ clientName: string; dealType: string; targetAmount: number; notes?: string }>;
    note?:       string;
  };

  if (!quarter?.trim()) {
    res.status(400).json({ ok: false, error: "quarter is required (e.g. 'Q1 FY26')" });
    return;
  }
  if (!fiscalYear?.trim()) {
    res.status(400).json({ ok: false, error: "fiscalYear is required (e.g. 'FY26')" });
    return;
  }
  if (!Array.isArray(clients) || clients.length === 0) {
    res.status(400).json({ ok: false, error: "clients must be a non-empty array" });
    return;
  }

  // Validate each client row
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    if (!c.clientName?.trim()) {
      res.status(400).json({ ok: false, error: `clients[${i}].clientName is required` });
      return;
    }
    if (!c.dealType?.trim()) {
      res.status(400).json({ ok: false, error: `clients[${i}].dealType is required` });
      return;
    }
    const amt = Number(c.targetAmount);
    if (!Number.isInteger(amt) || amt <= 0) {
      res.status(400).json({ ok: false, error: `clients[${i}].targetAmount must be a positive integer (rupees)` });
      return;
    }
  }

  const totalTarget = clients.reduce((s, c) => s + Number(c.targetAmount), 0);

  const initLog = note
    ? [approvalLogEntry("Submitted", user, "approved", note)]
    : [];

  try {
    const [sub] = await db
      .insert(targetSubmissions)
      .values({
        // ── Identity (source of truth) ────────────────────────────────────
        repUserId:         user.id,             // primary anchor — UUID FK to otv_users
        submittedByUserId: user.id,             // same as repUserId for self-service submissions
        submittedByRole:   user.role,

        // ── Denormalized convenience (from otv_users at write time) ───────
        repName:           user.name,
        region:            user.region ?? "",

        // ── Transitional compat (nullable, legacy integer repId) ──────────
        repId:             user.repId ?? null,

        // ── Temporal scope ────────────────────────────────────────────────
        quarter:           quarter.trim(),
        fiscalYear:        fiscalYear.trim(),

        // ── Financials ────────────────────────────────────────────────────
        totalTarget,
        isAdditionalRevOp: false,
        approvalLog:       initLog,
      })
      .returning();

    const clientRows = await db
      .insert(targetClients)
      .values(
        clients.map(c => ({
          submissionId:  sub.id,
          clientName:    c.clientName.trim(),
          dealType:      c.dealType.trim(),
          targetAmount:  Number(c.targetAmount),  // renamed from annual_target
          notes:         c.notes?.trim() ?? null,
        }))
      )
      .returning();

    res.status(201).json({ ok: true, submission: sub, clients: clientRows });
  } catch (err) {
    req.log.error({ err }, "POST /targets error");
    res.status(500).json({ ok: false, error: "Failed to create submission" });
  }
});

// ─── GET /api/targets ────────────────────────────────────────────────────────
// List target submissions — role-scoped using repUserId (UUID) as the identity
// anchor, never the legacy integer repId.
// Optional query params: ?quarter=Q1 FY26  ?fiscalYear=FY26  ?status=Pending+RH
router.get("/targets", requireAuth, async (req, res) => {
  const user = req.user!;
  const { quarter, fiscalYear, status } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(targetSubmissions);

    // ── Role-based scope (server-enforced, identity via repUserId UUID) ───
    if (user.role === "SALES REP") {
      // A rep sees only submissions whose repUserId matches their own user ID
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      // RH sees all submissions in their region (region denormalized at write time)
      rows = rows.filter(r => r.region === user.region);
    }
    // GLOBAL_VIEW_ROLES — no filter; see everything

    // ── Optional query filters ────────────────────────────────────────────
    if (quarter)    rows = rows.filter(r => r.quarter    === quarter);
    if (fiscalYear) rows = rows.filter(r => r.fiscalYear === fiscalYear);
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      rows = rows.filter(r => r.status === status);
    }

    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({ ok: true, submissions: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /targets error");
    res.status(500).json({ ok: false, error: "Failed to list submissions" });
  }
});

// ─── GET /api/targets/:id ────────────────────────────────────────────────────
// Full detail — submission + client rows.
router.get("/targets/:id", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    const sub = await fetchSub(req.params.id);

    if (!sub) {
      res.status(404).json({ ok: false, error: "Submission not found" });
      return;
    }

    if (!canAccessSubmission(sub, user)) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }

    const clients = await db
      .select()
      .from(targetClients)
      .where(eq(targetClients.submissionId, sub.id));

    res.json({ ok: true, submission: sub, clients });
  } catch (err) {
    req.log.error({ err }, "GET /targets/:id error");
    res.status(500).json({ ok: false, error: "Failed to fetch submission" });
  }
});

// ─── APPROVAL STEP FACTORY ───────────────────────────────────────────────────
// Shared logic for all four approval routes.
// All role and region checks are server-side; nothing is trusted from the body.
function makeApprovalRoute(step: ApprovalStep) {
  return async (req: any, res: any) => {
    const user = req.user!;

    // Role check — exact match required for each step
    if (user.role !== STEP_ROLES[step]) {
      res.status(403).json({
        ok:    false,
        error: `Only ${STEP_ROLES[step]} can approve at the ${step} step`,
      });
      return;
    }

    try {
      const sub = await fetchSub(req.params.id);

      if (!sub) {
        res.status(404).json({ ok: false, error: "Submission not found" });
        return;
      }

      // Status precondition
      if (sub.status !== REQUIRED_STATUS[step]) {
        res.status(409).json({
          ok:    false,
          error: `Submission is '${sub.status}' — cannot approve at ${step} step`,
        });
        return;
      }

      // Region scope (RH only): validate against live user.region from session,
      // not any region field supplied in the body
      if (step === "RH" && sub.region !== user.region) {
        res.status(403).json({
          ok:    false,
          error: `This submission is for region '${sub.region}' — you manage '${user.region}'`,
        });
        return;
      }

      const { note } = (req.body ?? {}) as { note?: string };
      const logEntry  = approvalLogEntry(step, user, "approved", note);
      const newLog    = [...(sub.approvalLog as object[]), logEntry];
      const nextStat  = NEXT_STATUS[step];

      // CRO step: freeze quota — written exactly once, never overwritten
      const extraFields =
        step === "CRO"
          ? { frozenQuota: sub.totalTarget, updatedAt: new Date() }
          : { updatedAt: new Date() };

      const [updated] = await db
        .update(targetSubmissions)
        .set({ status: nextStat, approvalLog: newLog, ...extraFields })
        .where(eq(targetSubmissions.id, sub.id))
        .returning();

      res.json({ ok: true, submission: updated });
    } catch (err) {
      req.log.error({ err }, `POST /targets/:id/approve/${step.toLowerCase()} error`);
      res.status(500).json({ ok: false, error: "Approval failed" });
    }
  };
}

// ─── POST /api/targets/:id/approve/rh ────────────────────────────────────────
router.post("/targets/:id/approve/rh",       requireAuth, makeApprovalRoute("RH"));

// ─── POST /api/targets/:id/approve/nsh ───────────────────────────────────────
router.post("/targets/:id/approve/nsh",      requireAuth, makeApprovalRoute("NSH"));

// ─── POST /api/targets/:id/approve/strategy ──────────────────────────────────
router.post("/targets/:id/approve/strategy", requireAuth, makeApprovalRoute("Strategy"));

// ─── POST /api/targets/:id/approve/cro ───────────────────────────────────────
router.post("/targets/:id/approve/cro",      requireAuth, makeApprovalRoute("CRO"));

// ─── POST /api/targets/:id/reject ────────────────────────────────────────────
// Any approver whose step is the current pending step may reject.
// ADMIN may reject at any pending step.
// Body: { reason: string } — required.
router.post("/targets/:id/reject", requireAuth, async (req, res) => {
  const user = req.user!;

  const PENDING_ROLE: Record<string, string> = {
    "Pending RH":       "REGION HEAD",
    "Pending NSH":      "SALES HEAD",
    "Pending Strategy": "SALES STRATEGY",
    "Pending CRO":      "CRO",
  };

  const { reason } = (req.body ?? {}) as { reason?: string };

  if (!reason?.trim()) {
    res.status(400).json({ ok: false, error: "reason is required for rejection" });
    return;
  }

  try {
    const sub = await fetchSub(req.params.id);

    if (!sub) {
      res.status(404).json({ ok: false, error: "Submission not found" });
      return;
    }

    if (sub.status === "Approved") {
      res.status(409).json({ ok: false, error: "Approved submissions cannot be rejected" });
      return;
    }
    if (sub.status === "Rejected") {
      res.status(409).json({ ok: false, error: "Already rejected" });
      return;
    }

    // Determine authorization: role must match the current pending step,
    // plus region scope for RH
    const requiredRole = PENDING_ROLE[sub.status];
    const isAuthorised =
      user.role === "ADMIN" ||
      (requiredRole && user.role === requiredRole &&
        (user.role !== "REGION HEAD" || sub.region === user.region));

    if (!isAuthorised) {
      res.status(403).json({
        ok:    false,
        error: `Submission is '${sub.status}' — only ${requiredRole || "admin"} can reject at this step`,
      });
      return;
    }

    const stepLabel = sub.status.replace("Pending ", "");
    const logEntry  = approvalLogEntry(stepLabel, user, "rejected", reason);
    const newLog    = [...(sub.approvalLog as object[]), logEntry];

    const [updated] = await db
      .update(targetSubmissions)
      .set({ status: "Rejected", approvalLog: newLog, updatedAt: new Date() })
      .where(eq(targetSubmissions.id, sub.id))
      .returning();

    res.json({ ok: true, submission: updated });
  } catch (err) {
    req.log.error({ err }, "POST /targets/:id/reject error");
    res.status(500).json({ ok: false, error: "Rejection failed" });
  }
});

// ─── POST /api/targets/:id/add-opportunity ───────────────────────────────────
// Creates an Additional Revenue Opportunity — a separate revenue object,
// never mixed with the official frozen quota.
//
// Rules:
//   • Parent must be Approved with frozen_quota set
//   • Caller must be the rep who owns the submission (repUserId === user.id)
//     OR the REGION HEAD of the same region
//   • Does NOT touch the parent's frozen_quota — ever
//   • New submission: is_additional_rev_op=true, status=Approved (auto), no frozen_quota
router.post("/targets/:id/add-opportunity", requireAuth, async (req, res) => {
  const user = req.user!;

  if (!["SALES REP", "REGION HEAD"].includes(user.role)) {
    res.status(403).json({ ok: false, error: "Only Sales Reps and Region Heads can add revenue opportunities" });
    return;
  }

  const { clients, note } = (req.body ?? {}) as {
    clients?: Array<{ clientName: string; dealType: string; targetAmount: number; notes?: string }>;
    note?:    string;
  };

  if (!Array.isArray(clients) || clients.length === 0) {
    res.status(400).json({ ok: false, error: "clients must be a non-empty array" });
    return;
  }

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    if (!c.clientName?.trim()) {
      res.status(400).json({ ok: false, error: `clients[${i}].clientName is required` });
      return;
    }
    if (!c.dealType?.trim()) {
      res.status(400).json({ ok: false, error: `clients[${i}].dealType is required` });
      return;
    }
    const amt = Number(c.targetAmount);
    if (!Number.isInteger(amt) || amt <= 0) {
      res.status(400).json({ ok: false, error: `clients[${i}].targetAmount must be a positive integer (rupees)` });
      return;
    }
  }

  try {
    const parent = await fetchSub(req.params.id);

    if (!parent) {
      res.status(404).json({ ok: false, error: "Parent submission not found" });
      return;
    }

    if (parent.status !== "Approved") {
      res.status(409).json({
        ok:    false,
        error: `Parent submission is '${parent.status}' — must be Approved before adding opportunities`,
      });
      return;
    }

    if (parent.frozenQuota == null) {
      res.status(409).json({
        ok:    false,
        error: "Parent submission has no frozen quota — contact admin",
      });
      return;
    }

    // Scope: owner (by repUserId UUID, not legacy repId) or RH of same region
    const isOwner       = parent.repUserId === user.id;
    const isRHForRegion = user.role === "REGION HEAD" && user.region === parent.region;

    if (!isOwner && !isRHForRegion) {
      res.status(403).json({ ok: false, error: "You can only add opportunities to your own submissions" });
      return;
    }

    const totalTarget = clients.reduce((s, c) => s + Number(c.targetAmount), 0);

    const autoLog = [
      approvalLogEntry(
        "Auto-approved",
        user,
        "approved",
        note ?? "Additional Revenue Opportunity — auto-approved; frozen quota is unchanged",
      ),
    ];

    const [newSub] = await db
      .insert(targetSubmissions)
      .values({
        // ── Identity ──────────────────────────────────────────────────────
        repUserId:          parent.repUserId,       // same owner UUID as parent
        submittedByUserId:  user.id,
        submittedByRole:    user.role,

        // ── Denormalized convenience ──────────────────────────────────────
        repName:            parent.repName,
        region:             parent.region,

        // ── Transitional compat ───────────────────────────────────────────
        repId:              parent.repId ?? null,

        // ── Scope ─────────────────────────────────────────────────────────
        quarter:            parent.quarter,
        fiscalYear:         parent.fiscalYear,

        // ── Financials ────────────────────────────────────────────────────
        totalTarget,
        frozenQuota:        null,           // add-opportunity NEVER freezes quota
        isAdditionalRevOp:  true,
        parentSubmissionId: parent.id,
        approvalLog:        autoLog,
      })
      .returning();

    const clientRows = await db
      .insert(targetClients)
      .values(
        clients.map(c => ({
          submissionId:  newSub.id,
          clientName:    c.clientName.trim(),
          dealType:      c.dealType.trim(),
          targetAmount:  Number(c.targetAmount),
          notes:         c.notes?.trim() ?? null,
        }))
      )
      .returning();

    // Echo parentFrozenQuota back so callers can verify it was not touched
    res.status(201).json({
      ok:                true,
      submission:        newSub,
      clients:           clientRows,
      parentFrozenQuota: parent.frozenQuota,
    });
  } catch (err) {
    req.log.error({ err }, "POST /targets/:id/add-opportunity error");
    res.status(500).json({ ok: false, error: "Failed to add opportunity" });
  }
});

export default router;
