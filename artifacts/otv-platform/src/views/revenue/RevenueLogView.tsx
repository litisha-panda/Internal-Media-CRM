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
import * as revSvc from "../../services/api/revenue";

export function RevenueLogView({ view, setView, revTab, setRevTab, revForm, setRevForm, editingRevId, setEditingRevId, editRevData, setEditRevData }) {
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
  const isAnnual = filterQ === "FY26 Annual";

  return (
    <>
          {/* ═══ REVENUE LOG ═══ */}
          {view==="revenue-log" && (()=>{
            const myRepId   = user_role?.repId;
            const myEntries = isRep ? revenueEntries.filter(e=>e.repId===myRepId) : revenueEntries;
            const totalRev  = myEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const dealTypes = ["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"];

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REVENUE LOG</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Log revenue booked per advertiser. Updates deal achieved amounts automatically.</div>
                  </div>
                  {/* Total pill */}
                  <div style={{textAlign:"right"}}>
                    <div className="sans" style={{fontSize:22,fontWeight:800,color:C.green}}>{fmtR(totalRev)}</div>
                    <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>{filterQ} LOGGED</div>
                  </div>
                </div>

                {/* ── Annual summary stats ── shown only in FY26 Annual mode */}
                {isAnnual && (()=>{
                  const FY_START_MS  = new Date("2025-04-01").getTime();
                  const monthsElapsed = Math.max(1, (Date.now() - FY_START_MS) / (1000 * 60 * 60 * 24 * 30.44));
                  const myApprovedSubs = (isRep
                    ? targetSubs.filter(s=>s.repId===myRepId&&s.status==="Approved")
                    : targetSubs.filter(s=>s.status==="Approved")
                  );
                  const annualTarget = myApprovedSubs.reduce((s,sub)=>s+sub.totalTarget,0);
                  const targetRunRate  = annualTarget>0 ? Math.round(annualTarget/12) : 0;
                  const currentRunRate = totalRev>0 ? Math.round((totalRev/monthsElapsed)*12) : 0;
                  const cards = [
                    {label:"YTD REVENUE",          value:fmtR(totalRev),         color:C.green,    sub:"All quarters · FY26"},
                    {label:"ANNUAL TARGET",         value:fmtR(annualTarget),     color:C.accent,   sub:"Approved targets across all Qs"},
                    {label:"TARGET RUN RATE",       value:fmtR(targetRunRate)+"/mo", color:C.blue,  sub:"Annual target ÷ 12 months"},
                    {label:"CURRENT RUN RATE",      value:fmtR(currentRunRate)+"/mo", color:currentRunRate>=targetRunRate?C.green:C.red, sub:`Based on ${monthsElapsed.toFixed(1)} months elapsed`},
                  ];
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                      {cards.map(c=>(
                        <div key={c.label} className="card" style={{padding:"14px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,letterSpacing:".08em",fontWeight:700,marginBottom:6}}>{c.label}</div>
                          <div className="sans" style={{fontSize:18,fontWeight:800,color:c.color,marginBottom:3}}>{c.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Log new revenue entry */}
                <div className="card" style={{padding:"16px 18px",marginBottom:20}}>
                  <div className="sans" style={{fontWeight:700,fontSize:13,marginBottom:12}}>Log New Revenue</div>
                  {(()=>{
                    const rf = revForm;
                    const setRf = setRevForm;
                    // Spec §8: Revenue Log client = clients in fully CRO-approved targetSubs for this rep
                    // Note: clientAccounts.approvalStatus is never set; derive from targetSubs instead
                    const myApprovedAccts = isRep
                      ? (()=>{
                          // Collect all client names from approved targetSubs for this rep
                          const approvedNames = new Set<string>(
                            targetSubs
                              .filter(s=>s.repId===myRepId&&s.status==="Approved")
                              .flatMap(s=>(s.clients||[])
                                .filter(cl=>!cl.clientStatus||cl.clientStatus==="Approved")
                                .map((cl:any)=>cl.clientCompany||cl.clientName||"")
                              )
                              .filter(Boolean)
                          );
                          // Match to clientAccounts (for zohoAccountId, etc.)
                          const fromAccts = clientAccounts.filter(a=>a.repId===myRepId&&approvedNames.has(a.clientName));
                          const matched   = new Set(fromAccts.map(a=>a.clientName));
                          // For approved names not yet in clientAccounts, create minimal stubs
                          const stubs = [...approvedNames]
                            .filter(n=>!matched.has(n))
                            .map(n=>({id:`stub_${n}`,clientName:n,repId:myRepId,zohoAccountId:""}));
                          return [...fromAccts,...stubs];
                        })()
                      : clientAccounts; // Managers/admins see all accounts
                    return (
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>CLIENT / ADVERTISER</div>
                            <select value={rf.clientCompany} onChange={e=>{
                              const sel = e.target.value;
                              // Auto-populate from clientAccount (the canonical source)
                              const matchAcct = myApprovedAccts.find(a=>a.clientName===sel);
                              setRf(p=>({...p,clientCompany:sel,clientAccountId:matchAcct?.id||"",zohoAccountId:matchAcct?.zohoAccountId||"",dealType:matchAcct?.dealType||p.dealType,channel:matchAcct?.channel||""}));
                            }}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${rf.zohoAccountId?C.green:C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                              <option value="">Select from approved targets…</option>
                              {myApprovedAccts.sort((a,b)=>a.clientName.localeCompare(b.clientName)).map(a=><option key={a.id} value={a.clientName}>{a.clientName}</option>)}
                            </select>
                            {rf.zohoAccountId&&<div style={{fontSize:9,color:C.green,marginTop:2}}>✓ Zoho ID linked — revenue will match correctly</div>}
                            {!rf.clientCompany&&<div style={{fontSize:9,color:C.dim,marginTop:2}}>Only approved target clients appear here.</div>}
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>DEAL TYPE</div>
                            <select value={rf.dealType} onChange={e=>setRf(p=>({...p,dealType:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                              {dealTypes.map(d=><option key={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>AMOUNT ₹</div>
                            <input value={rf.amount} placeholder="e.g. 5L or 1Cr" onChange={e=>setRf(p=>({...p,amount:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>INVOICE / PO REF</div>
                            <input value={rf.invoiceRef} placeholder="INV-2024-XXX" onChange={e=>setRf(p=>({...p,invoiceRef:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>DATE</div>
                            <input type="date" min="2020-01-01" max="2099-12-31" value={rf.date} onChange={e=>setRf(p=>({...p,date:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:C.dim,marginBottom:3}}>NOTES</div>
                          <input value={rf.notes} placeholder="Optional notes" onChange={e=>setRf(p=>({...p,notes:e.target.value}))}
                            style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                        <button onClick={()=>{
                          const client = rf.clientCompany;
                          if(!client||!rf.amount){showToast("Client and amount are required","err");return;}
                          if(!rf.invoiceRef){showToast("Invoice / RO reference is required — cannot submit without it","err");return;}
                          const amt = parseCurrency(rf.amount);
                          if(!amt){showToast("Invalid amount","err");return;}
                          const newId  = `re${Date.now()}`;
                          const ikey   = `ikey_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                          const entry = {id:newId,repId:isRep?myRepId:null,clientCompany:client,zohoAccountId:rf.zohoAccountId||"",dealType:rf.dealType,amount:amt,invoiceRef:rf.invoiceRef,date:rf.date||TODAY,quarter:entryQ,fiscalYear:CURRENT_FY,notes:rf.notes};
                          setRevenueEntries(p=>[entry,...p]);
                          revSvc.createRevenueEntry({
                            id:newId, repId:isRep?myRepId:undefined, clientCompany:client, zohoAccountId:rf.zohoAccountId||undefined,
                            dealType:rf.dealType, amount:amt, invoiceRef:rf.invoiceRef, date:rf.date||TODAY,
                            quarter:entryQ, fiscalYear:CURRENT_FY, notes:rf.notes||undefined, idempotencyKey:ikey,
                          }).catch((err:any)=>{showToast(err?.body?.error||"Network error — entry may not be saved","err");setRevenueEntries(p=>p.filter(e=>e.id!==newId));});
                          // Fix 6: IP slot committed — notify other reps with pending proposals for the same slot
                          if (rf.dealType==="IPs") {
                            const linkedDeal = deals.find(d=>(isRep?d.repId===myRepId:true)&&d.dealType==="IPs"&&d.clientCompany===client&&d.ipId&&d.elemId);
                            if (linkedDeal) {
                              const otherPending = ipProposals.filter(p=>p.ipId===linkedDeal.ipId&&p.elemId===linkedDeal.elemId&&p.repId!==myRepId&&p.status==="Pending");
                              if (otherPending.length) {
                                const notifTasks = otherPending.map(p=>({
                                  id:`t_ipnotify_${Date.now()}_${p.repId}`,
                                  assignedTo:p.repId, assignedToUserId:USER_ROLES.find(u=>u.repId===p.repId)?.id||null,
                                  assignedDept:"Sales Rep", repId:p.repId, clientCompany:p.client,
                                  title:`[IP Slot Committed] ${linkedDeal.ipId} · ${linkedDeal.elemId} has been committed to ${client} — your proposal for ${p.client} has been released.`,
                                  description:`The slot you pitched for ${p.client} is now committed. You can explore other elements in this IP.`,
                                  priority:"High", status:"Open", dueDate:TODAY, createdAt:TODAY,
                                  assignedBy:activeUser, assignedByName:user_role?.name||"System", fromMeetingLog:false,
                                }));
                                setTasks(prev=>[...notifTasks,...prev]);
                                // Mark their proposals as Released
                                setIpProposals(prev=>prev.map(p=>otherPending.some(op=>op.id===p.id)?{...p,status:"Released"}:p));
                                showToast(`IP slot committed. ${otherPending.length} rep${otherPending.length>1?"s":""} notified.`);
                              }
                            }
                          }
                          // Part 3+9: Auto-set deal stage to "RO Received" when revenue is logged
                          const matchDeal = deals.find(d=>(isRep?d.repId===myRepId:true)&&(rf.zohoAccountId&&d.zohoAccountId?d.zohoAccountId===rf.zohoAccountId:d.clientCompany===client)&&qMatch(d.quarter));
                          if(matchDeal){
                            setDeals(p=>p.map(d=>d.id===matchDeal.id?{...d,stage:"RO Received",outcome:"RO Received",lastContact:TODAY}:d));
                            // Update client account stage too
                            if (matchDeal.clientAccountId) {
                              setClientAccounts(p=>p.map(a=>a.id===matchDeal.clientAccountId?{...a,currentStage:"RO Received",lastContactDate:TODAY,updatedAt:TODAY}:a));
                            }
                          }
                          setRf({clientCompany:"",zohoAccountId:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:TODAY,notes:""});
                          const totalFY = [...revenueEntries.filter(e=>(isRep?e.repId===myRepId:true)&&e.fiscalYear===CURRENT_FY),entry].reduce((s,e)=>s+(e.amount||0),0);
                          // Part 9: Check if annual target reached
                          const annualTarget = isRep ? (getAnnualTarget(myRepId)?.amount||0) : 0;
                          if (annualTarget>0 && totalFY>=annualTarget) {
                            showToast(`Annual target achieved. ₹${(totalFY/100000).toFixed(1)}L this fiscal year.`);
                          } else {
                            showToast(`₹${(amt/100000).toFixed(1)}L logged for ${client} ✓  Your total ${CURRENT_FY}: ₹${(totalFY/100000).toFixed(1)}L`);
                          }
                        }} style={{background:"linear-gradient(135deg,#16c784,#0ea570)",border:"none",color:"#fff",borderRadius:5,padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          ✓ Log Revenue
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Revenue history */}
                {myEntries.length===0 ? (
                  <div style={{textAlign:"center",padding:40,color:C.muted}}>No revenue logged yet.</div>
                ) : (
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Revenue Entries · {filterQ}</div>
                    <div className="card" style={{overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          {["Client","Deal Type","Amount","Invoice Ref","Date","Notes",""].map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {myEntries.filter(e=>qMatch(e.quarter)).sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                            editingRevId===e.id ? (
                              <tr key={e.id} style={{borderBottom:`1px solid ${C.border}`,background:C.s2}}>
                                <td colSpan={7} style={{padding:"12px 14px"}}>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"end"}}>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>AMOUNT ₹</div>
                                      <input value={editRevData.amount||""} onChange={e=>setEditRevData(p=>({...p,amount:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>DEAL TYPE</div>
                                      <select value={editRevData.dealType||"Linear TV"} onChange={ev=>setEditRevData(p=>({...p,dealType:ev.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                                        {dealTypes.map(d=><option key={d}>{d}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>INVOICE REF</div>
                                      <input value={editRevData.invoiceRef||""} onChange={e=>setEditRevData(p=>({...p,invoiceRef:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>DATE</div>
                                      <input type="date" value={editRevData.date||TODAY} onChange={e=>setEditRevData(p=>({...p,date:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>NOTES</div>
                                      <input value={editRevData.notes||""} onChange={e=>setEditRevData(p=>({...p,notes:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                  </div>
                                  <div style={{display:"flex",gap:8}}>
                                    <button onClick={()=>{
                                      const amt=parseCurrency(editRevData.amount);
                                      if(!amt){showToast("Invalid amount","err");return;}
                                      setRevenueEntries(p=>p.map(x=>x.id===e.id?{...x,...editRevData,amount:amt,editHistory:[...(x.editHistory||[]),{editedAt:new Date().toISOString(),editedBy:user_role?.name||activeUser,oldAmount:x.amount}]}:x));
                                      setEditingRevId(null);showToast("Entry updated ✓");
                                    }} style={{background:`${C.green}22`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Save</button>
                                    <button onClick={()=>setEditingRevId(null)} style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                                    <button onClick={()=>{if(!confirm("Delete this revenue entry?"))return;setRevenueEntries(p=>p.filter(x=>x.id!==e.id));setEditingRevId(null);showToast("Entry deleted");}}
                                      style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>🗑 Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                            <tr key={e.id} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={ev=>ev.currentTarget.style.background=C.s2}
                              onMouseOut={ev=>ev.currentTarget.style.background="transparent"}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{e.clientCompany}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{e.dealType}</span></td>
                              <td style={{padding:"10px 14px",fontWeight:700,color:C.green}}>{fmtR(e.amount)}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.invoiceRef||"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.date}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:160}}>{e.notes||"—"}</td>
                              <td style={{padding:"10px 14px",textAlign:"right"}}>
                                <button onClick={()=>{setEditingRevId(e.id);setEditRevData({amount:(e.amount/100000)+"L",dealType:e.dealType,invoiceRef:e.invoiceRef||"",date:e.date,notes:e.notes||""});}}
                                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✏ Edit</button>
                              </td>
                            </tr>
                            )
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

    </>
  );
}
