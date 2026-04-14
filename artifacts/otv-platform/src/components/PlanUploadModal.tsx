import React from "react";
import { apiFetch } from "../services/api/_client";

// Monthly fields in Indian FY order (April–March)
const MONTHS_FY = [
  {key:"apr",label:"April",   dbKey:"april",     q:0},
  {key:"may",label:"May",     dbKey:"may",        q:0},
  {key:"jun",label:"June",    dbKey:"june",       q:0},
  {key:"jul",label:"July",    dbKey:"july",       q:1},
  {key:"aug",label:"August",  dbKey:"august",     q:1},
  {key:"sep",label:"Sep",     dbKey:"september",  q:1},
  {key:"oct",label:"October", dbKey:"october",    q:2},
  {key:"nov",label:"Nov",     dbKey:"november",   q:2},
  {key:"dec",label:"Dec",     dbKey:"december",   q:2},
  {key:"jan",label:"January", dbKey:"january",    q:3},
  {key:"feb",label:"Feb",     dbKey:"february",   q:3},
  {key:"mar",label:"March",   dbKey:"march",      q:3},
] as const;

const Q_LABELS = ["Q1 (Apr–Jun)","Q2 (Jul–Sep)","Q3 (Oct–Dec)","Q4 (Jan–Mar)"];

interface MonthlyClient {
  agencyName: string;
  clientName: string;
  brandName:  string;
  apr: string; may: string; jun: string;
  jul: string; aug: string; sep: string;
  oct: string; nov: string; dec: string;
  jan: string; feb: string; mar: string;
}

const BLANK_CLIENT: MonthlyClient = {
  agencyName: "", clientName: "", brandName: "",
  apr:"", may:"", jun:"", jul:"", aug:"", sep:"",
  oct:"", nov:"", dec:"", jan:"", feb:"", mar:"",
};

function parseLakh(v: string): number {
  const s = String(v||"").replace(/,/g, "").trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?[Ll]$/.test(s)) return Math.round(parseFloat(s) * 100000);
  if (/^\d+(\.\d+)?[Cc][Rr]?$/.test(s)) return Math.round(parseFloat(s) * 10000000);
  return Math.round(parseFloat(s) || 0);
}

