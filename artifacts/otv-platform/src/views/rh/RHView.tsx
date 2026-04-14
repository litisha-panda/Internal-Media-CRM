import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES,
  APPROVAL_SLA_DAYS,
  APPROVAL_TARGETS,
  TASK_STATUSES,
  SLA,
  MONDAY,
  SUNDAY,
} from "../../constants";

interface RHViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  isMobile: boolean;
  rhRepDrill: string | null;
  setRhRepDrill: React.Dispatch<React.SetStateAction<string | null>>;
  rhDrillPlan: Record<string, any> | null;
  setRhDrillPlan: React.Dispatch<React.SetStateAction<Record<string, any> | null>>;
  rhTeamFilter: { rep: string; dateRange: string; client: string; status: string };
  setRhTeamFilter: React.Dispatch<React.SetStateAction<{ rep: string; dateRange: string; client: string; status: string }>>;
  rhWarroomClient: string;
  setRhWarroomClient: React.Dispatch<React.SetStateAction<string>>;
  rhWarroomRep: string;
  setRhWarroomRep: React.Dispatch<React.SetStateAction<string>>;
  rhTeamReportRep: string | null;
  setRhTeamReportRep: React.Dispatch<React.SetStateAction<string | null>>;
}

export function RHView({
  view, setView, isMobile,
  rhRepDrill, setRhRepDrill,
  rhDrillPlan, setRhDrillPlan,
  rhTeamFilter, setRhTeamFilter,
  rhWarroomClient, setRhWarroomClient,
  rhWarroomRep, setRhWarroomRep,
  rhTeamReportRep, setRhTeamReportRep,
}: RHViewProps) {
  const {
    deals,
    setDeals,
    meetings,
    tasks,
    setTasks,
    targetSubs,
    revenueEntries,
    internalReqs,
    setInternalReqs,
    reps,
    absenceReports,
    weeklyPlans,
    user_role,
    isRH,
    isNSH,
    rhRegion,
    activeUser,
    filterQ,
    visibleDeals,
    qMatch,
    fmtR,
    daysSince,
    oColor,
    openSelfTask,
    setTaskModal,
    setAccountThreadOpen,
    setAccountThreadClient,
    STAGE_PROB,
    C,
    TODAY,
    TOMORROW,
  } = useCROAppContext();
  return (
    <>
          {/* ═══ RH ESCALATIONS ═══ */}
          {view==="rh-escalations" && isRH && (
            <div className="fin">
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY ESCALATIONS</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · Items escalated to you because SLA was missed · Distinct from Approvals queue</div>
              </div>
              {(()=>{
                const myRegion = user_role?.region;
                const myRepIds = reps.filter(r=>r.region===myRegion).map(r=>String(r.id));

                // 1. IRs escalated to RH via ESC_CHAIN (escDept="Region Head" or dept=Region Head + past SLA)
                const escalatedIRs = internalReqs.filter(r=>
                  (r.escDept==="Region Head" || (r.dept==="Region Head" && r.status==="Overdue" && daysSince(r.raisedAt)>=(r.slaHours||48)/24)) &&
                  r.status!=="Done" && r.status!=="Withdrawn"
                );

                // 2. Tasks escalated to RH (assignedToUserId=activeUser and overdue, or escDept=Region Head)
                const escalatedTasks = tasks.filter(t=>
                  (t.escDept==="Region Head" || t.assignedToUserId===activeUser) &&
                  t.status!=="Done" && t.dueDate && t.dueDate < TODAY
                );

                // 3. Stalled deals in region (no contact 7+ days, not closed)
                const stalledDeals = visibleDeals.filter(d=>
                  myRepIds.includes(String(d.repId)) &&
                  !["Lost","RO Received","Mail Confirmed"].includes(d.outcome||"") &&
                  daysSince(d.lastContact||d.createdAt||TODAY) >= 7
                );

                // 4. Overdue rep tasks in region (broader — for rep management)
                const overdueRepTasks = tasks.filter(t=>
                  myRepIds.includes(String(t.repId)) &&
                  t.dueDate < TODAY && t.status !== "Done" &&
                  t.assignedToUserId !== activeUser // exclude RH's own tasks (shown in #2)
                );

                // Historical: deals awaiting approval past SLA
                const blockedDeals = visibleDeals.filter(d=>
                  myRepIds.includes(String(d.repId)) &&
                  d.awaitingApproval && d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  !["Mail Confirmed","RO Received","Not Interested"].includes(d.outcome||"")
                );
                const total = escalatedIRs.length + escalatedTasks.length + stalledDeals.length + overdueRepTasks.length + blockedDeals.length;
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                      {[
                        {label:"ESCALATED IRs",      value:escalatedIRs.length,    color:C.red,    desc:"Requests overdue → escalated to you"},
                        {label:"TASKS ON YOU",        value:escalatedTasks.length,  color:C.orange, desc:"Overdue tasks assigned to you"},
                        {label:"STALLED DEALS",       value:stalledDeals.length,    color:C.purple, desc:"No contact for 7+ days"},
                        {label:"REP TASKS OVERDUE",   value:overdueRepTasks.length, color:C.blue,   desc:"Rep tasks past due date"},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                          <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color,marginBottom:2}}>{k.value}</div>
                          <div style={{fontSize:10,color:C.muted}}>{k.desc}</div>
                        </div>
                      ))}
                    </div>

                    {total===0 && <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:8}}>✓</div>
                      <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>No escalations</div>
                      <div style={{fontSize:11,color:C.dim}}>All items in {rhRegion} are on track. Approvals are under My Approvals →</div>
                    </div>}

                    {/* Escalated IRs */}
                    {escalatedIRs.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⬆ Escalated Requests (SLA Breached)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Rep","Subject","Type","Raised","SLA","Status","Action"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{escalatedIRs.map(r=>{
                              const dw=daysSince(r.raisedAt);
                              return (
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.red}04`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{r.raisedByName||"—"}</td>
                                  <td style={{padding:"10px 14px",maxWidth:200,fontSize:12}}>{r.subject}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.type}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{r.raisedAt}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{dw}d</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.status}</span></td>
                                  <td style={{padding:"10px 14px",whiteSpace:"nowrap",display:"flex",gap:4}}>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"In Progress",resolverNote:"Acknowledged by "+user_role?.name}:x))}
                                      style={{background:`${C.blue}18`,color:C.blue,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Accept</button>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY,resolverNote:"Resolved by "+user_role?.name}:x))}
                                      style={{background:`${C.green}18`,color:C.green,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Done</button>
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tasks escalated to RH */}
                    {escalatedTasks.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ Overdue Tasks Assigned to You</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Task","From","Client","Priority","Due","Days Over","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{escalatedTasks.map(t=>{
                              return (
                                <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}04`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{t.title}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.assignedByName||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(t.dueDate)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Stalled deals */}
                    {stalledDeals.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.purple,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⏸ Stalled Deals (No Contact 7+ Days)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Stage","Last Contact","Days Idle"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{stalledDeals.map(d=>{
                              const rep=reps.find(r=>String(r.id)===String(d.repId));
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{d.lastContact||d.createdAt||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.purple,fontWeight:700}}>{daysSince(d.lastContact||d.createdAt||TODAY)}d</td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Overdue rep tasks in region */}
                    {overdueRepTasks.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 Rep Tasks Overdue in Your Region</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Task","Assigned To","Client","Priority","Due","Days Over","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{overdueRepTasks.map(t=>{
                              const rep=reps.find(r=>String(r.id)===String(t.repId));
                              return (
                                <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{t.title}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(t.dueDate)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Blocked deals */}
                    {blockedDeals.length>0&&(
                      <div>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>🔒 Deals Blocked — Approval Past SLA</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Waiting For","Days","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{blockedDeals.map(d=>{
                              const rep=reps.find(r=>String(r.id)===String(d.repId));
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:600}}>{d.awaitingApproval}</span></td>
                                  <td style={{padding:"10px 14px",color:C.orange,fontWeight:600}}>{daysSince(d.awaitingApprovalSince)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={d.awaitingApproval||""} onChange={e=>setDeals(p=>p.map(x=>x.id===d.id?{...x,awaitingApproval:e.target.value||null,awaitingApprovalSince:e.target.value?TODAY:null}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}><option value="">— Resolved —</option>{APPROVAL_TARGETS.map(t2=><option key={t2}>{t2}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ RH DASHBOARD ═══ */}
          {view==="rh-dashboard" && isRH && (()=>{
            const myReps   = USER_ROLES.filter(u=>u.role==="SALES REP"&&u.region===rhRegion);
            const myRepIds2= myReps.map(u=>String(u.repId));
            const regionTarget   = targetSubs.filter(s=>myRepIds2.includes(String(s.repId))&&s.status==="Approved").reduce((s,t)=>s+t.totalTarget,0);
            const regionAchieved = revenueEntries.filter(e=>myRepIds2.includes(String(e.repId))&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const regionShortfall= Math.max(0,regionTarget-regionAchieved);
            const regionPipeline = visibleDeals.filter(d=>myRepIds2.includes(String(d.repId))&&!["Lost","RO Received"].includes(d.outcome||"")).reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
            const notLoggedToday  = myReps.filter(u=>!(meetings||[]).some(m=>String(m.repId)===String(u.repId)&&m.date===TODAY));
            const notPlannedTmrw  = myReps.filter(u=>!(weeklyPlans||[]).some(p=>String(p.repId)===String(u.repId)&&p.date===TOMORROW));
            const pendingApprovals= targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH");
            const pendingIRs      = internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval");
            const overdueActions  = tasks.filter(t=>myRepIds2.includes(String(t.repId))&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY);
            const stalledDeals    = visibleDeals.filter(d=>myRepIds2.includes(String(d.repId))&&!["Lost","RO Received"].includes(d.outcome||"")&&daysSince(d.lastContact||d.createdAt||TODAY)>=7);
            const myEscalations   = internalReqs.filter(r=>r.dept==="Region Head"&&r.status!=="Done"&&r.status!=="Withdrawn"&&USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion);
            const flags = [
              {label:"Reps not logged today",         items:notLoggedToday,    color:C.red,    icon:"⚠",
                nav:"rh-team-plan",    detail:(u:any)=>u.name,
                headerClick:()=>{setRhTeamFilter({rep:"",dateRange:"today",client:"",status:""});setView("rh-team-plan");},
                chipClick:(u:any)=>{setRhTeamFilter({rep:String(u.repId),dateRange:"today",client:"",status:""});setView("rh-team-plan");}},
              {label:"Reps not planned for tomorrow", items:notPlannedTmrw,    color:C.orange, icon:"⏰",
                nav:"rh-team-plan",    detail:(u:any)=>u.name,
                headerClick:()=>{setRhTeamFilter({rep:"",dateRange:"tomorrow",client:"",status:""});setView("rh-team-plan");},
                chipClick:(u:any)=>{setRhTeamFilter({rep:String(u.repId),dateRange:"tomorrow",client:"",status:""});setView("rh-team-plan");}},
              {label:"Target approvals pending",      items:pendingApprovals,  color:C.accent, icon:"◎",
                nav:"target-approvals", detail:(t:any)=>t.repName,
                headerClick:()=>setView("target-approvals"),
                chipClick:()=>setView("target-approvals")},
              {label:"IR approvals pending",          items:pendingIRs,        color:C.accent, icon:"⬆",
                nav:"internal-requests", detail:(r:any)=>r.subject,
                headerClick:()=>setView("internal-requests"),
                chipClick:()=>setView("internal-requests")},
              {label:"Overdue action items",          items:overdueActions,    color:C.red,    icon:"✗",
                nav:"rh-team-report",   detail:(t:any)=>t.title,
                headerClick:()=>{setRhTeamReportRep("");setView("rh-team-report");},
                chipClick:(t:any)=>{setRhTeamReportRep(String(t.repId||""));setView("rh-team-report");}},
              {label:"Stalled deals (7+ days idle)",  items:stalledDeals,      color:C.purple, icon:"⏸",
                nav:"warroom",          detail:(d:any)=>d.clientCompany,
                headerClick:()=>{setRhWarroomClient("");setRhWarroomRep("");setView("warroom");},
                chipClick:(d:any)=>{setRhWarroomClient(d.clientCompany);setRhWarroomRep(String(d.repId||""));setView("warroom");}},
              {label:"Escalated items to you",        items:myEscalations,     color:C.red,    icon:"⬆",
                nav:"rh-escalations",  detail:(r:any)=>r.subject,
                headerClick:()=>setView("rh-escalations"),
                chipClick:()=>setView("rh-escalations")},
            ].filter(f=>f.items.length>0);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>DASHBOARD</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · Real-time overview</div>
                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{TODAY}</div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:16,marginTop:10,flexWrap:"wrap"}}>
                  {[
                    {label:"TARGET",   value:fmtR(regionTarget),    color:C.accent},
                    {label:"ACHIEVED", value:fmtR(regionAchieved),  color:C.green},
                    {label:"SHORTFALL",value:fmtR(regionShortfall), color:regionShortfall>0?C.red:C.green},
                    {label:"PIPELINE", value:fmtR(regionPipeline),  color:C.blue},
                  ].map(card=>(
                    <div key={card.label} style={{flex:"1 1 100px",background:C.surface,border:`1px solid ${card.color}33`,borderLeft:`3px solid ${card.color}`,borderRadius:6,padding:"8px 12px"}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{card.label}</div>
                      <div className="sans" style={{fontSize:15,fontWeight:800,color:card.color}}>{card.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:8,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>
                  {flags.length===0?"STATUS FLAGS":`STATUS FLAGS · ${flags.length} item${flags.length!==1?"s":""} need attention`}
                </div>
                {flags.length===0&&(
                  <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",marginBottom:20}}>
                    <div style={{fontSize:22,marginBottom:8}}>✓</div>
                    <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>All clear</div>
                    <div style={{fontSize:11,color:C.dim}}>No alerts in {rhRegion} region right now.</div>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                  {flags.map((flag,fi)=>(
                    <div key={fi} style={{background:C.surface,border:`1px solid ${flag.color}33`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${flag.color}10`,borderBottom:`1px solid ${flag.color}22`,cursor:"pointer"}} onClick={flag.headerClick}>
                        <span style={{fontSize:14}}>{flag.icon}</span>
                        <span style={{fontWeight:700,fontSize:12,color:flag.color}}>{flag.label}</span>
                        <span style={{marginLeft:"auto",background:`${flag.color}22`,color:flag.color,padding:"1px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{flag.items.length}</span>
                        <span style={{fontSize:10,color:flag.color,opacity:.7}}>→</span>
                      </div>
                      <div style={{padding:"8px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                        {flag.items.slice(0,8).map((item:any,i:number)=>(
                          <span key={i} onClick={()=>flag.chipClick(item)}
                            title="Click to view →"
                            style={{background:C.s2,border:`1px solid ${flag.color}44`,borderRadius:4,padding:"3px 8px",fontSize:11,color:C.text,cursor:"pointer",transition:"background .1s"}}
                            onMouseOver={e=>(e.currentTarget.style.background=`${flag.color}18`)}
                            onMouseOut={e=>(e.currentTarget.style.background=C.s2)}>
                            {flag.detail(item)}
                          </span>
                        ))}
                        {flag.items.length>8&&<span style={{fontSize:11,color:C.muted,padding:"3px 8px"}}>+{flag.items.length-8} more</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>REP STATUS TODAY <span style={{fontSize:9,fontWeight:400,color:C.muted}}>· click any card to view their meetings</span></div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                  {myReps.map(rep=>{
                    const repId=rep.repId;
                    const loggedT  =(meetings||[]).some(m=>String(m.repId)===String(repId)&&m.date===TODAY);
                    const plannedT =(weeklyPlans||[]).some(p=>String(p.repId)===String(repId)&&p.date===TOMORROW);
                    const openT    =tasks.filter(t=>String(t.repId)===String(repId)&&t.status!=="Done").length;
                    const achT     =revenueEntries.filter(e=>String(e.repId)===String(repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    const tgtT     =targetSubs.filter(s=>String(s.repId)===String(repId)&&s.status==="Approved").reduce((s,t)=>s+t.totalTarget,0);
                    const pctT     =tgtT>0?Math.round(achT/tgtT*100):0;
                    return (
                      <div key={rep.id}
                        onClick={()=>{setRhTeamFilter({rep:String(repId),dateRange:"today-tomorrow",client:"",status:""});setView("rh-team-plan");}}
                        style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",cursor:"pointer",transition:"border-color .12s"}}
                        onMouseOver={e=>e.currentTarget.style.borderColor=C.accent}
                        onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <div style={{width:24,height:24,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent}}>{rep.name[0]}</div>
                          <span style={{fontWeight:600,fontSize:12,flex:1}}>{rep.name}</span>
                          <span style={{fontSize:9,color:C.muted}}>›</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:10}}>
                          <span style={{color:loggedT?C.green:C.red,fontWeight:600}}>{loggedT?"✓ Logged":"✗ Not logged"}</span>
                          <span style={{color:plannedT?C.green:C.orange,fontWeight:600}}>{plannedT?"✓ Planned":"⏰ No plan"}</span>
                          <span style={{color:C.dim}}>Tasks: <strong style={{color:openT>0?C.orange:C.green}}>{openT}</strong></span>
                          <span style={{color:C.dim}}>Hit: <strong style={{color:pctT>=100?C.green:pctT>=70?C.orange:C.red}}>{pctT}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}


          {/* ═══ MY TASKS (Region Head / NSH) ═══ */}
          {view==="my-tasks" && (isRH||isNSH) && (()=>{
            const myRepIds = isRH ? reps.filter(r=>r.region===rhRegion).map(r=>String(r.id)) : reps.map(r=>r.id);
            const myActionTasks = tasks.filter(t=>t.dept==="NSH"&&t.status!=="Done"&&myRepIds.includes(String(t.repId)));
            const myAssignedTasks = tasks.filter(t=>t.assignedToUserId===activeUser);
            const allMine = [...myAssignedTasks, ...myActionTasks.filter(t=>!myAssignedTasks.find(x=>x.id===t.id))];
            const openCount=allMine.filter(t=>t.status!=="Done").length;
            const doneCount=allMine.filter(t=>t.status==="Done").length;
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>MY TASKS</div>
                    <div style={{fontSize:11,color:C.dim}}>{openCount} open · {doneCount} done · Tasks assigned to you or created by you</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-primary" onClick={openSelfTask}>+ Create Task</button>
                    <button className="btn btn-primary" onClick={()=>setTaskModal(true)}
                      style={{background:C.blue,borderColor:C.blue}}>+ Assign to Rep</button>
                  </div>
                </div>

                {/* Summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[
                    {label:"OPEN",       value:allMine.filter(t=>t.status==="Open").length,                      color:C.blue},
                    {label:"IN PROGRESS",value:allMine.filter(t=>t.status==="In Progress").length,               color:C.accent},
                    {label:"OVERDUE",    value:allMine.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,      color:C.red},
                    {label:"DONE",       value:doneCount,                                                         color:C.green},
                  ].map(k=>(
                    <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {allMine.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No tasks yet. Create one for yourself above.</div>}
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  {allMine.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Task","Client","From","Priority","Status","Due","Update"].map(h=>(
                        <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {allMine.sort((a,b)=>a.status==="Done"?1:b.status==="Done"?-1:a.dueDate>b.dueDate?1:-1).map(t=>{
                        const assigner = t.assignedBy ? USER_ROLES.find(u=>u.id===t.assignedBy)||reps.find(r=>r.id===t.assignedBy) : null;
                        const fromLabel = t.assignedBy===activeUser ? "Me" : assigner?.name || t.assignedByName || "—";
                        const overdue=t.dueDate<TODAY&&t.status!=="Done";
                        const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (
                          <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent",opacity:t.status==="Done"?.6:1}}
                            onMouseOver={e=>e.currentTarget.style.background=overdue?`${C.red}08`:C.s2}
                            onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                            <td style={{padding:"10px 14px"}}><div style={{fontWeight:700,textDecoration:t.status==="Done"?"line-through":"none"}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:220,whiteSpace:"normal",lineHeight:1.4}}>{t.description}</div>}</td>
                            <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                            <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{fromLabel}</td>
                            <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                            <td style={{padding:"10px 14px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                            <td style={{padding:"10px 14px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                            <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                              {t.status!=="Done"&&(
                                <select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))}
                                  style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,marginRight:4}}>
                                  {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                </select>
                              )}
                              {t.status==="Done"&&<span style={{color:C.green,fontSize:11}}>✓ Done</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>}
                </div>
              </div>
            );
          })()}

          {/* ═══ RH TEAM PIPELINE ═══ */}
          {view==="rh-team-pipeline" && isRH && (()=>{
            const myReps=reps.filter(r=>r.region===rhRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · All rep deals</div></div>
                </div>
                {myReps.map(rep=>{
                  const rd=visibleDeals.filter(d=>String(d.repId)===String(rep.id)&&d.outcome!=="Not Interested");
                  if(!rd.length) return null;
                  const rC=revenueEntries.filter(e=>String(e.repId)===String(rep.id)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rP=rd.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+d.amount,0);
                  return (
                    <div key={rep.id} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{rep.name}</span>
                        <span style={{fontSize:11,color:C.dim}}>{rd.length} deals</span>
                        <span style={{color:C.green,fontWeight:600,fontSize:11,marginLeft:"auto"}}>{fmtR(rC)} closed</span>
                        <span style={{color:C.accent,fontSize:11}}>{fmtR(rP)} pipeline</span>
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {rd.sort((a,b)=>b.amount-a.amount).map(d=>(
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                                onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                <td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:180}}>{d.nextStep||"—"}</td>
                                <td style={{padding:"9px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ RH TEAM TARGETS ═══ — same as RH targets but labelled for Team */}
          {view==="rh-team-targets" && isRH && view==="rh-team-targets" && (()=>{
            const myReps=reps.filter(r=>r.region===rhRegion);
            const rhT=visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhRepIds_tm=[...new Set(myReps.map(r=>String(r.id)))];
            const rhC=revenueEntries.filter(e=>rhRepIds_tm.includes(String(e.repId))&&qMatch(e.quarter||"")).reduce((s,e)=>s+(e.amount||0),0);
            const rhPct=rhT>0?Math.round((rhC/rhT)*100):0;
            const sc=rhPct>=80?C.green:rhPct>=50?C.accent:C.red;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM TARGETS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · {filterQ}</div>
                <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"16px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>Region Total</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                    {[["TARGET",fmtR(rhT),C.text],["CLOSED",fmtR(rhC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0)),C.accent],["GAP",fmtR(Math.max(0,rhT-rhC)),rhC>=rhT?C.green:C.red]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:sc,lineHeight:1}}>{rhPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                  </div>
                  <div style={{marginTop:10,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rhPct,100)}%`,background:sc,borderRadius:3}} /></div>
                </div>
                {rhRepDrill ? (()=>{
                  const rep=reps.find(r=>r.id===rhRepDrill);
                  const rd=visibleDeals.filter(d=>String(d.repId)===String(rhRepDrill));
                  return (
                    <div>
                      <button onClick={()=>setRhRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginBottom:12}}>← Back to Reps</button>
                      <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:10}}>{rep?.name} · Client List</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{rd.map(d=>{const ach=revenueEntries.filter(e=>String(e.repId)===String(d.repId)&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);const sf=Math.max(0,(d.targetAmount||0)-ach);return(
                            <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"9px 12px",fontWeight:700}}>{d.clientCompany}</td>
                              <td style={{padding:"9px 12px"}}>{fmtR(d.targetAmount)}</td>
                              <td style={{padding:"9px 12px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}</td>
                              <td style={{padding:"9px 12px",color:C.accent}}>{fmtR(!["Mail Confirmed","Not Interested"].includes(d.outcome)?d.amount:0)}</td>
                              <td style={{padding:"9px 12px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                              <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                            </tr>
                          );})}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                    {myReps.map(rep=>{
                      const rd=visibleDeals.filter(d=>String(d.repId)===String(rep.id));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>String(e.repId)===String(rep.id)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rsc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (
                        <div key={rep.id} onClick={()=>setRhRepDrill(String(rep.id))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div className="sans" style={{fontWeight:700}}>{rep.name}</div>
                            <div className="sans" style={{fontSize:20,fontWeight:800,color:rsc}}>{rPct}%</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                            {[["Target",fmtR(rT)],["Closed",fmtR(rC)]].map(([l,v])=>(
                              <div key={l} style={{background:C.s2,borderRadius:4,padding:"5px 8px"}}>
                                <div style={{fontSize:9,color:C.dim}}>{l}</div>
                                <div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:C.text}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:rsc}} /></div>
                          <div style={{fontSize:9,color:C.dim,marginTop:5,textAlign:"right"}}>Click to see clients →</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH TEAM TASKS ═══ */}
          {view==="rh-team-tasks" && isRH && (()=>{
            const myRepIds=reps.filter(r=>r.region===rhRegion).map(r=>r.id);
            const teamTasks=tasks.filter(t=>myRepIds.includes(String(t.repId)));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · All rep tasks</div></div>
                  <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Assign Task</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"OPEN",v:teamTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:teamTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:teamTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:teamTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {teamTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No tasks for your team yet.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Task","Client","Priority","Status","Due","Action"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{teamTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>String(r.id)===String(t.repId));const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{rep?.name||"—"}</div></td>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                          <td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                          <td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH TEAM HR ═══ */}
          {view==="rh-team-hr" && isRH && (()=>{
            const myRepIds=reps.filter(r=>r.region===rhRegion).map(r=>r.id);
            const teamAbs=absenceReports.filter(r=>myRepIds.includes(r.repId));
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · All rep absence records</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"TOTAL ABSENCES",v:teamAbs.filter(r=>r.markedAs==="Absent").length,c:C.red},{l:"EXCEPTIONS",v:teamAbs.filter(r=>r.exception==="Overridden").length,c:C.orange},{l:"REPORTS SENT",v:teamAbs.length,c:C.dim}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {teamAbs.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No absence records for your team.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Date","Status","Exception","Notes"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{teamAbs.map(r=>(
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}  onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px",fontWeight:600}}>{r.repName}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                          <td style={{padding:"9px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception} · by {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{r.exceptionReason||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH MY HR ═══ */}
          {view==="rh-my-hr" && isRH && (()=>{
            // RH has no repId — use userId (activeUser) as their identifier throughout
            const myPlanRepId = user_role?.id; // "rh_north", "rh_south", etc.
            const myAbs       = absenceReports.filter((r:any)=>r.userId===activeUser||(r.repId!=null&&String(r.repId)===String(user_role?.repId)));
            const absentDays  = myAbs.filter((r:any)=>r.markedAs==="Absent").length;
            const exceptions  = myAbs.filter((r:any)=>r.exception==="Overridden").length;
            const sentToHR    = myAbs.filter((r:any)=>r.status==="Sent to HR").length;
            // RH logs meetings with loggedByUserId; weeklyPlans stored with repId = their userId string
            const loggedToday = (meetings||[]).some(m=>m.loggedByUserId===activeUser&&m.date===TODAY);
            const plannedTmrw = (weeklyPlans||[]).some(p=>String(p.repId)===String(myPlanRepId)&&p.date===TOMORROW);
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>MY HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Your own attendance and compliance record</div>
                <div className="card" style={{padding:"14px 16px",marginBottom:16,borderLeft:`3px solid ${loggedToday?C.green:C.red}`}}>
                  <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>TODAY'S LOG</div>
                      <div style={{fontWeight:700,fontSize:14,color:loggedToday?C.green:C.red}}>{loggedToday?"✓ Meeting logged":"✗ No meeting logged yet"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>TOMORROW'S PLAN</div>
                      <div style={{fontWeight:700,fontSize:14,color:plannedTmrw?C.green:C.orange}}>{plannedTmrw?"✓ Meeting planned":"⏰ Nothing scheduled"}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[
                    {l:"TOTAL RECORDS", v:myAbs.length,  c:C.dim},
                    {l:"ABSENT DAYS",   v:absentDays,    c:absentDays>0?C.red:C.green},
                    {l:"EXCEPTIONS",    v:exceptions,    c:C.orange},
                    {l:"SENT TO HR",    v:sentToHR,      c:C.accent},
                  ].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {/* RH compliance history: show last 30 working days based on logged meetings */}
                {(()=>{
                  // Build a 30-day compliance history for RH from meeting logs
                  const rhMeetings = (meetings||[]).filter(m=>m.loggedByUserId===activeUser||m.loggedByUserId===myPlanRepId);
                  const rhPlans    = (weeklyPlans||[]).filter(p=>String(p.repId)===String(myPlanRepId));
                  const checkDays: string[] = [];
                  for (let d = 0; d < 30; d++) {
                    const dt = new Date(Date.now() - d * 86400000);
                    const dow = dt.getDay(); // 0=Sun, 6=Sat
                    if (dow === 0) continue; // skip Sundays
                    checkDays.push(dt.toISOString().split("T")[0]);
                  }
                  const rows2 = checkDays.map(day => {
                    const logged  = rhMeetings.some(m=>m.date===day);
                    const planned = rhPlans.some(p=>p.date===day);
                    const late    = rhMeetings.filter(m=>m.date===day&&m.loggedLate).length > 0;
                    return {day, logged, planned, late};
                  });
                  const loggedDays = rows2.filter(r=>r.logged).length;
                  const missedDays = rows2.filter(r=>r.day<TODAY&&!r.logged).length;
                  const lateDays   = rows2.filter(r=>r.late).length;
                  const hitPct     = checkDays.filter(d=>d<TODAY).length > 0
                    ? Math.round(loggedDays / Math.max(1, checkDays.filter(d=>d<=TODAY).length) * 100) : 100;
                  return (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                        {[
                          {l:"DAYS LOGGED (30d)",  v:loggedDays,    c:C.green},
                          {l:"DAYS MISSED",        v:missedDays,    c:missedDays>0?C.red:C.green},
                          {l:"LATE LOGS",          v:lateDays,      c:lateDays>0?C.orange:C.green},
                          {l:"COMPLIANCE %",       v:`${hitPct}%`,  c:hitPct>=90?C.green:hitPct>=70?C.orange:C.red},
                        ].map(k=>(
                          <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>LAST 30 WORKING DAYS</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Date","Day","Logged?","Planned?","Late?"].map(h=>(
                            <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                          ))}</tr></thead>
                          <tbody>{rows2.map(r=>{
                            const dow2 = new Date(r.day+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short"});
                            return (
                              <tr key={r.day} style={{borderBottom:`1px solid ${C.s2}`,background:(!r.logged&&r.day<TODAY)?`${C.red}04`:"transparent"}}>
                                <td style={{padding:"8px 12px",fontWeight:600,color:r.day===TODAY?C.accent:C.text}}>{r.day}{r.day===TODAY?" (today)":""}</td>
                                <td style={{padding:"8px 12px",color:C.dim}}>{dow2}</td>
                                <td style={{padding:"8px 12px"}}><span style={{color:r.logged?C.green:r.day<TODAY?C.red:C.muted,fontWeight:700}}>{r.logged?"✓ Yes":r.day<TODAY?"✗ No":"—"}</span></td>
                                <td style={{padding:"8px 12px"}}><span style={{color:r.planned?C.green:C.muted,fontWeight:600}}>{r.planned?"✓":"—"}</span></td>
                                <td style={{padding:"8px 12px"}}>{r.late?<span style={{color:C.orange,fontWeight:700}}>⚠ Late</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                      {myAbs.length>0&&(
                        <div style={{marginTop:16}}>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>EXCEPTION / ABSENCE RECORDS</div>
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Date","Status","Exception","Approved By","Notes"].map(h=>(
                                <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}</tr></thead>
                              <tbody>{[...myAbs].sort((a:any,b:any)=>b.date>a.date?1:-1).map((r:any)=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}}>
                                  <td style={{padding:"8px 12px",fontWeight:600}}>{r.date}</td>
                                  <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                                  <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception}</span>:<span style={{color:C.muted}}>—</span>}</td>
                                  <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.exceptionBy||"—"}</td>
                                  <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.exceptionReason||"—"}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ═══ RH TEAM REPORT ═══ */}
          {view==="rh-team-report" && isRH && (()=>{
            const myReps   = USER_ROLES.filter(u=>u.role==="SALES REP"&&u.region===rhRegion);
            const rows = myReps.map(rep=>{
              const repId       = rep.repId;
              const target      = targetSubs.filter(s=>String(s.repId)===String(repId)&&s.status==="Approved").reduce((s:number,t:any)=>s+t.totalTarget,0);
              const achieved    = revenueEntries.filter(e=>String(e.repId)===String(repId)&&qMatch(e.quarter)).reduce((s:number,e:any)=>s+(e.amount||0),0);
              const shortfall   = Math.max(0,target-achieved);
              const pct         = target>0?Math.round(achieved/target*100):0;
              const pipeline    = visibleDeals.filter(d=>String(d.repId)===String(repId)&&!["Lost","RO Received"].includes(d.outcome||"")).reduce((s:number,d:any)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
              const mtgsThisWk  = (meetings||[]).filter(m=>String(m.repId)===String(repId)&&m.date>=MONDAY&&m.date<=TODAY).length;
              const loggedToday = (meetings||[]).some(m=>String(m.repId)===String(repId)&&m.date===TODAY);
              const plannedTmrw = (weeklyPlans||[]).some(p=>String(p.repId)===String(repId)&&p.date===TOMORROW);
              const openTasks   = tasks.filter(t=>String(t.repId)===String(repId)&&t.status!=="Done").length;
              const overdueTasks= tasks.filter(t=>String(t.repId)===String(repId)&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY).length;
              const escCount    = internalReqs.filter(r=>String(r.repId)===String(repId)&&r.status!=="Done"&&r.status!=="Withdrawn"&&(r.escLevel>0||r.status==="Overdue")).length;
              return {rep,repId,target,achieved,shortfall,pct,pipeline,mtgsThisWk,loggedToday,plannedTmrw,openTasks,overdueTasks,escCount};
            });
            const totTarget   = rows.reduce((s,r)=>s+r.target,0);
            const totAchieved = rows.reduce((s,r)=>s+r.achieved,0);
            const totPipeline = rows.reduce((s,r)=>s+r.pipeline,0);
            const totOverdue  = rows.reduce((s,r)=>s+r.overdueTasks,0);
            // Filter table rows when navigated from overdue items chip
            const displayRows = rhTeamReportRep ? rows.filter(r=>String(r.repId)===rhTeamReportRep) : rows;
            const filterRepName = rhTeamReportRep ? (USER_ROLES.find(u=>String(u.repId)===rhTeamReportRep)||myReps.find(u=>String(u.repId)===rhTeamReportRep))?.name : "";
            return (
              <div className="fin">
                {/* Active rep filter banner */}
                {rhTeamReportRep&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.red}08`,border:`1.5px solid ${C.red}33`,borderRadius:7,padding:"7px 14px",marginBottom:14}}>
                    <span style={{flex:1,fontSize:12,color:C.red,fontWeight:600}}>
                      Filtered to rep: <strong>{filterRepName||"Rep"}</strong> <span style={{fontWeight:400,color:C.dim}}>· navigated from overdue action items</span>
                    </span>
                    <button onClick={()=>setRhTeamReportRep("")}
                      style={{background:"transparent",border:`1px solid ${C.red}66`,borderRadius:4,padding:"3px 10px",color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      × Show all reps
                    </button>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TEAM REPORT</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {filterQ} · {myReps.length} rep{myReps.length!==1?"s":""}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {[
                    {label:"TOTAL TARGET",   value:fmtR(totTarget),   color:C.accent},
                    {label:"TOTAL ACHIEVED", value:fmtR(totAchieved), color:C.green},
                    {label:"TOTAL PIPELINE", value:fmtR(totPipeline), color:C.blue},
                    {label:"OVERDUE TASKS",  value:totOverdue,         color:totOverdue>0?C.red:C.green},
                  ].map(c=>(
                    <div key={c.label} className="card" style={{padding:"12px 14px",borderTop:`2px solid ${c.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{c.label}</div>
                      <div className="sans" style={{fontSize:20,fontWeight:700,color:c.color}}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Target","Achieved","Hit%","Pipeline","Mtgs (wk)","Today","Tmrw","Tasks","Overdue","Esc","View"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {displayRows.length===0&&<tr><td colSpan={12} style={{padding:24,textAlign:"center",color:C.muted}}>No reps in {rhRegion} region</td></tr>}
                      {displayRows.map(row=>(
                        <tr key={row.repId}
                          style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                          onClick={()=>{setRhTeamFilter({rep:String(row.repId),dateRange:"today-tomorrow",client:"",status:""});setView("rh-team-plan");}}
                          onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                          <td style={{padding:"10px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent}}>{row.rep.name[0]}</div>
                              <span style={{fontWeight:600}}>{row.rep.name}</span>
                            </div>
                          </td>
                          <td style={{padding:"10px 12px",color:C.dim}}>{row.target>0?fmtR(row.target):"—"}</td>
                          <td style={{padding:"10px 12px",fontWeight:600,color:row.achieved>0?C.green:C.muted}}>{row.achieved>0?fmtR(row.achieved):"—"}</td>
                          <td style={{padding:"10px 12px"}}>
                            <span style={{background:row.pct>=100?`${C.green}22`:row.pct>=70?`${C.orange}18`:`${C.red}18`,color:row.pct>=100?C.green:row.pct>=70?C.orange:C.red,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{row.target>0?`${row.pct}%`:"—"}</span>
                          </td>
                          <td style={{padding:"10px 12px",color:C.blue}}>{row.pipeline>0?fmtR(row.pipeline):"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:C.dim,fontWeight:600}}>{row.mtgsThisWk}</td>
                          <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{color:row.loggedToday?C.green:C.red,fontSize:16}}>{row.loggedToday?"✓":"✗"}</span></td>
                          <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{color:row.plannedTmrw?C.green:C.orange,fontSize:16}}>{row.plannedTmrw?"✓":"⏰"}</span></td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:600,color:row.openTasks>0?C.orange:C.green}}>{row.openTasks}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:600,color:row.overdueTasks>0?C.red:C.green}}>{row.overdueTasks||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:700,color:row.escCount>0?C.red:C.green}}>{row.escCount||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:C.blue,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>View ›</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
    </>
  );
}
