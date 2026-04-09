import React from "react";

interface ExceptionModalProps {
  C: any;
  exceptionModal: any;
  exceptionReason: string;
  setExceptionReason: (v: string) => void;
  user_role: any;
  grantException: () => void;
  onClose: () => void;
}

export function ExceptionModal({ C, exceptionModal, exceptionReason, setExceptionReason, user_role, grantException, onClose }: ExceptionModalProps) {
  if (!exceptionModal) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:460}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:20}}>✦</span>
          <div className="sans" style={{fontSize:16,fontWeight:700}}>Grant Exception</div>
        </div>
        <div style={{fontSize:12,color:C.dim,marginBottom:4}}>For: <strong style={{color:C.text}}>{exceptionModal.repName}</strong></div>
        <div style={{padding:"10px 14px",background:`${C.orange}11`,border:`1px solid ${C.orange}33`,borderRadius:5,marginBottom:16,fontSize:12,color:C.orange}}>
          This will override the absence record in HR and mark this rep as Present. This action is logged permanently with your name, role, and reason. Only Admin or CXO can do this.
        </div>
        <div>
          <label>Reason for exception *</label>
          <textarea rows={3} placeholder="e.g. Client emergency — rep was at site visit with no network access. Verified by CRO." value={exceptionReason} onChange={e=>setExceptionReason(e.target.value)} style={{resize:"none"}} />
        </div>
        <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={grantException}>GRANT EXCEPTION</button>
        </div>
        <div style={{marginTop:12,fontSize:10,color:C.muted,textAlign:"center"}}>Logged as: {user_role?.name||"Admin"} ({user_role?.role}) · {new Date().toLocaleString("en-IN")} · Sent to HR</div>
      </div>
    </div>
  );
}
