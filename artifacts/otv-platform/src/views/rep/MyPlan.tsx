/**
 * MyPlan — monthly calendar, TODAY/TOMORROW summary cards, compliance strip.
 *
 * Owns its local calendar/UI state (week offset, day view, active tab, addPlanFor).
 * Receives shared data (meetings, plans, deals, tasks, etc.) as props from CROApp —
 * already fetched by hooks in the parent — to preserve behavioral parity with no
 * double-fetch/polling regressions.
 *
 * No raw fetch() calls. All mutations bubble via typed callbacks.
 */

import React, { useState } from "react";
import { C, TODAY, TOMORROW } from "../../utils/palette";
import { PlanCalendar } from "../../components/plan/PlanCalendar";
import { PlanCard } from "../../components/plan/PlanCard";
import type { PlanCardPlan } from "../../components/plan/PlanCard";
import { AddPlanModal } from "../../components/plan/AddPlanModal";

/* ── Shared narrow type for rep/entity IDs ─────────────────────────────── */
/** DB columns return integers; form fields use strings. Both are valid. */
type RepId = number | string | null | undefined;

/* ── Entity interfaces ─────────────────────────────────────────────────── */

interface Meeting {
  id: string;
  repId?: RepId;
  loggedByUserId?: string;
  date: string;
  time?: string;
  clientCompany?: string;
  contactName?: string;
  contactLevel?: string;
  outcome?: string;
  loggedAt?: string;
  late?: boolean;
  status?: string;
  followUpDate?: string;
  nextMeetingDate?: string;
  nextStep?: string;
  discussion?: string;
  meetingKind?: string;
  loggedMeetingId?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: RepId;
  assignedToUserId?: string;
  repId?: RepId;
  status: string;
  dueDate?: string;
  priority?: string;
  clientCompany?: string;
}

interface Deal {
  id: string;
  repId?: RepId;
  clientCompany: string;
  stage?: string;
  outcome?: string;
  awaitingApproval?: string;
  awaitingApprovalSince?: string;
  nextStep?: string;
  amount?: number;
  agencyName?: string;
  agency?: string;
  brand?: string;
}

interface RevEntry {
  repId?: RepId;
  quarter?: string;
  invoiceRef?: string;
  amount?: number;
  clientCompany?: string;
  dealType?: string;
}

interface Plan {
  id: string;
  repId?: RepId;
  date: string;
  time: string;
  status: string;
  clientAgencyName: string;
  contactName?: string;
  phone?: string;
  agenda?: string;
  pitchType?: string;
  meetingType?: string;
  meetingKind?: string;
  touchpointType?: string;
  autoCreatedFrom?: string;
  isUnplanned?: boolean;
  loggedMeetingId?: string | null;
  meetingDbId?: string;
  client?: string;
  agency?: string;
  brand?: string;
}

interface Rep { id: RepId; name: string; region?: string; }

/* ── PlanForm — passed to AddPlanModal ────────────────────────────────── */
export interface PlanForm {
  agency: string;
  client: string;
  brand: string;
  contactName: string;
  phone: string;
  time: string;
  agenda: string;
  pitchType: string;
  meetingType: string;
  touchpointType: string;
  meetingKind: string;
  needsMeet: boolean;
  syncToCalendar: boolean;
  calPlatform: string;
}

/* ── Typed setter — mirrors React.Dispatch<React.SetStateAction<T>> ─────── */
type Setter<T> = (updater: T | ((prev: T) => T)) => void;

