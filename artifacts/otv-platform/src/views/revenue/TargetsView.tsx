import React, { useState, useRef } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";

interface TargetsViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  targetSubTab: string;
  setTargetSubTab: React.Dispatch<React.SetStateAction<string>>;
  editSubId: string | null;
  setEditSubId: React.Dispatch<React.SetStateAction<string | null>>;
  editSubClients: Record<string, any>[];
  setEditSubClients: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  planUploadOpen: boolean;
  setPlanUploadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  planUploadForm: Record<string, any>;
  setPlanUploadForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  newClients: Record<string, any>[];
  setNewClients: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  addClientModalOpen: boolean;
  setAddClientModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addClientForm: Record<string, any>;
  setAddClientForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  rhRepDrill: string | null;
  setRhRepDrill: React.Dispatch<React.SetStateAction<string | null>>;
  targetDrilldown: { key: string; label: string } | null;
  setTargetDrilldown: React.Dispatch<React.SetStateAction<{ key: string; label: string } | null>>;
  nshRepDrill: string | null;
  setNshRepDrill: React.Dispatch<React.SetStateAction<string | null>>;
}

export function TargetsView({
  view, setView,
  targetSubTab, setTargetSubTab,
  editSubId, setEditSubId,
  editSubClients, setEditSubClients,
  planUploadOpen, setPlanUploadOpen,
  planUploadForm, setPlanUploadForm,
  newClients, setNewClients,
  addClientModalOpen, setAddClientModalOpen,
  addClientForm, setAddClientForm,
  rhRepDrill, setRhRepDrill,
  targetDrilldown, setTargetDrilldown,
  nshRepDrill, setNshRepDrill,
}: TargetsViewProps) {
  const {
    deals,
    setDeals,
    targetSubs,
    setTargetSubs,
    revenueEntries,
    internalReqs,
    setInternalReqs,
    reps,
    user_role,
    isRep,
    isRH,
    isNSH,
    isCRORole,
    isStrategy,
    isAdmin,
    rhRegion,
    filterQ,
    entryQ,
    visibleDeals,
    qMatch,
    parseCurrency,
    fmtR,
    daysSince,
    dealStage,
    oColor,
    getAchieved,
    getCommitted,
    getInPlay,
    getShortfall,
    stackedBar,
    showToast,
    openAddDeal,
    setAccountThreadOpen,
    setAccountThreadClient,
    STAGE_PROB,
    C,
    TODAY,
  } = useCROAppContext();

  return (
    <>
          {/* ═══ RH TARGETS (Region Head) ═══ */}
          {view==="targets" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const rhDeals  = visibleDeals;
            const rhT = rhDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhRepIds_t = [...new Set(rhDeals.map(d=>d.repId))];
            const rhC = revenueEntries.filter(e=>rhRepIds_t.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const rhP = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct = rhT>0?Math.round((rhC/rhT)*100):0;
            const sc = rhPct>=80?C.green:rhPct>=50?C.accent:C.red;

            // All clients sorted by gap (biggest gap = least achieved vs target = top of list)
            const clientRows: any[] = (rhDeals as any[])
              .filter(d=>d.outcome!=="Not Interested")
              .map(d=>{
                const ach = revenueEntries.filter(e=>String(e.repId)===String(d.repId)&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const gap = Math.max(0,(d.targetAmount||0)-ach);
                const pct = d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                const rep = reps.find(r=>String(r.id)===String(d.repId));
                return {...d, ach, gap, pct, rep};
              })
              .sort((a,b)=>b.gap-a.gap); // worst gap first

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TARGETS — {rhRegion}</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · Region summary + client drill-down</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Client</button>
                </div>

                {/* 4 Summary stat cards — consistent with Sales Rep view */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {(()=>{
                    const sf = Math.max(0, rhT - rhC);
                    return [
                      {label:"TOTAL TARGET",  value:fmtR(rhT),   color:C.accent,  sub:rhRegion+" region"},
                      {label:"ACHIEVED",       value:fmtR(rhC),   color:C.green,   sub:"Closed deals"},
                      {label:"SHORTFALL",      value:fmtR(sf),    color:sf===0?C.green:C.red, sub:sf===0?"On target":"Gap to close"},
                      {label:"% COMPLETE",     value:`${rhPct}%`, color:sc,        sub:"vs target"},
                    ];
                  })().map(card=>(
                    <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                      <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:20}}>
                  <div style={{height:"100%",width:`${Math.min(rhPct,100)}%`,background:sc,borderRadius:3}}/>
                </div>

                {/* Client table — consistent columns with Sales Rep */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                  All Clients · Sorted by Shortfall (highest first)
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Client","Sales Rep","Deal Type","Target","Achieved","Shortfall","Stage"].map(h=>(
                        <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {clientRows.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>No deals for {filterQ} yet.</td></tr>}
                      {clientRows.map(d=>(
                        <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                          onMouseOver={e=>e.currentTarget.style.background=C.s2}
                          onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px 14px"}}>
                            <div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>
                            {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <div style={{fontWeight:600,fontSize:12}}>{d.rep?.name||"—"}</div>
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span>
                          </td>
                          <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                          <td style={{padding:"10px 14px",color:d.ach>0?C.green:C.muted,fontWeight:d.ach>0?700:400}}>
                            {d.ach>0?fmtR(d.ach):"—"}{d.ach>0&&<div style={{fontSize:9,color:C.dim}}>{d.pct}%</div>}
                          </td>
                          <td style={{padding:"10px 14px",color:d.gap===0?C.green:C.red,fontWeight:700}}>
                            {d.gap===0?"✓":fmtR(d.gap)}
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}


                    {/* ═══ TARGETS ═══ */}
          {view==="targets" && !isRH && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:8}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TARGETS vs ACHIEVEMENT</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.dim}}>Viewing as <span style={{color:C.accent}}>{user_role.name}</span></span>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Client</button>
                </div>
              </div>

              {isRep ? (() => {
                const myRepId = user_role?.repId;
                const myDeals = deals.filter(d=>String(d.repId)===String(myRepId)&&qMatch(d.quarter));
                const mT=myDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                // Part 5: 4-number dashboard
                const mC=getAchieved(myRepId);
                const mCommitted=getCommitted(myRepId);
                const mInPlay=getInPlay(myRepId);
                const mG=getShortfall(mT,myRepId);
                const mPct=mT>0?Math.round((mC/mT)*100):0;
                const sc=mPct>=100?C.green:mPct>=50?C.accent:C.red;
                return (
                  <div>
                    <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:12,textTransform:"uppercase"}}>My Targets · {filterQ}</div>
                      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(mT),C.text],["ACHIEVED",fmtR(mC),C.green],["COMMITTED",fmtR(mCommitted),C.blue],["IN PLAY",fmtR(mInPlay),C.accent],["SHORTFALL",fmtR(mG),mG===0?C.green:C.red]].map(([l,v,c])=>(
                          <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:c as string}}>{v}</div></div>
                        ))}
                        <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:48,fontWeight:800,color:sc,lineHeight:1}}>{mPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                      </div>
                      {stackedBar(mT, mC, mCommitted, mInPlay, mG)}
                    </div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {myDeals.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>No deals for {filterQ} yet.</td></tr>}
                          {myDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                            const ds=dealStage(d);
                            const ach=revenueEntries.filter(e=>e.clientCompany===d.clientCompany&&(isRep?String(e.repId)===String(myRepId):true)).reduce((s,e)=>s+(e.amount||0),0);
                            const pip=d.pipelineAmount||parseCurrency(d.amount||"0")||0;
                            const sf=Math.max(0,(d.targetAmount||0)-ach);
                            const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                            return (
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                <td style={{padding:"10px 14px",color:pip>0?C.accent:C.muted}}>{pip>0?fmtR(pip):"—"}</td>
                                <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(ds)}18`,color:oColor(ds),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{ds}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : isRH ? (()=>{
                // ── REGION HEAD TARGETS: rep-wise tiles → click → client list ──
                const myRegion = user_role?.region;
                const myReps   = reps.filter(r=>r.region===myRegion);
                if (rhRepDrill) {
                  // Client detail for selected rep
                  const repObj = reps.find(r=>r.id===rhRepDrill);
                  const repDeals = visibleDeals.filter(d=>String(d.repId)===String(rhRepDrill));
                  const rT=repDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  // Part 5: 4-number dashboard for rep drill
                  const rC=getAchieved(rhRepDrill);
                  const rCommitted=getCommitted(rhRepDrill);
                  const rInPlay=getInPlay(rhRepDrill);
                  const rG=getShortfall(rT,rhRepDrill);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const sc=rPct>=100?C.green:rPct>=50?C.accent:C.red;
                  return (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                        <button onClick={()=>setRhRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back to Reps</button>
                        <div className="sans" style={{fontSize:15,fontWeight:700}}>{repObj?.name}</div>
                        <div style={{fontSize:11,color:C.dim}}>{repObj?.region} · {repDeals.length} clients</div>
                      </div>
                      <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"14px 20px",marginBottom:16}}>
                        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                          {[["TARGET",fmtR(rT),C.text],["ACHIEVED",fmtR(rC),C.green],["COMMITTED",fmtR(rCommitted),C.blue],["IN PLAY",fmtR(rInPlay),C.accent],["SHORTFALL",fmtR(rG),rG===0?C.green:C.red]].map(([l,v,c])=>(
                            <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c as string}}>{v}</div></div>
                          ))}
                          <div style={{marginLeft:"auto"}}><div className="sans" style={{fontSize:40,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                        </div>
                        {stackedBar(rT, rC, rCommitted, rInPlay, rG, 10)}
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {repDeals.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No deals for {filterQ}.</td></tr>}
                            {repDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                              const ach=revenueEntries.filter(e=>String(e.repId)===String(d.repId)&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                              const pip=!["Mail Confirmed","Not Interested"].includes(d.outcome)?d.amount:0;
                              const sf=Math.max(0,(d.targetAmount||0)-ach);
                              const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                  <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                  <td style={{padding:"10px 14px",color:pip>0?C.accent:C.muted}}>{pip>0?fmtR(pip):"—"}</td>
                                  <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                // Rep tiles view
                const regionT=visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                const regionRepIds=new Set(myReps.map(r=>String(r.id)));
                const regionC=revenueEntries.filter(e=>regionRepIds.has(String(e.repId))&&qMatch(e.quarter||"")).reduce((s,e)=>s+(e.amount||0),0);
                const regionPct=regionT>0?Math.round((regionC/regionT)*100):0;
                const rsc=regionPct>=100?C.green:regionPct>=60?C.accent:C.red;
                return (
                  <div>
                    {/* Region summary tile */}
                    <div style={{background:C.surface,border:`2px solid ${rsc}`,borderRadius:10,padding:"16px 20px",marginBottom:18}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>{myRegion} Region · {filterQ}</div>
                      <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(regionT),C.text],["CLOSED",fmtR(regionC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),C.accent],["GAP",fmtR(Math.max(0,regionT-regionC)),regionT-regionC<=0?C.green:C.red]].map(([l,v,c])=>(
                          <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                        ))}
                        <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:rsc,lineHeight:1}}>{regionPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                      </div>
                      <div style={{marginTop:10,height:5,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(regionPct,100)}%`,background:rsc}} /></div>
                    </div>
                    {/* Rep tiles — click to drill down */}
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Your Sales Reps — click to view clients</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                      {myReps.map(rep=>{
                        const rd=visibleDeals.filter(d=>String(d.repId)===String(rep.id));
                        const rT2=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const rC2=revenueEntries.filter(e=>String(e.repId)===String(rep.id)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const rP2=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const rPct2=rT2>0?Math.round((rC2/rT2)*100):0;
                        const sc2=rPct2>=80?C.green:rPct2>=50?C.accent:C.red;
                        const rAtRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        return (
                          <div key={rep.id} onClick={()=>setRhRepDrill(String(rep.id))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}} onMouseOver={e=>{e.currentTarget.style.borderColor=sc2;e.currentTarget.style.transform="translateY(-2px)";}} onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                              <div>
                                <div className="sans" style={{fontWeight:700,fontSize:14,marginBottom:2}}>{rep.name}</div>
                                <div style={{fontSize:10,color:C.dim}}>{rep.role} · {rd.length} clients</div>
                              </div>
                              <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:26,fontWeight:800,color:sc2,lineHeight:1}}>{rPct2}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                              {[["Target",fmtR(rT2)],["Closed",fmtR(rC2)],["Pipeline",fmtR(rP2)],["Gap",fmtR(Math.max(0,rT2-rC2))]].map(([l,v])=>(
                                <div key={l} style={{background:C.s2,borderRadius:4,padding:"5px 8px"}}><div style={{fontSize:9,color:C.dim}}>{l}</div><div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:l==="Gap"?(rT2-rC2<=0?C.green:C.red):C.text}}>{v}</div></div>
                              ))}
                            </div>
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct2,100)}%`,background:sc2}} /></div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,alignItems:"center"}}>
                              {rAtRisk>0&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 6px",borderRadius:5,fontSize:9,fontWeight:700}}>{rAtRisk} at risk</span>}
                              <span style={{fontSize:9,color:C.dim,marginLeft:"auto"}}>View clients →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : (() => {
                const allD=deals.filter(d=>qMatch(d.quarter));
                const mT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                const mC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const mP=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const mW=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                const mF=mC+mW; const mG=Math.max(0,mT-mF);
                const mCP=mT>0?Math.round((mC/mT)*100):0; const mFP=mT>0?Math.round((mF/mT)*100):0;
                const sc=mFP>=100?C.green:mFP>=75?C.accent:C.red;
                const TILES=[
                  {key:"North",label:"North",icon:"↑",color:"#60a5fa"},
                  {key:"South",label:"South",icon:"↓",color:"#a855f7"},
                  {key:"West", label:"West", icon:"←",color:"#f97316"},
                  {key:"East", label:"East", icon:"→",color:"#16c784"},
                  {key:"Odisha",label:"Odisha",icon:"◈",color:"#f0a500"},
                  {key:"DigitalOnly",label:"Digital Only",icon:"◉",color:"#2d7dd2"},
                  {key:"DigitalTV",label:"Digital + TV",icon:"⬡",color:"#ea3943"},
                ];
                const getTileDeals=k=>{
                  if(k==="DigitalOnly") return allD.filter(d=>d.dealType==="Digital");
                  if(k==="DigitalTV")   return allD.filter(d=>["Digital","Linear TV","Integrated Packages","Media Solutions"].includes(d.dealType));
                  return allD.filter(d=>d.region===k);
                };
                return (
                  <div>
                    {/* ── OVERVIEW: only when no drilldown is active ── */}
                    {!targetDrilldown && <div>
                    {/* 4 Summary stat cards — consistent across all roles */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                      {[
                        {label:"TOTAL TARGET",value:fmtR(mT),  color:C.accent,  sub:"Organisation · "+filterQ},
                        {label:"ACHIEVED",    value:fmtR(mC),  color:C.green,   sub:"Closed deals"},
                        {label:"SHORTFALL",   value:fmtR(mG),  color:mG===0?C.green:C.red, sub:mG===0?"On target":"Gap to close"},
                        {label:"% COMPLETE",  value:`${mCP}%`, color:sc,        sub:`Forecast ${mFP}%`},
                      ].map(card=>(
                        <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",position:"relative",marginBottom:16}}>
                      <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(mCP,100)}%`,background:C.green,borderRadius:3}} />
                      <div style={{position:"absolute",left:`${mCP}%`,height:"100%",width:`${Math.min(mFP-mCP,100-mCP)}%`,background:`${C.accent}99`}} />
                    </div>
                    {/* Region tiles */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                      {TILES.map(tile=>{
                        const td=getTileDeals(tile.key);
                        const tRepIds=[...new Set(td.map(d=>d.repId))];
                        const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const tC=revenueEntries.filter(e=>tRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const tP=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const tW=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                        const tF=tC+tW; const tG=Math.max(0,tT-tF);
                        const tCP=tT>0?Math.round((tC/tT)*100):0; const tFP=tT>0?Math.round((tF/tT)*100):0;
                        const tc=tFP>=100?C.green:tFP>=75?C.accent:tFP>=50?tile.color:C.red;
                        const risk=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        return (
                          <div key={tile.key} onClick={()=>{setTargetDrilldown(tile);setNshRepDrill(null);}}
                            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}}
                            onMouseOver={e=>{e.currentTarget.style.borderColor=tile.color;e.currentTarget.style.transform="translateY(-2px)";}}
                            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:28,height:28,borderRadius:6,background:`${tile.color}22`,border:`1px solid ${tile.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:tile.color,fontWeight:700}}>{tile.icon}</div>
                                <div><div className="sans" style={{fontSize:13,fontWeight:700}}>{tile.label}</div><div style={{fontSize:10,color:C.dim}}>{td.length} deal{td.length!==1?"s":""}</div></div>
                              </div>
                              <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:20,fontWeight:800,color:tc}}>{tFP}%</div><div style={{fontSize:9,color:C.dim}}>forecast</div></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                              {[["Target",fmtR(tT)],[`Closed`,fmtR(tC)],["Pipeline",fmtR(tP)],["Gap",fmtR(tG)]].map(([l,v])=>(
                                <div key={l} style={{background:C.s2,borderRadius:4,padding:"6px 8px"}}>
                                  <div style={{fontSize:9,color:C.dim,letterSpacing:".05em"}}>{l}</div>
                                  <div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:l==="Gap"?(tG===0?C.green:C.red):C.text}}>{v}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(tCP,100)}%`,background:C.green}} />
                              <div style={{position:"absolute",left:`${tCP}%`,height:"100%",width:`${Math.min(tFP-tCP,100-tCP)}%`,background:`${tile.color}99`}} />
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                              {risk>0&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>{risk} at risk</span>}
                              <span style={{fontSize:9,color:C.dim,marginLeft:"auto"}}>View clients →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </div>}
                    {/* ── DRILLDOWN LEVEL 2: Rep → Client List ── */}
                    {targetDrilldown && nshRepDrill && (()=>{
                      const tile    = TILES.find(t=>t.key===targetDrilldown.key);
                      const repObj  = reps.find(r=>r.id===nshRepDrill);
                      const rd      = getTileDeals(targetDrilldown.key).filter(d=>String(d.repId)===String(nshRepDrill));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>String(e.repId)===String(nshRepDrill)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rG=Math.max(0,rT-rC);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rsc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (
                        <div style={{marginTop:16}}>
                          {/* Breadcrumb */}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                            <button onClick={()=>{setTargetDrilldown(null);setNshRepDrill(null);}} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← All Regions</button>
                            <button onClick={()=>setNshRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← {tile?.label} Reps</button>
                            <div className="sans" style={{fontSize:15,fontWeight:700}}>{repObj?.name}</div>
                            <div style={{fontSize:11,color:C.dim}}>{repObj?.region} · {rd.length} client{rd.length!==1?"s":""}</div>
                          </div>
                          {/* 4 stat cards */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[
                              {label:"TOTAL TARGET",value:fmtR(rT),  color:C.accent,  sub:repObj?.region},
                              {label:"ACHIEVED",    value:fmtR(rC),  color:C.green,   sub:"Closed deals"},
                              {label:"SHORTFALL",   value:fmtR(rG),  color:rG===0?C.green:C.red, sub:rG===0?"On target":"Gap to close"},
                              {label:"% COMPLETE",  value:`${rPct}%`,color:rsc,       sub:"vs target"},
                            ].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                                <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:14}}>
                            <div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:rsc,borderRadius:3}}/>
                          </div>
                          {/* Client table */}
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Client","Deal Type","Target","Achieved","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                              <tbody>
                                {rd.length===0&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.muted}}>No clients.</td></tr>}
                                {rd.sort((a,b)=>{
                                  const achA=revenueEntries.filter(e=>String(e.repId)===String(a.repId)&&e.clientCompany===a.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const achB=revenueEntries.filter(e=>String(e.repId)===String(b.repId)&&e.clientCompany===b.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  return Math.max(0,(b.targetAmount||0)-achB)-Math.max(0,(a.targetAmount||0)-achA);
                                }).map(d=>{
                                  const ach=revenueEntries.filter(e=>String(e.repId)===String(d.repId)&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const sf=Math.max(0,(d.targetAmount||0)-ach);
                                  const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td style={{padding:"10px 14px"}}>
                                        <div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>
                                        {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                                        {d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:5,fontSize:9,fontWeight:700,marginTop:2,display:"inline-block"}}>TOP 5</span>}
                                      </td>
                                      <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                      <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                      <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>
                                        {ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}
                                      </td>
                                      <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                      <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── DRILLDOWN LEVEL 1: Region → Rep Tiles ── */}
                    {targetDrilldown && !nshRepDrill && (() => {
                      const tile     = TILES.find(t=>t.key===targetDrilldown.key);
                      const td       = getTileDeals(targetDrilldown.key);
                      const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const tRepIds2=[...new Set(td.map(d=>d.repId))];
                      const tC=revenueEntries.filter(e=>tRepIds2.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const tG=Math.max(0,tT-tC);
                      const tPct=tT>0?Math.round((tC/tT)*100):0;
                      const tsc=tPct>=80?C.green:tPct>=50?C.accent:C.red;
                      // Geographic regions: drill to rep tiles; deal-type tiles: flat list
                      const isGeoTile = ["North","South","West","East","Odisha"].includes(targetDrilldown.key);
                      const regionReps = isGeoTile ? reps.filter(r=>r.region===targetDrilldown.key) : [];
                      return (
                        <div style={{marginTop:16}}>
                          {/* Back + header */}
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                            <button onClick={()=>{setTargetDrilldown(null);setNshRepDrill(null);}} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← All Regions</button>
                            <div style={{width:28,height:28,borderRadius:6,background:`${tile?.color}22`,border:`1px solid ${tile?.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:tile?.color,fontWeight:700}}>{tile?.icon}</div>
                            <div className="sans" style={{fontSize:15,fontWeight:700}}>{tile?.label}</div>
                            <div style={{fontSize:11,color:C.dim}}>{td.length} deal{td.length!==1?"s":""}</div>
                          </div>
                          {/* 4 stat cards for this region */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[
                              {label:"TOTAL TARGET",value:fmtR(tT),  color:C.accent,  sub:tile?.label+" region"},
                              {label:"ACHIEVED",    value:fmtR(tC),  color:C.green,   sub:"Closed deals"},
                              {label:"SHORTFALL",   value:fmtR(tG),  color:tG===0?C.green:C.red, sub:tG===0?"On target":"Gap to close"},
                              {label:"% COMPLETE",  value:`${tPct}%`,color:tsc,       sub:"vs target"},
                            ].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                                <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:16}}>
                            <div style={{height:"100%",width:`${Math.min(tPct,100)}%`,background:tsc,borderRadius:3}}/>
                          </div>

                          {/* Geographic & Deal-type tiles: flat client list with Sales Rep column */}
                          {(()=>{
                            const cols = isGeoTile
                              ? ["Client","Sales Rep","Deal Type","Target","Achieved","Shortfall","Stage"]
                              : ["Client","Rep","Deal Type","Target","Achieved","Shortfall","Stage"];
                            const colSpan = cols.length;
                            return (
                            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                <thead><tr>{cols.map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                                <tbody>
                                  {td.length===0&&<tr><td colSpan={colSpan} style={{padding:24,textAlign:"center",color:C.muted}}>No target set for this category this fiscal year.</td></tr>}
                                  {td.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                                    const rep=reps.find(r=>String(r.id)===String(d.repId));
                                    const ach=revenueEntries.filter(e=>String(e.repId)===String(d.repId)&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                    const sf=Math.max(0,(d.targetAmount||0)-ach);
                                    const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                    return (
                                      <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                        <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:5,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                        <td style={{padding:"9px 14px",fontSize:11,color:C.dim}}>{rep?.name||"—"}</td>
                                        <td style={{padding:"9px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                        <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                        <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                        <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                        <td style={{padding:"9px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TARGET SUBMISSION (REP) ═══ */}
          {view==="target-submit" && isRep && (()=>{
            const myRepId = user_role?.repId;
            const mySubs  = targetSubs.filter(t=>String(t.repId)===String(myRepId));
            const dealTypes = ["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"];
            const statusColor = s => s==="Approved"?C.green:s==="Pending RH"||s==="Pending NSH"||s==="Pending Strategy"||s==="Pending CRO"?C.orange:s==="Rejected"||s==="Pending Rep"?C.red:C.dim;

            // Summary stats — target only from APPROVED subs; achievement from revenue entries
            const qSubs         = mySubs.filter(s=>qMatch(s.quarter));
            const allActiveSubs = qSubs.filter(s=>s.status!=="Rejected"&&s.status!=="Pending Rep");
            const approvedSubs  = qSubs.filter(s=>s.status==="Approved");
            const activeSub     = allActiveSubs.length > 0; // used to show/hide section
            const isFrozen      = approvedSubs.some(s=>s.frozenTarget!=null);
            // Target = frozenTarget if CRO has locked it, else live totalTarget — never changes after freeze
            const totalTarget   = approvedSubs.reduce((s,sub)=>s+(sub.frozenTarget??sub.totalTarget),0);
            // Achievement = ALL revenue entries for rep in current quarter (matches War Room CLOSED QTD)
            const totalAchieved = revenueEntries.filter(e=>String(e.repId)===String(myRepId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const pct = totalTarget>0 ? Math.round((totalAchieved/totalTarget)*100) : 0;
            const pctColor = pct>=80?C.green:pct>=50?C.accent:C.red;

            return (
              <div className="fin">
                {/* Header row: title + Add Client button top-right */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TARGETS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Submit your client-wise targets for approval. Once CRO approves, they become your official quota.</div>
                  </div>
                  <button onClick={()=>{ setAddClientForm({clientCompany:"",dealType:"Linear TV",targetAmount:""}); setAddClientModalOpen(true); }}
                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:7,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    + Add Client
                  </button>
                </div>

                {/* Approval chain indicator — live step highlighting */}
                {(()=>{
                  const latestSub = allActiveSubs.length>0 ? allActiveSubs.reduce((a,b)=>((a.submittedAt||"")>=(b.submittedAt||"") ? a : b)) : null;
                  const chainStatus = latestSub?.status || null;
                  const stepMap:Record<string,number> = {"Pending RH":1,"Pending NSH":2,"Pending Strategy":3,"Pending CRO":4,"Approved":5};
                  const activeStep = chainStatus ? (stepMap[chainStatus]??0) : 0;
                  const pillLabels = ["You","Region Head","NSH","Sales Strategy","CRO → Approved"];
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:0,marginTop:14,marginBottom:16,flexWrap:"wrap"}}>
                      {pillLabels.map((s,i)=>{
                        const done    = activeStep===5 || i<activeStep;
                        const current = activeStep<5 && i===activeStep;
                        const bg    = done ? `${C.green}18` : current ? `${C.accent}18` : `${C.dim}10`;
                        const bdr   = done ? `1px solid ${C.green}44` : current ? `1px solid ${C.accent}55` : `1px solid ${C.border}`;
                        const col   = done ? C.green : current ? C.accent : C.muted;
                        const fw    = (done||current) ? 700 : 500;
                        return (
                          <div key={s} style={{display:"flex",alignItems:"center"}}>
                            <div style={{background:bg,border:bdr,borderRadius:6,padding:"4px 10px",fontSize:10,color:col,fontWeight:fw,whiteSpace:"nowrap",transition:"all .2s"}}>
                              {done&&i<4?"✓ "+s:s}
                            </div>
                            {i<4&&<div style={{width:16,height:1,background:done?C.green:C.border,transition:"background .2s"}}/>}
                          </div>
                        );
                      })}
                      {chainStatus&&chainStatus!=="Approved"&&<div style={{marginLeft:12,fontSize:10,color:C.dim}}>Awaiting {pillLabels[activeStep]}</div>}
                      {chainStatus==="Approved"&&<div style={{marginLeft:12,fontSize:10,color:C.green,fontWeight:700}}>Fully Approved ✓</div>}
                    </div>
                  );
                })()}

                {/* ── Always-visible ACHIEVED card (even with no targets) ── */}
                {!activeSub && totalAchieved > 0 && (
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    <div className="card" style={{padding:"12px 16px",minWidth:140}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:2}}>ACHIEVED THIS QUARTER</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:C.green}}>{fmtR(totalAchieved)}</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:2}}>RO received · No target set yet</div>
                    </div>
                  </div>
                )}

                {/* ── Get Started for the Year banner (new reps with no targets) ── */}
                {!activeSub && (
                  <div style={{background:"linear-gradient(135deg,#6366f118,#8b5cf618)",border:"1px solid #8b5cf633",borderRadius:12,padding:"28px 24px",marginBottom:24,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:12}}>🚀</div>
                    <div className="sans" style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:8}}>Get Started for FY26!</div>
                    <div style={{fontSize:12,color:C.dim,lineHeight:1.7,marginBottom:20,maxWidth:420,margin:"0 auto 20px"}}>
                      You haven't submitted any targets yet for this quarter.<br/>
                      Add your client names and target amounts — your Region Head will review and send them up the chain for approval.
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:16,justifyContent:"center",marginBottom:20}}>
                      {[["1. You submit","Add clients + targets below"],["2. RH reviews","Region Head checks and approves"],["3. NSH & Strategy","Verify alignment with national plan"],["4. CRO locks it in","Becomes your official quota"]].map(([step,desc])=>(
                        <div key={step} style={{background:"#fff",border:"1px solid #c8d3e5",borderRadius:8,padding:"10px 14px",minWidth:130,textAlign:"left"}}>
                          <div style={{fontSize:10,fontWeight:700,color:"#8b5cf6",marginBottom:3,letterSpacing:".06em"}}>{step}</div>
                          <div style={{fontSize:11,color:C.dim}}>{desc}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>{ setAddClientForm({clientCompany:"",dealType:"Linear TV",targetAmount:""}); setAddClientModalOpen(true); }}
                      style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:8,padding:"11px 28px",fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                      + Add My First Client Target
                    </button>
                  </div>
                )}

                {/* Summary stats row — Part 5 four-number dashboard */}
                {activeSub && (()=>{
                  const committed = getCommitted(myRepId);
                  const inPlay    = getInPlay(myRepId);
                  const shortfall = getShortfall(totalTarget, myRepId);
                  const sfColor   = shortfall===0 ? C.green : C.red;
                  return (<>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:12}}>
                      {[
                        {label:"TOTAL TARGET", value:fmtR(totalTarget), color:C.accent, locked:isFrozen, sub:"Official quota"},
                        {label:"ACHIEVED",      value:fmtR(totalAchieved), color:pctColor,           sub:"RO received"},
                        {label:"COMMITTED",     value:fmtR(committed),     color:C.blue,             sub:"Mail confirmed"},
                        {label:"IN PLAY",       value:fmtR(inPlay),        color:"#d97706",          sub:"Active pipeline"},
                        {label:"SHORTFALL",     value:fmtR(shortfall),     color:sfColor,            sub:shortfall===0?"On target":"Gap remaining"},
                      ].map(s=>(
                        <div key={s.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{s.label}</div>
                            {s.locked && <span title="CRO-approved and frozen — cannot change" style={{fontSize:10,color:C.green}}>🔒</span>}
                          </div>
                          <div className="sans" style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                    {stackedBar(totalTarget, totalAchieved, committed, inPlay, shortfall, 0)}
                    <div style={{marginBottom:20}} />
                  </>);
                })()}

                {/* Add Client Modal */}
                {addClientModalOpen && (
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>{if(e.target===e.currentTarget)setAddClientModalOpen(false);}}>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:480,maxWidth:"95vw",boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isFrozen?12:20}}>
                        <div className="sans" style={{fontWeight:700,fontSize:15}}>{isFrozen?"Add Additional Revenue":"Add Client Target"} — {filterQ}</div>
                        <button onClick={()=>setAddClientModalOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
                      </div>
                      {isFrozen && (
                        <div style={{background:`${C.green}12`,border:`1px solid ${C.green}33`,borderRadius:6,padding:"8px 12px",marginBottom:16,fontSize:11,color:C.dim}}>
                          <span style={{color:C.green,fontWeight:700}}>🔒 Your official quota is locked</span> — adding clients here creates a <em>new</em> submission for approval. Your frozen target of <strong>{fmtR(totalTarget)}</strong> does not change.
                        </div>
                      )}
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>CLIENT NAME</div>
                          <input type="text" value={addClientForm.clientCompany} onChange={e=>setAddClientForm(p=>({...p,clientCompany:e.target.value}))} placeholder="Type client company name…"
                            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}
                          />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>DEAL TYPE</div>
                          <select value={addClientForm.dealType} onChange={e=>setAddClientForm(p=>({...p,dealType:e.target.value}))}
                            style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                            {dealTypes.map(d=><option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>TARGET AMOUNT (₹)</div>
                          <input value={addClientForm.targetAmount} placeholder="e.g. 50L or 5000000"
                            onChange={e=>setAddClientForm(p=>({...p,targetAmount:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                      </div>
                      <div style={{marginTop:22,display:"flex",gap:10,justifyContent:"flex-end"}}>
                        <button onClick={()=>setAddClientModalOpen(false)} style={{padding:"9px 18px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                        <button onClick={()=>{
                          const {clientCompany,dealType,targetAmount} = addClientForm;
                          if(!clientCompany.trim()||!targetAmount){showToast("Fill in client name and target amount","err");return;}
                          const amt = parseCurrency(targetAmount);
                          // Part 7: When frozen, Additional Revenue Opportunity — no approval chain needed
                          if (isFrozen) {
                            const newEntry = {clientCompany:clientCompany.trim(),dealType,targetAmount:amt,isAdditionalRevOp:true};
                            const sub = {id:`ts${Date.now()}`,repId:myRepId,repName:user_role?.name||"",region:user_role?.region||"",quarter:entryQ,clients:[newEntry],totalTarget:amt,status:"Approved",submittedAt:TODAY,approvalLog:[{at:TODAY,by:user_role?.name||"Rep",action:"Auto-approved as Additional Revenue Opportunity",note:"No approval chain — rep adds directly"}],isAdditionalRevOp:true};
                            setTargetSubs(p=>[sub,...p]);
                            setAddClientModalOpen(false);
                            showToast(`${clientCompany.trim()} added as Additional Revenue Opportunity ✓`);
                            return;
                          }
                          const newEntry = {clientCompany:clientCompany.trim(),dealType,targetAmount:amt};
                          // Find existing pending sub for this quarter to append, or create new one
                          const existingSub = mySubs.find(s=>qMatch(s.quarter)&&s.status==="Pending RH");
                          if(existingSub){
                            const updated = {...existingSub, clients:[...existingSub.clients,newEntry], totalTarget:existingSub.totalTarget+amt};
                            setTargetSubs(p=>p.map(s=>s.id===existingSub.id?updated:s));
                          } else {
                            const sub = {id:`ts${Date.now()}`,repId:myRepId,repName:user_role?.name||"",region:user_role?.region||"",quarter:entryQ,clients:[newEntry],totalTarget:amt,status:"Pending RH",submittedAt:TODAY,approvalLog:[]};
                            setTargetSubs(p=>[sub,...p]);
                          }
                          setAddClientModalOpen(false);
                          showToast(`${clientCompany.trim()} added → submitted for approval ✓`);
                        }} style={{padding:"9px 22px",background:isFrozen?"linear-gradient(135deg,#15803d,#16a34a)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:6,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          {isFrozen ? "Add as Additional Revenue Opportunity →" : "Submit for Approval →"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current quarter client target vs achieved */}
                {(()=>{
                  // Collect ALL non-rejected subs for this quarter (approved + pending)
                  const activeSubs = mySubs.filter(s=>qMatch(s.quarter)&&s.status!=="Rejected"&&s.status!=="Pending Rep");
                  if(!activeSubs.length) return null;
                  // Flatten clients, tagging each with their parent sub's status and submitter
                  const allClients = activeSubs.flatMap(sub=>
                    sub.clients.map(cl=>({...cl, subStatus:sub.status, approvalLog:sub.approvalLog||[], submittedByName:sub.submittedByName||"", submittedByRole:sub.submittedByRole||""}))
                  );
                  // Overall status badge: show the most advanced status
                  const overallStatus = activeSubs.find(s=>s.status==="Approved")?.status || activeSubs[0]?.status;
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{filterQ} · Client Targets</div>
                        <span style={{background:`${statusColor(overallStatus)}22`,color:statusColor(overallStatus),padding:"2px 10px",borderRadius:8,fontSize:10,fontWeight:700}}>{overallStatus}</span>
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>
                            {["Client","Deal Type","Target","Achieved","Shortfall","Progress"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {allClients.map((cl,i)=>{
                              const achieved = revenueEntries
                                .filter(e=>String(e.repId)===String(myRepId)&&e.clientCompany===cl.clientCompany&&qMatch(e.quarter))
                                .reduce((s,e)=>s+(e.amount||0),0);
                              const pct = cl.targetAmount>0?Math.min(100,Math.round((achieved/cl.targetAmount)*100)):0;
                              const pc = pct>=100?C.green:pct>=60?C.accent:C.red;
                              const shortfall = Math.max(0, cl.targetAmount - achieved);
                              const isPending = cl.subStatus!=="Approved" && achieved===0;
                              return (
                                <tr key={i} style={{borderBottom:`1px solid ${C.s2}`,opacity:isPending?0.7:1}}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>
                                    {cl.clientCompany}
                                    {cl.isAdditionalRevOp && <span style={{marginLeft:6,background:`${C.green}18`,color:C.green,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,verticalAlign:"middle"}}>Additional Revenue Opportunity</span>}
                                    {cl.submittedByRole && !cl.isAdditionalRevOp && <span style={{marginLeft:6,background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,verticalAlign:"middle"}}>by {cl.submittedByRole}</span>}
                                  </td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{cl.dealType}</span></td>
                                  <td style={{padding:"10px 14px",color:isPending?C.muted:C.dim}}>{isPending?"—":fmtR(cl.targetAmount)}</td>
                                  <td style={{padding:"10px 14px",fontWeight:700,color:achieved>0?pc:C.muted}}>{isPending||achieved===0?"—":fmtR(achieved)}</td>
                                  <td style={{padding:"10px 14px",color:shortfall===0?C.green:C.red,fontWeight:700}}>{isPending||achieved===0?"—":fmtR(shortfall)}</td>
                                  <td style={{padding:"10px 14px",minWidth:140}}>
                                    {isPending ? (
                                      <span style={{background:`${C.orange}18`,color:C.orange,padding:"3px 9px",borderRadius:5,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>⏳ Awaiting Approval</span>
                                    ) : (
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <div style={{flex:1,height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                                          <div style={{height:"100%",width:`${pct}%`,background:pc,borderRadius:2}}/>
                                        </div>
                                        <span style={{fontSize:10,color:pc,fontWeight:700,minWidth:30}}>{pct}%</span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Prior approvals log across all subs */}
                      {activeSubs.flatMap(s=>s.approvalLog||[]).length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                          {activeSubs.flatMap(s=>(s.approvalLog||[]).map((log,i)=>(
                            <span key={`${s.id}_${i}`} style={{background:`${C.green}12`,color:C.green,padding:"1px 8px",borderRadius:6,fontSize:10}}>✓ {log.by}: {log.note}</span>
                          )))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* REJECTED SUBMISSIONS — Edit & Resubmit */}
                {qSubs.filter(s=>s.status==="Rejected"||s.status==="Pending Rep").map(sub=>(
                  <div key={sub.id} style={{marginBottom:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{filterQ} · {sub.status==="Pending Rep"?"Returned for Revision":"Rejected Submission"}</div>
                      {editSubId!==sub.id
                        ? <button onClick={()=>{ setEditSubId(sub.id); setEditSubClients(sub.clients.map(c=>({...c,targetAmount:String(c.targetAmount)}))); }}
                            style={{background:`${C.orange}18`,border:`1px solid ${C.orange}44`,color:C.orange,borderRadius:6,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                            ✏ Edit &amp; Resubmit
                          </button>
                        : <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>setEditSubId(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 14px",fontSize:11,cursor:"pointer",color:C.dim,fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                            <button onClick={()=>{
                              const updated = editSubClients.map(c=>({...c,targetAmount:parseCurrency(String(c.targetAmount)),clientStatus:"Pending"}));
                              const newTotal = updated.reduce((s,c)=>s+(c.targetAmount||0),0);
                              setTargetSubs(p=>p.map(t=>t.id===sub.id?{
                                ...t,
                                clients: updated,
                                totalTarget: newTotal,
                                status: "Pending RH",
                                approvalLog: [],
                                submittedAt: TODAY,
                              }:t));
                              setEditSubId(null);
                              showToast("Revised targets submitted for approval ✓");
                            }} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:6,padding:"5px 16px",fontSize:11,cursor:"pointer",color:"#fff",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              Resubmit →
                            </button>
                          </div>
                      }
                    </div>
                    {/* Rejection reason from approval log */}
                    {(sub.approvalLog||[]).length>0&&(
                      <div style={{background:`${C.red}08`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"8px 14px",marginBottom:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                        {(sub.approvalLog||[]).filter(l=>l.action==="Rejected").map((l,i)=>(
                          <span key={i} style={{fontSize:11,color:C.red}}>✗ {l.by}: {l.note} ({l.at})</span>
                        ))}
                        {(sub.approvalLog||[]).filter(l=>l.action!=="Rejected").map((l,i)=>(
                          <span key={i} style={{fontSize:11,color:C.green}}>✓ {l.by}: {l.note}</span>
                        ))}
                      </div>
                    )}
                    <div className="card" style={{overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          {["Client","Deal Type","Target Amount",editSubId===sub.id?"New Amount":""].filter(Boolean).map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {(editSubId===sub.id ? editSubClients : sub.clients).map((cl,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${C.s2}`}}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{cl.clientCompany}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{cl.dealType}</span></td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(sub.clients[i]?.targetAmount||cl.targetAmount)}</td>
                              {editSubId===sub.id&&(
                                <td style={{padding:"6px 14px"}}>
                                  <input
                                    value={editSubClients[i]?.targetAmount||""}
                                    onChange={e=>setEditSubClients(p=>p.map((c,j)=>j===i?{...c,targetAmount:e.target.value}:c))}
                                    placeholder="e.g. 50L"
                                    style={{width:120,padding:"6px 10px",background:C.s2,border:`1px solid ${C.accent}55`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}
                                  />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Past submissions (other quarters) */}
                {mySubs.filter(s=>s.quarter!==filterQ).length>0&&(
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Other Quarters</div>
                    {mySubs.filter(s=>s.quarter!==filterQ).map(sub=>(
                      <div key={sub.id} className="card" style={{padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span className="sans" style={{fontWeight:700,fontSize:12}}>{sub.quarter} · {fmtR(sub.totalTarget)}</span>
                        <span style={{background:`${statusColor(sub.status)}22`,color:statusColor(sub.status),padding:"1px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{sub.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ TARGET APPROVALS (RH / NSH / STRATEGY / CRO) ═══ */}
          {view==="target-approvals" && !isRep && !isRH && (()=>{
            const pendingStep = isRH?"Pending RH":isNSH?"Pending NSH":isStrategy?"Pending Strategy":isCRORole?"Pending CRO":null;
            const nextStep    = isRH?"Pending NSH":isNSH?"Pending Strategy":isStrategy?"Pending CRO":isCRORole?"Approved":null;
            const myPending   = isRH
              ? targetSubs.filter(t=>t.status===pendingStep&&t.region===rhRegion)
              : targetSubs.filter(t=>t.status===pendingStep);
            const approved    = targetSubs.filter(t=>t.status==="Approved");
            const statusColor = s => s==="Approved"?C.green:s.startsWith("Pending")?C.orange:C.red;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TARGET APPROVALS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:3}}>
                      {isRH?"Review and approve target submissions from your region's sales reps.":
                       isNSH?"Approve targets cleared by Region Heads.":
                       isStrategy?"Review NSH-approved targets for strategic alignment.":
                       "Final CRO sign-off on targets cleared by Sales Strategy."}
                    </div>
                  </div>
                  <button onClick={()=>{setPlanUploadForm({repId:"",quarter:entryQ,clients:[{clientCompany:"",dealType:"Linear TV",targetAmount:""}]});setPlanUploadOpen(true);}}
                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:7,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    ↑ Upload Plan for Rep
                  </button>
                </div>
                <div style={{marginBottom:16}}/>

                {/* Summary count cards */}
                {(()=>{
                  const scope = isRH ? targetSubs.filter(t=>t.region===rhRegion) : targetSubs;
                  const totalVal = scope.reduce((s,t)=>s+(t.targetAmount||0),0);
                  const approvedCt = scope.filter(t=>t.status==="Approved").length;
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                      {[
                        {label:"PENDING AT MY LEVEL", value:myPending.length,        color:myPending.length>0?C.orange:C.green, sub:"Awaiting your review"},
                        {label:"APPROVED",            value:approvedCt,              color:C.green,  sub:"Fully cleared"},
                        {label:"TOTAL IN PIPELINE",   value:scope.length,            color:C.accent, sub:"All submissions"},
                        {label:"TOTAL TARGET VALUE",  value:fmtR(totalVal),          color:C.text,   sub:"Across all submissions"},
                      ].map(card=>(
                        <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* SECTION 2 — Action Item Approvals (all approver roles) */}
                {(()=>{
                  const myDept = isRH?"Region Head":isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isAdmin?"":null;
                  if (myDept===null) return null; // reps don't see this
                  const actionApprovals = myDept===""
                    ? internalReqs.filter(r=>r.status==="Pending"&&r.type==="Approval")
                    : internalReqs.filter(r=>r.dept===myDept&&r.status==="Pending"&&r.type==="Approval");
                  return (
                    <div style={{marginBottom:24}}>
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Section 2 — Action Item Approvals</div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Approval requests from reps tagged to your role. Each requires your sign-off.</div>
                      {actionApprovals.length===0 ? (
                        <div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:12}}>✓ No pending approval requests at your level</div>
                      ) : actionApprovals.map(r=>(
                        <div key={r.id} className="card" style={{padding:"14px 16px",marginBottom:8,borderLeft:`3px solid ${C.orange}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{r.subject}</div>
                              <div style={{fontSize:11,color:C.dim}}>{r.details}</div>
                              <div style={{fontSize:10,color:C.muted,marginTop:4}}>Raised by: {r.raisedByName||"—"} · {r.raisedAt} · Client: {r.clientCompany||"—"}</div>
                            </div>
                            <div style={{display:"flex",gap:8,flexShrink:0}}>
                              <button onClick={()=>{setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY,resolverNote:"Approved by "+user_role?.name}:x));showToast("Approved ✓");}}
                                style={{background:`${C.green}22`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Approve</button>
                              <button onClick={()=>{const note=prompt("Rejection reason (required):")||"";if(!note.trim()){showToast("Rejection reason is required","err");return;}setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Rejected",resolvedAt:TODAY,resolverNote:note}:x));showToast("Request rejected — rep notified");}}
                                style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✗ Reject</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* SECTION 1 — Target Submission Approvals */}
                <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Section 1 — Target Submissions</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Target proposals from reps / Region Heads requiring approval at your level.</div>
                {myPending.length===0 ? (
                  <div style={{textAlign:"center",padding:50,color:C.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>✓</div>
                    <div style={{fontWeight:700,color:C.green}}>No pending target submissions at your level</div>
                  </div>
                ) : myPending.map(sub=>{
                  const approvedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                  const rejectedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Rejected");
                  const pendingClients  = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Pending");
                  const canForward = approvedClients.length > 0;
                  const approvedTotal = approvedClients.reduce((s,c)=>s+(c.targetAmount||0),0);

                  // helper: update a single client's status inside this submission
                  // auto-rejects the whole submission if all clients end up rejected
                  const setClientStatus = (clientIdx, newStatus) => {
                    setTargetSubs(p=>p.map(t=>{
                      if(t.id!==sub.id) return t;
                      const updatedClients = t.clients.map((cl,i)=>i===clientIdx?{...cl,clientStatus:newStatus}:cl);
                      const allRejected = updatedClients.every(cl=>(cl.clientStatus||"Pending")==="Rejected");
                      return {
                        ...t,
                        clients: updatedClients,
                        ...(allRejected ? {
                          status: "Rejected",
                          approvalLog: [...(t.approvalLog||[]), {action:"Rejected", step:pendingStep, by:user_role?.name||"", at:TODAY, note:"All clients rejected by "+user_role?.name}]
                        } : {})
                      };
                    }));
                  };

                  return (
                    <div key={sub.id} className="card" style={{padding:"16px 18px",marginBottom:12,borderLeft:`3px solid ${C.orange}`}}>
                      {/* Header */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
                        <div>
                          <div className="sans" style={{fontWeight:700,fontSize:14}}>{sub.repName} · {sub.region}</div>
                          <div style={{fontSize:11,color:C.dim}}>{sub.quarter} · Submitted {daysSince(sub.submittedAt)===0?"today":`${daysSince(sub.submittedAt)}d ago`}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className="sans" style={{fontSize:20,fontWeight:800,color:C.accent}}>{fmtR(sub.totalTarget)}</div>
                          <div style={{fontSize:9,color:C.dim,marginTop:2}}>
                            {approvedClients.length>0&&<span style={{color:C.green,marginRight:6}}>✓ {approvedClients.length} approved</span>}
                            {rejectedClients.length>0&&<span style={{color:C.red,marginRight:6}}>✗ {rejectedClients.length} rejected</span>}
                            {pendingClients.length>0&&<span style={{color:C.orange}}>{pendingClients.length} pending review</span>}
                          </div>
                        </div>
                      </div>

                      {/* Per-client rows with individual Approve / Reject */}
                      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                        {sub.clients.map((cl,i)=>{
                          const cs = cl.clientStatus || "Pending";
                          return (
                            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:cs==="Approved"?`${C.green}0d`:cs==="Rejected"?`${C.red}0d`:C.s2,borderRadius:5,border:`1px solid ${cs==="Approved"?C.green+"44":cs==="Rejected"?C.red+"44":"transparent"}`}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:700,color:cs==="Approved"?C.green:cs==="Rejected"?C.red:C.text}}>{cl.clientCompany}</div>
                                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                                  <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9}}>{cl.dealType||"—"}</span>
                                  <span style={{fontSize:11,fontWeight:700,color:C.accent}}>{fmtR(cl.targetAmount)}</span>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:5,alignItems:"center",marginLeft:10,flexShrink:0}}>
                                {cs==="Pending" ? (
                                  <>
                                    <button onClick={()=>setClientStatus(i,"Approved")}
                                      style={{background:`${C.green}22`,border:`1px solid ${C.green}55`,color:C.green,borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Approve</button>
                                    <button onClick={()=>setClientStatus(i,"Rejected")}
                                      style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✗ Reject</button>
                                  </>
                                ) : (
                                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                    <span style={{fontSize:11,fontWeight:700,color:cs==="Approved"?C.green:C.red}}>{cs==="Approved"?"✓ Approved":"✗ Rejected"}</span>
                                    <button onClick={()=>setClientStatus(i,"Pending")}
                                      style={{background:C.s3,border:"none",color:C.dim,borderRadius:4,padding:"3px 7px",fontSize:9,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Undo</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prior approvals log */}
                      {sub.approvalLog.length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                          {sub.approvalLog.map((log,i)=>(
                            <span key={i} style={{background:`${C.green}12`,color:C.green,padding:"1px 8px",borderRadius:6,fontSize:10}}>✓ {log.by}: {log.note}</span>
                          ))}
                        </div>
                      )}

                      {/* Bottom action bar */}
                      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.s3}`,paddingTop:10}}>
                        <div style={{fontSize:11,color:C.dim}}>
                          {pendingClients.length>0
                            ? `Review all clients before forwarding (${pendingClients.length} pending)`
                            : canForward
                              ? `Forwarding ${approvedClients.length} approved client${approvedClients.length!==1?"s":""} · ${fmtR(approvedTotal)}`
                              : "All clients rejected — submit rejection"}
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{
                            setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,status:"Rejected",approvalLog:[...t.approvalLog,{action:"Rejected",step:pendingStep,by:user_role?.name||"",at:TODAY,note:"Rejected by "+user_role?.name}]}:t));
                            showToast("Submission rejected — rep will be notified");
                          }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Reject All</button>
                          <button
                            disabled={!canForward||pendingClients.length>0}
                            onClick={()=>{
                              const approvedOnly = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                              const newTotal = approvedOnly.reduce((s,c)=>s+(c.targetAmount||0),0);
                              setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,
                                clients: approvedOnly,
                                totalTarget: newTotal,
                                // Freeze the quota permanently at the moment CRO approves
                                ...(nextStep==="Approved" ? {frozenTarget: newTotal} : {}),
                                status: nextStep,
                                approvalLog:[...t.approvalLog,{step:pendingStep,by:user_role?.name||"",at:TODAY,note:`Approved ${approvedOnly.length} client${approvedOnly.length!==1?"s":""}`}]
                              }:t));
                              if(nextStep==="Approved"){
                                const newDeals: any[] = [];
                                approvedOnly.forEach(cl=>{
                                  const existing = deals.find(d=>String(d.repId)===String(sub.repId)&&d.clientCompany===cl.clientCompany&&d.quarter===sub.quarter);
                                  if(existing){
                                    setDeals(p=>p.map(d=>d.id===existing.id?{...d,targetAmount:cl.targetAmount}:d));
                                  } else {
                                    const rep = reps.find(r=>String(r.id)===String(sub.repId));
                                    newDeals.push({
                                      id:`d_ts_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                                      repId:sub.repId, repName:sub.repName||rep?.name||"",
                                      region:sub.region||rep?.region||"",
                                      clientCompany:cl.clientCompany, contactName:"", designation:"",
                                      contactLevel:"", phone:"", email:"",
                                      dealType:cl.dealType||"Linear TV",
                                      channel:cl.channel||"",
                                      outcome:"Needs Callback",
                                      amount:cl.targetAmount, targetAmount:cl.targetAmount,
                                      priority:"Regular", quarter:sub.quarter,
                                      notes:`Auto-created from approved target submission`,
                                      nextStep:"", nextStepDate:null,
                                      lastContact:TODAY, reqs:[], auditLog:[],
                                      awaitingApproval:null, awaitingApprovalSince:null,
                                    });
                                  }
                                });
                                if(newDeals.length>0) setDeals(p=>[...p,...newDeals]);
                              }
                              showToast(nextStep==="Approved"?`✓ ${approvedOnly.length} targets approved!`:`Forwarded ${approvedOnly.length} clients → ${nextStep||""}`);
                            }}
                            style={{background:canForward&&pendingClients.length===0?"linear-gradient(135deg,#6366f1,#8b5cf6)":C.s3,border:"none",color:canForward&&pendingClients.length===0?"#fff":C.muted,borderRadius:4,padding:"6px 18px",fontSize:12,cursor:canForward&&pendingClients.length===0?"pointer":"not-allowed",fontFamily:"'DM Mono',monospace",fontWeight:700,transition:"all .15s"}}>
                            {nextStep==="Approved"?"✓ Final Approve":pendingClients.length>0?`Review all first (${pendingClients.length} left)`:`Approve ${approvedClients.length} → ${nextStep||""}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Approved targets summary */}
                {approved.length>0&&(
                  <div style={{marginTop:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Approved Targets This Quarter</div>
                    {approved.filter(t=>qMatch(t.quarter)).map(sub=>(
                      <div key={sub.id} className="card" style={{padding:"12px 16px",marginBottom:8,borderLeft:`3px solid ${C.green}`}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span className="sans" style={{fontWeight:700}}>{sub.repName} · {sub.region}</span>
                          <span style={{color:C.green,fontWeight:700}}>{fmtR(sub.totalTarget)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

    </>
  );
}
