import React from "react";
import { DEAL_TYPES, CONTACT_LEVELS, QUARTERS } from "../constants";

interface AddDealModalProps {
  C: any;
  dealForm: any;
  setDealForm: React.Dispatch<React.SetStateAction<any>>;
  reps: any[];
  user_role: any;
  isRep: boolean;
  isRH: boolean;
  targetSubs: any[];
  deals: any[];
  handleAddDeal: () => void;
  onClose: () => void;
}

export function AddDealModal({
  C, dealForm, setDealForm, reps, user_role, isRep, isRH,
  targetSubs, deals, handleAddDeal, onClose,
}: AddDealModalProps) {
  const formRepId = String(dealForm.repId);
  const approvedTargetClients = (targetSubs as any[])
    .filter((s:any) => String(s.repId)===formRepId && s.status==="Approved")
    .flatMap((s:any) => s.clients||[]);
  const isDuplicateDeal = !!(dealForm.clientCompany && dealForm.dealType && dealForm.quarter &&
    (deals as any[]).some((d:any) =>
      String(d.repId)===formRepId &&
      (d.clientCompany||"").toLowerCase()===(dealForm.clientCompany||"").toLowerCase() &&
      d.quarter===dealForm.quarter &&
      d.dealType===dealForm.dealType
    ));

  const fields = [
    {label:"Contact Name",key:"contactName",type:"text",ph:"Full name"},
    {label:"Designation",key:"designation",type:"text",ph:"e.g. VP Marketing"},
    {label:"Phone",key:"phone",type:"text",ph:"Mobile"},
    {label:"Email",key:"email",type:"text",ph:"email@company.com"},
    {label:"Target Amount * — e.g. 50L or 2.5Cr",key:"targetAmount",type:"text",ph:"50L / 2.5Cr / 5000000"},
    {label:"Expected Amount — likely close (blank = same as target)",key:"amount",type:"text",ph:"50L / 2.5Cr / leave blank"},
    {label:"Next Step",key:"nextStep",type:"text",ph:"Action item"},
    {label:"Next Step Date",key:"nextStepDate",type:"date",ph:""},
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e=>e.stopPropagation()}>
        <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:16}}>ADD NEW DEAL</div>

        {approvedTargetClients.length > 0 && (
          <div style={{background:`${C.accent}08`,border:`1px solid ${C.accent}33`,borderRadius:7,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Target Clients · Quick Pick</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {approvedTargetClients.map((c:any,i:number)=>{
                const isSelected = dealForm.clientCompany.toLowerCase()===(c.clientCompany||"").toLowerCase() && dealForm.dealType===c.dealType;
                return (
                  <button key={i}
                    onClick={()=>setDealForm((p:any)=>({...p,clientCompany:c.clientCompany,dealType:c.dealType||p.dealType,targetAmount:c.targetAmount||p.targetAmount}))}
                    style={{padding:"3px 10px",fontSize:11,borderRadius:4,border:`1px solid ${isSelected?C.accent:C.border}`,background:isSelected?`${C.accent}18`:C.s2,color:isSelected?C.accent:C.text,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:isSelected?700:400}}>
                    {c.clientCompany}{c.dealType?` · ${c.dealType}`:""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isDuplicateDeal && (
          <div style={{background:`${C.orange}10`,border:`1.5px solid ${C.orange}55`,borderRadius:7,padding:"8px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>⚠️</span>
            <div>
              <span style={{fontWeight:700,fontSize:12,color:C.orange}}>Possible duplicate — </span>
              <span style={{fontSize:12,color:C.dim}}>a {dealForm.dealType} deal for <strong>{dealForm.clientCompany}</strong> in {dealForm.quarter} already exists. You can still save this as a new entry.</span>
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label>Client Company *</label>
            <input type="text" value={dealForm.clientCompany||""} onChange={e=>setDealForm((p:any)=>({...p,clientCompany:e.target.value}))} placeholder="Type client company name" />
          </div>
          <div>
            <label>Agency Name (optional)</label>
            <input type="text" value={dealForm.agencyName||""} onChange={e=>setDealForm((p:any)=>({...p,agencyName:e.target.value}))} placeholder="e.g. Madison, Wavemaker…" />
          </div>
          {fields.map(f=>(
            <div key={f.key}><label>{f.label}</label><input type={f.type} placeholder={f.ph} value={dealForm[f.key]||""} onChange={e=>setDealForm((p:any)=>({...p,[f.key]:e.target.value}))} /></div>
          ))}
          <div><label>Assign Rep *</label>
            {isRep
              ? <input readOnly value={(reps as any[]).find((r:any)=>r.id===parseInt(dealForm.repId))?.name||""} style={{color:C.text,background:C.s2,cursor:"default"}} />
              : (reps as any[]).filter((r:any)=>isRH?r.region===user_role?.region:true).length===0
                ? <div style={{padding:"9px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}`,borderRadius:6,color:C.orange,fontSize:12}}>No reps added yet — ask Admin to add reps first.</div>
                : <select value={dealForm.repId} onChange={e=>setDealForm((p:any)=>({...p,repId:e.target.value}))}><option value="">Select</option>{(reps as any[]).filter((r:any)=>isRH?r.region===user_role?.region:true).map((r:any)=><option key={r.id} value={r.id}>{r.name} ({r.region})</option>)}</select>
            }
          </div>
          <div><label>Deal Type</label><select value={dealForm.dealType} onChange={e=>setDealForm((p:any)=>({...p,dealType:e.target.value}))}><option value="">Select</option>{DEAL_TYPES.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label>Contact Level</label><select value={dealForm.contactLevel} onChange={e=>setDealForm((p:any)=>({...p,contactLevel:e.target.value}))}><option value="">Select</option>{CONTACT_LEVELS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label>Priority</label><select value={dealForm.priority} onChange={e=>setDealForm((p:any)=>({...p,priority:e.target.value}))}><option>Top 5</option><option>Regular</option></select></div>
          <div><label>Quarter</label><select value={dealForm.quarter} onChange={e=>setDealForm((p:any)=>({...p,quarter:e.target.value}))}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></div>
        </div>
        <div><label>Notes / Context</label><textarea rows={2} placeholder="Competitor intel, history, strategy..." value={dealForm.notes} onChange={e=>setDealForm((p:any)=>({...p,notes:e.target.value}))} style={{resize:"none"}} /></div>
        <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddDeal}>ADD DEAL</button>
        </div>
      </div>
    </div>
  );
}
