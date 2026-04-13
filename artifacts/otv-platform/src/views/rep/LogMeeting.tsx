/**
 * LogMeeting — Log Touchpoint modal for Sales Rep.
 *
 * Accepts a `meeting` prop (the meeting being logged) and an
 * `onSubmit(touchpoint)` callback. Manages all form state internally.
 * Uses useTouchpoints to POST on submit; uses useMeetings to patch
 * meeting status to "logged" after the touchpoint is created.
 */

import React, { useState, useEffect } from "react";
import { C, TODAY } from "../../utils/palette";
import { DEAL_STAGES } from "../../constants";
import { useTouchpoints } from "../../hooks/useTouchpoints";
import { useMeetings } from "../../hooks/useMeetings";
import { useTasks } from "../../hooks/useTasks";
import * as irSvc from "../../services/api/internalRequests";
import type { Meeting } from "../../services/api/meetings";
import type { Touchpoint } from "../../services/api/touchpoints";

/* ── Shared narrow ID type ──────────────────────────────────────────────── */
type RepId = number | string | null | undefined;

/* ── Constants ──────────────────────────────────────────────────────────── */
const PITCH_TYPES    = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "IPs", "Others"];
const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation"];
const MEETING_TYPES  = ["Physical", "Online", "Phone Call"];
const ACTION_TYPES   = ["Approval needed", "Document needed", "Attend a meeting", "Introduction needed", "Flag for follow-up"];
const APPROVAL_TARGETS = ["Region Head", "NSH", "Branding Team", "Content Team", "Sales Strategy", "Digital", "Finance", "Legal", "CXO"];

const BLANK_ACTION = { what: "", from: "", description: "", byWhen: "" };

const oColor = (s: string): string => ({
  "Quotation":           "#7d8590",
  "Rate Card":           "#4285F4",
  "Negotiation":         "#f4b400",
  "Some Other Solution": "#9c27b0",
  "Meeting with Senior": "#00acc1",
  "Follow Up":           "#ff6d00",
  "Proposal":            "#34a853",
} as Record<string, string>)[s] ?? "#7d8590";

/* ── Local form type ────────────────────────────────────────────────────── */
interface ActionItem { what: string; from: string; description: string; byWhen: string; }

interface LogForm {
  repId: string;
  dealId: string;
  meetingDbId: string;
  meetingTime: string;
  meetingKind: string;
  touchpointType: string;
  clientAgencyName: string;
  agency: string;
  client: string;
  brand: string;
  contactName: string;
  mobile: string;
  designation: string;
  contactLevel: string;
  meetingType: string;
  pitchType: string;
  agenda: string;
  clientFeedback: string;
  stageUpdate: string;
  status: string;
  lossReason: string;
  discussion: string;
  nextStep: string;
  followUpDate: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
  nextAgenda: string;
  attendeeEmails: string;
  scheduleNext: boolean;
  calendarPlatform: string;
  meetLink: string;
  calendarStatus: string;
  dealAmount: string;
  actionRequired: ActionItem[];
}

const BLANK_FORM: LogForm = {
  repId: "", dealId: "", meetingDbId: "", meetingTime: "", meetingKind: "ACTIONABLE",
  touchpointType: "Deal Meeting", clientAgencyName: "", agency: "", client: "", brand: "",
  contactName: "", mobile: "", designation: "", contactLevel: "",
  meetingType: "Physical", pitchType: "", agenda: "", clientFeedback: "",
  stageUpdate: "", status: "", lossReason: "", discussion: "", nextStep: "", followUpDate: "",
  nextMeetingDate: "", nextMeetingTime: "", nextAgenda: "", attendeeEmails: "",
  scheduleNext: false, calendarPlatform: "none", meetLink: "", calendarStatus: "",
  dealAmount: "", actionRequired: [{ ...BLANK_ACTION }],
};

