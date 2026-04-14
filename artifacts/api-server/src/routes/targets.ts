import { Router } from "express";
import { db, targetSubmissions, targetAllocations, TARGET_APPROVAL_CHAIN, TARGET_NEXT_STATUS } from "@workspace/db";
import type { ClientAllocation } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activityLog";
import { createNotification } from "../lib/notifications";

// ─── Client allocation helpers ────────────────────────────────────────────────

/**
 * Validates that a clients array conforms to the ClientAllocation structure.
 * Returns a list of error strings (empty = valid).
 */
function validateClientAllocations(clients: unknown[]): string[] {
  const errors: string[] = [];
  clients.forEach((c: any, i) => {
    if (!c || typeof c !== "object") {
      errors.push(`clients[${i}]: must be an object`);
      return;
    }
    if (!c.clientName || typeof c.clientName !== "string") {
      errors.push(`clients[${i}]: clientName is required and must be a string`);
    }
    if (c.allocatedAmount === undefined || typeof c.allocatedAmount !== "number" || c.allocatedAmount < 0) {
      errors.push(`clients[${i}]: allocatedAmount is required and must be a non-negative number`);
    }
  });
  return errors;
}

/**
 * Cross-checks that the sum of client allocations equals the declared totalTarget.
 * Returns null if ok, or an error string.
 */
function crossCheckTotal(clients: ClientAllocation[], totalTarget: number): string | null {
  const sum = clients.reduce((acc, c) => acc + (c.allocatedAmount ?? 0), 0);
  // Allow ±1 rounding tolerance
  if (Math.abs(sum - totalTarget) > 1) {
    return `Sum of client allocations (${sum}) does not match totalTarget (${totalTarget}). Please reconcile.`;
  }
  return null;
}

const router = Router();

// ─── Role constants ───────────────────────────────────────────────────────────
// ALL role names must match the canonical set in users.role:
//   "SALES REP" | "REGION HEAD" | "SALES HEAD" | "SALES STRATEGY" | "CRO" | "ADMIN" | "DIGI OPS"
// "NATIONAL SALES HEAD" is NOT a valid role — use "SALES HEAD".

/**
 * Hierarchy-aware approval check.
 * Role must match the expected approver for the current status,
 * AND for REGION HEAD specifically, the submission must be in their region.
 */
function canApprove(user: {
  role:    string;
  region?: string | null;
}, sub: {
  status:  string | null;
  region?: string | null;
  repId:   number;
}): { ok: boolean; reason?: string } {
  if (user.role === "ADMIN") return { ok: true };

  const required = TARGET_APPROVAL_CHAIN[sub.status ?? ""];
  if (!required) return { ok: false, reason: `No approver defined for status "${sub.status}"` };
  if (required !== user.role) {
    return { ok: false, reason: `Your role (${user.role}) cannot approve at status "${sub.status}" — expected ${required}` };
  }

  // ── Hierarchy check: REGION HEAD may only approve reps in their own region ──
  if (user.role === "REGION HEAD") {
    if (!sub.region || sub.region !== user.region) {
      return { ok: false, reason: `You can only approve target submissions for your region (${user.region ?? "unset"})` };
    }
  }

  return { ok: true };
}

function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP")    return eq(targetSubmissions.repId, user.repId!);
  if (role === "REGION HEAD")  return eq(targetSubmissions.region, user.region!);
  return undefined; // SALES HEAD, CRO, SALES STRATEGY, ADMIN see all
}

