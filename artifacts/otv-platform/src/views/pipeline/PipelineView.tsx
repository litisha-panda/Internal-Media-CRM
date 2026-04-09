// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES, APPROVAL_SLA_DAYS, APPROVAL_TARGETS, TARGET_APPROVAL_CHAIN,
  MEETING_STATUS, MEETING_TYPES, CLIENT_OR_AGENCY, TASK_PRIORITIES, TASK_STATUSES,
  SLA, REQ_STATUS, DEPARTMENTS, PLAN_STATUS, PLAN_DEADLINE, HR_EMAIL,
  ALL_CHANNELS, D1, D3, D7, D14, THIS_WEEK_START, IP_CATALOG, PITCH_TYPES,
  getToday, getTomorrow,
} from "../../constants";
import ZohoSearchInput from "../../components/ZohoSearchInput";

export function PipelineView({ view, setView, isMobile, rtTab, setRtTab }) {
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

  // Derived computations (previously inline in CROApp)
  const closedDeals  = visibleDeals.filter(d=>d.outcome==="Mail Confirmed");
  const activeDeals  = visibleDeals.filter(d=>d.outcome!=="Not Interested");
  const weightedPipe = activeDeals.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
  const totalTarget  = visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
  const forecast     = closedRevenue + weightedPipe;
  const gap          = Math.max(0,totalTarget-forecast);
  const closePct     = totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0;
  const fcastPct     = totalTarget>0?Math.round((forecast/totalTarget)*100):0;

  const rtClientMap: any = {};
  visibleDeals.forEach(d=>{
    if(!rtClientMap[d.clientCompany]) rtClientMap[d.clientCompany]={
      clientCompany:d.clientCompany, repId:d.repId, lastContact:d.lastContact,
      deals:[], fct:0, digital:0, integrated:0, sponsorship:0, branded:0, total:0, target:0
    };
    const cl = rtClientMap[d.clientCompany];
    cl.deals.push(d);
    cl.target += (d.targetAmount||0);
    if(d.outcome==="Mail Confirmed"){
      if(d.dealType==="Linear TV") cl.fct += d.amount;
      else if(d.dealType==="Digital") cl.digital += d.amount;
      else if(d.dealType==="Integrated Packages") cl.integrated += d.amount;
      else if(d.dealType==="IPs") cl.sponsorship += d.amount;
      else if(d.dealType==="Media Solutions") cl.branded += d.amount;
      cl.total += d.amount;
    }
    if(!cl.lastContact||d.lastContact>cl.lastContact) cl.lastContact=d.lastContact;
  });
  const rtClients = Object.values(rtClientMap).sort((a:any,b:any)=>daysSince(b.lastContact)-daysSince(a.lastContact));
  const BLANK_DEAL = { clientCompany:"", zohoAccountId:"", repId:"", clientAccountId:"", contactName:"", designation:"", contactLevel:"", phone:"", email:"", dealType:"", outcome:"Prospect", stage:"Prospect", amount:"", pipelineAmount:"", targetAmount:"", lossReason:"", priority:"Regular", quarter:"Q1 FY26", notes:"", nextStep:"", nextStepDate:"", agencyName:"", zohoAgencyId:"", reqs:[], auditLog:[] };
  const BLANK_ACTION_REQUIRED = {what:"", from:"", description:"", byWhen:""};

  return (
    <>
          {/* ═══ REVENUE TRACKER ═══ */}
          {view==="pipeline" && (
            <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REVENUE TRACKER</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{isDigiOps?"Website · App · Social · Direct · Internal · Programmatic":"Linear TV · IPs · Digital · Media Solutions · Integrated Packages"}</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Deal</button>
                </div>

                {/* Tab switcher */}
                <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
                  {(isDigiOps ? [
                    {id:"accounts",    label:"Website",      sub:"Digital"},
                    {id:"digi-app",    label:"App",          sub:"Mobile"},
                    {id:"digi-social", label:"Social Media", sub:"Platforms"},
                    {id:"digi-direct", label:"Direct",       sub:"Direct sales"},
                    {id:"digi-internal",label:"Internal",    sub:"Cross-sell"},
                    {id:"digi-prog",   label:"Programmatic", sub:"Automated"},
                  ] : [
                    {id:"accounts",        label:"Accounts",            sub:"All clients"},
                    {id:"linear-tv",       label:"Linear TV",           sub:"TV deals"},
                    {id:"properties",      label:"IPs",                 sub:"IP inventory"},
                    {id:"digital",         label:"Digital",             sub:"Online deals"},
                    {id:"brand",           label:"Media Solutions",     sub:"Custom packages"},
                    {id:"integrated",      label:"Integrated Packages", sub:"Multi-platform"},
                    {id:"revenue-report",  label:"Revenue Report",      sub:"From entries"},
                  ]).map(t=>(
                    <button key={t.id} onClick={()=>setRtTab(t.id)}
                      style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:rtTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",color:rtTab===t.id?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:rtTab===t.id?700:400,textAlign:"left",whiteSpace:"nowrap"}}>
                      <div>{t.label}</div>
                      <div style={{fontSize:9,color:C.muted,marginTop:1}}>{t.sub}</div>
                    </button>
                  ))}
                </div>

                {/* ── ACCOUNTS TAB ── spec: all clientAccounts for visible reps, per-account numbers ── */}
                {rtTab==="accounts" && (()=>{
                  const visibleAccts = clientAccounts
                    .filter(a => visibleRepIdsSet.has(a.repId))
                    .sort((a,b) => daysSince(b.lastDealMeetingDate||b.lastContactDate) - daysSince(a.lastDealMeetingDate||a.lastContactDate));
                  return (
                  <div>
                    {visibleAccts.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No approved client accounts yet.</div>}
                    {visibleAccts.length>0&&(
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {visibleAccts.map(a=>{
                              const rep = reps.find(r=>r.id===a.repId);
                              const ach = revenueEntries.filter(e=>(e.clientAccountId===a.id||(e.repId===a.repId&&e.clientCompany===a.clientName&&!e.clientAccountId))&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                              const cmt = a.currentStage==="Mail Confirmed"?(a.annualTarget||0):0;
                              const inp = ["In Discussion","Negotiation"].includes(a.currentStage||"")?(a.annualTarget||0):0;
                              const sf  = Math.max(0,(a.annualTarget||0)-ach-cmt-inp);
                              const idle = daysSince(a.lastDealMeetingDate||a.lastContactDate);
                              const pct  = (a.annualTarget||0)>0?Math.round((ach/(a.annualTarget||0))*100):0;
                              return (
                                <tr key={a.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                                  onClick={()=>{setAccountThreadClient(a.clientName);setAccountThreadOpen(true);}}
                                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                  onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}>
                                    <div className="sans" style={{fontWeight:700}}>{a.clientName}</div>
                                    {idle>=7&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>COLD {idle}d</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{a.channel||"—"}</td>
                                  <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(a.annualTarget||0)}</td>
                                  <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>
                                    {ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}
                                  </td>
                                  <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                  <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                  <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                  <td style={{padding:"9px 14px"}}>
                                    <span style={{padding:"2px 8px",background:`${oColor(a.currentStage)}18`,border:`1px solid ${oColor(a.currentStage)}44`,borderRadius:5,color:oColor(a.currentStage),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{a.currentStage||"—"}</span>
                                  </td>
                                  <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* ── LINEAR TV TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Linear TV");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Linear TV"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dP=dtDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="linear-tv" ? (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* ── PROPERTIES / IPs TAB ── */}
                {rtTab==="properties" && (()=>{
                  // Part 10+12: IPs tab is read-only for Sales Reps
                  if (isRep) return (
                    <div style={{textAlign:"center",padding:"48px 24px",color:C.dim,background:C.s2,borderRadius:10,marginTop:8}}>
                      <div style={{fontSize:24,marginBottom:12}}>📋</div>
                      <div className="sans" style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8}}>IP Inventory — Read Only</div>
                      <div style={{fontSize:12,color:C.dim,maxWidth:400,margin:"0 auto",lineHeight:1.7}}>
                        IP inventory is managed centrally by Sales Strategy. Speak to your Region Head to link an IP deal to your targets.
                      </div>
                    </div>
                  );
                  // Deals-based metrics (mirrors Linear TV tab structure)
                  const ipDeals = visibleDeals.filter(d=>d.dealType==="IPs");
                  const ipDT = ipDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const ipDC = revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="IPs"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const ipDG = Math.max(0,ipDT-ipDC); const ipPct = ipDT>0?Math.round((ipDC/ipDT)*100):0;
                  const ipDsc = ipPct>=80?C.green:ipPct>=50?C.accent:C.red;

                  const visibleIPs = IP_CATALOG.filter(ip=>qMatch(ip.quarter));
                  const canApprove  = isStrategy || isNSH || isCRORole || isAdmin;
                  const stColor = s => s==="Committed"?C.green:s==="In Discussion"?C.orange:C.muted;
                  // Closed-at visible to: RH/NSH/CRO/Strategy/Admin, or the rep who owns the proposal/elem
                  const canSeeCA = (ownRepId) =>
                    isRH || isNSH || isCRORole || isStrategy || isAdmin ||
                    (isRep && ownRepId === user_role?.repId);

                  // Helper: get live proposals for one element
                  const getEP = (ipId, elemId) => ipProposals.filter(p=>p.ipId===ipId&&p.elemId===elemId);

                  // Submit a new proposal + create linked IPs deal in pipeline
                  const submitProposal = (ip, elem) => {
                    if (!ipPropClient.trim()) { showToast("Enter client name","err"); return; }
                    const myRep = reps.find(r=>r.id===user_role?.repId);
                    const propId = `ipr${Date.now()}`;
                    const prop = {
                      id: propId,
                      ipId: ip.id, elemId: elem.id,
                      repId: user_role?.repId, repName: myRep?.name||user_role?.name||"Rep",
                      client: ipPropClient.trim(),
                      proposedValue: parseCurrency(ipPropValue)||null,
                      note: ipPropNote.trim(),
                      proposedAt: TODAY,
                      status: "Pending",
                      closedAt: null, approvedBy: null, approvedAt: null,
                    };
                    setIpProposals(prev=>[...prev, prop]);
                    // Create linked IPs deal so it appears in the rep's pipeline
                    const existingIpDeal = deals.find(d=>d.repId===user_role?.repId&&d.dealType==="IPs"&&d.clientCompany===ipPropClient.trim()&&d.ipPropId===propId);
                    if (!existingIpDeal) {
                      const newDeal = {
                        id:`d_ip_${Date.now()}`, repId:user_role?.repId, repName:myRep?.name||"",
                        region:myRep?.region||"", clientCompany:ipPropClient.trim(),
                        contactName:"", designation:"", contactLevel:"", phone:"", email:"",
                        dealType:"IPs", outcome:"In Discussion", stage:"In Discussion",
                        amount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        pipelineAmount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        targetAmount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        lossReason:"", priority:"Regular", quarter:ip.quarter||filterQ,
                        notes:ipPropNote.trim(), nextStep:"", nextStepDate:"",
                        agencyName:"", zohoAgencyId:"", reqs:[], auditLog:[],
                        ipId:ip.id, elemId:elem.id, ipPropId:propId,
                        lastDealMeetingDate:TODAY, lastContact:TODAY,
                      };
                      setDeals(prev=>[newDeal,...prev]);
                    }
                    setIpPropClient(""); setIpPropNote(""); setIpPropValue(""); setIpPropOpen(null);
                    showToast(`Pitched to client — deal added to pipeline. Awaiting Sales Strategy approval ✓`);
                  };

                  // Approve a proposal
                  const approveProposal = (prop) => {
                    const price = parseCurrency(ipApprovalPrices[prop.id]||"") || null;
                    setIpProposals(prev=>prev.map(p=>p.id===prop.id
                      ? {...p, status:"Approved", closedAt:price, approvedBy:activeUser, approvedAt:TODAY}
                      : p));
                    setIpApprovalPrices(prev=>{const n={...prev};delete n[prop.id];return n;});
                    showToast(`${prop.client} approved for ${prop.repName} ✓`);
                  };

                  // Reject a proposal
                  const rejectProposal = (prop) => {
                    setIpProposals(prev=>prev.map(p=>p.id===prop.id ? {...p, status:"Rejected"} : p));
                    showToast(`Proposal rejected`,"ok");
                  };

                  return (
                    <div>
                      {/* ── IPs DEALS PIPELINE (deals-based, mirrors Linear TV) ── */}
                      {ipDT>0&&(
                        <div style={{marginBottom:20}}>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[{label:"TARGET",value:fmtR(ipDT),color:C.accent},{label:"ACHIEVED",value:fmtR(ipDC),color:C.green},{label:"SHORTFALL",value:fmtR(ipDG),color:ipDG===0?C.green:C.red},{label:"% COMPLETE",value:`${ipPct}%`,color:ipDsc}].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                            <div style={{height:"100%",width:`${Math.min(ipPct,100)}%`,background:ipDsc,borderRadius:2}}/>
                          </div>
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                              <tbody>
                                {ipDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                  const rep=reps.find(r=>r.id===d.repId);
                                  const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                  const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                  const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                  const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                  const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                      <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                      <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                      <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                      <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                      <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                      <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                      <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                      <td style={{padding:"9px 14px"}}><span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span></td>
                                      <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div style={{height:1,background:C.border,marginBottom:20}}/>
                        </div>
                      )}
                      {/* ── IP CATALOG / INVENTORY ── */}
                      {visibleIPs.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No IPs scheduled for {filterQ}.</div>}
                      {visibleIPs.map(ip=>{
                        // Live per-element status (proposals override static)
                        const liveElem = (elem) => {
                          const ep = getEP(ip.id, elem.id);
                          const approved = ep.filter(p=>p.status==="Approved");
                          const pending  = ep.filter(p=>p.status==="Pending");
                          const effStatus = approved.length>0?"Committed"
                            : pending.length>0&&elem.status==="Available"?"In Discussion"
                            : elem.status;
                          return {ep, approved, pending, effStatus};
                        };
                        const totalRack    = ip.elements.reduce((s,e)=>s+e.rackRate,0);
                        const committedVal = ip.elements.reduce((s,e)=>{
                          const {effStatus}=liveElem(e); return effStatus==="Committed"?s+e.rackRate:s;},0);
                        const discVal      = ip.elements.reduce((s,e)=>{
                          const {effStatus}=liveElem(e); return effStatus==="In Discussion"?s+e.rackRate:s;},0);
                        const committedCnt = ip.elements.filter(e=>liveElem(e).effStatus==="Committed").length;
                        const discCnt      = ip.elements.filter(e=>liveElem(e).effStatus==="In Discussion").length;
                        const availCnt     = ip.elements.filter(e=>liveElem(e).effStatus==="Available").length;
                        const soldPct      = totalRack>0?Math.round((committedVal/totalRack)*100):0;
                        const pipePct      = totalRack>0?Math.round((discVal/totalRack)*100):0;

                        return (
                          <div key={ip.id} className="card" style={{marginBottom:14,padding:"16px 18px"}}>
                            {/* IP header */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                              <div>
                                <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:3}}>{ip.name}</div>
                                <div style={{fontSize:11,color:C.dim}}>{ip.type} · {ip.channel} · {ip.airDates}</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:11,color:C.dim,marginBottom:3}}>Rack Value: <span style={{color:C.text,fontWeight:700}}>{fmtR(totalRack)}</span></div>
                                <div style={{fontSize:10,color:C.dim}}>
                                  <span style={{color:C.green,fontWeight:700}}>{committedCnt} committed</span>
                                  {" · "}
                                  <span style={{color:C.orange,fontWeight:700}}>{discCnt} in discussion</span>
                                  {" · "}
                                  <span style={{color:C.muted}}>{availCnt} available</span>
                                </div>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",position:"relative",marginBottom:14}}>
                              <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(soldPct,100)}%`,background:C.green,borderRadius:2}}/>
                              <div style={{position:"absolute",left:`${soldPct}%`,height:"100%",width:`${Math.min(pipePct,100-soldPct)}%`,background:`${C.accent}88`,borderRadius:2}}/>
                            </div>
                            {/* Elements table */}
                            <div style={{background:C.s2,borderRadius:6,overflow:"hidden"}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                <thead>
                                  <tr>
                                    {["Element","Rack Rate","Status","Client","Sales Rep","Closed At",""].map((h,hi)=>(
                                      <th key={hi} style={{padding:"8px 12px",background:C.s3,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>
                                        {hi===5 && isRep && !canApprove ? "Closed At 🔒" : h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {ip.elements.map((elem,ei)=>{
                                    const {ep, approved, pending, effStatus} = liveElem(elem);
                                    const rejected = ep.filter(p=>p.status==="Rejected");
                                    const sc  = stColor(effStatus);
                                    const fk  = `${ip.id}-${elem.id}`;
                                    const panelOpen = ipPropOpen===fk;
                                    const myProposal = isRep ? ep.find(p=>p.repId===user_role?.repId) : null;
                                    // Effective display values
                                    const effClient  = approved.length>0 ? approved.map(p=>p.client).join(", ") : elem.client;
                                    const effRepName = approved.length>0 ? approved.map(p=>p.repName).join(", ") : (elem.repId?reps.find(r=>r.id===elem.repId)?.name:null);
                                    const effClosedAt= approved.length>0 ? approved[0].closedAt : elem.closedAt;
                                    const effRepId   = approved.length>0 ? approved[0].repId    : elem.repId;
                                    const seeCA      = canSeeCA(effRepId);
                                    // Pending visible to strategy or the proposing rep
                                    const showPendingBadge = canApprove&&pending.length>0;
                                    const canPropose = isRep && !myProposal && effStatus!=="Committed";
                                    const rowBg = panelOpen?`${C.accent}08`:ei%2===0?"transparent":C.s2+"44";

                                    return (
                                      <React.Fragment key={elem.id}>
                                        {/* Main element row */}
                                        <tr style={{borderBottom:panelOpen?`1px solid ${C.accent}44`:`1px solid ${C.border}`,background:rowBg}}>
                                          <td style={{padding:"10px 12px",fontWeight:600,color:C.text}}>{elem.label}</td>
                                          <td style={{padding:"10px 12px",fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>{fmtR(elem.rackRate)}</td>
                                          <td style={{padding:"10px 12px"}}>
                                            <span style={{background:`${sc}22`,color:sc,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{effStatus}</span>
                                            {pending.length>0&&effStatus!=="Committed"&&<span style={{marginLeft:5,background:`${C.orange}22`,color:C.orange,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>{pending.length} proposal{pending.length!==1?"s":""}</span>}
                                          </td>
                                          <td style={{padding:"10px 12px",color:effClient?C.text:C.muted,fontSize:11}}>
                                            {effClient||
                                              (pending.length>0&&!canApprove&&myProposal&&myProposal.status==="Pending"
                                                ? <span style={{color:C.orange,fontStyle:"italic"}}>Your proposal pending</span>
                                                : "—")}
                                          </td>
                                          <td style={{padding:"10px 12px",color:effRepName?C.dim:C.muted,fontSize:11}}>{effRepName||"—"}</td>
                                          <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                                            {effStatus==="Available"&&!pending.length ? (
                                              <span style={{color:C.muted,fontSize:11}}>—</span>
                                            ) : seeCA ? (
                                              effClosedAt!=null ? (
                                                <span style={{color:C.green,fontWeight:700}}>{fmtR(effClosedAt)}
                                                  {effClosedAt<elem.rackRate&&<span style={{color:C.red,fontSize:10,marginLeft:5}}>({Math.round((1-effClosedAt/elem.rackRate)*100)}% off)</span>}
                                                </span>
                                              ) : <span style={{color:C.orange,fontSize:11}}>Pending close</span>
                                            ) : (
                                              <span style={{color:C.muted,fontSize:11,fontStyle:"italic"}}>Confidential</span>
                                            )}
                                          </td>
                                          {/* Action cell */}
                                          <td style={{padding:"6px 12px",whiteSpace:"nowrap",textAlign:"right"}}>
                                            {canPropose&&(
                                              <button onClick={()=>{setIpPropOpen(panelOpen?null:fk);setIpPropClient("");setIpPropNote("");setIpPropValue("");}}
                                                style={{background:panelOpen?C.s3:`${C.blue}18`,border:`1px solid ${panelOpen?C.border:C.blue}44`,color:panelOpen?C.dim:C.blue,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                {panelOpen?"✕ Cancel":"+ Propose"}
                                              </button>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Pending"&&(
                                              <span style={{background:`${C.orange}15`,border:`1px solid ${C.orange}44`,color:C.orange,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>⏳ Pending</span>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Approved"&&(
                                              <span style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>✓ Approved</span>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Rejected"&&(
                                              <span style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>✗ Rejected</span>
                                            )}
                                            {showPendingBadge&&(
                                              <button onClick={()=>setIpPropOpen(panelOpen?null:fk)}
                                                style={{background:panelOpen?C.s3:`${C.orange}18`,border:`1px solid ${panelOpen?C.border:C.orange}55`,color:panelOpen?C.dim:C.orange,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                {panelOpen?"✕ Close":`Review ${pending.length}`}
                                              </button>
                                            )}
                                          </td>
                                        </tr>

                                        {/* ── Expandable panel ── */}
                                        {panelOpen&&(
                                          <tr>
                                            <td colSpan={7} style={{padding:0,borderBottom:`2px solid ${C.accent}33`}}>
                                              <div style={{padding:"12px 18px",background:`${C.accent}05`}}>

                                                {/* Rep proposal form */}
                                                {canPropose&&(
                                                  <div style={{marginBottom:canApprove?14:0}}>
                                                    <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:8,letterSpacing:".05em"}}>PROPOSE A CLIENT FOR THIS ELEMENT</div>
                                                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
                                                      <div style={{flex:"1 1 160px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Client name *</div>
                                                        <input value={ipPropClient} onChange={e=>setIpPropClient(e.target.value)}
                                                          placeholder="e.g. Godrej Consumer"
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <div style={{flex:"1 1 120px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Proposed value (optional)</div>
                                                        <input value={ipPropValue} onChange={e=>setIpPropValue(e.target.value)}
                                                          placeholder={`e.g. ${(elem.rackRate/100000).toFixed(0)}L`}
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <div style={{flex:"2 1 180px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Note</div>
                                                        <input value={ipPropNote} onChange={e=>setIpPropNote(e.target.value)}
                                                          placeholder="Budget confirmed / in discussion…"
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <button onClick={()=>submitProposal(ip,elem)}
                                                        style={{background:C.blue,border:"none",color:"#fff",borderRadius:5,padding:"6px 16px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>
                                                        Submit →
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Strategy / management approval panel */}
                                                {canApprove&&(pending.length>0||approved.length>0||rejected.length>0)&&(
                                                  <div>
                                                    <div style={{fontSize:11,fontWeight:700,color:C.dim,marginBottom:8,letterSpacing:".05em"}}>PROPOSALS</div>
                                                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                                      {[...pending,...approved,...rejected].map(prop=>{
                                                        const pRep = reps.find(r=>r.id===prop.repId);
                                                        const statusColor = prop.status==="Approved"?C.green:prop.status==="Rejected"?C.red:C.orange;
                                                        return (
                                                          <div key={prop.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6,border:`1px solid ${statusColor}33`,flexWrap:"wrap"}}>
                                                            <div style={{flex:"1 1 200px"}}>
                                                              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{prop.client}</div>
                                                              <div style={{fontSize:10,color:C.dim}}>{pRep?.name||prop.repName} · {prop.proposedAt}{prop.note?` · "${prop.note}"`:""}</div>
                                                              {prop.proposedValue&&<div style={{fontSize:10,color:C.accent}}>Proposed: {fmtR(prop.proposedValue)}</div>}
                                                            </div>
                                                            <span style={{background:`${statusColor}18`,color:statusColor,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{prop.status}</span>
                                                            {prop.status==="Approved"&&prop.closedAt&&(
                                                              <span style={{fontSize:11,color:C.green,fontWeight:700}}>Closed: {fmtR(prop.closedAt)}</span>
                                                            )}
                                                            {prop.status==="Pending"&&canApprove&&(
                                                              <>
                                                                <input
                                                                  value={ipApprovalPrices[prop.id]||""}
                                                                  onChange={e=>setIpApprovalPrices(prev=>({...prev,[prop.id]:e.target.value}))}
                                                                  placeholder={`Closed at (e.g. ${(elem.rackRate/100000).toFixed(0)}L)`}
                                                                  style={{background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",width:140}}/>
                                                                <button onClick={()=>approveProposal(prop)}
                                                                  style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"4px 12px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                                  Approve ✓
                                                                </button>
                                                                <button onClick={()=>rejectProposal(prop)}
                                                                  style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:5,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                                                  Reject
                                                                </button>
                                                              </>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Empty state for strategy when no proposals yet */}
                                                {canApprove&&ep.length===0&&(
                                                  <div style={{color:C.muted,fontSize:11,fontStyle:"italic"}}>No proposals submitted yet for this element.</div>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── ACTIVE DEALS TAB ── */}
                {/* ── BRAND SOLUTIONS TAB ── */}
                {rtTab==="brand" && (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:11,color:C.dim}}>Custom packages combining TV + Digital + On-ground + Content for brand campaigns</div>
                      {/* Part 12: No New Package button for Sales Rep */}
                      {!isRep && <button className="btn btn-primary" onClick={()=>{
                        const client = "New Client";  // use inline deal form
                        const pkg = "Custom Package";
                        const val = "1000000";
                        // TODO: replace with Add Deal modal
                        const newDeal = {...BLANK_DEAL,clientCompany:client,dealType:"Media Solutions",outcome:"Needs Callback",amount:parseCurrency(val||"0"),targetAmount:parseCurrency(val||"0"),quarter:entryQ,repId:user_role?.repId||"",lastContact:TODAY,notes:pkg};
                        setDeals(p=>[{id:`d${Date.now()}`,...newDeal,repId:parseInt(newDeal.repId)||5,region:user_role?.region||"National",reqs:[]},...p]);
                        showToast("Brand Solutions deal created ✓");
                      }}>+ New Package</button>}
                    </div>

                    {/* Brand Solutions deals */}
                    {(()=>{
                      const bsDeals = visibleDeals.filter(d=>d.dealType==="Media Solutions"||d.dealType==="Integrated Packages");
                      if(!bsDeals.length) return (
                        <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>No target set for this category this fiscal year.</div>
                        </div>
                      );
                      return bsDeals.map(d=>{
                        const rep = reps.find(r=>r.id===d.repId);
                        const idle = daysSince(d.lastContact);
                        const idleC = idle>=7?C.red:idle>=3?C.orange:C.green;
                        const stageC = oColor(d.outcome);
                        return (
                          <div key={d.id} className="card" style={{padding:"16px 18px",marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                  <span className="sans" style={{fontSize:15,fontWeight:700}}>{d.clientCompany}</span>
                                  <span style={{background:`${C.purple}18`,color:C.purple,padding:"1px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{d.dealType}</span>
                                </div>
                                <div style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region} · Last contact: <span style={{color:idleC,fontWeight:600}}>{idle===0?"today":`${idle}d ago`}</span></div>
                                {d.notes&&<div style={{fontSize:11,color:C.dim,marginTop:3,fontStyle:"italic"}}>{d.notes}</div>}
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div className="sans" style={{fontSize:20,fontWeight:800,color:C.green}}>{fmtR(d.amount)}</div>
                                <span style={{background:`${stageC}22`,color:stageC,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{d.outcome}</span>
                              </div>
                            </div>
                            {/* Package components */}
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                              {["TV FCT","Digital Video","On-Ground","Content","Influencer","OTT"].map(comp=>(
                                <span key={comp} style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10,border:`1px dashed ${C.border}`,cursor:"pointer"}}
                                  title="Click to mark as included">
                                  {comp}
                                </span>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                              <button onClick={()=>{setLogForm(p=>({...BLANK_LOG,repId:String(d.repId),dealId:d.id,clientAgencyName:d.clientCompany,contactName:d.contactName||""}));setLogOpen(true);}}
                                style={{background:`${C.accent}18`,border:"none",color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Log Touchpoint</button>
                              <button onClick={()=>{const ir={id:`ir${Date.now()}`,type:"Support",dept:"Branding Team",subject:`Brand Solutions deck for ${d.clientCompany}`,details:`Custom package deck needed. Estimated value: ${fmtR(d.amount)}.`,raisedBy:activeUser,raisedByName:user_role?.name||"",repId:d.repId,dealId:d.id,clientCompany:d.clientCompany,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};setInternalReqs(p=>[ir,...p]);showToast("Deck request raised → Branding Team ✓");}}
                                style={{background:`${C.purple}18`,border:"none",color:C.purple,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Request Deck</button>
                              <button onClick={()=>{const ir={id:`ir${Date.now()}`,type:"Approval",dept:"NSH",subject:`Brand Solutions approval: ${d.clientCompany} — ${fmtR(d.amount)}`,details:`Custom package deal needs NSH sign-off before presenting to client.`,raisedBy:activeUser,raisedByName:user_role?.name||"",repId:d.repId,dealId:d.id,clientCompany:d.clientCompany,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};setInternalReqs(p=>[ir,...p]);showToast("Approval request raised → NSH ✓");}}
                                style={{background:`${C.orange}18`,border:"none",color:C.orange,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Request Approval</button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* ── DIGITAL TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Digital");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Digital"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="digital" ? (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* ── INTEGRATED PACKAGES TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Integrated Packages");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Integrated Packages"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="integrated" ? (
                    <div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Multi-platform packages combining Linear TV + Digital + On-ground + Content</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {rtTab==="deals" && (
                  <div>
                    {/* Blocked deals banner */}
                    {(()=>{
                      const blocked = visibleDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested");
                      if(!blocked.length) return null;
                      return (
                        <div style={{background:`${C.orange}08`,border:`1px solid ${C.orange}33`,borderRadius:7,padding:"10px 16px",marginBottom:14}}>
                          <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>⏳ {blocked.length} Deal{blocked.length!==1?"s":""} Awaiting Approval</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {blocked.map(d=>{
                              const dw = d.awaitingApprovalSince?daysSince(d.awaitingApprovalSince):0;
                              const ov = dw>=APPROVAL_SLA_DAYS;
                              return (
                                <div key={d.id} style={{background:ov?`${C.red}12`:`${C.orange}10`,border:`1px solid ${ov?C.red:C.orange}33`,borderRadius:5,padding:"6px 10px",display:"flex",gap:8,alignItems:"center"}}>
                                  <span style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</span>
                                  <span style={{background:ov?`${C.red}22`:`${C.orange}22`,color:ov?C.red:C.orange,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:600}}>→ {d.awaitingApproval}</span>
                                  <span style={{fontSize:10,color:C.dim}}>{dw}d{ov?" — ESCALATE":""}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {visibleDeals.length === 0 && (
                      <div style={{textAlign:"center",padding:"60px 20px",color:C.dim}}>
                        <div style={{fontSize:32,marginBottom:12}}>📭</div>
                        <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:C.text}}>No deals match these filters</div>
                        <button onClick={()=>{setFilterRegion("All");setFilterQ("Q1 FY26");}} style={{color:C.accent,background:"none",border:`1px solid ${C.accent}`,borderRadius:5,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>Reset filters</button>
                      </div>
                    )}

                    {OUTCOMES.map(stage=>{
                      const sd=visibleDeals.filter(d=>d.outcome===stage);
                      if(!sd.length) return null;
                      const sv=sd.reduce((s,d)=>s+d.amount,0);
                      const prob=STAGE_PROB[stage];
                      return (
                        <div key={stage} style={{marginBottom:18}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                            <span className="pill sans" style={{background:`${oColor(stage)}22`,color:oColor(stage),fontSize:12,fontWeight:700,padding:"3px 10px"}}>{stage}</span>
                            <span style={{color:C.dim,fontSize:11}}>{sd.length} deal{sd.length!==1?"s":""} · {fmtR(sv)}</span>
                            <span style={{color:C.muted,fontSize:11}}>weighted {fmtR(sv*prob/100)} ({prob}%)</span>
                          </div>
                          <div className="card" style={{overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>
                                <th>Client</th><th>Rep</th><th>Amount</th><th>Idle</th>
                                <th style={{color:C.orange}}>Awaiting</th>
                                <th>Next Step</th><th>Stage</th>
                              </tr></thead>
                              <tbody>
                                {sd.sort((a,b)=>b.amount-a.amount).map(d=>{
                                  const rep=reps.find(r=>r.id===d.repId);
                                  const idle=daysSince(d.lastContact);
                                  const dw=d.awaitingApproval&&d.awaitingApprovalSince?daysSince(d.awaitingApprovalSince):0;
                                  const ov=d.awaitingApproval&&dw>=APPROVAL_SLA_DAYS;
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                                      onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                      onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                      <td style={{color:C.dim,fontSize:11}}>{rep?.name}</td>
                                      <td style={{fontWeight:700}}>{fmtR(d.amount)}</td>
                                      <td style={{color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11}}>{idle===0?"Today":`${idle}d`}</td>
                                      <td>{d.awaitingApproval?<span style={{background:ov?`${C.red}22`:`${C.orange}22`,color:ov?C.red:C.orange,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{d.awaitingApproval} {dw>0?`${dw}d`:""}</span>:<span style={{color:C.muted,fontSize:10}}>—</span>}</td>
                                      <td style={{fontSize:11,color:C.dim,maxWidth:180}}>{d.nextStep||"—"}</td>
                                      <td>
                                        <span style={{padding:"2px 8px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{d.outcome}</span>
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

                {/* ── REVENUE REPORT TAB — from revenue_entries only ── */}
                {rtTab==="revenue-report" && (()=>{
                  const visibleEntries = revenueEntries.filter(e =>
                    !e.isReversed && !e.reversalOf && visibleRepIdsSet.has(e.repId)
                  );
                  const totalRev = visibleEntries.reduce((s, e) => s + (e.amount||0), 0);

                  const byMonth: Record<string,number> = {};
                  visibleEntries.forEach(e => {
                    const ym = (e.date||e.createdAt||"").slice(0,7) || "Unknown";
                    byMonth[ym] = (byMonth[ym]||0) + (e.amount||0);
                  });
                  const monthRows = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0]));

                  const byClient: Record<string,number> = {};
                  visibleEntries.forEach(e => { const k=e.clientCompany||"Unknown"; byClient[k]=(byClient[k]||0)+(e.amount||0); });
                  const clientRows = Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,20);

                  const byChannel: Record<string,number> = {};
                  visibleEntries.forEach(e => { const k=e.dealType||e.channel||"Other"; byChannel[k]=(byChannel[k]||0)+(e.amount||0); });
                  const channelRows = Object.entries(byChannel).sort((a,b)=>b[1]-a[1]);

                  const byRegion: Record<string,number> = {};
                  visibleEntries.forEach(e => { const rep=reps.find(r=>r.id===e.repId); const k=rep?.region||e.region||"Unknown"; byRegion[k]=(byRegion[k]||0)+(e.amount||0); });
                  const regionRows = Object.entries(byRegion).sort((a,b)=>b[1]-a[1]);

                  const RevTbl = ({rows, col1}:{rows:[string,number][], col1:string}) => (
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{col1}</th>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"right",borderBottom:`1px solid ${C.border}`,width:140}}>Revenue</th>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"right",borderBottom:`1px solid ${C.border}`,width:80}}>Share</th>
                        </tr></thead>
                        <tbody>
                          {rows.map(([k,v])=>(
                            <tr key={k} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={e=>e.currentTarget.style.background=C.s2}
                              onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"8px 14px",fontWeight:600,color:C.text}}>{k}</td>
                              <td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:C.green}}>{fmtR(v)}</td>
                              <td style={{padding:"8px 14px",textAlign:"right",color:C.dim,fontSize:11}}>{totalRev>0?`${Math.round((v/totalRev)*100)}%`:"—"}</td>
                            </tr>
                          ))}
                          {rows.length===0&&<tr><td colSpan={3} style={{padding:"20px",color:C.muted,textAlign:"center",fontSize:11}}>No revenue entries yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  );

                  return (
                    <div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 20px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Total Revenue — All Entries</div>
                          <div className="sans" style={{fontSize:24,fontWeight:800,color:C.green}}>{fmtR(totalRev)}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:10,color:C.dim}}>{visibleEntries.length} entr{visibleEntries.length===1?"y":"ies"}</div>
                          <div style={{fontSize:10,color:C.muted,marginTop:2}}>Revenue entries only · Reversals excluded</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Month-wise</div>
                          <RevTbl rows={monthRows} col1="Month" />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Channel-wise</div>
                          <RevTbl rows={channelRows} col1="Channel" />
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Client-wise (Top 20)</div>
                          <RevTbl rows={clientRows} col1="Client" />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Region-wise</div>
                          <RevTbl rows={regionRows} col1="Region" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
          )}
    </>
  );
}
