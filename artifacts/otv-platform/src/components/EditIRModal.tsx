import React from "react";

interface EditIRModalProps {
  C: any;
  editIrId: string | null;
  irForm: any;
  setIrForm: React.Dispatch<React.SetStateAction<any>>;
  deals: any[];
  user_role: any;
  setInternalReqs: any;
  BLANK_IR_FORM: any;
  showToast: (msg: string, type?: string) => void;
  onClose: () => void;
}

export function EditIRModal({
  C, editIrId, irForm, setIrForm, deals, user_role,
  setInternalReqs, BLANK_IR_FORM, showToast, onClose,
}: EditIRModalProps) {
  const handleSave = () => {
    if (!irForm.subject.trim()) { showToast("Subject is required","err"); return; }
    setInternalReqs((p:any[]) => p.map((r:any) => r.id===editIrId
      ? {...r, type:irForm.type, dept:irForm.dept, subject:irForm.subject.trim(), details:irForm.details.trim(), clientCompany:irForm.clientCompany.trim()}
      : r
    ));
    onClose();
    showToast("Request updated ✓");
  };

  const clientList = [...new Set(
    (deals as any[])
      .filter((d:any) => user_role?.repId ? d.repId===user_role.repId : true)
      .map((d:any) => d.clientCompany)
  )].sort();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:520}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="sans" style={{fontSize:15,fontWeight:700}}>Edit Request</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Request Type *</div>
            <select value={irForm.type} onChange={e=>setIrForm((f:any)=>({...f,type:e.target.value}))}
              style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
              {["Send Proposal","Send FCT Grid","Send Revised Rate Card","Send Sponsorship Deck","Get Budget Approval","Arrange Senior Meeting","Get Rate Approval","Follow Up with Client","Share Digital Plan","Content / Script Needed","Legal / Contract Review","Get PO / Release","Other"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Who do you need it from? *</div>
            <select value={irForm.dept} onChange={e=>setIrForm((f:any)=>({...f,dept:e.target.value}))}
              style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
              {["Region Head","NSH","CXO","Sales Strategy","Digital","Branding Team","Content Team","Finance","Legal","HR"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Subject / What do you need? *</div>
          <input value={irForm.subject} onChange={e=>setIrForm((f:any)=>({...f,subject:e.target.value}))}
            placeholder="e.g. Discount approval — 10% off rate card for Havells"
            style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Client / Account (optional)</div>
          <select value={irForm.clientCompany} onChange={e=>setIrForm((f:any)=>({...f,clientCompany:e.target.value}))}
            style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:irForm.clientCompany?C.text:C.dim,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}>
            <option value="">— Select client —</option>
            {clientList.map((c:any) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Details / Context</div>
          <textarea value={irForm.details} onChange={e=>setIrForm((f:any)=>({...f,details:e.target.value}))}
            rows={4} placeholder="Provide context — client budget, ask, deadline, any relevant background…"
            style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",resize:"vertical",boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
          <button onClick={handleSave} style={{background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
