/**
 * AddPlanModal — "Plan This Meeting" form. Stateless.
 *
 * Receives all form state and callbacks via props.
 * No API calls, no hooks inside component.
 */

import React from "react";
import { C } from "../../utils/palette";
import type { PlanForm } from "../../views/rep/MyPlan";

/** DB columns return integers; form fields use strings. Both are valid rep IDs. */
type RepId = number | string | null | undefined;
interface Deal { id: string; clientCompany: string; repId?: RepId; agencyName?: string; agency?: string; brand?: string; }

export interface AddPlanModalProps {
  forDate: string;
  form: PlanForm;
  deals: Deal[];
  approvedTargetRows?: { quarter: string; agency: string; client: string; brand: string }[];
  onFormChange: React.Dispatch<React.SetStateAction<PlanForm>>;
  onSubmit: (date: string) => void;
  onClose: () => void;
}

const PITCH_TYPES = ["TV", "TV+Digital", "Brand Solution", "IP"] as const;

export const AddPlanModal: React.FC<AddPlanModalProps> = ({
  forDate, form: pf, deals, approvedTargetRows,
  onFormChange: setPf, onSubmit: doAddPlan, onClose,
}) => {
  const rows = approvedTargetRows !== undefined ? approvedTargetRows : null;

  const allAgencies = rows != null
    ? [...new Set(rows.map(r => r.agency).filter(Boolean))].sort()
    : [...new Set(deals.map(d => d.agencyName || d.agency || "").filter(Boolean))].sort();
  const clientsForAgency = rows != null
    ? (pf.agency && pf.agency !== "NA" ? rows.filter(r => r.agency.toLowerCase() === pf.agency.toLowerCase()).map(r => r.client) : rows.map(r => r.client))
    : (pf.agency && pf.agency !== "NA" ? deals.filter(d => (d.agencyName || d.agency || "").toLowerCase() === pf.agency.toLowerCase()).map(d => d.clientCompany) : deals.map(d => d.clientCompany));
  const clientOptions   = [...new Set(clientsForAgency)].sort();
  const brandsForClient = rows != null
    ? rows.filter(r => r.client.toLowerCase() === (pf.client || "").toLowerCase()).map(r => r.brand).filter(Boolean)
    : deals.filter(d => d.clientCompany.toLowerCase() === (pf.client || "").toLowerCase()).flatMap(d => [d.brand].filter((b): b is string => Boolean(b)));
  const brandOptions    = [...new Set(brandsForClient)].sort();

  const dateLabel = new Date(forDate + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`,
    borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4,
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div className="sans" style={{ fontSize: 15, fontWeight: 700 }}>Plan Touchpoint</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{dateLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        {/* Agency */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Agency</label>
          <select value={pf.agency} onChange={e => setPf(p => ({ ...p, agency: e.target.value, client: "", brand: "" }))}
            style={inputStyle}>
            <option value="">— No agency / Direct —</option>
            <option value="NA">NA</option>
            {allAgencies.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>

        {/* Client */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Client *</label>
          {clientOptions.length > 0
            ? <select value={pf.client} onChange={e => setPf(p => ({ ...p, client: e.target.value, brand: "" }))} style={inputStyle}>
                <option value="">— Select client —</option>
                {clientOptions.map(c => <option key={c}>{c}</option>)}
              </select>
            : <input value={pf.client} onChange={e => setPf(p => ({ ...p, client: e.target.value }))} placeholder="Client / Advertiser *" style={inputStyle} />
          }
        </div>

        {/* Brand */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Brand Name</label>
          {brandOptions.length > 0
            ? <select value={pf.brand} onChange={e => setPf(p => ({ ...p, brand: e.target.value }))} style={inputStyle}>
                <option value="">— No specific brand —</option>
                {brandOptions.map(b => <option key={b}>{b}</option>)}
              </select>
            : <input value={pf.brand} onChange={e => setPf(p => ({ ...p, brand: e.target.value }))} placeholder="Brand (optional)" style={inputStyle} />
          }
        </div>

        {/* Pitch Type */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Pitch Type</label>
          <select value={pf.pitchType} onChange={e => setPf(p => ({ ...p, pitchType: e.target.value }))} style={inputStyle}>
            <option value="">— Select pitch type —</option>
            {PITCH_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </select>
        </div>

        {/* Time */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Time</label>
          <input type="time" value={pf.time} onChange={e => setPf(p => ({ ...p, time: e.target.value }))} style={inputStyle} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Notes</label>
          <input value={pf.agenda} onChange={e => setPf(p => ({ ...p, agenda: e.target.value }))} placeholder="Any notes or agenda points…"
            style={inputStyle} />
        </div>

        {/* Contact Name */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Contact Name</label>
          <input value={pf.contactName} onChange={e => setPf(p => ({ ...p, contactName: e.target.value }))} placeholder="Person you'll meet"
            style={inputStyle} />
        </div>

        {/* Phone + Meeting Format */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Phone Number</label>
            <input type="tel" value={pf.phone} onChange={e => setPf(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210"
              style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Meeting Format</label>
            <select value={pf.meetingType} onChange={e => setPf(p => ({ ...p, meetingType: e.target.value }))} style={inputStyle}>
              <option>Physical</option>
              <option>Online</option>
              <option>Phone Call</option>
            </select>
          </div>
        </div>

        {/* Calendar sync */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setPf(p => ({ ...p, syncToCalendar: !p.syncToCalendar, calPlatform: p.calPlatform || "google" }))}
              style={{ width: 16, height: 16, borderRadius: 3, border: `1px solid ${pf.syncToCalendar ? "#4285F4" : C.border}`, background: pf.syncToCalendar ? "#4285F4" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, flexShrink: 0 }}>
              {pf.syncToCalendar ? "✓" : ""}
            </button>
            <span style={{ fontSize: 12, color: pf.syncToCalendar ? C.text : C.dim, fontWeight: 600 }}>Also add to my calendar</span>
            {!pf.syncToCalendar && <span style={{ fontSize: 10, color: C.dim }}>(Google Calendar recommended)</span>}
          </div>
          {pf.syncToCalendar && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "google",  label: "Google Calendar", icon: "📅", color: "#4285F4" },
                { id: "outlook", label: "Outlook",          icon: "📧", color: "#0078D4" },
              ].map(cp => (
                <button key={cp.id} onClick={() => setPf(p => ({ ...p, calPlatform: cp.id }))}
                  style={{ padding: "5px 12px", fontSize: 11, borderRadius: 5, border: `1px solid ${pf.calPlatform === cp.id ? cp.color : C.border}`, background: pf.calPlatform === cp.id ? `${cp.color}18` : "transparent", color: pf.calPlatform === cp.id ? cp.color : C.dim, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  {cp.icon} {cp.label}
                </button>
              ))}
              <span style={{ fontSize: 10, color: C.muted, lineHeight: "28px", paddingLeft: 4 }}>Opens in new tab</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => doAddPlan(forDate)}
            disabled={!(pf.client || pf.agency).trim()}>
            Plan This Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlanModal;
