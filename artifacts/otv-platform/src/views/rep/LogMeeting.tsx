/**
 * LogMeeting — Log Touchpoint modal for Sales Rep.
 *
 * Complete extraction of the inline logOpen block from OTVApp.tsx.
 * All form state lives in OTVApp; this component is stateless and drives
 * mutation purely through typed callback props — no raw fetch() calls.
 */

import React from "react";
import { C, TODAY } from "../../utils/palette";

/* ── Shared narrow ID type ──────────────────────────────────────────────── */
type RepId = number | string | null | undefined;

/* ── Constants (mirrored from OTVApp module scope) ──────────────────────── */
const DEAL_STAGES    = ["Prospect", "In Discussion", "Negotiation", "Mail Confirmed", "RO Received", "Lost"];
const PITCH_TYPES    = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "IPs", "Others"];
const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation", "RO Received"];
const MEETING_TYPES  = ["Physical", "Online", "Phone Call"];
const ACTION_TYPES   = ["Approval needed", "Document needed", "Attend a meeting", "Introduction needed", "Flag for follow-up"];
const APPROVAL_TARGETS = ["Region Head", "NSH", "Branding Team", "Content Team", "Sales Strategy", "Digital", "Finance", "Legal", "CXO"];
const BLANK_ACTION_REQUIRED = { what: "", from: "", description: "", byWhen: "" };

const oColor = (s: string): string => ({
  "Prospect": "#7d8590",
  "In Discussion": "#4285F4",
  "Negotiation": "#f4b400",
  "Mail Confirmed": "#9c27b0",
  "RO Received": "#34a853",
  "Lost": "#ea4335",
} as Record<string, string>)[s] ?? "#7d8590";

/* ── ActionItem shape ───────────────────────────────────────────────────── */
interface ActionItem { what: string; from: string; description: string; byWhen: string; }

/* ── Entity shapes needed as prop dependencies ──────────────────────────── */
interface Deal {
  id: string; repId: RepId; clientCompany: string;
  contactName?: string; agency?: string; brand?: string; amount?: number;
  contactDesignation?: string; designation?: string; contactLevel?: string;
  phone?: string; mobile?: string;
}
interface Rep { id: RepId; name: string; region?: string; }
interface Plan {
  id: string; repId: RepId; date: string; time: string; status: string;
  clientAgencyName: string; contactName?: string; phone?: string; agenda?: string;
  pitchType?: string; meetingType?: string; meetingKind?: string; touchpointType?: string;
  autoCreatedFrom?: string; isUnplanned?: boolean; loggedMeetingId?: string | null;
  meetingDbId?: string; client?: string; agency?: string; brand?: string;
}

/* ── Typed setter ───────────────────────────────────────────────────────── */
type Setter<T> = (updater: T | ((prev: T) => T)) => void;

/* ── Full LogMeetingForm interface ──────────────────────────────────────── */
export interface LogMeetingForm {
  repId: string;
  dealId: string;
  planId?: string;
  meetingDbId?: string;
  meetingTime?: string;
  meetingKind?: string;
  touchpointType?: string;
  clientAgencyName?: string;
  agency?: string;
  client?: string;
  brand?: string;
  contactName?: string;
  mobile?: string;
  designation?: string;
  contactLevel?: string;
  meetingType?: string;
  pitchType?: string;
  agenda?: string;
  clientFeedback?: string;
  stageUpdate?: string;
  status?: string;
  lossReason?: string;
  outcome?: string;
  discussion?: string;
  nextStep?: string;
  nextStepDate?: string;
  followUpDate?: string;
  nextMeetingDate?: string;
  nextMeetingTime?: string;
  nextAgenda?: string;
  attendeeEmails?: string;
  scheduleNext?: boolean;
  calendarPlatform?: string;
  meetLink?: string;
  calendarEventId?: string;
  calendarStatus?: string;
  dealAmount?: string;
  actionRequired?: ActionItem[];
}

/* ── Props ─────────────────────────────────────────────────────────────── */
export interface LogMeetingProps {
  open: boolean;
  form: LogMeetingForm;
  /** Updater-style setter matching React's useState dispatcher. */
  onFormChange: (updater: (prev: LogMeetingForm) => LogMeetingForm) => void;
  deals: Deal[];
  reps: Rep[];
  isRep: boolean;
  myRepId: RepId;
  calendarLoading: boolean;
  onClose: () => void;
  /** Maps to handleLogMeetingWithCalendar in OTVApp. */
  onSubmit: () => void;
  /** Called when user clicks "→ Go to Revenue Log" after RO Received. */
  onNavigateRevenue: () => void;
  setPlans: Setter<Plan[]>;
  showToast: (msg: string) => void;
}

