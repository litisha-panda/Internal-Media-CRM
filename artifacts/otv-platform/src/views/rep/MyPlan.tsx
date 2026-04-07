/**
 * MyPlan — monthly calendar, TODAY/TOMORROW compliance strip, meeting log.
 *
 * Owns meetings data via useMeetings hook. Manages plan-form and log-meeting
 * state internally. No raw data arrays accepted from OTVApp — only navigation
 * context and computed helpers are received as props.
 */

import React, { useState } from "react";
import { C, TODAY, TOMORROW } from "../../utils/palette";
import { useMeetings } from "../../hooks/useMeetings";
import type { Meeting } from "../../services/api/meetings";
import { PlanCalendar } from "../../components/plan/PlanCalendar";
import { PlanCard } from "../../components/plan/PlanCard";
import type { PlanCardPlan } from "../../components/plan/PlanCard";
import { AddPlanModal } from "../../components/plan/AddPlanModal";
import { LogMeeting } from "./LogMeeting";
import type { Touchpoint } from "../../services/api/touchpoints";

/* ── Shared narrow ID type ─────────────────────────────────────────────── */
type RepId = number | string | null | undefined;

/* ── Entity shapes ─────────────────────────────────────────────────────── */
interface Deal {
  id: string;
  repId?: RepId;
  clientCompany: string;
  stage?: string;
  outcome?: string;
  awaitingApproval?: string;
  nextStep?: string;
  amount?: number;
  agencyName?: string;
  agency?: string;
  brand?: string;
  contactName?: string;
  contactDesignation?: string;
  designation?: string;
  contactLevel?: string;
  phone?: string;
  mobile?: string;
}

interface Rep { id: RepId; name: string; region?: string; }

/* ── Plan form for AddPlanModal ─────────────────────────────────────────── */
export interface PlanForm {
  agency:         string;
  client:         string;
  brand:          string;
  contactName:    string;
  phone:          string;
  time:           string;
  agenda:         string;
  pitchType:      string;
  meetingType:    string;
  touchpointType: string;
  meetingKind:    string;
  needsMeet:      boolean;
  syncToCalendar: boolean;
  calPlatform:    string;
}

const BLANK_PLAN_FORM: PlanForm = {
  agency: "", client: "", brand: "", contactName: "", phone: "",
  time: "10:00", agenda: "", pitchType: "", meetingType: "Physical",
  touchpointType: "Deal Meeting", meetingKind: "ACTIONABLE",
  needsMeet: false, syncToCalendar: false, calPlatform: "none",
};

/* ── Typed setter ───────────────────────────────────────────────────────── */
type Setter<T> = (updater: T | ((prev: T) => T)) => void;

/* ── Props — minimal; views own their data via hooks ───────────────────── */
export interface MyPlanProps {
  userRole:       { repId?: RepId; id?: string; role?: string; region?: string } | null;
  activeUser:     string;
  loginProvider:  string;
  isRep:          boolean;
  isNSH:          boolean;
  isRH:           boolean;
  isStrategy:     boolean;
  isCRORole:      boolean;
  isAdmin:        boolean;
  isDigiOps:      boolean;
  deals:          Deal[];
  filterQ:        string;
  adminConfig:    { inactivityDaysRisk?: number } | null;
  reps:           Rep[];
  countdown:      string;
  setDealForm:    Setter<Record<string, unknown>>;
  setAddDealOpen: (v: boolean) => void;
  setViewMeetingId: (id: string) => void;
  showToast:      (msg: string, type?: string) => void;
  qMatch:         (q: string) => boolean;
  BLANK_DEAL:     Record<string, unknown>;
  onNavigate:     (view: string) => void;
  onNavigateRevenue: () => void;
}