/* ── Props ─────────────────────────────────────────────────────────────── */
export interface MyPlanProps {
  userRole: { repId?: RepId; id?: string; role?: string } | null;
  activeUser: string;
  loginProvider: string;
  isRep: boolean;
  isNSH: boolean;
  isRH: boolean;
  isStrategy: boolean;
  isCRORole: boolean;
  isAdmin: boolean;
  isDigiOps: boolean;
  plans: Plan[];
  setPlans: Setter<Plan[]>;
  meetings: Meeting[];
  tasks: Task[];
  setTasks: Setter<Task[]>;
  deals: Deal[];
  revenueEntries: RevEntry[];
  filterQ: string;
  planForm: PlanForm;
  setPlanForm: Setter<PlanForm>;
  planLoggedMsg: Record<string, string>;
  setPlanLoggedMsg: Setter<Record<string, string>>;
  weekSummaryDismissed: string | null;
  setWeekSummaryDismissed: (v: string | null) => void;
  adminConfig: { inactivityDaysRisk?: number } | null;
  reps: Rep[];
  countdown: string;
  doAddPlan: (date: string, onSuccess?: () => void) => void;
  setLogForm: Setter<Record<string, unknown>>;
  setLogOpen: (v: boolean) => void;
  setDealForm: Setter<Record<string, unknown>>;
  setAddDealOpen: (v: boolean) => void;
  setViewMeetingId: (id: string) => void;
  showToast: (msg: string, type?: string) => void;
  qMatch: (q: string) => boolean;
  BLANK_LOG: Record<string, unknown>;
  BLANK_DEAL: Record<string, unknown>;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export const MyPlan: React.FC<MyPlanProps> = (props) => {
  const {
    userRole, activeUser, loginProvider,
    isRep, isStrategy, isCRORole,
    plans, meetings, tasks, deals,
    planForm, setPlanForm,
    reps, countdown,
    doAddPlan, setLogForm, setLogOpen, setDealForm, setAddDealOpen,
    setViewMeetingId, showToast, filterQ,
    BLANK_LOG, BLANK_DEAL,
  } = props;

  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calDayView, setCalDayView]       = useState<string | null>(null);
  const [myPlanTab, setMyPlanTab]         = useState<"plan" | "log">("plan");
  const [addPlanFor, setAddPlanFor]       = useState<string | null>(null);
  const [inlineLogPlan, setInlineLogPlan] = useState<string | null>(null);

  const myRepId     = userRole?.repId;
  const myPlanRepId = myRepId ?? userRole?.id;

  const isMyMeeting = (m: Meeting) =>
    m.loggedByUserId
      ? m.loggedByUserId === activeUser
      : myRepId ? m.repId === myRepId : false;

  const allPlans   = plans || [];
  const pf         = planForm;
  const setPf      = setPlanForm;
  const todayPlans = allPlans.filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item" && p.date === TODAY);
  const tmrwPlans  = allPlans.filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item" && p.date === TOMORROW);
  const todayLogged = meetings.some(m => isMyMeeting(m) && m.date === TODAY) || todayPlans.some(p => p.status === "Done");

  // Weekly deadline timer
  const now = new Date();
  const daysUntilSat = (6 - now.getDay() + 7) % 7;
  const satDeadline = new Date(now);
  satDeadline.setDate(now.getDate() + daysUntilSat);
  satDeadline.setHours(23, 30, 0, 0);
  const weeklyDiffMs = satDeadline.getTime() - now.getTime();
  const weeklyH = Math.floor(weeklyDiffMs / 3600000);
  const weeklyM = Math.floor((weeklyDiffMs % 3600000) / 60000);
  const weeklyLabel = weeklyDiffMs <= 0 ? "Past weekly deadline" : `${weeklyH}h ${weeklyM}m left`;