/* ── Component ─────────────────────────────────────────────────────────── */
export const LogMeeting: React.FC<LogMeetingProps> = ({
  open, form: logForm, onFormChange: setLogForm,
  deals, reps, isRep, myRepId,
  calendarLoading, onClose, onSubmit: handleLogMeetingWithCalendar,
  onNavigateRevenue, setPlans, showToast,
}) => {
  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 640, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div className="sans" style={{ fontSize: 16, fontWeight: 700 }}>LOG TOUCHPOINT</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{TODAY} · Today's Touchpoints</div>
          </div>
        </div>
        <div style={{ height: 1, background: C.border, margin: "12px 0" }} />

        {/* FROM PLAN strip (when triggered from a planned touchpoint) */}
        {logForm.planId ? (
          <div style={{ background: `${C.blue}08`, border: `1.5px solid ${C.blue}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>From Your Plan</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {logForm.clientAgencyName && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>CLIENT</div><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{logForm.clientAgencyName}</div></div>}
              {logForm.agency && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>AGENCY</div><div style={{ fontSize: 12, color: C.dim }}>{logForm.agency}</div></div>}
              {logForm.brand && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>BRAND</div><div style={{ fontSize: 12, color: C.dim }}>{logForm.brand}</div></div>}
              {logForm.contactName && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>CONTACT</div><div style={{ fontSize: 12, color: C.dim }}>{logForm.contactName}{logForm.mobile ? ` · ${logForm.mobile}` : ""}</div></div>}
              {logForm.meetingTime && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>TIME</div><div style={{ fontSize: 12, color: C.dim }}>{logForm.meetingTime}</div></div>}
              {logForm.meetingType && <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>HOW</div><div style={{ fontSize: 12, color: C.dim }}>{logForm.meetingType === "Physical" ? "🤝" : logForm.meetingType === "Online" ? "💻" : "📞"} {logForm.meetingType}</div></div>}
              <div><div style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 2 }}>TYPE</div><div style={{ fontSize: 12, color: logForm.touchpointType === "Deal Meeting" ? C.blue : C.green, fontWeight: 600 }}>{logForm.touchpointType === "Deal Meeting" ? "💼 Deal Meeting" : "🤝 Relationship"}</div></div>
            </div>
          </div>
        ) : (
          /* Standalone: touchpoint type selector */
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["Deal Meeting", "Relationship"] as const).map(tt => (
              <button key={tt} onClick={() => setLogForm(p => ({ ...p, touchpointType: tt }))}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 6, border: `1px solid ${logForm.touchpointType === tt ? (tt === "Deal Meeting" ? C.blue : C.green) : C.border}`, background: logForm.touchpointType === tt ? (tt === "Deal Meeting" ? `${C.blue}14` : `${C.green}14`) : "transparent", color: logForm.touchpointType === tt ? (tt === "Deal Meeting" ? C.blue : C.green) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                {tt === "Deal Meeting" ? "💼 Deal Meeting" : "🤝 Relationship"}
                <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2, color: "inherit", opacity: .8 }}>
                  {tt === "Deal Meeting" ? "Updates stage · Resets escalation clock" : "Hi-Hello · No pipeline impact"}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* SECTION 1 — Rep selector / Time */}
        {!logForm.planId && (
          isRep ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label>Time of Touchpoint</label>
                <input type="time" value={logForm.meetingTime || ""} onChange={e => setLogForm(p => ({ ...p, meetingTime: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label>Sales Rep *</label>
                {reps.length === 0 ? (
                  <div style={{ padding: "9px 12px", background: `${C.orange}12`, border: `1px solid ${C.orange}`, borderRadius: 6, color: C.orange, fontSize: 12 }}>No reps added yet — ask Admin to add reps first.</div>
                ) : (
                  <select value={logForm.repId} onChange={e => setLogForm(p => ({ ...p, repId: e.target.value }))}>
                    <option value="">Select rep</option>
                    {reps.map(r => <option key={String(r.id)} value={String(r.id)}>{r.name}{r.region ? ` · ${r.region}` : ""}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label>Meeting Time</label>
                <input type="time" value={logForm.meetingTime || ""} onChange={e => setLogForm(p => ({ ...p, meetingTime: e.target.value }))} />
              </div>
            </div>
          )
        )}

        {/* Meeting Type (standalone only) */}
        {!logForm.planId && (
          <div style={{ marginBottom: 14 }}>
            <label>Meeting Type</label>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {MEETING_TYPES.map(mt => (
                <button key={mt} onClick={() => setLogForm(p => ({ ...p, meetingType: mt }))}
                  style={{ flex: 1, padding: "7px 6px", fontSize: 11, borderRadius: 5, border: `1px solid ${logForm.meetingType === mt ? (mt === "Physical" ? C.green : mt === "Online" ? "#4285F4" : C.accent) : C.border}`, background: logForm.meetingType === mt ? (mt === "Physical" ? `${C.green}18` : mt === "Online" ? "#4285F418" : `${C.accent}18`) : "transparent", color: logForm.meetingType === mt ? (mt === "Physical" ? C.green : mt === "Online" ? "#4285F4" : C.accent) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all .1s", textAlign: "center" }}>
                  {mt === "Physical" ? "🤝" : mt === "Online" ? "💻" : "📞"} {mt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2 — Client / Agency / Brand (hidden when logging from plan) */}
        {!logForm.planId && <>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Client / Agency / Brand</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Agency Name</label>
              <input placeholder="e.g. Dentsu, Omnicom…" value={logForm.agency || ""} onChange={e => setLogForm(p => ({ ...p, agency: e.target.value }))} />
            </div>
            <div>
              <label>Client Name *</label>
              <select value={logForm.dealId} onChange={e => {
                const deal = deals.find(d => d.id === e.target.value);
                setLogForm(p => ({
                  ...p,
                  dealId: e.target.value,
                  clientAgencyName: deal?.clientCompany || "",
                  client: deal?.clientCompany || "",
                  agency: deal?.agency || p.agency,
                  brand: deal?.brand || p.brand,
                  contactName: deal?.contactName || p.contactName,
                  designation: deal?.contactDesignation || deal?.designation || p.designation,
                  contactLevel: deal?.contactLevel || p.contactLevel,
                  mobile: deal?.phone || deal?.mobile || p.mobile,
                }));
              }}>
                <option value="">Select from CRM</option>
                {deals
                  .filter(d => !logForm.repId || String(d.repId) === logForm.repId || Number(d.repId) === parseInt(logForm.repId))
                  .map(d => <option key={d.id} value={d.id}>{d.clientCompany}</option>)}
              </select>
              {!logForm.dealId && (
                <input placeholder="Or type client name…" value={logForm.client || ""} onChange={e => setLogForm(p => ({ ...p, client: e.target.value, clientAgencyName: e.target.value }))} style={{ marginTop: 4 }} />
              )}
            </div>
            <div>
              <label>Brand / Product</label>
              <input placeholder="e.g. Surf Excel, Maggi…" value={logForm.brand || ""} onChange={e => setLogForm(p => ({ ...p, brand: e.target.value }))} />
            </div>
          </div>

          {/* CRM link hint */}
          {!logForm.dealId && (
            <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}22`, borderRadius: 6, padding: "7px 10px", fontSize: 11, color: C.blue, marginBottom: 10 }}>
              Tip: Select a client from the CRM dropdown to auto-link this touchpoint to your pipeline deal.
            </div>
          )}

          {/* Deal value prompt */}
          {(() => {
            const selDeal = logForm.dealId ? deals.find(d => d.id === logForm.dealId) : null;
            if (!selDeal || (selDeal.amount && selDeal.amount > 0)) return null;
            return (
              <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}44`, borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Deal has no value — set it now so it appears in pipeline</div>
                <input placeholder="e.g. 15,00,000" value={logForm.dealAmount || ""} onChange={e => setLogForm(p => ({ ...p, dealAmount: e.target.value }))} style={{ fontSize: 12, width: "100%" }} />
              </div>
            );
          })()}

          {/* Contact details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div><label>Name of Person Met *</label><input placeholder="Full name" value={logForm.contactName || ""} onChange={e => setLogForm(p => ({ ...p, contactName: e.target.value }))} /></div>
            <div><label>Designation</label><input placeholder="e.g. VP Marketing" value={logForm.designation || ""} onChange={e => setLogForm(p => ({ ...p, designation: e.target.value }))} /></div>
            <div>
              <label>Contact Level</label>
              <select value={logForm.contactLevel || ""} onChange={e => setLogForm(p => ({ ...p, contactLevel: e.target.value }))}>
                <option value="">Select level</option>
                <option>C-Suite / Owner</option><option>VP / GM</option><option>Marketing Head</option>
                <option>Brand Manager</option><option>Agency Lead</option><option>Junior/Exec</option>
              </select>
            </div>
            <div><label>Mobile No</label><input placeholder="Contact number" value={logForm.mobile || ""} onChange={e => setLogForm(p => ({ ...p, mobile: e.target.value }))} /></div>
          </div>
        </>}

        {/* SECTION 3 — Touchpoint Content */}
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Touchpoint Content</div>
        {!logForm.planId && (
          <div style={{ marginBottom: 10 }}>
            <label>Pitch Type <span style={{ color: C.dim, fontWeight: 400 }}>(what did you pitch?)</span></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PITCH_TYPES.map(pt => (
                <button key={pt} onClick={() => setLogForm(p => ({ ...p, pitchType: pt }))}
                  style={{ padding: "5px 12px", fontSize: 11, borderRadius: 4, border: `1px solid ${logForm.pitchType === pt ? C.accent : C.border}`, background: logForm.pitchType === pt ? `${C.accent}22` : C.s2, color: logForm.pitchType === pt ? C.accent : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all .1s" }}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label>Discussion <span style={{ color: C.dim, fontWeight: 400 }}>(what happened in the meeting)</span></label>
          <textarea rows={3} placeholder="What did you discuss? Campaign ideas, budget conversations, client objections, brand insights..." value={logForm.discussion || ""} onChange={e => setLogForm(p => ({ ...p, discussion: e.target.value }))} style={{ resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label>Client Feedback <span style={{ color: C.dim, fontWeight: 400 }}>(what did the client say/react?)</span></label>
          <textarea rows={2} placeholder="Positive, hesitant, needs approval, competitor mentioned..." value={logForm.clientFeedback || ""} onChange={e => setLogForm(p => ({ ...p, clientFeedback: e.target.value }))} style={{ resize: "vertical" }} />
        </div>

        {/* SECTION 4 — Blockers / Help Needed */}
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Blockers / Help Needed <span style={{ fontWeight: 400, color: C.dim, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(optional)</span></div>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Something you need from another person or team to progress this deal. Each item auto-creates a tracked task + escalation.</div>
        <div style={{ background: `${C.purple}06`, border: `1.5px solid ${C.purple}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, marginBottom: 8 }}>Leave blank if no blockers — skip straight to Stage Update below.</div>
          {(logForm.actionRequired || [{ ...BLANK_ACTION_REQUIRED }]).map((item, idx) => (
            <div key={idx} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>What do I need? *</div>
                  <select value={item.what || ""} onChange={e => { const arr = [...(logForm.actionRequired || [])]; arr[idx] = { ...arr[idx], what: e.target.value }; setLogForm(p => ({ ...p, actionRequired: arr })); }}>
                    <option value="">Select type…</option>
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>Needed From *</div>
                  <select value={item.from || ""} onChange={e => { const arr = [...(logForm.actionRequired || [])]; arr[idx] = { ...arr[idx], from: e.target.value }; setLogForm(p => ({ ...p, actionRequired: arr })); }}>
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
                  <input maxLength={150} placeholder="What exactly is needed…" value={item.description || ""} onChange={e => { const arr = [...(logForm.actionRequired || [])]; arr[idx] = { ...arr[idx], description: e.target.value }; setLogForm(p => ({ ...p, actionRequired: arr })); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>By When *</div>
                  <input type="date" min="2020-01-01" max="2099-12-31" value={item.byWhen || ""} onChange={e => { const arr = [...(logForm.actionRequired || [])]; arr[idx] = { ...arr[idx], byWhen: e.target.value }; setLogForm(p => ({ ...p, actionRequired: arr })); }} />
                </div>
                <button onClick={() => { const arr = (logForm.actionRequired || []).filter((_, i) => i !== idx); setLogForm(p => ({ ...p, actionRequired: arr.length ? arr : [{ ...BLANK_ACTION_REQUIRED }] })); }}
                  style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, textAlign: "center", height: 34 }}>✕</button>
              </div>
              {item.what && item.from && (
                <div style={{ marginTop: 6, fontSize: 10, color: C.purple, fontWeight: 600 }}>
                  → Auto-creates task for <strong>{item.from}</strong>{item.byWhen ? ` · due ${item.byWhen}` : ""}. If overdue, escalates: RH → NSH → Strategy → CRO.
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setLogForm(p => ({ ...p, actionRequired: [...(p.actionRequired || []), { ...BLANK_ACTION_REQUIRED }] }))}
            style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 5, padding: "5px 14px", color: C.dim, fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace", marginTop: 4, width: "100%" }}>
            + Add another action item
          </button>
        </div>

        {/* Follow-up date + meeting status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label>Follow-Up Date <span style={{ color: C.dim, fontWeight: 400, fontSize: 10 }}>(when will YOU call/ping next?)</span></label>
            <input type="date" min="2020-01-01" max="2099-12-31" value={logForm.followUpDate || ""} onChange={e => setLogForm(p => ({ ...p, followUpDate: e.target.value }))} />
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Sets a reminder in your plan — no calendar invite sent</div>
          </div>
          <div>
            <label>Meeting Status</label>
            <select value={logForm.status || ""} onChange={e => { const s = e.target.value; setLogForm(p => ({ ...p, status: s, scheduleNext: s === "Rescheduled" ? true : p.scheduleNext })); }}>
              <option value="">Select</option>
              {MEETING_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Schedule Next Meeting */}
        <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}22`, borderRadius: 6, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setLogForm(p => ({ ...p, scheduleNext: !p.scheduleNext }))}
              style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${logForm.scheduleNext ? C.green : C.border}`, background: logForm.scheduleNext ? C.green : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
              {logForm.scheduleNext ? "✓" : ""}
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Schedule Next Meeting <span style={{ fontWeight: 400, color: C.dim, fontSize: 11 }}>— formal calendar invite</span></div>
              <div style={{ fontSize: 10, color: C.dim }}>Pick a date + time → creates Google/Zoho calendar event with a Meet link</div>
            </div>
          </div>
          {logForm.scheduleNext && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label>Meeting Date *</label><input type="date" min="2020-01-01" max="2099-12-31" value={logForm.nextMeetingDate || ""} onChange={e => setLogForm(p => ({ ...p, nextMeetingDate: e.target.value }))} /></div>
                <div><label>Meeting Time</label><input type="time" value={logForm.nextMeetingTime || ""} onChange={e => setLogForm(p => ({ ...p, nextMeetingTime: e.target.value }))} /></div>
                <div style={{ gridColumn: "1/-1" }}><label>Agenda for next meeting</label><textarea rows={2} placeholder="What will you go in with? e.g. Present revised FCT grid for Q2..." value={logForm.nextAgenda || ""} onChange={e => setLogForm(p => ({ ...p, nextAgenda: e.target.value }))} style={{ resize: "none" }} /></div>
                <div style={{ gridColumn: "1/-1" }}><label>Invite attendees (comma-separated emails)</label><input placeholder="e.g. client@brand.com, rh@odishatv.com" value={logForm.attendeeEmails || ""} onChange={e => setLogForm(p => ({ ...p, attendeeEmails: e.target.value }))} /></div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Calendar Platform</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { id: "google", label: "Google Calendar", icon: "📅", color: "#4285F4", desc: "Creates event + auto-generates Google Meet link" },
                    { id: "zoho",   label: "Zoho Calendar",   icon: "📆", color: "#e42527", desc: "Downloads .ics file — open to add to Zoho Calendar" },
                    { id: "none",   label: "No Calendar",     icon: "⊘",  color: "#7d8590", desc: "Schedule internally only, no calendar invite" },
                  ].map(cp => (
                    <button key={cp.id} onClick={() => setLogForm(p => ({ ...p, calendarPlatform: cp.id }))}
                      style={{ flex: 1, padding: "9px 10px", borderRadius: 6, border: `1px solid ${logForm.calendarPlatform === cp.id ? cp.color : C.border}`, background: logForm.calendarPlatform === cp.id ? `${cp.color}12` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 14, marginBottom: 2 }}>{cp.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: logForm.calendarPlatform === cp.id ? cp.color : C.text, fontFamily: "'DM Mono',monospace" }}>{cp.label}</div>
                      <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{cp.desc}</div>
                    </button>
                  ))}
                </div>
                {logForm.calendarStatus === "done" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `${C.green}10`, borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Calendar event created</div>
                      {logForm.meetLink && <a href={logForm.meetLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#4285F4", textDecoration: "none" }}>🎥 {logForm.meetLink}</a>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STAGE UPDATE (Deal Meeting only) */}
        {logForm.touchpointType === "Deal Meeting" && (
          <div style={{ marginBottom: 14, background: `${C.blue}08`, border: `1px solid ${C.blue}55`, borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Stage Update *</div>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Where is this deal now? Select one — updates pipeline and resets the escalation clock.</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {DEAL_STAGES.map(s => (
                <button key={s} onClick={() => setLogForm(p => ({ ...p, stageUpdate: s, status: s }))}
                  style={{ padding: "6px 14px", fontSize: 11, borderRadius: 4, border: `1px solid ${logForm.stageUpdate === s ? oColor(s) : C.border}`, background: logForm.stageUpdate === s ? `${oColor(s)}18` : C.s2, color: logForm.stageUpdate === s ? oColor(s) : C.dim, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: logForm.stageUpdate === s ? 700 : 400, transition: "all .1s" }}>
                  {s}
                </button>
              ))}
            </div>
            {logForm.stageUpdate === "Lost" && (
              <div style={{ marginTop: 10 }}>
                <label style={{ color: C.red, fontWeight: 700 }}>Loss Reason * <span style={{ fontWeight: 400, color: C.dim, fontSize: 10 }}>(required)</span></label>
                <select value={logForm.lossReason || ""} onChange={e => setLogForm(p => ({ ...p, lossReason: e.target.value }))} style={{ marginTop: 4, borderColor: !logForm.lossReason ? C.red : C.border }}>
                  <option value="">Select reason...</option>
                  <option>Budget cut / Budget not available</option><option>Went to competitor</option><option>Client postponed</option>
                  <option>No response / Client went silent</option><option>Decision not made</option><option>Price too high</option>
                  <option>Campaign cancelled</option><option>Agency overruled</option><option>Other</option>
                </select>
              </div>
            )}
            {logForm.stageUpdate === "RO Received" && (
              <div style={{ marginTop: 10, background: `${C.green}10`, border: `1px solid ${C.green}44`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>🎉 RO Received — great work!</div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>Log your revenue entry so it reflects in your pipeline right away.</div>
                <button onClick={onNavigateRevenue} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 5, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>→ Go to Revenue Log</button>
                <span style={{ fontSize: 10, color: C.dim, marginLeft: 8 }}>or finish logging touchpoint first, then add revenue after</span>
              </div>
            )}
            {logForm.stageUpdate === "Mail Confirmed" && (
              <div style={{ marginTop: 10, background: `${C.accent}10`, border: `1px solid ${C.accent}44`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 4 }}>Mail Confirmed — awaiting RO</div>
                <div style={{ fontSize: 11, color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
                  This commits the deal in pipeline but <strong>does NOT count as achieved revenue</strong>. Revenue is only booked once the RO is received and logged separately.
                </div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>Set a follow-up reminder so the RO doesn't slip:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[3, 5, 7].map(days => {
                    const rd = new Date(TODAY);
                    rd.setDate(rd.getDate() + days);
                    const reminderDate = rd.toISOString().slice(0, 10);
                    return (
                      <button key={days} onClick={() => {
                        setPlans((prev: Plan[]) => [...prev, {
                          id: `p_ro_${Date.now()}_${days}`,
                          repId: myRepId,
                          date: reminderDate,
                          time: "10:00",
                          clientAgencyName: logForm.clientAgencyName || logForm.client || "",
                          contactName: "",
                          phone: "",
                          agenda: `[RO Reminder] Follow up — RO not received yet`,
                          pitchType: "",
                          meetingType: "Task",
                          status: "Planned",
                          loggedMeetingId: null,
                          isUnplanned: false,
                          autoCreatedFrom: "ro-reminder",
                        }]);
                        showToast(`RO follow-up reminder set for +${days} days ✓`);
                      }} style={{ padding: "5px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                        +{days}d
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {calendarLoading && <span style={{ fontSize: 11, color: C.dim }}>Creating calendar event...</span>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleLogMeetingWithCalendar} disabled={calendarLoading}
            style={{ opacity: calendarLoading ? .6 : 1 }}>
            {calendarLoading ? "Creating..." : (logForm.scheduleNext && logForm.calendarPlatform !== "none") ? "LOG + CREATE CALENDAR EVENT" : "LOG TOUCHPOINT"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogMeeting;
