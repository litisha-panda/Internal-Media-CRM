import React from "react";
import { apiFetch } from "../services/api/_client";

interface AnnualClient {
  agencyName: string;
  clientName: string;
  brandName:  string;
  q1Target:   string;
  q2Target:   string;
  q3Target:   string;
  q4Target:   string;
}

const BLANK_CLIENT: AnnualClient = {
  agencyName: "", clientName: "", brandName: "",
  q1Target: "", q2Target: "", q3Target: "", q4Target: "",
};

function parseLakh(v: string): number {
  const s = String(v).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function clientAnnual(c: AnnualClient): number {
  return parseLakh(c.q1Target) + parseLakh(c.q2Target) + parseLakh(c.q3Target) + parseLakh(c.q4Target);
}

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
  C, reps, user_role, isRH, isNSH, isCRORole,
  planUploadForm, setPlanUploadForm,
  targetSubs, setTargetSubs, TODAY, fmtR, showToast, onClose,
}: PlanUploadModalProps) {
  const chainSteps = isRH
    ? [{s:"RH",done:true},{s:"NSH",done:false},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
    : isNSH
    ? [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
    : (planUploadForm as any).isStrategy
    ? [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:false}]
    : [{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:true}];

  const chainLabel = isRH?"NSH level":isNSH?"Sales Strategy level":isCRORole?"final approval (auto-approved)":"NSH level";

  const year: string  = planUploadForm.year ?? String(new Date().getFullYear());
  const clients: AnnualClient[] = Array.isArray(planUploadForm.annualClients) && planUploadForm.annualClients.length > 0
    ? planUploadForm.annualClients
    : [{ ...BLANK_CLIENT }];

  const setYear = (y: string) => setPlanUploadForm((p: any) => ({ ...p, year: y }));
  const setClients = (fn: (prev: AnnualClient[]) => AnnualClient[]) =>
    setPlanUploadForm((p: any) => ({ ...p, annualClients: fn(clients) }));

  const setClient = (i: number, patch: Partial<AnnualClient>) =>
    setClients(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));

  const grandTotal = clients.reduce((s, c) => s + clientAnnual(c), 0);

  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    const parsedRepId = parseInt(planUploadForm.repId);
    const validClients = clients.filter(c => c.clientName.trim() && clientAnnual(c) > 0);
    if (!parsedRepId) { showToast("Select a sales rep", "err"); return; }
    if (!validClients.length) { showToast("Add at least one client with a non-zero target", "err"); return; }
    if (!year || isNaN(parseInt(year))) { showToast("Enter a valid year", "err"); return; }

    const rep = reps.find((r: any) => r.id === parsedRepId);
    const initStatus = isRH?"Pending NSH":isNSH?"Pending Strategy":isCRORole?"Approved":"Pending NSH";
    const annualClients = validClients.map(c => ({
      agencyName: c.agencyName.trim() || null,
      clientName: c.clientName.trim(),
      brandName:  c.brandName.trim()  || null,
      q1Target:   parseLakh(c.q1Target),
      q2Target:   parseLakh(c.q2Target),
      q3Target:   parseLakh(c.q3Target),
      q4Target:   parseLakh(c.q4Target),
    }));

    setSubmitting(true);
    try {
      const id = `ts_annual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        id,
        repId:   parsedRepId,
        repName: rep?.name ?? "",
        region:  rep?.region ?? "",
        year:    parseInt(year),
        clients: annualClients,
      };

      const result: any = await apiFetch("/api/targets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      setTargetSubs((p: any[]) => [result.data, ...p]);

      if (initStatus === "Approved") {
        showToast(`Plan auto-approved — ${annualClients.length} client${annualClients.length !== 1 ? "s" : ""} added to ${rep?.name ?? "rep"}'s annual targets ✓`);
      } else {
        showToast(`Annual plan submitted for ${rep?.name ?? "rep"} — enters at ${initStatus} ✓`);
      }
      onClose();
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.message ?? "Failed to submit";
      if (e?.status === 409) {
        showToast(`${msg}`, "err");
      } else {
        showToast("Failed to submit plan — please try again", "err");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:700,maxWidth:"95vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.55)"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div className="sans" style={{fontWeight:700,fontSize:16,letterSpacing:.5}}>UPLOAD ANNUAL PLAN FOR REP</div>
            <div style={{fontSize:11,color:C.dim,marginTop:4}}>
              Annual targets (Q1–Q4). This plan enters the approval chain at{" "}
              <span style={{fontWeight:700,color:C.accent}}>{chainLabel}</span>.
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1,marginLeft:12}}>✕</button>
        </div>

        {/* Approval chain progress */}
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:18,flexWrap:"wrap"}}>
          {chainSteps.map((step, i, arr) => (
            <div key={step.s} style={{display:"flex",alignItems:"center"}}>
              <div style={{background:step.done?`${C.green}22`:`${C.accent}18`,border:`1px solid ${step.done?C.green+"55":C.accent+"44"}`,borderRadius:6,padding:"3px 10px",fontSize:10,color:step.done?C.green:C.accent,fontWeight:600,whiteSpace:"nowrap"}}>
                {step.done&&"✓ "}{step.s}
              </div>
              {i<arr.length-1&&<div style={{width:14,height:1,background:C.border}}/>}
            </div>
          ))}
        </div>

        {/* Rep + Year selectors */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>SALES REP *</div>
            {(reps as any[]).filter((r:any)=>isRH?r.region===user_role?.region:true).length===0
              ? <div style={{padding:"9px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}`,borderRadius:6,color:C.orange,fontSize:12}}>No reps added yet.</div>
              : <select value={planUploadForm.repId ?? ""} onChange={e=>setPlanUploadForm((p:any)=>({...p,repId:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:planUploadForm.repId?C.text:C.muted,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                  <option value="">Select rep…</option>
                  {(reps as any[]).filter((r:any)=>isRH?r.region===user_role?.region:true).map((r:any)=>(
                    <option key={r.id} value={r.id}>{r.name} · {r.region}</option>
                  ))}
                </select>
            }
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>YEAR *</div>
            <input type="number" value={year} onChange={e=>setYear(e.target.value)} min={2020} max={2050}
              style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} />
          </div>
        </div>

        {/* Client rows: agencyName, clientName, brandName, Q1–Q4 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:8,letterSpacing:".05em",fontWeight:700}}>CLIENT ANNUAL TARGETS</div>

          {/* Column headers */}
          <div style={{display:"grid",gridTemplateColumns:"1.4fr 1.4fr 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr auto",gap:6,marginBottom:4}}>
            {["Agency","Client *","Brand","Q1","Q2","Q3","Q4","Annual",""].map(h=>(
              <div key={h} style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",paddingLeft:2}}>{h}</div>
            ))}
          </div>

          {clients.map((cl, i) => {
            const annual = clientAnnual(cl);
            return (
              <div key={i} style={{display:"grid",gridTemplateColumns:"1.4fr 1.4fr 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr auto",gap:6,marginBottom:6,alignItems:"center"}}>
                <input value={cl.agencyName} placeholder="Agency"
                  onChange={e=>setClient(i,{agencyName:e.target.value})}
                  style={{padding:"7px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}} />
                <input value={cl.clientName} placeholder="Client *"
                  onChange={e=>setClient(i,{clientName:e.target.value})}
                  style={{padding:"7px 8px",background:C.s2,border:`1px solid ${cl.clientName?"transparent":C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}} />
                <input value={cl.brandName} placeholder="Brand"
                  onChange={e=>setClient(i,{brandName:e.target.value})}
                  style={{padding:"7px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}} />
                {(["q1Target","q2Target","q3Target","q4Target"] as const).map(q=>(
                  <input key={q} value={(cl as any)[q]} placeholder="0"
                    onChange={e=>setClient(i,{[q]:e.target.value} as Partial<AnnualClient>)}
                    style={{padding:"7px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",textAlign:"right"}} />
                ))}
                <div style={{fontSize:11,fontWeight:700,color:annual>0?C.accent:C.muted,textAlign:"right",paddingRight:2}}>
                  {annual>0?fmtR(annual):"—"}
                </div>
                {clients.length>1
                  ? <button onClick={()=>setClients(prev=>prev.filter((_,j)=>j!==i))}
                      style={{background:`${C.red}18`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"6px 8px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",lineHeight:1}}>✕</button>
                  : <div style={{width:28}}/>}
              </div>
            );
          })}

          <button onClick={()=>setClients(prev=>[...prev,{...BLANK_CLIENT}])}
            style={{background:`${C.blue}18`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:2}}>
            + Add Client Row
          </button>
        </div>

        {/* Grand total row */}
        {grandTotal > 0 && (
          <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}30`,borderRadius:6,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.dim,fontWeight:600}}>
              {clients.filter(c=>c.clientName.trim()&&clientAnnual(c)>0).length} client{clients.filter(c=>c.clientName.trim()&&clientAnnual(c)>0).length!==1?"s":""} · Annual Total
            </span>
            <span className="sans" style={{fontSize:20,fontWeight:700,color:C.accent}}>{fmtR(grandTotal)}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} disabled={submitting}
            style={{padding:"9px 18px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:6,padding:"9px 22px",fontSize:12,cursor:submitting?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,opacity:submitting?0.7:1}}>
            {submitting?"Submitting…":isCRORole?"Submit & Auto-Approve ✓":"Submit Annual Plan →"}
          </button>
        </div>

      </div>
    </div>
  );
}
