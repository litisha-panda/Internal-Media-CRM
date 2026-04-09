import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  USER_ROLES,
  TASK_STATUSES,
  OUTCOMES,
} from "../../constants";
import ZohoSearchInput from "../../components/ZohoSearchInput";

interface NSHViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  isMobile: boolean;
  nshRHDrill: string | null;
  setNshRHDrill: React.Dispatch<React.SetStateAction<string | null>>;
  nshRegion: string;
  setNshRegion: React.Dispatch<React.SetStateAction<string>>;
  targetDrilldown: { key: string; label: string } | null;
  setTargetDrilldown: React.Dispatch<React.SetStateAction<{ key: string; label: string } | null>>;
  nshRepDrill: string | null;
  setNshRepDrill: React.Dispatch<React.SetStateAction<string | null>>;
}

export function NSHView({
  view, setView, isMobile,
  nshRHDrill, setNshRHDrill,
  nshRegion, setNshRegion,
  targetDrilldown, setTargetDrilldown,
  nshRepDrill, setNshRepDrill,
}: NSHViewProps) {
  const {
    deals,
    meetings,
    tasks,
    setTasks,
    revenueEntries,
    reps,
    absenceReports,
    weeklyPlans,
    isStrategy,
    isNSHDashboard,
    filterQ,
    qMatch,
    fmtR,
    daysSince,
    oColor,
    setTaskModal,
    setAccountThreadOpen,
    setAccountThreadClient,
    REGIONS,
    C,
    TODAY,
    TOMORROW,
  } = useCROAppContext();
  return (
    <>
          {/* ══════════════ STRATEGY VIEWS ══════════════ */}
          {view==="strategy-analytics" && isStrategy && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter));
            const closed=allD.filter(d=>d.outcome==="Mail Confirmed");
            const open=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome));
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totP=open.reduce((s,d)=>s+(d.amount||0),0);
            const dealTypes=[...new Set(allD.map(d=>d.dealType).filter(Boolean))];
            const typeStats=dealTypes.map(t=>{const td=allD.filter(d=>d.dealType===t);const tdRepIds=new Set(td.map(d=>d.repId));const tClosed=revenueEntries.filter(e=>tdRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);const tPipe=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);const pct=tT>0?Math.round((tClosed/tT)*100):0;return{t,count:td.length,tClosed,tPipe,tT,pct};}).sort((a,b)=>b.tT-a.tT);
            const stageFunnel=OUTCOMES.map(stage=>{const sd=allD.filter(d=>d.outcome===stage);return{stage,count:sd.length,value:sd.reduce((s,d)=>s+(d.amount||0),0)};}).filter(s=>s.count>0);
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ANALYTICS DASHBOARD</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · Pipeline intelligence</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[{l:"TOTAL TARGET",v:fmtR(totT),c:C.dim},{l:"CLOSED",v:fmtR(totC),c:C.green},{l:"IN PIPELINE",v:fmtR(totP),c:C.accent},{l:"WIN RATE",v:`${allD.length>0?Math.round((closed.length/allD.length)*100):0}%`,c:C.blue}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Deal Type Mix</div>
                  {typeStats.map(({t,count,tClosed,tPipe,tT,pct})=>{const sc=pct>=80?C.green:pct>=40?C.accent:C.red;return(<div key={t} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.s2}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontWeight:600,fontSize:12}}>{t||"Unspecified"}</span><span style={{fontSize:10,color:C.dim}}>{count} deals</span></div><div style={{display:"flex",gap:12,marginBottom:4}}><span style={{fontSize:10,color:C.green}}>{fmtR(tClosed)} closed</span><span style={{fontSize:10,color:C.accent}}>{fmtR(tPipe)} pipe</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:sc}} /></div><span style={{fontSize:10,fontWeight:700,color:sc,minWidth:28}}>{pct}%</span></div></div>);})}
                  {typeStats.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"20px 0"}}>No deals yet</div>}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Pipeline Funnel</div>
                  {stageFunnel.map(({stage,count,value})=>{const maxCount=Math.max(...stageFunnel.map(s=>s.count),1);return(<div key={stage} style={{marginBottom:8,display:"flex",alignItems:"center",gap:10}}><div style={{width:140,fontSize:10,color:C.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{stage}</div><div style={{flex:1,height:16,background:C.s2,borderRadius:3,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.round((count/maxCount)*100)}%`,background:`${oColor(stage)}44`}} /><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",paddingLeft:6,fontSize:9,fontWeight:600,color:oColor(stage)}}>{count} deal{count!==1?"s":""} · {fmtR(value)}</div></div></div>);})}
                </div>
              </div>
            </div>);
          })()}

          {view==="strategy-whitespace" && isStrategy && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter));
            const highValueStalled=allD.filter(d=>d.targetAmount>=5000000&&daysSince(d.lastContact)>=14&&d.outcome!=="Mail Confirmed");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WHITESPACE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>High-value accounts with no recent activity</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{l:"NO CONTACT 30D+",v:allD.filter(d=>daysSince(d.lastContact)>=30&&d.outcome!=="Mail Confirmed").length,c:C.red},{l:"HIGH-VALUE STALLED",v:highValueStalled.length,c:C.orange},{l:"VALUE AT RISK",v:fmtR(highValueStalled.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Target","Last Contact","Days Idle","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{[...highValueStalled].sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact)).map(d=>{const rep=reps.find(r=>String(r.id)===String(d.repId));const idle=daysSince(d.lastContact);return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}><td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{d.lastContact||"Never"}</td><td style={{padding:"10px 14px",color:idle>=30?C.red:idle>=14?C.orange:C.dim,fontWeight:700}}>{idle}d</td><td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td></tr>);})} {highValueStalled.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No stalled high-value accounts!</td></tr>}</tbody></table></div>
            </div>);
          })()}

          {/* ════════════════════════════════════════════
              NSH VIEWS
          ════════════════════════════════════════════ */}

          {/* ═══ NSH MY PLAN (read-only for CRO / Strategy) ═══ */}
          {view==="nsh-myplan" && isNSHDashboard && (()=>{
            const nshPlansToday  = (weeklyPlans||[]).filter(p=>(!p.repId)&&p.date===TODAY);
            const nshPlansTmrw   = (weeklyPlans||[]).filter(p=>(!p.repId)&&p.date===TOMORROW);
            const nshMeetings    = (meetings||[]).filter(m=>!m.repId).slice().sort((a,b)=>b.date?.localeCompare(a.date||"")||0);
            const recentMonths   = [...new Set(nshMeetings.map(m=>m.date?.slice(0,7)))].sort().reverse().slice(0,4);

            const allToday  = (weeklyPlans||[]).filter(p=>p.date===TODAY);
            const allTmrw   = (weeklyPlans||[]).filter(p=>p.date===TOMORROW);
            const totalMeetings = (meetings||[]).length;

            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>NSH'S PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:20}}>National Sales Head planned meetings — read-only view</div>

                {/* Summary stat cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {[
                    {label:"NSH Planned Today",   val:nshPlansToday.length,  color:C.accent},
                    {label:"NSH Planned Tomorrow", val:nshPlansTmrw.length,   color:C.blue},
                    {label:"Org-wide Today",       val:allToday.length,       color:C.green},
                    {label:"Total Org Meetings",   val:totalMeetings,         color:C.orange},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color}}>{val}</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:4}}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* NSH Today and Tomorrow */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  {[{label:"TODAY",list:nshPlansToday},{label:"TOMORROW",list:nshPlansTmrw}].map(({label,list})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{background:C.s2,padding:"8px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{label}</span>
                        <span style={{fontSize:11,color:C.accent,fontWeight:700}}>{list.length} meetings</span>
                      </div>
                      <div style={{padding:12,minHeight:60}}>
                        {list.length===0&&<div style={{textAlign:"center",fontSize:11,color:C.muted,padding:"18px 0"}}>Nothing planned by NSH</div>}
                        {list.map(p=>(
                          <div key={p.id} style={{padding:"8px 10px",background:C.s2,borderRadius:6,marginBottom:6,borderLeft:`3px solid ${C.accent}`}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.clientAgencyName}</div>
                            <div style={{fontSize:10,color:C.dim,marginTop:2}}>{p.time||"—"} · {p.pitchType||"Meeting"} · {p.meetingType||"Physical"}</div>
                            {p.agenda&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{p.agenda}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* NSH Recent Meeting History */}
                <div style={{height:1,background:C.border,marginBottom:16}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:12}}>NSH MEETING HISTORY</div>
                {recentMonths.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:11,padding:40}}>No meetings logged by NSH yet.</div>}
                {recentMonths.map(ym=>{
                  const ms = nshMeetings.filter(m=>m.date?.startsWith(ym));
                  const [yr,mo] = ym.split("-");
                  const label = new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
                  return (
                    <div key={ym} style={{marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"5px 10px",background:C.s2,borderRadius:5,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:12}}>{label}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{ms.length} meetings</span>
                      </div>
                      {ms.map(m=>(
                        <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,marginBottom:5}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{m.clientCompany}</div>
                            <div style={{fontSize:10,color:C.dim,marginTop:2}}>{m.date} · {m.pitchType||"—"}</div>
                            {m.discussion&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{m.discussion}</div>}
                          </div>
                          <span style={{background:m.outcome==="Mail Confirmed"?`${C.green}22`:`${C.blue}18`,color:m.outcome==="Mail Confirmed"?C.green:C.blue,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{m.outcome||m.status}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH PLAN ═══ */}
          {view==="nsh-rh-plan" && isNSHDashboard && (()=>{
            const regions = REGIONS;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>REGION HEADS' PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Today and tomorrow — region by region</div>

                {/* Two-column: today left, tomorrow right */}
                {regions.map(region=>{
                  const rReps   = reps.filter(r=>r.region===region).map(r=>r.id);
                  const todayP  = (weeklyPlans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TODAY);
                  const tmrwP   = (weeklyPlans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TOMORROW);
                  if (!todayP.length && !tmrwP.length) return null;
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      {/* Region label */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{reps.filter(r=>r.region===region).length} reps</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{todayP.length} today · {tmrwP.length} tomorrow</span>
                      </div>
                      {/* Two halves */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        {[{label:"TODAY",list:todayP},{label:"TOMORROW",list:tmrwP}].map(({label,list})=>(
                          <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                            <div style={{background:C.s2,padding:"6px 12px",borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{label} · {list.length} meetings</div>
                            <div style={{padding:"8px 12px",minHeight:50}}>
                              {list.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"10px 0"}}>Nothing planned</div>}
                              {list.map(p=>{
                                const rep=reps.find(r=>String(r.id)===String(p.repId));
                                return (
                                  <div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:7,paddingBottom:7,borderBottom:`1px solid ${C.s2}`}}>
                                    <div style={{width:20,height:20,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.clientAgencyName}</div>
                                      <div style={{fontSize:10,color:C.dim}}>{rep?.name} · {p.time||"—"}</div>
                                      {p.agenda&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{p.agenda}</div>}
                                    </div>
                                    {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.pitchType}</span>}
                                    <span style={{background:p.status==="Done"?`${C.green}22`:`${C.blue}18`,color:p.status==="Done"?C.green:C.blue,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.status}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH REGIONAL PLAN ═══ */}
          {view==="nsh-regional-plan" && isNSHDashboard && (()=>{
            const regions = REGIONS;
            const [selRegion, setSelRegion] = [nshRegion, setNshRegion];
            const displayRegions = selRegion==="all" ? regions : [selRegion];
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>SALES REPS' PLAN</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Today's client meetings · region by region</div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {["all",...regions].map(r=>(
                      <button key={r} onClick={()=>setSelRegion(r)}
                        style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${selRegion===r?C.accent:C.border}`,background:selRegion===r?`${C.accent}18`:"transparent",color:selRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                        {r==="all"?"All":r}
                      </button>
                    ))}
                  </div>
                </div>

                {displayRegions.map(region=>{
                  const rReps = reps.filter(r=>r.region===region);
                  const rRepIds = rReps.map(r=>String(r.id));
                  // Get today's deals with weeklyPlans logged
                  const regionDeals = deals.filter(d=>d.region===region&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
                  const todayMtgs   = meetings.filter(m=>reps.find(r=>String(r.id)===String(m.repId)&&r.region===region)&&m.date===TODAY);
                  const todayPlanned= (weeklyPlans||[]).filter(p=>rRepIds.includes(String(p.repId))&&p.date===TODAY);
                  const tmrwPlanned = (weeklyPlans||[]).filter(p=>rRepIds.includes(p.repId)&&p.date===TOMORROW);
                  return (
                    <div key={region} style={{marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 14px",background:C.s2,borderRadius:7,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{rReps.length} reps · {todayPlanned.length} today · {tmrwPlanned.length} tomorrow</span>
                        <span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:600}}>
                          {fmtR(revenueEntries.filter(e=>rRepIds.includes(String(e.repId))&&qMatch(e.quarter||"")).reduce((s,e)=>s+(e.amount||0),0))} closed
                        </span>
                      </div>

                      {/* Client-centric table for region */}
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>
                            {["Client","Rep","Last Meeting","Meeting Status","Next Step","Pipeline Stage"].map(h=>(
                              <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {regionDeals.length===0&&<tr><td colSpan={6} style={{padding:20,textAlign:"center",color:C.muted,fontSize:11}}>No deals for {region} in {filterQ}</td></tr>}
                            {regionDeals.sort((a,b)=>b.amount-a.amount).map(d=>{
                              const rep  = reps.find(r=>String(r.id)===String(d.repId));
                              const lastM= meetings.filter(m=>String(m.repId)===String(d.repId)&&(m.clientCompany||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5))).sort((a,b)=>b.date>a.date?1:-1)[0];
                              const todayHasMeeting = todayPlanned.some(p=>String(p.repId)===String(d.repId)&&(p.clientAgencyName||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5)));
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:todayHasMeeting?`${C.green}04`:"transparent"}}
                                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                  onMouseOut={e=>e.currentTarget.style.background=todayHasMeeting?`${C.green}04`:"transparent"}>
                                  <td style={{padding:"9px 12px"}}>
                                    <div style={{fontWeight:700}}>{d.clientCompany}</div>
                                    {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                                    {todayHasMeeting&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>Meeting today</span>}
                                  </td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{lastM?lastM.date:"No meeting yet"}</td>
                                  <td style={{padding:"9px 12px"}}>{lastM?.status?<span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{lastM.status}</span>:<span style={{color:C.muted}}>—</span>}</td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                                  <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Tomorrow's planned meetings for this region */}
                      {tmrwPlanned.length>0&&(
                        <div style={{marginTop:8,background:C.surface,border:`1px solid ${C.accent}33`,borderRadius:7,overflow:"hidden"}}>
                          <div style={{padding:"6px 12px",background:`${C.accent}08`,borderBottom:`1px solid ${C.accent}22`,fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>
                            TOMORROW's PLANNED MEETINGS · {tmrwPlanned.length}
                          </div>
                          <div style={{padding:"8px 12px",display:"flex",flexWrap:"wrap",gap:6}}>
                            {tmrwPlanned.map(p=>{
                              const rep=reps.find(r=>String(r.id)===String(p.repId));
                              return (
                                <div key={p.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 10px",fontSize:11}}>
                                  <span style={{fontWeight:600}}>{p.clientAgencyName}</span>
                                  <span style={{color:C.dim}}> · {rep?.name}</span>
                                  {p.time&&<span style={{color:C.muted}}> @ {p.time}</span>}
                                  {p.pitchType&&<span style={{marginLeft:4,background:`${C.accent}18`,color:C.accent,padding:"0px 5px",borderRadius:3,fontSize:9,fontWeight:600}}>{p.pitchType}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH SCORECARD ═══ */}
          {view==="nsh-rh-scorecard" && isNSHDashboard && (()=>{
            const RH_USERS=USER_ROLES.filter(u=>u.role==="REGION HEAD");
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>REGION HEAD SCORECARD</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{filterQ} · How each region is performing</div>
                {RH_USERS.map((rhu,rank)=>{
                  const rd=deals.filter(d=>d.region===rhu.region&&qMatch(d.quarter));
                  const rhRepIdSet=new Set(rd.map(d=>d.repId));
                  const rC=revenueEntries.filter(e=>rhRepIdSet.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver=rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed").length;
                  const rBlocked=rd.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed").length;
                  const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const rankColor=rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rhu.id} className="card" style={{padding:16,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:15,fontWeight:700}}>{rhu.region} Region</span>
                            <span style={{fontSize:11,color:C.dim}}>{reps.filter(r=>r.region===rhu.region).length} reps · {rd.length} deals</span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["AT RISK",rRisk,rRisk>0?C.red:C.green]].map(([l,v,c]: [any,any,any])=>(
                              <div key={l} style={{background:C.s2,borderRadius:5,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".06em",marginBottom:2}}>{l}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rRisk} at risk</span>}
                            {rOver>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rOver} overdue</span>}
                            {rBlocked>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rBlocked} awaiting approval</span>}
                            {rRisk===0&&rOver===0&&<span style={{background:`${C.green}18`,color:C.green,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>✓ On track</span>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:56}}><div className="sans" style={{fontSize:32,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH PIPELINE ═══ */}
          {view==="nsh-rh-pipeline" && isNSHDashboard && (()=>{
            const regions=REGIONS;
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Pipeline grouped by region · {filterQ}</div></div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setNshRHDrill(null)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${!nshRHDrill?C.accent:C.border}`,background:!nshRHDrill?`${C.accent}18`:"transparent",color:!nshRHDrill?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>All Regions</button>
                    {regions.map(r=><button key={r} onClick={()=>setNshRHDrill(r)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${nshRHDrill===r?C.accent:C.border}`,background:nshRHDrill===r?`${C.accent}18`:"transparent",color:nshRHDrill===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r}</button>)}
                  </div>
                </div>
                {(nshRHDrill?[nshRHDrill]:regions).map(region=>{
                  const rd=deals.filter(d=>d.region===region&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
                  const blocked=rd.filter(d=>d.awaitingApproval);
                  const rdRepIds2=new Set(rd.map(d=>d.repId));
                  const rdClosed=revenueEntries.filter(e=>rdRepIds2.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:11,color:C.dim}}>{rd.length} deals</span>
                        <span style={{color:C.green,fontWeight:600,fontSize:11,marginLeft:"auto"}}>{fmtR(rdClosed)} closed</span>
                        <span style={{color:C.accent,fontSize:11}}>{fmtR(rd.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+d.amount,0))} pipeline</span>
                        {blocked.length>0&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{blocked.length} blocked</span>}
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Rep","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {rd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=reps.find(r=>String(r.id)===String(d.repId));return(
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"8px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                <td style={{padding:"8px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                <td style={{padding:"8px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                <td style={{padding:"8px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                                <td style={{padding:"8px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            );})}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH TARGETS ═══ */}
          {view==="nsh-rh-targets" && isNSHDashboard && (()=>{
            const regions=REGIONS;
            const totT=deals.filter(d=>qMatch(d.quarter)).reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totPct=totT>0?Math.round((totC/totT)*100):0;
            const tsc=totPct>=80?C.green:totPct>=50?C.accent:C.red;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RH TARGETS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>{filterQ} · Region-wise performance</div>
                <div style={{background:C.surface,border:`2px solid ${tsc}`,borderRadius:10,padding:"16px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>National Total</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                    {[["TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["ACHIEVEMENT",`${totPct}%`,tsc]].map(([l,v,c]: [any,any,any])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:tsc,lineHeight:1}}>{totPct}%</div></div>
                  </div>
                  <div style={{marginTop:10,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(totPct,100)}%`,background:tsc}} /></div>
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Region","Target","Closed","Pipeline","Achieve %","Reps","At Risk"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>{regions.map(region=>{
                      const rd=deals.filter(d=>d.region===region&&qMatch(d.quarter));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rRegionRepIds=new Set(rd.map(d=>d.repId));
                      const rC=revenueEntries.filter(e=>rRegionRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                      const nReps=reps.filter(r=>r.region===region).length;
                      const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return(<tr key={region} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{region}</div></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(rT)}</td>
                        <td style={{padding:"10px 14px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                        <td style={{padding:"10px 14px",color:C.accent}}>{fmtR(rP)}</td>
                        <td style={{padding:"10px 14px"}}><span style={{color:sc,fontWeight:700,fontSize:13}}>{rPct}%</span></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{nReps}</td>
                        <td style={{padding:"10px 14px"}}>{rRisk>0?<span style={{color:C.red,fontWeight:700}}>{rRisk} ⚠</span>:<span style={{color:C.green}}>✓</span>}</td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH RH TASKS ═══ */}
          {view==="nsh-rh-tasks" && isNSHDashboard && (()=>{
            const rhTasks=tasks.filter(t=>t.dept==="NSH"||t.assignedToUserId?.startsWith("rh_"));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Tasks assigned to / escalated from Region Heads</div></div>
                  <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Assign to RH</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"OPEN",v:rhTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:rhTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:rhTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:rhTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {rhTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No RH tasks yet.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Task","Client","Region","Priority","Status","Due","Update"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{rhTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>String(r.id)===String(t.repId));const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(t.clientCompany||"")
;setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?reps.find(r=>r.id===rep.id)?.region:"—"}</td>
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

          {/* ═══ NSH RH HR ═══ */}
          {view==="nsh-rh-hr" && isNSHDashboard && (()=>{
            const REGIONS = ["North","South","East","West","National"];
            const rhUsers = USER_ROLES.filter(u=>u.role==="REGION HEAD");
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RH'S HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Absence summary per Region Head's team · all regions</div>

                {/* Region summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
                  {REGIONS.map(reg=>{
                    const rh   = rhUsers.find(u=>u.region===reg);
                    const regReps = reps.filter(r=>r.region===reg);
                    const rAbs = absenceReports.filter(a=>regReps.map(r=>r.id).includes(a.repId));
                    const absent = rAbs.filter(a=>a.markedAs==="Absent").length;
                    const exc    = rAbs.filter(a=>a.exception==="Overridden").length;
                    return (
                      <div key={reg} style={{background:C.surface,border:`1px solid ${absent>0?C.red:C.border}`,borderTop:`2px solid ${absent>0?C.red:C.green}`,borderRadius:8,padding:"12px 14px"}}>
                        <div className="sans" style={{fontWeight:700,fontSize:13,marginBottom:2}}>{reg}</div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:8}}>{rh?.name||"RH"} · {regReps.length} reps</div>
                        <div style={{fontSize:10,color:C.red,fontWeight:700}}>{absent} absent</div>
                        <div style={{fontSize:10,color:C.green}}>{exc} exception{exc!==1?"s":""}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-region breakdown */}
                {REGIONS.map(reg=>{
                  const regReps = reps.filter(r=>r.region===reg);
                  const rAbs = absenceReports.filter(a=>regReps.map(r=>r.id).includes(a.repId));
                  if (!rAbs.length) return null;
                  const rh = rhUsers.find(u=>u.region===reg);
                  return (
                    <div key={reg} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{reg}</span>
                        <span style={{fontSize:10,color:C.dim}}>RH: {rh?.name||"—"}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{rAbs.length} records · {rAbs.filter(a=>a.markedAs==="Absent").length} absent</span>
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Rep","Date","Status","Exception"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{rAbs.map(r=>(
                            <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}  onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"8px 12px",fontWeight:600}}>{r.repName}</td>
                              <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                              <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                              <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>Overridden · {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {absenceReports.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted,fontSize:12}}>No absence records across all regions.</div>}
              </div>
            );
          })()}

          {/* ═══ NSH REP SCORECARD ═══ */}
          {view==="nsh-rep-scorecard" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const filterDeals=nshRegion==="all"?deals.filter(d=>qMatch(d.quarter)):deals.filter(d=>d.region===nshRegion&&qMatch(d.quarter));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP SCORECARD</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All reps · {filterQ}</div></div>
                  <div style={{display:"flex",gap:6}}>
                    {regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"capitalize"}}>{r==="all"?"All":r}</button>)}
                  </div>
                </div>
                {reps.filter(r=>nshRegion==="all"||r.region===nshRegion).map((rep,rank)=>{
                  const rd=filterDeals.filter(d=>String(d.repId)===String(rep.id));
                  const rC=revenueEntries.filter(e=>String(e.repId)===String(rep.id)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const tL=meetings.some(m=>String(m.repId)===String(rep.id)&&m.date===TODAY);
                  const tP=(weeklyPlans||[]).some(p=>String(p.repId)===String(rep.id)&&p.date===TOMORROW);
                  const rankColor=rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rep.id} className="card" style={{padding:14,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:26,height:26,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:14,fontWeight:700}}>{rep.name}</span>
                            <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{rep.region}</span>
                            <span style={{background:tL?`${C.green}18`:`${C.red}18`,color:tL?C.green:C.red,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{tL?"✓ Logged":"✗ Not logged"}</span>
                            <span style={{background:tP?`${C.green}18`:`${C.orange}18`,color:tP?C.green:C.orange,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{tP?"✓ Planned":"✗ Not planned"}</span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:6}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["AT RISK",rRisk,rRisk>0?C.red:C.green]].map(([l,v,c]: [any,any,any])=>(
                              <div key={l} style={{background:C.s2,borderRadius:4,padding:"6px 8px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".05em",marginBottom:1}}>{l}</div>
                                <div className="sans" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600,marginRight:6}}>{rRisk} at risk</span>}
                        </div>
                        <div style={{textAlign:"right",minWidth:50}}><div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH REP PIPELINE ═══ */}
          {view==="nsh-rep-pipeline" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fd=nshRegion==="all"?deals.filter(d=>qMatch(d.quarter)&&d.outcome!=="Not Interested"):deals.filter(d=>d.region===nshRegion&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep deals · {filterQ}</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div className="card" style={{overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Client","Rep","Region","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {fd.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No deals found</td></tr>}
                      {fd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=reps.find(r=>String(r.id)===String(d.repId));return(
                        <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.region}</span></td>
                          <td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                          <td style={{padding:"9px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH REP TARGETS ═══ */}
          {view==="nsh-rep-targets" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fReps=nshRegion==="all"?reps:reps.filter(r=>r.region===nshRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP TARGETS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Individual targets · {filterQ}</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Region","Target","Closed","Pipeline","Shortfall","Achieve %"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>{fReps.map(rep=>{
                      const rd=deals.filter(d=>String(d.repId)===String(rep.id)&&qMatch(d.quarter));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>String(e.repId)===String(rep.id)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rG=Math.max(0,rT-rC);const rPct=rT>0?Math.round((rC/rT)*100):0;const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (<tr key={rep.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}  onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"10px 14px"}}><div style={{fontWeight:700}}>{rep.name}</div></td>
                        <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{rep.region}</span></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(rT)}</td>
                        <td style={{padding:"10px 14px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                        <td style={{padding:"10px 14px",color:C.accent}}>{fmtR(rP)}</td>
                        <td style={{padding:"10px 14px",color:rG===0?C.green:C.red,fontWeight:600}}>{rG===0?"✓":fmtR(rG)}</td>
                        <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,background:C.s3,borderRadius:3,overflow:"hidden",minWidth:60}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:sc}} /></div><span style={{color:sc,fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>{rPct}%</span></div></td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH REP TASKS ═══ */}
          {view==="nsh-rep-tasks" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fReps=nshRegion==="all"?reps.map(r=>r.id):reps.filter(r=>r.region===nshRegion).map(r=>r.id);
            const fTasks=tasks.filter(t=>fReps.includes(t.repId));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep tasks</div></div>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}
                    <button className="btn btn-primary" onClick={()=>setTaskModal(true)} style={{marginLeft:6}}>+ Assign Task</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                  {[{l:"OPEN",v:fTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:fTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:fTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:fTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {fTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No tasks found</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Region","Task","Client","Priority","Status","Due"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{fTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>String(r.id)===String(t.repId));const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(t.clientCompany||"")
;setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"8px 12px",fontWeight:600,fontSize:11}}>{rep?.name||"—"}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{rep?.region||"—"}</span></td>
                          <td style={{padding:"8px 12px"}}><div style={{fontWeight:600}}>{t.title}</div></td>
                          <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                          <td style={{padding:"8px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ NSH REP HR ═══ */}
          {view==="nsh-rep-hr" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fAbs=nshRegion==="all"?absenceReports:absenceReports.filter(r=>r.region===nshRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP HR REPORTS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep absence records</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[{l:"TOTAL ABSENCES",v:fAbs.filter(r=>r.markedAs==="Absent").length,c:C.red},{l:"EXCEPTIONS",v:fAbs.filter(r=>r.exception==="Overridden").length,c:C.orange},{l:"REPORTS SENT",v:fAbs.length,c:C.dim}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {fAbs.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No absence records</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Region","Date","Status","Exception"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{fAbs.map(r=>(
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}  onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"8px 12px",fontWeight:600}}>{r.repName}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region}</span></td>
                          <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                          <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception} · {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

    </>
  );
}