function clientAnnual(c: MonthlyClient): number {
  return MONTHS_FY.reduce((s, m) => s + parseLakh(c[m.key]), 0);
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

  const year: string = planUploadForm.year ?? String(new Date().getFullYear());
  const clients: MonthlyClient[] = Array.isArray(planUploadForm.annualClients) && planUploadForm.annualClients.length > 0
    ? planUploadForm.annualClients
    : [{ ...BLANK_CLIENT }];

  const setYear = (y: string) => setPlanUploadForm((p: any) => ({ ...p, year: y }));
  const setClients = (fn: (prev: MonthlyClient[]) => MonthlyClient[]) =>
    setPlanUploadForm((p: any) => ({ ...p, annualClients: fn(clients) }));
  const setClient = (i: number, patch: Partial<MonthlyClient>) =>
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
    const annualClients = validClients.map(c => ({
      agencyName: c.agencyName.trim() || null,
      clientName: c.clientName.trim(),
      brandName:  c.brandName.trim()  || null,
      // Monthly amounts
      ...Object.fromEntries(MONTHS_FY.map(m => [m.dbKey, parseLakh(c[m.key])])),
    }));

    setSubmitting(true);
    try {
      const id = `ts_annual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      // Compute overall monthly totals (sum across clients)
      const monthlyTotals = Object.fromEntries(
        MONTHS_FY.map(m => [m.dbKey, validClients.reduce((s, c) => s + parseLakh(c[m.key]), 0)])
      );
      const payload = {
        id,
        repId:   parsedRepId,
        repName: rep?.name ?? "",
        region:  rep?.region ?? "",
        year:    parseInt(year),
        clients: annualClients,
        ...monthlyTotals,
      };

      const result: any = await apiFetch("/api/targets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      setTargetSubs((p: any[]) => [result.data, ...p]);
      if (isCRORole) {
        showToast(`Plan auto-approved — ${annualClients.length} client${annualClients.length !== 1 ? "s" : ""} added to ${rep?.name ?? "rep"}'s annual targets ✓`);
      } else {
        showToast(`Annual plan submitted for ${rep?.name ?? "rep"} — enters approval chain ✓`);
      }
      onClose();
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.message ?? "Failed to submit";
      showToast(e?.status === 409 ? msg : "Failed to submit plan — please try again", "err");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:720,maxWidth:"95vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.55)"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div className="sans" style={{fontWeight:700,fontSize:16,letterSpacing:.5}}>UPLOAD ANNUAL PLAN FOR REP</div>
            <div style={{fontSize:11,color:C.dim,marginTop:4}}>
              Monthly targets (April–March). This plan enters the approval chain at{" "}
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

        {/* Client cards with monthly inputs */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:C.dim,marginBottom:10,letterSpacing:".05em",fontWeight:700}}>CLIENT MONTHLY TARGETS</div>

          {clients.map((cl, i) => {
            const qTotals = [0,1,2,3].map(qi=>MONTHS_FY.filter(m=>m.q===qi).reduce((s,m)=>s+parseLakh(cl[m.key]),0));
            const annual  = clientAnnual(cl);
            return (
              <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:10,background:C.s2}}>
                {/* Client identity row */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,flex:1,marginRight:10}}>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:".05em",fontWeight:700}}>AGENCY (OPT.)</div>
                      <input value={cl.agencyName} placeholder="e.g. Dentsu"
                        onChange={e=>setClient(i,{agencyName:e.target.value})}
                        style={{width:"100%",padding:"6px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} />
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:".05em",fontWeight:700}}>CLIENT *</div>
                      <input value={cl.clientName} placeholder="e.g. Tata Motors"
                        onChange={e=>setClient(i,{clientName:e.target.value})}
                        style={{width:"100%",padding:"6px 8px",background:C.surface,border:`1px solid ${cl.clientName?"transparent":C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} />
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:".05em",fontWeight:700}}>BRAND (OPT.)</div>
                      <input value={cl.brandName} placeholder="e.g. Nexon"
                        onChange={e=>setClient(i,{brandName:e.target.value})}
                        style={{width:"100%",padding:"6px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} />
                    </div>
                  </div>
                  <div style={{textAlign:"right",minWidth:70}}>
                    <div style={{fontSize:9,color:C.muted,letterSpacing:".05em",fontWeight:700}}>ANNUAL</div>
                    <div style={{fontSize:13,fontWeight:700,color:annual>0?C.accent:C.muted,marginTop:2}}>{annual>0?fmtR(annual):"—"}</div>
                  </div>
                  {clients.length>1
                    ? <button onClick={()=>setClients(prev=>prev.filter((_,j)=>j!==i))}
                        style={{background:`${C.red}18`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"6px 8px",fontSize:11,cursor:"pointer",marginLeft:8,lineHeight:1}}>✕</button>
                    : <div style={{width:36}}/>
                  }
                </div>

                {/* Monthly inputs — 4 quarter-groups of 3 */}
                {[0,1,2,3].map(qi=>{
                  const qMonths = MONTHS_FY.filter(m=>m.q===qi);
                  return (
                    <div key={qi} style={{marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <span style={{fontSize:9,fontWeight:700,color:C.muted,letterSpacing:".06em",textTransform:"uppercase"}}>{Q_LABELS[qi]}</span>
                        {qTotals[qi]>0&&<span style={{fontSize:10,color:C.green}}>{fmtR(qTotals[qi])}</span>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
                        {qMonths.map(m=>(
                          <div key={m.key}>
                            <div style={{fontSize:8,color:C.muted,marginBottom:2}}>{m.label} (₹)</div>
                            <input value={cl[m.key]} placeholder="0"
                              onChange={e=>setClient(i,{[m.key]:e.target.value} as any)}
                              style={{width:"100%",padding:"5px 7px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",textAlign:"right",boxSizing:"border-box"}} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <button onClick={()=>setClients(prev=>[...prev,{...BLANK_CLIENT}])}
            style={{background:`${C.blue}18`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:2}}>
            + Add Client
          </button>
        </div>

        {/* Grand total */}
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
