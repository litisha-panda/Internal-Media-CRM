import { useState, useRef, useEffect, useCallback } from "react";
import { C, fmt, fmtR, daysSince, riskColor, riskLabel, oColor, lColor } from "../utils";
import {
  REGIONS, DEAL_TYPES, CONTACT_LEVELS, OUTCOMES, DEPARTMENTS, REQ_STATUS,
  SLA, QUARTERS, STAGE_PROB, TODAY, D1, D3, D7, D14, HR_EMAIL, DEADLINE,
  SEED_DEALS, SEED_MEETINGS, SEED_ATT, SEED_ABSENCE_REPORTS, USER_ROLES, REPS,
  Deal, Meeting, AttRecord, Req
} from "../data";
import { roNormalizeChannel, roBuildExport, roFmtMoney, ALL_CHANNELS } from "../roEngine";

// Global XLSX cdn loader
let _xlsxLoaded = false, _xlsxPromise: Promise<any> | null = null;
function loadXLSX() {
  if (_xlsxLoaded) return Promise.resolve((window as any).XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => { _xlsxLoaded = true; res((window as any).XLSX); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

type AbsenceReport = typeof SEED_ABSENCE_REPORTS[0];

// ── ROCard Component ──────────────────────────────────────────────────────────
function ROCard({ result, onExport }: { result: any; onExport: (r: any) => void }) {
  const [tab, setTab] = useState("overview");
  const ch = roNormalizeChannel(result.channel || "");
  const { dealRow, breakupRows, summaryRow } = roBuildExport(result);
  const company = (ch === "Odisha TV" || ch === "Prarthana") ? "Odisha Television Ltd" : "Tarang Broadcasting Company Ltd";
  const tabs = ["overview","zoho routing","deal breakup","summary"];
  return (
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div style={{background:C.s2,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div className="sans" style={{fontWeight:700,fontSize:15}}>{result.client_name || "—"}</div>
          <div style={{fontSize:11,color:C.dim,marginTop:2}}>
            {ch && <span style={{background:"#1a1a3a",color:C.purple,padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:600,marginRight:6}}>{ch}</span>}
            RO# {result.ro_number||"—"} · {result.agency_name||"Direct"} · {result.start_date||""}–{result.end_date||""}
          </div>
        </div>
        <button onClick={()=>onExport(result)} className="btn btn-primary" style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff"}}>Export XLSX →</button>
      </div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,background:C.s2}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"8px 16px",background:"transparent",border:"none",borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",color:tab===t?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:tab===t?600:400,letterSpacing:".04em",textTransform:"capitalize"}}>
            {t}
          </button>
        ))}
      </div>
      <div style={{padding:16}}>
        {tab==="overview" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              ["Channel",ch||"—"],["Client",result.client_name||"—"],["Agency",result.agency_name||"Direct"],
              ["Brand",result.brand_name||"—"],["RO Number",result.ro_number||"—"],
              ["RO Date",result.ro_date||"—"],["Period",`${result.start_date||""}–${result.end_date||""}`],
              ["Gross Amount",result.gross_amount?roFmtMoney(result.gross_amount):"—"],
              ["Discount",result.discount_amount?roFmtMoney(result.discount_amount):"—"],
              ["Agency Commission",result.agency_commission_amount?roFmtMoney(result.agency_commission_amount):"—"],
              ["Payment Terms",result.payment_terms||"—"],["Total Spots",result.spot_items?.length||0],
            ].map(([k,v])=>(
              <div key={k as string} style={{background:C.s2,padding:"8px 11px",borderRadius:5}}>
                <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{k}</div>
                <div style={{fontSize:13,color:C.text,fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {tab==="zoho routing" && (
          <div>
            <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#16c784"}}>
              ⚠ Warning: Leave "Contract Type" and "Secondary Type" blank — fill these in Zoho directly.
            </div>
            {[
              ["Company", company],["Channel (Zoho)", ch],["Pipeline","Deals"],["Deal Type",result.deal_type||"—"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{width:180,fontSize:10,color:C.dim,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{k}</div>
                <div style={{color:C.text,fontSize:13}}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {tab==="deal breakup" && (
          <div style={{overflowX:"auto"}}>
            {breakupRows.length===0
              ? <div style={{color:C.dim,fontSize:12,padding:20,textAlign:"center"}}>No spot items parsed.</div>
              : <table style={{fontSize:11,minWidth:900}}>
                  <thead><tr>
                    {["#","Channel","Programme / Timeband","Start","End","Type","Inventory","Rate","PT/NPT","FCT/NFCT"].map(h=><th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {breakupRows.map((row:any,i:number)=>(
                      <tr key={i}>
                        <td>{row["Deal Line No"]}</td>
                        <td>{row["Channel"]}</td>
                        <td style={{maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row["Timeband Name"]}</td>
                        <td>{row["Start Time"]}</td>
                        <td>{row["End Time"]}</td>
                        <td><span style={{background:row["Spot Type"]==="Bonus"?"#0a1a0a":"#1a1a3a",color:row["Spot Type"]==="Bonus"?"#16c784":C.purple,padding:"1px 6px",borderRadius:8,fontSize:10}}>{row["Spot Type"]}</span></td>
                        <td>{row["Inventory"]}</td>
                        <td>{row["Rate"]}</td>
                        <td><span style={{color:row["PT/NPT"]==="PT"?C.orange:C.dim,fontSize:10,fontWeight:600}}>{row["PT/NPT"]}</span></td>
                        <td><span style={{color:row["FCT/NFCT"]==="NFCT"?C.red:C.green,fontSize:10,fontWeight:600}}>{row["FCT/NFCT"]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}
        {tab==="summary" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {Object.entries(summaryRow).map(([k,v])=>(
              <div key={k} style={{background:C.s2,padding:"8px 11px",borderRadius:5}}>
                <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{k}</div>
                <div style={{fontSize:13,color:C.text}}>{String(v)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function OTVApp() {
  // Auth
  const [screen, setScreen] = useState<"login"|"home"|"app">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [regMode, setRegMode] = useState(false);

  // App state
  const [activeUser, setActiveUser] = useState("admin");
  const [appMode, setAppMode] = useState<"ro"|"crm">("crm");
  const [view, setView] = useState("warroom");
  const [filterRegion, setFilterRegion] = useState("All");
  const [filterQ, setFilterQ] = useState("Q1 FY26");
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null);

  // CRM state
  const [deals, setDeals] = useState<Deal[]>(SEED_DEALS);
  const [meetings, setMeetings] = useState<Meeting[]>(SEED_MEETINGS);
  const [attendance, setAttendance] = useState<AttRecord>(SEED_ATT);
  const [absenceReports, setAbsenceReports] = useState<AbsenceReport[]>(SEED_ABSENCE_REPORTS);
  const [exceptionModal, setExceptionModal] = useState<AbsenceReport|null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [expandedDeal, setExpandedDeal] = useState<string|null>(null);
  const [logModal, setLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ dealId:"", clientCompany:"", contactName:"", contactLevel:"VP / GM", outcome:"Very Interested", discussion:"", nextStep:"" });
  const [addDealModal, setAddDealModal] = useState(false);
  const [newDeal, setNewDeal] = useState<Partial<Deal>>({ region:"North", dealType:"Linear TV", outcome:"Very Interested", contactLevel:"VP / GM", quarter:"Q1 FY26" });

  // RO state
  const [savedROs, setSavedROs] = useState<any[]>([]);
  const [roFiles, setRoFiles] = useState<File[]>([]);
  const [roInputText, setRoInputText] = useState("");
  const [roResults, setRoResults] = useState<any[]>([]);
  const [roActiveDoc, setRoActiveDoc] = useState(0);
  const [roLoading, setRoLoading] = useState(false);
  const [roProgress, setRoProgress] = useState("");
  const [roError, setRoError] = useState<string|null>(null);
  const [roSearch, setRoSearch] = useState("");
  const [roMgmtChannel, setRoMgmtChannel] = useState("all");
  const [roMgmtStatus, setRoMgmtStatus] = useState("all");
  const [roMgmtViewRO, setRoMgmtViewRO] = useState<any>(null);
  const [roMgmtConfirmDelete, setRoMgmtConfirmDelete] = useState<string|null>(null);
  const roFileRef = useRef<HTMLInputElement>(null!);

  // Meeting log modal
  const [meetingLogModal, setMeetingLogModal] = useState(false);
  const [mlForm, setMlForm] = useState({ clientCompany:"", contactName:"", contactLevel:"VP / GM", outcome:"Very Interested", discussion:"", nextStep:"" });

  const user_role = USER_ROLES.find(u=>u.id===activeUser) || USER_ROLES[0];
  const user = { name: user_role.name };

  const showToast = useCallback((msg: string, type="ok") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  },[]);

  // Filtered deals
  const visibleDeals = deals.filter(d => {
    if (user_role.canView === "self") return d.repId === user_role.repId;
    if (user_role.canView === "region") return d.region === user_role.region;
    if (filterRegion !== "All") return d.region === filterRegion;
    return true;
  }).filter(d => d.quarter === filterQ);

  const closedDeals = visibleDeals.filter(d=>d.outcome==="Proposal Accepted");
  const closed = closedDeals.reduce((s,d)=>s+d.amount,0);
  const forecast = visibleDeals.reduce((s,d)=>s+(d.amount*(STAGE_PROB[d.outcome]||0)/100),0);
  const totalTarget = REPS.filter(r=>{
    if (user_role.canView==="all") return filterRegion==="All" || r.region===filterRegion;
    if (user_role.canView==="region") return r.region===user_role.region;
    if (user_role.canView==="self") return r.id===user_role.repId;
    return true;
  }).reduce((s,r)=>s+r.target,0);
  const fcastPct = totalTarget>0 ? Math.round(forecast/totalTarget*100) : 0;

  const allReqs = visibleDeals.flatMap(d=>d.reqs.map(r=>({...r, dealId:d.id, clientCompany:d.clientCompany})));
  const overdueReqs = allReqs.filter(r=>r.status==="Overdue");

  // Visible meetings
  const visMeetings = meetings.filter(m=>{
    if (user_role.canView==="self") return m.repId===user_role.repId;
    if (user_role.canView==="region") return m.region===user_role.region;
    if (filterRegion!=="All") return m.region===filterRegion;
    return true;
  });

  // Attendance helpers
  const getAttStatus = (repId: number, date: string): string => {
    const att = attendance[date];
    if (!att) return "No Data";
    if (att[repId] === true) return "Logged";
    if (att[repId] === false) return "Absent";
    return "No Data";
  };

  // Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = JSON.parse(localStorage.getItem("otv_users")||"[]");
    const found = stored.find((u:any) => u.email===loginEmail && u.pass===loginPass);
    if (found || (loginEmail==="admin@otv.com" && loginPass==="admin123")) {
      setScreen("home");
    } else {
      setLoginError("Invalid email or password.");
    }
  };
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = JSON.parse(localStorage.getItem("otv_users")||"[]");
    stored.push({email:loginEmail,pass:loginPass});
    localStorage.setItem("otv_users",JSON.stringify(stored));
    setRegMode(false);
    setLoginError("Registered! Please sign in.");
  };

  // Deal actions
  const updateDealOutcome = (id: string, outcome: string) => {
    setDeals(prev=>prev.map(d=>d.id===id?{...d,outcome}:d));
    showToast("Deal stage updated");
  };
  const updateReqStatus = (dealId: string, reqIdx: number, status: string) => {
    setDeals(prev=>prev.map(d=>{
      if (d.id!==dealId) return d;
      const reqs=[...d.reqs]; reqs[reqIdx]={...reqs[reqIdx],status};
      return {...d,reqs};
    }));
  };

  // Meeting log
  const logMeeting = () => {
    const now = new Date();
    const loggedAt = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const [dH,dM]=DEADLINE.split(":").map(Number);
    const late = now.getHours()>dH||(now.getHours()===dH&&now.getMinutes()>dM);
    const repInfo = REPS.find(r=>r.id===user_role.repId)||REPS[0];
    const nm: Meeting = {
      id:"ml"+Date.now(), repId:repInfo.id, repName:repInfo.name,
      region:repInfo.region, dealId:"", clientCompany:mlForm.clientCompany,
      contactName:mlForm.contactName, contactLevel:mlForm.contactLevel,
      outcome:mlForm.outcome, discussion:mlForm.discussion, nextStep:mlForm.nextStep,
      date:TODAY, loggedAt, late
    };
    setMeetings(prev=>[nm,...prev]);
    if (late) {
      setAttendance(prev=>({...prev,[TODAY]:{...prev[TODAY],[repInfo.id]:true}}));
    } else {
      setAttendance(prev=>({...prev,[TODAY]:{...prev[TODAY],[repInfo.id]:true}}));
    }
    setMeetingLogModal(false);
    setMlForm({ clientCompany:"", contactName:"", contactLevel:"VP / GM", outcome:"Very Interested", discussion:"", nextStep:"" });
    showToast("Meeting logged");
  };

  // Add deal
  const addDeal = () => {
    const repInfo = REPS.find(r=>r.region===newDeal.region)||REPS[0];
    const d: Deal = {
      id:"d"+Date.now(), repId:repInfo.id, clientCompany:newDeal.clientCompany||"",
      contactName:newDeal.contactName||"", designation:newDeal.designation||"",
      contactLevel:newDeal.contactLevel||"VP / GM", phone:newDeal.phone||"", email:newDeal.email||"",
      dealType:newDeal.dealType||"Linear TV", outcome:newDeal.outcome||"Very Interested",
      amount:newDeal.amount||0, targetAmount:newDeal.targetAmount||0,
      region:newDeal.region||"North", lastContact:TODAY,
      nextStep:newDeal.nextStep||"", nextStepDate:newDeal.nextStepDate||null,
      reqs:[], notes:newDeal.notes||"", priority:"Regular", quarter:newDeal.quarter||filterQ
    };
    setDeals(prev=>[d,...prev]);
    setAddDealModal(false);
    setNewDeal({ region:"North", dealType:"Linear TV", outcome:"Very Interested", contactLevel:"VP / GM", quarter:"Q1 FY26" });
    showToast("Deal added");
  };

  // RO parser
  const roParseAll = async () => {
    if (!roFiles.length && !roInputText.trim()) return;
    setRoLoading(true); setRoResults([]); setRoError(null);
    try {
      const apiKey = (window as any).__ANTHROPIC_KEY || "";
      const results: any[] = [];
      if (roFiles.length > 0) {
        for (let i=0; i<roFiles.length; i++) {
          const f = roFiles[i];
          setRoProgress(`Parsing ${i+1}/${roFiles.length}: ${f.name}...`);
          const res = await callClaudeForRO(f, apiKey);
          if (Array.isArray(res)) results.push(...res);
          else if (res) results.push(res);
        }
      } else {
        setRoProgress("Parsing text...");
        const res = await callClaudeForROText(roInputText, apiKey);
        if (Array.isArray(res)) results.push(...res);
        else if (res) results.push(res);
      }
      setRoResults(results);
      setRoActiveDoc(0);
    } catch(e:any) {
      setRoError(String(e?.message||e));
    } finally {
      setRoLoading(false); setRoProgress("");
    }
  };

  const callClaudeForROText = async (text: string, apiKey: string) => {
    const resp = await fetch("/api/parse-ro", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text})
    });
    if (!resp.ok) throw new Error("API error: "+resp.status);
    return resp.json();
  };

  const callClaudeForRO = async (file: File, apiKey: string) => {
    if (file.name.endsWith(".txt")||file.name.endsWith(".csv")) {
      const text = await file.text();
      return callClaudeForROText(text, apiKey);
    }
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch("/api/parse-ro-file", { method:"POST", body:formData });
    if (!resp.ok) throw new Error("API error: "+resp.status);
    return resp.json();
  };

  const roExportSingle = async (r: any) => {
    try {
      const XLSX = await loadXLSX();
      const { dealRow, breakupRows, summaryRow } = roBuildExport(r);
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet([dealRow]);
      ws1["!cols"] = Array(30).fill({wch:20});
      XLSX.utils.book_append_sheet(wb,ws1,"Deal");
      if (breakupRows.length) {
        const ws2 = XLSX.utils.json_to_sheet(breakupRows);
        ws2["!cols"] = Array(30).fill({wch:16});
        XLSX.utils.book_append_sheet(wb,ws2,"Deal Breakup");
      }
      const ws3 = XLSX.utils.json_to_sheet([summaryRow]);
      ws3["!cols"] = Array(20).fill({wch:20});
      XLSX.utils.book_append_sheet(wb,ws3,"Summary");
      const ch = roNormalizeChannel(r.channel||"");
      XLSX.writeFile(wb,`RO_${r.client_name||"client"}_${ch||"channel"}.xlsx`);
      setSavedROs(prev=>prev.map(ro=>ro.id===r._savedId?{...ro,status:"Exported"}:ro));
      showToast("Exported successfully");
    } catch(e:any) {
      showToast("Export failed: "+e?.message, "err");
    }
  };

  const roExportAll = () => roResults.forEach(r=>roExportSingle(r));

  const roSaveResult = (r: any) => {
    const id = "ro"+Date.now();
    setSavedROs(prev=>[{
      id, data:{...r,_savedId:id}, client_name:r.client_name, brand_name:r.brand_name,
      channel:r.channel, ro_number:r.ro_number, agency_name:r.agency_name,
      gross_amount:r.gross_amount, savedAt:new Date().toISOString(), status:"Parsed"
    },...prev]);
    showToast("Saved to RO Management");
    // Auto-map to CRM
    setDeals(prev=>prev.map(d=>{
      if (d.clientCompany?.toLowerCase()===r.client_name?.toLowerCase() && d.outcome!=="Proposal Accepted") {
        return {...d, outcome:"Proposal Accepted", amount:r.gross_amount||d.amount, roLinked:id};
      }
      return d;
    }));
  };

  // HR Exception
  const grantException = () => {
    if (!exceptionModal || !exceptionReason.trim()) return;
    setAbsenceReports(prev=>prev.map(r=>r.id===exceptionModal.id?{
      ...r, status:"Exception Granted", markedAs:"Present", exception:"Overridden",
      exceptionBy:user_role.name, exceptionReason:exceptionReason.trim()
    }:r));
    setExceptionModal(null); setExceptionReason("");
    showToast("Exception granted");
  };

  const canGrantException = user_role.role==="ADMIN" || user_role.role==="CXO";

  // Navigation
  const ALL_NAV = [
    {id:"warroom",    label:"War Room",    icon:"◈", group:"crm"},
    {id:"pipeline",   label:"Pipeline",    icon:"⬡", group:"crm"},
    {id:"targets",    label:"Targets",     icon:"◎", group:"crm"},
    {id:"team",       label:"Team",        icon:"◇", group:"crm"},
    {id:"activity",   label:"Activity",    icon:"≡", group:"crm"},
    {id:"escalations",label:"Escalations", icon:"▲", badge:overdueReqs.length||0, group:"crm"},
    {id:"compliance", label:"Compliance",  icon:"✦", group:"crm"},
    {id:"hr",         label:"HR Reports",  icon:"⊘", badge:absenceReports.filter(r=>r.markedAs==="Absent"&&r.status==="Sent to HR").length||0, group:"crm"},
    {id:"ro-parser",    label:"RO Parser",   icon:"⟨/⟩", group:"ro"},
    {id:"ro-management",label:"RO Library",  icon:"☰",    group:"ro"},
  ];
  const nav = appMode==="ro" ? ALL_NAV.filter(n=>n.group==="ro") : ALL_NAV.filter(n=>n.group==="crm");

  const cs = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e2d3d;border-radius:2px}
    .sans{font-family:'DM Sans',sans-serif}
    input,select,textarea{font-family:'DM Mono',monospace;font-size:12px;color:${C.text};background:${C.s2};border:1px solid ${C.border};border-radius:4px;padding:7px 10px;outline:none;width:100%;transition:border-color .15s}
    input:focus,select:focus,textarea:focus{border-color:${C.accent}}
    select option{background:${C.s2}}
    .card{background:${C.surface};border:1px solid ${C.border};border-radius:6px}
    .row{background:${C.surface};border:1px solid ${C.border};border-radius:5px;padding:11px 14px;margin-bottom:6px;transition:border-color .15s}
    .row:hover{border-color:#2d4a6b}
    .btn{padding:7px 16px;border:none;border-radius:4px;cursor:pointer;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;transition:opacity .15s;letter-spacing:.03em}
    .btn:hover{opacity:.82}
    .btn-primary{background:${C.accent};color:#090600;font-weight:700}
    .btn-ghost{background:transparent;color:${C.dim};border:1px solid ${C.border}}
    .pill{display:inline-block;padding:2px 7px;border-radius:3px;font-size:11px;font-weight:600;letter-spacing:.04em}
    .pulse{animation:pulse 2.5s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .fin{animation:fin .2s ease}
    @keyframes fin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100;display:flex;align-items:center;justify-content:center}
    .modal{background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:24px;width:560px;max-height:88vh;overflow-y:auto}
    .pbar{height:5px;background:${C.s3};border-radius:3px;overflow:hidden}
    .pfill{height:100%;border-radius:3px;transition:width .6s}
    th{text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;color:${C.dim};padding:7px 10px;border-bottom:1px solid ${C.border};text-transform:uppercase;white-space:nowrap}
    td{padding:9px 10px;border-bottom:1px solid ${C.border};vertical-align:middle;font-size:12px}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:${C.s2}}
    table{width:100%;border-collapse:collapse}
    label{font-size:10px;color:${C.dim};display:block;margin-bottom:4px;letter-spacing:.06em;text-transform:uppercase}
  `;

  // ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{cs}</style>
        <div style={{width:380,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:36}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{color:C.accent,fontWeight:700,fontSize:22,letterSpacing:4}}>OTV</div>
            <div className="sans" style={{color:C.dim,fontSize:12,marginTop:6,letterSpacing:1}}>INTERNAL PLATFORM</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {["Google","Zoho"].map(p=>(
              <button key={p} onClick={()=>showToast(`${p} OAuth — wire endpoint in production`,"ok")}
                style={{flex:1,padding:"9px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.dim,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                Sign in with {p}
              </button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{flex:1,height:1,background:C.border}} />
            <span style={{fontSize:10,color:C.muted}}>or email</span>
            <div style={{flex:1,height:1,background:C.border}} />
          </div>
          <form onSubmit={regMode?handleRegister:handleLogin}>
            <div style={{marginBottom:10}}><label>Email</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@odishatv.com" /></div>
            <div style={{marginBottom:16}}><label>Password</label><input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" /></div>
            {loginError && <div style={{color:C.red,fontSize:11,marginBottom:12}}>{loginError}</div>}
            <button type="submit" className="btn btn-primary" style={{width:"100%",padding:"10px",fontSize:13}}>{regMode?"Create Account":"Sign In"}</button>
          </form>
          <div style={{textAlign:"center",marginTop:14}}>
            <button onClick={()=>{setRegMode(!regMode);setLoginError("");}}
              style={{background:"transparent",border:"none",color:C.blue,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
              {regMode?"Already have an account? Sign in":"New here? Register"}
            </button>
          </div>
          <div style={{marginTop:18,padding:"8px 12px",background:C.s2,borderRadius:5,fontSize:10,color:C.dim}}>
            Demo: admin@otv.com / admin123
          </div>
        </div>
      </div>
    );
  }

  // ── HOME SCREEN ──────────────────────────────────────────────────────────────
  if (screen === "home") {
    return (
      <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh"}}>
        <style>{cs}</style>
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:C.accent,fontWeight:700,fontSize:15,letterSpacing:3}}>OTV</span>
          <button onClick={()=>setScreen("login")} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Sign out</button>
        </div>
        <div style={{maxWidth:800,margin:"80px auto 0",padding:"0 24px"}}>
          <div className="sans" style={{fontSize:28,fontWeight:700,marginBottom:8}}>Welcome back</div>
          <div style={{color:C.dim,fontSize:13,marginBottom:40}}>Select a module to get started.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {[
              { mode:"ro" as const, title:"RO Management", desc:"Parse, review, and export Release Orders. AI-powered format detection for all major agencies.", color:"#a855f7", icon:"📋" },
              { mode:"crm" as const, title:"CRO Command", desc:"Sales intelligence dashboard. War Room, Pipeline, Targets, Team performance, HR compliance.", color:C.accent, icon:"⬡" },
            ].map(m=>(
              <div key={m.mode} onClick={()=>{ setAppMode(m.mode); setView(m.mode==="ro"?"ro-parser":"warroom"); setScreen("app"); }}
                className="row" style={{padding:28,cursor:"pointer",borderRadius:10}}>
                <div style={{fontSize:28,marginBottom:12}}>{m.icon}</div>
                <div className="sans" style={{fontSize:17,fontWeight:700,color:m.color,marginBottom:8}}>{m.title}</div>
                <div style={{fontSize:12,color:C.dim,lineHeight:1.6}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",fontSize:13}}>
      <style>{cs}</style>

      {/* TOPBAR */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:3}}>OTV</span>
          <span style={{color:C.muted}}>|</span>
          <span className="sans" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:2,textTransform:"uppercase"}}>{appMode==="ro"?"RO Management":"CRO Command"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setScreen("home")} style={{display:"flex",alignItems:"center",gap:5,background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            ⌂ Home
          </button>
          <select value={filterQ} onChange={e=>setFilterQ(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}>
            {QUARTERS.map(q=><option key={q}>{q}</option>)}
          </select>
          {user_role.canView==="all" && (
            <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}>
              <option>All</option>{REGIONS.map(r=><option key={r}>{r}</option>)}
            </select>
          )}
          <div style={{width:1,height:20,background:C.border}} />
          <select value={activeUser} onChange={e=>setActiveUser(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px",color:C.accent,background:`${C.accent}18`,borderColor:`${C.accent}44`}}>
            {USER_ROLES.map(u=><option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
          </select>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent}}>
              {(user.name||"?")[0].toUpperCase()}
            </div>
            <span style={{fontSize:11,color:C.dim}}>{user.name}</span>
          </div>
          <button onClick={()=>setScreen("login")} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 9px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            Sign out
          </button>
          <span className="pulse" style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block"}} />
          <span style={{fontSize:10,color:C.green,fontWeight:700}}>LIVE</span>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* SIDEBAR */}
        <div style={{width:158,background:C.surface,borderRight:`1px solid ${C.border}`,padding:"10px 0",flexShrink:0,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"8px 10px 10px",borderBottom:`1px solid ${C.border}`,marginBottom:8}}>
            <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6,paddingLeft:4}}>Module</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {([{mode:"ro",label:"RO Manager",icon:"📋",active:"#a855f7"},{mode:"crm",label:"CRM",icon:"⬡",active:C.accent}] as const).map(m=>(
                <button key={m.mode} onClick={()=>{setAppMode(m.mode as any);setView(m.mode==="ro"?"ro-parser":"warroom");}}
                  style={{width:"100%",padding:"6px 10px",background:appMode===m.mode?`${m.active}18`:"transparent",border:`1px solid ${appMode===m.mode?`${m.active}55`:C.border}`,borderRadius:5,color:appMode===m.mode?m.active:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",textAlign:"left",display:"flex",alignItems:"center",gap:7,fontWeight:appMode===m.mode?600:400}}>
                  <span style={{fontSize:12}}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
          </div>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              style={{width:"100%",padding:"9px 14px",background:view===n.id?`${C.accent}12`:"transparent",border:"none",borderLeft:view===n.id?`2px solid ${C.accent}`:"2px solid transparent",color:view===n.id?C.accent:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:view===n.id?600:400,letterSpacing:".04em",textAlign:"left"}}>
              <span style={{fontSize:13,opacity:.8}}>{n.icon}</span>
              <span style={{flex:1}}>{n.label}</span>
              {(n.badge||0)>0 && <span style={{background:C.red,color:"#fff",borderRadius:"50%",width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800}}>{n.badge}</span>}
            </button>
          ))}
          <div style={{flex:1}} />
          <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
            {appMode==="crm" ? <>
              <div style={{fontSize:9,color:C.dim,marginBottom:5,letterSpacing:".08em",fontWeight:700}}>FORECAST QTD</div>
              <div className="sans" style={{fontSize:22,fontWeight:700,color:fcastPct>=100?C.green:fcastPct>=75?C.accent:C.red}}>{fcastPct}%</div>
              <div className="pbar" style={{marginTop:5}}><div className="pfill" style={{width:`${Math.min(fcastPct,100)}%`,background:fcastPct>=100?C.green:fcastPct>=75?C.accent:C.red}} /></div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>{fmtR(forecast)} / {fmtR(totalTarget)}</div>
            </> : <>
              <div style={{fontSize:9,color:C.dim,marginBottom:5,letterSpacing:".08em",fontWeight:700}}>SAVED ROs</div>
              <div className="sans" style={{fontSize:22,fontWeight:700,color:C.accent}}>{savedROs.length}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>{savedROs.filter(r=>r.status==="Exported").length} exported</div>
            </>}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{flex:1,overflow:"auto",padding:20}}>
          {view==="ro-parser" && <ViewROParser roFiles={roFiles} setRoFiles={setRoFiles} roFileRef={roFileRef} roInputText={roInputText} setRoInputText={setRoInputText} roResults={roResults} roActiveDoc={roActiveDoc} setRoActiveDoc={setRoActiveDoc} roLoading={roLoading} roProgress={roProgress} roError={roError} roParseAll={roParseAll} roExportSingle={roExportSingle} roExportAll={roExportAll} roSaveResult={roSaveResult} />}
          {view==="ro-management" && <ViewROManagement savedROs={savedROs} setSavedROs={setSavedROs} setView={setView} roSearch={roSearch} setRoSearch={setRoSearch} roMgmtChannel={roMgmtChannel} setRoMgmtChannel={setRoMgmtChannel} roMgmtStatus={roMgmtStatus} setRoMgmtStatus={setRoMgmtStatus} roMgmtViewRO={roMgmtViewRO} setRoMgmtViewRO={setRoMgmtViewRO} roMgmtConfirmDelete={roMgmtConfirmDelete} setRoMgmtConfirmDelete={setRoMgmtConfirmDelete} roExportSingle={roExportSingle} />}
          {view==="warroom" && <ViewWarRoom visibleDeals={visibleDeals} closed={closed} forecast={forecast} totalTarget={totalTarget} overdueReqs={overdueReqs} updateDealOutcome={updateDealOutcome} setAddDealModal={setAddDealModal} setMeetingLogModal={setMeetingLogModal} />}
          {view==="pipeline" && <ViewPipeline visibleDeals={visibleDeals} expandedDeal={expandedDeal} setExpandedDeal={setExpandedDeal} updateDealOutcome={updateDealOutcome} updateReqStatus={updateReqStatus} />}
          {view==="targets" && <ViewTargets visibleDeals={visibleDeals} closed={closed} forecast={forecast} totalTarget={totalTarget} />}
          {view==="team" && <ViewTeam visibleDeals={visibleDeals} visMeetings={visMeetings} user_role={user_role} />}
          {view==="activity" && <ViewActivity visMeetings={visMeetings} />}
          {view==="escalations" && <ViewEscalations visibleDeals={visibleDeals} updateReqStatus={updateReqStatus} />}
          {view==="compliance" && <ViewCompliance attendance={attendance} user_role={user_role} />}
          {view==="hr" && <ViewHR absenceReports={absenceReports} user_role={user_role} setExceptionModal={setExceptionModal} canGrantException={canGrantException} />}
        </div>
      </div>

      {/* ADD DEAL MODAL */}
      {addDealModal && (
        <div className="overlay">
          <div className="modal">
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Add New Deal</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["clientCompany","Client Company"],["contactName","Contact Name"],["designation","Designation"],["phone","Phone"],["email","Email"],["amount","Amount (₹)"],["targetAmount","Target (₹)"],["nextStep","Next Step"]].map(([k,l])=>(
                <div key={k}>
                  <label>{l}</label>
                  <input value={(newDeal as any)[k]||""} onChange={e=>setNewDeal(p=>({...p,[k]:k.includes("amount")||k.includes("Amount")?Number(e.target.value):e.target.value}))} />
                </div>
              ))}
              {[["region","Region",REGIONS],["dealType","Deal Type",DEAL_TYPES],["outcome","Stage",OUTCOMES],["contactLevel","Contact Level",CONTACT_LEVELS],["quarter","Quarter",QUARTERS]].map(([k,l,opts])=>(
                <div key={k}>
                  <label>{l}</label>
                  <select value={(newDeal as any)[k]||""} onChange={e=>setNewDeal(p=>({...p,[k]:e.target.value}))}>
                    {(opts as string[]).map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{gridColumn:"1/-1"}}>
                <label>Notes</label>
                <textarea value={newDeal.notes||""} onChange={e=>setNewDeal(p=>({...p,notes:e.target.value}))} style={{minHeight:60,resize:"vertical"}} />
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setAddDealModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addDeal}>Add Deal</button>
            </div>
          </div>
        </div>
      )}

      {/* MEETING LOG MODAL */}
      {meetingLogModal && (
        <div className="overlay">
          <div className="modal">
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:16}}>Log Meeting / Contact</div>
            {[["clientCompany","Client Company"],["contactName","Contact Name"],["discussion","Discussion"],["nextStep","Next Step"]].map(([k,l])=>(
              <div key={k} style={{marginBottom:10}}>
                <label>{l}</label>
                {k==="discussion"||k==="nextStep" ? (
                  <textarea value={(mlForm as any)[k]} onChange={e=>setMlForm(p=>({...p,[k]:e.target.value}))} style={{minHeight:60,resize:"vertical"}} />
                ) : (
                  <input value={(mlForm as any)[k]} onChange={e=>setMlForm(p=>({...p,[k]:e.target.value}))} />
                )}
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div><label>Contact Level</label><select value={mlForm.contactLevel} onChange={e=>setMlForm(p=>({...p,contactLevel:e.target.value}))}>{CONTACT_LEVELS.map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label>Outcome</label><select value={mlForm.outcome} onChange={e=>setMlForm(p=>({...p,outcome:e.target.value}))}>{OUTCOMES.map(o=><option key={o}>{o}</option>)}</select></div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setMeetingLogModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={logMeeting}>Log Meeting</button>
            </div>
          </div>
        </div>
      )}

      {/* HR EXCEPTION MODAL */}
      {exceptionModal && (
        <div className="overlay">
          <div className="modal">
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:4}}>Grant Attendance Exception</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:16}}>This action is permanent and logged. Use only for genuine exceptions.</div>
            <div style={{background:C.s2,borderRadius:6,padding:12,marginBottom:14,fontSize:12}}>
              <div><b>{exceptionModal.repName}</b> · {exceptionModal.region} · {exceptionModal.date}</div>
              <div style={{color:C.dim,marginTop:4,fontSize:11}}>Absence auto-reported at {exceptionModal.generatedAt} by system</div>
            </div>
            <label>Reason for exception</label>
            <textarea value={exceptionReason} onChange={e=>setExceptionReason(e.target.value)} placeholder="Describe the specific reason (e.g. client site visit, emergency, network failure)..." style={{minHeight:80,marginBottom:14,resize:"vertical"}} />
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setExceptionModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={grantException}>GRANT EXCEPTION</button>
            </div>
            <div style={{marginTop:12,fontSize:10,color:C.muted,textAlign:"center"}}>Logged as: {user_role?.name} ({user_role?.role}) · {new Date().toLocaleString("en-IN")}</div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className="fin" style={{position:"fixed",bottom:18,right:18,background:toast.type==="err"?C.red:C.green,color:"#fff",padding:"9px 16px",borderRadius:5,fontWeight:700,fontSize:12,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{toast.msg}</div>}
    </div>
  );
}

// ── VIEW: WAR ROOM ────────────────────────────────────────────────────────────
function ViewWarRoom({ visibleDeals, closed, forecast, totalTarget, overdueReqs, updateDealOutcome, setAddDealModal, setMeetingLogModal }: any) {
  const gap = totalTarget - closed;
  const atRisk = visibleDeals.filter((d:Deal)=>daysSince(d.lastContact)>=7 && d.outcome!=="Proposal Accepted" && d.outcome!=="Not Interested");
  const overdueActions = visibleDeals.filter((d:Deal)=>d.nextStepDate && new Date(d.nextStepDate)<new Date() && d.outcome!=="Proposal Accepted" && d.outcome!=="Not Interested");
  const highProb = visibleDeals.filter((d:Deal)=>d.outcome==="Very Interested"||d.outcome==="Proposal Accepted").sort((a:Deal,b:Deal)=>b.amount-a.amount);
  const kpis = [
    {label:"Closed QTD",value:fmtR(closed),color:C.green},
    {label:"Forecast",value:fmtR(forecast),color:C.accent},
    {label:"Gap to Target",value:fmtR(gap),color:gap>0?C.red:C.green},
    {label:"Deals at Risk",value:atRisk.length,color:atRisk.length>0?C.red:C.green},
    {label:"Overdue Actions",value:overdueActions.length,color:overdueActions.length>0?C.orange:C.green},
  ];
  return (
    <div className="fin">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div className="sans" style={{fontSize:20,fontWeight:700}}>War Room</div>
          <div style={{fontSize:11,color:C.dim}}>Command view — {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setMeetingLogModal(true)} className="btn btn-ghost">+ Log Meeting</button>
          <button onClick={()=>setAddDealModal(true)} className="btn btn-primary">+ Add Deal</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>
        {kpis.map(k=>(
          <div key={k.label} className="card" style={{padding:14}}>
            <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{k.label}</div>
            <div className="sans" style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>
      {atRisk.length>0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:".08em",marginBottom:8}}>🔴 DEALS AT RISK — NO CONTACT 7+ DAYS</div>
          {atRisk.map((d:Deal)=>(
            <div key={d.id} className="row" style={{borderLeft:`3px solid ${C.red}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600}}>{d.clientCompany}</div>
                <div style={{fontSize:11,color:C.dim}}>{d.outcome} · {daysSince(d.lastContact)}d idle</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.red,fontWeight:700}}>{fmtR(d.amount)}</div>
                <div style={{fontSize:10,color:C.dim}}>{d.region}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {overdueActions.length>0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.orange,letterSpacing:".08em",marginBottom:8}}>🟡 OVERDUE NEXT STEPS</div>
          {overdueActions.map((d:Deal)=>(
            <div key={d.id} className="row" style={{borderLeft:`3px solid ${C.orange}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600}}>{d.clientCompany}</div>
                <div style={{fontSize:11,color:C.dim}}>{d.nextStep}</div>
              </div>
              <div style={{color:C.orange,fontSize:11,fontWeight:600}}>Due {d.nextStepDate}</div>
            </div>
          ))}
        </div>
      )}
      {highProb.length>0 && (
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.accent,letterSpacing:".08em",marginBottom:8}}>⭐ HIGH PROBABILITY DEALS</div>
          {highProb.map((d:Deal)=>(
            <div key={d.id} className="row" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600}}>{d.clientCompany}</div>
                <div style={{fontSize:11,color:C.dim}}>{d.nextStep}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{textAlign:"right"}}>
                  <div style={{color:C.green,fontWeight:700}}>{fmtR(d.amount)}</div>
                  <div style={{fontSize:10,color:C.dim}}>{d.dealType}</div>
                </div>
                <select value={d.outcome} onChange={e=>updateDealOutcome(d.id,e.target.value)}
                  style={{width:"auto",fontSize:11,padding:"3px 6px",color:oColor(d.outcome),background:`${oColor(d.outcome)}18`,borderColor:`${oColor(d.outcome)}44`}}>
                  {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VIEW: PIPELINE ────────────────────────────────────────────────────────────
function ViewPipeline({ visibleDeals, expandedDeal, setExpandedDeal, updateDealOutcome, updateReqStatus }: any) {
  const grouped: Record<string,Deal[]> = {};
  OUTCOMES.forEach(o=>{grouped[o]=[];});
  visibleDeals.forEach((d:Deal)=>{ if(grouped[d.outcome]) grouped[d.outcome].push(d); });
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Pipeline</div>
      <div style={{fontSize:11,color:C.dim,marginBottom:16}}>All deals grouped by stage · click to expand</div>
      {OUTCOMES.map(o=>{
        const stagePct = STAGE_PROB[o]||0;
        const stageDeals = grouped[o];
        if (!stageDeals?.length) return null;
        const stageValue = stageDeals.reduce((s:number,d:Deal)=>s+d.amount,0);
        const weighted = stageDeals.reduce((s:number,d:Deal)=>s+d.amount*stagePct/100,0);
        return (
          <div key={o} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"6px 10px",background:C.s2,borderRadius:5}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:oColor(o),display:"inline-block"}} />
              <span style={{fontWeight:600,flex:1}}>{o}</span>
              <span style={{color:C.dim,fontSize:11}}>{stageDeals.length} deals</span>
              <span style={{color:oColor(o),fontWeight:600,fontSize:12}}>{fmtR(stageValue)}</span>
              <span style={{color:C.dim,fontSize:10}}>weighted {fmtR(weighted)} ({stagePct}%)</span>
            </div>
            {stageDeals.map((d:Deal)=>(
              <div key={d.id}>
                <div className="row" onClick={()=>setExpandedDeal(expandedDeal===d.id?null:d.id)}
                  style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",marginLeft:16}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:600}}>{d.clientCompany}</span>
                      {d.roLinked && <span style={{background:"#0a1a0a",color:C.green,padding:"1px 6px",borderRadius:8,fontSize:9,fontWeight:700}}>RO Linked</span>}
                      {d.priority==="Top 5" && <span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:8,fontSize:9,fontWeight:700}}>Top 5</span>}
                    </div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{d.dealType} · {d.region} · {daysSince(d.lastContact)}d ago</div>
                  </div>
                  <div style={{textAlign:"right",marginRight:12}}>
                    <div style={{fontWeight:700,color:riskColor(d)}}>{fmtR(d.amount)}</div>
                    <div style={{fontSize:10,color:C.dim}}>{riskLabel(d)}</div>
                  </div>
                  <select value={d.outcome} onClick={e=>e.stopPropagation()} onChange={e=>updateDealOutcome(d.id,e.target.value)}
                    style={{width:"auto",fontSize:11,padding:"3px 6px",color:oColor(d.outcome),background:`${oColor(d.outcome)}18`,borderColor:`${oColor(d.outcome)}44`}}>
                    {OUTCOMES.map(o2=><option key={o2}>{o2}</option>)}
                  </select>
                </div>
                {expandedDeal===d.id && (
                  <div style={{marginLeft:16,marginBottom:8,background:C.s2,borderRadius:5,padding:14,fontSize:12}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                      {[["Contact",`${d.contactName} · ${d.designation}`],["Phone",d.phone],["Email",d.email],["Deal Type",d.dealType],["Target",fmtR(d.targetAmount)],["Last Contact",d.lastContact]].map(([k,v])=>(
                        <div key={k}><div style={{color:C.dim,fontSize:10,marginBottom:2}}>{k}</div><div style={{color:C.text}}>{v}</div></div>
                      ))}
                    </div>
                    {d.notes && <div style={{marginBottom:10,padding:8,background:C.s3,borderRadius:4,fontSize:11,color:C.dim}}>{d.notes}</div>}
                    {d.nextStep && <div style={{marginBottom:10}}><span style={{color:C.orange,fontWeight:600,fontSize:11}}>→ {d.nextStep}</span>{d.nextStepDate&&<span style={{color:C.dim,fontSize:10}}> · by {d.nextStepDate}</span>}</div>}
                    {d.reqs.length>0 && (
                      <div>
                        <div style={{fontSize:10,color:C.dim,fontWeight:600,marginBottom:6}}>INTERNAL REQUESTS</div>
                        {d.reqs.map((r,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,background:C.surface,padding:"6px 10px",borderRadius:4}}>
                            <span style={{color:C.accent,fontSize:11,fontWeight:600}}>{r.dept}</span>
                            <span style={{flex:1,fontSize:11}}>{r.desc}</span>
                            <select value={r.status} onChange={e=>updateReqStatus(d.id,i,e.target.value)} onClick={e=>e.stopPropagation()}
                              style={{width:"auto",fontSize:10,padding:"2px 5px",color:r.status==="Done"?C.green:r.status==="Overdue"?C.red:C.accent,background:`${C.s3}`,borderColor:C.border}}>
                              {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── VIEW: TARGETS ─────────────────────────────────────────────────────────────
function ViewTargets({ visibleDeals, closed, forecast, totalTarget }: any) {
  const closedPct = totalTarget>0?Math.round(closed/totalTarget*100):0;
  const fcastPct2 = totalTarget>0?Math.round(forecast/totalTarget*100):0;
  const clientGroups: Record<string,{closed:number,pipeline:number,target:number,lastContact:string,roLinked?:string}> = {};
  visibleDeals.forEach((d:Deal)=>{
    if (!clientGroups[d.clientCompany]) clientGroups[d.clientCompany]={closed:0,pipeline:0,target:d.targetAmount,lastContact:d.lastContact};
    if (d.outcome==="Proposal Accepted") clientGroups[d.clientCompany].closed+=d.amount;
    else clientGroups[d.clientCompany].pipeline+=d.amount*(STAGE_PROB[d.outcome]||0)/100;
    if (d.roLinked) clientGroups[d.clientCompany].roLinked=d.roLinked;
  });
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Targets</div>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.dim,marginBottom:4}}>
          <span>QTD Coverage</span>
          <span>{fmtR(closed+forecast)} / {fmtR(totalTarget)} ({fcastPct2}%)</span>
        </div>
        <div className="pbar" style={{height:12}}>
          <div style={{display:"flex",height:"100%"}}>
            <div style={{width:`${Math.min(closedPct,100)}%`,background:C.green,borderRadius:3}} />
            <div style={{width:`${Math.min(Math.max(fcastPct2-closedPct,0),100-closedPct)}%`,background:C.accent,opacity:.7}} />
          </div>
        </div>
      </div>
      <table>
        <thead><tr>{["Client","Closed","Pipeline","Target","Coverage","Last Contact"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {Object.entries(clientGroups).sort(([,a],[,b])=>b.closed-a.closed).map(([client,g])=>{
            const cov = g.target>0?Math.round((g.closed+g.pipeline)/g.target*100):0;
            return (
              <tr key={client}>
                <td style={{fontWeight:600}}>{client}{g.roLinked&&<span style={{marginLeft:6,background:"#0a1a0a",color:C.green,padding:"1px 5px",borderRadius:8,fontSize:9,fontWeight:700}}>RO Linked</span>}</td>
                <td style={{color:C.green,fontWeight:600}}>{fmtR(g.closed)}</td>
                <td style={{color:C.accent}}>{fmtR(g.pipeline)}</td>
                <td style={{color:C.dim}}>{fmtR(g.target)}</td>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="pbar" style={{width:80}}><div className="pfill" style={{width:`${Math.min(cov,100)}%`,background:cov>=100?C.green:cov>=60?C.accent:C.red}} /></div>
                    <span style={{fontSize:11,color:cov>=100?C.green:cov>=60?C.accent:C.red}}>{cov}%</span>
                  </div>
                </td>
                <td style={{color:C.dim,fontSize:11}}>{g.lastContact}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── VIEW: TEAM ────────────────────────────────────────────────────────────────
function ViewTeam({ visibleDeals, visMeetings, user_role }: any) {
  const repStats = REPS.filter(r=>{
    if(user_role.canView==="self") return r.id===user_role.repId;
    if(user_role.canView==="region") return r.region===user_role.region;
    return true;
  }).map(r=>{
    const rDeals=visibleDeals.filter((d:Deal)=>d.repId===r.id);
    const rMtgs=visMeetings.filter((m:Meeting)=>m.repId===r.id);
    const closed=rDeals.filter((d:Deal)=>d.outcome==="Proposal Accepted").reduce((s:number,d:Deal)=>s+d.amount,0);
    const pipeline=rDeals.reduce((s:number,d:Deal)=>s+d.amount*(STAGE_PROB[d.outcome]||0)/100,0);
    const totalMtgs=rMtgs.length;
    const seniorMtgs=rMtgs.filter((m:Meeting)=>["C-Suite / Owner","VP / GM"].includes(m.contactLevel)).length;
    const srPct=totalMtgs>0?Math.round(seniorMtgs/totalMtgs*100):0;
    const cov=r.target>0?Math.round(pipeline/r.target*100):0;
    return {rep:r,closed,pipeline,totalMtgs,seniorMtgs,srPct,cov,target:r.target};
  }).sort((a,b)=>b.closed-a.closed);
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:16}}>Team Scorecards</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
        {repStats.map(({rep,closed,pipeline,totalMtgs,seniorMtgs,srPct,cov,target},i)=>(
          <div key={rep.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{i+1}. {rep.name}</div>
                <div style={{fontSize:10,color:C.dim,marginTop:2}}>{rep.role} · {rep.region}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.green,fontWeight:700,fontSize:16}}>{fmtR(closed)}</div>
                <div style={{fontSize:10,color:C.dim}}>Closed</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[["Pipeline",fmtR(pipeline)],["Meetings",totalMtgs],["Senior %",srPct+"%"]].map(([k,v])=>(
                <div key={k} style={{background:C.s2,padding:"7px 10px",borderRadius:4}}>
                  <div style={{fontSize:9,color:C.dim,marginBottom:2}}>{k}</div>
                  <div style={{fontWeight:600,color:k==="Senior %"&&srPct<50?C.red:C.text}}>{v}</div>
                </div>
              ))}
            </div>
            {srPct<50&&totalMtgs>0&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:4,padding:"5px 8px",fontSize:10,color:"#fca5a5",marginBottom:8}}>⚠ Senior meeting % below 50% — coaching needed</div>}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.dim,marginBottom:3}}>
                <span>Coverage</span><span>{fmtR(closed+pipeline)} / {fmtR(target)}</span>
              </div>
              <div className="pbar"><div className="pfill" style={{width:`${Math.min(cov,100)}%`,background:cov>=100?C.green:cov>=60?C.accent:C.red}} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VIEW: ACTIVITY ────────────────────────────────────────────────────────────
function ViewActivity({ visMeetings }: any) {
  const todayMtgs = visMeetings.filter((m:Meeting)=>m.date===TODAY);
  const prev = visMeetings.filter((m:Meeting)=>m.date!==TODAY);
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:16}}>Activity Log</div>
      {todayMtgs.length>0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",marginBottom:8}}>TODAY</div>
          {todayMtgs.map((m:Meeting)=>(
            <div key={m.id} className="row" style={{borderLeft:`3px solid ${m.late?C.orange:C.green}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:600}}>{m.repName} → <span style={{color:C.text}}>{m.clientCompany}</span></div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{m.discussion}</div>
                  <div style={{fontSize:11,color:C.orange,marginTop:4}}>→ {m.nextStep}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                  <span style={{background:lColor(m.contactLevel)+"22",color:lColor(m.contactLevel),padding:"2px 7px",borderRadius:8,fontSize:10,fontWeight:600}}>{m.contactLevel}</span>
                  <div style={{marginTop:4,display:"flex",gap:6,justifyContent:"flex-end",alignItems:"center"}}>
                    <span style={{color:oColor(m.outcome),fontSize:10}}>{m.outcome}</span>
                    {m.late&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"1px 5px",borderRadius:6,fontSize:9,fontWeight:700}}>LATE</span>}
                    <span style={{color:C.dim,fontSize:10}}>{m.loggedAt}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {prev.length>0 && (
        <div>
          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:8}}>PREVIOUS</div>
          {prev.map((m:Meeting)=>(
            <div key={m.id} className="row">
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:600}}>{m.repName} → {m.clientCompany}</div>
                  <div style={{fontSize:11,color:C.dim}}>{m.discussion}</div>
                </div>
                <div style={{textAlign:"right",fontSize:10,color:C.dim}}>{m.date} · {m.loggedAt}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {visMeetings.length===0 && <div style={{color:C.dim,textAlign:"center",padding:40,fontSize:13}}>No meetings logged yet.</div>}
    </div>
  );
}

// ── VIEW: ESCALATIONS ─────────────────────────────────────────────────────────
function ViewEscalations({ visibleDeals, updateReqStatus }: any) {
  type ReqWithMeta = Req & { dealId: string; clientCompany: string; dept: string };
  const allReqs: ReqWithMeta[] = visibleDeals.flatMap((d:Deal)=>d.reqs.map((r:Req)=>({...r,dealId:d.id,clientCompany:d.clientCompany})));
  const byDept: Record<string,ReqWithMeta[]> = {};
  DEPARTMENTS.forEach(dept=>{byDept[dept]=[];});
  allReqs.forEach(r=>{ if(byDept[r.dept]) byDept[r.dept].push(r); });
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Escalations & Internal Requests</div>
      <div style={{fontSize:11,color:C.dim,marginBottom:16}}>SLA tracking by department</div>
      {DEPARTMENTS.map(dept=>{
        const dReqs=byDept[dept];
        const openCount=dReqs.filter(r=>r.status!=="Done").length;
        if (!dReqs.length) return null;
        return (
          <div key={dept} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"7px 12px",background:C.s2,borderRadius:5}}>
              <span style={{fontWeight:600,flex:1}}>{dept}</span>
              <span style={{fontSize:10,color:C.dim}}>SLA: {SLA[dept]}h</span>
              {openCount>0&&<span style={{background:C.red,color:"#fff",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800}}>{openCount}</span>}
            </div>
            {dReqs.map((r,i)=>{
              const deal=visibleDeals.find((d:Deal)=>d.id===r.dealId);
              const dealIdx=deal?.reqs.findIndex((req:Req)=>req.desc===r.desc);
              return (
                <div key={i} className="row" style={{marginLeft:16,display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`3px solid ${r.status==="Overdue"?C.red:r.status==="Done"?C.green:C.border}`}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:12}}>{r.clientCompany}</div>
                    <div style={{fontSize:11,color:C.dim}}>{r.desc}</div>
                  </div>
                  <select value={r.status} onChange={e=>updateReqStatus(r.dealId,dealIdx,e.target.value)}
                    style={{width:"auto",fontSize:11,padding:"3px 6px",color:r.status==="Done"?C.green:r.status==="Overdue"?C.red:C.accent}}>
                    {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── VIEW: COMPLIANCE ──────────────────────────────────────────────────────────
function ViewCompliance({ attendance, user_role }: any) {
  const visReps = REPS.filter(r=>{
    if(user_role.canView==="self") return r.id===user_role.repId;
    if(user_role.canView==="region") return r.region===user_role.region;
    return true;
  });
  const dates = [TODAY, D1];
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:4}}>Compliance</div>
      <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Meeting log compliance · Deadline: {DEADLINE} daily</div>
      <div style={{overflowX:"auto"}}>
        <table>
          <thead>
            <tr>
              <th>Rep</th>
              <th>Region</th>
              <th>Role</th>
              {dates.map(d=><th key={d}>{d===TODAY?"Today":"Yesterday"} ({d})</th>)}
            </tr>
          </thead>
          <tbody>
            {visReps.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:600}}>{r.name}</td>
                <td style={{color:C.dim}}>{r.region}</td>
                <td style={{color:C.dim,fontSize:11}}>{r.role}</td>
                {dates.map(date=>{
                  const att = attendance[date];
                  const status = att?.[r.id];
                  const label = status===true?"✓ Logged":status===false?"✗ Absent":"No Data";
                  const color = status===true?C.green:status===false?C.red:C.dim;
                  return <td key={date}><span style={{color,fontWeight:600,fontSize:11}}>{label}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── VIEW: HR REPORTS ──────────────────────────────────────────────────────────
function ViewHR({ absenceReports, user_role, setExceptionModal, canGrantException }: any) {
  return (
    <div className="fin">
      <div className="sans" style={{fontSize:20,fontWeight:700,marginBottom:4}}>HR Absence Reports</div>
      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Auto-generated by system at 23:59 for reps with no meeting log.</div>
      <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#16c784"}}>
        <b>System Rules:</b> No regularisation exists. Only Admin/CXO can grant exceptions. All exceptions logged permanently with reason and authority.
      </div>
      {absenceReports.map((r:AbsenceReport)=>(
        <div key={r.id} className="row" style={{borderLeft:`3px solid ${r.markedAs==="Absent"?C.red:C.green}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:600}}>{r.repName} <span style={{color:C.dim,fontSize:11}}>· {r.region} · {r.role}</span></div>
              <div style={{fontSize:11,color:C.dim,marginTop:2}}>{r.date} · Generated at {r.generatedAt} · Sent to {r.sentTo}</div>
              {r.exception&&<div style={{fontSize:11,color:C.green,marginTop:4}}>✓ Exception by {r.exceptionBy}: {r.exceptionReason}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <span style={{background:r.markedAs==="Absent"?"#450a0a":"#0a1a0a",color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>
                {r.markedAs}
              </span>
              {r.markedAs==="Absent" && !r.exception && (
                canGrantException
                  ? <button onClick={()=>setExceptionModal(r)} className="btn" style={{background:`${C.accent}18`,color:C.accent,border:`1px solid ${C.accent}44`,fontSize:10,padding:"3px 10px"}}>Grant Exception</button>
                  : <span style={{fontSize:10,color:C.muted}}>Contact Admin/CXO</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {absenceReports.length===0&&<div style={{color:C.dim,textAlign:"center",padding:40}}>No absence reports generated yet.</div>}
    </div>
  );
}

// ── VIEW: RO PARSER ───────────────────────────────────────────────────────────
function ViewROParser({ roFiles, setRoFiles, roFileRef, roInputText, setRoInputText, roResults, roActiveDoc, setRoActiveDoc, roLoading, roProgress, roError, roParseAll, roExportSingle, roExportAll, roSaveResult }: any) {
  return (
    <div className="fin">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RO PARSER</div>
          <div style={{fontSize:11,color:C.dim,marginTop:2}}>Zoho CRM ready · Deal + Breakup + Summary · All agency formats</div>
        </div>
        {roResults.length>1&&<button onClick={roExportAll} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"8px 18px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'DM Mono',monospace"}}>Export All ({roResults.length}) →</button>}
      </div>
      <div className="card" style={{padding:14,marginBottom:14}}>
        <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"6px 11px",marginBottom:10,fontSize:11,color:"#16c784"}}>
          Apple Numbers (.numbers) not supported — export as Excel (.xlsx) via File → Export To → Excel
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={()=>roFileRef.current?.click()} style={{background:"#131920",color:"#7d8590",border:"1px solid #1e2d3d",padding:"7px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>
            {roFiles.length?`${roFiles.length} file(s) selected`:"Upload Files"}
          </button>
          <span style={{color:"#2a3a4d",fontSize:11}}>PDF · Image · Excel (.xlsx) · CSV · TXT</span>
          {roFiles.length>0&&(
            <span>
              {roFiles.map((f:File,i:number)=><span key={i} style={{background:"#0f2a4a",color:"#60a5fa",padding:"2px 8px",borderRadius:10,fontSize:11,marginRight:4}}>{f.name}</span>)}
              <button onClick={()=>{setRoFiles([]);if(roFileRef.current)roFileRef.current.value="";}} style={{background:"transparent",color:"#ea3943",border:"none",cursor:"pointer",fontSize:12}}>✕</button>
            </span>
          )}
        </div>
        <input ref={roFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.xlsx,.xls,.csv" multiple
          onChange={e=>{setRoFiles(Array.from(e.target.files||[]));}} style={{display:"none"}} />
        {roFiles.length===0&&(
          <textarea value={roInputText} onChange={e=>setRoInputText(e.target.value)}
            placeholder="Or paste any RO text here..."
            style={{width:"100%",minHeight:80,background:"#131920",border:"1px solid #1e2d3d",borderRadius:6,padding:11,color:"#e6edf3",fontSize:12,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}} />
        )}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["WPP","EssenceMediacom","Zenith","Spark","Madison","FCBUlka","Prachar","ENES","Direct Client"].map(f=>(
              <span key={f} style={{background:"#131920",color:"#2a3a4d",padding:"2px 7px",borderRadius:8,fontSize:10,border:"1px solid #1e2d3d"}}>✓ {f}</span>
            ))}
          </div>
          <button onClick={roParseAll} disabled={(!roFiles.length&&!roInputText.trim())||roLoading}
            style={{background:(!roFiles.length&&!roInputText.trim())||roLoading?"#1a2332":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:(!roFiles.length&&!roInputText.trim())||roLoading?"#7d8590":"#fff",border:"none",padding:"9px 24px",borderRadius:6,cursor:(!roFiles.length&&!roInputText.trim())||roLoading?"not-allowed":"pointer",fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
            {roLoading?(roProgress||"Parsing..."):`Parse ${roFiles.length>1?roFiles.length+" ROs":"RO"}`}
          </button>
        </div>
      </div>
      {roError&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:7,padding:11,color:"#fca5a5",fontSize:11,marginBottom:12,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{roError}</div>}
      {roResults.length>0&&(
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:7,alignItems:"center"}}>
            {roResults.map((r:any,i:number)=>(
              <button key={i} onClick={()=>setRoActiveDoc(i)} style={{background:roActiveDoc===i?"#6366f1":"#0d1117",color:roActiveDoc===i?"#fff":"#7d8590",border:"1px solid #1e2d3d",padding:"4px 11px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                {roNormalizeChannel(r.channel)||r.client_name||r._filename}
              </button>
            ))}
            <button onClick={()=>roSaveResult(roResults[roActiveDoc])} style={{background:"#0d1117",color:"#16c784",border:"1px solid #166534",padding:"4px 11px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>
              Save to RO Mgmt
            </button>
          </div>
        </div>
      )}
      {roResults[roActiveDoc]&&<ROCard result={roResults[roActiveDoc]} onExport={roExportSingle} />}
    </div>
  );
}

// ── VIEW: RO MANAGEMENT ───────────────────────────────────────────────────────
function ViewROManagement({ savedROs, setSavedROs, setView, roSearch, setRoSearch, roMgmtChannel, setRoMgmtChannel, roMgmtStatus, setRoMgmtStatus, roMgmtViewRO, setRoMgmtViewRO, roMgmtConfirmDelete, setRoMgmtConfirmDelete, roExportSingle }: any) {
  const filtered = savedROs.filter((ro:any)=>{
    const q=roSearch.toLowerCase();
    const matchSearch=!q||[(ro.client_name||""),(ro.ro_number||""),(ro.agency_name||""),(ro.brand_name||"")].some((v:string)=>v.toLowerCase().includes(q));
    const matchChannel=roMgmtChannel==="all"||roNormalizeChannel(ro.channel)===roMgmtChannel;
    const matchStatus=roMgmtStatus==="all"||ro.status===roMgmtStatus;
    return matchSearch&&matchChannel&&matchStatus;
  });
  return (
    <div className="fin">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="sans" style={{fontSize:20,fontWeight:700}}>RO Management</div>
          <p style={{color:"#7d8590",fontSize:13,margin:"3px 0 0"}}>{savedROs.length} release order{savedROs.length!==1?"s":""} total</p>
        </div>
        <button onClick={()=>setView("ro-parser")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>+ Add RO</button>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:8,padding:"8px 14px",color:"#e6edf3",fontSize:13,outline:"none",flex:1,minWidth:200,fontFamily:"'DM Mono',monospace"}}
          placeholder="Search by client, RO number, agency..." value={roSearch} onChange={e=>setRoSearch(e.target.value)} />
        <select value={roMgmtChannel} onChange={e=>setRoMgmtChannel(e.target.value)} style={{background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:8,padding:"8px 12px",color:"#e6edf3",fontSize:12,outline:"none",cursor:"pointer"}}>
          <option value="all">All Channels</option>
          {ALL_CHANNELS.map(ch=><option key={ch} value={ch}>{ch}</option>)}
        </select>
        <select value={roMgmtStatus} onChange={e=>setRoMgmtStatus(e.target.value)} style={{background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:8,padding:"8px 12px",color:"#e6edf3",fontSize:12,outline:"none",cursor:"pointer"}}>
          <option value="all">All Status</option>
          <option value="Parsed">Parsed</option>
          <option value="Exported">Exported</option>
        </select>
      </div>
      <div className="card" style={{overflow:"hidden",marginBottom:roMgmtViewRO?20:0}}>
        {filtered.length===0?(
          <div style={{padding:48,textAlign:"center",color:"#7d8590",fontSize:13}}>
            {savedROs.length===0
              ?<span>No ROs yet. <button onClick={()=>setView("ro-parser")} style={{color:"#a78bfa",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Parse your first RO →</button></span>
              :"No ROs match the current filters."}
          </div>
        ):(
          <table>
            <thead><tr>{["Client / Brand","Channel","RO Number","Agency","Gross Amount","Date Saved","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((ro:any)=>(
                <tr key={ro.id}>
                  <td style={{fontWeight:600}}>{ro.client_name||"---"}{ro.brand_name&&<div style={{color:"#7d8590",fontSize:11}}>{ro.brand_name}</div>}</td>
                  <td><span style={{background:"#1a1a3a",color:"#a855f7",padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:600}}>{roNormalizeChannel(ro.channel)||"---"}</span></td>
                  <td style={{color:"#7d8590",fontFamily:"monospace"}}>{ro.ro_number||"---"}</td>
                  <td style={{color:"#7d8590",fontSize:11}}>{ro.agency_name||"---"}</td>
                  <td style={{color:"#16c784",fontWeight:600}}>{ro.gross_amount?roFmtMoney(ro.gross_amount):"---"}</td>
                  <td style={{color:"#7d8590"}}>{(ro.savedAt||"").slice(0,10)}</td>
                  <td><span style={{background:ro.status==="Exported"?"#0a1a0a":"#1a1a3a",color:ro.status==="Exported"?"#16c784":"#a855f7",padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:600}}>{ro.status}</span></td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <button style={{background:"transparent",border:"none",color:"#7dd3fc",cursor:"pointer",padding:"4px 8px",fontSize:12,fontFamily:"'DM Mono',monospace"}} onClick={()=>setRoMgmtViewRO(roMgmtViewRO?.id===ro.id?null:ro)}>
                      {roMgmtViewRO?.id===ro.id?"Hide":"View"}
                    </button>
                    <button style={{background:"transparent",border:"none",color:"#16c784",cursor:"pointer",padding:"4px 8px",fontSize:12,fontFamily:"'DM Mono',monospace"}} onClick={()=>roExportSingle(ro.data)}>Export</button>
                    <button style={{background:"transparent",border:"none",color:"#ea3943",cursor:"pointer",padding:"4px 8px",fontSize:12,fontFamily:"'DM Mono',monospace"}} onClick={()=>setRoMgmtConfirmDelete(ro.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {roMgmtViewRO&&<div style={{marginBottom:24}}><ROCard result={roMgmtViewRO.data} onExport={()=>roExportSingle(roMgmtViewRO.data)} /></div>}
      {roMgmtConfirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#0d1117",border:"1px solid #1e2d3d",borderRadius:8,padding:28,width:380}}>
            <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:10}}>Delete RO?</div>
            <p style={{fontSize:12,color:"#7d8590",marginBottom:20}}>This action cannot be undone.</p>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setRoMgmtConfirmDelete(null)}>Cancel</button>
              <button className="btn" style={{background:"#ea3943",color:"#fff",fontWeight:700}} onClick={()=>{setSavedROs((p:any[])=>p.filter(r=>r.id!==roMgmtConfirmDelete));setRoMgmtConfirmDelete(null);if(roMgmtViewRO?.id===roMgmtConfirmDelete)setRoMgmtViewRO(null);}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
