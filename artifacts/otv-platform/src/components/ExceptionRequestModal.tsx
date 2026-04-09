import React from "react";
import * as attendSvc from "../services/api/attendance";

interface ExceptionRequestModalProps {
  C: any;
  excReqRecord: any;
  excReqForm: any;
  setExcReqForm: React.Dispatch<React.SetStateAction<any>>;
  excReqSubmitting: boolean;
  setExcReqSubmitting: (v: boolean) => void;
  showToast: (msg: string, type?: string) => void;
  fetchAttendanceData: () => void;
  onClose: () => void;
}

export function ExceptionRequestModal({
  C, excReqRecord, excReqForm, setExcReqForm,
  excReqSubmitting, setExcReqSubmitting, showToast, fetchAttendanceData, onClose,
}: ExceptionRequestModalProps) {
  if (!excReqRecord) return null;
  const handleSubmit = () => {
    if (!excReqForm.reason) { showToast("Select a reason","err"); return; }
    setExcReqSubmitting(true);
    attendSvc.createException({date:excReqRecord.date,reason:excReqForm.reason,notes:excReqForm.notes,attendanceRecordId:excReqRecord.id})
      .then(()=>{showToast("Exception request submitted — pending RH approval ✓");onClose();fetchAttendanceData();})
      .catch((err:any)=>showToast(err?.body?.error||"Failed to submit","err"))
      .finally(()=>setExcReqSubmitting(false));
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:480}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
          <div className="sans" style={{fontSize:16,fontWeight:700}}>Request Attendance Exception</div>
        </div>
        <div style={{fontSize:12,color:C.dim,marginBottom:16}}>Date: <strong style={{color:C.text}}>{excReqRecord.date}</strong> · Status: <span style={{color:excReqRecord.status==="absent"?C.red:C.orange,fontWeight:600,textTransform:"capitalize"}}>{excReqRecord.status}</span></div>
        <div style={{padding:"10px 14px",background:`${C.blue}11`,border:`1px solid ${C.blue}33`,borderRadius:5,marginBottom:16,fontSize:12,color:C.blue}}>
          Your request will be routed through: <strong>RH → NSH → CRO → Admin</strong>. Provide a clear reason so approvers can act quickly.
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:C.dim,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Reason *</label>
          <select value={excReqForm.reason} onChange={e=>setExcReqForm((f:any)=>({...f,reason:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text}}>
            <option value="">— Select reason —</option>
            {["Client Visit / Field Work","WFH (Work From Home)","Approved Leave","Travel / No Network","Medical Emergency","System / App Issue","Other"].map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:C.dim,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Additional Notes</label>
          <textarea rows={3} value={excReqForm.notes} onChange={e=>setExcReqForm((f:any)=>({...f,notes:e.target.value}))} placeholder="e.g. Was at site visit with XYZ client from 9am–7pm. Mentioned to RH via WhatsApp." style={{resize:"vertical",width:"100%",boxSizing:"border-box"}} />
        </div>
        <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose} disabled={excReqSubmitting}>Cancel</button>
          <button className="btn btn-primary" disabled={!excReqForm.reason||excReqSubmitting} onClick={handleSubmit}>{excReqSubmitting?"Submitting…":"Submit to RH →"}</button>
        </div>
      </div>
    </div>
  );
}
