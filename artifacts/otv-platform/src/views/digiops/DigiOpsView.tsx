import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import {
  TASK_STATUSES,
  D3,
  D7,
} from "../../constants";

interface DigiOpsViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
}

export function DigiOpsView({ view, setView }: DigiOpsViewProps) {
  const {
    deals,
    setDeals,
    tasks,
    setTasks,
    revenueEntries,
    reps,
    isDigiOps,
    filterQ,
    qMatch,
    fmtR,
    daysSince,
    oColor,
    showToast,
    setTaskModal,
    C,
    TODAY,
  } = useCROAppContext();
  return (
    <>
          {/* ══════════════ DIGI OPS VIEWS ══════════════ */}
          {/* ═══ DIGI OPS — TV + DIGITAL DEALS ═══ */}
          {view==="digi-tv-deals" && isDigiOps && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TV + DIGITAL DEALS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Integrated deals combining TV FCT with digital components</div>
              {(()=>{
                const tvDigiDeals = deals.filter(d=>d.dealType==="Integrated Packages"||d.dealType==="Media Solutions");
                if(!tvDigiDeals.length) return <div style={{textAlign:"center",padding:50,color:C.muted}}>No TV+Digital integrated deals yet.</div>;
                return tvDigiDeals.map(d=>{
                  const rep = reps.find(r=>r.id===d.repId);
                  const sc  = oColor(d.outcome);
                  return (
                    <div key={d.id} className="card" style={{padding:"14px 18px",marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div className="sans" style={{fontWeight:700,fontSize:14,marginBottom:3}}>{d.clientCompany}</div>
                          <div style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region} · {d.dealType}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className="sans" style={{fontSize:18,fontWeight:800,color:C.green}}>{fmtR(d.amount)}</div>
                          <span style={{background:`${sc}22`,color:sc,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{d.outcome}</span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                        {["TV FCT","Digital Video","Social","OTT","Display"].map(comp=>(
                          <span key={comp} style={{background:`${C.blue}12`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,border:`1px dashed ${C.blue}33`}}>{comp}</span>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ═══ DIGI OPS — DIGITAL PROJECTS ═══ */}
          {view==="digi-projects" && isDigiOps && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>DIGITAL PROJECTS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Active digital production projects and campaigns</div>
              {(()=>{
                const projects = [
                  {id:"dp1",name:"Havells Digital Campaign",client:"Havells India",type:"Social + OTT",status:"In Progress",dueDate:D3,assignedTo:"Digi Ops",budget:1500000},
                  {id:"dp2",name:"Berger Paints Microsite",client:"Berger Paints",type:"Website",status:"Pending",dueDate:D7,assignedTo:"Digi Ops",budget:800000},
                  {id:"dp3",name:"ITC Programmatic Run",client:"ITC Limited",type:"Programmatic",status:"Live",dueDate:TODAY,assignedTo:"Digi Ops",budget:600000},
                ];
                const statusC = s => s==="Live"?C.green:s==="In Progress"?C.blue:s==="Pending"?C.orange:C.dim;
                return projects.map(p=>(
                  <div key={p.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${statusC(p.status)}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div className="sans" style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                        <div style={{fontSize:11,color:C.dim,marginTop:2}}>{p.client} · {p.type}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span style={{background:`${statusC(p.status)}22`,color:statusC(p.status),padding:"2px 9px",borderRadius:8,fontSize:11,fontWeight:700}}>{p.status}</span>
                        <div className="sans" style={{fontSize:14,fontWeight:700,color:C.accent,marginTop:4}}>{fmtR(p.budget)}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.dim}}>Due: {p.dueDate}</span>
                      <span style={{fontSize:10,color:C.dim}}>Assigned: {p.assignedTo}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {view==="digi-deals" && isDigiOps && (()=>{
            const digiDeals=deals.filter(d=>qMatch(d.quarter)&&(d.dealType==="Digital"||d.dealType==="Integrated Packages"||(d.reqs||[]).some(r=>r.dept==="Digital"))).sort((a,b)=>b.amount-a.amount);
            const blocked=digiDeals.filter(d=>d.awaitingApproval==="Digital");
            const digiTasks=tasks.filter(t=>t.dept==="Digital"&&t.status!=="Done");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>DIGITAL DEALS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · All deals with a digital component</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[{l:"TOTAL DIGITAL",v:fmtR(digiDeals.reduce((s,d)=>s+(d.amount||0),0)),c:C.blue},{l:"CLOSED",v:fmtR(revenueEntries.filter(e=>new Set(digiDeals.map(d=>d.repId)).has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0)),c:C.green},{l:"OPEN PIPELINE",v:fmtR(digiDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),c:C.accent},{l:"WAITING ON YOU",v:blocked.length,c:blocked.length>0?C.orange:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              {digiTasks.length>0&&(<div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 {digiTasks.length} Task{digiTasks.length!==1?"s":""} Assigned to Digital</div>{digiTasks.slice(0,4).map(t=>{const rep=reps.find(r=>r.id===t.repId);return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.s2,borderRadius:5,marginBottom:5}}><div style={{flex:1}}><div style={{fontWeight:600,fontSize:12}}>{t.title}</div><div style={{fontSize:10,color:C.dim}}>{t.clientCompany&&`${t.clientCompany} · `}{rep&&`from ${rep.name} · `}Due {t.dueDate}</div></div><span style={{background:t.dueDate<TODAY?`${C.red}22`:`${C.orange}18`,color:t.dueDate<TODAY?C.red:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.dueDate<TODAY?"OVERDUE":t.priority}</span><button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button></div>);})}{digiTasks.length>4&&<div style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:5}}>+{digiTasks.length-4} more · see My Tasks</div>}</div>)}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Type","Amount","Needs from Digital","Stage","Idle"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{digiDeals.length===0&&<tr><td colSpan={8} style={{padding:24,textAlign:"center",color:C.muted}}>No digital deals for {filterQ} yet</td></tr>}{digiDeals.map(d=>{const rep=reps.find(r=>r.id===d.repId);const idle=daysSince(d.lastContact);const digiReqs=(d.reqs||[]).filter(r=>r.dept==="Digital");const waitingOnUs=d.awaitingApproval==="Digital";return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:waitingOnUs?`${C.blue}06`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=waitingOnUs?`${C.blue}06`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div>{waitingOnUs&&<span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>Needs your action</span>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"9px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{d.dealType}</td><td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td><td style={{padding:"9px 12px"}}>{digiReqs.length>0?<div>{digiReqs.map((r,i)=><div key={i} style={{fontSize:10,color:C.blue}}>{r.desc}</div>)}</div>:waitingOnUs?<span style={{color:C.blue,fontSize:11}}>Approval needed</span>:<span style={{color:C.muted}}>—</span>}</td><td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td><td style={{padding:"9px 12px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11}}>{idle===0?"Today":`${idle}d`}</td></tr>);})}</tbody></table></div>
            </div>);
          })()}

          {view==="digi-tasks" && isDigiOps && (()=>{
            const myTasks=tasks.filter(t=>t.dept==="Digital").sort((a,b)=>a.dueDate>b.dueDate?1:-1);
            const overdueCount=myTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length;
            return(<div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Tasks assigned to Digital · {myTasks.length} total · {overdueCount} overdue</div></div><button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Create Task</button></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>{[{l:"OPEN",v:myTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:myTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:overdueCount,c:C.red},{l:"DONE",v:myTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {myTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No tasks assigned to Digital yet.</div>:<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Task","Client","Raised By","Priority","Status","Due","Update"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{myTasks.map(t=>{const rep=reps.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;return(<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name||t.assignedByName||"—"}</td><td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td><td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td><td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td><td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td></tr>);})}  </tbody></table></div>}
            </div>);
          })()}

          {view==="digi-escalations" && isDigiOps && (()=>{
            const digiBlocked=deals.filter(d=>d.awaitingApproval==="Digital"&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Deals waiting on Digital team</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>{[{l:"PENDING",v:digiBlocked.length,c:C.orange},{l:"OVERDUE (>2D)",v:digiBlocked.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=2).length,c:C.red},{l:"VALUE",v:fmtR(digiBlocked.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {digiBlocked.length===0?<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ Nothing waiting on Digital right now</div>:digiBlocked.map(d=>{const rep=reps.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(<div key={d.id} style={{background:C.surface,border:`1px solid ${dw>=2?C.red+"44":C.border}`,borderLeft:`3px solid ${dw>=2?C.red:C.orange}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><span className="sans" style={{fontSize:14,fontWeight:700}}>{d.clientCompany}</span><span style={{background:`${dw>=2?C.red:C.orange}22`,color:dw>=2?C.red:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{dw}d waiting</span></div><div style={{fontSize:11,color:C.dim,marginBottom:4}}>{rep?.name} · {d.region}</div>{d.nextStep&&<div style={{fontSize:11,color:C.text}}>Context: {d.nextStep}</div>}</div><div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}><div className="sans" style={{fontSize:15,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span><button onClick={()=>{
                                const nextApprover = d.amount >= 50000000 ? "CXO" : null;
                                setDeals(p=>p.map(x=>x.id===d.id?{...x,awaitingApproval:nextApprover,awaitingApprovalSince:nextApprover?TODAY:null}:x));
                                showToast(nextApprover ? `Approved → forwarded to CXO` : "Deal approved ✓");
                              }} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                {d.amount >= 50000000 ? "Approve → CXO" : "✓ Approve"}
                              </button></div></div>);})}
            </div>);
          })()}

    </>
  );
}
