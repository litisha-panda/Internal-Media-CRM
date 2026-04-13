import React from "react";
import { ACTION_TYPES, APPROVAL_TARGETS } from "../constants";

interface AccountThreadModalProps {
  C: any;
  accountThreadClient: string;
  deals: any[];
  touchpoints: any[];
  clientAccounts: any[];
  revenueEntries: any[];
  meetings: any[];
  reps: any[];
  tasks: any[];
  internalReqs: any[];
  setInternalReqs: any;
  setTasks: any;
  setLogForm: any;
  setLogOpen: (v: boolean) => void;
  BLANK_LOG: any;
  user_role: any;
  activeUser: string;
  TODAY: string;
  TOMORROW: string;
  threadAIForm: any;
  setThreadAIForm: (v: any) => void;
  dealStage: (d: any) => string;
  oColor: (stage: string) => string;
  daysSince: (date: string) => number;
  fmtR: (v: number) => string;
  stackedBar: (target: number, achieved: number, committed: number, inPlay: number, shortfall: number, h: number) => React.ReactNode;
  showToast: (msg: string, type?: string) => void;
  onClose: () => void;
}

export function AccountThreadModal({
  C, accountThreadClient, deals, touchpoints, clientAccounts, revenueEntries, meetings, reps,
  tasks, internalReqs, setInternalReqs, setTasks, setLogForm, setLogOpen, BLANK_LOG,
  user_role, activeUser, TODAY, TOMORROW, threadAIForm, setThreadAIForm,
  dealStage, oColor, daysSince, fmtR, stackedBar, showToast, onClose,
}: AccountThreadModalProps) {
  const clientName = accountThreadClient;
  const clientDeals: any[] = (deals as any[]).filter((d:any) => d.clientCompany === clientName);
  const clientTPs = (touchpoints as any[]).filter((t:any) => clientDeals.some((d:any) => d.id === t.dealId) || t.clientAccountId === clientDeals[0]?.clientAccountId);
  const clientRevs = (revenueEntries as any[]).filter((e:any) => e.clientCompany === clientName);
  const account: any = (clientAccounts as any[]).find((a:any) => a.clientName === clientName) || clientDeals[0];
  const currentStage = account?.currentStage || dealStage(clientDeals[0]||{});
  const repObj: any = (reps as any[]).find((r:any) => r.id === (clientDeals[0]?.repId));
  const cTarget    = clientDeals.reduce((s:number,d:any) => s+(d.targetAmount||0), 0);
  const cAchieved  = clientRevs.reduce((s:number,e:any) => s+(e.amount||0), 0);
  const cCommitted = clientDeals.filter((d:any) => dealStage(d)==="Mail Confirmed").reduce((s:number,d:any) => s+(d.pipelineAmount||0), 0);
  const cInPlay    = clientDeals.filter((d:any) => ["In Discussion","Negotiation"].includes(dealStage(d))).reduce((s:number,d:any) => s+(d.pipelineAmount||0), 0);
  const cShortfall = Math.max(0, cTarget - cAchieved);
  const legacyMeetings = (meetings as any[]).filter((m:any) => m.clientCompany === clientName && !clientTPs.some((t:any) => t.meetingLogId === m.id));
  const allEntries = [
    ...clientTPs.map((t:any) => ({...t, _type:"tp"})),
    ...legacyMeetings.map((m:any) => ({...m, _type:"meeting"})),
    ...clientRevs.map((r:any) => ({...r, _type:"revenue"})),
  ].sort((a:any,b:any) => ((b.date||"") > (a.date||"") ? 1 : -1));
  const pendingAIs = (tasks as any[]).filter((t:any) => t.clientCompany === clientName && t.status !== "Done" && t.status !== "Closed");

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,width:"100%",maxWidth:660,boxShadow:"0 24px 60px rgba(0,0,0,.5)",padding:"24px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <div className="sans" style={{fontSize:18,fontWeight:800,letterSpacing:1}}>{clientName}</div>
              <span style={{background:`${oColor(currentStage)}18`,color:oColor(currentStage),padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700}}>{currentStage}</span>
            </div>
            <div style={{fontSize:11,color:C.dim}}>
              {repObj?.name} · {clientDeals[0]?.region}
              {(()=>{
                const idleClock=account?.lastDealMeetingDate||clientDeals[0]?.lastDealMeetingDate||clientDeals[0]?.lastContact;
                const idle=daysSince(idleClock);
                return idleClock ? <span style={{color:idle>=7?C.red:idle>=3?C.orange:C.green,fontWeight:600,marginLeft:8}}>{idle===0?"Deal meeting today":`Last deal meeting: ${idle}d ago`}</span> : null;
              })()}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
          {[["TARGET",fmtR(cTarget),C.dim],["ACHIEVED",fmtR(cAchieved),C.green],["COMMITTED",fmtR(cCommitted),C.blue],["IN PLAY",fmtR(cInPlay),"#d97706"],["SHORTFALL",fmtR(cShortfall),cShortfall===0?C.green:C.red]].map(([l,v,c])=>(
            <div key={l as string} style={{background:C.s2,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:8,color:C.muted,letterSpacing:".07em",marginBottom:3,textTransform:"uppercase"}}>{l}</div>
              <div className="sans" style={{fontSize:15,fontWeight:800,color:c as string}}>{v}</div>
            </div>
          ))}
        </div>
        {stackedBar(cTarget, cAchieved, cCommitted, cInPlay, cShortfall, 8)}
        <div style={{marginBottom:10}} />

        {pendingAIs.length>0&&(
          <div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}33`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:6}}>PENDING ACTION ITEMS ({pendingAIs.length})</div>
            {pendingAIs.slice(0,3).map((ai:any)=>(
              <div key={ai.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:11,color:C.text,flex:1}}>{ai.title}</span>
                <span style={{fontSize:10,color:C.dim}}>→ {ai.assignedDept||"Self"}</span>
                <span style={{background:`${C.orange}18`,color:C.orange,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{ai.status}</span>
              </div>
            ))}
            {pendingAIs.length>3&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>+{pendingAIs.length-3} more</div>}
          </div>
        )}

        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:10,textTransform:"uppercase"}}>Activity Thread · {allEntries.length} entries</div>
        {allEntries.length===0&&<div style={{textAlign:"center",padding:32,color:C.muted,fontSize:12}}>No activity logged yet for this client.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allEntries.map((entry:any,i:number)=>{
            if (entry._type==="revenue") return (
              <div key={entry.id||i} style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:16}}>💰</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.green}}>₹{((entry.amount||0)/100000).toFixed(1)}L revenue logged</div>
                  <div style={{fontSize:10,color:C.dim,marginTop:2}}>{entry.date} · Ref: {entry.invoiceRef||"—"} · {entry.dealType}</div>
                  {entry.notes&&<div style={{fontSize:11,color:C.dim,marginTop:3}}>{entry.notes}</div>}
                </div>
              </div>
            );
            const isTp = entry._type==="tp";
            const tpBadgeColor = entry.touchpointType==="Relationship"?C.blue:C.accent;
            const stageChangeText = isTp && entry.stageUpdate ? `Stage: ${entry.stageUpdate}` : entry.outcome ? `Stage: ${entry.outcome}` : null;
            return (
              <div key={entry.id||i} style={{background:C.s2,borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${tpBadgeColor}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:10,color:C.dim,fontWeight:600}}>{entry.date}</span>
                  {entry.time&&<span style={{fontSize:10,color:C.muted}}>{entry.time}</span>}
                  <span style={{background:`${tpBadgeColor}18`,color:tpBadgeColor,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{entry.touchpointType||"Deal Meeting"}</span>
                  {entry.meetingType&&<span style={{fontSize:10,color:C.muted,background:C.s3,padding:"1px 6px",borderRadius:4}}>{entry.meetingType}</span>}
                  {stageChangeText&&<span style={{fontSize:10,color:C.accent,fontWeight:600,background:`${C.accent}12`,padding:"1px 7px",borderRadius:4}}>{stageChangeText}</span>}
                </div>
                {(entry.contactName||entry.contactDesignation)&&(
                  <div style={{fontSize:11,color:C.dim,marginBottom:4}}>
                    Contact: <span style={{color:C.text,fontWeight:600}}>{entry.contactName}</span>
                    {entry.contactDesignation&&<span style={{color:C.muted}}> · {entry.contactDesignation}</span>}
                    {(entry.contactLevel||entry.designation)&&<span style={{color:C.muted}}> · {entry.contactLevel||entry.designation}</span>}
                  </div>
                )}
                {(entry.whatHappened||entry.discussion)&&(
                  <div style={{fontSize:12,color:C.text,marginBottom:4,lineHeight:1.5}}>{entry.whatHappened||entry.discussion}</div>
                )}
                {entry.clientFeedback&&(
                  <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:5,padding:"4px 8px",fontSize:11,color:C.blue,marginTop:4}}>
                    💬 {entry.clientFeedback}
                  </div>
                )}
                {entry.nextSteps&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>Next: {entry.nextSteps}</div>}
                {isTp&&(
                  <div style={{marginTop:8}}>
                    {threadAIForm?.entryId===entry.id ? (
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginTop:4}}>
                        <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Add Action Item to this Touchpoint</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Action Type *</div>
                            <select value={threadAIForm?.actionType} onChange={e=>setThreadAIForm((p:any)=>p?({...p,actionType:e.target.value}):null)}>
                              <option value="">Select type…</option>
                              {ACTION_TYPES.map((t:string)=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Who *</div>
                            <select value={threadAIForm?.neededFrom} onChange={e=>setThreadAIForm((p:any)=>p?({...p,neededFrom:e.target.value}):null)}>
                              <option value="">Needed from…</option>
                              {APPROVAL_TARGETS.map((t:string)=><option key={t} value={t}>{t}</option>)}
                              <option value="Self">Myself</option>
                            </select>
                          </div>
                        </div>
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Details <span style={{fontWeight:400}}>(max 150 chars)</span></div>
                          <input maxLength={150} placeholder="What exactly is needed…" value={threadAIForm?.details} onChange={e=>setThreadAIForm((p:any)=>p?({...p,details:e.target.value}):null)} />
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>By When *</div>
                          <input type="date" min="2020-01-01" max="2099-12-31" value={threadAIForm?.dueDate} onChange={e=>setThreadAIForm((p:any)=>p?({...p,dueDate:e.target.value}):null)} />
                        </div>
                        {threadAIForm?.actionType&&threadAIForm?.neededFrom&&(
                          <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:8}}>
                            {threadAIForm?.actionType==="Approval needed"&&`→ Approvals tab of ${threadAIForm?.neededFrom}`}
                            {threadAIForm?.actionType==="Attend a meeting"&&`→ My Plan of ${threadAIForm?.neededFrom}`}
                            {["Document needed","Introduction needed","Flag for follow-up"].includes(threadAIForm?.actionType)&&`→ My Tasks of ${threadAIForm?.neededFrom}`}
                            {threadAIForm?.neededFrom==="Self"&&" (personal reminder — no one else notified)"}
                          </div>
                        )}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>setThreadAIForm(null)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 0",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                          <button onClick={()=>{
                            if(!threadAIForm?.actionType||!threadAIForm?.neededFrom||!threadAIForm?.dueDate){showToast("Fill all required fields");return;}
                            const aType=threadAIForm?.actionType;
                            const neededFrom=threadAIForm?.neededFrom;
                            const details=threadAIForm?.details;
                            const dueDate=threadAIForm?.dueDate;
                            const repName=user_role?.name||"Rep";
                            const ts=`ai_tp_${Date.now()}`;
                            const baseTask:any={id:ts,assignedTo:null,assignedToUserId:null,assignedDept:neededFrom==="Self"?"Self":neededFrom,repId:clientDeals[0]?.repId||null,clientCompany:clientName,title:`${aType} — ${clientName}${details?` — ${details}`:""} — by ${dueDate} — from ${repName}`.slice(0,160),description:details,priority:"High",status:"Open",dueDate,createdAt:TODAY,assignedBy:activeUser,assignedByName:repName,fromMeetingLog:true,actionType:aType};
                            setTasks((p:any[])=>[baseTask,...p]);
                            if(aType==="Approval needed"&&neededFrom!=="Self"){
                              setInternalReqs((p:any[])=>[{id:`ir_tp_${Date.now()}`,type:"Approval",dept:neededFrom,subject:`[Approval needed] ${clientName}${details?` — ${details}`:""} — by ${dueDate} — from ${repName}`.slice(0,160),details,raisedBy:activeUser,raisedByName:repName,repId:clientDeals[0]?.repId||null,dealId:clientDeals[0]?.id||null,clientCompany:clientName,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""},...p]);
                            }
                            setThreadAIForm(null);
                            showToast(`Action item → ${neededFrom} ✓`);
                          }} style={{flex:2,background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 0",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Add Item</button>
                        </div>
                      </div>
                    ):(
                      <button onClick={()=>setThreadAIForm({entryId:entry.id,actionType:"",details:"",neededFrom:"",dueDate:TOMORROW})}
                        style={{background:`${C.blue}10`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        + Add Action Item
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
          <button onClick={()=>{setLogForm((p:any)=>({...BLANK_LOG,clientAgencyName:clientName,repId:String(clientDeals[0]?.repId||"")}));setLogOpen(true);onClose();}}
            style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:6,padding:"7px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
            + Log New Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
