/**
 * MyPlan — monthly calendar, TODAY/TOMORROW summary cards, compliance strip.
 *
 * Owns its local calendar/UI state (week offset, day view, inline log state,
 * plan form, active tab). Receives shared data (meetings, plans, deals, tasks,
 * revenueEntries, etc.) as props from CROApp — these are already fetched by
 * hooks in the parent and passed down here to preserve behavioral parity.
 *
 * No raw fetch() calls — all mutations bubble via callbacks (setPlans, doAddPlan,
 * setTasks, setTouchpoints, setLogForm + setLogOpen for the shared log modal).
 */

import React, { useState, useRef } from "react";
import { C, TODAY, TOMORROW, fmtR } from "../../utils/palette";
import { PlanCalendar } from "../../components/plan/PlanCalendar";
import { PlanCard } from "../../components/plan/PlanCard";
import type { PlanCardPlan } from "../../components/plan/PlanCard";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Meeting {
  id: string; repId?: any; loggedByUserId?: string; date: string; time?: string;
  clientCompany?: string; contactName?: string; contactLevel?: string; outcome?: string;
  loggedAt?: string; late?: boolean; status?: string; followUpDate?: string;
  nextMeetingDate?: string; nextStep?: string; discussion?: string; meetingKind?: string;
  loggedMeetingId?: string;
}
interface Task { id: string; title: string; description?: string; assignedTo?: any; assignedToUserId?: string; repId?: any; status: string; dueDate?: string; priority?: string; clientCompany?: string; }
interface Deal { id: string; repId?: any; clientCompany: string; stage?: string; outcome?: string; awaitingApproval?: string; awaitingApprovalSince?: string; nextStep?: string; amount?: number; }
interface RevEntry { repId?: any; quarter?: string; invoiceRef?: string; amount?: number; clientCompany?: string; dealType?: string; }
interface Plan {
  id: string; repId?: any; date: string; time: string; status: string;
  clientAgencyName: string; contactName?: string; phone?: string;
  agenda?: string; pitchType?: string; meetingType?: string; meetingKind?: string;
  touchpointType?: string; autoCreatedFrom?: string; isUnplanned?: boolean;
  loggedMeetingId?: string | null; meetingDbId?: string;
  client?: string; agency?: string; brand?: string;
}

export interface PlanForm {
  agency: string; client: string; brand: string; contactName: string; phone: string;
  time: string; agenda: string; pitchType: string; meetingType: string;
  touchpointType: string; meetingKind: string; needsMeet: boolean;
  syncToCalendar: boolean; calPlatform: string;
}

export interface MyPlanProps {
  userRole: { repId?: any; id?: string; role?: string } | null;
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
  setPlans: (updater: any) => void;
  meetings: Meeting[];
  tasks: Task[];
  setTasks: (updater: any) => void;
  deals: Deal[];
  revenueEntries: RevEntry[];
  filterQ: string;
  planForm: PlanForm;
  setPlanForm: (updater: any) => void;
  planLoggedMsg: Record<string, string>;
  setPlanLoggedMsg: (updater: any) => void;
  weekSummaryDismissed: string | null;
  setWeekSummaryDismissed: (v: string | null) => void;
  adminConfig: { inactivityDaysRisk?: number } | null;
  reps: { id: any; name: string }[];
  countdown: string;
  doAddPlan: (date: string, onSuccess?: () => void) => void;
  setLogForm: (updater: any) => void;
  setLogOpen: (v: boolean) => void;
  setDealForm: (updater: any) => void;
  setAddDealOpen: (v: boolean) => void;
  setViewMeetingId: (id: string) => void;
  showToast: (msg: string, type?: string) => void;
  qMatch: (q: string) => boolean;
  setTouchpoints?: (updater: any) => void;
  BLANK_LOG: Record<string, any>;
  BLANK_DEAL: Record<string, any>;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export const MyPlan: React.FC<MyPlanProps> = (props) => {
  const {
    userRole, activeUser, loginProvider,
    isRep, isNSH, isRH, isStrategy, isCRORole, isAdmin, isDigiOps,
    plans, setPlans, meetings, tasks, setTasks, deals, revenueEntries,
    filterQ, planForm, setPlanForm, planLoggedMsg, setPlanLoggedMsg,
    weekSummaryDismissed, setWeekSummaryDismissed,
    adminConfig, reps, countdown,
    doAddPlan, setLogForm, setLogOpen, setDealForm, setAddDealOpen,
    setViewMeetingId, showToast, qMatch, setTouchpoints, BLANK_LOG, BLANK_DEAL,
  } = props;

  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calDayView, setCalDayView]       = useState<string | null>(null);
  const [myPlanTab, setMyPlanTab]         = useState<"plan" | "log">("plan");
  const [addPlanFor, setAddPlanFor]       = useState<string | null>(null);
  const planInlineRef                     = useRef<string | null>(null); // inlineLogPlan
  const [inlineLogPlan, setInlineLogPlan] = useState<string | null>(null);
  const [inlineLogStatus, setInlineLogStatus] = useState("");

