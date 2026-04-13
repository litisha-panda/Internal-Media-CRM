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
  loginProvider: string;
  approvedTargetRows?: { agency: string; client: string; brand: string }[];
  onFormChange: React.Dispatch<React.SetStateAction<PlanForm>>;
  onSubmit: (date: string) => void;
  onClose: () => void;
}

export const AddPlanModal: React.FC<AddPlanModalProps> = ({
  forDate, form: pf, deals, loginProvider, approvedTargetRows,
  onFormChange: setPf, onSubmit: doAddPlan, onClose,
}) => {
  const rows = (approvedTargetRows && approvedTargetRows.length > 0) ? approvedTargetRows : null;
  const allAgencies = rows
    ? [...new Set(rows.map(r => r.agency).filter(Boolean))].sort()
    : [...new Set(deals.map(d => d.agencyName || d.agency || "").filter(Boolean))].sort();
  const clientsForAgency = rows
    ? (pf.agency ? rows.filter(r => r.agency.toLowerCase() === pf.agency.toLowerCase()).map(r => r.client) : rows.map(r => r.client))
    : (pf.agency ? deals.filter(d => (d.agencyName || d.agency || "").toLowerCase() === pf.agency.toLowerCase()).map(d => d.clientCompany) : deals.map(d => d.clientCompany));
  const clientOptions  = [...new Set(clientsForAgency)].sort();
  const brandsForClient = rows
    ? rows.filter(r => r.client.toLowerCase() === (pf.client || "").toLowerCase()).map(r => r.brand).filter(Boolean)
    : deals.filter(d => d.clientCompany.toLowerCase() === (pf.client || "").toLowerCase()).flatMap(d => [d.brand].filter((b): b is string => Boolean(b)));
  const brandOptions   = [...new Set(brandsForClient)].sort();

  const dateLabel = new Date(forDate + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" });

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

        {/* Meeting kind */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ marginBottom: 5, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Meeting kind *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {([ ["ACTIONABLE", "🎯", "Sales call · full details", "#1d5db4"], ["PR", "🤝", "Relationship · quick visit", "#15803d"] ] as [string, string, string, string][]).map(([mk, icon, sub, col]) => (
              <button key={mk} onClick={() => setPf(p => ({ ...p, meetingKind: mk, touchpointType: mk === "PR" ? "Relationship" : p.touchpointType }))}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${pf.meetingKind === mk ? col : C.border}`, background: pf.meetingKind === mk ? `${col}14` : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: pf.meetingKind === mk ? col : C.text }}>{icon} {mk === "ACTIONABLE" ? "Deal" : "PR"}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Touchpoint type (ACTIONABLE only) */}
        {pf.meetingKind !== "PR" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ marginBottom: 5, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Touchpoint type *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {([ ["Deal Meeting", "💼", "Updates pipeline & stage", "#1d5db4"], ["Relationship", "🤝", "Hi-hello · no pipeline impact", "#15803d"] ] as const).map(([tt, icon, sub, col]) => (
                <button key={tt} onClick={() => setPf(p => ({ ...p, touchpointType: tt }))}
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
          {rows
            ? (<select value={pf.agency} onChange={e => setPf(p => ({ ...p, agency: e.target.value, client: "", brand: "" }))}
                style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                <option value="">— No agency / Direct —</option>
                {allAgencies.map(a => <option key={a}>{a}</option>)}
              </select>)
            : allAgencies.length > 0
              ? <select value={pf.agency} onChange={e => setPf(p => ({ ...p, agency: e.target.value, client: "", brand: "" }))}
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                  <option value="">— No agency —</option>
                  {allAgencies.map(a => <option key={a}>{a}</option>)}
                </select>
              : <input value={pf.agency} onChange={e => setPf(p => ({ ...p, agency: e.target.value }))} placeholder="Agency name (optional)"
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          }
        </div>

        {/* Client */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Client *</label>
          {rows
            ? (<select value={pf.client} onChange={e => setPf(p => ({ ...p, client: e.target.value, brand: "" }))}
                style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${clientOptions.length===0?C.muted:C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                <option value="">— Select client —</option>
                {clientOptions.length === 0
                  ? <option value="" disabled>No approved targets yet — contact your Region Head</option>
                  : clientOptions.map(c => <option key={c}>{c}</option>)
                }
              </select>)
            : clientOptions.length > 0
              ? <select value={pf.client} onChange={e => setPf(p => ({ ...p, client: e.target.value, brand: "" }))}
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                  <option value="">— Select client —</option>
                  {clientOptions.map(c => <option key={c}>{c}</option>)}
                </select>
              : <input value={pf.client} onChange={e => setPf(p => ({ ...p, client: e.target.value }))} placeholder="Client / Advertiser *"
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          }
        </div>

        {/* Brand Name */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Brand Name</label>
          {rows
            ? (<select value={pf.brand} onChange={e => setPf(p => ({ ...p, brand: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                <option value="">— No specific brand —</option>
                {brandOptions.map(b => <option key={b}>{b}</option>)}
              </select>)
            : brandOptions.length > 0
              ? <select value={pf.brand} onChange={e => setPf(p => ({ ...p, brand: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
                  <option value="">— Select brand —</option>
                  {brandOptions.map(b => <option key={b}>{b}</option>)}
                </select>
              : <input value={pf.brand} onChange={e => setPf(p => ({ ...p, brand: e.target.value }))} placeholder="Brand (optional)"
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          }
        </div>

        {/* Contact Name + Time */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Contact Name *</label>
            <input value={pf.contactName} onChange={e => setPf(p => ({ ...p, contactName: e.target.value }))} placeholder="Person you'll meet"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Time</label>
            <input type="time" value={pf.time} onChange={e => setPf(p => ({ ...p, time: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Designation + Contact Email */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Designation</label>
            <input value={pf.designation} onChange={e => setPf(p => ({ ...p, designation: e.target.value }))} placeholder="e.g. Marketing Head"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Contact Email</label>
            <input type="email" value={pf.contactEmail} onChange={e => setPf(p => ({ ...p, contactEmail: e.target.value }))} placeholder="contact@brand.com"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Phone Number + Meeting Format */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Phone Number</label>
            <input type="tel" value={pf.phone} onChange={e => setPf(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210"
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Meeting Format</label>
            <select value={pf.meetingType} onChange={e => setPf(p => ({ ...p, meetingType: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text }}>
              <option>Physical</option>
              <option>Online</option>
              <option>Phone Call</option>
            </select>
          </div>
        </div>

        {/* Agenda */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ marginBottom: 4, display: "block", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Agenda</label>
          <input value={pf.agenda} onChange={e => setPf(p => ({ ...p, agenda: e.target.value }))} placeholder="What will you discuss?"
            style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
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
            disabled={!(pf.client || pf.agency).trim() || !pf.contactName.trim()}>
            Plan This Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlanModal;
