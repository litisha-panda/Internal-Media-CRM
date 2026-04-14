import React, { useState, useEffect } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import * as adminSvc from "../../services/api/admin";
import { getSessionToken } from "../../services/api/_client";
import { SystemConfigView } from "../system/SystemConfigView";

const USER_ROLES = ["SALES REP","REGION HEAD","SALES HEAD","CRO","SALES STRATEGY","DIGI OPS","ADMIN"];
const REGIONS    = ["North","South","East","West","National","Central","Odisha","West 1","West 2","Digital"];

// DB may store roles with underscores (SALES_REP) or legacy codes (NSH) — normalize to UI space-format.
const ROLE_DB_TO_UI: Record<string, string> = {
  "SALES_REP":      "SALES REP",
  "REGION_HEAD":    "REGION HEAD",
  "SALES_HEAD":     "SALES HEAD",
  "NSH":            "SALES HEAD",
  "DIGI_OPS":       "DIGI OPS",
  "SALES_STRATEGY": "SALES STRATEGY",
};
const toUIRole = (r: string): string => ROLE_DB_TO_UI[r] ?? r;

// Accept both DB underscore and legacy space variants of Region Head.
const isRegionHead = (r: string) => r === "REGION HEAD" || r === "REGION_HEAD";

/* Inline approve/reject actions for pending users */
function PendingActions({ u, regionHeads, onApprove, onReject, C }: {
  u: adminSvc.AdminUser;
  regionHeads: adminSvc.AdminUser[];
  onApprove: (u: adminSvc.AdminUser, role: string, region: string) => void;
  onReject:  (u: adminSvc.AdminUser) => void;
  C: Record<string, string>;
}) {
  const [role,   setRole]   = useState(u.role || "SALES REP");
  const [region, setRegion] = useState(u.region || regionHeads[0]?.region || "North");
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
      <select value={role} onChange={e=>setRole(e.target.value)}
        style={{ padding:"2px 5px", background:C.s2, border:`1px solid ${C.border}`, borderRadius:4, fontSize:10, fontFamily:"'DM Mono',monospace", color:C.text }}>
        {USER_ROLES.filter(r=>r!=="ADMIN").map(r=><option key={r}>{r}</option>)}
      </select>
      <select value={region} onChange={e=>setRegion(e.target.value)}
        style={{ padding:"2px 5px", background:C.s2, border:`1px solid ${C.border}`, borderRadius:4, fontSize:10, fontFamily:"'DM Mono',monospace", color:C.text }}>
        {REGIONS.map(r=><option key={r}>{r}</option>)}
      </select>
      <button onClick={()=>onApprove(u, role, region)}
        style={{ background:`${C.green}18`, border:"none", color:C.green, borderRadius:4, padding:"3px 8px", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
        ✓
      </button>
      <button onClick={()=>onReject(u)}
        style={{ background:`${C.red}18`, border:"none", color:C.red, borderRadius:4, padding:"3px 8px", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>
        ✕
      </button>
    </div>
  );
}

export interface AdminViewProps {
  view: string;
  setView: (v: string) => void;
}

export function AdminView({ view: _view }: AdminViewProps) {
  const { C, showToast, deals, user } = useCROAppContext() as any;

  const [activeTab,      setActiveTab]      = useState<"users"|"export"|"system">("users");
  const [allUsers,       setAllUsers]       = useState<adminSvc.AdminUser[]>([]);
  const [usersLoading,   setUsersLoading]   = useState(false);

  /* Invite modal */
  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState("SALES REP");
  const [inviteResult,  setInviteResult]  = useState<{ inviteUrl:string; expiresAt:string }|null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  /* Per-row save feedback: brief "Saved ✓" indicator after successful patch */
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set());
  const flashSaved = (id: string) => {
    setSavedRows(s => new Set(s).add(id));
    setTimeout(() => setSavedRows(s => { const n = new Set(s); n.delete(id); return n; }), 1600);
  };

  /* Export */
  const [exportFrom,    setExportFrom]    = useState("");
  const [exportTo,      setExportTo]      = useState("");
  const [exportRepId,   setExportRepId]   = useState("");
  const [exportBusy,    setExportBusy]    = useState<string|null>(null);

  /* ── Fetch users ─────────────────────────────────────────────────────────── */
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const u = await adminSvc.listAdminUsers();
      setAllUsers(u);
    } catch { /* silently ignore */ }
    setUsersLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // Accept both "REGION HEAD" (space) and "REGION_HEAD" (underscore) — DB may have either.
  const regionHeads = allUsers.filter(u => isRegionHead(u.role) && u.status === "active");

  /* ── User actions ────────────────────────────────────────────────────────── */
  const handleRoleChange = async (u: adminSvc.AdminUser, role: string) => {
    try {
      await adminSvc.patchUser(u.id, { role });
      flashSaved(u.id);
      fetchUsers();
    } catch { showToast("Role update failed", "err"); }
  };

  const handleManagerChange = async (u: adminSvc.AdminUser, managerId: string) => {
    try {
      // Send null explicitly when clearing manager so the backend recognises it
      // as an intentional "clear" rather than "field not provided".
      await adminSvc.patchUser(u.id, { managerId: managerId || null });
      flashSaved(u.id);
      fetchUsers();
    } catch { showToast("Manager update failed", "err"); }
  };

  const handleRevoke = async (u: adminSvc.AdminUser) => {
    if (!window.confirm(`Revoke access for ${u.name}?`)) return;
    try {
      await adminSvc.deleteUser(u.id);
      showToast(`${u.name}'s access revoked`, "err");
      fetchUsers();
    } catch { showToast("Revoke failed", "err"); }
  };

  const handleReactivate = async (u: adminSvc.AdminUser) => {
    try {
      await adminSvc.patchUser(u.id, { status: "active" });
      showToast(`${u.name} reactivated`);
      fetchUsers();
    } catch { showToast("Reactivate failed", "err"); }
  };

  const handleApprove = async (u: adminSvc.AdminUser, role: string, region: string) => {
    try {
      await adminSvc.approveUser(u.id, role, region);
      showToast(`${u.name} approved as ${role}`);
      fetchUsers();
    } catch { showToast("Approval failed", "err"); }
  };

  const handleReject = async (u: adminSvc.AdminUser) => {
    try {
      await adminSvc.rejectUser(u.id);
      showToast(`${u.name} rejected`, "err");
      fetchUsers();
    } catch { showToast("Reject failed", "err"); }
  };

  /* ── Invite ──────────────────────────────────────────────────────────────── */
  const handleInvite = async () => {
    if (!inviteEmail.trim()) { showToast("Email required", "err"); return; }
    setInviteLoading(true);
    try {
      const result = await adminSvc.createInvite(inviteEmail.trim().toLowerCase());
      setInviteResult(result);
    } catch { showToast("Invite failed", "err"); }
    setInviteLoading(false);
  };

  /* ── Export ──────────────────────────────────────────────────────────────── */
  const handleExport = async (type: string) => {
    setExportBusy(type);
    try {
      const params = new URLSearchParams();
      if (exportFrom)  params.set("from",  exportFrom);
      if (exportTo)    params.set("to",    exportTo);
      if (exportRepId) params.set("repId", exportRepId);
      const url   = `/api/export/${type}?${params}`;
      const token = getSessionToken();
      const resp  = await fetch(url, {
        credentials: "include",
        headers: token ? { "X-Session-Token": token } : {},
      });
      if (!resp.ok) { showToast("Export failed", "err"); return; }
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      a.download = `otv-${type}-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(href);
      showToast(`${type} CSV downloaded`);
    } catch { showToast("Export failed", "err"); }
    setExportBusy(null);
  };

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  const statusBadge = (s: string) => {
    const col = s==="active" ? C.green : s==="pending" ? C.orange : C.red;
    return (
      <span style={{ background:`${col}18`, color:col, padding:"2px 8px", borderRadius:8,
        fontSize:10, fontWeight:700, letterSpacing:.4, textTransform:"uppercase" as const }}>
        {s}
      </span>
    );
  };

  const pending = allUsers.filter(u => u.status==="pending");
  const active  = allUsers.filter(u => u.status==="active");
  const revoked = allUsers.filter(u => u.status==="revoked");
  const rows    = [...pending, ...active, ...revoked];

  const inputStyle: React.CSSProperties = {
    padding:"3px 6px", background:C.s2, border:`1px solid ${C.border}`,
    borderRadius:4, fontSize:11, fontFamily:"'DM Mono',monospace", color:C.text,
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="fin">
      {/* Tab bar */}
      <div style={{ display:"flex", gap:0, marginBottom:20, borderBottom:`1px solid ${C.border}` }}>
        {([ ["users","Users"], ["export","Export"], ["system","System Config"] ] as const).map(([tab,label])=>(
          <button key={tab} onClick={()=>setActiveTab(tab)}
            style={{ padding:"9px 22px", background:"transparent", border:"none", cursor:"pointer",
              fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, letterSpacing:.5,
              color: activeTab===tab ? C.accent : C.dim,
              borderBottom: `2px solid ${activeTab===tab ? C.accent : "transparent"}`,
              marginBottom:-1, transition:"color .15s" }}>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ─────────────────── USERS TAB ─────────────────────────────────────── */}
      {activeTab==="users" && (
        <div>
          {/* Demo data banner */}
          {(()=>{
            const DEMO = ["Havells India","Berger Paints","Asian Paints"];
            if (!(deals as any[]).some((d:any)=>DEMO.includes(d.clientCompany))) return null;
            return (
              <div style={{ background:`${C.red}12`, border:`2px solid ${C.red}`, borderRadius:10,
                padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"flex-start", gap:14 }}>
                <div style={{ fontSize:22, lineHeight:1 }}>⚠️</div>
                <div>
                  <div className="sans" style={{ fontWeight:800, fontSize:13, color:C.red, marginBottom:4 }}>
                    DEMO DATA IS ACTIVE — DO NOT ONBOARD REAL USERS YET
                  </div>
                  <div style={{ fontSize:11, color:C.dim }}>
                    Seed clients (Havells India, Berger Paints, Asian Paints) are still in the database.
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Header row */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div className="sans" style={{ fontSize:16, fontWeight:700 }}>
              Users
              {usersLoading && <span style={{ fontSize:10, color:C.dim, fontWeight:400, marginLeft:8 }}>loading…</span>}
              {!usersLoading && <span style={{ fontSize:11, color:C.dim, fontWeight:400, marginLeft:8 }}>({rows.length})</span>}
            </div>
            <button onClick={()=>{ setInviteOpen(true); setInviteEmail(""); setInviteRole("SALES REP"); setInviteResult(null); }}
              style={{ background:C.accent, color:"#fff", border:"none", borderRadius:6, padding:"7px 16px",
                fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, cursor:"pointer" }}>
              + Invite User
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                  {["Name","Email","Role","Reports To","Region","Status","Action"].map(h=>(
                    <th key={h} style={{ textAlign:"left", padding:"6px 10px", color:C.dim,
                      fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" as const,
                      whiteSpace:"nowrap" as const }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const isSalesRep = u.role==="SALES REP" || u.role==="SALES_REP";
                  const isPending  = u.status==="pending";
                  const mgr        = allUsers.find(m => m.id === u.managerId);
                  const mgrRegion  = mgr?.region;

                  return (
                    <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}`,
                      background: isPending ? `${C.orange}08` : undefined }}>

                      {/* Name */}
                      <td style={{ padding:"9px 10px", fontWeight:600, whiteSpace:"nowrap" as const }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:"50%", background:`${C.accent}22`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:11, fontWeight:700, color:C.accent, flexShrink:0 }}>
                            {u.name[0]}
                          </div>
                          {u.name}
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding:"9px 10px", color:C.dim, fontSize:11 }}>{u.email}</td>

                      {/* Role */}
                      <td style={{ padding:"9px 10px" }}>
                        {isPending
                          ? <span style={{ color:C.orange, fontSize:11 }}>{toUIRole(u.role) || "—"}</span>
                          : <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <select
                                value={toUIRole(u.role)}
                                onChange={e=>handleRoleChange(u, e.target.value)}
                                style={{ ...inputStyle, borderColor: savedRows.has(u.id) ? C.green : undefined }}
                              >
                                {USER_ROLES.map(r=><option key={r}>{r}</option>)}
                              </select>
                              {savedRows.has(u.id) && (
                                <span style={{ fontSize:9, color:C.green, fontWeight:700, whiteSpace:"nowrap" as const }}>✓ Saved</span>
                              )}
                            </div>
                        }
                      </td>

                      {/* Reports To */}
                      <td style={{ padding:"9px 10px" }}>
                        {isSalesRep && !isPending
                          ? <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <select
                                value={u.managerId||""}
                                onChange={e=>handleManagerChange(u, e.target.value)}
                                style={{ ...inputStyle, borderColor: savedRows.has(u.id) ? C.green : undefined }}
                              >
                                <option value="">— None —</option>
                                {regionHeads.map(rh=><option key={rh.id} value={rh.id}>{rh.name}</option>)}
                              </select>
                              {savedRows.has(u.id) && (
                                <span style={{ fontSize:9, color:C.green, fontWeight:700, whiteSpace:"nowrap" as const }}>✓ Saved</span>
                              )}
                            </div>
                          : <span style={{ color:C.muted, fontSize:11 }}>{mgr?.name || "—"}</span>
                        }
                      </td>

                      {/* Region — auto from manager for SALES REP */}
                      <td style={{ padding:"9px 10px", fontSize:11, color:C.dim }}>
                        {isSalesRep ? (mgrRegion || u.region || "—") : (u.region || "—")}
                      </td>

                      {/* Status */}
                      <td style={{ padding:"9px 10px" }}>{statusBadge(u.status)}</td>

                      {/* Action */}
                      <td style={{ padding:"9px 10px", whiteSpace:"nowrap" as const }}>
                        {isPending
                          ? <PendingActions u={u} regionHeads={regionHeads} onApprove={handleApprove} onReject={handleReject} C={C} />
                          : u.status==="active"
                            ? <button onClick={()=>handleRevoke(u)}
                                style={{ background:`${C.red}18`, border:"none", color:C.red, borderRadius:4,
                                  padding:"4px 10px", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                                Revoke
                              </button>
                            : <button onClick={()=>handleReactivate(u)}
                                style={{ background:`${C.green}18`, border:"none", color:C.green, borderRadius:4,
                                  padding:"4px 10px", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                                Reactivate
                              </button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!usersLoading && rows.length===0 && (
              <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:12 }}>No users</div>
            )}
          </div>

          {/* Danger zone */}
          <div style={{ marginTop:32, padding:"16px 18px", background:`${C.red}0a`,
            border:`1px solid ${C.red}33`, borderRadius:8 }}>
            <div style={{ fontWeight:700, fontSize:11, color:C.red, letterSpacing:1, marginBottom:6 }}>
              DANGER ZONE — SYSTEM RESET
            </div>
            <div style={{ fontSize:11, color:C.dim, marginBottom:12 }}>
              Wipes ALL data from the platform. Cannot be undone. Logged with your email and timestamp.
            </div>
            <button onClick={async()=>{
              const typed = window.prompt("Type  RESET  (all caps) to confirm deletion of all platform data.\n\nThis cannot be undone.");
              if (typed===null) return;
              if (typed.trim()!=="RESET") { showToast("Reset cancelled — type RESET exactly", "err"); return; }
              try {
                const token = getSessionToken();
                const j = await fetch("/api/state/reset-all", {
                  method:"POST",
                  headers:{ "Content-Type":"application/json", ...(token?{"X-Session-Token":token}:{}) },
                  body: JSON.stringify({ confirmText:"RESET", triggeredBy: user?.email||"admin", role:"ADMIN" }),
                });
                const d = await j.json();
                if (d.ok) {
                  Object.keys(localStorage).filter(k=>k.startsWith("otv_")).forEach(k=>localStorage.removeItem(k));
                  showToast("All data cleared — reloading…");
                  setTimeout(()=>window.location.reload(), 800);
                } else {
                  showToast("Reset failed: "+d.error, "err");
                }
              } catch { showToast("Reset failed", "err"); }
            }} style={{ background:`${C.red}18`, border:`1px solid ${C.red}44`, color:C.red, borderRadius:5,
              padding:"7px 18px", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
              ⚠ Reset All App Data
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── EXPORT TAB ────────────────────────────────────── */}
      {activeTab==="export" && (
        <div>
          <div className="sans" style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>Export Data</div>

          {/* Filters */}
          <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:22, padding:"14px 16px",
            background:C.s2, borderRadius:8, border:`1px solid ${C.border}` }}>
            <div>
              <label style={{ display:"block", fontSize:10, color:C.dim, textTransform:"uppercase" as const,
                letterSpacing:.4, marginBottom:4 }}>From</label>
              <input type="date" value={exportFrom} onChange={e=>setExportFrom(e.target.value)}
                style={{ padding:"6px 10px", background:"#fff", border:`1px solid ${C.border}`, borderRadius:5,
                  fontSize:12, fontFamily:"'DM Mono',monospace", color:C.text }} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, color:C.dim, textTransform:"uppercase" as const,
                letterSpacing:.4, marginBottom:4 }}>To</label>
              <input type="date" value={exportTo} onChange={e=>setExportTo(e.target.value)}
                style={{ padding:"6px 10px", background:"#fff", border:`1px solid ${C.border}`, borderRadius:5,
                  fontSize:12, fontFamily:"'DM Mono',monospace", color:C.text }} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, color:C.dim, textTransform:"uppercase" as const,
                letterSpacing:.4, marginBottom:4 }}>Rep</label>
              <select value={exportRepId} onChange={e=>setExportRepId(e.target.value)}
                style={{ padding:"6px 10px", background:"#fff", border:`1px solid ${C.border}`, borderRadius:5,
                  fontSize:12, fontFamily:"'DM Mono',monospace", color:C.text }}>
                <option value="">All Reps</option>
                {allUsers.filter(u=>u.role==="SALES REP"||u.role==="SALES_REP").map(u=>(
                  <option key={u.id} value={String(u.repId||u.id)}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export buttons */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {([
              { type:"deals",    label:"Export Deals",    color:C.blue   },
              { type:"revenue",  label:"Export Revenue",  color:C.green  },
              { type:"meetings", label:"Export Meetings", color:C.accent },
              { type:"targets",  label:"Export Targets",  color:C.orange },
            ]).map(({ type, label, color })=>(
              <button key={type} onClick={()=>handleExport(type)} disabled={exportBusy===type}
                style={{ padding:"10px 24px", background:`${color}14`, border:`1.5px solid ${color}55`,
                  borderRadius:7, color, fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700,
                  cursor:"pointer", opacity:exportBusy===type?.55:1, transition:"opacity .15s" }}>
                {exportBusy===type ? "Exporting…" : label}
              </button>
            ))}
          </div>

          <div style={{ marginTop:14, fontSize:11, color:C.dim }}>
            Downloads a .csv file. Leave date fields blank to export all records.
          </div>
        </div>
      )}

      {/* ─────────────────── SYSTEM CONFIG TAB ─────────────────────────────── */}
      {activeTab==="system" && (
        <SystemConfigView view="admin-config" />
      )}

      {/* ─────────────────── INVITE MODAL ───────────────────────────────────── */}
      {inviteOpen && (
        <div className="overlay" onClick={()=>setInviteOpen(false)}>
          <div className="modal fin" onClick={e=>e.stopPropagation()} style={{ width:460 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div className="sans" style={{ fontSize:15, fontWeight:700 }}>Invite User</div>
              <button onClick={()=>setInviteOpen(false)}
                style={{ background:"transparent", border:"none", color:C.dim, fontSize:18, cursor:"pointer" }}>×</button>
            </div>

            {!inviteResult ? (
              <>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:"block", fontSize:10, color:C.dim, textTransform:"uppercase" as const,
                    letterSpacing:.4, marginBottom:4 }}>Email *</label>
                  <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                    placeholder="user@odishatv.com" autoFocus
                    style={{ width:"100%", padding:"8px 10px", background:C.s2, border:`1px solid ${C.border}`,
                      borderRadius:5, fontSize:12, fontFamily:"'DM Mono',monospace", color:C.text, boxSizing:"border-box" as const }} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block", fontSize:10, color:C.dim, textTransform:"uppercase" as const,
                    letterSpacing:.4, marginBottom:4 }}>Intended Role</label>
                  <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                    style={{ width:"100%", padding:"8px 10px", background:C.s2, border:`1px solid ${C.border}`,
                      borderRadius:5, fontSize:12, fontFamily:"'DM Mono',monospace", color:C.text }}>
                    {USER_ROLES.map(r=><option key={r}>{r}</option>)}
                  </select>
                  <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>
                    The invitee selects their final role during sign-up.
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button onClick={()=>setInviteOpen(false)} className="btn btn-ghost">Cancel</button>
                  <button onClick={handleInvite} disabled={inviteLoading} className="btn btn-primary">
                    {inviteLoading ? "Generating…" : "Generate Invite Link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background:`${C.green}14`, border:`1px solid ${C.green}44`, borderRadius:8,
                  padding:"12px 14px", marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.green, marginBottom:4 }}>✓ Invite link generated</div>
                  <div style={{ fontSize:10, color:C.dim }}>
                    Expires {new Date(inviteResult.expiresAt).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })} (72 hours)
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, marginBottom:16 }}>
                  <input readOnly value={inviteResult.inviteUrl}
                    style={{ flex:1, padding:"7px 10px", background:C.s2, border:`1px solid ${C.border}`,
                      borderRadius:5, fontSize:11, fontFamily:"'DM Mono',monospace", color:C.text }} />
                  <button onClick={()=>{ navigator.clipboard.writeText(inviteResult!.inviteUrl); showToast("Copied!"); }}
                    style={{ padding:"7px 14px", background:C.accent, color:"#fff", border:"none", borderRadius:5,
                      fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700, whiteSpace:"nowrap" as const }}>
                    Copy
                  </button>
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button onClick={()=>setInviteOpen(false)} className="btn btn-ghost">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminView;
