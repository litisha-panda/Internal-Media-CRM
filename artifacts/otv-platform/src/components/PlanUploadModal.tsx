import React from "react";
import { QUARTERS } from "../constants";

interface PlanUploadModalProps {
  C: any;
  reps: any[];
  user_role: any;
  isRH: boolean;
  isNSH: boolean;
  isStrategy: boolean;
  isCRORole: boolean;
  planUploadForm: any;
  setPlanUploadForm: React.Dispatch<React.SetStateAction<any>>;
  clientMasterList: string[];
  deals: any[];
  setDeals: any;
  targetSubs: any[];
  setTargetSubs: any;
  TODAY: string;
  parseCurrency: (v: string) => number;
  fmtR: (v: number) => string;
  showToast: (msg: string, type?: string) => void;
  onClose: () => void;
}

export function PlanUploadModal({
  C, reps, user_role, isRH, isNSH, isStrategy, isCRORole,
  planUploadForm, setPlanUploadForm, clientMasterList, deals, setDeals,
  targetSubs, setTargetSubs, TODAY, parseCurrency, fmtR, showToast, onClose,
}: PlanUploadModalProps) {
  const chainSteps = isRH
    ? [{s:"RH",done:true},{s:"NSH",done:false},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
    : isNSH
    ? [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
    : isStrategy
    ? [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:false}]
    : [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:true}];

  const chainLabel = isRH?"NSH level":isNSH?"Sales Strategy level":isStrategy?"CRO level":isCRORole?"final approval (auto-approved)":"NSH level";

  const handleSubmit = () => {
    const parsedRepId = parseInt(planUploadForm.repId);
    const validClients = planUploadForm.clients.filter((c:any) => c.clientCompany.trim() && c.targetAmount);
    if (!parsedRepId) { showToast("Select a sales rep","err"); return; }
    if (!validClients.length) { showToast("Add at least one client with a target","err"); return; }
    const rep = reps.find((r:any) => r.id === parsedRepId);
    const initStatus = isRH?"Pending NSH":isNSH?"Pending Strategy":isStrategy?"Pending CRO":isCRORole?"Approved":"Pending NSH";
    const steps = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO"];
    const startIdx = steps.indexOf(initStatus);
    const skipLog = steps.slice(0, startIdx).map(step => ({step, by: user_role?.name||"", at: TODAY, note:`Plan uploaded by ${user_role?.role}`}));
    const clients = validClients.map((c:any) => ({clientCompany:c.clientCompany.trim(),dealType:c.dealType,targetAmount:parseCurrency(c.targetAmount)}));
    const total = clients.reduce((s:number,c:any) => s + (c.targetAmount||0), 0);
    const sub = {
      id:`ts${Date.now()}`, repId:parsedRepId, repName:rep?.name||"", region:rep?.region||"",
      quarter:planUploadForm.quarter, clients, totalTarget:total,
      ...(initStatus==="Approved" ? {frozenTarget: total} : {}),
      status:initStatus, submittedAt:TODAY,
      submittedByName:user_role?.name||"", submittedByRole:user_role?.role||"",
      approvalLog:skipLog,
    };
    if (initStatus === "Approved") {
      const newDeals: any[] = clients
        .filter((cl:any) => !(deals as any[]).find((d:any) => d.repId===parsedRepId && d.clientCompany===cl.clientCompany && d.quarter===planUploadForm.quarter))
        .map((cl:any) => ({
          id:`d_plan_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          repId:parsedRepId, repName:rep?.name||"", region:rep?.region||"",
          clientCompany:cl.clientCompany, contactName:"", designation:"", contactLevel:"", phone:"", email:"",
          dealType:cl.dealType, outcome:"Needs Callback",
          amount:cl.targetAmount, targetAmount:cl.targetAmount,
          priority:"Regular", quarter:planUploadForm.quarter,
          notes:`Plan uploaded by ${user_role?.role}`,
          nextStep:"", nextStepDate:null, lastContact:TODAY, reqs:[], auditLog:[],
          awaitingApproval:null, awaitingApprovalSince:null,
        }));
      if (newDeals.length > 0) setDeals((p:any[]) => [...p, ...newDeals]);
      showToast(`Plan auto-approved — ${clients.length} client${clients.length!==1?"s":""} added to ${rep?.name||"rep"}'s targets ✓`);
    } else {
      showToast(`Plan submitted for ${rep?.name||"rep"} — enters at ${initStatus} ✓`);
    }
    setTargetSubs((p:any[]) => [sub, ...p]);
    onClose();
  };

  const summaryText = (()=>{
    const valid = planUploadForm.clients.filter((c:any) => c.clientCompany.trim() && c.targetAmount);
    const total = valid.reduce((s:number,c:any) => s + parseCurrency(c.targetAmount), 0);
    return valid.length > 0 ? `${valid.length} client${valid.length!==1?"s":""} · ${fmtR(total)} total` : "Add at least one client";
  })();

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:580,maxWidth:"95vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.55)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div className="sans" style={{fontWeight:700,fontSize:16,letterSpacing:.5}}>UPLOAD PLAN FOR REP</div>
            <div style={{fontSize:11,color:C.dim,marginTop:4}}>
              This plan enters the approval chain at{" "}
              <span style={{fontWeight:700,color:C.accent}}>{chainLabel}</span>.
              Once fully approved, it shows in the rep's My Targets.
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1,marginLeft:12}}>✕</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:18,flexWrap:"wrap"}}>
          {chainSteps.map((step, i, arr) => (
            <div key={step.s} style={{display:"flex",alignItems:"center"}}>
              <div style={{background:step.done?`${C.green}22`:`${C.accent}18`,border:`1px solid ${step.done?C.green+"55":C.accent+"44"}`,borderRadius:6,padding:"3px 10px",fontSize:10,color:step.done?C.green:C.accent,fontWeight:600,whiteSpace:"nowrap"}}>{step.done&&"✓ "}{step.s}</div>
              {i<arr.length-1&&<div style={{width:14,height:1,background:C.border}}/>}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>SALES REP *</div>
            {(reps as any[]).filter((r:any) => isRH?r.region===user_role?.region:true).length===0
              ? <div style={{padding:"9px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}`,borderRadius:6,color:C.orange,fontSize:12}}>No reps added yet — ask Admin to add reps first.</div>
              : <select value={planUploadForm.repId} onChange={e=>setPlanUploadForm((p:any)=>({...p,repId:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:planUploadForm.repId?C.text:C.muted,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                  <option value="">Select rep…</option>
                  {(reps as any[]).filter((r:any)=>isRH?r.region===user_role?.region:true).map((r:any)=><option key={r.id} value={r.id}>{r.name} · {r.region}</option>)}
                </select>
            }
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>QUARTER *</div>
            <select value={planUploadForm.quarter} onChange={e=>setPlanUploadForm((p:any)=>({...p,quarter:e.target.value}))}
              style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
              {QUARTERS.map(q=><option key={q}>{q}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:8,letterSpacing:".05em",fontWeight:700}}>CLIENT TARGETS</div>
          {(planUploadForm.clients as any[]).map((cl:any,i:number)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.4fr 1.2fr auto",gap:8,marginBottom:7,alignItems:"center"}}>
              {(()=>{
                const val=cl.clientCompany.trim();
                const offList=val.length>0&&clientMasterList.length>0&&!clientMasterList.some(n=>n.toLowerCase()===val.toLowerCase());
                return <input list="cm-list" value={cl.clientCompany} placeholder={clientMasterList.length>0?"Search client list…":`Client ${i+1} name`}
                  onChange={e=>setPlanUploadForm((p:any)=>({...p,clients:p.clients.map((c:any,j:number)=>j===i?{...c,clientCompany:e.target.value}:c)}))}
                  style={{padding:"8px 10px",background:C.s2,border:`1px solid ${offList?C.orange:C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}} title={offList?`"${val}" not in approved client list`:undefined}/>;
              })()}
              <select value={cl.dealType}
                onChange={e=>setPlanUploadForm((p:any)=>({...p,clients:p.clients.map((c:any,j:number)=>j===i?{...c,dealType:e.target.value}:c)}))}
                style={{padding:"8px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                {["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"].map(d=><option key={d}>{d}</option>)}
              </select>
              <input value={cl.targetAmount} placeholder="Target e.g. 50L"
                onChange={e=>setPlanUploadForm((p:any)=>({...p,clients:p.clients.map((c:any,j:number)=>j===i?{...c,targetAmount:e.target.value}:c)}))}
                style={{padding:"8px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
              {planUploadForm.clients.length>1
                ? <button onClick={()=>setPlanUploadForm((p:any)=>({...p,clients:p.clients.filter((_:any,j:number)=>j!==i)}))}
                    style={{background:`${C.red}18`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",lineHeight:1}}>✕</button>
                : <div style={{width:36}}/>}
            </div>
          ))}
          <button onClick={()=>setPlanUploadForm((p:any)=>({...p,clients:[...p.clients,{clientCompany:"",dealType:"Linear TV",targetAmount:""}]}))}
            style={{background:`${C.blue}18`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:2}}>
            + Add Client
          </button>
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,color:C.muted}}>{summaryText}</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{padding:"9px 18px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
            <button onClick={handleSubmit}
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:6,padding:"9px 22px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
              {isCRORole?"Submit & Auto-Approve ✓":"Submit Plan →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
