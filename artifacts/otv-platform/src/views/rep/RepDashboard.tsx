/**
 * RepDashboard — KPI strip, alerts, today's meetings, quick actions.
 *
 * Receives all shared data via props (already fetched by hooks in CROApp).
 * Owns only its local UI state (revenue log quick-entry modal).
 * No raw fetch() calls — all data comes from props.
 */

import React, { useState } from "react";
import { C, TODAY, fmtR } from "../../utils/palette";

const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26", "FY26 Annual"];

interface Meeting { id: string; repId: any; date: string; time?: string; status?: string; clientName?: string; agencyName?: string; mode?: string; meetingKind?: string; }
interface Task    { id: string; assignedTo?: any; assignedToUserId?: string; repId?: any; status: string; dueDate?: string; }
interface IR      { id: string; status: string; raisedBy: string; }
interface TargetSub { repId: any; quarter: string; status: string; totalTarget?: number; }
interface RevEntry  { repId: any; quarter: string; amount?: number; isReversed?: boolean; reversalOf?: string; }

export interface RepDashboardProps {
  userRole: { repId?: any; id?: string } | null;
  activeUser: string;
  currentQ: string;
  annualTgt: number;
  ach: number;
  comm: number;
  inpl: number;
  sf: number;
  pct: number;
  qTarget: number;
  qAch: number;
  targetApprovalStatus: "none" | "pending" | "approved";
  meetings: Meeting[];
  tasks: Task[];
  internalReqs: IR[];
  targetSubs: TargetSub[];
  revenueEntries: RevEntry[];
  hrBadge: number | null;
  stackedBar: (target: number, ach: number, comm: number, inpl: number, sf: number, mt?: number) => React.ReactNode;
  parseCurrency: (v: string | number) => number;
  onLogRevenue: (entry: { clientName: string; amount: string; invoiceRef: string; date: string }) => void;
  onNavigate: (view: string) => void;
  onOpenLogTouchpoint: () => void;
  onOpenAddDeal: () => void;
}