  /* ── Strategy/CRO: monthly read-only overview ─────────────────────────── */
  if (isStrategy || isCRORole) {
    const months = [...new Set(meetings.map(m => m.date?.slice(0, 7)))].sort().reverse().slice(0, 6);
    return (
      <div className="fin">
        <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          {isStrategy ? "Team Meeting Overview" : "CRO Meeting Overview"}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>Monthly meeting summary across all reps and region heads. Read-only.</div>
        {months.map(ym => {
          const monthMeetings = meetings.filter(m => m.date?.startsWith(ym));
          const byRep: Record<string, { repId: RepId; repName: string; count: number; clients: Set<string> }> = {};
          monthMeetings.forEach(m => {
            const key = String(m.repId);
            if (!byRep[key]) byRep[key] = { repId: m.repId, repName: reps.find(r => r.id === m.repId)?.name || "Rep " + m.repId, count: 0, clients: new Set() };
            byRep[key].count++;
            if (m.clientCompany) byRep[key].clients.add(m.clientCompany);
          });
          const repRows = Object.values(byRep).sort((a, b) => b.count - a.count);
          const [yr, mo] = ym.split("-");
          const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
          return (
            <div key={ym} className="card" style={{ padding: "14px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="sans" style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ textAlign: "right" }}><div className="sans" style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{monthMeetings.length}</div><div style={{ fontSize: 9, color: C.dim }}>TOTAL MEETINGS</div></div>
                  <div style={{ textAlign: "right" }}><div className="sans" style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{Object.keys(byRep).length}</div><div style={{ fontSize: 9, color: C.dim }}>REPS ACTIVE</div></div>
                </div>
              </div>
              {repRows.map(r => (
                <div key={String(r.repId)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: C.s2, borderRadius: 5, marginBottom: 4 }}>
                  <span className="sans" style={{ flex: 1, fontWeight: 600, fontSize: 12 }}>{r.repName}</span>
                  <span style={{ background: `${C.blue}18`, color: C.blue, padding: "1px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{r.count} meetings</span>
                  <span style={{ fontSize: 10, color: C.dim }}>{r.clients.size} clients</span>
                </div>
              ))}
              {repRows.length === 0 && <div style={{ textAlign: "center", padding: 12, color: C.muted, fontSize: 11 }}>No meetings logged this month</div>}
            </div>
          );
        })}
        {months.length === 0 && <div style={{ textAlign: "center", padding: 60, color: C.muted }}>No meeting history yet.</div>}
      </div>
    );
  }

  /* ── Plan chips for calendar ──────────────────────────────────────────── */
  const planChips: PlanCardPlan[] = allPlans
    .filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item")
    .map(p => {
      const linkedDeal = deals.find(d =>
        d.repId === myRepId &&
        (d.clientCompany || "").toLowerCase() === (p.clientAgencyName || "").toLowerCase()
      );
      const blocked    = !!(linkedDeal?.awaitingApproval && p.status !== "Done");
      const dealNextStep = linkedDeal?.nextStep && linkedDeal.nextStep !== p.agenda ? linkedDeal.nextStep : null;
      return { ...p, blocked, dealNextStep };
    });

  const handlePlanTap = (p: PlanCardPlan) => {
    if (p.status === "Done") {
      const m = meetings.find(m => m.id === p.loggedMeetingId) ||
        meetings.find(m =>
          m.repId === myRepId &&
          (m.clientCompany || "").toLowerCase() === (p.clientAgencyName || "").toLowerCase() &&
          m.date === p.date
        );
      if (m) setViewMeetingId(m.id);
    } else if (p.date > TODAY && p.status !== "Done") {
      showToast(`This meeting is on ${p.date}. Come back on the day to log it.`);
    } else {
      const matchedDeal = deals.find(d =>
        d.repId === myRepId &&
        (d.clientCompany || "").toLowerCase() === ((p.client || p.clientAgencyName) || "").toLowerCase()
      );
      setLogForm(() => ({
        ...BLANK_LOG,
        repId: String(myRepId),
        planId: p.id,
        meetingDbId: p.meetingDbId || "",
        meetingTime: p.time || "",
        meetingKind: p.meetingKind || "ACTIONABLE",
        touchpointType: p.touchpointType || (p.meetingKind === "PR" ? "Relationship" : "Deal Meeting"),
        clientAgencyName: p.client || p.agency || p.clientAgencyName || "",
        agency: p.agency || "",
        client: p.client || p.clientAgencyName || "",
        brand: p.brand || "",
        contactName: p.contactName || "",
        mobile: p.phone || "",
        meetingType: p.meetingType || "Physical",
        pitchType: p.pitchType || "",
        agenda: p.agenda || "",
        dealId: p.meetingKind === "PR" ? "" : (matchedDeal?.id || ""),
      }));
      setLogOpen(true);
    }
  };

  /* ── Main render ──────────────────────────────────────────────────────── */
  return (
    <div className="fin">
      {/* Header + timers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>MY PLAN</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Click any planned touchpoint to log it · Add new ones via + on calendar</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: countdown.includes("passed") ? `${C.red}12` : `${C.green}10`, border: `1px solid ${countdown.includes("passed") ? C.red : C.green}33`, borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: countdown.includes("passed") ? C.red : C.green }}>
            Daily: {countdown.includes("passed") ? "Passed" : countdown}
          </div>
          <div style={{ background: weeklyDiffMs <= 0 ? `${C.red}12` : `${C.blue}10`, border: `1px solid ${weeklyDiffMs <= 0 ? C.red : C.blue}33`, borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: weeklyDiffMs <= 0 ? C.red : C.blue }}>
            Weekly: {weeklyLabel}
          </div>
        </div>
      </div>

      {/* Quick-action CTAs (rep only) */}
      {isRep && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => { setLogForm(() => ({ ...BLANK_LOG, repId: String(myRepId || "") })); setLogOpen(true); }}
            style={{ flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Log Touchpoint
          </button>
          <button onClick={() => { setDealForm(() => ({ ...BLANK_DEAL, repId: String(myRepId || ""), quarter: filterQ })); setAddDealOpen(true); }}
            style={{ flex: 1, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Add Deal
          </button>
        </div>
      )}

      {/* TODAY / TOMORROW compliance strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {([
          { label: "TODAY",    date: TODAY,    dayList: todayPlans,  logged: todayLogged },
          { label: "TOMORROW", date: TOMORROW, dayList: tmrwPlans,   logged: false },
        ] as const).map(({ label, date, dayList, logged }) => (
          <div key={label} style={{ flex: 1, minWidth: 200, background: C.surface, border: `1px solid ${logged ? C.green : C.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {label} · {new Date(date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: logged ? C.green : C.red, fontWeight: 700 }}>{logged ? "✓" : "✗"}</span>
                <button onClick={() => setAddPlanFor(date)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 8px", color: C.dim, fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>+ Add</button>
              </div>
            </div>
            <div style={{ padding: "10px 14px", minHeight: 60 }}>
              {dayList.length === 0 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "12px 0" }}>Nothing planned yet</div>}
              {dayList.map(p => (
                <PlanCard key={p.id} plan={p} isOpen={inlineLogPlan === p.id} onTap={handlePlanTap} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {([["plan", "📅 Plan"], ["log", "📋 Meeting Log"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setMyPlanTab(id as "plan" | "log")}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${myPlanTab === id ? C.accent : "transparent"}`, padding: "6px 14px", fontSize: 12, fontWeight: myPlanTab === id ? 700 : 400, color: myPlanTab === id ? C.accent : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", marginBottom: -1, transition: "color .15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Meeting Log tab */}
      {myPlanTab === "log" && (() => {
        const myMeetings = meetings.filter(m => isMyMeeting(m)).sort((a, b) => (b.date > a.date ? 1 : -1));
        const outcomeColor = (o: string) =>
          o?.includes("Accepted") ? C.green :
          o?.includes("Interested") ? C.blue :
          o?.includes("Concern") || o?.includes("Objection") ? C.orange :
          o?.includes("Not") || o?.includes("Lost") ? C.red : C.dim;
        if (!myMeetings.length) return (
          <div style={{ textAlign: "center", padding: 60, color: C.muted, fontSize: 12 }}>No meetings logged yet. Use the Plan tab to log your first meeting.</div>
        );
        return (
          <div>
            <div style={{ marginBottom: 10, fontSize: 11, color: C.dim }}>{myMeetings.length} meetings logged</div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Date", "Client", "Contact", "Outcome", "Discussion / Notes", "Next Step"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", background: C.s2, color: C.dim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myMeetings.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.s2}`, cursor: "pointer" }}
                      onClick={() => setViewMeetingId(m.id)}
                      onMouseOver={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.s2; }}
                      onMouseOut={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: m.date === TODAY ? C.accent : C.text }}>{m.date === TODAY ? "Today" : m.date}</div>
                        {m.loggedAt && <div style={{ fontSize: 10, color: C.dim }}>logged {m.loggedAt}</div>}
                        {m.late && <div style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>LATE</div>}
                      </td>
                      <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 600, fontSize: 12 }}>{m.clientCompany || "—"}</div></td>
                      <td style={{ padding: "10px 14px", color: C.dim, fontSize: 11 }}>
                        <div>{m.contactName || "—"}</div>
                        {m.contactLevel && <div style={{ fontSize: 9, color: C.muted }}>{m.contactLevel}</div>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, color: outcomeColor(m.outcome || ""), fontWeight: 600 }}>{m.outcome || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: 200 }}>
                        <div style={{ fontSize: 11, color: C.dim, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.discussion || "—"}</div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: C.dim, maxWidth: 150 }}>{m.nextStep || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Plan (calendar) tab */}
      {myPlanTab === "plan" && (
        <PlanCalendar
          plans={planChips}
          weekOffset={calWeekOffset}
          dayView={calDayView}
          onPrevMonth={() => setCalWeekOffset(o => o - 1)}
          onNextMonth={() => setCalWeekOffset(o => o + 1)}
          onTodayClick={() => setCalWeekOffset(0)}
          onDayClick={date => setCalDayView(calDayView === date ? null : date)}
          onPlanTap={handlePlanTap}
          onAddForDate={date => setAddPlanFor(date)}
        />
      )}

      {/* Add Plan Modal — rendered via extracted AddPlanModal component */}
      {addPlanFor && (
        <AddPlanModal
          forDate={addPlanFor}
          form={pf}
          deals={deals}
          loginProvider={loginProvider}
          onFormChange={setPf}
          onSubmit={(date) => doAddPlan(date, () => setAddPlanFor(null))}
          onClose={() => setAddPlanFor(null)}
        />
      )}
    </div>
  );
};

export default MyPlan;
