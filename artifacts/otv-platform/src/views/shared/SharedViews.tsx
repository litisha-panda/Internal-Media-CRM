import * as attendSvc from "../../services/api/attendance";
import React, { useState, useRef } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES, APPROVAL_SLA_DAYS, APPROVAL_TARGETS, TARGET_APPROVAL_CHAIN,
  MEETING_STATUS, MEETING_TYPES, CLIENT_OR_AGENCY, TASK_PRIORITIES, TASK_STATUSES,
  SLA, REQ_STATUS, DEPARTMENTS, PLAN_STATUS, PLAN_DEADLINE, HR_EMAIL,
  ALL_CHANNELS, D1, D3, D7, D14, THIS_WEEK_START, IP_CATALOG, PITCH_TYPES,
  getToday, getTomorrow,
} from "../../constants";
import ZohoSearchInput from "../../components/ZohoSearchInput";

export function LeaderboardView({ view, setView, lbTab, setLbTab }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ LEADERBOARD ═══ */}
          {(view==="leaderboard"||view==="lb-team"||view==="lb-region"||view==="lb-all") && (()=>{
            const medals = ["🥇","🥈","🥉"];
            const myRegion = user_role?.region;
            // For Sales Rep, tab is driven by sidebar view; for others, by lbTab state
            const effectiveLbTab = view==="lb-team"?"team":view==="lb-region"?"region":view==="lb-all"?"all":lbTab;
            const showTabBar = view==="leaderboard"; // only non-rep roles use the internal tab switcher

            // ── Always rank ALL reps for the leaderboard (activity + target% only, no revenue amounts) ──
            const lbAllReps = reps.map(rep => {
              const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const closed  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rm      = meetings.filter(m=>m.repId===rep.id);
              const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
              const risk    = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
              const attOk   = att[TODAY]?.[rep.id];
              const cPct    = rep.target>0?Math.round((closed/rep.target)*100):0;
              return {...rep, closed, meetings:rm.length, seniorM, risk, attOk, cPct};
            }).sort((a,b)=>b.cPct-a.cPct);

            // Filter sets per tab
            const teamReps   = lbAllReps.filter((r:any) => myRegion ? r.region===myRegion : true);
            const allReps    = lbAllReps as any[];

            // Region rollup for Region tab
            const regionMap: Record<string, any> = {};
            lbAllReps.forEach((r:any) => {
              if (!regionMap[r.region]) regionMap[r.region] = {region:r.region, reps:0, meetings:0, seniorM:0, risk:0, attOk:0, cPct:0};
              const g = regionMap[r.region];
              g.reps++;
              g.meetings  += r.meetings;
              g.seniorM   += r.seniorM;
              g.risk      += r.risk;
              g.attOk     += r.attOk ? 1 : 0;
              g.cPct      += r.cPct;
            });
            const regionRows = Object.values(regionMap).map(g => ({
              ...g,
              avgMeetings: g.reps ? Math.round(g.meetings/g.reps) : 0,
              senPct:      g.meetings ? Math.round((g.seniorM/g.meetings)*100) : 0,
              attPct:      g.reps ? Math.round((g.attOk/g.reps)*100) : 0,
              avgCPct:     g.reps ? Math.round(g.cPct/g.reps) : 0,
            })).sort((a,b) => b.avgCPct - a.avgCPct);

            const myRepId = isRep ? user_role?.repId : null;
            const RepCard = ({rep, rank}) => {
              const sc     = rep.cPct>=80?C.green:rep.cPct>=50?C.accent:C.red;
              const isMe   = rep.id === myRepId;
              return (
                <div className="card" style={{padding:"14px 16px",marginBottom:8,border:isMe?`1px solid ${C.accent}66`:undefined,background:isMe?`${C.accent}05`:undefined}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:rank<3?`${[C.accent,C.blue,C.green][rank]}33`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?17:12,fontWeight:800,color:rank<3?[C.accent,C.blue,C.green][rank]:C.dim,flexShrink:0}}>
                      {rank<3?medals[rank]:`#${rank+1}`}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span className="sans" style={{fontWeight:700,fontSize:14}}>{rep.name}</span>
                        {isMe&&<span style={{background:`${C.accent}22`,color:C.accent,fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:8}}>YOU</span>}
                        <span style={{fontSize:11,color:C.dim}}>{rep.region}</span>
                      </div>
                      <div style={{fontSize:10,color:C.dim,marginTop:2}}>{rep.role}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:sc}}>{rep.cPct}%</div>
                      <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>TARGET CLOSED</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginTop:10}}>
                    {[
                      {label:"MEETINGS",      value:rep.meetings, color:C.blue},
                      {label:"TARGET CLOSED", value:`${rep.cPct}%`, color:sc},
                    ].map(s=>(
                      <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"7px 10px"}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:2}}>{s.label}</div>
                        <div className="sans" style={{fontSize:14,fontWeight:700,color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:8,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(rep.cPct,100)}%`,background:sc,borderRadius:2}}/>
                  </div>
                </div>
              );
            };

            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>LEADERBOARD</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Activity, compliance and target performance — no revenue figures shown</div>

                {/* Tab switcher — only for non-rep roles that use internal tab state */}
                {showTabBar && (
                  <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
                    {[
                      {id:"team",   label:"My Team",          sub:myRegion||"All"},
                      {id:"region", label:"By Region",        sub:"Aggregated"},
                      {id:"all",    label:"All Sales Reps",   sub:"Company-wide"},
                    ].map(t=>(
                      <button key={t.id} onClick={()=>setLbTab(t.id)}
                        style={{padding:"10px 20px",background:"transparent",border:"none",
                          borderBottom:effectiveLbTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                          color:effectiveLbTab===t.id?C.accent:C.dim,cursor:"pointer",
                          fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:effectiveLbTab===t.id?700:400,textAlign:"left"}}>
                        <div>{t.label}</div>
                        <div style={{fontSize:9,color:C.muted,marginTop:1}}>{t.sub}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── MY TEAM TAB ── */}
                {effectiveLbTab==="team" && (
                  <div>
                    {teamReps.length===0 && <div style={{textAlign:"center",padding:40,color:C.muted}}>No reps in your team.</div>}
                    {teamReps.map((rep,rank)=><RepCard key={rep.id} rep={rep} rank={rank}/>)}
                  </div>
                )}

                {/* ── BY REGION TAB ── */}
                {effectiveLbTab==="region" && (
                  <div>
                    {regionRows.map((g,rank)=>{
                      const sc = g.avgCPct>=80?C.green:g.avgCPct>=50?C.accent:C.red;
                      return (
                        <div key={g.region} className="card" style={{padding:"14px 18px",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                            <div style={{width:32,height:32,borderRadius:"50%",background:rank<3?`${[C.accent,C.blue,C.green][rank]}33`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?17:12,fontWeight:800,color:rank<3?[C.accent,C.blue,C.green][rank]:C.dim,flexShrink:0}}>
                              {rank<3?medals[rank]:`#${rank+1}`}
                            </div>
                            <div style={{flex:1}}>
                              <div className="sans" style={{fontWeight:700,fontSize:15}}>{g.region}</div>
                              <div style={{fontSize:11,color:C.dim}}>{g.reps} rep{g.reps!==1?"s":""}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div className="sans" style={{fontSize:22,fontWeight:800,color:sc}}>{g.avgCPct}%</div>
                              <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>AVG TARGET CLOSED</div>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                            {[
                              {label:"TOTAL MEETINGS", value:g.meetings,    color:C.blue},
                              {label:"AVG MTG/REP",    value:g.avgMeetings, color:C.blue},
                            ].map(s=>(
                              <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:2}}>{s.label}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:s.color}}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{marginTop:8,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.min(g.avgCPct,100)}%`,background:sc,borderRadius:2}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── ALL SALES REPS TAB ── */}
                {effectiveLbTab==="all" && (
                  <div>
                    {allReps.length===0 && <div style={{textAlign:"center",padding:40,color:C.muted}}>No rep data.</div>}
                    {allReps.map((rep,rank)=><RepCard key={rep.id} rep={rep} rank={rank}/>)}
                  </div>
                )}
              </div>
            );
          })()}

    </>
  );
}

export function InternalRequestsView({ view, setView, irFormOpen, setIrFormOpen, irForm, setIrForm, editIrId, setEditIrId, irStatusFilter, setIrStatusFilter }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
  const BLANK_IR_FORM = {type:"Send Proposal",dept:"NSH",subject:"",details:"",clientCompany:""};
  return (
    <>
          {/* ═══ INTERNAL REQUESTS ═══ */}
          {view==="internal-requests" && (() => {
            const IR_DEPTS = ["NSH","Sales Strategy","Branding Team","Content Team","Digital","Finance","Legal","CXO"];
            // Which dept "inbox" does the current user own?
            const myInboxDept = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":isDigiOps?"Digital":null;
            // Requests ADDRESSED TO the current user's department
            const inboxReqs = myInboxDept ? internalReqs.filter(r=>r.dept===myInboxDept) : [];
            const myReqs  = isRep
              ? internalReqs.filter(r=>r.raisedBy===activeUser)
              : isRH
                ? internalReqs.filter(r=>r.raisedBy===activeUser || (r.dept==="Region Head" && USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion))
                : isDigiOps
                  ? internalReqs.filter(r=>r.dept==="Digital")
                  : internalReqs;
            const filtered = irStatusFilter==="all" ? myReqs : myReqs.filter(r=>r.status===irStatusFilter);
            const pending  = myReqs.filter(r=>r.status==="Pending"||r.status==="Overdue");
            const inprog   = myReqs.filter(r=>r.status==="In Progress");
            const done     = myReqs.filter(r=>r.status==="Done");

            const statusColor = s => s==="Done"?C.green:s==="In Progress"?C.blue:s==="Overdue"?C.red:s==="Withdrawn"?C.muted:C.orange;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>INTERNAL REQUESTS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Approvals · Escalations · Support requests</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>{setIrFormOpen(p=>!p);setIrForm(BLANK_IR_FORM);}}>
                    {irFormOpen?"✕ Cancel":"+ New Request"}
                  </button>
                </div>

                {/* ── Inline New Request Form ── */}
                {irFormOpen&&(
                  <div style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"16px 18px",marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:12,letterSpacing:".06em"}}>NEW INTERNAL REQUEST</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Request type *</div>
                        <select value={irForm.type} onChange={e=>setIrForm(f=>({...f,type:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          {["Send Proposal","Send FCT Grid","Send Revised Rate Card","Send Sponsorship Deck","Get Budget Approval","Arrange Senior Meeting","Get Rate Approval","Follow Up with Client","Share Digital Plan","Content / Script Needed","Legal / Contract Review","Get PO / Release","Other"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Who do you need it from? *</div>
                        <select value={irForm.dept} onChange={e=>setIrForm(f=>({...f,dept:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          {["Region Head","NSH","CXO","Sales Strategy","Digital","Branding Team","Content Team","Finance","Legal","HR"].map(d=><option key={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Subject / What do you need? *</div>
                      <input value={irForm.subject} onChange={e=>setIrForm(f=>({...f,subject:e.target.value}))}
                        placeholder="e.g. Discount approval — 10% off rate card for Havells"
                        style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Client / Account (optional)</div>
                        <select value={irForm.clientCompany} onChange={e=>setIrForm(f=>({...f,clientCompany:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:irForm.clientCompany?C.text:C.dim,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}>
                          <option value="">— Select client —</option>
                          {[...new Set(deals.filter(d=>user_role?.repId?d.repId===user_role.repId:true).map(d=>d.clientCompany))].sort().map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Details / Context</div>
                      <textarea value={irForm.details} onChange={e=>setIrForm(f=>({...f,details:e.target.value}))}
                        rows={3} placeholder="Provide context — client budget, ask, deadline, any relevant background…"
                        style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",resize:"vertical",boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setIrFormOpen(false);setIrForm(BLANK_IR_FORM);}}
                        style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                      <button onClick={()=>{
                        if(!irForm.subject.trim()){showToast("Subject is required","err");return;}
                        const irId = `ir${Date.now()}`;
                        const newReq={id:irId,type:irForm.type,dept:irForm.dept,subject:irForm.subject.trim(),details:irForm.details.trim(),raisedBy:activeUser,raisedByName:user_role?.name||"",repId:user_role?.repId||null,dealId:null,clientCompany:irForm.clientCompany.trim(),status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};
                        setInternalReqs(p=>[newReq,...p]);
                        // Auto-create a Task assigned to the "dept" person
                        const assigneeId = deptToUserId(irForm.dept);
                        const assigneeName = USER_ROLES.find(u=>u.id===assigneeId)?.name || irForm.dept;
                        const newTask = {
                          id:`t${Date.now()+1}`,
                          title:`[IR] ${irForm.subject.trim()}`,
                          assignedToUserId: assigneeId,
                          assignedTo: null,
                          assignedBy: activeUser,
                          assignedByName: user_role?.name || "",
                          assignedDept: irForm.dept,
                          clientCompany: irForm.clientCompany.trim(),
                          description: "Requested by " + (user_role?.name||"Sales Rep") + (irForm.clientCompany ? " for " + irForm.clientCompany.trim() : "") + ": " + (irForm.details.trim()||irForm.subject.trim()),
                          priority: "High",
                          status: "Open",
                          dueDate: TOMORROW,
                          createdAt: TODAY,
                          repId: user_role?.repId||null,
                          irId,
                        };
                        setTasks(p=>[...p, newTask]);
                        setIrFormOpen(false);setIrForm(BLANK_IR_FORM);
                        showToast(`Request raised → ${assigneeName} · Task created ✓`);
                      }} style={{background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        Submit Request →
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary pills */}
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  {[
                    {label:"Pending / Overdue", count:pending.length, color:C.red},
                    {label:"Accepted",           count:myReqs.filter(r=>r.status==="Accepted").length, color:C.green},
                    {label:"In Progress",        count:inprog.length,  color:C.blue},
                    {label:"Done",               count:done.length,    color:C.green},
                    {label:"Rejected",           count:myReqs.filter(r=>r.status==="Rejected").length, color:C.red},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"10px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{s.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:s.color,marginTop:2}}>{s.count}</div>
                    </div>
                  ))}
                </div>

                {/* Status filter */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {["all","Pending","Accepted","In Progress","Done","Rejected","Withdrawn"].map(s=>(
                    <button key={s} onClick={()=>setIrStatusFilter(s)}
                      style={{padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:irStatusFilter===s?700:400,
                        background:irStatusFilter===s?C.accent:`${C.accent}12`,
                        color:irStatusFilter===s?"#fff":C.dim,border:"none"}}>
                      {s==="all"?"All":s}
                    </button>
                  ))}
                </div>

                {/* ── 📥 Inbox: Requests addressed TO this user's dept ── */}
                {myInboxDept && (
                  <div style={{marginBottom:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div className="sans" style={{fontSize:13,fontWeight:700,color:C.accent,letterSpacing:".04em"}}>📥 REQUESTS TO YOU</div>
                      <span style={{background:`${C.accent}22`,color:C.accent,borderRadius:10,padding:"1px 10px",fontSize:10,fontWeight:700}}>{inboxReqs.filter(r=>r.status!=="Done").length} open</span>
                      <div style={{fontSize:10,color:C.dim}}>directed to {myInboxDept}</div>
                    </div>
                    {inboxReqs.length===0 && (
                      <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:8,padding:"22px",textAlign:"center",color:C.muted,fontSize:12}}>No requests directed to you yet.</div>
                    )}
                    {inboxReqs.map(req=>{
                      const daysOld = daysSince(req.raisedAt);
                      const overdue = daysOld >= (req.slaHours/24) && req.status!=="Done";
                      const sc = statusColor(overdue?"Overdue":req.status);
                      const deal = deals.find(d=>d.id===req.dealId);
                      return (
                        <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:8,borderLeft:`3px solid ${sc}`,background:`${C.accent}04`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                              <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                              <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:600}}>{req.type}</span>
                              <span style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10}}>from {req.raisedByName||req.raisedBy}</span>
                            </div>
                            <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}{overdue?" — SLA breached":""}</span>
                          </div>
                          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                          {req.clientCompany&&<div style={{fontSize:11,color:C.dim,marginBottom:4}}>Re: {req.clientCompany}{deal?` · ${fmtR(deal.amount)}`:""}</div>}
                          {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:6,lineHeight:1.5}}>{req.details}</div>}
                          {req.priority&&req.priority!=="Medium"&&<div style={{fontSize:10,fontWeight:700,color:req.priority==="Urgent"?C.red:req.priority==="High"?C.orange:C.green,marginBottom:6}}>Priority: {req.priority}{req.dueDate?` · Needed by ${req.dueDate}`:""}</div>}
                          {req.notes&&<div style={{fontSize:11,color:C.blue,background:`${C.blue}08`,padding:"5px 9px",borderRadius:5,marginBottom:6}}>💬 {req.notes}</div>}
                          {req.resolverNote&&<div style={{fontSize:11,color:C.green,background:`${C.green}08`,padding:"6px 10px",borderRadius:5,marginBottom:8}}>✓ {req.resolverNote}</div>}
                          {req.status!=="Done" && req.status!=="Rejected" && (
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                              {req.status==="Pending"&&(
                                <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Accepted",acceptedAt:TODAY}:r))}
                                  style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Accept</button>
                              )}
                              {req.status!=="In Progress"&&req.status!=="Accepted"&&(
                                <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r))}
                                  style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>In Progress</button>
                              )}
                              <button onClick={()=>openNoteModal("Add Note / Update","Noted",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,notes:note}:r)))}
                                style={{background:`${C.accent}12`,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>+ Note</button>
                              <button onClick={()=>openNoteModal("Resolution Note","Resolved",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)))}
                                style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Mark Done</button>
                              <button onClick={()=>openNoteModal("Reason for rejection","Rejected",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Rejected",resolvedAt:TODAY,resolverNote:note}:r)))}
                                style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✗ Reject</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{borderBottom:`1px solid ${C.border}`,marginBottom:20,marginTop:8}}/>
                    <div className="sans" style={{fontSize:12,fontWeight:700,color:C.dim,letterSpacing:".04em",marginBottom:12}}>ALL REQUESTS (SYSTEM-WIDE)</div>
                  </div>
                )}

                {/* Request cards */}
                {filtered.length===0 && <div style={{textAlign:"center",padding:50,color:C.muted}}>{irStatusFilter==="all"?"No requests yet. Hit + New Request to raise one.":"No requests with this status."}</div>}
                {filtered.map(req=>{
                  const daysOld = daysSince(req.raisedAt);
                  const overdue = daysOld >= (req.slaHours/24) && req.status!=="Done";
                  const sc = statusColor(overdue?"Overdue":req.status);
                  const deal = deals.find(d=>d.id===req.dealId);
                  return (
                    <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${sc}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                          <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:600}}>{req.type}</span>
                          <span style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10}}>→ {req.dept}</span>
                        </div>
                        <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}{overdue?" — SLA breached":""}</span>
                      </div>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                      {req.clientCompany&&<div style={{fontSize:11,color:C.dim,marginBottom:4}}>Re: {req.clientCompany}{deal?` · ${fmtR(deal.amount)}`:""}</div>}
                      {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:8,lineHeight:1.5}}>{req.details}</div>}
                      {req.resolverNote&&<div style={{fontSize:11,color:C.green,background:`${C.green}08`,padding:"6px 10px",borderRadius:5,marginBottom:8}}>✓ {req.resolverNote}</div>}
                      <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                        {isNSHDashboard && req.status!=="Done" && (
                          <>
                            <button onClick={()=>{setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r));}} style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Mark In Progress</button>
                            <button onClick={()=>{openNoteModal("Resolution Note", "Resolved", note => setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)));}} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Resolve</button>
                          </>
                        )}
                        {/* Escalate: visible to rep/RH for any active non-escalation request */}
                        {(isRep||isRH) && req.status!=="Done" && req.status!=="Withdrawn" && req.type!=="Escalation" && (
                          <button onClick={()=>{
                            const escalatedDept = req.dept==="NSH"?"CXO":req.dept==="Sales Strategy"?"NSH":req.dept==="Region Head"?"NSH":req.dept==="CXO"?"CXO":"Region Head";
                            const escalated = {
                              id:`ir${Date.now()}`,
                              type:"Escalation",
                              dept: escalatedDept,
                              subject:`ESCALATION: ${req.subject}`,
                              details:`Original request to ${req.dept} has breached SLA (${daysOld}d). Escalating for urgent action.\n\nOriginal: ${req.details||""}`,
                              raisedBy:activeUser, raisedByName:user_role?.name||"",
                              repId:user_role?.repId||req.repId||null,
                              dealId:req.dealId||null, clientCompany:req.clientCompany||"",
                              status:"Pending", raisedAt:TODAY, slaHours:24, resolvedAt:null, resolverNote:"",
                            };
                            setInternalReqs(p=>[escalated,...p.map(r=>r.id===req.id?{...r,status:"Withdrawn"}:r)]);
                            showToast(`Escalated to ${escalated.dept} ✓`);
                          }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                            ↑ Escalate
                          </button>
                        )}
                        {(isRep||isRH) && req.status==="Pending" && (
                          <button onClick={()=>{setEditIrId(req.id);setIrForm({type:req.type||"Send Proposal",dept:req.dept||"NSH",subject:req.subject||"",details:req.details||"",clientCompany:req.clientCompany||""});}} style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✎ Edit</button>
                        )}
                        {(isRep||isRH) && req.status!=="Done" && req.status!=="Withdrawn" && (
                          <button onClick={()=>{setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Withdrawn"}:r));showToast("Request withdrawn");}} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Withdraw</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Global client-name datalist — used by all clientCompany inputs */}
          <datalist id="cm-list">
            {clientMasterList.map((n,i)=><option key={i} value={n}/>)}
          </datalist>

    </>
  );
}

export function TeamView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ TEAM ═══ — Region Head sees their region team only */}
          {view==="team" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = reps.filter(r => r.region === rhRegion);
            const rhDeals  = visibleDeals;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM — {rhRegion}</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Revenue, pipeline, contact quality and compliance — your reps only</div>

                {myReps.map((rep,rank)=>{
                  const rd   = rhDeals.filter(d=>d.repId===rep.id);
                  const rC   = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP   = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct = rT>0?Math.round((rC/rT)*100):0;
                  const rRisk= rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver= rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed").length;
                  const rTasks = tasks.filter(t=>t.repId===rep.id&&t.status!=="Done").length;
                  const rBlocked= rd.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed").length;
                  const sc  = rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const tL  = meetings.some(m=>m.repId===rep.id&&m.date===TODAY);
                  const tP  = (weeklyPlans||[]).some(p=>p.repId===rep.id&&p.date===TOMORROW);
                  const rankColor = rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rep.id} className="card" style={{padding:16,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        {/* Rank badge */}
                        <div style={{width:28,height:28,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:15,fontWeight:700}}>{rep.name}</span>
                            <span style={{fontSize:10,color:C.dim}}>{rep.region}</span>
                            {/* Compliance pills */}
                            <span style={{background:tL?`${C.green}22`:`${C.red}22`,color:tL?C.green:C.red,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{tL?"✓ Logged":"✗ Not logged"}</span>
                            <span style={{background:tP?`${C.green}22`:`${C.orange}22`,color:tP?C.green:C.orange,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{tP?"✓ Planned":"✗ Tmrw not planned"}</span>
                          </div>
                          {/* Revenue grid */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["DEALS",rd.length,C.blue]].map(([l,v,c]: [any,any,any])=>(
                              <div key={l} style={{background:C.s2,borderRadius:5,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".06em",marginBottom:2}}>{l}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {/* Alert badges */}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rRisk} at risk</span>}
                            {rOver>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rOver} overdue next steps</span>}
                            {rTasks>0&&<span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rTasks} open tasks</span>}
                            {rBlocked>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rBlocked} awaiting approval</span>}
                            {rRisk===0&&rOver===0&&rBlocked===0&&<span style={{background:`${C.green}18`,color:C.green,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>✓ On track</span>}
                          </div>
                        </div>
                        {/* Big % */}
                        <div style={{textAlign:"right",minWidth:56}}>
                          <div className="sans" style={{fontSize:32,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div>
                          <div style={{fontSize:9,color:C.dim}}>achieved</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ TEAM ═══ — Management view (non-RH) */}
          {view==="team" && !isRH && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM SCORECARD</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Revenue, pipeline coverage, contact quality, and compliance — per rep</div>
              {repScores.map((rep,rank)=>{
                const statColor=rep.cPct>=80?C.green:rep.cPct>=50?C.accent:C.red;
                return (
                  <div key={rep.id} className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:rank===0?`${C.accent}33`:rank===1?`${C.blue}22`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rank===0?C.accent:rank===1?C.blue:C.dim,flexShrink:0}}>#{rank+1}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                          <div><span className="sans" style={{fontWeight:700,fontSize:14}}>{rep.name}</span><span style={{color:C.dim,fontSize:12,marginLeft:8}}>{rep.role} · {rep.region}</span></div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {!rep.attOk&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>NEG ATT TODAY</span>}
                            {rep.risk>0&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>{rep.risk} at risk</span>}
                            <span className="pill" style={{background:`${statColor}22`,color:statColor}}>{rep.cPct}% closed</span>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:10}}>
                          {[
                            {label:"CLOSED",      value:fmtR(rep.closed),  color:rep.closed>0?C.green:C.muted},
                            {label:"PIPELINE",    value:fmtR(rep.pipe),    color:C.accent},
                            {label:"TARGET",      value:fmtR(rep.target),  color:C.dim},
                            {label:"MEETINGS",    value:rep.meetings,       color:C.blue},
                            {label:"SENIOR MTG %",value:`${rep.senPct}%`,  color:rep.senPct>=70?C.green:rep.senPct>=40?C.accent:C.red},
                          ].map(s=>(
                            <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:3}}>{s.label}</div>
                              <div className="sans" style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="pbar"><div className="pfill" style={{width:`${Math.min(rep.cPct,100)}%`,background:statColor}} /></div>
                        <div style={{display:"flex",gap:12,marginTop:5}}>
                          <span style={{fontSize:10,color:statColor}}>● Closed {rep.cPct}%</span>
                          <span style={{fontSize:10,color:C.accent}}>● Coverage {rep.coverage}%</span>
                          {rep.senPct<50&&<span style={{fontSize:10,color:C.red}}>⚠ {rep.senPct}% senior meetings — coaching needed</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

    </>
  );
}

export function ActivityView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ ACTIVITY ═══ */}
          {view==="activity" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ACTIVITY LOG</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Every client interaction. Log before 12pm. {meetings.length} meetings recorded.</div>
                </div>
                {canLogMeeting && <button className="btn btn-primary" onClick={()=>setLogOpen(true)}>+ Log Touchpoint</button>}
              </div>

              {/* KPI cards — filtered to own meetings for reps */}
              {(()=>{
                const myRepId = user_role?.repId;
                const visM = isRep
                  ? meetings.filter(m=>m.repId===myRepId)
                  : meetings;
                return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"TODAY'S MEETINGS",  value:visM.filter(m=>m.date===TODAY).length,                 color:C.blue},
                  {label:"ON TIME",            value:visM.filter(m=>m.date===TODAY&&!m.late).length,        color:C.green},
                  {label:"LOGGED LATE",        value:visM.filter(m=>m.date===TODAY&&m.late).length,         color:C.orange},
                  {label:"SENIOR REQUESTS",    value:visM.filter(m=>m.seniorRequested==="Yes").length,      color:C.accent},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em"}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color,marginTop:3}}>{k.value}</div>
                  </div>
                ))}
              </div>
                );
              })()}

              {/* SENIOR ESCALATION REQUESTS — Darpan's requirement */}
              {meetings.filter(m=>m.seniorRequested==="Yes").length>0 && (
                <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                  <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Senior Meeting Requests — Pending Follow-Through</div>
                  {meetings.filter(m=>m.seniorRequested==="Yes").map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:C.s2,borderRadius:5,padding:"9px 12px",marginBottom:6,flexWrap:"wrap"}}>
                      <div style={{flex:1}}>
                        <span className="sans" style={{fontWeight:700}}>{m.repName}</span>
                        <span style={{color:C.dim,fontSize:12}}> asked for </span>
                        <span style={{color:C.blue,fontWeight:600}}>{m.seniorRequestedName||m.seniorRequestedRole}</span>
                        <span style={{color:C.dim,fontSize:12}}> ({m.seniorRequestedRole}) for next round with </span>
                        <span style={{fontWeight:600}}>{m.clientCompany}</span>
                      </div>
                      <div style={{fontSize:11,color:C.dim}}>Meeting on {m.date}</div>
                      <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>PENDING</span>
                    </div>
                  ))}
                </div>
              )}

              {/* NEXT DAY PLAN — Sachin's requirement */}
              {meetings.filter(m=>m.scheduleNext&&m.nextMeetingDate).length>0 && (
                <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                  <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Next Day Plan — Scheduled Meetings</div>
                  {meetings.filter(m=>m.scheduleNext&&m.nextMeetingDate).sort((a,b)=>a.nextMeetingDate>b.nextMeetingDate?1:-1).map(m=>(
                    <div key={m.id} style={{background:C.s2,borderRadius:5,padding:"10px 14px",marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <span className="sans" style={{fontWeight:700}}>{m.repName}</span>
                          <span style={{color:C.dim,fontSize:12}}> → </span>
                          <span style={{fontWeight:600}}>{m.clientCompany}</span>
                          {m.contactName&&<span style={{color:C.dim,fontSize:12}}> · {m.contactName}</span>}
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:11,color:C.green}}>📅 {m.nextMeetingDate}{m.nextMeetingTime?` @ ${m.nextMeetingTime}`:""}</span>
                          {m.calendarStatus&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>{m.calendarPlatform==="google"?"GCal ✓":"ZCal ✓"}</span>}
                          {m.meetLink&&(
                            <a href={m.meetLink} target="_blank" rel="noreferrer"
                              style={{display:"inline-flex",alignItems:"center",gap:4,background:"#4285F422",color:"#4285F4",padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none",border:"1px solid #4285F444"}}>
                              🎥 Meet
                            </a>
                          )}
                        </div>
                      </div>
                      {m.nextAgenda&&<div style={{fontSize:11,color:C.dim,marginTop:5}}>Agenda: {m.nextAgenda}</div>}
                      {m.discussion&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>Last discussion: {m.discussion.slice(0,100)}{m.discussion.length>100?"...":""}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* FOLLOW-UP & NEXT MEETING REMINDERS */}
              {(()=>{
                const fuPlans = (weeklyPlans||[]).filter(p =>
                  (p.autoCreatedFrom === "follow-up" || p.autoCreatedFrom === "next-meeting") &&
                  p.status !== "Done" && p.status !== "Cancelled" &&
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? reps.find(r=>r.id===p.repId)?.region===user_role.region : p.repId===user_role.repId)
                ).sort((a,b)=>a.date>b.date?1:-1).slice(0,10);
                if (!fuPlans.length) return null;
                return (
                  <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>📞 Follow-ups & Next Meetings ({fuPlans.length})</div>
                    {fuPlans.map(p=>{
                      const rep = reps.find(r=>r.id===p.repId);
                      const isOverdue = p.date < TODAY;
                      const isToday   = p.date === TODAY;
                      return (
                        <div key={p.id} style={{background:C.s2,borderRadius:5,padding:"10px 14px",marginBottom:6,borderLeft:`3px solid ${isOverdue?C.red:isToday?C.orange:C.blue}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <span style={{background:p.autoCreatedFrom==="next-meeting"?`${C.green}22`:`${C.blue}22`,color:p.autoCreatedFrom==="next-meeting"?C.green:C.blue,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,whiteSpace:"nowrap"}}>{p.autoCreatedFrom==="next-meeting"?"📅 Next Mtg":"📞 Follow-up"}</span>
                              {rep&&<span className="sans" style={{fontWeight:700}}>{rep.name}</span>}
                              {rep&&<span style={{color:C.dim,fontSize:12}}> → </span>}
                              <span style={{fontWeight:600}}>{p.clientAgencyName}</span>
                              {p.contactName&&<span style={{color:C.dim,fontSize:12}}> · {p.contactName}</span>}
                            </div>
                            <span style={{fontSize:11,color:isOverdue?C.red:isToday?C.orange:C.blue,fontWeight:600}}>
                              {isOverdue?"⚠ Overdue · ":isToday?"Today · ":""}{p.date}
                            </span>
                          </div>
                          {p.agenda&&<div style={{fontSize:11,color:C.dim,marginTop:4}}>{p.agenda}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ACTION ITEM DUE DATE ALERTS */}
              {(()=>{
                const visReps = (user_role.canView==="all" ? reps : user_role.canView==="region" ? reps.filter(r=>r.region===user_role.region) : reps.filter(r=>r.id===user_role.repId)).map(r=>r.id);
                const dueTasks = tasks.filter(t => visReps.includes(t.repId) && t.status!=="Done" && t.dueDate);
                const stepDuePlansWR = (weeklyPlans||[]).filter(p => visReps.includes(p.repId) && p.autoCreatedFrom==="next-step" && p.status!=="Done");
                const all = [
                  ...dueTasks.filter(t=>t.dueDate<TODAY).map(t=>({...t, _urgency:"overdue"})),
                  ...stepDuePlansWR.filter(p=>p.date<TODAY).map(p=>({...p, title:p.agenda, _urgency:"overdue"})),
                  ...dueTasks.filter(t=>t.dueDate===TODAY).map(t=>({...t, _urgency:"today"})),
                  ...stepDuePlansWR.filter(p=>p.date===TODAY).map(p=>({...p, title:p.agenda, _urgency:"today"})),
                  ...dueTasks.filter(t=>t.dueDate===TOMORROW).map(t=>({...t, _urgency:"tomorrow"})),
                  ...stepDuePlansWR.filter(p=>p.date===TOMORROW).map(p=>({...p, title:p.agenda, _urgency:"tomorrow"})),
                ];
                if (!all.length) return null;
                return (
                  <div style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>⏰ Action Item Due Dates ({all.length})</div>
                    {all.slice(0,12).map((item:any,i)=>{
                      const clr = item._urgency==="overdue"?C.red:item._urgency==="today"?C.orange:C.blue;
                      const rep = reps.find(r=>r.id===(item.repId||item.assignedTo));
                      return (
                        <div key={item.id||i} style={{background:C.s2,borderRadius:5,padding:"8px 12px",marginBottom:4,borderLeft:`3px solid ${clr}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{item.title||"—"}</div>
                            <div style={{fontSize:10,color:C.dim}}>
                              {rep&&<span>{rep.name} · </span>}
                              {(item.clientCompany||item.clientAgencyName)&&<span>{item.clientCompany||item.clientAgencyName}</span>}
                              {(item.assignedDept||item.neededFrom)&&<span> → {item.assignedDept||item.neededFrom}</span>}
                            </div>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,color:clr,whiteSpace:"nowrap"}}>
                            {item._urgency==="overdue"?"⚠ OVERDUE":item._urgency==="today"?"Due TODAY":"Due TOMORROW"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* MEETING LOG — day by day */}
              {meetings.length === 0 && (
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:10}}>📝</div>
                  <div className="sans" style={{fontWeight:700,marginBottom:5}}>No meetings logged yet</div>
                  <div style={{color:C.dim,fontSize:12,marginBottom:16}}>Click "+ Log Touchpoint" above to record today's client touchpoints</div>
                </div>
              )}

              {[TODAY,D1,D3,D7].map(date=>{
                const dm = meetings.filter(m => m.date===date &&
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? reps.find(r=>r.id===m.repId)?.region===user_role.region : m.repId===user_role.repId)
                );
                if (!dm.length) return null;
                const label = date===TODAY?"TODAY":date===D1?"YESTERDAY":date===D3?"3 DAYS AGO":"LAST WEEK";
                return (
                  <div key={date} style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                      <span>{label} — {date}</span>
                      <span style={{color:C.muted}}>{dm.length} meeting{dm.length!==1?"s":""}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {dm.map(m=>(
                        <div key={m.id} style={{background:C.surface,border:`1px solid ${m.late?C.orange:C.border}`,borderRadius:8,padding:"12px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
                            {/* Left — who */}
                            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                              <div style={{width:32,height:32,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.accent,flexShrink:0}}>
                                {(m.repName||"?")[0]}
                              </div>
                              <div>
                                <div className="sans" style={{fontWeight:700,fontSize:13}}>{m.repName}</div>
                                <div style={{fontSize:11,color:C.dim}}>{m.region} · {m.meetingTime||"Time not set"}</div>
                              </div>
                            </div>
                            {/* Right — meta */}
                            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                              {m.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{m.pitchType}</span>}
                              {m.meetingType&&<span style={{background:(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?`${C.green}18`:(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"#4285F418":`${C.blue}18`,color:(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?C.green:(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"#4285F4":C.blue,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?"🤝":(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"💻":"📞"} {m.meetingType}</span>}
                              {m.clientOrAgency&&<span style={{background:C.s3,color:C.dim,padding:"2px 7px",borderRadius:8,fontSize:10}}>{m.clientOrAgency}</span>}
                              <span style={{fontSize:11,color:m.late?C.orange:C.green,fontWeight:600}}>{m.loggedAt} {m.late?"⚠ late":"✓"}</span>
                            </div>
                          </div>

                          {/* Client + contact */}
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
                            <span className="sans" style={{fontWeight:700,fontSize:14}}>{m.clientCompany}</span>
                            {m.contactName&&<span style={{color:C.dim,fontSize:12}}>· {m.contactName}{m.designation?`, ${m.designation}`:""}</span>}
                            {m.status&&<span style={{background:`${oColor(m.outcome)}18`,color:oColor(m.outcome),padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600,marginLeft:"auto"}}>{m.status}</span>}
                          </div>

                          {/* Discussion + feedback — GK: free text */}
                          {m.discussion&&<div style={{fontSize:12,color:C.text,marginBottom:4,lineHeight:1.6}}>{m.discussion}</div>}
                          {m.clientFeedback&&<div style={{fontSize:11,color:C.dim,background:C.s2,padding:"6px 10px",borderRadius:5,marginBottom:6}}>Client feedback: {m.clientFeedback}</div>}

                          {/* Next steps + follow-up */}
                          {(m.nextSteps||m.followUpDate)&&(
                            <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:6}}>
                              {m.nextSteps&&<div style={{fontSize:11,color:C.accent}}>→ {m.nextSteps}</div>}
                              {m.followUpDate&&<div style={{fontSize:11,color:C.blue}}>📅 Follow-up: {m.followUpDate}</div>}
                            </div>
                          )}

                          {/* Senior escalation */}
                          {m.seniorRequested==="Yes"&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:7,background:`${C.blue}10`,padding:"5px 10px",borderRadius:5}}>
                              <span style={{color:C.blue,fontSize:12}}>⬆</span>
                              <span style={{fontSize:11,color:C.blue}}>Senior requested: <strong>{m.seniorRequestedName||m.seniorRequestedRole}</strong> ({m.seniorRequestedRole}) for next round</span>
                            </div>
                          )}

                          {/* Next meeting scheduled */}
                          {m.scheduleNext&&m.nextMeetingDate&&(
                            <div style={{marginTop:8,background:`${C.green}10`,border:`1px solid ${C.green}22`,borderRadius:5,padding:"8px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,color:C.green,fontWeight:600}}>📅 Next: {m.nextMeetingDate}{m.nextMeetingTime?` @ ${m.nextMeetingTime}`:""}</span>
                                {m.calendarStatus&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>{m.calendarPlatform==="google"?"Google Calendar":"Zoho Calendar"} ✓</span>}
                                {m.meetLink&&(
                                  <a href={m.meetLink} target="_blank" rel="noreferrer"
                                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"#4285F422",color:"#4285F4",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none",border:"1px solid #4285F444"}}>
                                    🎥 Join Google Meet
                                  </a>
                                )}
                              </div>
                              {m.nextAgenda&&<div style={{fontSize:11,color:C.dim,marginTop:4}}>Agenda: {m.nextAgenda}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

    </>
  );
}

export function EscalationsView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
  const canApprove = (deal: any) => { const wa = deal.awaitingApproval; if (!wa) return false; if (isAdmin) return true; if (wa==="NSH" && isNSH) return true; if (wa==="CXO" && (isAdmin||user_role?.role==="CXO"||user_role?.role==="CRO")) return true; if (wa==="RH" && isRH && deal.region===rhRegion) return true; if (wa==="Sales Strategy" && isStrategy) return true; if (wa==="Digital" && isDigiOps) return true; return false; };
  return (
    <>
          {/* ═══ ESCALATIONS ═══ */}
          {view==="escalations" && (
            <div className="fin">
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>Approvals overdue · Internal requests stuck · Tasks you're tagged in</div>
              </div>

              {(() => {
                const myRepId = user_role?.repId;

                // 1. Approval overdue (awaitingApproval set + past SLA)
                const approvalEsc = visibleDeals.filter(d =>
                  d.awaitingApproval &&
                  d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  d.outcome !== "Mail Confirmed" &&
                  d.outcome !== "Not Interested" &&
                  (user_role.canView!=="self" || d.repId===myRepId)
                );

                // 2. Internal department requests overdue (legacy deal reqs)
                const reqEsc = deals.flatMap((d,_) =>
                  (d.reqs||[])
                    .map((r,i) => ({...r, dealId:d.id, reqIdx:i, clientCompany:d.clientCompany, repId:d.repId, amount:d.amount}))
                    .filter(r => r.status==="Overdue" && (user_role.canView!=="self" || d.repId===myRepId))
                );

                // 2b. SLA-breached Internal Requests (internalReqs pending 48h+)
                const irSLABreached = internalReqs.filter(ir =>
                  ir.status === "Pending" &&
                  daysSince(ir.raisedAt) >= APPROVAL_SLA_DAYS &&
                  (user_role.canView!=="self" ? true : ir.repId===myRepId || ir.raisedBy===activeUser)
                );

                // 3. Tasks overdue and tagged to this user's deals or assigned to them
                const taskEsc = tasks.filter(t =>
                  t.status !== "Done" &&
                  (t.dueDate < TODAY || t.status === "Overdue") &&
                  (user_role.canView!=="self" ? true : t.assignedTo===myRepId||t.assignedToUserId===activeUser)
                );

                const total = approvalEsc.length + reqEsc.length + taskEsc.length;

                return (
                  <div>
                    {/* Summary strip */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                      {[
                        {label:"APPROVALS OVERDUE",  value:approvalEsc.length,   color:C.red,    desc:`Pending >${APPROVAL_SLA_DAYS}d without response`},
                        {label:"REQUESTS BREACHED",   value:irSLABreached.length, color:C.orange, desc:"Internal requests past 48h SLA"},
                        {label:"TASKS OVERDUE",       value:taskEsc.length,       color:C.blue,   desc:"Tasks past due date"},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                          <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color,marginBottom:2}}>{k.value}</div>
                          <div style={{fontSize:10,color:C.muted}}>{k.desc}</div>
                        </div>
                      ))}
                    </div>

                    {total===0 && (
                      <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:8}}>✓</div>
                        <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>No escalations</div>
                        <div style={{fontSize:11,color:C.dim}}>All approvals, requests and tasks are on track.</div>
                      </div>
                    )}

                    {/* SECTION 1: Approvals overdue */}
                    {approvalEsc.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          ⏳ Approvals Pending Over {APPROVAL_SLA_DAYS} Days
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Client","Rep","Amount","Waiting For","Days Waiting","Stage","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {approvalEsc.map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const dw=daysSince(d.awaitingApprovalSince);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.red}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.red}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.red}04`}>
                                    <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                    <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 9px",borderRadius:5,fontSize:11,fontWeight:700}}>{d.awaitingApproval}</span></td>
                                    <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{dw}d overdue</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                    <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                      <button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()}
                                        style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginRight:4}}>
                                        Resolved
                                      </button>
                                      <button onClick={()=>setView("pipeline")}
                                        style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                        View Deal
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: Internal requests stuck */}
                    {reqEsc.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          🔧 Internal Requests Overdue
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Client","Department","Request","SLA","Status","Update"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {reqEsc.map((r,i)=>{
                                const sla = SLA[r.dept]||24;
                                return (
                                  <tr key={i} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.orange}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.orange}04`}>
                                    <td style={{padding:"10px 14px"}}><div style={{fontWeight:600}}>{r.clientCompany}</div></td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}22`,color:C.blue,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.dept}</span></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:200,whiteSpace:"normal"}}>{r.desc}</td>
                                    <td style={{padding:"10px 14px",color:C.accent,fontSize:11}}>{sla}h SLA</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>OVERDUE</span></td>
                                    <td style={{padding:"10px 14px"}}>
                                      <select value={r.status} onChange={e=>updateReq(r.dealId,r.reqIdx,e.target.value)}
                                        style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                        {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2b: SLA-breached Internal Requests */}
                    {irSLABreached.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          ⚠ Internal Requests — SLA Breached (48h+)
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["From","Type","Subject","Client","Raised","Days","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {irSLABreached.map(r=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}06`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{r.raisedByName}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.type}</span></td>
                                  <td style={{padding:"10px 14px",maxWidth:200,fontSize:12}}>{r.subject}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{r.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{r.raisedAt}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(r.raisedAt)}d</td>
                                  <td style={{padding:"10px 14px",whiteSpace:"nowrap",display:"flex",gap:4}}>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"In Progress"}:x))} style={{background:`${C.blue}18`,color:C.blue,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Accept</button>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY}:x))} style={{background:`${C.green}18`,color:C.green,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Done</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: Overdue tasks */}
                    {taskEsc.length>0&&(
                      <div>
                        <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          📋 Tasks Overdue
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Task","Assigned To","Client","Priority","Due","Days Overdue","Update"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {taskEsc.map(t=>{
                                const rep=reps.find(r=>r.id===t.assignedTo);
                                const daysOver=daysSince(t.dueDate);
                                return (
                                  <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.blue}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.blue}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.blue}04`}>
                                    <td style={{padding:"10px 14px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                    <td style={{padding:"10px 14px",color:C.red,fontWeight:700,fontSize:11}}>{daysOver}d</td>
                                    <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                      <select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))}
                                        style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                        {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

    </>
  );
}

export function ComplianceView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ COMPLIANCE ═══ */}
          {view==="compliance" && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>COMPLIANCE</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>12pm hard deadline. Missed = negative attendance. Non-regularisable.</div>
              {[TODAY,D1].map(date=>{
                const a=att[date]||{};
                const label=date===TODAY?"TODAY":"YESTERDAY";
                return (
                  <div key={date} style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8}}>{label} — {date}</div>
                    <div className="card" style={{overflow:"hidden"}}>
                      <table>
                        <thead><tr><th>Rep</th><th>Region</th><th>Role</th><th>Logged</th><th>Meetings</th><th>Status</th></tr></thead>
                        <tbody>
                          {reps.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(rep=>{
                            const logged=a[rep.id];
                            const rm=meetings.filter(m=>m.repId===rep.id&&m.date===date);
                            const hasLate=rm.some(m=>m.late);
                            return (
                              <tr key={rep.id}>
                                <td className="sans" style={{fontWeight:700}}>{rep.name}</td>
                                <td style={{color:C.dim}}>{rep.region}</td>
                                <td style={{color:C.dim,fontSize:11}}>{rep.role}</td>
                                <td style={{color:logged?C.green:C.red,fontSize:16,fontWeight:700}}>{logged?"✓":"✗"}</td>
                                <td>{rm.length}</td>
                                <td>
                                  {!logged&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>NEG ATTENDANCE</span>}
                                  {logged&&hasLate&&<span className="pill" style={{background:`${C.orange}22`,color:C.orange}}>LOGGED LATE</span>}
                                  {logged&&!hasLate&&<span className="pill" style={{background:`${C.green}22`,color:C.green}}>ON TIME</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

    </>
  );
}

export function HRView({ view, setView, exceptionModal, setExceptionModal, exceptionReason, setExceptionReason, excReqOpen, setExcReqOpen, excReqRecord, setExcReqRecord, excReqForm, setExcReqForm, excReqSubmitting, setExcReqSubmitting }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ HR REPORTS ═══ */}
          {view==="hr" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>HR ABSENCE REPORTS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Auto-generated 23:30 · Sent to <span style={{color:C.accent}}>{HR_EMAIL}</span></div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {attDbLoading&&<span style={{fontSize:11,color:C.muted}}>Loading…</span>}
                  <button className="btn" style={{fontSize:11,padding:"5px 10px"}} onClick={fetchAttendanceData}>↻ Refresh</button>
                  {canGrantException&&<button className="btn btn-primary" onClick={()=>{
                    runEODCheck();
                    attendSvc.simulateEod().then(()=>fetchAttendanceData()).catch(()=>{});
                  }}>▶ Simulate EOD Run</button>}
                </div>
              </div>

              {/* Rules — compact strip */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {[
                  {label:"Deadline",  val:"11:30 PM daily"},
                  {label:"Trigger",   val:"No log + no plan = absent"},
                  {label:"Override",  val:"Admin / CXO only"},
                  {label:"Audit",     val:"Every exception logged"},
                ].map(r=>(
                  <div key={r.label} style={{background:`${C.red}08`,border:`1px solid ${C.red}22`,borderRadius:5,padding:"6px 12px",display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:10,color:C.red,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{r.label}:</span>
                    <span style={{fontSize:11,color:C.text}}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* ── PERSONAL: Own attendance records — DB is sole source of truth ── */}
              {!isAdmin && (()=>{
                const myUserId   = user?.id || "";
                const dbRecs     = attDbRecords.filter(r=>r.userId===myUserId);
                const TODAY_DATE = TODAY;
                const YESTERDAY  = new Date(Date.now()-86400000).toISOString().slice(0,10);
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
                      {[
                        {label:"MY ABSENCES", value:dbRecs.filter(r=>r.status==="absent").length,  color:C.red},
                        {label:"EXCEPTIONS",  value:attExcRequests.filter(r=>r.userId===myUserId&&r.status==="granted").length, color:C.green},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:4,textTransform:"uppercase"}}>{k.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                    {attDbLoading ? (
                      <div style={{textAlign:"center",padding:32,color:C.muted,fontSize:12}}>Loading attendance records…</div>
                    ) : dbRecs.length===0 ? (
                      <div style={{textAlign:"center",padding:40,color:C.muted,border:`1px dashed ${C.border}`,borderRadius:8,fontSize:12}}>
                        No compliance records yet. Records are written by the compliance engine at 11:30 PM IST each day.
                        <br/><span style={{fontSize:11,color:C.dim,marginTop:4,display:"block"}}>Ask your Region Head or Admin to run the EOD simulation.</span>
                      </div>
                    ) : (
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",padding:"8px 14px",background:C.s2,borderBottom:`1px solid ${C.border}`}}>MY ATTENDANCE LOG (compliance engine)</div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Date","Touchpoint","Plan","Status","Exception","Action"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{dbRecs.map(r=>{
                            const stColor = r.status==="absent"?C.red:r.status==="partial"?C.orange:r.status==="exception_granted"?C.purple:C.green;
                            const stLabel = r.status==="absent"?"Absent":r.status==="partial"?"Partial":r.status==="exception_granted"?"Exc. Granted":"Present";
                            const exc = attExcRequests.find(e=>e.userId===myUserId&&e.date===r.date);
                            const canRequest = (r.status==="absent"||r.status==="partial") && !exc && (r.date===TODAY_DATE||r.date===YESTERDAY);
                            return (
                              <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                <td style={{padding:"9px 14px"}}><span style={{color:r.touchpointLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.touchpointLogged==="yes"?"✓":"✗"}</span></td>
                                <td style={{padding:"9px 14px"}}><span style={{color:r.planLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.planLogged==="yes"?"✓":"✗"}</span></td>
                                <td style={{padding:"9px 14px"}}><span style={{background:`${stColor}22`,color:stColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{stLabel}</span></td>
                                <td style={{padding:"9px 14px"}}>
                                  {exc ? (
                                    <div>
                                      <span style={{background:exc.status==="granted"?`${C.green}22`:exc.status==="rejected"?`${C.red}22`:`${C.orange}22`,color:exc.status==="granted"?C.green:exc.status==="rejected"?C.red:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>
                                        {exc.status==="granted"?"Granted":exc.status==="rejected"?"Rejected":`Pending (${exc.currentStage})`}
                                      </span>
                                      {exc.grantedBy&&<div style={{fontSize:10,color:C.dim,marginTop:2}}>by {exc.grantedBy}</div>}
                                    </div>
                                  ) : <span style={{color:C.muted,fontSize:11}}>—</span>}
                                </td>
                                <td style={{padding:"9px 14px"}}>
                                  {canRequest&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.blue}18`,color:C.blue,border:`1px solid ${C.blue}44`}} onClick={()=>{setExcReqRecord(r);setExcReqForm({reason:"",notes:""});setExcReqOpen(true);}}>Request Exception</button>}
                                  {exc&&exc.status==="pending"&&<span style={{fontSize:10,color:C.muted}}>Awaiting {exc.currentStage}</span>}
                                </td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── ADMIN absence log table (full org view) ── */}
              {isAdmin && (()=>{
                const useDb = attDbRecords.length > 0;
                const dbReports = attDbRecords;
                const blobReports = absenceReports;
                return (
                  <div>
                    {/* DB Records Table */}
                    {useDb && (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>Attendance Records — DB (Compliance Engine)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Rep","Region","Date","Touchpoint","Plan","Status","Exception","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>{dbReports.map(r=>{
                              const stColor = r.status==="absent"?C.red:r.status==="partial"?C.orange:r.status==="exception_granted"?C.purple:C.green;
                              const stLabel = r.status==="absent"?"Absent":r.status==="partial"?"Partial":r.status==="exception_granted"?"Exc. Granted":"Present";
                              const exc = attExcRequests.find(e=>e.userId===r.userId&&e.date===r.date);
                              const excGranted = exc?.status==="granted";
                              return (
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}><div style={{fontWeight:600}}>{r.userName||r.userId}</div></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region||"—"}</span></td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                  <td style={{padding:"9px 14px"}}><span style={{color:r.touchpointLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.touchpointLogged==="yes"?"✓":"✗"}</span></td>
                                  <td style={{padding:"9px 14px"}}><span style={{color:r.planLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.planLogged==="yes"?"✓":"✗"}</span></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${stColor}22`,color:stColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{stLabel}</span></td>
                                  <td style={{padding:"9px 14px"}}>
                                    {exc ? (
                                      <span style={{background:excGranted?`${C.green}22`:exc.status==="rejected"?`${C.red}22`:`${C.orange}22`,color:excGranted?C.green:exc.status==="rejected"?C.red:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>
                                        {excGranted?"Granted":exc.status==="rejected"?"Rejected":`Pending: ${exc.currentStage}`}
                                      </span>
                                    ) : <span style={{color:C.muted,fontSize:11}}>—</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                                    {(r.status==="absent"||r.status==="partial")&&!excGranted&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`}} onClick={()=>{
                                      const reason=prompt("Grant exception reason:");
                                      if(!reason?.trim()) return;
                                      attendSvc.grantException(r.id, reason)
                                        .then(()=>fetchAttendanceData()).catch(()=>{});
                                    }}>Grant Exception</button>}
                                    {exc&&exc.status==="pending"&&<span style={{fontSize:10,color:C.muted,marginLeft:4}}>Chain: {exc.currentStage}</span>}
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {/* Legacy blob table */}
                    {blobReports.length>0 && (
                      <div>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>Legacy Absence Reports (Blob)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Rep","Region","Date","Generated","Status","Exception","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {blobReports.map(r=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}><div style={{fontWeight:600}}>{r.repName}</div></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region}</span></td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.generatedAt}</td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                                  <td style={{padding:"9px 14px"}}>
                                    {r.exception?<div><span style={{background:`${C.green}22`,color:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>by {r.exceptionBy}</span></div>:<span style={{color:C.muted,fontSize:11}}>—</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                                    {r.markedAs==="Absent"&&!r.exception&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`}} onClick={()=>{setExceptionModal({reportId:r.id,repName:r.repName});setExceptionReason("");}}>Grant Exception</button>}
                                    {r.exception==="Overridden"&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,marginLeft:4}} onClick={()=>revokeException(r.id)}>Revoke</button>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {!useDb&&!blobReports.length&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No absence records. Run Simulate EOD or wait for the 23:30 compliance engine.</div>}
                  </div>
                );
              })()}
            </div>
          )}

    </>
  );
}

export function TasksView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ TASKS ═══ */}
          {view==="tasks" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TASKS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Assign tasks to reps · reps see these in War Room</div>
                </div>
                {/* Reps can create tasks for themselves; managers assign to others */}
                <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>
                  {isRep ? "+ Create Task" : "+ Assign Task"}
                </button>
              </div>

              {(()=>{
                const repId_s = user_role?.repId;
                const myTaskSet = isRep
                  ? tasks.filter(t=>t.assignedTo===repId_s||t.assignedToUserId===activeUser)
                  : tasks;
                return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"OPEN",       value:myTaskSet.filter(t=>t.status==="Open").length,                             color:C.blue},
                  {label:"IN PROGRESS",value:myTaskSet.filter(t=>t.status==="In Progress").length,                      color:C.accent},
                  {label:"OVERDUE",    value:myTaskSet.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,             color:C.red},
                  {label:"DONE",       value:myTaskSet.filter(t=>t.status==="Done").length,                              color:C.green},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                  </div>
                ))}
              </div>
                );
              })()}

              {(() => {
                const myRepId=user_role?.repId;
                const vis=isRep?tasks.filter(t=>t.assignedTo===myRepId||t.assignedToUserId===activeUser):tasks;
                if(!vis.length) return <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>{isRep?"No tasks assigned to you yet.":"No tasks yet. Assign one above."}</div>;
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>
                        {(!isRep?["Assigned To"]:[]). concat(["Task","Client","Priority","Status","Due","Action"]).map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {vis.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(task=>{
                          const assignee=task.assignedToUserId?USER_ROLES.find(u=>u.id===task.assignedToUserId):reps.find(r=>r.id===task.assignedTo);
                          const rep=assignee||(task.assignedTo?reps.find(r=>r.id===task.assignedTo):null);
                          const overdue=task.dueDate<TODAY&&task.status!=="Done";
                          const sc=task.status==="Done"?C.green:overdue?C.red:task.status==="In Progress"?C.blue:C.accent;
                          return (
                            <tr key={task.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}}
                              onMouseOver={e=>e.currentTarget.style.background=overdue?`${C.red}08`:C.s2}
                              onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                              {!isRep&&<td style={{padding:"10px 14px"}}><div style={{fontWeight:600,fontSize:12}}>{rep?.name||task.assignedToName||"—"}</div><div style={{fontSize:10,color:C.dim}}>{rep?.region||(assignee&&(assignee as any).role!=="SALES REP"?(assignee as any).role:null)}</div>{task.assignedDept&&<span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,marginTop:2,display:"inline-block"}}>dept: {task.assignedDept}</span>}</td>}
                              <td style={{padding:"10px 14px"}}><div style={{fontWeight:600,fontSize:12}}>{task.title}</div>{task.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:220,whiteSpace:"normal",lineHeight:1.4}}>{task.description}</div>}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{task.clientCompany||"—"}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:task.priority==="High"?`${C.red}18`:task.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:task.priority==="High"?C.red:task.priority==="Medium"?C.orange:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{task.priority}</span></td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":task.status}</span></td>
                              <td style={{padding:"10px 14px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{task.dueDate}</td>
                              <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                {(()=>{
                                  const canEdit = isAdmin || task.assignedToUserId===activeUser || task.assignedTo===user_role?.repId || task.assignedBy===activeUser;
                                  return task.status!=="Done" && canEdit ? (
                                    <select value={task.status} onChange={e=>setTasks(p=>p.map(t=>t.id===task.id?{...t,status:e.target.value}:t))}
                                      style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,marginRight:6}}>
                                      {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                    </select>
                                  ) : task.status!=="Done" ? (
                                    <span style={{color:C.muted,fontSize:10}}>—</span>
                                  ) : null;
                                })()}
                                {isAdmin&&<button onClick={()=>setTasks(p=>p.filter(t=>t.id!==task.id))} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 5px"}}>✕</button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

    </>
  );
}

function roFmtMoney(n: any) { return n?"Rs."+Number(n).toLocaleString("en-IN"):"---"; }

export function ROManagementView({ view, setView, roMgmtChannel, setRoMgmtChannel, roMgmtStatus, setRoMgmtStatus, roMgmtViewRO, setRoMgmtViewRO, roMgmtConfirmDelete, setRoMgmtConfirmDelete, ROCard, roExportSingle }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
  const [roSearch, setRoSearch] = React.useState("");
  return (
    <>
          {/* ═══ RO MANAGEMENT (CROApp) ═══ */}
          {view==="ro-management" && (
            <div>
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RO MANAGEMENT</div>
                <div style={{fontSize:11,color:C.dim}}>All parsed and exported Release Orders. Search, filter, re-export or delete.</div>
              </div>

              {/* Stats strip */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"TOTAL ROs",    value:savedROs.length,                                                color:C.blue},
                  {label:"TOTAL VALUE",  value:roFmtMoney(savedROs.reduce((s,r)=>s+(r.total_payable||0),0)),  color:C.green},
                  {label:"EXPORTED",     value:savedROs.filter(r=>r.exportedAt).length,                       color:C.accent},
                  {label:"CHANNELS",     value:[...new Set(savedROs.map(r=>r.channel).filter(Boolean))].length,color:C.dim},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div className="sans" style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <input placeholder="Search client, agency, RO number..."
                  value={roSearch} onChange={e=>setRoSearch(e.target.value)}
                  style={{flex:1,minWidth:200,background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none"}} />
                <select value={roMgmtChannel} onChange={e=>setRoMgmtChannel(e.target.value)}
                  style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                  <option value="all">All Channels</option>
                  {[...new Set(savedROs.map(r=>r.channel).filter(Boolean))].map(ch=><option key={ch}>{ch}</option>)}
                </select>
              </div>

              {savedROs.length===0?(
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:40,textAlign:"center",color:C.muted}}>
                  <div style={{fontSize:28,marginBottom:8}}>📋</div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>No saved ROs yet</div>
                  <div style={{fontSize:11}}>Parse and export an RO from the RO Parser tab to see it here.</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {savedROs
                    .filter(r=>{
                      const q=roSearch.toLowerCase();
                      const channelOk=roMgmtChannel==="all"||r.channel===roMgmtChannel;
                      const searchOk=!q||(r.client_name||"").toLowerCase().includes(q)||(r.agency_name||"").toLowerCase().includes(q)||(r.ro_number||"").toLowerCase().includes(q);
                      return channelOk&&searchOk;
                    })
                    .map(r=>(
                      <div key={r.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                              <span className="sans" style={{fontSize:14,fontWeight:700}}>{r.client_name}</span>
                              {r.brand_name&&<span style={{color:C.dim,fontSize:12}}>· {r.brand_name}</span>}
                              {r.channel&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{r.channel}</span>}
                              {r.ro_number&&<span style={{color:C.muted,fontSize:11}}>#{r.ro_number}</span>}
                            </div>
                            <div style={{fontSize:11,color:C.dim,display:"flex",gap:16,flexWrap:"wrap"}}>
                              {r.agency_name&&<span>{r.agency_name}</span>}
                              {r.ro_date&&<span>{r.ro_date}</span>}
                              {r.total_payable>0&&<span style={{color:C.green,fontWeight:600}}>{roFmtMoney(r.total_payable)}</span>}
                              <span style={{color:C.muted}}>Saved {new Date(r.savedAt).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button
                              onClick={()=>{if(roMgmtViewRO===r.id)setRoMgmtViewRO(null);else setRoMgmtViewRO(r.id);}}
                              style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              {roMgmtViewRO===r.id?"Hide":"View"}
                            </button>
                            <button
                              onClick={()=>r.result&&roExportSingle(r.result)}
                              style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              Export
                            </button>
                            <button
                              onClick={()=>setRoMgmtConfirmDelete(r.id)}
                              style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {roMgmtViewRO===r.id&&r.result&&(
                          <div style={{marginTop:12}}>
                            <ROCard result={r.result} onExport={()=>roExportSingle(r.result)} />
                          </div>
                        )}
                        {roMgmtConfirmDelete===r.id&&(
                          <div style={{marginTop:10,background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:12,color:C.red,flex:1}}>Delete this RO permanently?</span>
                            <button onClick={()=>{setSavedROs(p=>p.filter(x=>x.id!==r.id));setRoMgmtConfirmDelete(null);}} style={{background:`${C.red}22`,border:"none",color:C.red,borderRadius:4,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Yes, Delete</button>
                            <button onClick={()=>setRoMgmtConfirmDelete(null)} style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

    </>
  );
}

export function RHXScoreView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ RH LEADERBOARD — cross-region scorecard for Region Heads ═══ */}
          {view==="rh-xscore" && isRH && (()=>{
            const myRepId = user_role?.repId;
            const rhList = USER_ROLES.filter(u=>u.role==="REGION HEAD");
            const rhScores = rhList.map((rhu,rank)=>{
              const rd  = deals.filter(d=>d.region===rhu.region&&qMatch(d.quarter));
              const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rhScoreRepIds=new Set(rd.map(d=>d.repId));
              const rC  = revenueEntries.filter(e=>rhScoreRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const isMe = rhu.region===user_role?.region;
              return {...rhu, rT, rC, rPct, isMe};
            }).sort((a,b)=>b.rPct-a.rPct);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH LEADERBOARD</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>How your region stands vs other Region Heads · {filterQ}</div>
                </div>
                {rhScores.map((rhu,rank)=>{
                  const sc = rhu.rPct>=80?C.green:rhu.rPct>=50?C.accent:C.red;
                  const rankColor = rank===0?"#fbbf24":rank===1?"#94a3b8":rank===2?"#b45309":C.muted;
                  return (
                    <div key={rhu.id} style={{background:rhu.isMe?`${C.accent}08`:C.surface,border:`1px solid ${rhu.isMe?C.accent:C.border}`,borderLeft:`3px solid ${rhu.isMe?C.accent:sc}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:rankColor,flexShrink:0}}>
                        {rank===0?"🥇":rank===1?"🥈":rank===2?"🥉":`#${rank+1}`}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <span className="sans" style={{fontWeight:700,fontSize:14,color:rhu.isMe?C.accent:C.text}}>{rhu.region} Region</span>
                          {rhu.isMe&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOUR REGION</span>}
                        </div>
                        <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",maxWidth:260}}>
                          <div style={{height:"100%",width:`${Math.min(rhu.rPct,100)}%`,background:sc,borderRadius:3,transition:"width .6s"}} />
                        </div>
                      </div>
                      <div style={{textAlign:"right",minWidth:70}}>
                        <div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rhu.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:2}}>of target</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:12,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not displayed
                </div>
              </div>
            );
          })()}

    </>
  );
}

export function RepAllRepsView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ REP ALL-REPS SCORECARD ═══ */}
          {view==="rep-allreps" && isRep && (()=>{
            const myRepId  = user_role?.repId;
            const allReps: any[] = reps.map((rep:any)=>{
              const rd   = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rC   = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const isMe = rep.id===myRepId;
              return {...rep, rPct, isMe};
            }).sort((a,b)=>b.rPct-a.rPct);

            const myRank = allReps.findIndex(r=>r.isMe);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ALL SALES REPS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Where you stand across the entire sales team · {filterQ}</div>
                </div>

                {/* Your rank callout */}
                {myRank>=0&&(
                  <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:28,fontWeight:800,color:C.accent,lineHeight:1}}>#{myRank+1}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Your rank out of {allReps.length} sales reps</div>
                      <div style={{fontSize:11,color:C.dim,marginTop:2}}>{allReps[myRank]?.rPct}% achieved · {allReps[myRank]?.region} region</div>
                    </div>
                  </div>
                )}

                {allReps.map((rep,rank)=>{
                  const sc = rep.rPct>=80?C.green:rep.rPct>=50?C.accent:C.red;
                  const rankColor = rank===0?"#fbbf24":rank===1?"#94a3b8":rank===2?"#b45309":C.muted;
                  return (
                    <div key={rep.id} style={{background:rep.isMe?`${C.accent}08`:C.surface,border:`1px solid ${rep.isMe?C.accent:C.border}`,borderLeft:`3px solid ${rep.isMe?C.accent:sc}`,borderRadius:7,padding:"12px 16px",marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>
                        {rank===0?"🥇":rank===1?"🥈":rank===2?"🥉":`#${rank+1}`}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                          <span className="sans" style={{fontWeight:700,fontSize:13,color:rep.isMe?C.accent:C.text}}>{rep.name}</span>
                          <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{rep.region}</span>
                          {rep.isMe&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOU</span>}
                        </div>
                        <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",maxWidth:200}}>
                          <div style={{height:"100%",width:`${Math.min(rep.rPct,100)}%`,background:sc,borderRadius:2,transition:"width .6s"}} />
                        </div>
                      </div>
                      <div style={{textAlign:"right",minWidth:60}}>
                        <div className="sans" style={{fontSize:24,fontWeight:800,color:sc,lineHeight:1}}>{rep.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:1}}>of target</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:12,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not visible
                </div>
              </div>
            );
          })()}

    </>
  );
}

export function RepTeamView({ view, setView }: any) {
  const {
    user, deals, setDeals, meetings, setMeetings, tasks, setTasks, targetSubs, setTargetSubs, revenueEntries, setRevenueEntries, clientAccounts, setClientAccounts, touchpoints, internalReqs, setInternalReqs,
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
          {/* ═══ REP TEAM SCORECARD ═══ */}
          {view==="rep-team" && isRep && (()=>{
            const myRepId   = user_role?.repId;
            const myRegion  = user_role?.region;
            // Show all reps in same region, sorted by % achieved
            const teammates = reps.filter(r => r.region === myRegion)
              .map(rep => {
                const rd  = deals.filter(d => d.repId === rep.id && d.quarter === filterQ);
                const rT  = rd.reduce((s,d) => s + (d.targetAmount||0), 0);
                const rC  = rd.filter(d => d.outcome === "Mail Confirmed").reduce((s,d) => s + d.amount, 0);
                const rPct = rT > 0 ? Math.round((rC / rT) * 100) : 0;
                const isMe = rep.id === myRepId;
                return { ...rep, rPct, isMe };
              })
              .sort((a,b) => b.rPct - a.rPct);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM SCORECARD</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{myRegion} Region · {filterQ} · Achievement %</div>
                </div>

                {teammates.map((rep, rank) => {
                  const sc = rep.rPct >= 80 ? C.green : rep.rPct >= 50 ? C.accent : C.red;
                  const rankColor = rank === 0 ? "#fbbf24" : rank === 1 ? "#94a3b8" : rank === 2 ? "#b45309" : C.muted;
                  return (
                    <div key={rep.id} style={{
                      background: rep.isMe ? `${C.accent}08` : C.surface,
                      border: `1px solid ${rep.isMe ? C.accent : C.border}`,
                      borderLeft: `3px solid ${rep.isMe ? C.accent : sc}`,
                      borderRadius: 8,
                      padding: "14px 18px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}>
                      {/* Rank medal */}
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: `${rankColor}22`, border: `1px solid ${rankColor}55`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: rankColor, flexShrink: 0,
                      }}>
                        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank+1}`}
                      </div>

                      {/* Name */}
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span className="sans" style={{fontWeight:700,fontSize:14,color:rep.isMe?C.accent:C.text}}>
                            {rep.name}
                          </span>
                          {rep.isMe && (
                            <span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOU</span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div style={{marginTop:6,height:5,background:C.s3,borderRadius:3,overflow:"hidden",maxWidth:220}}>
                          <div style={{height:"100%",width:`${Math.min(rep.rPct,100)}%`,background:sc,borderRadius:3,transition:"width .6s"}} />
                        </div>
                      </div>

                      {/* % only — no revenue */}
                      <div style={{textAlign:"right",minWidth:64}}>
                        <div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rep.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:2}}>of target</div>
                      </div>
                    </div>
                  );
                })}

                <div style={{marginTop:14,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not visible here
                </div>
              </div>
            );
          })()}
    </>
  );
}