  const myRepId    = userRole?.repId || null;
  const myPlanRepId = myRepId ?? userRole?.id;

  const isMyMeeting = (m: Meeting) =>
    m.loggedByUserId
      ? m.loggedByUserId === activeUser
      : myRepId ? m.repId === myRepId : false;

  const allPlans    = plans || [];
  const pf          = planForm;
  const setPf       = setPlanForm;
  const todayPlans  = allPlans.filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item" && p.date === TODAY);
  const tmrwPlans   = allPlans.filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item" && p.date === TOMORROW);
  const todayLogged = meetings.some(m => isMyMeeting(m) && m.date === TODAY) || todayPlans.some(p => p.status === "Done");
  const tmrwPlanned = tmrwPlans.length > 0;

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

  // Strategy/CRO: read-only monthly overview
  if (isStrategy || isCRORole) {
    const allMeetings = meetings;
    const months = [...new Set(allMeetings.map(m => m.date?.slice(0, 7)))].sort().reverse().slice(0, 6);
    return (
      <div className="fin">
        <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          {isStrategy ? "Team Meeting Overview" : "CRO Meeting Overview"}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>Monthly meeting summary across all reps and region heads. Read-only.</div>
        {months.map(ym => {
          const monthMeetings = allMeetings.filter(m => m.date?.startsWith(ym));
          const byRep: Record<string, { repId: any; repName: string; count: number; clients: Set<string> }> = {};
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
                <div key={r.repId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: C.s2, borderRadius: 5, marginBottom: 4 }}>
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

  // Plan chips for calendar
  const planChips: PlanCardPlan[] = allPlans
    .filter(p => p.repId === myPlanRepId && p.autoCreatedFrom !== "action-item")
    .map(p => {
      const linkedDeal = deals.find(d => d.repId === myRepId && (d.clientCompany || "").toLowerCase() === (p.clientAgencyName || "").toLowerCase());
      const blocked    = !!(linkedDeal?.awaitingApproval && p.status !== "Done");
      const dealNextStep = linkedDeal?.nextStep && linkedDeal.nextStep !== p.agenda ? linkedDeal.nextStep : null;
      return { ...p, blocked, dealNextStep };
    });

  const handlePlanTap = (p: PlanCardPlan) => {
    if (p.status === "Done") {
      const m = meetings.find(m => m.id === p.loggedMeetingId) || meetings.find(m => m.repId === myRepId && (m.clientCompany || "").toLowerCase() === (p.clientAgencyName || "").toLowerCase() && m.date === p.date);
      if (m) setViewMeetingId(m.id);
    } else if (p.date > TODAY && p.status !== "Done") {
      showToast(`This meeting is on ${p.date}. Come back on the day to log it.`);
    } else {
      setLogForm((f: any) => ({
        ...BLANK_LOG, repId: String(myRepId),
        planId: p.id,
        meetingDbId: (p as any).meetingDbId || "",
        meetingTime: p.time || "",
        meetingKind: (p as any).meetingKind || "ACTIONABLE",
        touchpointType: (p as any).touchpointType || ((p as any).meetingKind === "PR" ? "Relationship" : "Deal Meeting"),
        clientAgencyName: p.client || p.agency || p.clientAgencyName || "",
        agency: p.agency || "", client: p.client || p.clientAgencyName || "", brand: (p as any).brand || "",
        contactName: p.contactName || "", mobile: p.phone || "",
        meetingType: p.meetingType || "Physical",
        pitchType: p.pitchType || "", agenda: p.agenda || "",
        dealId: (p as any).meetingKind === "PR" ? "" : deals.find(d => d.repId === myRepId && (d.clientCompany || "").toLowerCase() === ((p.client || p.clientAgencyName) || "").toLowerCase())?.id || "",
      }));
      setLogOpen(true);
    }
  };

  return (
    <div className="fin">
      {/* Header + timers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isRep ? 10 : 14 }}>
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
          <button onClick={() => { setLogForm((f: any) => ({ ...BLANK_LOG, repId: String(userRole?.repId || "") })); setLogOpen(true); }}
            style={{ flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Log Touchpoint
          </button>
          <button onClick={() => { setDealForm({ ...BLANK_DEAL, repId: String(userRole?.repId || ""), quarter: filterQ }); setAddDealOpen(true); }}
            style={{ flex: 1, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Add Deal
          </button>
        </div>
      )}

      {/* Compliance strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "TODAY", date: TODAY, plans: todayPlans, logged: todayLogged },
          { label: "TOMORROW", date: TOMORROW, plans: tmrwPlans, logged: false },
        ].map(({ label, date, plans: dayList, logged }) => {
          const done = label === "TODAY" ? todayLogged : false;
          return (
            <div key={label} style={{ flex: 1, minWidth: 200, background: C.surface, border: `1px solid ${done ? C.green : C.border}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {label} · {new Date(date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: done ? C.green : C.red, fontWeight: 700 }}>{done ? "✓" : "✗"}</span>
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
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {([ ["plan", "📅 Plan"], ["log", "📋 Meeting Log"] ] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setMyPlanTab(id as "plan" | "log")}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${myPlanTab === id ? C.accent : "transparent"}`, padding: "6px 14px", fontSize: 12, fontWeight: myPlanTab === id ? 700 : 400, color: myPlanTab === id ? C.accent : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", marginBottom: -1, transition: "color .15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Meeting Log tab */}
      {myPlanTab === "log" && (() => {
        const myMeetings = meetings.filter(m => isMyMeeting(m)).sort((a, b) => b.date > a.date ? 1 : -1);
        const outcomeColor = (o: string) => o?.includes("Accepted") ? C.green : o?.includes("Interested") ? C.blue : o?.includes("Concern") || o?.includes("Objection") ? C.orange : o?.includes("Not") || o?.includes("Lost") ? C.red : C.dim;
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
                      onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = C.s2}
                      onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
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

      {/* Add Plan Modal */}
      {addPlanFor && (() => {
        const myDeals = deals.filter(d => d.repId === myRepId);
        const allAgencies = [...new Set(myDeals.map(d => (d as any).agencyName || (d as any).agency || "").filter(Boolean))].sort();
        const clientsForAgency = pf.agency
          ? myDeals.filter(d => ((d as any).agencyName || (d as any).agency || "").toLowerCase() === pf.agency.toLowerCase()).map(d => d.clientCompany)
          : myDeals.map(d => d.clientCompany);
        const clientOptions = [...new Set(clientsForAgency)].sort();
        const brandsForClient = myDeals.filter(d => d.clientCompany.toLowerCase() === (pf.client || "").toLowerCase()).flatMap(d => [(d as any).brand].filter(Boolean));
        const brandOptions = [...new Set(brandsForClient)].sort();
        return (
          <div className="overlay" onClick={() => setAddPlanFor(null)}>
            <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div className="sans" style={{ fontSize: 15, fontWeight: 700 }}>Plan Touchpoint</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                    {new Date(addPlanFor + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}
                  </div>
                </div>
              </div>

              {/* Meeting kind */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginBottom: 5, display: "block" }}>Meeting kind *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([ ["ACTIONABLE", "🎯", "Sales call · full details", "#1d5db4"], ["PR", "🤝", "Relationship · quick visit", "#15803d"] ] as [string, string, string, string][]).map(([mk, icon, sub, col]) => (
                    <button key={mk} onClick={() => setPf((p: PlanForm) => ({ ...p, meetingKind: mk, touchpointType: mk === "PR" ? "Relationship" : p.touchpointType }))}
                      style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${pf.meetingKind === mk ? col : C.border}`, background: pf.meetingKind === mk ? `${col}14` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pf.meetingKind === mk ? col : C.text }}>{icon} {mk === "ACTIONABLE" ? "Actionable" : "PR"}</div>
                      <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Touchpoint type (ACTIONABLE only) */}
              {pf.meetingKind !== "PR" && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ marginBottom: 5, display: "block" }}>Touchpoint type *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([ ["Deal Meeting", "💼", "Updates pipeline & stage", "#1d5db4"], ["Relationship", "🤝", "Hi-hello · no pipeline impact", "#15803d"] ] as const).map(([tt, icon, sub, col]) => (
                      <button key={tt} onClick={() => setPf((p: PlanForm) => ({ ...p, touchpointType: tt }))}
                        style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${pf.touchpointType === tt ? col : C.border}`, background: pf.touchpointType === tt ? `${col}14` : "transparent", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: pf.touchpointType === tt ? col : C.text }}>{icon} {tt}</div>
                        <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Agency */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Agency</label>
                {allAgencies.length > 0
                  ? <select value={pf.agency} onChange={e => setPf((p: PlanForm) => ({ ...p, agency: e.target.value, client: "", brand: "" }))}
                      style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                      <option value="">— No agency —</option>
                      {allAgencies.map(a => <option key={a}>{a}</option>)}
                    </select>
                  : <input value={pf.agency} onChange={e => setPf((p: PlanForm) => ({ ...p, agency: e.target.value }))} placeholder="Agency name (optional)"
                      style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
                }
              </div>

              {/* Client */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Client *</label>
                {clientOptions.length > 0
                  ? <select value={pf.client} onChange={e => setPf((p: PlanForm) => ({ ...p, client: e.target.value, brand: "" }))}
                      style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                      <option value="">— Select client —</option>
                      {clientOptions.map(c => <option key={c}>{c}</option>)}
                    </select>
                  : <input value={pf.client} onChange={e => setPf((p: PlanForm) => ({ ...p, client: e.target.value }))} placeholder="Client / Advertiser *"
                      style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
                }
              </div>

              {/* Contact + Phone */}
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Contact Name *</label>
                  <input value={pf.contactName} onChange={e => setPf((p: PlanForm) => ({ ...p, contactName: e.target.value }))} placeholder="Person you'll meet"
                    style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Time</label>
                  <input type="time" value={pf.time} onChange={e => setPf((p: PlanForm) => ({ ...p, time: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Agenda */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Agenda</label>
                <input value={pf.agenda} onChange={e => setPf((p: PlanForm) => ({ ...p, agenda: e.target.value }))} placeholder="What will you discuss?"
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setAddPlanFor(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => doAddPlan(addPlanFor!, () => setAddPlanFor(null))}
                  disabled={!(pf.client || pf.agency).trim() || !pf.contactName.trim()}>
                  Plan This Meeting
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MyPlan;
