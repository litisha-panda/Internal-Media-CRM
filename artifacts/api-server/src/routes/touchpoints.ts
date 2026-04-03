import { Router }    from "express";
import { randomUUID } from "crypto";
import { db }        from "@workspace/db";
import {
  touchpoints, clientAccounts, deals, revenueEntries, appStateTable,
  tasks, internalRequests, plans,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// Canonical touchpoint types — backend validation source of truth.
// "Relationship" is accepted as a legacy alias for "Relationship Touchpoint".
const TOUCHPOINT_TYPES = [
  "Deal Meeting",
  "Relationship Touchpoint",
  "Cold Call",
  "Email/WhatsApp",
  "RO Follow-up",
] as const;
type TpType = (typeof TOUCHPOINT_TYPES)[number];

const MEETING_TYPES = ["Physical", "Online", "Phone Call"] as const;

// Only Deal Meeting touchpoints may include a stageUpdate.
const DEAL_MEETING_TYPE: TpType = "Deal Meeting";

// Action item types (from frontend ACTION_TYPES constant — exact strings)
const ACTION_TYPES = [
  "Approval needed",
  "Document needed",
  "Attend a meeting",
  "Introduction needed",
  "Flag for follow-up",
] as const;

// Stage constants (mirrors deals.ts — inlined to avoid circular imports)
const DEAL_STAGES = [
  "Prospect", "In Discussion", "Negotiation",
  "Mail Confirmed", "RO Received", "Lost",
] as const;
type Stage = (typeof DEAL_STAGES)[number];
const STAGE_RANK: Record<Stage, number> = {
  "Prospect": 0, "In Discussion": 1, "Negotiation": 2,
  "Mail Confirmed": 3, "RO Received": 4, "Lost": 5,
};
const TERMINAL: Set<Stage> = new Set(["Lost", "RO Received"]);

// Roles that see all data across regions
const GLOBAL_VIEW_ROLES = new Set([
  "SALES HEAD", "SALES STRATEGY", "CRO", "ADMIN", "DIGI OPS", "NSH",
]);

// Minimum touchpoints per rep per calendar month before Trigger 2B fires
const MIN_MONTHLY_TOUCHPOINTS = 15;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isValidStage(s: string): s is Stage {
  return (DEAL_STAGES as readonly string[]).includes(s);
}

function isValidTpType(s: string): s is TpType {
  return (TOUCHPOINT_TYPES as readonly string[]).includes(s)
    || s === "Relationship"; // legacy alias
}

function normalizeTpType(s: string): TpType {
  if (s === "Relationship") return "Relationship Touchpoint";
  return s as TpType;
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const then = new Date(dateStr).getTime();
  const now  = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Validate a stage transition server-side (same logic as deals.ts and client-accounts.ts).
function validateStageTransition(
  current: string,
  newStage: string,
  isAdmin: boolean,
  lossReason?: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!isValidStage(newStage)) {
    return { ok: false, status: 400, error: `stage must be one of: ${DEAL_STAGES.join(", ")}` };
  }
  const cur = current as Stage;
  const nxt = newStage as Stage;

  if (TERMINAL.has(cur)) {
    return { ok: false, status: 409, error: `Stage is '${cur}' — terminal stages cannot be changed` };
  }
  if (cur === nxt) {
    return { ok: false, status: 409, error: `Deal is already at stage '${nxt}'` };
  }
  if (nxt === "Lost" && !lossReason?.trim()) {
    return { ok: false, status: 400, error: "lossReason is required when setting stage to 'Lost'" };
  }
  if (!isAdmin) {
    if (nxt === "Lost") {
      // always allowed from non-terminal
    } else if (STAGE_RANK[nxt] !== STAGE_RANK[cur] + 1) {
      const direction = STAGE_RANK[nxt] < STAGE_RANK[cur] ? "backward" : "skip";
      return {
        ok: false, status: 409,
        error: direction === "backward"
          ? `Cannot move backward from '${cur}' to '${nxt}' — only Admin can regress stage`
          : `Cannot skip from '${cur}' to '${nxt}' — advance one stage at a time`,
      };
    }
  }
  return { ok: true };
}

// Read a value from app_state (bridge to localStorage for Phase 6 routing)
async function readAppState(key: string): Promise<any[]> {
  const rows = await db.select().from(appStateTable).where(eq(appStateTable.key, key)).limit(1);
  if (!rows[0]) return [];
  const val = rows[0].value;
  return Array.isArray(val) ? val : [];
}


// ─── POST /api/touchpoints ───────────────────────────────────────────────────
// Create an append-only touchpoint log entry.
//
// Critical side-effects (all atomic within the handler):
//   1. If touchpointType = "Deal Meeting":
//        a. client_account.last_deal_meeting_date = touchpoint.date
//        b. client_account.last_contact_date      = touchpoint.date
//      Otherwise:
//        a. client_account.last_contact_date = touchpoint.date (only)
//        b. last_deal_meeting_date is NEVER reset by non-deal-meeting touchpoints
//
//   2. If stageUpdate is provided (Deal Meeting only):
//        Applies controlled stage transition to the linked deal.
//        Same rules as PATCH /api/deals/:id/stage.
//        Non-deal-meeting touchpoints may NOT carry a stageUpdate.
//
//   3. Action items are routed server-side:
//        "Approval needed"     → internal_requests table
//        "Attend a meeting"    → plans table (Phase 8 Step 4)
//        "Document needed"     → tasks table
//        "Introduction needed" → tasks table
//        "Flag for follow-up"  → tasks table
router.post("/touchpoints", requireAuth, async (req, res) => {
  const user = req.user!;
  const now  = new Date();

  const {
    clientAccountId,
    dealId,
    touchpointType:   rawTpType,
    meetingType,
    date:             tpDate,
    time:             tpTime,
    contactName,
    contactDesignation,
    contactLevel,
    whatHappened,
    clientFeedback,
    stageUpdate:      rawStageUpdate,
    lossReason,
    actionItems:      rawActionItems,
    loggedAt,
    loggedLate,
  } = (req.body ?? {}) as {
    clientAccountId?:    string;
    dealId?:             string;
    touchpointType?:     string;
    meetingType?:        string;
    date?:               string;
    time?:               string;
    contactName?:        string;
    contactDesignation?: string;
    contactLevel?:       string;
    whatHappened?:       string;
    clientFeedback?:     string;
    stageUpdate?:        string;
    lossReason?:         string;
    actionItems?:        any[];
    loggedAt?:           string;
    loggedLate?:         boolean;
  };

  // ── Required field validation ─────────────────────────────────────────────
  if (!clientAccountId?.trim()) {
    res.status(400).json({ ok: false, error: "clientAccountId is required" });
    return;
  }
  if (!rawTpType?.trim() || !isValidTpType(rawTpType)) {
    res.status(400).json({
      ok: false,
      error: `touchpointType must be one of: ${TOUCHPOINT_TYPES.join(", ")} (or 'Relationship' as alias)`,
    });
    return;
  }
  if (!tpDate || !/^\d{4}-\d{2}-\d{2}$/.test(tpDate)) {
    res.status(400).json({ ok: false, error: "date is required (ISO YYYY-MM-DD)" });
    return;
  }
  if (!whatHappened?.trim()) {
    res.status(400).json({ ok: false, error: "whatHappened is required" });
    return;
  }

  const tpType = normalizeTpType(rawTpType);
  const isDealMeeting = tpType === DEAL_MEETING_TYPE;

  // ── Deal Meeting specific validation ──────────────────────────────────────
  if (isDealMeeting) {
    if (!dealId?.trim()) {
      res.status(400).json({ ok: false, error: "dealId is required for Deal Meeting touchpoints" });
      return;
    }
    if (!rawStageUpdate?.trim()) {
      res.status(400).json({ ok: false, error: "stageUpdate is required for Deal Meeting touchpoints" });
      return;
    }
  }

  // ── Non-deal-meeting cannot carry a stageUpdate ───────────────────────────
  if (!isDealMeeting && rawStageUpdate?.trim()) {
    res.status(400).json({
      ok: false,
      error: `stageUpdate is only valid for Deal Meeting touchpoints (this is '${tpType}')`,
    });
    return;
  }

  try {
    // ── Verify client account exists and is accessible ────────────────────
    const acctRows = await db.select().from(clientAccounts)
      .where(eq(clientAccounts.id, clientAccountId)).limit(1);
    const acct = acctRows[0] ?? null;
    if (!acct) {
      res.status(404).json({ ok: false, error: "Client account not found" });
      return;
    }

    // Access check — same scoping rules as client-accounts route
    const isGlobal = GLOBAL_VIEW_ROLES.has(user.role);
    const isRH     = user.role === "REGION HEAD";
    const isRep    = user.role === "SALES REP";
    if (!isGlobal) {
      if (isRH   && acct.region    !== user.region) {
        res.status(403).json({ ok: false, error: "Access denied" });
        return;
      }
      if (isRep  && acct.repUserId !== user.id) {
        res.status(403).json({ ok: false, error: "Access denied" });
        return;
      }
    }

    // ── Verify deal if provided ───────────────────────────────────────────
    let dealRow: (typeof deals.$inferSelect) | null = null;
    if (dealId) {
      const dealRows = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
      dealRow = dealRows[0] ?? null;
      if (!dealRow) {
        res.status(404).json({ ok: false, error: "Deal not found" });
        return;
      }
      if (dealRow.clientAccountId !== clientAccountId) {
        res.status(400).json({ ok: false, error: "dealId does not belong to the specified clientAccountId" });
        return;
      }
    }

    // ── Stage transition validation (Deal Meeting only) ────────────────────
    let stageUpdate: string | null = null;
    if (isDealMeeting && rawStageUpdate?.trim()) {
      if (!dealRow) {
        res.status(400).json({ ok: false, error: "dealId is required to apply a stageUpdate" });
        return;
      }
      const check = validateStageTransition(
        dealRow.stage,
        rawStageUpdate.trim(),
        user.role === "ADMIN",
        lossReason,
      );
      if (!check.ok) {
        res.status(check.status).json({ ok: false, error: check.error });
        return;
      }

      // RO Received requires a linked revenue entry
      if (rawStageUpdate.trim() === "RO Received") {
        const linked = await db.select().from(revenueEntries)
          .where(eq(revenueEntries.dealId, dealRow.id));
        const net = linked.reduce((s, e) => s + (e.amount ?? 0), 0);
        if (net <= 0) {
          res.status(409).json({
            ok: false,
            error: "Stage 'RO Received' requires at least one revenue entry linked to this deal.",
          });
          return;
        }
      }
      stageUpdate = rawStageUpdate.trim();
    }

    // ── Route action items server-side ────────────────────────────────────
    // Phase 7: tasks and internal_requests route to real PostgreSQL tables.
    //
    // Routing rules (server-enforced, not derived from frontend assumptions):
    //   "Approval needed"     → internal_requests table (IR)
    //   "Attend a meeting"    → plans table (Phase 8 Step 4)
    //   "Document needed"     → tasks table
    //   "Introduction needed" → tasks table
    //   "Flag for follow-up"  → tasks table (self-assigned; no IR)
    //
    // Note: touchpointId is pre-generated so tasks/IRs can reference it before insert.
    const tpId = randomUUID();
    const routedActionItems: any[] = [];
    const routingResults: { actionType: string; routedTo: string; id: string }[] = [];

    if (Array.isArray(rawActionItems) && rawActionItems.length > 0) {
      const validAIs = rawActionItems.filter(
        ai => ai && typeof ai === "object" && ai.actionType && ai.details && ai.neededFrom,
      );

      const clientCompany = acct.clientName;
      const repName       = acct.repName;
      const repIdInt      = acct.repId ?? null;
      const repRegion     = acct.region;

      for (const ai of validAIs) {
        const aType      = (ai.actionType as string).trim();
        const dueDate    = (ai.dueDate    as string || "").trim();
        const details    = (ai.details    as string || "").trim();
        const neededFrom = (ai.neededFrom as string || "").trim();

        if (!(ACTION_TYPES as readonly string[]).includes(aType)) continue;

        if (aType === "Approval needed" || aType === "Introduction needed") {
          // ── Route to internal_requests table ─────────────────────────────
          const irId      = randomUUID();
          const irType    = aType === "Approval needed" ? "Approval needed" : "Introduction needed";
          const irSubject = `${aType} — ${clientCompany} — ${details} — by ${dueDate} — from ${repName}`.slice(0, 160);

          await db.insert(internalRequests).values({
            id:             irId,
            type:           irType,
            dept:           neededFrom,
            subject:        irSubject,
            details:        details || null,
            raisedByUserId: user.id,
            raisedByName:   repName,
            repId:          repIdInt,
            clientCompany:  clientCompany || null,
            dealId:         dealId?.trim() || null,
            touchpointId:   tpId,
            region:         repRegion,
            status:         "Pending",
            raisedAt:       today(),
            slaHours:       48,
          });

          routingResults.push({ actionType: aType, routedTo: "internal_requests", id: irId });
          routedActionItems.push({ ...ai, routedTo: "internal_requests", routedId: irId });

        } else if (aType === "Attend a meeting") {
          // ── Route to plans table ──────────────────────────────────────────
          const planId = randomUUID();
          await db.insert(plans).values({
            id:               planId,
            repUserId:        acct.repUserId ?? null,
            repId:            repIdInt,
            repName:          repName ?? "",
            region:           acct.region   ?? "",
            date:             dueDate || today(),
            time:             "",
            clientAgencyName: clientCompany,
            contactName:      contactName ?? "",
            phone:            "",
            agenda:           `[Action] Attend meeting — ${clientCompany} — ${details}`.slice(0, 200),
            pitchType:        "",
            meetingType:      "Physical",
            status:           "Planned",
            loggedMeetingId:  null,
            isUnplanned:      false,
            needsMeet:        false,
            autoCreatedFrom:  "action-item",
            assignedByName:   repName,
            dealId:           dealId ?? null,
            touchpointId:     tpId,
          });

          routingResults.push({ actionType: aType, routedTo: "plans", id: planId });
          routedActionItems.push({ ...ai, routedTo: "plans", routedId: planId });

        } else {
          // ── Route to tasks table ──────────────────────────────────────────
          // Covers: "Document needed" | "Flag for follow-up"
          const taskId = randomUUID();
          const prefix =
            aType === "Document needed" ? "[Doc needed]" : "[Follow-up]";
          const taskTitle = `${prefix} — ${clientCompany} — ${details} — by ${dueDate} — from ${repName}`.slice(0, 150);

          await db.insert(tasks).values({
            id:               taskId,
            actionType:       aType,
            title:            taskTitle,
            description:      details || null,
            priority:         "High",
            status:           "Open",
            dueDate:          dueDate || null,
            assignedByUserId: user.id,
            assignedByName:   repName,
            assignedToUserId: null,
            assignedDept:     neededFrom || "Self",
            clientCompany:    clientCompany || null,
            dealId:           dealId?.trim() || null,
            touchpointId:     tpId,
            fromMeetingLog:   true,
            region:           repRegion,
            repId:            repIdInt,
          });

          routingResults.push({ actionType: aType, routedTo: "tasks", id: taskId });
          routedActionItems.push({ ...ai, routedTo: "tasks", routedId: taskId });
        }
      }
    }

    // ── Insert touchpoint ──────────────────────────────────────────────────
    const logTime = loggedAt?.trim() ||
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const isLate = loggedLate === true ||
      (now.getHours() * 60 + now.getMinutes() > 23 * 60 + 30);

    const [tp] = await db.insert(touchpoints).values({
      id:              tpId,
      clientAccountId: clientAccountId.trim(),
      dealId:          dealId?.trim()        || null,
      repUserId:       acct.repUserId,
      repName:         acct.repName,
      region:          acct.region,
      repId:           acct.repId            ?? null,
      touchpointType:  tpType,
      meetingType:     isDealMeeting ? (meetingType?.trim() || null) : null,
      date:            tpDate,
      time:            tpTime?.trim()        || null,
      contactName:     contactName?.trim()   || null,
      contactDesignation: contactDesignation?.trim() || null,
      contactLevel:    contactLevel?.trim()  || null,
      whatHappened:    whatHappened.trim(),
      clientFeedback:  clientFeedback?.trim()|| null,
      stageUpdate:     stageUpdate,
      lossReason:      stageUpdate === "Lost" ? (lossReason?.trim() || null) : null,
      actionItems:     routedActionItems.length > 0 ? routedActionItems : [],
      loggedAt:        logTime,
      loggedLate:      isLate,
      loggedByUserId:  user.id,
    }).returning();

    // ── Side-effect 1: update client account escalation clock fields ──────
    // Deal Meeting → reset BOTH clocks
    // All others   → reset last_contact_date ONLY (last_deal_meeting_date unchanged)
    if (isDealMeeting) {
      await db.update(clientAccounts).set({
        lastDealMeetingDate: tpDate,
        lastContactDate:     tpDate,
        updatedAt:           new Date(),
      }).where(eq(clientAccounts.id, clientAccountId));
    } else {
      await db.update(clientAccounts).set({
        lastContactDate: tpDate,
        updatedAt:       new Date(),
      }).where(eq(clientAccounts.id, clientAccountId));
    }

    // ── Side-effect 2: apply deal stage transition if stageUpdate valid ───
    if (stageUpdate && dealRow) {
      await db.update(deals).set({
        stage:      stageUpdate,
        lossReason: stageUpdate === "Lost" ? (lossReason?.trim() ?? null) : dealRow.lossReason,
        updatedAt:  new Date(),
      }).where(eq(deals.id, dealRow.id));
    }

    res.status(201).json({
      ok:              true,
      touchpoint:      tp,
      routingResults,
      stageApplied:    stageUpdate ?? null,
      clocksUpdated: {
        lastDealMeetingDate: isDealMeeting ? tpDate : null, // only Deal Meeting resets this
        lastContactDate:     tpDate,
      },
    });

  } catch (err) {
    req.log.error({ err }, "POST /touchpoints error");
    res.status(500).json({ ok: false, error: "Failed to create touchpoint" });
  }
});

// ─── GET /api/touchpoints ────────────────────────────────────────────────────
// List touchpoints — role-scoped.
// Query params: ?dealId= ?clientAccountId= ?repUserId= ?touchpointType= ?dateFrom= ?dateTo=
router.get("/touchpoints", requireAuth, async (req, res) => {
  const user = req.user!;
  const {
    dealId:          filterDealId,
    clientAccountId: filterAccountId,
    repUserId:       filterRepUserId,
    touchpointType:  filterTpType,
    dateFrom,
    dateTo,
  } = req.query as Record<string, string | undefined>;

  try {
    let rows = await db.select().from(touchpoints);

    // Role-based scope
    if (user.role === "SALES REP") {
      rows = rows.filter(r => r.repUserId === user.id);
    } else if (user.role === "REGION HEAD") {
      rows = rows.filter(r => r.region === user.region);
    }

    // Optional refinement filters
    if (filterDealId)      rows = rows.filter(r => r.dealId          === filterDealId);
    if (filterAccountId)   rows = rows.filter(r => r.clientAccountId === filterAccountId);
    if (filterRepUserId)   rows = rows.filter(r => r.repUserId        === filterRepUserId);
    if (filterTpType) {
      const norm = isValidTpType(filterTpType) ? normalizeTpType(filterTpType) : filterTpType;
      rows = rows.filter(r => r.touchpointType === norm);
    }
    if (dateFrom)          rows = rows.filter(r => (r.date ?? "") >= dateFrom);
    if (dateTo)            rows = rows.filter(r => (r.date ?? "") <= dateTo);

    rows.sort((a, b) => (b.date ?? "") > (a.date ?? "") ? 1 : -1);

    res.json({ ok: true, touchpoints: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "GET /touchpoints error");
    res.status(500).json({ ok: false, error: "Failed to list touchpoints" });
  }
});

// ─── GET /api/touchpoints/escalations ───────────────────────────────────────
// Compute all escalation signals server-side from touchpoint + deal + account state.
// All three escalation outputs are role-scoped identically to GET /api/touchpoints.
//
// Returns:
//   atRisk       — client accounts where last_deal_meeting_date >= 7 days ago AND
//                  current_stage IN {In Discussion, Negotiation, Mail Confirmed}
//   trigger2A    — client accounts with 4+ Deal Meeting touchpoints in the last 30 days
//                  but no stage movement in those 30 days (deal is stalling)
//   trigger2B    — reps with fewer than MIN_MONTHLY_TOUCHPOINTS (15) touchpoints
//                  in the current calendar month
//   summary      — counts for badge display
router.get("/touchpoints/escalations", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    // ── Load relevant data sets ────────────────────────────────────────────
    let allAccounts = await db.select().from(clientAccounts);
    let allDeals    = await db.select().from(deals);
    let allTps      = await db.select().from(touchpoints);

    // Scope to user's visibility
    if (user.role === "SALES REP") {
      allAccounts = allAccounts.filter(a => a.repUserId === user.id);
      allDeals    = allDeals.filter(d => d.repUserId    === user.id);
      allTps      = allTps.filter(t   => t.repUserId    === user.id);
    } else if (user.role === "REGION HEAD") {
      allAccounts = allAccounts.filter(a => a.region === user.region);
      allDeals    = allDeals.filter(d => d.region    === user.region);
      allTps      = allTps.filter(t   => t.region    === user.region);
    }

    // Indexed lookups
    const dealsByAccount = new Map<string, typeof allDeals>();
    for (const d of allDeals) {
      const arr = dealsByAccount.get(d.clientAccountId) ?? [];
      arr.push(d);
      dealsByAccount.set(d.clientAccountId, arr);
    }

    const tpsByAccount = new Map<string, typeof allTps>();
    for (const t of allTps) {
      const arr = tpsByAccount.get(t.clientAccountId) ?? [];
      arr.push(t);
      tpsByAccount.set(t.clientAccountId, arr);
    }

    const tpsByRep = new Map<string, typeof allTps>();
    for (const t of allTps) {
      const arr = tpsByRep.get(t.repUserId) ?? [];
      arr.push(t);
      tpsByRep.set(t.repUserId, arr);
    }

    // ── Date boundaries ───────────────────────────────────────────────────
    const ACTIVE_STAGES = new Set(["In Discussion", "Negotiation", "Mail Confirmed"]);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0];
    const currentMonthStart = monthStart();

    // ── Escalation 1: At-Risk accounts ────────────────────────────────────
    // Account is at-risk when:
    //   • current_stage is active (In Discussion / Negotiation / Mail Confirmed)
    //   • last_deal_meeting_date is 7+ days ago (or NULL, treated as infinitely old)
    const atRisk = allAccounts
      .filter(a => ACTIVE_STAGES.has(a.currentStage))
      .filter(a => daysSince(a.lastDealMeetingDate) >= 7)
      .map(a => ({
        account:              a,
        daysSinceLastMeeting: daysSince(a.lastDealMeetingDate),
        severity:             daysSince(a.lastDealMeetingDate) >= 14 ? "critical" : "warning",
      }));

    // ── Escalation 2A: Stalling deals ─────────────────────────────────────
    // An account is stalling when:
    //   • It has 4+ Deal Meeting touchpoints in the last 30 days
    //   • AND the deal stage has NOT changed in those 30 days
    //     (proxy: no Deal Meeting touchpoint in the period has a stageUpdate different from
    //      the current deal stage — i.e. every stageUpdate either matches the current stage
    //      or is null, meaning the rep keeps meeting but no progress)
    const trigger2A: {
      account:       typeof allAccounts[number];
      dealMeetings:  number;
      currentStage:  string | null;
    }[] = [];

    for (const a of allAccounts) {
      if (!ACTIVE_STAGES.has(a.currentStage)) continue;

      const recentDealMeetings = (tpsByAccount.get(a.id) ?? []).filter(
        t => t.touchpointType === "Deal Meeting" && (t.date ?? "") >= thirtyDaysAgo,
      );
      if (recentDealMeetings.length < 4) continue;

      // Check for any stage movement in the last 30 days
      // A "stage movement" = a stageUpdate that is different from the earliest stage seen in the period
      const stagesInPeriod = recentDealMeetings
        .filter(t => t.stageUpdate)
        .map(t => t.stageUpdate as string);
      const uniqueStages = new Set(stagesInPeriod);

      const hasMovement = uniqueStages.size > 1 ||
        (uniqueStages.size === 1 && !uniqueStages.has(a.currentStage));

      if (!hasMovement) {
        trigger2A.push({
          account:      a,
          dealMeetings: recentDealMeetings.length,
          currentStage: a.currentStage,
        });
      }
    }

    // ── Escalation 2B: Low-activity reps ──────────────────────────────────
    // A rep is flagged when they have fewer than MIN_MONTHLY_TOUCHPOINTS (15)
    // touchpoints of ANY type in the current calendar month.
    // Computed per unique repUserId in the scoped data set.
    const trigger2B: {
      repUserId:          string;
      repName:            string;
      region:             string;
      touchpointsThisMonth: number;
      required:           number;
      shortfall:          number;
    }[] = [];

    // Gather unique reps from accounts in scope
    const seenReps = new Map<string, { repName: string; region: string }>();
    for (const a of allAccounts) {
      if (!seenReps.has(a.repUserId)) {
        seenReps.set(a.repUserId, { repName: a.repName, region: a.region });
      }
    }

    for (const [repUserId, { repName, region }] of seenReps.entries()) {
      const thisMonthTps = (tpsByRep.get(repUserId) ?? []).filter(
        t => (t.date ?? "") >= currentMonthStart,
      );
      if (thisMonthTps.length < MIN_MONTHLY_TOUCHPOINTS) {
        trigger2B.push({
          repUserId,
          repName,
          region,
          touchpointsThisMonth: thisMonthTps.length,
          required:             MIN_MONTHLY_TOUCHPOINTS,
          shortfall:            MIN_MONTHLY_TOUCHPOINTS - thisMonthTps.length,
        });
      }
    }

    res.json({
      ok: true,
      atRisk,
      trigger2A,
      trigger2B,
      summary: {
        atRiskCount:    atRisk.length,
        stalling:       trigger2A.length,
        lowActivityReps: trigger2B.length,
        total:          atRisk.length + trigger2A.length + trigger2B.length,
      },
    });

  } catch (err) {
    req.log.error({ err }, "GET /touchpoints/escalations error");
    res.status(500).json({ ok: false, error: "Failed to compute escalations" });
  }
});

export default router;