/* ── Deal entity needed for dropdown ───────────────────────────────────── */
interface Deal {
  id: string; repId?: RepId; clientCompany: string;
  contactName?: string; agency?: string; brand?: string; amount?: number;
  contactDesignation?: string; designation?: string; contactLevel?: string;
  phone?: string; mobile?: string;
}

/* ── Props ─────────────────────────────────────────────────────────────── */
export interface LogMeetingProps {
  open: boolean;
  /** The meeting/plan being logged. Null for a standalone (unplanned) touchpoint. */
  meeting: Meeting | null;
  onClose: () => void;
  /** Called with the created Touchpoint after successful submit. */
  onSubmit: (tp: Touchpoint) => void;
  userRole: { repId?: RepId; region?: string } | null;
  deals: Deal[];
  showToast: (msg: string, type?: string) => void;
  /** Optional: navigate to revenue log when user clicks "→ Go to Revenue Log". */
  onNavigateRevenue?: () => void;
}

/* ── Component ─────────────────────────────────────────────────────────── */
export const LogMeeting: React.FC<LogMeetingProps> = ({
  open, meeting, onClose, onSubmit,
  userRole, deals, showToast, onNavigateRevenue,
}) => {
  const { createTouchpoint } = useTouchpoints();
  const { createMeeting } = useMeetings();
  const { createTask } = useTasks();

  const [form, setForm] = useState<LogForm>({ ...BLANK_FORM });
  const [submitting, setSubmitting] = useState(false);

  const setF = (updater: Partial<LogForm> | ((prev: LogForm) => LogForm)) => {
    setForm(prev =>
      typeof updater === "function"
        ? updater(prev)
        : { ...prev, ...updater }
    );
  };

  /* Pre-fill form when meeting changes or modal opens */
  useEffect(() => {
    if (!open) return;
    if (meeting) {
      setForm({
        ...BLANK_FORM,
        repId:           String(meeting.repId ?? userRole?.repId ?? ""),
        meetingDbId:     meeting.id,
        meetingTime:     meeting.time || "",
        meetingKind:     meeting.meetingKind || "ACTIONABLE",
        touchpointType:  meeting.meetingKind === "PR" ? "Relationship" : "Deal Meeting",
        clientAgencyName: meeting.clientName || meeting.agencyName || "",
        agency:          meeting.agencyName || "",
        client:          meeting.clientName || "",
        brand:           meeting.brandName  || "",
        contactName:     meeting.contactName || "",
        mobile:          (meeting.contactPhone as string) || "",
        meetingType:     meeting.mode || "Physical",
        agenda:          meeting.agenda || "",
      });
    } else {
      setForm({ ...BLANK_FORM, repId: String(userRole?.repId ?? "") });
    }
  }, [open, meeting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isFromPlan = !!meeting;
  const myRepId    = userRole?.repId;

  const handleSubmit = async () => {
    if (!form.repId) { showToast("Rep ID required", "err"); return; }
    if (!form.clientAgencyName?.trim() && !form.dealId) {
      showToast("Select a client deal or enter a client company name", "err"); return;
    }
    if (form.touchpointType === "Deal Meeting" && !form.stageUpdate && !form.status) {
      showToast("Select a stage update for this deal meeting", "err"); return;
    }
    if (form.stageUpdate === "Lost" && !form.lossReason?.trim()) {
      showToast("Select a loss reason before saving", "err"); return;
    }
    setSubmitting(true);
    try {
      const actionItems = (form.actionRequired || [])
        .filter(i => i.what && i.from)
        .map(i => ({ action: i.what, neededFrom: i.from, dueDate: i.byWhen, notes: i.description }));

      const tp = await createTouchpoint({
        repId:          parseInt(form.repId) || null,
        region:         userRole?.region || "",
        date:           TODAY,
        touchpointType: form.touchpointType || "Deal Meeting",
        whatHappened:   form.discussion    || null,
        clientFeedback: form.clientFeedback || null,
        stageUpdate:    form.stageUpdate   || null,
        actionItems,
        notes:          form.nextStep      || null,
        clientCompany:  form.clientAgencyName || form.client || "",
        dealId:         form.dealId        || null,
        contactName:    form.contactName   || null,
        meetingType:    form.meetingType   || null,
        meetingKind:    form.meetingKind   || null,
        pitchType:      form.pitchType     || null,
        followUpDate:   form.followUpDate  || null,
        nextMeetingDate: form.nextMeetingDate || null,
        nextMeetingTime: form.nextMeetingTime || null,
        nextAgenda:     form.nextAgenda    || null,
        lossReason:     form.lossReason    || null,
      });

      /* Meeting status patch is handled by the parent view (MyPlan.handleLogSubmit),
         which owns the meeting state. LogMeeting's responsibility is the touchpoint only. */

      /* Auto-create tasks from action items (preserves OTVApp inline behavior) */
      const repIdInt        = parseInt(form.repId) || null;
      const clientCompany   = form.clientAgencyName || form.client || "";
      const urRaw           = userRole as Record<string, unknown> | null;
      const loggedByName    = (urRaw?.["name"] as string) || form.repId || "Rep";
      const loggedByUserNum = parseInt((urRaw?.["id"] as string) || "") || null;
      const loggedByUserId  = loggedByUserNum;
      const TOMORROW_DATE   = new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10);

      const taskPromises: Promise<unknown>[] = [];

      (form.actionRequired || [])
        .filter(i => i.what && i.from)
        .forEach(i => {
          const aType   = i.what;
          const details = i.description || "";
          const dueDate = i.byWhen || TOMORROW_DATE;
          const ts      = `t${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

          if (i.from === "Self") {
            /* Self-assigned task */
            taskPromises.push(
              createTask({
                id: ts, assignedToUserId: loggedByUserId, assignedDept: "Self",
                repId: repIdInt, clientCompany,
                title: `${aType} — ${clientCompany} — ${details} — by ${dueDate}`.slice(0, 160),
                description: details, priority: "High", status: "Open",
                dueDate, createdAt: TODAY, assignedBy: loggedByName,
                fromMeetingLog: true, touchpointId: tp.id,
              } as Parameters<typeof createTask>[0]).catch(() => { /* non-fatal */ })
            );
          } else if (i.from !== "Client") {
            /* Cross-department task + internal request */
            const irSubject = `${aType} — ${clientCompany} — ${details} — by ${dueDate} — from ${loggedByName}`.slice(0, 160);
            taskPromises.push(
              createTask({
                id: `t_${aType.slice(0,4).toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                assignedDept: i.from, repId: repIdInt, clientCompany,
                title: irSubject,
                description: details, priority: "High", status: "Open",
                dueDate, createdAt: TODAY, assignedBy: loggedByName,
                fromMeetingLog: true, touchpointId: tp.id,
              } as Parameters<typeof createTask>[0]).catch(() => { /* non-fatal */ })
            );
            /* FIX 8: IR creation — surface failure as toast instead of silent drop */
            irSvc.createIR({
              title: irSubject, description: details, priority: "High",
              status: "Open", dueDate, assignedDept: i.from,
              repId: repIdInt ?? undefined, clientCompany,
              requestedBy: loggedByName,
            }).catch(() => {
              showToast(`⚠️ Internal request to ${i.from} could not be created — follow up manually`, "err");
            });
          }
        });

      /* If no action items but nextStep text exists, create a self-task */
      if (!taskPromises.length && form.nextStep?.trim()) {
        taskPromises.push(
          createTask({
            id: `t_ns_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            assignedToUserId: loggedByUserId, assignedDept: "Self",
            repId: repIdInt, clientCompany,
            title: `${form.nextStep.trim()}${clientCompany ? ` — ${clientCompany}` : ""}`.slice(0, 160),
            description: form.nextStep.trim(), priority: "High", status: "Open",
            dueDate: form.followUpDate || TOMORROW_DATE,
            createdAt: TODAY, assignedBy: loggedByName,
            fromMeetingLog: true, touchpointId: tp.id,
          } as Parameters<typeof createTask>[0]).catch(() => { /* non-fatal */ })
        );
      }

      /* Wait for all task creates before showing success toast */
      await Promise.allSettled(taskPromises);

      const taskCount = taskPromises.length;
      const taskMsg   = taskCount > 0 ? ` · ${taskCount} task${taskCount > 1 ? "s" : ""} assigned` : "";
      showToast(`Touchpoint logged ✓${taskMsg}`);
      onSubmit(tp);
      onClose();
    } catch {
      showToast("Failed to save touchpoint — please try again", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetROReminder = (days: number) => {
    const rd = new Date(TODAY);
    rd.setDate(rd.getDate() + days);
    const reminderDate = rd.toISOString().slice(0, 10);
    createMeeting({
      repId:       parseInt(form.repId) || null,
      region:      userRole?.region || "",
      date:        reminderDate,
      time:        "10:00",
      meetingKind: "ACTIONABLE",
      agencyName:  form.agency      || "",
      clientName:  form.client      || form.clientAgencyName || "",
      brandName:   form.brand       || "",
      contactName: form.contactName || "",
      contactPhone: null,
      mode:        "Task",
      agenda:      "[RO Reminder] Follow up — RO not received yet",
      status:      "planned",
    }).then(() => showToast(`RO follow-up reminder set for +${days} days ✓`))
      .catch(() => showToast("Reminder failed to save", "err"));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 640, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div className="sans" style={{ fontSize: 16, fontWeight: 700 }}>LOG TOUCHPOINT</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{TODAY} · Today's Touchpoints</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ height: 1, background: C.border, margin: "12px 0" }} />

        {/* FROM PLAN strip (when triggered from a planned touchpoint) */}
        {isFromPlan ? (
          <div style={{ background: `${C.blue}08`, border: `1.5px solid ${C.blue}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>From Your Plan</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {form.clientAgencyName && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>CLIENT</div><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{form.clientAgencyName}</div></div>}
              {form.agency     && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>AGENCY</div><div style={{ fontSize: 12, color: C.dim }}>{form.agency}</div></div>}
              {form.brand      && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>BRAND</div><div style={{ fontSize: 12, color: C.dim }}>{form.brand}</div></div>}
              {form.contactName && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>CONTACT</div><div style={{ fontSize: 12, color: C.dim }}>{form.contactName}{form.mobile ? ` · ${form.mobile}` : ""}</div></div>}
              {form.meetingTime && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>TIME</div><div style={{ fontSize: 12, color: C.dim }}>{form.meetingTime}</div></div>}
              {form.meetingType && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>HOW</div><div style={{ fontSize: 12, color: C.dim }}>{form.meetingType === "Physical" ? "🤝" : form.meetingType === "Online" ? "💻" : "📞"} {form.meetingType}</div></div>}
              <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>TYPE</div><div style={{ fontSize: 12, color: form.touchpointType === "Deal Meeting" ? C.blue : C.green, fontWeight: 600 }}>{form.touchpointType === "Deal Meeting" ? "💼 Deal Meeting" : "🤝 Relationship"}</div></div>
            </div>
          </div>
        ) : (
          /* Standalone: touchpoint type selector */
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["Deal Meeting", "Relationship"] as const).map(tt => (
              <button key={tt} onClick={() => setF({ touchpointType: tt })}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 6, border: `1px solid ${form.touchpointType === tt ? (tt === "Deal Meeting" ? C.blue : C.green) : C.border}`, background: form.touchpointType === tt ? (tt === "Deal Meeting" ? `${C.blue}14` : `${C.green}14`) : "transparent", color: form.touchpointType === tt ? (tt === "Deal Meeting" ? C.blue : C.green) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                {tt === "Deal Meeting" ? "💼 Deal Meeting" : "🤝 Relationship"}
                <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2, color: "inherit", opacity: .8 }}>
                  {tt === "Deal Meeting" ? "Updates stage · Resets escalation clock" : "Hi-Hello · No pipeline impact"}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Time + Meeting Type (standalone only) */}
        {!isFromPlan && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label>Time of Touchpoint</label>
                <input type="time" value={form.meetingTime} onChange={e => setF({ meetingTime: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label>Meeting Type</label>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {MEETING_TYPES.map(mt => (
                  <button key={mt} onClick={() => setF({ meetingType: mt })}
                    style={{ flex: 1, padding: "7px 6px", fontSize: 11, borderRadius: 5, border: `1px solid ${form.meetingType === mt ? (mt === "Physical" ? C.green : mt === "Online" ? "#4285F4" : C.accent) : C.border}`, background: form.meetingType === mt ? (mt === "Physical" ? `${C.green}18` : mt === "Online" ? "#4285F418" : `${C.accent}18`) : "transparent", color: form.meetingType === mt ? (mt === "Physical" ? C.green : mt === "Online" ? "#4285F4" : C.accent) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all .1s", textAlign: "center" }}>
                    {mt === "Physical" ? "🤝" : mt === "Online" ? "💻" : "📞"} {mt}
                  </button>
                ))}
              </div>
            </div>

            {/* Client / Agency / Brand */}
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Client / Agency / Brand</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label>Agency Name</label>
                <input placeholder="e.g. Dentsu, Omnicom…" value={form.agency} onChange={e => setF({ agency: e.target.value })} />
              </div>
              <div>
                <label>Client Name *</label>
                <select value={form.dealId} onChange={e => {
                  const deal = deals.find(d => d.id === e.target.value);
                  setF({
                    dealId:          e.target.value,
                    clientAgencyName: deal?.clientCompany || "",
                    client:           deal?.clientCompany || "",
                    agency:           deal?.agency || form.agency,
                    brand:            deal?.brand  || form.brand,
                    contactName:      deal?.contactName || form.contactName,
                    designation:      deal?.contactDesignation || deal?.designation || form.designation,
                    contactLevel:     deal?.contactLevel || form.contactLevel,
                    mobile:           deal?.phone || deal?.mobile || form.mobile,
                  });
                }}>
                  <option value="">Select from CRM</option>
                  {deals
                    .filter(d => !form.repId || String(d.repId) === form.repId || Number(d.repId) === parseInt(form.repId))
                    .map(d => <option key={d.id} value={d.id}>{d.clientCompany}</option>)}
                </select>
                {!form.dealId && (
                  <input placeholder="Or type client name…" value={form.client} onChange={e => setF({ client: e.target.value, clientAgencyName: e.target.value })} style={{ marginTop: 4 }} />
                )}
              </div>
              <div>
                <label>Brand / Product</label>
                <input placeholder="e.g. Surf Excel, Maggi…" value={form.brand} onChange={e => setF({ brand: e.target.value })} />
              </div>
            </div>
            {!form.dealId && (
              <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}22`, borderRadius: 6, padding: "7px 10px", fontSize: 11, color: C.blue, marginBottom: 10 }}>
                Tip: Select a client from the CRM dropdown to auto-link this touchpoint to your pipeline deal.
              </div>
            )}
            {/* Deal value prompt */}
            {(() => {
              const selDeal = form.dealId ? deals.find(d => d.id === form.dealId) : null;
              if (!selDeal || (selDeal.amount && selDeal.amount > 0)) return null;
              return (
                <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}44`, borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Deal has no value — set it now so it appears in pipeline</div>
                  <input placeholder="e.g. 15,00,000" value={form.dealAmount} onChange={e => setF({ dealAmount: e.target.value })} style={{ fontSize: 12, width: "100%" }} />
                </div>
              );
            })()}
            {/* Contact details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label>Name of Person Met *</label><input placeholder="Full name" value={form.contactName} onChange={e => setF({ contactName: e.target.value })} /></div>
              <div><label>Designation</label><input placeholder="e.g. VP Marketing" value={form.designation} onChange={e => setF({ designation: e.target.value })} /></div>
              <div>
                <label>Contact Level</label>
                <select value={form.contactLevel} onChange={e => setF({ contactLevel: e.target.value })}>
                  <option value="">Select level</option>
                  <option>C-Suite / Owner</option><option>VP / GM</option><option>Marketing Head</option>
                  <option>Brand Manager</option><option>Agency Lead</option><option>Junior/Exec</option>
                </select>
              </div>
              <div><label>Mobile No</label><input placeholder="Contact number" value={form.mobile} onChange={e => setF({ mobile: e.target.value })} /></div>
            </div>
          </>
        )}

        {/* SECTION 3 — Touchpoint Content */}
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Touchpoint Content</div>
        {!isFromPlan && (
          <div style={{ marginBottom: 10 }}>
            <label>Pitch Type <span style={{ color: C.dim, fontWeight: 400 }}>(what did you pitch?)</span></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PITCH_TYPES.map(pt => (
                <button key={pt} onClick={() => setF({ pitchType: pt })}
                  style={{ padding: "5px 12px", fontSize: 11, borderRadius: 4, border: `1px solid ${form.pitchType === pt ? C.accent : C.border}`, background: form.pitchType === pt ? `${C.accent}22` : C.s2, color: form.pitchType === pt ? C.accent : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all .1s" }}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label>Discussion <span style={{ color: C.dim, fontWeight: 400 }}>(what happened in the meeting)</span></label>
          <textarea rows={3} placeholder="What did you discuss? Campaign ideas, budget conversations, client objections, brand insights..." value={form.discussion} onChange={e => setF({ discussion: e.target.value })} style={{ resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label>Client Feedback <span style={{ color: C.dim, fontWeight: 400 }}>(how did the client react?)</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              "Positive — keen to move forward",
              "Hesitant — needs more information",
              "Needs internal approval from client side",
              "Competitor mentioned / under competitor pressure",
              "Budget concerns raised",
              "Not interested at this stage",
            ].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setF({ clientFeedback: form.clientFeedback === opt ? "" : opt })}
                style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  border: `1.5px solid ${form.clientFeedback === opt ? C.accent : C.border}`,
                  background: form.clientFeedback === opt ? `${C.accent}18` : "transparent",
                  color: form.clientFeedback === opt ? C.accent : C.text,
                  fontWeight: form.clientFeedback === opt ? 700 : 400,
                }}
              >{opt}</button>
            ))}
          </div>
        </div>

        {/* SECTION 4 — Blockers / Help Needed */}
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Blockers / Help Needed <span style={{ fontWeight: 400, color: C.dim, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(optional)</span></div>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Something you need from another person or team to progress this deal. Each item auto-creates a tracked task + escalation.</div>
        <div style={{ background: `${C.purple}06`, border: `1.5px solid ${C.purple}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, marginBottom: 8 }}>Leave blank if no blockers — skip straight to Stage Update below.</div>
          {(form.actionRequired || [{ ...BLANK_ACTION }]).map((item, idx) => (
            <div key={idx} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>What do I need? *</div>
                  <select value={item.what || ""} onChange={e => { const arr = [...(form.actionRequired || [])]; arr[idx] = { ...arr[idx], what: e.target.value }; setF({ actionRequired: arr }); }}>
                    <option value="">Select type…</option>
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>Needed From *</div>
                  <select value={item.from || ""} onChange={e => { const arr = [...(form.actionRequired || [])]; arr[idx] = { ...arr[idx], from: e.target.value }; setF({ actionRequired: arr }); }}>
                    <option value="">Department / person…</option>
                    <optgroup label="Internal Departments">{APPROVAL_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>
                    <optgroup label="Self"><option value="Self">Myself</option></optgroup>
                    <optgroup label="Client"><option value="Client">Client</option></optgroup>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 28px", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>Description <span style={{ fontWeight: 400, color: C.muted }}>(max 150 chars)</span></div>
                  <input maxLength={150} placeholder="What exactly is needed…" value={item.description || ""} onChange={e => { const arr = [...(form.actionRequired || [])]; arr[idx] = { ...arr[idx], description: e.target.value }; setF({ actionRequired: arr }); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>By When *</div>
                  <input type="date" min="2020-01-01" max="2099-12-31" value={item.byWhen || ""} onChange={e => { const arr = [...(form.actionRequired || [])]; arr[idx] = { ...arr[idx], byWhen: e.target.value }; setF({ actionRequired: arr }); }} />
                </div>
                <button onClick={() => { const arr = (form.actionRequired || []).filter((_, i) => i !== idx); setF({ actionRequired: arr.length ? arr : [{ ...BLANK_ACTION }] }); }}
                  style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, textAlign: "center", height: 34 }}>✕</button>
              </div>
              {item.what && item.from && (
                <div style={{ marginTop: 6, fontSize: 10, color: C.purple, fontWeight: 600 }}>
                  → Auto-creates task for <strong>{item.from}</strong>{item.byWhen ? ` · due ${item.byWhen}` : ""}. If overdue, escalates: RH → NSH → Strategy → CRO.
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setF({ actionRequired: [...(form.actionRequired || []), { ...BLANK_ACTION }] })}
            style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 5, padding: "5px 14px", color: C.dim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace", marginTop: 4, width: "100%" }}>
            + Add another action item
          </button>
        </div>

        {/* Follow-up date + meeting status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label>Follow-Up Date <span style={{ color: C.dim, fontWeight: 400, fontSize: 10 }}>(when will YOU call/ping next?)</span></label>
            <input type="date" min="2020-01-01" max="2099-12-31" value={form.followUpDate} onChange={e => setF({ followUpDate: e.target.value })} />
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Sets a reminder in your plan — no calendar invite sent</div>
          </div>
          <div>
            <label>Meeting Status</label>
            <select value={form.status} onChange={e => { const s = e.target.value; setF({ status: s, scheduleNext: s === "Rescheduled" ? true : form.scheduleNext }); }}>
              <option value="">Select</option>
              {MEETING_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Schedule Next Meeting */}
        <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}22`, borderRadius: 6, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setF({ scheduleNext: !form.scheduleNext })}
              style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${form.scheduleNext ? C.green : C.border}`, background: form.scheduleNext ? C.green : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
              {form.scheduleNext ? "✓" : ""}
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Schedule Next Meeting <span style={{ fontWeight: 400, color: C.dim, fontSize: 11 }}>— formal calendar invite</span></div>
              <div style={{ fontSize: 10, color: C.dim }}>Pick a date + time → creates Google/Zoho calendar event with a Meet link</div>
            </div>
          </div>
          {form.scheduleNext && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label>Meeting Date *</label><input type="date" min="2020-01-01" max="2099-12-31" value={form.nextMeetingDate} onChange={e => setF({ nextMeetingDate: e.target.value })} /></div>
                <div><label>Meeting Time</label><input type="time" value={form.nextMeetingTime} onChange={e => setF({ nextMeetingTime: e.target.value })} /></div>
                <div style={{ gridColumn: "1/-1" }}><label>Agenda for next meeting</label><textarea rows={2} placeholder="What will you go in with? e.g. Present revised FCT grid for Q2..." value={form.nextAgenda} onChange={e => setF({ nextAgenda: e.target.value })} style={{ resize: "none" }} /></div>
                <div style={{ gridColumn: "1/-1" }}><label>Invite attendees (comma-separated emails)</label><input placeholder="e.g. client@brand.com, rh@odishatv.com" value={form.attendeeEmails} onChange={e => setF({ attendeeEmails: e.target.value })} /></div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Calendar Platform</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { id: "google", label: "Google Calendar", icon: "📅", color: "#4285F4", desc: "Creates event + auto-generates Google Meet link" },
                    { id: "none",   label: "No Calendar",     icon: "⊘",  color: "#7d8590", desc: "Schedule internally only, no calendar invite" },
                  ].map(cp => (
                    <button key={cp.id} onClick={() => setF({ calendarPlatform: cp.id })}
                      style={{ flex: 1, padding: "9px 10px", borderRadius: 6, border: `1px solid ${form.calendarPlatform === cp.id ? cp.color : C.border}`, background: form.calendarPlatform === cp.id ? `${cp.color}12` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 14, marginBottom: 2 }}>{cp.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: form.calendarPlatform === cp.id ? cp.color : C.text, fontFamily: "'DM Mono',monospace" }}>{cp.label}</div>
                      <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{cp.desc}</div>
                    </button>
                  ))}
                </div>
                {form.calendarStatus === "done" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `${C.green}10`, borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Calendar event created</div>
                      {form.meetLink && <a href={form.meetLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#4285F4", textDecoration: "none" }}>🎥 {form.meetLink}</a>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STAGE UPDATE (Deal Meeting only) */}
        {form.touchpointType === "Deal Meeting" && (
          <div style={{ marginBottom: 14, background: `${C.blue}08`, border: `1px solid ${C.blue}55`, borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Stage Update *</div>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Where is this deal now? Select one — updates pipeline and resets the escalation clock.</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {DEAL_STAGES.map(s => (
                <button key={s} onClick={() => setF({ stageUpdate: s, status: s })}
                  style={{ padding: "6px 14px", fontSize: 11, borderRadius: 4, border: `1px solid ${form.stageUpdate === s ? oColor(s) : C.border}`, background: form.stageUpdate === s ? `${oColor(s)}18` : C.s2, color: form.stageUpdate === s ? oColor(s) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: form.stageUpdate === s ? 700 : 400, transition: "all .1s" }}>
                  {s}
                </button>
              ))}
            </div>
            {form.stageUpdate === "Lost" && (
              <div style={{ marginTop: 10 }}>
                <label style={{ color: C.red, fontWeight: 700 }}>Loss Reason * <span style={{ fontWeight: 400, color: C.dim, fontSize: 10 }}>(required)</span></label>
                <select value={form.lossReason} onChange={e => setF({ lossReason: e.target.value })} style={{ marginTop: 4, borderColor: !form.lossReason ? C.red : C.border }}>
                  <option value="">Select reason...</option>
                  <option>Budget cut / Budget not available</option><option>Went to competitor</option><option>Client postponed</option>
                  <option>No response / Client went silent</option><option>Decision not made</option><option>Price too high</option>
                  <option>Campaign cancelled</option><option>Agency overruled</option><option>Other</option>
                </select>
              </div>
            )}
            {form.stageUpdate === "RO Received" && (
              <div style={{ marginTop: 10, background: `${C.green}10`, border: `1px solid ${C.green}44`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>🎉 RO Received — great work!</div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>Log your revenue entry so it reflects in your pipeline right away.</div>
                {onNavigateRevenue && (
                  <button onClick={onNavigateRevenue} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 5, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>→ Go to Revenue Log</button>
                )}
                <span style={{ fontSize: 10, color: C.dim, marginLeft: 8 }}>or finish logging touchpoint first, then add revenue after</span>
              </div>
            )}
            {form.stageUpdate === "Mail Confirmed" && (
              <div style={{ marginTop: 10, background: `${C.accent}10`, border: `1px solid ${C.accent}44`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 4 }}>Mail Confirmed — awaiting RO</div>
                <div style={{ fontSize: 11, color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
                  This commits the deal in pipeline but <strong>does NOT count as achieved revenue</strong>. Revenue is only booked once the RO is received and logged separately.
                </div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>Set a follow-up reminder so the RO doesn't slip:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[3, 5, 7].map(days => (
                    <button key={days} onClick={() => handleSetROReminder(days)}
                      style={{ padding: "5px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                      +{days}d
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {submitting && <span style={{ fontSize: 11, color: C.dim }}>Saving...</span>}
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}
            style={{ opacity: submitting ? .6 : 1 }}>
            {submitting ? "Saving..." : (form.scheduleNext && form.calendarPlatform !== "none") ? "LOG + CREATE CALENDAR EVENT" : "LOG TOUCHPOINT"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogMeeting;
