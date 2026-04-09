import React from "react";
import { MEETING_STATUS } from "../constants";

interface MeetingDetailModalProps {
  C: any;
  viewMeetingId: string | null;
  setViewMeetingId: (v: string | null) => void;
  meetings: any[];
  setMeetings: any;
  meetingEditMode: boolean;
  setMeetingEditMode: (v: boolean) => void;
  meetingEditForm: any;
  setMeetingEditForm: (v: any) => void;
  isRep: boolean;
  user_role: any;
  internalReqs: any[];
  tasks: any[];
  showToast: (msg: string, type?: string) => void;
}

export function MeetingDetailModal({
  C, viewMeetingId, setViewMeetingId, meetings, setMeetings,
  meetingEditMode, setMeetingEditMode, meetingEditForm, setMeetingEditForm,
  isRep, user_role, internalReqs, tasks, showToast,
}: MeetingDetailModalProps) {
  if (!viewMeetingId) return null;
  const vm: any = meetings.find(m => m.id === viewMeetingId);
  if (!vm) return null;
  const ef: any = meetingEditMode ? meetingEditForm : vm;
  const statusColor = (ef.status||vm.status||"")==="Closed"?C.green:(ef.status||vm.status||"")==="Positive"?C.blue:(ef.status||vm.status||"")==="Follow-up Needed"?C.orange:C.dim;
  const canEdit = isRep ? vm.repId === user_role?.repId : true;
  const setEf = (patch: any) => setMeetingEditForm((f: any) => ({...f, ...patch}));
  const closeMeetingModal = () => { setViewMeetingId(null); setMeetingEditMode(false); setMeetingEditForm({}); };
  const startEdit = () => { setMeetingEditForm({...vm}); setMeetingEditMode(true); };
  const saveEdit = () => {
    if (!meetingEditForm.discussion?.trim()) { alert("What Happened is required"); return; }
    setMeetings((p: any[]) => p.map(m => m.id === viewMeetingId ? {...m, ...meetingEditForm} : m));
    setMeetingEditMode(false);
    showToast("Meeting updated ✓");
  };

  const linkedIRColor = (status: string) => status==="Done"||status==="Resolved"?C.green:status==="In Progress"?C.blue:status==="Rejected"?C.red:C.accent;

  return (
    <div className="overlay" onClick={closeMeetingModal}>
      <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:560,maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            {meetingEditMode
              ? <input value={ef.clientCompany||""} onChange={e=>setEf({clientCompany:e.target.value})} className="sans" style={{fontSize:17,fontWeight:700,color:C.text,background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",width:220}} />
              : <div className="sans" style={{fontSize:17,fontWeight:700,color:C.text}}>{vm.clientCompany}</div>
            }
            <div style={{fontSize:11,color:C.dim,marginTop:4,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {meetingEditMode
                ? <input type="date" min="2020-01-01" max="2099-12-31" value={ef.date||""} onChange={e=>setEf({date:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim}} />
                : <span>{vm.date}</span>
              }
              {meetingEditMode
                ? <input type="time" value={ef.loggedAt||""} onChange={e=>setEf({loggedAt:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim,width:90}} />
                : <span>{vm.loggedAt||"—"}</span>
              }
              {meetingEditMode
                ? <select value={ef.meetingType||"Physical"} onChange={e=>setEf({meetingType:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim}}>
                    {["Physical","Online","Phone Call"].map(t=><option key={t}>{t}</option>)}
                  </select>
                : <span>{vm.meetingType||"Physical"}</span>
              }
              {meetingEditMode
                ? <select value={ef.pitchType||""} onChange={e=>setEf({pitchType:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.accent}}>
                    <option value="">No pitch type</option>
                    {["Linear TV","IPs","Digital","Media Solutions","Integrated Packages","FCT","Generic"].map(t=><option key={t}>{t}</option>)}
                  </select>
                : vm.pitchType && <span style={{color:C.accent}}>{vm.pitchType}</span>
              }
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {meetingEditMode
              ? <select value={ef.status||"Meeting Done"} onChange={e=>setEf({status:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",color:statusColor,fontWeight:700}}>
                  {MEETING_STATUS.map(s=><option key={s}>{s}</option>)}
                </select>
              : <span style={{background:`${statusColor}22`,color:statusColor,padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700}}>{vm.status||"Done"}</span>
            }
            <button onClick={closeMeetingModal} style={{background:"transparent",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{background:C.s2,borderRadius:6,padding:"8px 12px",marginBottom:14}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:C.dim,alignItems:"center"}}>
            {meetingEditMode
              ? <>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span>🧑</span>
                    <input value={ef.contactName||""} onChange={e=>setEf({contactName:e.target.value})} placeholder="Contact name" style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 8px",width:140}} />
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span>📱</span>
                    <input value={ef.phone||""} onChange={e=>setEf({phone:e.target.value})} placeholder="Phone" style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 8px",width:120}} />
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span>🎯</span>
                    <select value={ef.contactLevel||""} onChange={e=>setEf({contactLevel:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px"}}>
                      <option value="">Contact level…</option>
                      {["C-Suite / Owner","VP / GM","Junior/Exec","Agency"].map(l=><option key={l}>{l}</option>)}
                    </select>
                  </div>
                </>
              : <>
                  {vm.contactName&&<span>🧑 {vm.contactName}</span>}
                  {vm.phone&&<span>📱 {vm.phone}</span>}
                  {vm.contactLevel&&<span>🎯 {vm.contactLevel}</span>}
                  {vm.repName&&<span>👤 Rep: {vm.repName}</span>}
                </>
            }
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>What Happened {meetingEditMode&&<span style={{color:C.red,fontWeight:400}}>*</span>}</div>
          {meetingEditMode
            ? <textarea rows={3} value={ef.discussion||""} onChange={e=>setEf({discussion:e.target.value})} placeholder="What was discussed, how the client reacted..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
            : <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.discussion||<span style={{color:C.muted}}>Not recorded</span>}</div>
          }
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Client Feedback</div>
          {meetingEditMode
            ? <textarea rows={2} value={ef.clientFeedback||""} onChange={e=>setEf({clientFeedback:e.target.value})} placeholder="Positive, hesitant, needs approval..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
            : vm.clientFeedback
                ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.clientFeedback}</div>
                : <div style={{fontSize:11,color:C.muted}}>—</div>
          }
        </div>

        {!["Mail Confirmed","Lost","RO Received"].some(ts=>ts===(ef.stageUpdate||"")||ts===(ef.status||"")||ts===(ef.outcome||"")) && (()=>{
          const items = ((vm.nextStepItems||[]) as any[]).filter((i:any)=>i.action);
          const addItem = () => {
            setMeetings((p: any[]) => p.map(m => m.id===viewMeetingId ? {...m, nextStepItems:[...(m.nextStepItems||[]),{action:"",neededFrom:"",remarks:"",dueDate:""}]} : m));
          };
          const updateItem = (idx: number, field: string, val: string) => {
            setMeetings((p: any[]) => p.map(m => m.id===viewMeetingId ? {...m, nextStepItems:(m.nextStepItems||[]).map((it:any,i:number)=>i===idx?{...it,[field]:val}:it)} : m));
          };
          const removeItem = (idx: number) => {
            setMeetings((p: any[]) => p.map(m => m.id===viewMeetingId ? {...m, nextStepItems:(m.nextStepItems||[]).filter((_:any,i:number)=>i!==idx)} : m));
          };
          return (
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>
                  Action Items {items.length>0&&<span style={{color:C.blue,fontWeight:400}}>({items.length})</span>}
                </div>
                <button onClick={addItem} style={{fontSize:10,color:C.blue,background:`${C.blue}11`,border:`1px solid ${C.blue}33`,borderRadius:4,padding:"3px 9px",cursor:"pointer",fontWeight:600}}>
                  + Add Action Item
                </button>
              </div>
              {((vm.nextStepItems||[]) as any[]).length===0 && !meetingEditMode && (
                vm.nextSteps
                  ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"10px 12px"}}>{vm.nextSteps}</div>
                  : <div style={{fontSize:11,color:C.muted}}>No action items recorded.</div>
              )}
              {((vm.nextStepItems||[]) as any[]).map((item: any, idx: number) => {
                const linkedIR: any = item.action ? (internalReqs as any[]).find((r:any)=>r.meetingLogId===vm.id&&r.subject===item.action) : null;
                const linkedTask = item.action ? tasks.find((t:any)=>t.meetingLogId===vm.id&&t.title?.includes(item.action.slice(0,30))) : null;
                return (
                  <div key={idx} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px",marginBottom:7}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                      <input value={item.action||""} onChange={e=>updateItem(idx,"action",e.target.value)} placeholder="What needs to happen…" style={{fontSize:12,fontWeight:600,width:"100%",color:C.text,flex:1}} />
                      <button onClick={()=>removeItem(idx)} style={{fontSize:14,color:C.red,background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:0,marginLeft:4,flexShrink:0}}>×</button>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:(linkedIR||linkedTask)?6:0}}>
                      <select value={item.neededFrom||""} onChange={e=>updateItem(idx,"neededFrom",e.target.value)} style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.dim}}>
                        <option value="">Self</option>
                        {["Region Head","NSH","CXO","Sales Strategy","Digital","Finance","Legal","Branding Team","Content Team","Client"].map(r=><option key={r}>{r}</option>)}
                      </select>
                      <input type="date" min="2020-01-01" max="2099-12-31" value={item.dueDate||""} onChange={e=>updateItem(idx,"dueDate",e.target.value)} style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.dim}} />
                      <input value={item.remarks||""} onChange={e=>updateItem(idx,"remarks",e.target.value)} placeholder="Notes…" style={{fontSize:11,flex:1,minWidth:80}} />
                    </div>
                    {(linkedIR||linkedTask) && (
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                        {linkedIR && (
                          <span style={{fontSize:10,background:`${linkedIRColor(linkedIR.status)}18`,color:linkedIRColor(linkedIR.status),border:`1px solid ${linkedIRColor(linkedIR.status)}44`,borderRadius:4,padding:"2px 8px",fontWeight:600}}>
                            IR → {linkedIR.dept}: {linkedIR.status}
                          </span>
                        )}
                        {linkedTask && (
                          <span style={{fontSize:10,background:`${C.green}18`,color:C.green,border:`1px solid ${C.green}44`,borderRadius:4,padding:"2px 8px",fontWeight:600}}>
                            Task: {linkedTask.status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:C.blue,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>📞 Follow-up Date</div>
            {meetingEditMode
              ? <input type="date" min="2020-01-01" max="2099-12-31" value={ef.followUpDate||""} onChange={e=>setEf({followUpDate:e.target.value})} style={{width:"100%",fontSize:12}} />
              : vm.followUpDate
                  ? <div style={{fontSize:13,fontWeight:600,color:C.text,background:`${C.blue}11`,border:`1px solid ${C.blue}33`,borderRadius:6,padding:"8px 12px"}}>{vm.followUpDate}</div>
                  : <div style={{fontSize:11,color:C.muted}}>Not set</div>
            }
          </div>
          <div>
            <div style={{fontSize:10,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>📅 Next Meeting Date</div>
            {meetingEditMode
              ? <input type="date" min="2020-01-01" max="2099-12-31" value={ef.nextMeetingDate||""} onChange={e=>setEf({nextMeetingDate:e.target.value})} style={{width:"100%",fontSize:12}} />
              : vm.nextMeetingDate
                  ? <div style={{fontSize:13,fontWeight:600,color:C.text,background:`${C.green}11`,border:`1px solid ${C.green}33`,borderRadius:6,padding:"8px 12px"}}>{vm.nextMeetingDate}</div>
                  : <div style={{fontSize:11,color:C.muted}}>Not set</div>
            }
          </div>
        </div>

        {meetingEditMode && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Additional Notes</div>
            <textarea rows={2} value={ef.notes||""} onChange={e=>setEf({notes:e.target.value})} placeholder="Any other context or remarks..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
          </div>
        )}
        {!meetingEditMode && vm.notes && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Notes</div>
            <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.notes}</div>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <div>{meetingEditMode&&<span style={{fontSize:10,color:C.muted}}>Fields marked * are required</span>}</div>
          <div style={{display:"flex",gap:8}}>
            {meetingEditMode
              ? <>
                  <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>{setMeetingEditMode(false);setMeetingEditForm({});}}>Cancel</button>
                  <button className="btn btn-primary" style={{fontSize:12}} onClick={saveEdit}>Save Changes</button>
                </>
              : <>
                  {canEdit&&<button className="btn btn-ghost" style={{fontSize:12}} onClick={startEdit}>✏️ Edit</button>}
                  <button className="btn btn-ghost" onClick={closeMeetingModal}>Close</button>
                </>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