export const RepDashboard: React.FC<RepDashboardProps> = ({
  userRole, activeUser, currentQ,
  annualTgt, ach, comm, inpl, sf, pct,
  qTarget, qAch, targetApprovalStatus,
  meetings, tasks, internalReqs, hrBadge,
  stackedBar,
  onLogRevenue, onNavigate, onOpenLogTouchpoint, onOpenAddDeal,
}) => {
  const [dashRevOpen, setDashRevOpen] = useState(false);
  const [drf, setDashRevForm] = useState({ clientName: "", amount: "", invoiceRef: "", date: TODAY });

  const myRepId      = userRole?.repId;
  const todayMeetings = meetings.filter(m => m.repId === myRepId && m.date === TODAY);
  const plannedToday  = todayMeetings.length;
  const pendingTasks  = tasks.filter(t =>
    (t.assignedTo === myRepId || t.assignedToUserId === activeUser) && t.status !== "Done"
  ).length;
  const pendingIRs    = internalReqs.filter(r => r.status !== "Done" && r.raisedBy === activeUser).length;

  const Card = ({ label, value, sub = null, color = C.text }: { label: string; value: string; sub?: string | null; color?: string }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.dim, fontFamily: "'DM Sans',sans-serif", letterSpacing: .5, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{sub}</div>}
    </div>
  );

  const Alert = ({ icon, msg, color = C.accent, onClick = null as (() => void) | null, cta = null as string | null }: { icon: string; msg: string; color?: string; onClick?: (() => void) | null; cta?: string | null }) => (
    <div onClick={onClick ?? undefined} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: color + "12", border: `1px solid ${color}33`, borderRadius: 8, cursor: onClick ? "pointer" : "default", marginBottom: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>{msg}</span>
      {cta && <span style={{ fontSize: 11, color, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>{cta} →</span>}
    </div>
  );

  const QA = ({ icon, label, view: v }: { icon: string; label: string; view: string }) => (
    <div
      onClick={() => onNavigate(v)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", flex: 1, minWidth: 0, transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px #1d5db420"}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </div>
  );

  const doSubmit = () => {
    if (!drf.clientName.trim() || !drf.amount.trim() || !drf.invoiceRef.trim()) return;
    onLogRevenue(drf);
    setDashRevOpen(false);
    setDashRevForm({ clientName: "", amount: "", invoiceRef: "", date: TODAY });
  };

  return (
    <div className="fin">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'DM Sans',sans-serif", margin: 0 }}>My Dashboard</h2>
        <p style={{ fontSize: 12, color: C.dim, fontFamily: "'DM Sans',sans-serif", margin: "4px 0 0" }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Card label="Annual Target"     value={fmtR(annualTgt)} sub={targetApprovalStatus === "pending" ? "Pending approval" : targetApprovalStatus === "none" ? "Not set yet" : undefined} color={C.blue} />
        <Card label={`${currentQ} Target`} value={qTarget > 0 ? fmtR(qTarget) : "—"} sub={qTarget > 0 ? `Achieved ${fmtR(qAch)}` : undefined} color={"#7920e8"} />
        <Card label="Achieved (FY)"     value={fmtR(ach)} sub={annualTgt > 0 ? `${pct}% of annual target` : undefined} color={C.green} />
        <Card label="Shortfall"         value={annualTgt > 0 ? fmtR(sf) : "—"} sub={annualTgt > 0 && sf === 0 ? "On track 🎉" : undefined} color={sf > 0 ? C.red : C.green} />
      </div>

      {/* Progress bar */}
      {annualTgt > 0 && (
        <div style={{ marginBottom: 20 }}>
          {stackedBar(annualTgt, ach, comm, inpl, sf, 0)}
          <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
            {[["Achieved", C.green, ach], ["Committed", C.blue, comm], ["In Play", "#d97706", inpl], ["Shortfall", C.red + "99", sf]].map(([lbl, col, val]) => (
              <div key={lbl as string} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: col as string, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>{lbl as string} {fmtR(val as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, fontFamily: "'DM Sans',sans-serif", letterSpacing: .5, textTransform: "uppercase", marginBottom: 8 }}>Alerts</div>
        {targetApprovalStatus === "none" && <Alert icon="⚠️" msg="No target set yet. Complete the setup to get started." color={C.red} onClick={() => onNavigate("setup-wizard")} cta="Start Setup →" />}
        {targetApprovalStatus === "pending" && <Alert icon="⏳" msg="Your target submission is pending approval." color={C.accent} />}
        {plannedToday === 0 && <Alert icon="📅" msg="No meetings planned for today. Add your plan for the day." color={C.blue} onClick={() => onNavigate("my-plan")} cta="Open My Plan" />}
        {pendingTasks > 0 && <Alert icon="✓" msg={`${pendingTasks} task${pendingTasks > 1 ? "s" : ""} pending completion.`} color={"#7920e8"} onClick={() => onNavigate("tasks")} cta="View Tasks" />}
        {pendingIRs > 0 && <Alert icon="⬆" msg={`${pendingIRs} internal request${pendingIRs > 1 ? "s" : ""} awaiting resolution.`} color={C.orange} onClick={() => onNavigate("internal-requests")} cta="View Requests" />}
        {hrBadge && <Alert icon="⊘" msg={`${hrBadge} HR compliance issue${hrBadge > 1 ? "s" : ""} require attention.`} color={C.red} onClick={() => onNavigate("hr")} cta="View HR" />}
        {!targetApprovalStatus.match(/none|pending/) && plannedToday > 0 && !pendingTasks && !pendingIRs && !hrBadge && (
          <Alert icon="✅" msg="All clear — you're on track for today!" color={C.green} />
        )}
      </div>

      {/* Today's meetings summary */}
      {plannedToday > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, fontFamily: "'DM Sans',sans-serif", letterSpacing: .5, textTransform: "uppercase", marginBottom: 8 }}>Today's Meetings ({plannedToday})</div>
          {todayMeetings.slice(0, 4).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: m.meetingKind === "PR" ? "#e0f2fe" : "#faf5ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                {m.meetingKind === "PR" ? "🤝" : "🎯"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.clientName || m.agencyName || "Meeting"}
                </div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>
                  {m.time || ""} {m.mode || ""} {m.meetingKind === "PR" ? "· PR" : "· Actionable"}
                </div>
              </div>
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
                background: m.status === "logged" ? "#dcfce7" : m.status === "missed" ? "#fee2e2" : "#eff6ff",
                color: m.status === "logged" ? C.green : m.status === "missed" ? C.red : C.blue,
              }}>
                {m.status || "planned"}
              </span>
            </div>
          ))}
          {plannedToday > 4 && (
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Sans',sans-serif", marginTop: 4, textAlign: "center" }}>
              +{plannedToday - 4} more — <span style={{ color: C.blue, cursor: "pointer" }} onClick={() => onNavigate("my-plan")}>Open My Plan</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, fontFamily: "'DM Sans',sans-serif", letterSpacing: .5, textTransform: "uppercase", marginBottom: 8 }}>Quick Actions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <QA icon="◎" label="My Plan"          view="my-plan" />
          <div
            onClick={() => { setDashRevForm({ clientName: "", amount: "", invoiceRef: "", date: TODAY }); setDashRevOpen(true); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", flex: 1, minWidth: 0, transition: "box-shadow .15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px #1d5db420"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
          >
            <span style={{ fontSize: 22 }}>💰</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif", textAlign: "center", lineHeight: 1.3 }}>Log Revenue</span>
          </div>
          <QA icon="⬡" label="My Tasks"        view="tasks" />
          <QA icon="🏆" label="Leaderboard"    view="leaderboard" />
        </div>
      </div>

      {/* Revenue quick-log modal */}
      {dashRevOpen && (() => {
        return (
          <>
            <div className="overlay" onClick={() => setDashRevOpen(false)} />
            <div className="modal fin" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1000, width: 400 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>Log Revenue Entry</div>
                <button onClick={() => setDashRevOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
              {[
                { label: "Client / Advertiser *", key: "clientName" as const, placeholder: "e.g. Tata Motors", type: "text", autoFocus: true },
                { label: "Amount ₹ *", key: "amount" as const, placeholder: "e.g. 5L or 500000", type: "text", autoFocus: false },
                { label: "Invoice / RO Reference *", key: "invoiceRef" as const, placeholder: "e.g. RO-2026-0042", type: "text", autoFocus: false },
              ].map(({ label, key, placeholder, type, autoFocus }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
                  <input
                    value={drf[key]} onChange={e => setDashRevForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder} type={type} autoFocus={autoFocus}
                    style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: .4 }}>Date</div>
                <input type="date" min="2020-01-01" max="2099-12-31" value={drf.date} onChange={e => setDashRevForm(p => ({ ...p, date: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDashRevOpen(false)} style={{ flex: 1, padding: "9px 0", border: `1px solid ${C.border}`, background: "transparent", color: C.dim, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>Cancel</button>
                <button onClick={doSubmit} style={{ flex: 2, padding: "9px 0", background: "linear-gradient(135deg,#16c784,#0ea570)", border: "none", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>✓ Log Revenue</button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default RepDashboard;