/* ── Component ─────────────────────────────────────────────────────────── */
export const MyPlan: React.FC<MyPlanProps> = (props) => {
  const {
    userRole, activeUser, loginProvider,
    isRep, isNSH, isRH, isStrategy, isCRORole, isAdmin, isDigiOps,
    deals, filterQ,
    reps, countdown,
    setDealForm, setAddDealOpen,
    setViewMeetingId, showToast,
    BLANK_DEAL,
    onNavigate, onNavigateRevenue,
  } = props;
  void isNSH; void isRH; // received for role context; main plan view handles them naturally

  /* Own meetings data via hook */
  const { meetings, createMeeting, patchMeeting, refetch: refetchMeetings } = useMeetings();

  /* Local UI state */
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calDayView,    setCalDayView]    = useState<string | null>(null);
  const [myPlanTab,     setMyPlanTab]     = useState<"plan" | "log">("plan");
  const [addPlanFor,    setAddPlanFor]    = useState<string | null>(null);
  const [planForm,      setPlanForm]      = useState<PlanForm>(BLANK_PLAN_FORM);
  const [logOpen,       setLogOpen]       = useState(false);
  const [logMeeting,    setLogMeeting]    = useState<Meeting | null>(null);

  const openLog = (m: Meeting | null) => { setLogMeeting(m); setLogOpen(true); };
  const closeLog = () => { setLogOpen(false); setLogMeeting(null); };

  const myRepId      = userRole?.repId;
  const myPlanRepId  = myRepId ?? userRole?.id;

  /* Rep-scope deal filter: AddPlanModal & LogMeeting see only this rep's deals */
  const myDeals = myRepId != null
    ? deals.filter(d => d.repId == null || String(d.repId) === String(myRepId))
    : deals;

  const isMyMeeting = (m: Meeting) => {
    if (m.userId != null) {
      /* Compare as strings to avoid NaN when userRole.id is a non-numeric string */
      return String(m.userId) === String(userRole?.id ?? "");
    }
    return myRepId != null ? String(m.repId) === String(myRepId) : false;
  };

  /* Derive my plans from meetings */
  const myMeetingPlans = meetings.filter(m =>
    (String(m.repId) === String(myPlanRepId) || (userRole?.id && String(m.userId ?? "") === String(userRole.id))) &&
    m.status !== "cancelled"
  );

  const todayPlans  = myMeetingPlans.filter(p => p.date === TODAY);
  const tmrwPlans   = myMeetingPlans.filter(p => p.date === TOMORROW);
  const todayLogged = meetings.some(m => isMyMeeting(m) && m.date === TODAY && m.status === "logged");

  /* Weekly deadline timer */
  const now = new Date();
  const daysUntilSat = (6 - now.getDay() + 7) % 7;
  const satDeadline = new Date(now);
  satDeadline.setDate(now.getDate() + daysUntilSat);
  satDeadline.setHours(23, 30, 0, 0);
  const weeklyDiffMs = satDeadline.getTime() - now.getTime();
  const weeklyH = Math.floor(weeklyDiffMs / 3600000);
  const weeklyM = Math.floor((weeklyDiffMs % 3600000) / 60000);
  const weeklyLabel = weeklyDiffMs <= 0 ? "Past weekly deadline" : `${weeklyH}h ${weeklyM}m left`;

  /* ── doAddPlan — creates meeting + optional calendar sync ─────────── */
  const doAddPlan = async (date: string, onSuccess?: () => void) => {
    const pf = planForm;
    if (!pf.agency.trim() && !pf.client.trim()) {
      showToast("Enter client or agency name", "err"); return;
    }
    const planTime = pf.time || "10:00";
    const clientName = (pf.client || pf.agency || "").trim();
    const didSyncCalendar = pf.syncToCalendar;

    /* Calendar sync — opens external calendar link / downloads ICS */
    if (pf.syncToCalendar) {
      const [hStr, mStr] = planTime.split(":");
      const h = parseInt(hStr || "10"); const m = parseInt(mStr || "0");
      const endH = String(h + 1).padStart(2, "0"); const endM = String(m).padStart(2, "0");
      const startH = String(h).padStart(2, "0");
      const dateParts = date.replace(/-/g, "");
      const title   = encodeURIComponent(`[OTV] Meeting: ${clientName}`);
      const details = encodeURIComponent(`Contact: ${pf.contactName.trim()}${pf.agenda ? "\nAgenda: " + pf.agenda : ""}${pf.brand ? "\nBrand: " + pf.brand : ""}`);
      if (pf.calPlatform === "google") {
        const startDT = `${dateParts}T${startH}${endM}00`;
        const endDT   = `${dateParts}T${endH}${endM}00`;
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDT}/${endDT}&details=${details}`, "_blank");
      } else if (pf.calPlatform === "zoho") {
        const ics = [
          "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OTV CRM//EN", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
          "BEGIN:VEVENT",
          `DTSTART:${dateParts}T${startH}${endM}00`,
          `DTEND:${dateParts}T${endH}${endM}00`,
          `SUMMARY:[OTV] Meeting: ${clientName}`,
          `DESCRIPTION:Contact: ${pf.contactName.trim()}${pf.agenda ? "\\nAgenda: " + pf.agenda : ""}`,
          `UID:otv-${Date.now()}@odishatv.com`,
          "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
        ].join("\r\n");
        const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `OTV-${clientName.replace(/\s+/g, "-")}.ics`;
        a.click();
      } else if (pf.calPlatform === "outlook") {
        const startISO = `${date}T${startH}:${endM}:00`;
        const endISO   = `${date}T${endH}:${endM}:00`;
        window.open(`https://outlook.office.com/calendar/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(startISO)}&enddt=${encodeURIComponent(endISO)}&body=${details}`, "_blank");
      }
    }

    try {
      await createMeeting({
        repId:        Number(myPlanRepId) || null,
        region:       userRole?.region || "",
        date,
        time:         planTime,
        meetingKind:  pf.meetingKind || "ACTIONABLE",
        agencyName:   pf.agency || "",
        clientName,
        brandName:    pf.brand  || "",
        contactName:  pf.contactName || "",
        contactPhone: pf.phone || null,
        mode:         pf.meetingType || "Physical",
        agenda:       pf.agenda || "",
        status:       "planned",
      });
      showToast(didSyncCalendar ? "Meeting planned ✓ · Calendar opening…" : "Meeting planned ✓");
      /* Keep calPlatform/syncToCalendar/meetingKind sticky; clear the rest */
      setPlanForm(p => ({ ...BLANK_PLAN_FORM, syncToCalendar: p.syncToCalendar, calPlatform: p.calPlatform, meetingKind: p.meetingKind, touchpointType: p.touchpointType }));
      onSuccess?.();
    } catch {
      showToast("Failed to add meeting — please try again", "err");
    }
  };

  /* ── Admin / DigiOps: no personal plan view ───────────────────────── */
  if (isAdmin || isDigiOps) {
    return (
      <div className="fin" style={{ textAlign: "center", padding: 60, color: C.dim }}>
        <div className="sans" style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>My Plan</div>
        <div style={{ fontSize: 12 }}>Personal plan view is available for Sales Reps, NSH, and Region Heads.</div>
      </div>
    );
  }

  /* ── Strategy/CRO: monthly read-only overview ─────────────────────── */
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
            if (!byRep[key]) byRep[key] = { repId: m.repId, repName: reps.find(r => String(r.id) === key)?.name || "Rep " + m.repId, count: 0, clients: new Set() };
            byRep[key].count++;
            if (m.clientName) byRep[key].clients.add(m.clientName);
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

  /* ── Plan chips for calendar ──────────────────────────────────────── */
  const planChips: PlanCardPlan[] = myMeetingPlans.map(m => {
    const linkedDeal = deals.find(d =>
      String(d.repId) === String(myRepId) &&
      (d.clientCompany || "").toLowerCase() === ((m.clientName || m.agencyName) || "").toLowerCase()
    );
    const blocked      = !!(linkedDeal?.awaitingApproval && m.status !== "logged");
    const dealNextStep = linkedDeal?.nextStep || null;
    const chipStatus   = m.status === "logged" ? "Done"
                       : m.status === "missed" ? "Missed"
                       : m.date < TODAY && m.status === "planned" ? "Missed"
                       : "Planned";
    return {
      id:              m.id,
      repId:           m.repId,
      date:            m.date,
      time:            m.time,
      status:          chipStatus,
      clientAgencyName: m.clientName || m.agencyName || "",
      contactName:     m.contactName || undefined,
      phone:           (m.contactPhone as string) || undefined,
      agenda:          m.agenda || undefined,
      pitchType:       undefined,
      meetingType:     m.mode || undefined,
      meetingKind:     m.meetingKind || undefined,
      touchpointType:  m.meetingKind === "PR" ? "Relationship" : "Deal Meeting",
      autoCreatedFrom: undefined,
      isUnplanned:     false,
      loggedMeetingId: m.status === "logged" ? m.id : null,
      meetingDbId:     m.id,
      client:          m.clientName || undefined,
      agency:          m.agencyName || undefined,
      brand:           m.brandName  || undefined,
      blocked,
      dealNextStep,
    };
  });

  const handlePlanTap = (p: PlanCardPlan) => {
    const m = meetings.find(m => m.id === p.id);
    if (!m) return;
    if (p.status === "Done") {
      setViewMeetingId(m.id);
    } else if (p.date > TODAY) {
      showToast(`This meeting is on ${p.date}. Come back on the day to log it.`);
    } else {
      openLog(m);
    }
  };

  const handleLogSubmit = (tp: Touchpoint) => {
    /* Patch the source meeting status to "logged" (MyPlan owns meeting state).
       LogMeeting creates the touchpoint; MyPlan owns the meeting status change. */
    if (logMeeting) {
      patchMeeting(logMeeting.id, { status: "logged", touchpointId: tp.id }).catch(() => { /* non-fatal */ });
    }
    refetchMeetings();
    closeLog();
  };

  /* ── Main render ──────────────────────────────────────────────────── */
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
          <button onClick={() => openLog(null)}
            style={{ flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Log Touchpoint
          </button>
          <button onClick={() => { setDealForm(p => ({ ...p, ...BLANK_DEAL, repId: String(myRepId || ""), quarter: filterQ })); setAddDealOpen(true); }}
            style={{ flex: 1, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            + Add Deal
          </button>
        </div>
      )}

      {/* TODAY / TOMORROW compliance strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {([
          { label: "TODAY",    date: TODAY,    dayList: todayPlans, logged: todayLogged },
          { label: "TOMORROW", date: TOMORROW, dayList: tmrwPlans,  logged: tmrwPlans.length > 0 },
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
              {dayList.map(m => {
                const chip = planChips.find(c => c.id === m.id);
                if (!chip) return null;
                return <PlanCard key={m.id} plan={chip} isOpen={false} onTap={handlePlanTap} />;
              })}
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
        const myMeetings = meetings.filter(m => isMyMeeting(m) && m.status === "logged").sort((a, b) => (b.date > a.date ? 1 : -1));
        const outcomeColor = (o: string) =>
          o?.includes("Accepted")   ? C.green :
          o?.includes("Interested") ? C.blue  :
          o?.includes("Concern") || o?.includes("Objection") ? C.orange :
          o?.includes("Not")   || o?.includes("Lost") ? C.red : C.dim;
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
                  {myMeetings.map(m => {
                    const loggedAt = (m as Record<string, unknown>)["loggedAt"] as string | undefined;
                    const late     = (m as Record<string, unknown>)["late"]     as boolean | undefined;
                    const outcome  = (m as Record<string, unknown>)["outcome"]  as string | undefined;
                    const discussion = (m as Record<string, unknown>)["discussion"] as string | undefined;
                    const nextStep = (m as Record<string, unknown>)["nextStep"] as string | undefined;
                    const contactLevel = (m as Record<string, unknown>)["contactLevel"] as string | undefined;
                    return (
                      <tr key={m.id} style={{ borderBottom: `1px solid ${C.s2}`, cursor: "pointer" }}
                        onClick={() => setViewMeetingId(m.id)}
                        onMouseOver={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.s2; }}
                        onMouseOut={e =>  { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: m.date === TODAY ? C.accent : C.text }}>{m.date === TODAY ? "Today" : m.date}</div>
                          {loggedAt && <div style={{ fontSize: 10, color: C.dim }}>logged {loggedAt}</div>}
                          {late     && <div style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>LATE</div>}
                        </td>
                        <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 600, fontSize: 12 }}>{m.clientName || "—"}</div></td>
                        <td style={{ padding: "10px 14px", color: C.dim, fontSize: 11 }}>
                          <div>{m.contactName || "—"}</div>
                          {contactLevel && <div style={{ fontSize: 9, color: C.muted }}>{contactLevel}</div>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 11, color: outcomeColor(outcome || ""), fontWeight: 600 }}>{outcome || "—"}</span>
                        </td>
                        <td style={{ padding: "10px 14px", maxWidth: 200 }}>
                          <div style={{ fontSize: 11, color: C.dim, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{discussion || "—"}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.dim, maxWidth: 150 }}>{nextStep || "—"}</td>
                      </tr>
                    );
                  })}
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
      {addPlanFor && (
        <AddPlanModal
          forDate={addPlanFor}
          form={planForm}
          deals={myDeals}
          loginProvider={loginProvider}
          onFormChange={setPlanForm}
          onSubmit={(date) => doAddPlan(date, () => setAddPlanFor(null))}
          onClose={() => setAddPlanFor(null)}
        />
      )}

      {/* Log Meeting Modal — open for any role that can reach My Plan (rep, NSH, RH) */}
      {logOpen && (
        <LogMeeting
          open={logOpen}
          meeting={logMeeting}
          onClose={closeLog}
          onSubmit={handleLogSubmit}
          userRole={userRole}
          deals={myDeals}
          showToast={showToast}
          onNavigateRevenue={onNavigateRevenue}
        />
      )}
    </div>
  );
};

export default MyPlan;
