import React from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import { apiFetch } from "../../services/api/_client";
import * as adminSvc from "../../services/api/admin";

interface PendingUser {
  id: string | number;
  _apiId: number;
  name: string;
  email: string;
  requestedAt: string;
  phone?: string;
  designation?: string;
  intendedRole?: string;
  preferredRegion?: string;
}

interface LiveRole {
  id: string | number;
  _apiId: number;
  name: string;
  role: string;
  region?: string;
}

interface AdminViewProps {
  view: string;
  pendingUsers: PendingUser[];
  liveRoles: LiveRole[];
  adminUsersLoading: boolean;
  refreshAdminUsers: () => Promise<void>;
}

export function AdminView({
  view,
  pendingUsers,
  liveRoles,
  adminUsersLoading,
  refreshAdminUsers,
}: AdminViewProps) {
  const {
    deals,
    internalReqs,
    setInternalReqs,
    showToast,
    openNoteModal,
    daysSince,
    C,
    ALL_ROLES,
    REGIONS,
    TODAY,
    user,
    setReps,
  } = useCROAppContext();

  return (
    <div className="fin">
      {/* Pre-launch demo data banner */}
      {(()=>{
        const DEMO_CLIENTS = ["Havells India","Berger Paints","Asian Paints"];
        const demoFound = deals.some((d: any)=>DEMO_CLIENTS.includes(d.clientCompany));
        if (!demoFound) return null;
        return (
          <div style={{background:`${C.red}12`,border:`2px solid ${C.red}`,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
            <div style={{fontSize:22,lineHeight:1}}>⚠️</div>
            <div style={{flex:1}}>
              <div className="sans" style={{fontWeight:800,fontSize:13,color:C.red,marginBottom:4}}>DEMO DATA IS ACTIVE — DO NOT ONBOARD REAL USERS YET</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:10}}>
                Seed clients (Havells India, Berger Paints, Asian Paints etc.) are still in the database. Every new rep will see this fake data in their pipeline from day one. Run a full reset <strong>before</strong> the first real user logs in.
              </div>
              <button onClick={async()=>{
                const typed = window.prompt("Type  RESET  (all caps) to wipe all demo data and start clean.\n\nThis cannot be undone.");
                if(typed===null)return;
                if(typed.trim()!=="RESET"){showToast("Reset cancelled — type RESET exactly","err");return;}
                try{
                  const j=await apiFetch("/api/state/reset-all",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmText:"RESET",triggeredBy:user?.email||"admin",role:"ADMIN"})}) as any;
                  if(j.ok){Object.keys(localStorage).filter(k=>k.startsWith("otv_")).forEach(k=>localStorage.removeItem(k));showToast("Demo data cleared — reloading…");setTimeout(()=>window.location.reload(),800);}
                  else showToast("Reset failed: "+j.error,"err");
                }catch{showToast("Reset failed","err");}
              }} style={{background:C.red,border:"none",color:"#fff",borderRadius:6,padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                🗑 Clear All Demo Data Now
              </button>
            </div>
          </div>
        );
      })()}

      <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>
        {view==="admin-access"?"ACCESS MANAGEMENT":"APPROVAL QUEUE"}
      </div>

      {/* ── ACCESS MANAGEMENT ── */}
      {view==="admin-access" && (
        <div>
          {adminUsersLoading && (
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,color:C.muted,fontSize:11}}>
              <div style={{width:12,height:12,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
              Refreshing user list...
            </div>
          )}
          {pendingUsers.length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>Pending Access Requests</div>
                <span style={{background:`${C.orange}22`,color:C.orange,padding:"1px 8px",borderRadius:8,fontSize:11,fontWeight:700}}>{pendingUsers.length}</span>
              </div>
              {pendingUsers.map((pu: PendingUser)=>(
                <div key={pu.id} className="card" style={{padding:"14px 18px",marginBottom:8,borderLeft:`3px solid ${C.orange}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:`${C.orange}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.orange,flexShrink:0}}>{pu.name[0]}</div>
                  <div style={{flex:1}}>
                    <div className="sans" style={{fontWeight:700,fontSize:13}}>{pu.name}</div>
                    <div style={{fontSize:11,color:C.dim}}>{pu.email} · Requested {daysSince(pu.requestedAt)===0?"today":`${daysSince(pu.requestedAt)}d ago`}</div>
                    {(pu.phone||pu.designation||pu.intendedRole) && (
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                        {pu.phone&&<span style={{fontSize:10,background:`${C.s2}`,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 7px",color:C.dim}}>📞 {pu.phone}</span>}
                        {pu.designation&&<span style={{fontSize:10,background:`${C.s2}`,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 7px",color:C.dim}}>{pu.designation}</span>}
                        {pu.intendedRole&&<span style={{fontSize:10,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,borderRadius:4,padding:"1px 7px",color:C.accent,fontWeight:700}}>Wants: {pu.intendedRole}</span>}
                        {pu.preferredRegion&&<span style={{fontSize:10,background:`${C.blue}18`,border:`1px solid ${C.blue}33`,borderRadius:4,padding:"1px 7px",color:C.blue}}>📍 {pu.preferredRegion}</span>}
                      </div>
                    )}
                  </div>
                  <select id={`role-${pu.id}`} defaultValue={pu.intendedRole||"SALES REP"}
                    style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                    {ALL_ROLES.filter((r: string)=>r!=="ADMIN").map((r: string)=><option key={r}>{r}</option>)}
                  </select>
                  <select id={`region-${pu.id}`} defaultValue={pu.preferredRegion||"North"}
                    style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                    {REGIONS.map((r: string)=><option key={r}>{r}</option>)}
                  </select>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={async ()=>{
                      const roleEl   = document.getElementById(`role-${pu.id}`) as HTMLSelectElement|null;
                      const regionEl = document.getElementById(`region-${pu.id}`) as HTMLSelectElement|null;
                      const role     = roleEl?.value || "SALES REP";
                      const region   = regionEl?.value || "North";
                      try {
                        await adminSvc.approveUser(pu._apiId, role, region);
                        if (role === "SALES REP") {
                          setReps((prev: any[]) => {
                            const nextId = prev.length > 0 ? Math.max(...prev.map((r: any)=>r.id)) + 1 : 1;
                            return [...prev, {id:nextId, name:pu.name, region, role:"Sales Executive", target:0}];
                          });
                        }
                        await refreshAdminUsers();
                        showToast(`${pu.name} approved as ${role} ✓`);
                      } catch { showToast("Network error — approval failed","err"); }
                    }} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                      ✓ Approve
                    </button>
                    <button onClick={async ()=>{
                      try {
                        await adminSvc.rejectUser(pu._apiId);
                        await refreshAdminUsers();
                        showToast(`${pu.name} rejected`,"err");
                      } catch { showToast("Network error","err"); }
                    }} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>
            Active Users ({liveRoles.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {liveRoles.map((u: LiveRole)=>(
              <div key={u.id} className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent,flexShrink:0}}>{u.name[0]}</div>
                <div style={{flex:1,minWidth:120}}>
                  <div className="sans" style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                  <div style={{fontSize:10,color:C.dim}}>{u.region||"All regions"}</div>
                </div>
                <select value={u.role} onChange={async (e: React.ChangeEvent<HTMLSelectElement>)=>{
                  const newRole = e.target.value;
                  try {
                    await adminSvc.patchUserRole(u._apiId, newRole, u.region || "");
                    await refreshAdminUsers();
                    showToast(`${u.name} role updated to ${newRole}`);
                  } catch { showToast("Network error","err"); }
                }} style={{padding:"4px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                  {ALL_ROLES.map((r: string)=><option key={r}>{r}</option>)}
                </select>
                <button onClick={async ()=>{
                  if(!window.confirm(`Revoke access for ${u.name}?`)) return;
                  try {
                    await adminSvc.deleteUser(u._apiId);
                    await refreshAdminUsers();
                    showToast(`${u.name}'s access revoked`,"err");
                  } catch { showToast("Network error","err"); }
                }} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"4px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Revoke</button>
              </div>
            ))}
          </div>

          <div style={{marginTop:28,padding:"16px 18px",background:`${C.red}0a`,border:`1px solid ${C.red}33`,borderRadius:8}}>
            <div style={{fontWeight:700,fontSize:11,color:C.red,letterSpacing:1,marginBottom:6}}>DANGER ZONE — SYSTEM RESET</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:4}}>Wipes ALL data from the platform (deals, meetings, targets, reps, users, plans). Use once before going live. Cannot be undone.</div>
            <div style={{fontSize:11,color:C.red,fontWeight:600,marginBottom:12}}>Admin access only. Each trigger is logged with your email and timestamp.</div>
            <button onClick={async ()=>{
              const typed = window.prompt('Type  RESET  (all caps) to confirm deletion of all platform data.\n\nThis cannot be undone. Your email and the timestamp will be logged.');
              if (typed === null) return;
              if (typed.trim() !== "RESET") { showToast("Reset cancelled — confirmation text did not match","err"); return; }
              try {
                const j = await apiFetch("/api/state/reset-all", {
                  method:"POST",
                  headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ confirmText:"RESET", triggeredBy: user?.email||"admin", role:"ADMIN" })
                }) as any;
                if (j.ok) {
                  Object.keys(localStorage).filter(k=>k.startsWith("otv_")).forEach(k=>localStorage.removeItem(k));
                  showToast("All data cleared — reloading…");
                  setTimeout(()=>window.location.reload(), 800);
                } else {
                  showToast("Reset failed: "+j.error,"err");
                }
              } catch {
                showToast("Reset failed","err");
              }
            }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"7px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
              ⚠ Reset All App Data
            </button>
          </div>
        </div>
      )}

      {/* ── APPROVAL QUEUE ── */}
      {view==="admin-approvals" && (
        <div>
          <div style={{fontSize:11,color:C.dim,marginBottom:16}}>All pending approvals across teams.</div>
          {internalReqs.filter((r: any)=>r.status!=="Done").length===0&&<div style={{textAlign:"center",padding:50,color:C.muted}}>No pending approvals.</div>}
          {internalReqs.filter((r: any)=>r.status!=="Done").map((req: any)=>{
            const daysOld=daysSince(req.raisedAt);
            const overdue=daysOld>=(req.slaHours/24);
            const sc=overdue?C.red:req.status==="In Progress"?C.blue:C.orange;
            return (
              <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${sc}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                    <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10}}>{req.type}</span>
                    <span style={{fontSize:11,color:C.dim}}>From: {req.raisedByName} → {req.dept}</span>
                  </div>
                  <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}</span>
                </div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:8}}>{req.details}</div>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button onClick={()=>setInternalReqs((p: any[])=>p.map((r: any)=>r.id===req.id?{...r,status:"In Progress"}:r))} style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>In Progress</button>
                  <button onClick={()=>{openNoteModal("Resolution Note", "Resolved by admin", (note: string) => setInternalReqs((p: any[])=>p.map((r: any)=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)));}} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Resolve</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