// GET /api/targets — list (scoped by role)
router.get("/targets", requireAuth, async (req, res) => {
  try {
    const cond = scopeCondition(req.user!);
    const rows = cond
      ? await db.select().from(targetSubmissions).where(cond).orderBy(desc(targetSubmissions.createdAt))
      : await db.select().from(targetSubmissions).orderBy(desc(targetSubmissions.createdAt));
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// GET /api/targets/:id — single submission
router.get("/targets/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// GET /api/targets/:id/allocations — fetch normalized line items for a submission
router.get("/targets/:id/allocations", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(targetAllocations)
      .where(eq(targetAllocations.submissionId, String(req.params["id"])))
      .orderBy(targetAllocations.clientName);

    const total = rows.reduce((acc, r) => acc + (r.allocatedAmount ?? 0), 0);

    res.json({ ok: true, data: rows, total });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// POST /api/targets — submit new target plan
// Supports two payload shapes:
//   Annual (new):  { id, year, clients: [{ agencyName, clientName, brandName, q1Target, q2Target, q3Target, q4Target }] }
//   Quarterly (legacy): { id, quarter, clients: [{ clientName, allocatedAmount, ... }], totalTarget }
router.post("/targets", requireAuth, async (req, res) => {
  try {
    const u = req.user!;

    // ── Detect annual vs legacy quarterly payload ─────────────────────────────
    const isAnnual = req.body.year !== undefined || req.body.q1Target !== undefined;

    // ── Never trust client-supplied ownership for SALES REP ──────────────────
    const authorRepId  = u.role === "SALES REP" ? u.repId!   : (req.body.repId   ?? u.repId ?? 0);
    const authorRegion = u.role === "SALES REP" ? u.region!  : (req.body.region  ?? u.region ?? "");
    const authorName   = u.role === "SALES REP" ? u.name     : (req.body.repName ?? u.name);

    if (isAnnual) {
      // ── Annual schema ───────────────────────────────────────────────────────
      const { id, year } = req.body;
      if (!id || !year) return void res.status(400).json({ ok: false, error: "id and year required" });

      // clients array: each entry has agencyName, clientName, brandName, q1Target..q4Target
      const rawClients: any[] = Array.isArray(req.body.clients) ? req.body.clients : [];
      if (!rawClients.length) {
        return void res.status(400).json({ ok: false, error: "At least one client entry required" });
      }

      const annualClients = rawClients.map((c: any) => ({
        agencyName:   c.agencyName  ?? null,
        clientName:   c.clientName  ?? null,
        brandName:    c.brandName   ?? null,
        q1Target:     Number(c.q1Target ?? 0),
        q2Target:     Number(c.q2Target ?? 0),
        q3Target:     Number(c.q3Target ?? 0),
        q4Target:     Number(c.q4Target ?? 0),
        annualTarget: Number(c.q1Target ?? 0) + Number(c.q2Target ?? 0) +
                      Number(c.q3Target ?? 0) + Number(c.q4Target ?? 0),
      }));

      const totalAnnual = annualClients.reduce((s, c) => s + c.annualTarget, 0);
      const annualQuarter = `Annual-${year}`;

      // Idempotency: one active annual submission per rep per year
      const existing = await db
        .select({ id: targetSubmissions.id, status: targetSubmissions.status })
        .from(targetSubmissions)
        .where(and(eq(targetSubmissions.repId, authorRepId), eq(targetSubmissions.quarter, annualQuarter)))
        .limit(10);

      const activeExisting = existing.filter((r) => !["Rejected"].includes(r.status ?? ""));
      if (activeExisting.length > 0) {
        return void res.status(409).json({
          ok: false,
          error: `An active annual target submission already exists for ${year} (id: ${activeExisting[0].id}, status: ${activeExisting[0].status}). Edit or withdraw it first.`,
          existingId: activeExisting[0].id,
        });
      }

      // Monthly totals: prefer spread values from payload (sent by both SetupWizardView
      // and PlanUploadModal as top-level fields); fall back to 0.
      const monthlyFromBody = (key: string) => Math.round(Number(req.body[key] ?? 0) || 0);

      // totalTarget: use annualClients-derived sum when non-zero; otherwise fall back to
      // payload totalTarget (handles SetupWizardView which sends clientCompany/targetAmount
      // instead of clientName/q1-q4Target, making annualClients sum = 0).
      const effectiveTotal = totalAnnual > 0
        ? Math.round(totalAnnual)
        : Math.round(Number(req.body.totalTarget ?? 0) || 0);

      const now = new Date().toISOString();
      const row = await db
        .insert(targetSubmissions)
        .values({
          id,
          repId:           authorRepId,
          repName:         authorName,
          region:          authorRegion,
          quarter:         annualQuarter,
          clients:         annualClients as any[],
          totalTarget:     effectiveTotal,
          status:          "Pending RH",
          submittedAt:     now,
          submittedByName: u.name,
          submittedByRole: u.role,
          approvalLog:     [],
          // ── Monthly breakdown columns (Indian FY: April–March) ──────────────
          april:     String(monthlyFromBody("april")),
          may:       String(monthlyFromBody("may")),
          june:      String(monthlyFromBody("june")),
          july:      String(monthlyFromBody("july")),
          august:    String(monthlyFromBody("august")),
          september: String(monthlyFromBody("september")),
          october:   String(monthlyFromBody("october")),
          november:  String(monthlyFromBody("november")),
          december:  String(monthlyFromBody("december")),
          january:   String(monthlyFromBody("january")),
          february:  String(monthlyFromBody("february")),
          march:     String(monthlyFromBody("march")),
        })
        .onConflictDoNothing()
        .returning();

      void logActivity({
        userId:     u.id,
        userName:   u.name,
        userRole:   u.role,
        region:     authorRegion,
        action:     "target.submitted",
        entityType: "target_submission",
        entityId:   id,
        meta:       { year, totalAnnual, clientCount: annualClients.length },
      });

      return void res.status(201).json({ ok: true, data: row[0], annualTotal: totalAnnual });
    }

    // ── Legacy quarterly schema ───────────────────────────────────────────────
    const { id, quarter, clients, totalTarget } = req.body;
    if (!id || !quarter) return void res.status(400).json({ ok: false, error: "id and quarter required" });

    const clientList: ClientAllocation[] = Array.isArray(clients) ? clients : [];
    if (clientList.length > 0) {
      const structureErrors = validateClientAllocations(clientList);
      if (structureErrors.length > 0) {
        return void res.status(400).json({ ok: false, error: "Invalid client allocations", details: structureErrors });
      }
      if (totalTarget !== undefined && totalTarget !== null) {
        const mismatch = crossCheckTotal(clientList, Number(totalTarget));
        if (mismatch) return void res.status(400).json({ ok: false, error: mismatch });
      }
    }

    const existing = await db
      .select({ id: targetSubmissions.id, status: targetSubmissions.status })
      .from(targetSubmissions)
      .where(and(eq(targetSubmissions.repId, authorRepId), eq(targetSubmissions.quarter, quarter)))
      .limit(10);

    const activeExisting = existing.filter((r) => !["Rejected"].includes(r.status ?? ""));
    if (activeExisting.length > 0) {
      return void res.status(409).json({
        ok: false,
        error: `An active target submission already exists for ${quarter} (id: ${activeExisting[0].id}, status: ${activeExisting[0].status}). Edit or withdraw it first.`,
        existingId: activeExisting[0].id,
      });
    }

    const now = new Date().toISOString();
    const row = await db
      .insert(targetSubmissions)
      .values({
        id,
        repId:           authorRepId,
        repName:         authorName,
        region:          authorRegion,
        quarter,
        clients:         clientList,
        totalTarget:     totalTarget ?? 0,
        status:          "Pending RH",
        submittedAt:     now,
        submittedByName: u.name,
        submittedByRole: u.role,
        approvalLog:     [],
      })
      .onConflictDoNothing()
      .returning();

    if (clientList.length > 0) {
      const allocationRows = clientList.map((c, i) => ({
        id:              `${id}_alloc_${i}`,
        submissionId:    id,
        repId:           authorRepId,
        region:          authorRegion,
        quarter,
        clientName:      c.clientName,
        allocatedAmount: Math.round(c.allocatedAmount),
        channel:         c.channel ?? null,
        dealType:        c.dealType ?? null,
        notes:           c.notes ?? null,
      }));
      await db.insert(targetAllocations).values(allocationRows).onConflictDoNothing();
    }

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      region:     authorRegion,
      action:     "target.submitted",
      entityType: "target_submission",
      entityId:   id,
      meta:       { quarter, totalTarget: totalTarget ?? 0 },
    });

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// POST /api/targets/:id/approve
router.post("/targets/:id/approve", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    const check = canApprove(u, sub);
    if (!check.ok) {
      return void res.status(403).json({ ok: false, error: check.reason });
    }

    const nextStatus = TARGET_NEXT_STATUS[sub.status!] ?? "Approved";
    const now = new Date().toISOString();
    const logEntry = { step: sub.status, by: u.name, role: u.role, at: now, action: "Approved", note: req.body.note ?? "" };
    const newLog = [...((sub.approvalLog as any[]) ?? []), logEntry];

    const updated = await db
      .update(targetSubmissions)
      .set({
        status:       nextStatus,
        approvalLog:  newLog,
        frozenTarget: nextStatus === "Approved" ? sub.totalTarget : sub.frozenTarget,
        updatedAt:    new Date(),
      })
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "target.approved",
      entityType: "target_submission",
      entityId:   sub.id,
      meta:       { fromStatus: sub.status, toStatus: nextStatus },
    });

    // Notify rep that their target moved forward
    if (sub.repId) {
      // Look up rep user id from repId
      void (async () => {
        try {
          const { users: usersTable } = await import("@workspace/db");
          const repUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.repId, sub.repId)).limit(1);
          if (repUsers.length) {
            void createNotification({
              userId:     repUsers[0].id,
              type:       "target_approved",
              title:      nextStatus === "Approved" ? "Target plan fully approved!" : `Target plan advanced to ${nextStatus}`,
              body:       `${u.name} (${u.role}) approved your ${sub.quarter} target plan.`,
              entityType: "target_submission",
              entityId:   sub.id,
            });
          }
        } catch { /* best-effort */ }
      })();
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// POST /api/targets/:id/reject
router.post("/targets/:id/reject", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    const check = canApprove(u, sub);
    if (!check.ok) {
      return void res.status(403).json({ ok: false, error: check.reason });
    }

    const now = new Date().toISOString();
    const logEntry = { step: sub.status, by: u.name, role: u.role, at: now, action: "Rejected", note: req.body.note ?? "" };
    const newLog = [...((sub.approvalLog as any[]) ?? []), logEntry];

    const updated = await db
      .update(targetSubmissions)
      .set({ status: "Rejected", approvalLog: newLog, updatedAt: new Date() })
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .returning();

    void logActivity({
      userId:     u.id,
      userName:   u.name,
      userRole:   u.role,
      action:     "target.rejected",
      entityType: "target_submission",
      entityId:   sub.id,
      meta:       { fromStatus: sub.status, note: req.body.note ?? "" },
    });

    // Notify rep
    if (sub.repId) {
      void (async () => {
        try {
          const { users: usersTable } = await import("@workspace/db");
          const repUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.repId, sub.repId)).limit(1);
          if (repUsers.length) {
            void createNotification({
              userId:     repUsers[0].id,
              type:       "target_rejected",
              title:      `Target plan rejected by ${u.name}`,
              body:       req.body.note ? `Reason: ${req.body.note}` : undefined,
              entityType: "target_submission",
              entityId:   sub.id,
            });
          }
        } catch { /* best-effort */ }
      })();
    }

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// PATCH /api/targets/:id — allow rep to update a rejected/draft submission before re-submitting
router.patch("/targets/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    if (u.role === "SALES REP" && sub.repId !== u.repId) {
      return void res.status(403).json({ ok: false, error: "Cannot edit another rep's submission" });
    }
    if (!["Rejected", "Pending RH"].includes(sub.status!)) {
      return void res.status(400).json({ ok: false, error: "Cannot edit a submission already in the approval chain" });
    }

    const { clients, totalTarget, quarter } = req.body;
    const updated = await db
      .update(targetSubmissions)
      .set({
        ...(clients     !== undefined && { clients }),
        ...(totalTarget !== undefined && { totalTarget }),
        ...(quarter     !== undefined && { quarter }),
        status:    "Pending RH",
        updatedAt: new Date(),
      })
      .where(eq(targetSubmissions.id, String(req.params["id"])))
      .returning();

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

export default router;
