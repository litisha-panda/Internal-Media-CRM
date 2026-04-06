import { Router } from "express";
import { db, targetSubmissions } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const APPROVAL_CHAIN: Record<string, string> = {
  "Pending RH":       "REGION HEAD",
  "Pending NSH":      "NATIONAL SALES HEAD",
  "Pending Strategy": "SALES STRATEGY",
  "Pending CRO":      "CRO",
};

const NEXT_STATUS: Record<string, string> = {
  "Pending RH":       "Pending NSH",
  "Pending NSH":      "Pending Strategy",
  "Pending Strategy": "Pending CRO",
  "Pending CRO":      "Approved",
};

function canApprove(role: string, status: string): boolean {
  return APPROVAL_CHAIN[status] === role || role === "ADMIN";
}

function scopeCondition(user: any) {
  const role = user.role;
  if (role === "SALES REP") return eq(targetSubmissions.repId, user.repId!);
  if (role === "REGION HEAD") return eq(targetSubmissions.region, user.region!);
  return undefined;
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
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/targets/:id — single submission
router.get("/targets/:id", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, req.params.id))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/targets — submit new target plan
router.post("/targets", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { id, repId, repName, region, quarter, clients, totalTarget } = req.body;
    if (!id || !quarter) return void res.status(400).json({ ok: false, error: "id and quarter required" });

    const now = new Date().toISOString();
    const row = await db
      .insert(targetSubmissions)
      .values({
        id,
        repId:           repId  ?? u.repId ?? 0,
        repName:         repName ?? u.name,
        region:          region ?? u.region ?? "",
        quarter,
        clients:         clients ?? [],
        totalTarget:     totalTarget ?? 0,
        status:          "Pending RH",
        submittedAt:     now,
        submittedByName: u.name,
        submittedByRole: u.role,
        approvalLog:     [],
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ ok: true, data: row[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/targets/:id/approve
router.post("/targets/:id/approve", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, req.params.id))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    if (!canApprove(u.role, sub.status!)) {
      return void res.status(403).json({ ok: false, error: `Your role (${u.role}) cannot approve at status "${sub.status}"` });
    }

    const nextStatus = NEXT_STATUS[sub.status!] ?? "Approved";
    const now = new Date().toISOString();
    const logEntry = { step: sub.status, by: u.name, role: u.role, at: now, note: req.body.note ?? "" };
    const newLog = [...((sub.approvalLog as any[]) ?? []), logEntry];

    const updated = await db
      .update(targetSubmissions)
      .set({
        status:       nextStatus,
        approvalLog:  newLog,
        frozenTarget: nextStatus === "Approved" ? sub.totalTarget : sub.frozenTarget,
        updatedAt:    new Date(),
      })
      .where(eq(targetSubmissions.id, req.params.id))
      .returning();

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/targets/:id/reject
router.post("/targets/:id/reject", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, req.params.id))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    if (!canApprove(u.role, sub.status!)) {
      return void res.status(403).json({ ok: false, error: `Your role cannot reject at status "${sub.status}"` });
    }

    const now = new Date().toISOString();
    const logEntry = { step: sub.status, by: u.name, role: u.role, at: now, action: "Rejected", note: req.body.note ?? "" };
    const newLog = [...((sub.approvalLog as any[]) ?? []), logEntry];

    const updated = await db
      .update(targetSubmissions)
      .set({ status: "Rejected", approvalLog: newLog, updatedAt: new Date() })
      .where(eq(targetSubmissions.id, req.params.id))
      .returning();

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/targets/:id — allow rep to update a rejected/draft submission before re-submitting
router.patch("/targets/:id", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const rows = await db
      .select()
      .from(targetSubmissions)
      .where(eq(targetSubmissions.id, req.params.id))
      .limit(1);
    if (!rows.length) return void res.status(404).json({ ok: false, error: "Not found" });

    const sub = rows[0];
    // Only the owning rep (or ADMIN) can edit a rejected/draft submission
    if (u.role === "SALES REP" && sub.repId !== u.repId) {
      return void res.status(403).json({ ok: false, error: "Cannot edit another rep's submission" });
    }
    if (!["Rejected", "Pending RH"].includes(sub.status!)) {
      return void res.status(400).json({ ok: false, error: "Cannot edit a submission that is already in approval chain" });
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
      .where(eq(targetSubmissions.id, req.params.id))
      .returning();

    res.json({ ok: true, data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
