// @ts-nocheck
import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES, APPROVAL_SLA_DAYS, APPROVAL_TARGETS, TARGET_APPROVAL_CHAIN,
  MEETING_STATUS, MEETING_TYPES, CLIENT_OR_AGENCY, TASK_PRIORITIES, TASK_STATUSES,
  SLA, REQ_STATUS, DEPARTMENTS, PLAN_STATUS, PLAN_DEADLINE, HR_EMAIL,
  ALL_CHANNELS, D1, D3, D7, D14, THIS_WEEK_START, IP_CATALOG, PITCH_TYPES,
  getToday, getTomorrow,
} from "../../constants";
import ZohoSearchInput from "../../components/ZohoSearchInput";

export function WarroomView({ view, setView, isMobile, rhWarroomClient, setRhWarroomClient, rhWarroomRep, setRhWarroomRep }) {
  const {
    user, deals, meetings, tasks, targetSubs, revenueEntries, clientAccounts, touchpoints, internalReqs,
    reps, setReps, masterClients, setMasterClients, clientMasterList, setClientMasterList,
    adminConfig, setAdminConfig, savedROs, setSavedROs, att, setAtt, absenceReports, setAbsenceReports,
    weeklyPlans, setWeeklyPlans, properties, setProperties, ipProposals, setIpProposals,
    attDbRecords, attExcRequests, attDbLoading, fetchAttendanceData,
    user_role, isRep, isRH, isNSH, isCRORole, isStrategy, isDigiOps, isAdmin, isNSHDashboard,
    canLogMeeting, canGrantException, rhRegion, activeUser, setActiveUser,
    filterQ, setFilterQ, filterRegion, setFilterRegion, entryQ,
    visibleDeals, atRisk, overdueNext, closedRevenue, repScores, qMatch,
    parseCurrency, fmt, fmtR, daysSince, uid, dealStage, oColor, riskColor, riskLabel, lColor,
    mapLegacyOutcome, deptToUserId, getAchieved, getCommitted, getInPlay, getShortfall,
    getAnnualTarget, stackedBar,
    showToast, openNoteModal, pushNotification, updateOutcome, approveDeal, rejectDeal, updateReq,
    openAddDeal, handleAddDeal, openSelfTask, grantException, revokeException, fireAbsenceReport,
    runEODCheck, roPushToPipeline,
    addDealOpen, setAddDealOpen, dealForm, setDealForm,
    logOpen, setLogOpen, logForm, setLogForm,
    viewMeetingId, setViewMeetingId, meetingEditMode, setMeetingEditMode, meetingEditForm, setMeetingEditForm,
    taskModal, setTaskModal, selfTaskMode, setSelfTaskMode, taskForm, setTaskForm,
    noteModal, setNoteModal, noteModalVal, setNoteModalVal,
    expanded, setExpanded, toast, setToast, profileOpen, setProfileOpen,
    accountThreadOpen, setAccountThreadOpen, accountThreadClient, setAccountThreadClient,
    threadAIForm, setThreadAIForm,
    DEAL_STAGES, STAGE_PROB, DEAL_TYPES, REGIONS, ALL_ROLES, QUARTERS, C, TODAY, TOMORROW, CURRENT_FY,
  } = useCROAppContext();
  return (
    <>
          {/* ═══ RH WAR ROOM (Region Head) ═══ */}
          {view==="warroom" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = reps.filter(r => r.region === rhRegion);
            const myRepIds = myReps.map(r => r.id);
            const rhDeals  = visibleDeals;

            // ── MY OWN ACTIONABLES (directed to Region Head) ──
            const myApprovals = rhDeals.filter(d =>
              d.awaitingApproval === "NSH" && d.awaitingApprovalSince && myRepIds.includes(d.repId)
            );
            const myTasks_rh = tasks.filter(t =>
              t.dept === "NSH" && t.status !== "Done" && myRepIds.includes(t.repId)
            );
            const myOverdueTasks = tasks.filter(t =>
              t.assignedTo && myRepIds.includes(t.repId) && t.dueDate < TODAY && t.status !== "Done"
            );

            // ── TEAM NUMBERS ──
            const rhT  = rhDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhC  = revenueEntries.filter(e=>myRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const rhP  = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct= rhT>0?Math.round((rhC/rhT)*100):0;
            // Part 4+9: escalation clock = lastDealMeetingDate, tiered at 7/10/14 days
            const rhAtRisk   = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=7;});
            const rh10d      = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=10;});
            const rh14d      = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=14;});
            const rhOverdue  = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&dealStage(d)!=="Mail Confirmed");

            // Part 4 — Trigger 2A: 4+ Deal Meeting touchpoints with same client in 30 days, no stage movement
            const thirtyDaysAgo = new Date(Date.now()-30*864e5).toISOString().slice(0,10);
            const trigger2A: {repName:string,clientCompany:string,count:number,stageNow:string}[] = [];
            {
              const dealMeetings30 = touchpoints.filter(t=>t.touchpointType==="Deal Meeting"&&(t.date||"")>=thirtyDaysAgo&&myRepIds.includes(t.repId as any));
              const byDealId: Record<string,typeof touchpoints> = {};
              dealMeetings30.forEach(t=>{if(t.dealId){if(!byDealId[t.dealId])byDealId[t.dealId]=[];byDealId[t.dealId].push(t);}});
              Object.entries(byDealId).forEach(([dealId,tps])=>{
                if(tps.length>=4){
                  const deal=rhDeals.find(d=>d.id===dealId);
                  if(!deal||["Mail Confirmed","RO Received","Lost"].includes(dealStage(deal)))return;
                  const stages=new Set(tps.map(t=>t.stageUpdate).filter(Boolean));
                  const noMovement=stages.size<=1;
                  if(noMovement){
                    const rep=reps.find(r=>r.id===deal.repId);
                    trigger2A.push({repName:rep?.name||"Unknown",clientCompany:deal.clientCompany,count:tps.length,stageNow:dealStage(deal)});
                  }
                }
              });
            }

            // Part 4 — Trigger 2B: <15 touchpoints in current calendar month for any rep in region
            const monthStart = TODAY.slice(0,7)+"-01";
            const trigger2B: {repName:string,count:number,repId:number}[] = [];
            {
              myReps.forEach(r=>{
                const monthTPs=touchpoints.filter(t=>t.repId===r.id&&(t.date||"")>=monthStart).length;
                if(monthTPs<15) trigger2B.push({repName:r.name,count:monthTPs,repId:r.id});
              });
            }

            const totalActions = myApprovals.length + myTasks_rh.length;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:rhWarroomClient?8:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}</div>
                  </div>
                </div>

                {/* ── STALLED CLIENT/REP FILTER BANNER (from dashboard chip click) ── */}
                {rhWarroomClient && (()=>{
                  const filterRep = reps.find(r=>String(r.id)===rhWarroomRep);
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.purple}10`,border:`1.5px solid ${C.purple}44`,borderRadius:7,padding:"7px 14px",marginBottom:14}}>
                      <span style={{fontSize:13}}>⏸</span>
                      <span style={{flex:1,fontSize:12,color:C.purple,fontWeight:600}}>
                        Filtered to stalled deal: <strong>{rhWarroomClient}</strong>
                        {filterRep && <span style={{fontWeight:400,color:C.dim}}> · {filterRep.name}</span>}
                      </span>
                      <button onClick={()=>{setRhWarroomClient("");setRhWarroomRep("");}}
                        style={{background:"none",border:`1px solid ${C.purple}55`,borderRadius:4,padding:"2px 10px",fontSize:11,color:C.purple,fontWeight:700,cursor:"pointer"}}>
                        × Clear filter
                      </button>
                    </div>
                  );
                })()}

                {/* ── PIPELINE GAP STRIP ── */}
                {(()=>{
                  const rhGap = Math.max(0, rhT - rhC - rhP);
                  const rhPipelinePct = rhT>0?Math.round((rhP/rhT)*100):0;
                  return (
                    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                      {[
                        {label:"ANNUAL TARGET", val:fmtR(rhT), color:C.text},
                        {label:`ACHIEVED (${rhPct}%)`, val:fmtR(rhC), color:C.green},
                        {label:`ACTIVE PIPELINE (${rhPipelinePct}%)`, val:fmtR(rhP), color:C.blue},
                        {label:"PIPELINE GAP", val:rhGap===0?"✓ On track":fmtR(rhGap), color:rhGap===0?C.green:C.red},
                      ].map(m=>(
                        <div key={m.label} style={{flex:"1 1 140px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{m.label}</div>
                          <div className="sans" style={{fontSize:16,fontWeight:800,color:m.color}}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── SUPPORT REQUESTS (to RH's region reps) ── */}
                {(()=>{
                  const regionSRs = internalReqs.filter(r=>
                    r.type==="Support Request" &&
                    !["Done","Withdrawn","Rejected"].includes(r.status||"") &&
                    myRepIds.includes(r.repId as any)
                  );
                  if (!regionSRs.length) return null;
                  return (
                    <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13}}>🆘</span>
                          <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {regionSRs.length} open from your region</span>
                        </div>
                        <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                      </div>
                      {regionSRs.slice(0,4).map(sr=>{
                        const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                        const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                        const rep = reps.find(r=>r.id===sr.repId);
                        return (
                          <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                              <div style={{fontSize:10,color:C.dim}}>{rep?.name||sr.raisedByName} · → {sr.dept}</div>
                            </div>
                            <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                            {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                          </div>
                        );
                      })}
                      {regionSRs.length>4&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{regionSRs.length-4} more</div>}
                    </div>
                  );
                })()}

                {/* ── SECTION A: MY ACTIONABLES ── */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                    MY ACTIONABLES · {totalActions} item{totalActions!==1?"s":""} need your decision
                  </div>

                  {totalActions===0 && myOverdueTasks.length===0 && (
                    <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:7,padding:"11px 16px",fontSize:12,color:C.green}}>✓ No items waiting on you right now.</div>
                  )}

                  {/* Approvals pending RH sign-off */}
                  {myApprovals.map(d=>{
                    const rep = reps.find(r=>r.id===d.repId);
                    const dw  = daysSince(d.awaitingApprovalSince||TODAY);
                    return (
                      <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}33`,borderRadius:7,padding:"11px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:C.orange,fontSize:13}}>⏳</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700}}>{d.clientCompany} <span style={{color:C.dim,fontWeight:400,fontSize:11}}>· {rep?.name}</span></div>
                          <div style={{fontSize:11,color:C.dim,marginTop:2}}>{d.nextStep}</div>
                        </div>
                        <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{dw}d waiting</span>
                        <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        <button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()}
                          style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Approve →</button>
                      </div>
                    );
                  })}

                  {/* Tasks created by reps needing NSH */}
                  {myTasks_rh.map(t=>{
                    const rep = reps.find(r=>r.id===t.repId);
                    return (
                      <div key={t.id} style={{background:`${C.blue}06`,border:`1px solid ${C.blue}33`,borderRadius:7,padding:"11px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:C.blue,fontSize:13}}>📋</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700}}>{t.title} <span style={{color:C.dim,fontWeight:400,fontSize:11}}>· {rep?.name} · {t.clientCompany}</span></div>
                          {t.description&&<div style={{fontSize:11,color:C.dim,marginTop:2}}>{t.description}</div>}
                        </div>
                        <span style={{fontSize:10,color:C.dim}}>Due {t.dueDate}</span>
                        <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))}
                          style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button>
                      </div>
                    );
                  })}
                </div>

                {/* ── DYNAMIC ANALYSIS ── */}
                {(()=>{
                  const staleDeals   = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                  const overdueSteps = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                  const highRiskBig  = rhDeals.filter(d=>d.amount>=5000000&&!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=5);
                  const repPcts      = myReps.map(r=>{
                    const rd=rhDeals.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=revenueEntries.filter(e=>e.repId===r.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    return {name:r.name,pct:t>0?Math.round((c/t)*100):null};
                  }).filter(r=>r.pct!==null);
                  const laggingReps  = repPcts.filter(r=>r.pct<40);
                  const pendingApps  = targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH");
                  const closingSoon  = rhDeals.filter(d=>["Very Interested","Interested – Needs Revision"].includes(d.outcome)&&d.nextStepDate&&d.nextStepDate<=TOMORROW);

                  const insights: {priority:"critical"|"warning"|"good", text:string}[] = [];
                  if(staleDeals.length>0) insights.push({priority:"critical",  text:`${staleDeals.length} active deal${staleDeals.length>1?"s":""} with no contact in 7+ days — ${staleDeals.slice(0,2).map(d=>d.clientCompany).join(", ")}${staleDeals.length>2?" +more":""}.`});
                  if(highRiskBig.length>0) insights.push({priority:"critical",  text:`${highRiskBig.length} high-value deal${highRiskBig.length>1?"s":""} (₹50L+) going cold — ${highRiskBig.slice(0,2).map(d=>d.clientCompany).join(", ")}.`});
                  if(overdueSteps.length>0) insights.push({priority:"warning",   text:`${overdueSteps.length} overdue next step${overdueSteps.length>1?"s":""} — reps need follow-ups today.`});
                  if(laggingReps.length>0)  insights.push({priority:"warning",   text:`${laggingReps.map(r=>`${r.name} (${r.pct}%)`).join(", ")} significantly below target — needs coaching.`});
                  if(pendingApps.length>0)  insights.push({priority:"warning",   text:`${pendingApps.length} target submission${pendingApps.length>1?"s":""} awaiting your approval.`});
                  if(closingSoon.length>0)  insights.push({priority:"good",      text:`${closingSoon.length} deal${closingSoon.length>1?"s":""} poised to close this week — ${closingSoon.slice(0,2).map(d=>d.clientCompany).join(", ")}.`});
                  if(insights.length===0)   insights.push({priority:"good",      text:"All deals active, no stale contacts, reps on track. Strong position."});

                  const pIcon = {critical:"🔴",warning:"🟡",good:"🟢"};
                  const pBorder = {critical:C.red,warning:C.orange,good:C.green};
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{height:1,background:C.border,marginBottom:16}} />
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                        DYNAMIC ANALYSIS · What needs your attention
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {insights.map((ins,i)=>(
                          <div key={i} style={{background:C.surface,border:`1px solid ${pBorder[ins.priority]}44`,borderLeft:`3px solid ${pBorder[ins.priority]}`,borderRadius:7,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <span style={{fontSize:13,flexShrink:0}}>{pIcon[ins.priority]}</span>
                            <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ins.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── SECTION B: TEAM OVERVIEW ── */}
                <div style={{height:1,background:C.border,marginBottom:16}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                  TEAM OVERVIEW · {rhRegion} Region
                </div>

                {/* Team KPIs */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                  {[
                    {label:"REGION TARGET",  value:fmtR(rhT),       color:C.blue},
                    {label:"REGION CLOSED",  value:fmtR(rhC),       color:C.green},
                    {label:"PIPELINE",       value:fmtR(rhP),       color:C.accent},
                    {label:"ACHIEVEMENT",    value:`${rhPct}%`,      color:rhPct>=80?C.green:rhPct>=50?C.accent:C.red},
                  ].map(k=>(
                    <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div className="sans" style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Rep-by-rep snapshot */}
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Rep","Closed","Pipeline","Target","Achieve %","At Risk","Next Step Due"].map(h=>(
                        <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {myReps.map(rep=>{
                        const rd  = rhDeals.filter(d=>d.repId===rep.id);
                        const rC  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const rP  = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                        const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const rPct= rT>0?Math.round((rC/rT)*100):0;
                        const rRisk = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        const rOverdue = rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                        const sc = rPct>=80?C.green:rPct>=50?C.accent:C.red;
                        return (
                          <tr key={rep.id} style={{borderBottom:`1px solid ${C.s2}`}}
                            onMouseOver={e=>e.currentTarget.style.background=C.s2}
                            onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{rep.name}</div></td>
                            <td style={{padding:"9px 12px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                            <td style={{padding:"9px 12px",color:C.accent}}>{fmtR(rP)}</td>
                            <td style={{padding:"9px 12px",color:C.dim}}>{fmtR(rT)}</td>
                            <td style={{padding:"9px 12px"}}><span style={{color:sc,fontWeight:700}}>{rPct}%</span></td>
                            <td style={{padding:"9px 12px"}}>{rRisk>0?<span style={{color:C.red,fontWeight:700}}>{rRisk} ⚠</span>:<span style={{color:C.green}}>✓</span>}</td>
                            <td style={{padding:"9px 12px",color:rOverdue.length>0?C.orange:C.dim,fontSize:11}}>{rOverdue.length>0?rOverdue[0].nextStepDate+" ("+rOverdue.length+" overdue)":"On track"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Part 9: Tiered escalation alerts — 7 / 10 / 14 day triggers */}
                {rh14d.filter(d=>(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ INTERVENE REQUIRED — 14+ DAYS NO DEAL MEETING</div>
                    {rh14d.filter(d=>(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      const taskId=`rh14-${d.id}`;
                      const alreadyTasked=tasks.some(t=>t.id===taskId);
                      return (
                        <div key={d.id} style={{background:`${C.red}10`,border:`1.5px solid ${C.red}55`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:C.red}}>🔴</span>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{background:`${C.red}22`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{idle}d no deal meeting</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                          {!alreadyTasked&&(
                            <button onClick={()=>{
                              setTasks(p=>[...p,{id:taskId,title:`Intervene — ${d.clientCompany} — ${idle}d — ${rep?.name||""}`,dept:"Region Head",status:"Open",dueDate:TODAY,repId:d.repId,createdAt:TODAY,priority:"High"}]);
                              showToast(`Task created: Intervene — ${d.clientCompany}`);
                            }} style={{background:C.red,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              Create Task
                            </button>
                          )}
                          {alreadyTasked&&<span style={{color:C.green,fontSize:10,fontWeight:700}}>✓ Task created</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {rh10d.filter(d=>!rh14d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>ℹ 10+ DAYS NO DEAL MEETING — MONITOR CLOSELY</div>
                    {rh10d.filter(d=>!rh14d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      return (
                        <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}33`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:C.orange}}>⚡</span>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{idle}d no deal meeting</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {rhAtRisk.filter(d=>!rh10d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>NO DEAL MEETING 7+ DAYS — TEAM AT RISK</div>
                    {rhAtRisk.filter(d=>!rh10d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      return (
                        <div key={d.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{color:C.red,fontSize:11}}>{idle}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Part 4 — Trigger 2A: Stalling deals (4+ meetings, no stage movement in 30d) */}
                {trigger2A.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ STALLING DEALS — 4+ MEETINGS, NO STAGE MOVEMENT IN 30 DAYS</div>
                    {trigger2A.map((t,i)=>(
                      <div key={i} style={{background:`${C.orange}08`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,color:C.orange}}>🔁</span>
                        <span style={{flex:1}}><strong>{t.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {t.repName}</span></span>
                        <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{t.count} meetings</span>
                        <span style={{background:`${oColor(t.stageNow)}18`,color:oColor(t.stageNow),padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.stageNow}</span>
                        <span style={{fontSize:10,color:C.muted}}>No stage change in 30d</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Part 4 — Trigger 2B: Reps below 15 touchpoints this month */}
                {trigger2B.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📉 LOW ACTIVITY — UNDER 15 TOUCHPOINTS THIS MONTH</div>
                    {trigger2B.map((t,i)=>(
                      <div key={i} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{flex:1}}><strong>{t.repName}</strong></span>
                        <span style={{background:`${C.red}22`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{t.count} touchpoints this month</span>
                        <span style={{fontSize:10,color:C.muted}}>Minimum expected: 15</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── NEW CLIENTS ADDED BY REPS ── */}
                {(()=>{
                  const newDeals = rhDeals.filter(d=>d.lastContact===TODAY||d.lastContact===TOMORROW).slice(0,5);
                  if(!newDeals.length) return null;
                  return (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>NEW CLIENTS ADDED TODAY</div>
                      {newDeals.map(d=>{
                        const rep=reps.find(r=>r.id===d.repId);
                        return (
                          <div key={d.id} style={{background:`${C.green}06`,border:`1px solid ${C.green}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name} · {d.dealType}</span></span>
                            <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{d.outcome}</span>
                            <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.targetAmount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── TEAM PLAN: TODAY + TOMORROW ── */}
                {(()=>{
                  const rhTodayPlans = (weeklyPlans||[]).filter(p=>myRepIds.includes(p.repId)&&p.date===TODAY);
                  const rhTmrwPlans  = (weeklyPlans||[]).filter(p=>myRepIds.includes(p.repId)&&p.date===TOMORROW);
                  if(!rhTodayPlans.length&&!rhTmrwPlans.length) return null;
                  const renderPlanRow = (p) => {
                    const rep=reps.find(r=>r.id===p.repId);
                    return (
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:C.s2,borderRadius:5,marginBottom:5}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:600,fontSize:12}}>{p.clientAgencyName}</span>
                          <span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span>
                          {p.time&&<span style={{color:C.muted,fontSize:10}}> @ {p.time}</span>}
                        </div>
                        {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{p.pitchType}</span>}
                        <span style={{background:p.status==="Done"?`${C.green}22`:`${C.blue}18`,color:p.status==="Done"?C.green:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{p.status}</span>
                      </div>
                    );
                  };
                  return (
                    <div style={{marginTop:16}}>
                      <div style={{height:1,background:C.border,marginBottom:16}}/>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>TEAM PLAN · {rhTodayPlans.length} today · {rhTmrwPlans.length} tomorrow</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        {[{label:"TODAY",list:rhTodayPlans},{label:"TOMORROW",list:rhTmrwPlans}].map(({label,list})=>(
                          <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                            <div style={{padding:"6px 12px",background:C.s2,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{label} · {list.length} meeting{list.length!==1?"s":""}</div>
                            <div style={{padding:"8px 10px",minHeight:40}}>
                              {list.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:8}}>Nothing planned</div>}
                              {list.map(renderPlanRow)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ═══ NSH WAR ROOM ═══ */}
          {view==="warroom" && isNSHDashboard && (()=>{
            const allD = deals.filter(d=>qMatch(d.quarter));
            const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totP = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const totW = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
            const forecast = totC + totW;
            const gap = Math.max(0, totT - forecast);
            const closePct  = totT>0?Math.round((totC/totT)*100):0;
            const fcastPct  = totT>0?Math.round((forecast/totT)*100):0;
            const fsc = fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red;

            // Region-wise breakdown
            const regions = REGIONS;
            const regionStats = regions.map(r=>{
              const rd = allD.filter(d=>d.region===r);
              const rT = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rRepIds=[...new Set(rd.map(d=>d.repId))];
              const rC = revenueEntries.filter(e=>rRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const rRisk = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
              return {region:r, rT, rC, rPct, rRisk};
            });

            // High-risk deals — highest target, lowest achievement %
            const highRisk = allD
              .filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested")
              .map(d=>{
                const achieved=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const pct = d.targetAmount>0?Math.round((achieved/d.targetAmount)*100):0;
                return {...d, pct};
              })
              .sort((a,b)=> (b.targetAmount - a.targetAmount) || (a.pct - b.pct)) // biggest target first, then lowest achieved
              .slice(0,8);

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>National overview · {filterQ} · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-ghost" onClick={()=>{
                      const allD = deals.filter(d=>qMatch(d.quarter));
                      const totC = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const blocked = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");
                      const atRiskD = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                      const nonCompliant = reps.filter(r=>!att[TODAY]?.[r.id]);
                      const pct = totT>0?Math.round((totC/totT)*100):0;
                      const digest = [
                        `📊 OTV Sales Digest — ${TODAY}`,
                        ``,
                        `Revenue: ${fmtR(totC)} closed / ${fmtR(totT)} target (${pct}%)`,
                        ``,
                        blocked.length ? `⏳ ${blocked.length} deal(s) awaiting approval:` : `✅ No deals blocked`,
                        ...blocked.slice(0,5).map(d=>`  • ${d.clientCompany} — ${fmtR(d.amount)} → ${d.awaitingApproval} (${daysSince(d.awaitingApprovalSince||TODAY)}d)`),
                        ``,
                        atRiskD.length ? `🔴 ${atRiskD.length} deal(s) at risk (7+ days no contact):` : `✅ No at-risk deals`,
                        ...atRiskD.slice(0,5).map(d=>{const r=reps.find(x=>x.id===d.repId);return`  • ${d.clientCompany} — ${r?.name||""} (${daysSince(d.lastContact)}d idle)`;}),
                        ``,
                        nonCompliant.length ? `⚠️ Not logged today: ${nonCompliant.map(r=>r.name).join(", ")}` : `✅ All reps logged`,
                      ].join("\n");
                      navigator.clipboard?.writeText(digest);
                      showToast("Daily digest copied to clipboard ✓");
                    }} title="Copy daily digest for WhatsApp/email">📋 Digest</button>
                  </div>
                </div>

                {/* ── TOTAL SALES DASHBOARD ── */}
                <div style={{background:C.surface,border:`2px solid ${fsc}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Total Sales Dashboard · All Regions</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end",marginBottom:14}}>
                    {[["TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["PIPELINE",fmtR(totP),C.accent],["FORECAST",fmtR(forecast),fsc],["GAP",fmtR(gap),gap===0?C.green:C.red]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div className="sans" style={{fontSize:48,fontWeight:800,color:fsc,lineHeight:1}}>{fcastPct}%</div>
                      <div style={{fontSize:10,color:C.dim}}>forecast · {closePct}% closed</div>
                    </div>
                  </div>
                  {/* Progress bar: closed + weighted pipe */}
                  <div style={{height:8,background:C.s3,borderRadius:4,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(closePct,100)}%`,background:C.green,borderRadius:4}} />
                    <div style={{position:"absolute",left:`${closePct}%`,height:"100%",width:`${Math.min(fcastPct-closePct,100-closePct)}%`,background:`${C.accent}88`}} />
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:C.dim}}>
                    <span style={{color:C.green}}>■ Closed {closePct}%</span>
                    <span style={{color:C.accent}}>■ Weighted pipe {fcastPct-closePct}%</span>
                    <span>■ Gap {100-fcastPct}%</span>
                  </div>
                </div>

                {/* Region scoreline */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
                  {regionStats.map(rs=>{
                    const sc = rs.rPct>=80?C.green:rs.rPct>=50?C.accent:C.red;
                    return (
                      <div key={rs.region} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`2px solid ${sc}`,borderRadius:7,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{rs.region}</div>
                        <div className="sans" style={{fontSize:22,fontWeight:800,color:sc,lineHeight:1}}>{rs.rPct}%</div>
                        <div style={{fontSize:10,color:C.dim,marginTop:3}}>{fmtR(rs.rC)} / {fmtR(rs.rT)}</div>
                        <div style={{marginTop:5,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(rs.rPct,100)}%`,background:sc}} />
                        </div>
                        {rs.rRisk>0&&<div style={{marginTop:4,fontSize:9,color:C.red,fontWeight:700}}>{rs.rRisk} at risk</div>}
                      </div>
                    );
                  })}
                </div>

                {/* ── SECTION 1: REVENUE ── */}
                <div style={{height:1,background:C.border,marginBottom:16,marginTop:4}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>1 · Revenue · {filterQ}</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["","April–Till Date Target","Monthly Target","Projection","Achieved Till Date","LY Month Total"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(()=>{
                        const allD    = deals.filter(d=>qMatch(d.quarter));
                        const aprilTarget = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const monthTarget = Math.round(aprilTarget/3);
                        const achieved  = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const pipeline  = allD.filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
                        const projection = achieved + pipeline;
                        return [["Linear TV","Linear TV"],["IPs","IPs"],["Digital","Digital"],["Media Solutions","Media Solutions"],["Integrated Packages","Integrated Packages"]].map(([label,type])=>{
                          const td = allD.filter(d=>d.dealType===type);
                          const t  = td.reduce((s,d)=>s+(d.targetAmount||0),0);
                          const a  = revenueEntries.filter(e=>e.dealType===type&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                          const p  = td.filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
                          const proj = a + p;
                          const sc = t>0&&proj>=t?C.green:t>0&&proj>=t*0.7?C.accent:t>0?C.red:C.dim;
                          return (
                            <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{t>0?fmtR(t):"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{t>0?fmtR(Math.round(t/3)):"—"}</td>
                              <td style={{padding:"10px 14px",color:sc,fontWeight:700}}>{proj>0?fmtR(proj):"—"}</td>
                              <td style={{padding:"10px 14px",color:a>0?C.green:C.muted,fontWeight:700}}>{a>0?fmtR(a):"—"}</td>
                              <td style={{padding:"10px 14px",color:C.muted}}>—</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* ── CALL REPORT SECTION ── */}
                <div style={{height:1,background:C.border,marginBottom:16,marginTop:4}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>2 · Call Report</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["","Today — Logged","Tomorrow — Planned"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {label:"Region Heads", rows: (() => {
                          const rhs = USER_ROLES.filter(u=>u.role==="REGION HEAD");
                          const todayLogged  = rhs.filter(r=>meetings.some(m=>m.repId===r.repId&&m.date===TODAY)).length;
                          const tmrwPlanned  = rhs.filter(r=>(weeklyPlans||[]).some(p=>p.repId===r.repId&&p.date===TOMORROW&&p.status==="Planned")).length;
                          return {logged:todayLogged, planned:tmrwPlanned, total:rhs.length};
                        })()},
                        {label:"Sales Executives", rows: (() => {
                          const todayLogged  = reps.filter(r=>meetings.some(m=>m.repId===r.id&&m.date===TODAY)).length;
                          const tmrwPlanned  = reps.filter(r=>(weeklyPlans||[]).some(p=>p.repId===r.id&&p.date===TOMORROW&&p.status==="Planned")).length;
                          return {logged:todayLogged, planned:tmrwPlanned, total:reps.length};
                        })()},
                      ].map(({label,rows})=>(
                        <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                          <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{color:rows.logged===rows.total?C.green:rows.logged>0?C.accent:C.red,fontWeight:700}}>{rows.logged}</span>
                            <span style={{color:C.dim}}> / {rows.total}</span>
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{color:rows.planned===rows.total?C.green:rows.planned>0?C.accent:C.red,fontWeight:700}}>{rows.planned}</span>
                            <span style={{color:C.dim}}> / {rows.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── TASKS RECEIVED ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>3 · Tasks Received</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["From","Count","Overdue"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {["RH","Exec"].map(from=>{
                        const fromTasks = tasks.filter(t=>t.dept==="NSH"&&t.status!=="Done");
                        const overdue   = fromTasks.filter(t=>t.dueDate&&t.dueDate<TODAY).length;
                        return (
                          <tr key={from} style={{borderBottom:`1px solid ${C.s2}`}}>
                            <td style={{padding:"10px 14px",fontWeight:700}}>{from==="RH"?"Region Heads":"Sales Executives"}</td>
                            <td style={{padding:"10px 14px",color:C.accent,fontWeight:700}}>{from==="RH"?Math.ceil(fromTasks.length/2):Math.floor(fromTasks.length/2)}</td>
                            <td style={{padding:"10px 14px",color:overdue>0?C.red:C.green,fontWeight:700}}>{from==="RH"?Math.ceil(overdue/2):Math.floor(overdue/2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── TASKS GIVEN ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>4 · Tasks Given</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["To","Open","Overdue"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {label:"Region Heads",     depts:["RH North","RH South","RH East","RH West","RH National"]},
                        {label:"Sales Executives",  depts:reps.map(r=>String(r.id))},
                        {label:"Sales Strategy",    depts:["Sales Strategy"]},
                      ].map(({label,depts})=>{
                        const open    = tasks.filter(t=>depts.some(d=>t.dept===d||String(t.assignedTo)===d)&&t.status!=="Done").length;
                        const overdue = tasks.filter(t=>depts.some(d=>t.dept===d||String(t.assignedTo)===d)&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY).length;
                        return (
                          <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                            <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                            <td style={{padding:"10px 14px",color:open>0?C.accent:C.green,fontWeight:700}}>{open}</td>
                            <td style={{padding:"10px 14px",color:overdue>0?C.red:C.green,fontWeight:700}}>{overdue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── ESCALATIONS / APPROVALS ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>5 · Escalations / Approvals</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                  {[
                    {label:"Pending Approvals",  val:internalReqs.filter(r=>r.dept==="NSH"&&r.status==="Pending").length,   color:C.orange},
                    {label:"Overdue Approvals",  val:internalReqs.filter(r=>r.dept==="NSH"&&r.status==="Overdue").length,   color:C.red},
                    {label:"Target Approvals",   val:targetSubs.filter(t=>t.status==="Pending NSH").length,                  color:C.accent},
                    {label:"Deals Awaiting NSH", val:deals.filter(d=>d.awaitingApproval==="NSH"&&d.outcome!=="Mail Confirmed").length, color:C.purple},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"12px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                      <div className="sans" style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* ── SUPPORT REQUESTS panel (NSH War Room) ── */}
                {(()=>{
                  const openSRsNSH = internalReqs.filter(r=>
                    r.type==="Support Request" &&
                    !["Done","Withdrawn","Rejected"].includes(r.status||"")
                  );
                  if (!openSRsNSH.length) return null;
                  return (
                    <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13}}>🆘</span>
                          <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {openSRsNSH.length} open</span>
                        </div>
                        <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                      </div>
                      {openSRsNSH.slice(0,4).map(sr=>{
                        const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                        const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                        return (
                          <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                              <div style={{fontSize:10,color:C.dim}}>{sr.raisedByName} · → {sr.dept}</div>
                            </div>
                            <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                            {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                          </div>
                        );
                      })}
                      {openSRsNSH.length>4&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{openSRsNSH.length-4} more</div>}
                    </div>
                  );
                })()}

                {/* ── DYNAMIC ANALYSIS ── */}
                {(()=>{
                  const activeD  = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome));
                  const closedD  = allD.filter(d=>d.outcome==="Mail Confirmed");

                  // National-level signals
                  const staleNational  = activeD.filter(d=>daysSince(d.lastContact)>=7);
                  const bigStale       = staleNational.filter(d=>d.targetAmount>=5000000);
                  const overdueNational= allD.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                  const closingSoon    = activeD.filter(d=>["Very Interested","Interested – Needs Revision"].includes(d.outcome)&&d.nextStepDate&&d.nextStepDate<=TOMORROW);
                  const pendingNSH     = targetSubs.filter(t=>t.status==="Pending NSH");
                  const blockedDeals   = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");

                  // Region-level analysis
                  const GEOS = ["North","South","East","West","Odisha"];
                  const regionAnalysis = GEOS.map(reg=>{
                    const rd  = allD.filter(d=>d.region===reg);
                    const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const rRegIds=[...new Set(rd.map(d=>d.repId))];
                    const rC  = revenueEntries.filter(e=>rRegIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    const rPct= rT>0?Math.round((rC/rT)*100):null;
                    const hasDigital = rd.some(d=>d.dealType==="Digital"&&d.outcome!=="Not Interested");
                    return {reg, rT, rC, rPct, hasDigital, count:rd.length};
                  });
                  const laggingRegions  = regionAnalysis.filter(r=>r.rPct!==null&&r.rPct<40);
                  const noDigitalRegions= regionAnalysis.filter(r=>r.count>0&&!r.hasDigital);

                  // Rep-level signals
                  const repPcts = reps.map(r=>{
                    const rd=allD.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=revenueEntries.filter(e=>e.repId===r.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    return {name:r.name,region:r.region,pct:t>0?Math.round((c/t)*100):null};
                  }).filter(r=>r.pct!==null);
                  const laggingReps = repPcts.filter(r=>r.pct<30);

                  // Forecast vs target gap
                  const fcastGapSevere = gap > totT * 0.3; // >30% gap to forecast

                  const insights: {priority:"critical"|"warning"|"good", text:string}[] = [];

                  // Critical
                  if(bigStale.length>0)       insights.push({priority:"critical", text:`${bigStale.length} high-value deal${bigStale.length>1?"s":""} (₹50L+) with no contact in 7+ days — ${bigStale.slice(0,3).map(d=>d.clientCompany).join(", ")}${bigStale.length>3?" +more":""}.`});
                  if(fcastGapSevere)           insights.push({priority:"critical", text:`Forecast gap of ${fmtR(gap)} (${Math.round((gap/totT)*100)}% of target) — aggressive recovery actions required this week.`});
                  if(laggingRegions.length>0)  insights.push({priority:"critical", text:`${laggingRegions.map(r=>`${r.reg} (${r.rPct}%)`).join(", ")} ${laggingRegions.length===1?"region is":"regions are"} significantly below target — escalate to Region Head.`});
                  if(blockedDeals.length>0)    insights.push({priority:"critical", text:`${blockedDeals.length} deal${blockedDeals.length>1?"s":""} blocked awaiting approval — ${blockedDeals.slice(0,2).map(d=>d.clientCompany).join(", ")}. Unblock immediately.`});

                  // Warning
                  if(staleNational.length>0)   insights.push({priority:"warning",  text:`${staleNational.length} active deal${staleNational.length>1?"s":""} with no contact in 7+ days across all regions.`});
                  if(overdueNational.length>0)  insights.push({priority:"warning",  text:`${overdueNational.length} overdue next step${overdueNational.length>1?"s":""} organisation-wide — reps need to action today.`});
                  if(pendingNSH.length>0)       insights.push({priority:"warning",  text:`${pendingNSH.length} target submission${pendingNSH.length>1?"s":""} pending your approval.`});
                  if(laggingReps.length>0)      insights.push({priority:"warning",  text:`${laggingReps.map(r=>`${r.name}/${r.region} (${r.pct}%)`).join(", ")} ${laggingReps.length===1?"is":"are"} well below 30% — flag to RH for coaching.`});
                  if(noDigitalRegions.length>0) insights.push({priority:"warning",  text:`${noDigitalRegions.map(r=>r.reg).join(", ")} ${noDigitalRegions.length===1?"region has":"regions have"} no Digital deals in pipeline — push for cross-sell.`});

                  // Good
                  if(closingSoon.length>0)      insights.push({priority:"good",     text:`${closingSoon.length} deal${closingSoon.length>1?"s":""} likely to close this week — ${closingSoon.slice(0,3).map(d=>d.clientCompany).join(", ")}.`});
                  if(closePct>=80)               insights.push({priority:"good",     text:`Organisation at ${closePct}% of target — strong performance. Focus on pipeline hygiene to protect the number.`});
                  if(insights.filter(i=>i.priority==="critical").length===0&&insights.filter(i=>i.priority==="warning").length===0) insights.push({priority:"good", text:"No critical issues nationally. All regions active, approvals clear, reps on track."});

                  const pIcon   = {critical:"🔴",warning:"🟡",good:"🟢"};
                  const pBorder = {critical:C.red,warning:C.orange,good:C.green};
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{height:1,background:C.border,marginBottom:16}} />
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                        DYNAMIC ANALYSIS · National Intelligence
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {insights.map((ins,i)=>(
                          <div key={i} style={{background:C.surface,border:`1px solid ${pBorder[ins.priority]}44`,borderLeft:`3px solid ${pBorder[ins.priority]}`,borderRadius:7,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <span style={{fontSize:13,flexShrink:0}}>{pIcon[ins.priority]}</span>
                            <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ins.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

          {/* ═══ WAR ROOM ═══ */}
          {view==="warroom" && !isRH && !isNSHDashboard && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
              </div>

              {/* ── PIPELINE GAP STRIP ── */}
              {(()=>{
                const wrAllD = visibleDeals.filter(d=>qMatch(d.quarter));
                const wrT  = wrAllD.reduce((s,d)=>s+(d.targetAmount||0),0);
                const wrC  = revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const wrP  = wrAllD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const wrGap = Math.max(0, wrT - wrC - wrP);
                const wrPct  = wrT>0?Math.round((wrC/wrT)*100):0;
                const wrPPct = wrT>0?Math.round((wrP/wrT)*100):0;
                if(!wrT) return null;
                return (
                  <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                    {[
                      {label:"TARGET", val:fmtR(wrT), color:C.text},
                      {label:`ACHIEVED (${wrPct}%)`, val:fmtR(wrC), color:C.green},
                      {label:`PIPELINE (${wrPPct}%)`, val:fmtR(wrP), color:C.blue},
                      {label:"PIPELINE GAP", val:wrGap===0?"✓ On track":fmtR(wrGap), color:wrGap===0?C.green:C.red},
                    ].map(m=>(
                      <div key={m.label} style={{flex:"1 1 120px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{m.label}</div>
                        <div className="sans" style={{fontSize:16,fontWeight:800,color:m.color}}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── SUPPORT REQUESTS (system-wide open, visible to Strategy/CRO/Admin) ── */}
              {!isRep && (()=>{
                const openSRs = internalReqs.filter(r=>
                  r.type==="Support Request" &&
                  !["Done","Withdrawn","Rejected"].includes(r.status||"")
                );
                if (!openSRs.length) return null;
                return (
                  <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13}}>🆘</span>
                        <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {openSRs.length} open system-wide</span>
                      </div>
                      <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                    </div>
                    {openSRs.slice(0,5).map(sr=>{
                      const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                      const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                      return (
                        <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                            <div style={{fontSize:10,color:C.dim}}>{sr.raisedByName} · → {sr.dept}</div>
                          </div>
                          <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                          {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                        </div>
                      );
                    })}
                    {openSRs.length>5&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{openSRs.length-5} more</div>}
                  </div>
                );
              })()}

              {/* REP ACTION ITEMS — only for sales reps */}
              {isRep && (()=>{
                const myRepId = user_role?.repId;
                const myDeals = visibleDeals.filter(d=>d.repId===myRepId);
                const myOverdue = myDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                const myAtRisk  = myDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&(d.atRisk||daysSince(d.lastContact)>=7));
                const myBlocked = myDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");
                const myTasks_r = tasks.filter(t=>(t.assignedTo===myRepId||t.assignedToUserId===activeUser)&&t.status!=="Done");
                const total = myOverdue.length+myAtRisk.length+myTasks_r.length+myBlocked.length;
                if(!total) return <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:12,color:C.green}}>✓ No action items. You're on track.</div>;
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:16}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Action Items · {total} pending</div>
                    {myOverdue.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.orange,fontSize:12,flexShrink:0}}>⚠</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · Next step overdue: {d.nextStep}</span></div>
                        <span style={{fontSize:10,color:C.orange,whiteSpace:"nowrap"}}>was due {d.nextStepDate}</span>
                      </div>
                    ))}
                    {myAtRisk.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.red,fontSize:12,flexShrink:0}}>●</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · No contact in {daysSince(d.lastContact)} days</span></div>
                        <span style={{color:C.accent,fontWeight:700,fontSize:11}}>{fmtR(d.amount)}</span>
                      </div>
                    ))}
                    {myBlocked.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.orange,fontSize:12,flexShrink:0}}>⏳</span>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:600}}>{d.clientCompany}</span>
                          <span style={{color:C.dim,fontSize:11}}> · waiting on </span>
                          <span style={{color:C.orange,fontWeight:600,fontSize:11}}>{d.awaitingApproval}</span>
                          <span style={{color:C.muted,fontSize:10}}> ({daysSince(d.awaitingApprovalSince||TODAY)}d)</span>
                        </div>
                        <span style={{color:C.accent,fontWeight:700,fontSize:11}}>{fmtR(d.amount)}</span>
                      </div>
                    ))}
                    {myTasks_r.map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.blue,fontSize:12,flexShrink:0}}>📋</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{t.title}</span>{t.clientCompany&&<span style={{color:C.dim,fontSize:11}}> · {t.clientCompany}</span>}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:10,color:C.dim}}>Due {t.dueDate}</span>
                          <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* KPIs — rep: 4 calcNumbers cards + 2 count tiles; management: 5 cards */}
              {isRep ? (()=>{
                const wrRepId  = user_role?.repId;
                const wrTarget = targetSubs.filter(t=>t.repId===wrRepId&&t.status==="Approved").reduce((s,t)=>s+(t.totalTarget||t.clients?.reduce((ss,c)=>ss+(c.targetAmount||0),0)||0),0);
                const wrAch    = getAchieved(wrRepId);
                const wrCmt    = getCommitted(wrRepId);
                const wrInp    = getInPlay(wrRepId);
                const wrSf     = getShortfall(wrTarget,wrRepId);
                const wrPct    = wrTarget>0?Math.round((wrAch/wrTarget)*100):0;
                const wrOpenAI = tasks.filter(t=>(t.assignedTo===wrRepId||t.assignedToUserId===activeUser)&&t.status!=="Done").length;
                const wrAtRisk = visibleDeals.filter(d=>d.repId===wrRepId&&!["Mail Confirmed","Not Interested"].includes(dealStage(d))&&daysSince(d.lastContact||d.lastDealMeetingDate)>=7).length;
                return (<>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
                    {[
                      {label:"ACHIEVED",  value:fmtR(wrAch), color:C.green,  sub:`${wrPct}% of target`},
                      {label:"COMMITTED", value:fmtR(wrCmt), color:C.blue,   sub:"Mail Confirmed"},
                      {label:"IN PLAY",   value:fmtR(wrInp), color:C.accent, sub:"In Discussion / Negotiation"},
                      {label:"SHORTFALL", value:fmtR(wrSf),  color:wrSf===0?C.green:C.red, sub:wrSf===0?"On track":"Gap remaining"},
                    ].map(k=>(
                      <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                        <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                        {k.sub&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <div className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Open Action Items</div>
                        <div className="sans" style={{fontSize:26,fontWeight:800,color:wrOpenAI>0?C.orange:C.green}}>{wrOpenAI}</div>
                      </div>
                      <span style={{fontSize:28,opacity:.25}}>📋</span>
                    </div>
                    <div className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>At-Risk Clients</div>
                        <div className="sans" style={{fontSize:26,fontWeight:800,color:wrAtRisk>0?C.red:C.green}}>{wrAtRisk}</div>
                      </div>
                      <span style={{fontSize:28,opacity:.25}}>⚠</span>
                    </div>
                  </div>
                </>);
              })() : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"CLOSED QTD",    value:fmtR(closedRevenue),   sub:`${totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0}% of target`, color:C.green,  bar:totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0},
                  {label:"FORECAST",      value:fmtR(forecast),         sub:`${fcastPct}% likely`,    color:fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red, bar:fcastPct},
                  {label:"GAP TO TARGET", value:fmtR(gap),             sub:gap===0?"on track":"uncovered", color:gap===0?C.green:C.red},
                  {label:"AT RISK",       value:atRisk.length,          sub:`${fmtR(atRisk.reduce((s,a)=>s+(a.annualTarget||0),0))} at stake`, color:atRisk.length>0?C.red:C.green},
                  {label:"OVERDUE",       value:overdueNext.length,     sub:"next steps past due",    color:overdueNext.length>0?C.orange:C.green},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                    <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    {k.sub&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>}
                    {k.bar!=null&&<div className="pbar" style={{marginTop:7}}><div className="pfill" style={{width:`${Math.min(k.bar,100)}%`,background:k.color}} /></div>}
                  </div>
                ))}
              </div>)}

              {/* MANAGEMENT SECTIONS — hidden from reps */}
              {!isRep && (
                <div>
                  {/* At risk */}
                  {atRisk.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>NO CONTACT 7+ DAYS</div>
                      {atRisk.map(a=>{const rep=reps.find(r=>r.id===a.repId);return(
                        <div key={a.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:5,padding:"9px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{a.clientName}</span><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span><span className="pill" style={{background:`${oColor(a.currentStage)}22`,color:oColor(a.currentStage),marginLeft:8,fontSize:10}}>{a.currentStage}</span></div>
                          <span style={{color:C.red,fontSize:11,whiteSpace:"nowrap"}}>{daysSince(a.lastDealMeetingDate||a.lastContactDate)}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(a.annualTarget)}</span>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* Overdue next steps */}
                  {overdueNext.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>OVERDUE NEXT STEPS</div>
                      {overdueNext.map(d=>{const rep=reps.find(r=>r.id===d.repId);return(
                        <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}22`,borderRadius:5,padding:"9px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · {rep?.name} · {d.nextStep}</span></div>
                          <span style={{color:C.orange,fontSize:11,whiteSpace:"nowrap"}}>was due {d.nextStepDate}</span>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* High probability + compliance — two columns */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div className="card" style={{padding:14}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>HIGH PROBABILITY — PUSH TO CLOSE</div>
                      {visibleDeals.filter(d=>["Very Interested","Mail Confirmed"].includes(d.outcome)).sort((a,b)=>b.amount-a.amount).slice(0,4).map(d=>{
                        const rep=reps.find(r=>r.id===d.repId);
                        return(
                          <div key={d.id} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.s2}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <span className="sans" style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</span>
                              <span style={{color:C.green,fontWeight:700,fontSize:12}}>{fmtR(d.amount)}</span>
                            </div>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:10,color:C.dim}}>{rep?.name}</span>
                              <span style={{padding:"2px 8px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{d.outcome}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="card" style={{padding:14}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>COMPLIANCE — TODAY · 11:30 PM</div>
                      {reps.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(r=>{
                        const tL=meetings.some(m=>m.repId===r.id&&m.date===TODAY&&m.status==="logged");
                        const tP=meetings.some(m=>m.repId===r.id&&m.date===TOMORROW&&m.status==="planned");
                        const ok=tL&&tP;
                        return(
                          <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontSize:13,color:ok?C.green:C.red,fontWeight:700,width:16}}>{ok?"✓":"✗"}</span>
                            <span className="sans" style={{flex:1,fontSize:12,fontWeight:600}}>{r.name}</span>
                            <span style={{fontSize:10,color:tL?C.green:C.red}}>Log</span>
                            <span style={{fontSize:10,color:tP?C.green:C.orange}}>Plan</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

    </>
  );
}
