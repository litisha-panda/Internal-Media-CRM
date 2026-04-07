/**
 * LogMeeting — log-meeting modal/form for Sales Rep.
 *
 * Stateless with respect to form data: receives logForm + onChange callbacks.
 * On submit: calls onSubmit which triggers createTouchpoint via useTouchpoints.
 * No raw fetch() calls — data access via props and callbacks.
 */

import React from "react";
import { C } from "../../utils/palette";

export interface LogMeetingForm {
  repId: string;
  dealId: string;
  planId?: string;
  meetingDbId?: string;
  meetingTime?: string;
  meetingKind?: string;
  touchpointType?: string;
  clientAgencyName: string;
  agency?: string;
  client?: string;
  brand?: string;
  contactName?: string;
  mobile?: string;
  meetingType?: string;
  pitchType?: string;
  agenda?: string;
  stageUpdate?: string;
  status?: string;
  lossReason?: string;
  outcome?: string;
  discussion?: string;
  nextStep?: string;
  nextStepDate?: string;
  followUpDate?: string;
  nextMeetingDate?: string;
}

export interface LogMeetingProps {
  open: boolean;
  form: LogMeetingForm;
  deals: { id: string; clientCompany: string; repId: any }[];
  reps: { id: any; name: string }[];
  isAdmin?: boolean;
  onClose: () => void;
  onFormChange: (patch: Partial<LogMeetingForm>) => void;
  onSubmit: (form: LogMeetingForm) => void;
}

const STAGE_OPTIONS = ["Prospect", "In Discussion", "Negotiation", "Mail Confirmed", "RO Received", "Lost"];
const MEETING_TYPES = ["Physical", "Online", "Call"];
const PITCH_TYPES   = ["New Business", "Renewal", "Upsell", "Event", "Digital", "Other"];

export const LogMeeting: React.FC<LogMeetingProps> = ({
  open, form, deals, reps, isAdmin = false,
  onClose, onFormChange, onSubmit,
}) => {
  if (!open) return null;

  const myDeals = isAdmin ? deals : deals.filter(d => d.repId === form.repId || String(d.repId) === form.repId);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div className="sans" style={{ fontSize: 15, fontWeight: 700 }}>Log Touchpoint</div>
            {form.meetingTime && (
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                Planned: {form.meetingTime} · {form.clientAgencyName || ""}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        {/* Touchpoint Type */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Touchpoint Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Deal Meeting", "Relationship"] as const).map(tt => (
              <button key={tt} onClick={() => onFormChange({ touchpointType: tt })}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${form.touchpointType === tt ? C.blue : C.border}`, background: form.touchpointType === tt ? `${C.blue}14` : "transparent", cursor: "pointer", fontSize: 12, fontWeight: form.touchpointType === tt ? 700 : 400, color: form.touchpointType === tt ? C.blue : C.dim }}>
                {tt === "Deal Meeting" ? "💼 Deal Meeting" : "🤝 Relationship"}
              </button>
            ))}
          </div>
        </div>

        {/* Client */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Client / Agency *</label>
          {myDeals.length > 0 && !form.clientAgencyName && (
            <select value={form.dealId} onChange={e => {
              const d = deals.find(x => x.id === e.target.value);
              onFormChange({ dealId: e.target.value, clientAgencyName: d?.clientCompany || "" });
            }} style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, marginBottom: 6 }}>
              <option value="">— Select a deal —</option>
              {myDeals.map(d => <option key={d.id} value={d.id}>{d.clientCompany}</option>)}
            </select>
          )}
          <input value={form.clientAgencyName} onChange={e => onFormChange({ clientAgencyName: e.target.value })} placeholder="Client / Agency name"
            style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
        </div>

        {/* Contact */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Contact Name</label>
          <input value={form.contactName || ""} onChange={e => onFormChange({ contactName: e.target.value })} placeholder="Name of person you met"
            style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
        </div>

        {/* Meeting type */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Meeting Type</label>
            <select value={form.meetingType || "Physical"} onChange={e => onFormChange({ meetingType: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
              {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Pitch Type</label>
            <select value={form.pitchType || ""} onChange={e => onFormChange({ pitchType: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
              <option value="">—</option>
              {PITCH_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Stage update — only for Deal Meeting */}
        {form.touchpointType !== "Relationship" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Deal Stage Update</label>
            <select value={form.stageUpdate || ""} onChange={e => onFormChange({ stageUpdate: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
              <option value="">— No change —</option>
              {STAGE_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Loss reason */}
        {form.stageUpdate === "Lost" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Loss Reason *</label>
            <input value={form.lossReason || ""} onChange={e => onFormChange({ lossReason: e.target.value })} placeholder="Why was this deal lost?"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
        )}

        {/* Discussion notes */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Discussion / Notes</label>
          <textarea value={form.discussion || ""} onChange={e => onFormChange({ discussion: e.target.value })} rows={3} placeholder="What was discussed? Client feedback?"
            style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box", resize: "vertical" }} />
        </div>

        {/* Next step */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>Next Step</label>
            <input value={form.nextStep || ""} onChange={e => onFormChange({ nextStep: e.target.value })} placeholder="What needs to happen next?"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>📞 Follow-up Date</label>
            <input type="date" value={form.followUpDate || ""} onChange={e => onFormChange({ followUpDate: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>📅 Next Meeting</label>
            <input type="date" value={form.nextMeetingDate || ""} onChange={e => onFormChange({ nextMeetingDate: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.clientAgencyName?.trim()}
            onClick={() => onSubmit(form)}
          >
            ✓ Log Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogMeeting;
