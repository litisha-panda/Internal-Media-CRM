import React, { useState, useRef } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES, APPROVAL_SLA_DAYS, APPROVAL_TARGETS, TARGET_APPROVAL_CHAIN,
  MEETING_STATUS, MEETING_TYPES, CLIENT_OR_AGENCY, TASK_PRIORITIES, TASK_STATUSES,
  SLA, REQ_STATUS, DEPARTMENTS, PLAN_STATUS, PLAN_DEADLINE, HR_EMAIL,
  ALL_CHANNELS, D1, D3, D7, D14, THIS_WEEK_START, IP_CATALOG, PITCH_TYPES,
  getToday, getTomorrow,
} from "../../constants";

export function SetupWizardView({
  view, setView,
  wizardStep, setWizardStep,
  wizardClients, setWizardClients,
  wizardRegion, setWizardRegion,
  wizardRM, setWizardRM,
  newClients, setNewClients,
  addClientModalOpen, setAddClientModalOpen,
  addClientForm, setAddClientForm,
}) {
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
  const wizardPrefilled = useRef(false);
  return (
    <>
          {/* ═══ SETUP WIZARD ═══ */}
          {view==="setup-wizard" && isRep && (()=>{
            const myRepId   = user_role?.repId;
            const myRep     = reps.find(r=>r.id===myRepId);
            const mySubs    = targetSubs.filter(t=>t.repId===myRepId);
            const alreadySubmitted = mySubs.length > 0;

            const wStep    = wizardStep;
            const setWStep = setWizardStep;
            const wClients    = wizardClients;
            const setWClients = setWizardClients;
            const wRegion  = wizardRegion;
            const wRM      = wizardRM;

            const parseLakh = (v) => {
              const s = String(v||"").replace(/,/g,"").trim();
              if (!s) return 0;
              if (/^\d+(\.\d+)?[Ll]$/.test(s)) return Math.round(parseFloat(s)*100000);
              if (/^\d+(\.\d+)?[Cc][Rr]?$/.test(s)) return Math.round(parseFloat(s)*10000000);
              return Math.round(parseFloat(s)||0);
            };

            const totalTarget = wClients.reduce((s,c)=>s+parseLakh(c.q1)+parseLakh(c.q2)+parseLakh(c.q3)+parseLakh(c.q4),0);

            const doSubmit = () => {
              if (!wRegion) { showToast("Select your region before submitting","err"); setWStep(1); return; }
              if (!wRM.trim()) { showToast("Enter your Reporting Manager's name before submitting","err"); setWStep(1); return; }
              const repIdInt = myRepId;
              const repName  = myRep?.name || user?.name || "Sales Rep";
              const rhRegion = wRegion;
              const now      = new Date().toISOString();
              const newSubs  = QUARTERS.slice(0,4).map((q,qi)=>{
                const clients = wClients.map(c=>({
                  clientCompany: (c.client||c.agency||c.brand||"").trim(),
                  agency: c.agency.trim(),
                  brand: c.brand.trim(),
                  dealType:"Linear TV",
                  targetAmount: parseLakh(qi===0?c.q1:qi===1?c.q2:qi===2?c.q3:c.q4),
                })).filter(c=>c.clientCompany&&c.targetAmount>0);
                if (clients.length===0) return null;
                const total = clients.reduce((s,c)=>s+(c.targetAmount||0),0);
                const id = `ts_wizard_${Date.now()}_q${qi}_${Math.random().toString(36).slice(2,4)}`;
                return {id,repId:repIdInt,repName,region:rhRegion,quarter:q,clients,totalTarget:total,status:"Pending RH",submittedAt:now,submittedByRole:"SALES REP",approvedAt:null,approvedBy:null,frozenTarget:null,awaitingApprovalSince:now,auditLog:[{at:now,by:"SELF",role:"SALES REP",action:"Submitted (Setup Wizard)"}]};
              }).filter(Boolean);
              if (newSubs.length===0) { showToast("Add at least one client with a target amount","err"); return; }
              setTargetSubs(p=>[...newSubs,...p]);
              apiFetch("/api/targets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newSubs[0])}).catch(()=>{});
              showToast("Target submitted for approval ✓");
              setView("rep-dashboard");
            };

            const StepDot = ({n,label}) => (
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:wStep>=n?C.accent:`${C.dim}30`,color:wStep>=n?"#fff":C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,transition:"all .2s"}}>{wStep>n?"✓":n+1}</div>
                <span style={{fontSize:10,color:wStep>=n?C.text:C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:wStep===n?700:400}}>{label}</span>
              </div>
            );

            return (
              <div className="fin">
                <h2 style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",margin:"0 0 4px"}}>Welcome to OTV CRM</h2>
                <p style={{fontSize:12,color:C.dim,fontFamily:"'DM Sans',sans-serif",margin:"0 0 20px"}}>Let's get your account set up — it takes 2 minutes.</p>

                {/* Step tracker */}
                <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
                  {[["Welcome","0"],["Your Profile","1"],["Set Targets","2"],["Review","3"]].map(([lbl],i)=><StepDot key={i} n={i} label={lbl}/>)}
                </div>

                {/* ── Step 0: Welcome ── */}
                {wStep===0 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:32,marginBottom:12}}>👋</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>Hi{myRep?.name?", "+myRep.name.split(" ")[0]:""}!</div>
                    <div style={{fontSize:13,color:C.dim,fontFamily:"'DM Sans',sans-serif",marginBottom:16,lineHeight:1.6}}>
                      You're about to set up your sales workspace. Here's what you'll need:<br/>
                      • Your client list for this fiscal year<br/>
                      • Approximate quarterly targets per client<br/>
                      • 2 minutes of your time 😊
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                      {[["📅","My Plan","Plan & log daily client meetings"],["₹","Revenue Log","Record revenue when deals close"],["⬆","Requests","Raise approvals & support requests"],["⊡","Dashboard","Track your targets and performance"]].map(([icon,name,desc])=>(
                        <div key={name} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",background:C.s2,borderRadius:7}}>
                          <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
                          <div><div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{name}</div><div style={{fontSize:11,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>{desc}</div></div>
                        </div>
                      ))}
                    </div>
                    {alreadySubmitted && (
                      <div style={{padding:"8px 12px",background:`${C.green}10`,border:`1px solid ${C.green}33`,borderRadius:6,marginBottom:12,fontSize:11,color:C.green,fontFamily:"'DM Sans',sans-serif"}}>
                        ✓ You already have a target submission. You can skip to the dashboard.
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      {alreadySubmitted && <button onClick={()=>setView("rep-dashboard")} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Go to Dashboard</button>}
                      <button onClick={()=>setWStep(1)} style={{flex:2,padding:"10px 0",background:C.accent,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Let's get started →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 1: Profile ── */}
                {wStep===1 && (()=>{
                  const canAdvance = !!wRegion && !!wRM.trim();
                  // RH users for this region — drawn from USER_ROLES (no admin API needed)
                  const rhForRegion = USER_ROLES.filter(u=>u.role==="REGION HEAD"&&u.region===wRegion);
                  const doAdvance = () => {
                    if(!canAdvance) return;
                    const repIdNum = user_role?.repId;
                    if(!repIdNum){showToast("Cannot identify your rep record — contact Admin","err");return;}
                    // Persist region + reportingManager on the rep record; gate advancement on success
                    adminSvc.patchRepProfile(repIdNum, {region:wRegion,reportingManager:wRM})
                      .then(()=>{
                        // Sync local reps blob so myRep reflects new values immediately
                        setReps((p:any[])=>p.map((r:any)=>r.id===repIdNum||r.repId===repIdNum?{...r,region:wRegion,reportingManager:wRM}:r));
                        setWStep(2);
                      })
                      .catch((err:any)=>showToast(err?.body?.error||"Network error — please try again","err"));
                  };
                  return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Your Profile</div>
                    {/* Read-only: Name + Role */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                      {[["Name",myRep?.name||user?.name||"—"],["Role",user_role?.role||"SALES REP"]].map(([lbl,val])=>(
                        <div key={lbl} style={{padding:"10px 14px",background:C.s2,borderRadius:7}}>
                          <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase"}}>{lbl}</div>
                          <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginTop:3}}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Region selector — required */}
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>Region <span style={{color:C.red}}>*</span></div>
                      <select value={wRegion} onChange={e=>{setWizardRegion(e.target.value);setWizardRM("");}}
                        style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRegion?C.green:C.border}`,borderRadius:5,color:wRegion?C.text:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                        <option value="">Select your territory…</option>
                        {REGIONS.filter(r=>r!=="National").map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                      {wRegion && <div style={{fontSize:9,color:C.green,marginTop:3}}>✓ Region set</div>}
                    </div>
                    {/* Reporting Manager — dropdown of RH users for this region */}
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>Reporting Manager <span style={{color:C.red}}>*</span></div>
                      {rhForRegion.length > 0 ? (
                        <select value={wRM} onChange={e=>setWizardRM(e.target.value)}
                          style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRM.trim()?C.green:C.border}`,borderRadius:5,color:wRM.trim()?C.text:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          <option value="">Select your Region Head…</option>
                          {rhForRegion.map(rh=><option key={rh.id} value={rh.name}>{rh.name}</option>)}
                        </select>
                      ) : (
                        <input value={wRM} onChange={e=>setWizardRM(e.target.value)}
                          placeholder={wRegion?"Enter Region Head's name":"Select region first"}
                          disabled={!wRegion}
                          style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRM.trim()?C.green:C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",opacity:wRegion?1:0.6}}/>
                      )}
                      <div style={{fontSize:9,color:C.muted,marginTop:3}}>The Region Head who approves your targets and attendance.</div>
                    </div>
                    {!canAdvance && (
                      <div style={{padding:"8px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}33`,borderRadius:6,marginBottom:12,fontSize:11,color:C.orange,fontFamily:"'DM Sans',sans-serif"}}>
                        Region and Reporting Manager are required to continue.
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(0)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back</button>
                      <button onClick={doAdvance} style={{flex:2,padding:"10px 0",background:canAdvance?C.accent:`${C.dim}44`,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:canAdvance?"pointer":"default",fontFamily:"'DM Mono',monospace",opacity:canAdvance?1:0.7}}>Looks good →</button>
                    </div>
                  </div>
                  );
                })()}

                {/* ── Step 2: Set Targets ── */}
                {wStep===2 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Set Your Targets</div>
                    <div style={{fontSize:11,color:C.dim,fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>Add clients and quarterly targets. You can always add more later from the Target Submission page.</div>

                    {wClients.map((c,ci)=>(
                      <div key={ci} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:10,background:C.s2}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>Client {ci+1}</div>
                          {wClients.length>1&&<button onClick={()=>setWClients(p=>p.filter((_,i)=>i!==ci))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>✕</button>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Agency (opt.)</label>
                            <input value={c.agency} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,agency:e.target.value}:x))} placeholder="e.g. Dentsu" style={{fontSize:12}} />
                          </div>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Client *</label>
                            <input value={c.client} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,client:e.target.value}:x))} placeholder="e.g. Tata Motors" style={{fontSize:12}} />
                          </div>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Brand (opt.)</label>
                            <input value={c.brand} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,brand:e.target.value}:x))} placeholder="e.g. Nexon" style={{fontSize:12}} />
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                          {(["Q1","Q2","Q3","Q4"] as const).map((q,qi)=>(
                            <div key={q}>
                              <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>{q} FY26 (₹)</label>
                              <input value={c[q.toLowerCase() as "q1"|"q2"|"q3"|"q4"]} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,[q.toLowerCase()]:e.target.value}:x))} placeholder="e.g. 25L" style={{fontSize:12}} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button onClick={()=>setWClients(p=>[...p,{agency:"",client:"",brand:"",q1:"",q2:"",q3:"",q4:""}])}
                      style={{width:"100%",padding:"8px 0",border:`1px dashed ${C.border}`,background:"transparent",color:C.blue,borderRadius:6,fontSize:12,cursor:"pointer",marginBottom:14,fontFamily:"'DM Mono',monospace"}}>
                      + Add another client
                    </button>

                    {totalTarget>0&&<div style={{padding:"8px 14px",background:`${C.green}10`,border:`1px solid ${C.green}33`,borderRadius:6,fontSize:12,color:C.green,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Total annual target: {fmtR(totalTarget)}</div>}

                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(1)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back</button>
                      <button onClick={()=>setWStep(3)} disabled={totalTarget===0} style={{flex:2,padding:"10px 0",background:totalTarget>0?C.accent:`${C.dim}44`,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:totalTarget>0?"pointer":"default",fontFamily:"'DM Mono',monospace"}}>Review →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Review & Submit ── */}
                {wStep===3 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Review & Submit</div>
                    <div style={{marginBottom:14}}>
                      {wClients.filter(c=>c.client||c.agency).map((c,ci)=>{
                        const qs = {Q1:parseLakh(c.q1),Q2:parseLakh(c.q2),Q3:parseLakh(c.q3),Q4:parseLakh(c.q4)};
                        const tot = Object.values(qs).reduce((s,v)=>s+v,0);
                        return (
                          <div key={ci} style={{padding:"10px 14px",background:C.s2,borderRadius:7,marginBottom:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div style={{fontWeight:700,fontSize:12,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{c.client||c.agency} {c.brand?`· ${c.brand}`:""}</div>
                              <div style={{fontWeight:700,fontSize:12,color:C.green}}>{fmtR(tot)}</div>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              {Object.entries(qs).filter(([,v])=>v>0).map(([q,v])=>(
                                <div key={q} style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>{q}: {fmtR(v as number)}</div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{padding:"10px 14px",background:`${C.accent}10`,border:`1px solid ${C.accent}33`,borderRadius:7,marginBottom:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif"}}>
                        <div style={{fontSize:12,color:C.text}}>Total Annual Target</div>
                        <div style={{fontSize:15,fontWeight:800,color:C.accent}}>{fmtR(totalTarget)}</div>
                      </div>
                      <div style={{fontSize:10,color:C.dim,marginTop:4}}>Submitted → Region Head → NSH → Sales Strategy → CRO</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(2)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Edit</button>
                      <button onClick={doSubmit} style={{flex:2,padding:"10px 0",background:C.green,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Submit for Approval ✓</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

    </>
  );
}
