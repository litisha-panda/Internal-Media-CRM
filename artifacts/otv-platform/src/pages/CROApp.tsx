import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { getSessionToken, setSessionToken as setSessionTokenLib, authHeaders, apiFetch, ApiError } from "../services/api/_client";
import * as authSvc       from "../services/api/auth";
import * as attendSvc     from "../services/api/attendance";
import * as meetingsSvc   from "../services/api/meetings";
import * as tpSvc         from "../services/api/touchpoints";
import * as tasksSvc      from "../services/api/tasks";
import * as irSvc         from "../services/api/internalRequests";
import * as revSvc        from "../services/api/revenue";
import * as adminSvc      from "../services/api/admin";
import { useMeetings } from "../hooks/useMeetings";
import { useTouchpoints } from "../hooks/useTouchpoints";
import { useTasks } from "../hooks/useTasks";
// Context scaffold — provider wired in Task 12B
import { CROAppProvider, CROAppContextValue } from "../contexts/CROAppContext";
import { useAttendance } from "../hooks/useAttendance";
import { usePersistedState } from "../hooks/usePersistedState";
import { useApiEntityState } from "../hooks/useApiEntityState";
import { RepDashboard } from "../views/rep/RepDashboard";
import { MyPlan } from "../views/rep/MyPlan";
import { LogMeeting } from "../views/rep/LogMeeting";
import { externalPost } from "../services/api/external";
import { HomeScreen } from "../views/auth/HomeScreen";
import { AdminView } from "../views/admin/AdminView";
import { SystemConfigView } from "../views/system/SystemConfigView";
import { SetupWizardView } from "../views/shared/SetupWizardView";
import { WarroomView } from "../views/shared/WarroomView";
import { PipelineView } from "../views/pipeline/PipelineView";
import {
  LeaderboardView, InternalRequestsView, TeamView, ActivityView,
  EscalationsView, ComplianceView, HRView, TasksView,
  ROManagementView, RHXScoreView, RepAllRepsView, RepTeamView,
} from "../views/shared/SharedViews";
import { TargetsView } from "../views/revenue/TargetsView";
import { RevenueLogView } from "../views/revenue/RevenueLogView";
import { RHView } from "../views/rh/RHView";
import { NSHView } from "../views/nsh/NSHView";

import { DigiOpsView } from "../views/digiops/DigiOpsView";
import { AppTopbar } from "../components/AppTopbar";
import { WelcomeModal } from "../components/WelcomeModal";
import { TourOverlay } from "../components/TourOverlay";
import { MeetingDetailModal } from "../components/MeetingDetailModal";
import { PlanUploadModal } from "../components/PlanUploadModal";
import { AddDealModal } from "../components/AddDealModal";
import { EditIRModal } from "../components/EditIRModal";
import { ExceptionModal } from "../components/ExceptionModal";
import { ExceptionRequestModal } from "../components/ExceptionRequestModal";
import { AccountThreadModal } from "../components/AccountThreadModal";
import { AssignTaskModal } from "../components/AssignTaskModal";
import { NoteModal } from "../components/NoteModal";
// eslint-disable-next-line
declare const window: Window & typeof globalThis & { XLSX?: any; };



import {
  REGIONS, ALL_ROLES, DEAL_TYPES, CONTACT_LEVELS, DEAL_STAGES, OUTCOMES,
  DEPARTMENTS, REQ_STATUS, SLA, QUARTERS, STAGE_PROB, PITCH_TYPES,
  MEETING_STATUS, MEETING_TYPES, CLIENT_OR_AGENCY, TASK_PRIORITIES, TASK_STATUSES,
  APPROVAL_TARGETS, APPROVAL_SLA_DAYS, TODAY, TOMORROW, D1, D3, D7, D14,
  getToday, getTomorrow, getWeekStart, THIS_WEEK_START, PLAN_DEADLINE, HR_EMAIL,
  PLAN_STATUS, USER_ROLES, IP_CATALOG, TARGET_APPROVAL_CHAIN,
  ACTION_TYPES, C,
  fmt, fmtR, daysSince, dealStage, oColor, riskColor, riskLabel, lColor,
  mapLegacyOutcome, uid, REPS,
} from "../constants";
import type { Deal, RevenueEntry, Meeting, Touchpoint, Task, InternalReq, TargetSub, ClientAccount, UserRole, TaskForm, DealForm, IrForm, NoteModalConfig, SavedRO, AbsenceReport } from "../types";

// Route all Claude API calls through the API server proxy (key stays server-side)
const CLAUDE_PROXY_URL = `${window.location.protocol}//${window.location.hostname}:8080/api/claude`;


// ═══════════════════════════════════════════════════════════════════
// RO PARSER ENGINE — full v9.5 embedded
// ═══════════════════════════════════════════════════════════════════
const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let _xlsxLoaded = false, _xlsxPromise = null;
function loadXLSX() {
  if (_xlsxLoaded) return Promise.resolve((window as any).XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  // @ts-ignore
  _xlsxPromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = XLSX_CDN;
    s.onload = () => { _xlsxLoaded = true; res((window as any).XLSX); };
    s.onerror = rej; document.head.appendChild(s);
  });
  return _xlsxPromise;
}

const RO_CHANNEL_MAP = {
  "odisha television":"Odisha TV","odisha tv":"Odisha TV","o tv":"Odisha TV","otv":"Odisha TV",
  "tarang music":"Tarang Music","tarang tv":"Tarang","tarang":"Tarang",
  "prarthana tv":"Prarthana","prarthana":"Prarthana","alankar":"Alankar",
};
const RO_CHANNEL_MAP_KEYS = Object.keys(RO_CHANNEL_MAP).sort((a,b)=>b.length-a.length);
const RO_CHANNEL_COMPANY = {
  "Odisha TV":"Odisha Television Ltd","Prarthana":"Odisha Television Ltd",
  "Tarang":"Tarang Broadcasting Company Ltd","Tarang Music":"Tarang Broadcasting Company Ltd","Alankar":"Tarang Broadcasting Company Ltd",
};
const ALL_CHANNELS = ["Odisha TV","Tarang","Tarang Music","Alankar","Prarthana"];
function roNormalizeChannel(ch) {
  if (!ch) return "";
  const l = ch.toLowerCase().trim();
  for (const k of RO_CHANNEL_MAP_KEYS) { if (l.includes(k)) return RO_CHANNEL_MAP[k]; }
  return ch;
}

const RO_START_BANDS = ["06:30:00","07:00:00","07:30:00","08:00:00","08:30:00","09:00:00","09:30:00","10:00:00","10:30:00","11:00:00","11:30:00","12:00:00","12:30:00","13:00:00","13:30:00","14:00:00","14:30:00","15:00:00","15:30:00","16:00:00","16:30:00","17:00:00","17:30:00","18:00:00","18:30:00","19:00:00","19:30:00","20:00:00","20:30:00","21:00:00","21:30:00","22:00:00","22:30:00","23:00:00","23:30:00","24:00:00","24:30:00","01:00:00","01:30:00","02:00:00","02:30:00","03:00:00","03:30:00","04:00:00","04:30:00","05:00:00","05:30:00","06:00:00"];
const RO_END_BANDS   = ["07:00:00","07:30:00","08:00:00","08:30:00","09:00:00","09:30:00","10:00:00","10:30:00","11:00:00","11:30:00","12:00:00","12:30:00","13:00:00","13:30:00","14:00:00","14:30:00","15:00:00","15:30:00","16:00:00","16:30:00","17:00:00","17:30:00","18:00:00","18:30:00","19:00:00","19:30:00","20:00:00","20:30:00","21:00:00","21:30:00","22:00:00","22:30:00","23:00:00","23:30:00","24:00:00","24:30:00","01:00:00","01:30:00","02:00:00","02:30:00","03:00:00","03:30:00","04:00:00","04:30:00","05:00:00","05:30:00","06:00:00","06:30:00"];
const RO_NON_FCT_TYPES = ["I Band","L Band","Anchor Mention","Logo Countdown","Aston Countdown","Coffee Mug","Super Impose"];
const RO_SPONSORSHIP_KEYWORDS = ["powered by","co-powered by","co powered by","pwd by","co pwd by","associate sponsor","co-sponsor","co sponsor","presenting sponsor","title sponsor","sponsored by"];
const RO_SEGMENTS = ["EDUCATION","REGIONAL CORPORATE","PRIVATE","GOVERNMENT"];
const RO_PT_START = 19*60, RO_PT_END = 23*60;

function roSnapBand(t, bands) {
  if (!t) return "";
  const clean = t.replace(/\./g,":").trim();
  const hhmm = clean.length===4?"0"+clean:clean.substring(0,5);
  return bands.find(b=>b.substring(0,5)===hhmm)||(hhmm+":00");
}
function roToMins(t) { if(!t) return -1; const p=t.substring(0,5).split(":"); return parseInt(p[0]||0)*60+parseInt(p[1]||0); }
function roMinsToTime(m) { return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:00`; }
function roFmtMoney(n) { return n?"Rs."+Number(n).toLocaleString("en-IN"):"---"; }
function roRound2(n) { return Math.round((n||0)*100)/100; }
function roDetectNonFCT(d) { if(!d)return false; return RO_NON_FCT_TYPES.some(t=>d.toLowerCase().includes(t.toLowerCase())); }
function roDetectDealType(r) {
  const text=[r.special_instructions||"",r.campaign_name||"",...(r.spot_items||[]).map(s=>(s.caption||"")+" "+(s.program_or_timeband||"")),...(r.components||[]).map(c=>c.component_label||"")].join(" ").toLowerCase();
  if(RO_SPONSORSHIP_KEYWORDS.some(k=>text.includes(k))||(r.components||[]).some(c=>["EVENT_FCT","SPONSORSHIP_ENTITLEMENT"].includes(c.component_type))) return "IPs";
  if((r.components||[]).some(c=>!c.is_fct)||(r.spot_items||[]).some(s=>roDetectNonFCT(s.caption||s.program_or_timeband||""))) return "Impact";
  return "Regular";
}
function roDetectSegment(r) { const t=JSON.stringify(r).toUpperCase(); return RO_SEGMENTS.find(s=>t.includes(s))||""; }
function roParseDays(d) {
  const result={Sun:false,Mon:false,Tues:false,Wed:false,Thurs:false,Fri:false,Sat:false};
  if(!d)return result; const s=String(d).toLowerCase();
  if(s.includes("daily")||s.includes("all")||s.includes("everyday")){Object.keys(result).forEach(k=>result[k]=true);return result;}
  if(s.includes("weekday")||s.match(/mon.*fri/)){result.Mon=result.Tues=result.Wed=result.Thurs=result.Fri=true;return result;}
  if(s.includes("weekend")){result.Sun=result.Sat=true;return result;}
  if(s.includes("sun")) result.Sun=true; if(s.includes("mon")) result.Mon=true;
  if(s.includes("tue")) result.Tues=true; if(s.includes("wed")) result.Wed=true;
  if(s.includes("thu")) result.Thurs=true; if(s.includes("fri")) result.Fri=true;
  if(s.includes("sat")) result.Sat=true;
  return result;
}
function roSplitPTNPT(sSnap,eSnap) {
  const sm=roToMins(sSnap),em=roToMins(eSnap);
  if(sm<0||em<0||em<=sm) return [{start:sSnap,end:eSnap}];
  const c19=sm<RO_PT_START&&em>RO_PT_START, c23=sm<RO_PT_END&&em>RO_PT_END;
  if(c19&&c23) return [{start:sSnap,end:roMinsToTime(RO_PT_START)},{start:roMinsToTime(RO_PT_START),end:roMinsToTime(RO_PT_END)},{start:roMinsToTime(RO_PT_END),end:eSnap}];
  if(c19) return [{start:sSnap,end:roMinsToTime(RO_PT_START)},{start:roMinsToTime(RO_PT_START),end:eSnap}];
  if(c23) return [{start:sSnap,end:roMinsToTime(RO_PT_END)},{start:roMinsToTime(RO_PT_END),end:eSnap}];
  return [{start:sSnap,end:eSnap}];
}
function roGetPTNPT(s) { const m=roToMins(s); return m>=RO_PT_START&&m<RO_PT_END?"PT":"NPT"; }
function roBuildDealName(r) {
  const client=r.client_name||"",agency=r.agency_name||"",ch=roNormalizeChannel(r.channel||"");
  let my=r.activity_month||"";
  // @ts-ignore
  if(!my&&r.start_date){try{const d=new Date(r.start_date);if(!isNaN(d))my=d.toLocaleDateString("en-IN",{month:"short",year:"numeric"});}catch(e){}}
  return [client,agency,ch,my].filter(Boolean).join(" - ");
}
function roMakeSheet(wb,name,rows){
  if(!rows||(Array.isArray(rows)&&!rows.length))return;
  const ws=(window as any).XLSX.utils.json_to_sheet(Array.isArray(rows)?rows:[rows]);
  ws["!cols"]=Array(50).fill({wch:18}); (window as any).XLSX.utils.book_append_sheet(wb,ws,name);
}
function roBuildExport(r) {
  const ch=roNormalizeChannel(r.channel||"");
  const hasAgency=!!(r.agency_name||"").trim();
  const dealName=roBuildDealName(r);
  const grossAmt=r.gross_amount||0, discountAmt=r.discount_amount||0, commAmt=r.agency_commission_amount||0;
  const expectedRevenue=grossAmt-discountAmt-commAmt||grossAmt;
  const segment=roDetectSegment(r);
  const dealRow={
    "Deal Name":dealName,"Pipeline":"Deals","Stage":"Proposal/Price Quote",
    "Advertiser":r.client_name||"","Channel Name":ch,"Contract Date":r.ro_date||"",
    "From Date":r.start_date||"","To Date":r.end_date||"","Agency Name":r.agency_name||"",
    "Segment":segment,"Contract Ref No.":r.ro_number||"",
    "Commission":hasAgency?"AGENCY BILLING ON NET":"DIRECT TO CLIENT",
    "Currencies":"","Remarks":r.special_instructions||"","Payment Terms":r.payment_terms||"",
    "Credit Period":"","Region Name":"","Sales Executive Name":"","Reference Date":"","Deal Owner":"",
  };
  const breakupRows=[]; let lineNo=1;
  const spotItems=(r.spot_items||[]).filter(item=>{
    const prog=(item.program_or_timeband||"").trim().toLowerCase();
    if(!prog)return false;
    if(prog==="total"||prog==="sub total"||prog==="subtotal"||prog==="grand total")return false;
    return true;
  });
  spotItems.forEach(item=>{
    const isBonus=item.payment_type==="Bonus", isBarter=(item.payment_type||"").toLowerCase()==="barter";
    const spotType=isBarter?"Barter":isBonus?"Bonus":"Paid";
    const tbParts=(item.time_band||"").split("-");
    const sSnap=roSnapBand(tbParts[0],RO_START_BANDS), eSnap=roSnapBand(tbParts[1]||"",RO_END_BANDS);
    const splits=roSplitPTNPT(sSnap,eSnap);
    const inventory=item.total_fct||(item.no_of_spots&&item.spot_duration_sec?item.no_of_spots*item.spot_duration_sec:0);
    const days=roParseDays(item.days||"");
    const prog=item.program_or_timeband||item.caption||"";
    splits.forEach(sp=>{
      // @ts-ignore
      breakupRows.push({
        "Deal Line No":lineNo++,"Channel":ch,"From Date":r.start_date||"","To Date":r.end_date||"",
        "Contract Type":"","Secondary Type":"","Timeband Name":prog,"Content Type":prog,
        "Start Time":sp.start,"End Time":sp.end,"Spot Type":spotType,"Inventory":inventory||"",
        "Rate":isBonus?"":(item.net_rate_per_10sec||""),"Amount":"","Cancel":"No",
        "Consumed Inventory":"","Balanced Inventory":"",
        "Sun":days.Sun?"Yes":"No","Mon":days.Mon?"Yes":"No","Tues":days.Tues?"Yes":"No",
        "Wed":days.Wed?"Yes":"No","Thurs":days.Thurs?"Yes":"No","Fri":days.Fri?"Yes":"No","Sat":days.Sat?"Yes":"No",
        "Internal Rate":"","Internal Amount":"","Pending Amount":"",
        "PT/NPT":roGetPTNPT(sp.start),
        "Remarks":isBonus?"Bonus":(prog+(item.spot_duration_sec?" "+item.spot_duration_sec+"s":"")).trim(),
      });
    });
  });
  const totalInventory=breakupRows.filter(r=>r["Spot Type"]!=="Bonus").reduce((s,r)=>s+Number(r["Inventory"]||0),0);
  const totalSlots=spotItems.filter(s=>s.payment_type!=="Bonus").reduce((s,i)=>s+Number(i.no_of_spots||0),0);
  const totalAmount=spotItems.filter(s=>s.payment_type!=="Bonus").reduce((s,i)=>s+Number(i.net_cost||0),0);
  const er=totalInventory>0?roRound2(totalAmount*10/totalInventory):0;
  const summaryRow={"Inventory":totalInventory||"","Total Slot":totalSlots||"","Amount":totalAmount||"","Inventory Eff. Rate":er||"","Slot/Secondary Eff. Rate":"","ER comparison with...":"","Volume Discount":"","Volume Discount Amount":"","Total Amount":expectedRevenue||totalAmount||""};
  return {dealRow,breakupRows,summaryRow,meta:{totalInventory,totalSlots,totalAmount,er,expectedRevenue,grossAmt,discountAmt,commAmt}};
}

function ROFieldCard({label,value,highlight=false,warn=false}: {label:any,value:any,highlight?:boolean,warn?:boolean}){
  if(!value&&value!==0)return null;
  return(
    <div style={{background:"#0f1117",borderRadius:8,padding:"9px 13px",border:`1px solid ${warn?"#7f1d1d":"#1e2d3d"}`}}>
      <div style={{color:warn?"#fca5a5":"#7d8590",fontSize:10,fontWeight:600,textTransform:"uppercase",marginBottom:3,letterSpacing:".05em"}}>{label}</div>
      <div style={{color:highlight?"#16c784":warn?"#fca5a5":"#e6edf3",fontSize:12,fontWeight:highlight||warn?700:500}}>{String(value)}</div>
    </div>
  );
}
function ROTableView({rows,hideCols=[]}){
  if(!rows||!rows.length)return<div style={{color:"#7d8590",fontSize:12,padding:8}}>No rows.</div>;
  // @ts-ignore
  const keys=Object.keys(rows[0]).filter(k=>!k.startsWith("_")&&!hideCols.includes(k));
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr>{keys.map(k=><th key={k} style={{padding:"5px 9px",background:"#080a0f",color:"#7d8590",fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",whiteSpace:"nowrap",borderBottom:"1px solid #1e2d3d"}}>{k}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=>(
          <tr key={i} style={{borderBottom:"1px solid #0d1117",background:row["Spot Type"]==="Bonus"?"#0a1a0a":"transparent"}}>
            {keys.map(k=>(
              <td key={k} style={{padding:"5px 9px",whiteSpace:"nowrap",fontSize:11,color:
                k==="PT/NPT"?(row[k]==="PT"?"#f0a500":"#60a5fa"):
                k==="Spot Type"?(row[k]==="Paid"?"#a855f7":row[k]==="Bonus"?"#16c784":"#f97316"):
                ["Sun","Mon","Tues","Wed","Thurs","Fri","Sat"].includes(k)?(row[k]==="Yes"?"#16c784":"#2a3a4d"):
                "#e6edf3"
              }}>{row[k]!=null&&row[k]!==""?String(row[k]):"---"}</td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
function RORoutingCard({r,exp}){
  const ch=roNormalizeChannel(r.channel||"");
  const company=RO_CHANNEL_COMPANY[ch]||"Odisha Television Ltd";
  const dealType=roDetectDealType(r);
  const dtColor=dealType==="IPs"?"#f0a500":dealType==="Impact"?"#f97316":"#a855f7";
  const chValid=ALL_CHANNELS.includes(ch); const m=exp.meta;
  return(
    <div style={{background:"#080a0f",border:"1px solid #1e2d3d",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
      <div style={{fontSize:10,fontWeight:700,color:"#2a3a4d",textTransform:"uppercase",letterSpacing:".08em",marginBottom:9}}>RO Routing</div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:10,fontSize:12}}>
        <div style={{background:"#1a2332",borderRadius:5,padding:"3px 9px",color:"#60a5fa",fontWeight:600}}>{company}</div>
        <span style={{color:"#1e2d3d"}}>›</span>
        <div style={{background:chValid?"#1a1a3a":"#3a1a1a",border:`1px solid ${chValid?"#4338ca":"#7f1d1d"}`,borderRadius:5,padding:"3px 9px",color:chValid?"#a855f7":"#f87171",fontWeight:600}}>{ch||"⚠ Unknown"}</div>
        <span style={{color:"#1e2d3d"}}>›</span>
        <div style={{background:"#0a1a0a",borderRadius:5,padding:"3px 9px",color:"#16c784",fontWeight:600}}>Deals Pipeline</div>
        <span style={{color:"#1e2d3d"}}>›</span>
        <div style={{background:"#1a1a0a",borderRadius:5,padding:"3px 9px",color:dtColor,fontWeight:700}}>{dealType}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:7,marginBottom:10}}>
        {m.grossAmt>0&&<ROFieldCard label="Gross" value={roFmtMoney(m.grossAmt)} />}
        {m.discountAmt>0&&<ROFieldCard label="Discount" value={roFmtMoney(m.discountAmt)} warn />}
        {m.commAmt>0&&<ROFieldCard label="Commission" value={roFmtMoney(m.commAmt)} warn />}
        {m.expectedRevenue>0&&<ROFieldCard label="Expected Revenue" value={roFmtMoney(m.expectedRevenue)} highlight />}
        {m.totalInventory>0&&<ROFieldCard label="Total Inventory (s)" value={m.totalInventory} />}
        {m.totalSlots>0&&<ROFieldCard label="Total Spots" value={m.totalSlots} />}
        {m.er>0&&<ROFieldCard label="ER per 10s" value={"Rs."+m.er} />}
      </div>
      {!chValid&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:6,padding:"7px 11px",fontSize:11,color:"#fca5a5"}}>⚠ "{ch}" is not a recognised channel. Valid: {ALL_CHANNELS.join(" · ")}</div>}
      <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"7px 11px",fontSize:11,color:"#16c784",marginTop:7}}>
        ⚠ <strong>Contract Type</strong> and <strong>Secondary Type</strong> — fill in before filing. <strong>Timeband Name</strong> pre-filled from RO — verify against rate card.
      </div>
    </div>
  );
}
function ROCard({result,onExport,onPushToPipeline}){
  const [activeTab,setActiveTab]=useState("deal");
  const [copied,setCopied]=useState(false);
  const badge={RELEASE_ORDER:{bg:"#1a1a3a",color:"#a855f7",label:"Release Order"},RO_ADDITION:{bg:"#2a1a1a",color:"#f97316",label:"RO Addition"},SALES_AGREEMENT:{bg:"#0a1a0a",color:"#16c784",label:"Sales Agreement"}}[result.document_type]||{bg:"#1a2332",color:"#7d8590",label:"RO"};
  const exp=roBuildExport(result);
  const dealType=roDetectDealType(result);
  const dtColor=dealType==="IPs"?"#f0a500":dealType==="Impact"?"#f97316":"#a855f7";
  const m=exp.meta;
  const tabs=[{id:"deal",label:"Deal Form"},{id:"breakup",label:`Breakup (${exp.breakupRows.length})`},{id:"summary",label:"Summary"},{id:"spots",label:`Raw Spots (${(result.spot_items||[]).length})`},{id:"json",label:"JSON"}];
  return(
    <div style={{background:"#0d1117",borderRadius:10,border:"1px solid #1e2d3d",overflow:"hidden",marginBottom:12}}>
      <div style={{padding:"12px 16px",background:"#080a0f",borderBottom:"1px solid #1e2d3d",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
            <span style={{background:badge.bg,color:badge.color,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700}}>{badge.label}</span>
            <span style={{background:"#1a1a0a",color:dtColor,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700}}>{dealType}</span>
            {result.ro_number&&<span style={{color:"#7d8590",fontSize:11}}>#{result.ro_number}</span>}
            {result.ro_date&&<span style={{color:"#7d8590",fontSize:11}}>{result.ro_date}</span>}
          </div>
          <div style={{fontSize:15,fontWeight:700}}>{result.client_name}{result.brand_name?" — "+result.brand_name:""}</div>
          <div style={{fontSize:12,color:"#7d8590",marginTop:2}}>{[result.agency_name,roNormalizeChannel(result.channel||""),result.campaign_name||result.activity_month].filter(Boolean).join(" · ")}</div>
          <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
            {m.totalSlots>0&&<span style={{color:"#a855f7",fontSize:12,fontWeight:600}}>{m.totalSlots} Spots</span>}
            {m.totalInventory>0&&<span style={{color:"#60a5fa",fontSize:12}}>{m.totalInventory}s Inventory</span>}
            {m.er>0&&<span style={{color:"#f0a500",fontSize:12}}>ER Rs.{m.er}/10s</span>}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          {m.grossAmt>0&&<div style={{fontSize:12,color:"#7d8590"}}>Gross: {roFmtMoney(m.grossAmt)}</div>}
          {m.discountAmt>0&&<div style={{fontSize:11,color:"#f97316"}}>− Discount: {roFmtMoney(m.discountAmt)}</div>}
          {m.commAmt>0&&<div style={{fontSize:11,color:"#f97316"}}>− Commission: {roFmtMoney(m.commAmt)}</div>}
          <div style={{fontSize:19,fontWeight:700,color:"#16c784",marginTop:4}}>{roFmtMoney(result.total_payable||m.expectedRevenue||m.grossAmt)}</div>
          <div style={{fontSize:10,color:"#7d8590"}}>Net Payable</div>
        </div>
      </div>
      <div style={{padding:"10px 16px",background:"#0a1a0a",borderBottom:"1px solid #1e2d3d",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>onExport(result)} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"8px 22px",borderRadius:7,cursor:"pointer",fontWeight:700,fontSize:13}}>Export Deal + Breakup</button>
        {onPushToPipeline && (
          <button onClick={()=>onPushToPipeline(result)} style={{background:"linear-gradient(135deg,#16c784,#0ea570)",color:"#fff",border:"none",padding:"8px 22px",borderRadius:7,cursor:"pointer",fontWeight:700,fontSize:13}}>⬡ Push to Pipeline</button>
        )}
        <span style={{color:"#7d8590",fontSize:11}}>Deal + Breakup + Summary sheets</span>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #1e2d3d",overflowX:"auto"}}>
        {tabs.map(t=>{const a=activeTab===t.id;return<button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"9px 16px",background:"transparent",border:"none",color:a?"#a855f7":"#7d8590",fontWeight:a?700:400,fontSize:12,cursor:"pointer",borderBottom:a?"2px solid #a855f7":"2px solid transparent",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>{t.label}</button>;})}
      </div>
      <div style={{padding:16}}>
        {activeTab==="deal"&&<div><RORoutingCard r={result} exp={exp} /><div style={{fontSize:10,fontWeight:700,color:"#7d8590",textTransform:"uppercase",marginBottom:7,letterSpacing:".08em"}}>Deal Form Fields</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:7}}>{Object.entries(exp.dealRow).filter(([,v])=>v).map(([k,v])=><ROFieldCard key={k} label={k} value={String(v)} highlight={k==="Deal Name"||k==="Advertiser"} warn={k==="Commission"&&v==="AGENCY BILLING ON NET"} />)}</div></div>}
        {activeTab==="breakup"&&<div><div style={{background:"#1a1a0a",border:"1px solid #854d0e",borderRadius:6,padding:"7px 11px",marginBottom:10,fontSize:11,color:"#f0a500"}}>⚠ Contract Type and Secondary Type left blank — fill in before filing.</div><ROTableView rows={exp.breakupRows} /></div>}
        {activeTab==="summary"&&<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:7}}>{[["Total Inventory",m.totalInventory?m.totalInventory+"s":null],["Total Spots",m.totalSlots||null],["Total Amount",m.totalAmount?roFmtMoney(m.totalAmount):null],["ER","Rs."+(m.er||0)+"/10s"],["Gross",m.grossAmt?roFmtMoney(m.grossAmt):null],["Discount",m.discountAmt?roFmtMoney(m.discountAmt):null],["Commission",m.commAmt?roFmtMoney(m.commAmt):null],["Net Payable",roFmtMoney(result.total_payable||m.expectedRevenue||m.grossAmt)]].filter(e=>e[1]).map(([k,v])=><ROFieldCard key={k} label={k} value={v} highlight={k==="Net Payable"} warn={k==="Discount"||k==="Commission"} />)}</div></div>}
        {activeTab==="spots"&&<ROTableView rows={(result.spot_items||[]).filter(item=>{const p=(item.program_or_timeband||"").trim().toLowerCase();return p&&p!=="total"&&p!=="subtotal"&&p!=="sub total"&&p!=="grand total";}).map(s=>({"Program":s.program_or_timeband||"","Days":s.days||"","Timeband":s.time_band||"","Caption":s.caption||"","Dur(s)":s.spot_duration_sec||"","Type":s.payment_type||"Paid","FCT(s)":s.total_fct||"","Rate/10s":s.net_rate_per_10sec||"","Spots":s.no_of_spots||"","Net Cost":s.net_cost||""}))} />}
        {activeTab==="json"&&<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:7}}><button onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(result,null,2));setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:"#1a2332",color:"#7d8590",border:"none",padding:"4px 11px",borderRadius:5,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{copied?"Copied!":"Copy JSON"}</button></div><pre style={{background:"#080a0f",borderRadius:7,padding:14,fontSize:11,color:"#16c784",overflowX:"auto",margin:0,maxHeight:480,overflow:"auto"}}>{JSON.stringify(result,null,2)}</pre></div>}
      </div>
    </div>
  );
}

const RO_PROMPT=`You are an expert at parsing ALL types of Indian broadcast TV advertising Release Orders for OTV (Odisha Television Network).

Return ONLY valid compact JSON. For multi-channel ROs return a JSON ARRAY, one object per channel. No preamble, no markdown, no explanation.

JSON fields (omit null/0/empty):
{"ro_number":"","ro_date":"","document_type":"RELEASE_ORDER","client_name":"","brand_name":"","agency_name":"","channel":"","campaign_name":"","activity_month":"","start_date":"","end_date":"","contact_person":"",
"spot_items":[{"program_or_timeband":"","days":"","time_band":"","caption":"","spot_duration_sec":0,"payment_type":"Paid","total_fct":0,"net_rate_per_10sec":0,"no_of_spots":0,"net_cost":0,"tvr":0}],
"components":[{"component_type":"REGULAR_FCT","component_label":"","channel":"","is_fct":true,"items":[{"description":"","date_or_days":"","time_band":"","fct_seconds":0,"spots_or_quantity":0,"net_rate":0,"is_bonus":false,"net_cost":0}],"component_total_fct":0,"component_net_cost":0}],
"gross_amount":0,"discount_amount":0,"agency_commission_pct":0,"agency_commission_amount":0,"igst_pct":18,"igst_amount":0,"total_payable":0,"total_spots_paid":0,"total_spots_bonus":0,"total_fct_seconds":0,"payment_terms":"","special_instructions":""}

LOCKED BUSINESS RULES:
- Odisha Television Ltd: ONE channel only — OTV (Odisha TV)
- Tarang Broadcasting Company Ltd: FOUR channels — Tarang TV, Tarang Music, Alankar, Prarthana
- Prarthana = Odisha Television Ltd (NOT Tarang)
- Deal types: Regular (FCT only) | Impact (FCT + Non-FCT) | Sponsorship (FCT + Non-FCT + sponsor keywords)
- Non-FCT types: I Band, L Band, Anchor Mention, Logo Countdown, Aston Countdown, Coffee Mug, Super Impose
- Timebands: HH:MM:SS always. PT = 19:00–23:00 all channels | NPT = everything else

CRITICAL: MULTI-CHANNEL SPLIT — Every time Channel column value changes → new deal object. Return JSON ARRAY.
CRITICAL: SPONSORSHIP DETECTION — "Powered By","Co-Powered By","Pwd By","Co Pwd By","Sponsored By" anywhere → SPONSORSHIP_ENTITLEMENT component + flag special_instructions.
CRITICAL: TOTAL GROSS COLUMN — If present: use per-row values directly as net_cost. gross_amount = SUM of that channel's rows ONLY.
CRITICAL: DISCOUNT AND COMMISSION — discount_amount and agency_commission_amount stored separately. total_payable = gross − discount − commission + igst.
CRITICAL: DURATION ROW UNIQUENESS — Same program + same timeband + different duration = SEPARATE spot_items rows.
CRITICAL: NEVER include Total/Subtotal/Grand Total rows as spot_items.

PARSER TEMPLATES:
T1 WPP/Wavemaker/EssenceMediacom: RODP(18.00-23.00)→timeband; spots by column header
T2 Omnicom/FCBUlka: SPOTBUY/RODP category column; Programme and Time separate
T3 Madison: Caption rows=headers; CAPTION INHERITANCE (text+duration carry down)
T4 Zenith/TLG: timeband from parentheses e.g. JODI NO.1(21:30-22:30)
T5 Spark Foundry Excel: ST/ET integers(700=07:00,2400=24:00)
T6 Prachar: HHMM format(0700-0800→07:00-08:00); Spot col=Paid/Bonus
T7 ENES/Direct Client: Channel column change = new deal; Spots=Spot-per-day×Days
T8 Multi-sheet Excel: Parse ALL sheets; each channel/sheet = separate deal; return JSON array

AMOUNT RULES: gross_amount = SUM of Total Gross column per channel. total_payable = gross − discount − commission + igst.
EXTRACT FIRST, AGGREGATE SECOND.`;

function roExtractJSON(text) {
  let s=text.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,t=>t.replace(/```json|```/g,"")).trim();
  try{return JSON.parse(s);}catch(e){}
  const ai=s.indexOf("["),zi=s.lastIndexOf("]");
  if(ai!==-1&&zi>ai){try{return JSON.parse(s.slice(ai,zi+1));}catch(e){}}
  const oi=s.indexOf("{"),zo=s.lastIndexOf("}");
  if(oi!==-1&&zo>oi){try{return JSON.parse(s.slice(oi,zo+1));}catch(e){}}
  throw new Error("No valid JSON found in response:\n"+s.substring(0,400));
}
function roNormalizeDoc(r) {
  const dt=(r.document_type||"").toUpperCase();
  if(dt.includes("WORK")||dt.includes("LETTER")||dt.includes("AGREEMENT")||dt.includes("MOU")) r.document_type="SALES_AGREEMENT";
  else if(dt.includes("ADDITION")||dt.includes("ADDENDUM")) r.document_type="RO_ADDITION";
  else r.document_type="RELEASE_ORDER";
  return r;
}
async function roReadExcelAsText(file) {
  const XLSX=await loadXLSX();
  return new Promise((res,rej)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read((e.target as FileReader).result,{type:"array",cellFormula:false,cellNF:false,raw:false});
        let text="";
        wb.SheetNames.forEach(n=>{text+="\n=== Sheet: "+n+" ===\n";text+=XLSX.utils.sheet_to_csv(wb.Sheets[n]);});
        res(text);
      }catch(err: any) {rej(err);}
    };
    reader.readAsArrayBuffer(file);
  });
}
async function roBuildMessages(file) {
  if(file.name.match(/\.(xlsx|xls|csv)$/i)){
    const text=await roReadExcelAsText(file);
    return [{role:"user",content:"Parse this TV Release Order. If multiple channels return JSON ARRAY one object per channel:\n\n"+text}];
  }
  if(file.type==="application/pdf"||file.type.startsWith("image/")){
    return new Promise(res=>{
      const r=new FileReader();
      r.onload=()=>{
        const b64=(r.result as string).split(",")[1];
        const block=file.type==="application/pdf"?{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}:{type:"image",source:{type:"base64",media_type:file.type,data:b64}};
        res([{role:"user",content:[block,{type:"text",text:"Parse this TV Release Order. Extract ALL items. If multiple channels return JSON ARRAY one object per channel."}]}]);
      };
      r.readAsDataURL(file);
    });
  }
  return new Promise(res=>{const r=new FileReader();r.onload=()=>res([{role:"user",content:"Parse this TV RO. If multiple channels return JSON array:\n\n"+(r.result as string)}]);r.readAsText(file);});
}
function roFriendlyError(err) {
  const m = err.message || "";
  if (m.includes("401")) return "API key invalid or missing — contact your admin.";
  if (m.includes("429")) return "Too many requests — wait 30 seconds and try again.";
  if (m.includes("timed out")) return "Parse timed out (2 min). Try a smaller file or paste the text manually.";
  if (m.includes("JSON") || m.includes("json")) return "The AI couldn't extract structured data. Try pasting the RO text directly.";
  if (m.includes("AbortError") || m.includes("abort") || m.includes("cancelled")) return "Parse cancelled.";
  return `Parse failed: ${m}`;
}

let _roAbortCtrl = null;
// @ts-ignore
function roCancelParse() { if (_roAbortCtrl) { _roAbortCtrl.abort(); _roAbortCtrl = null; } }

async function roCallAPI(msgs) {
  roCancelParse();
  // @ts-ignore
  _roAbortCtrl = new AbortController();
  // @ts-ignore
  const tid = setTimeout(() => { if (_roAbortCtrl) _roAbortCtrl.abort(); }, 120000);
  try {
    const resp = await fetch("/api/claude", {
      method: "POST",
      // @ts-ignore
      signal: _roAbortCtrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:16000, system:RO_PROMPT, messages:msgs })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return (data.content || []).map(b => b.text || "").join("").trim();
  } catch(err: any) {
    if (err.name === "AbortError") throw new Error("timed out");
    throw err;
  } finally {
    clearTimeout(tid);
    _roAbortCtrl = null;
  }
}

// Simple client-side password hash using PBKDF2 via WebCrypto
async function hashPwd(password) {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt:enc.encode("otv-crm-v1"), iterations:50000, hash:"SHA-256" }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  } catch { return btoa(password); } // fallback if SubtleCrypto unavailable
}


// ─── LOGIN COMPONENT ──────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = "773380743026-i87vjdrj5n699von60sa3plqqv95mlem.apps.googleusercontent.com";

// ── Session token store ───────────────────────────────────────────────────────
// Replit's path-based proxy prevents httpOnly cookies from being forwarded reliably.
// We store the session token in localStorage and send it as X-Session-Token header
// on all API requests. The server accepts either cookie OR this header.
// getSessionToken, setSessionTokenLib, authHeaders are imported from services/api/_client.
function setSessionTokenStore(t: string | null): void {
  setSessionTokenLib(t);
}


// ── DATA VERSION AUTO-CLEAR ────────────────────────────────────────────────
// Bump this string whenever seed data or schema changes to wipe stale localStorage.
const DATA_VERSION = "v3-clean";
(function clearStaleData() {
  try {
    if (localStorage.getItem("otv_data_version") !== DATA_VERSION) {
      const keysToRemove = Object.keys(localStorage).filter(k =>
        k.startsWith("otv_") && k !== "otv_data_version" && k !== "otv_session_token"
      );
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem("otv_data_version", DATA_VERSION);
    }
  } catch {}
})();

// ─── VIRTUAL TOUR DATA ───────────────────────────────────────────────────────
const TOUR_DATA = {
  rep: {
    welcome:{ title:"Welcome to OTV CRM", subtitle:"Your personal sales command centre", bullets:["📅 Plan & log client meetings from My Plan","💼 Track every deal in the Revenue Tracker","✅ Manage action items in Tasks","📤 Submit proposals via Internal Requests"] },
    steps:[
      {title:"My Plan — Your Daily Home", desc:"Start every morning here. Today's planned meetings appear in the left panel with time, client name, agenda, and any deal blockers. Tomorrow's plan sits right next to it — plan ahead so your day is never empty.", nav:"my-plan", target:"my-plan"},
      {title:"Planning a Meeting", desc:"Click '+ Add' next to TODAY or TOMORROW to schedule a client meeting. Set the client name, time, agenda, pitch type, and meeting type (physical / online / call).", nav:"my-plan", target:"content-area"},
      {title:"Logging a Meeting — and the 11:30 PM Rule", desc:"After the meeting, tap its entry to expand the log form. Fill in what happened, client feedback, and outcome. Important: you must log at least one meeting before 11:30 PM every working day. If nothing is logged by midnight, the system automatically marks you Absent for that day — this feeds directly into your HR attendance record.", nav:"my-plan", target:"content-area", tip:"No meeting that day? Still log a brief office or client call entry so your attendance is captured."},
      {title:"Follow-up & Next Meeting Dates", desc:"Inside the log form, set a Follow-up Date (📞) and/or Next Meeting Date (📅). These auto-create entries in your calendar so nothing slips through the cracks.", nav:"my-plan", target:"content-area"},
      {title:"Calendar View", desc:"Switch to the Calendar tab on My Plan for a weekly view. Each cell shows chips with time, type label, client name, and agenda — so you can spot a busy day vs a free one instantly. Click any future cell to plan a meeting.", nav:"my-plan", target:"content-area", tip:"Chips are colour-coded: blue = follow-up call, green = scheduled meeting, orange = action item."},
      {title:"Revenue Tracker (Pipeline)", desc:"Track every deal — client, deal type (FCT / IPs / Digital / Integrated / Media Solutions), amount, quarter, and outcome. Update this after every meeting so your RH has an accurate picture.", nav:"pipeline", target:"pipeline"},
      {title:"Adding & Updating Deals", desc:"Click '+ Add Deal' to create a new pipeline entry. Fill in client, deal type, quarter, and target amount. Update the deal stage after every client interaction so your pipeline always reflects where each deal stands.", nav:"pipeline", target:"content-area", tip:"Deal types: Linear TV = air-time, IPs = integrated properties, Media Solutions = branded content. Ask your RH if unsure."},
      {title:"My Targets", desc:"View your quarterly revenue target and current progress. When your RH asks you to submit targets, use the '+ Submit Target' form here and it flows to them for approval.", nav:"target-submit", target:"target-submit"},
      {title:"Tasks", desc:"Action items assigned to you or self-created. Use '+ Create Task' to track anything — calls to make, proposals to send, approvals to chase. Set due dates so nothing is forgotten.", nav:"tasks", target:"tasks"},
      {title:"Internal Requests", desc:"Need a custom rate card, a creative brief, or pricing approval from NSH? Raise an Internal Request here, tag the right department, and track its status end-to-end.", nav:"internal-requests", target:"internal-requests"},
      {title:"War Room", desc:"Your personal alert centre. Clients with no contact in 14+ days show as at-risk, and overdue follow-ups surface here. Check this when you're between meetings.", nav:"warroom", target:"warroom"},
      {title:"HR Reports & Attendance", desc:"Your attendance record lives here. The system auto-marks you Present if you log a meeting, or Absent if nothing is logged by 11:30 PM. If you're out on client visits, WFH, or on leave, submit an Exception Request here before 11:30 PM — your RH approves it and your record is corrected. Never let the day end without either logging a meeting or raising an exception.", nav:"hr", target:"hr", tip:"Exceptions: Client Visit, WFH, On Leave, Field Work. Your RH gets an instant notification to approve."},
      {title:"You're all set! 🎉", desc:"Daily rhythm: Morning → My Plan → Log meetings as you go → Update pipeline after each call → End of day → Check calendar for tomorrow. Tap '?' in the top bar anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  rh: {
    welcome:{ title:"Welcome, Region Head!", subtitle:"Your regional sales command centre", bullets:["⬡ War Room — live team activity & at-risk alerts","📋 Team's Plan — all rep meetings at a glance","✓ Approve targets, assign tasks, escalate deals","◇ Leaderboard — track rep performance weekly"] },
    steps:[
      {title:"My Plan", desc:"Plan and log your own client meetings here — just like a Sales Rep. NSH can see your activity in real time, so keep this updated.", nav:"my-plan"},
      {title:"Team's Plan", desc:"See every rep's planned and logged meetings for today and tomorrow at a glance. Perfect for your morning team stand-up — you can see instantly who is active and who has nothing planned.", nav:"rh-team-plan"},
      {title:"War Room — Your Command View", desc:"The most important screen for you. See which reps are active today, which clients haven't been contacted in 14+ days (at-risk), and who has overdue follow-ups. Red alerts need immediate action from you or the rep.", nav:"warroom"},
      {title:"Revenue Tracker", desc:"Full pipeline for your region — all reps, all deals, all stages. Filter by rep or deal type to get the view you need for a client review or team meeting.", nav:"pipeline"},
      {title:"My Targets", desc:"Your own quarterly revenue target and progress against actuals. This includes the aggregate of all your reps' pipeline.", nav:"targets"},
      {title:"Target Approvals", desc:"When reps in your region submit quarterly targets, they land here for your review. Approve or Reject each one with a note — approved targets flow up to NSH automatically.", nav:"target-approvals"},
      {title:"My Tasks & Assigning Tasks", desc:"Manage your own action items and assign tasks to reps. '+ Assign Task' lets you create a task for any rep in your region with a due date. Overdue tasks surface in the War Room.", nav:"my-tasks"},
      {title:"Escalations", desc:"Deals from your region waiting on NSH approval that have crossed the SLA (2+ days). Follow up with NSH or brief your rep on the delay from this screen.", nav:"rh-escalations"},
      {title:"Leaderboard — My Region", desc:"Individual rep performance: target vs actual, deal count, and meeting frequency. Use this during weekly reviews to spot who needs support and who is outperforming.", nav:"lb-team"},
      {title:"You're all set! 🎉", desc:"Daily rhythm: Morning → War Room + Team's Plan → Assign tasks to lagging reps. Weekly → Target Approvals + Leaderboard review. Tap '?' anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  nsh: {
    welcome:{ title:"Welcome, National Sales Head!", subtitle:"Full national revenue visibility", bullets:["⬡ National War Room — all regions at a glance","✦ Approve target proposals from Region Heads","◈ Full pipeline — filter by region, rep, or deal type","◇ Region Head and Sales Rep scorecards"] },
    steps:[
      {title:"My Plan", desc:"Log your own senior client meetings here. As NSH you meet key accounts and agency heads directly — keep this updated so your team can see your activity too.", nav:"my-plan"},
      {title:"RH's Plan", desc:"See all Region Heads' planned and logged meetings for the day. Useful context before your morning reviews with them.", nav:"nsh-rh-plan"},
      {title:"Rep's Plan", desc:"Drill into any individual Sales Rep's daily meeting activity across all regions. Useful for spotting low activity or follow-up patterns early.", nav:"nsh-regional-plan"},
      {title:"National War Room", desc:"Your morning command view. All regions and all reps — active today, at-risk clients, overdue follow-ups. This screen tells you within seconds where attention is needed.", nav:"warroom"},
      {title:"Revenue Tracker", desc:"Full national pipeline. Filter by region, rep, deal type, stage, or quarter. Deals with RO Received are achieved revenue; all other active stages show what's in play.", nav:"pipeline"},
      {title:"Targets", desc:"Review national targets and progress by quarter. Drill into any region or rep to see where the gaps are.", nav:"targets"},
      {title:"Target Approvals", desc:"Target proposals from Region Heads land here for NSH sign-off. Approve or Reject with a note — rejections are sent back to the RH with your feedback automatically.", nav:"target-approvals"},
      {title:"My Tasks", desc:"Your own task board. '+ Create Task' creates a personal task. '+ Assign Task' sends a task to any RH or rep in the system with a due date and priority.", nav:"my-tasks"},
      {title:"Internal Requests Inbox", desc:"Proposals raised by reps and RHs that need NSH clearance — custom pricing, large package approvals, strategy sign-offs. Respond directly from this inbox.", nav:"internal-requests"},
      {title:"All Region Heads Scorecard", desc:"Performance scorecard for each Region Head — pipeline value, target progress, and team activity. Use this for your weekly RH reviews.", nav:"nsh-rh-scorecard"},
      {title:"All Sales Reps", desc:"Drill to individual rep level across all regions. See deals, meeting frequency, target achievement, and task completion in one table.", nav:"nsh-rep-scorecard"},
      {title:"You're all set! 🎉", desc:"Daily rhythm: Morning → War Room → Internal Requests inbox → Target Approvals. Weekly → All Region Heads scorecard + Revenue Tracker drill-down. Tap '?' anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  strategy: {
    welcome:{ title:"Welcome, Sales Strategy!", subtitle:"National visibility with approval authority", bullets:["⬡ War Room — national activity monitoring","✦ Approve targets and strategic deal proposals","⬆ Internal Requests inbox — strategy clearances","◇ Region Heads and Sales Rep performance data"] },
    steps:[
      {title:"Overview (Planning)", desc:"The Overview tab shows the national planning view — NSH meetings, RH activity, and rep-level plans. Use it to gauge daily sales momentum across the organisation.", nav:"my-plan"},
      {title:"War Room", desc:"National activity view — active reps, at-risk clients, and overdue follow-ups across all regions. Your morning health check.", nav:"warroom"},
      {title:"Revenue Tracker", desc:"Full national pipeline. Filter by region, rep, deal type, or quarter to get any slice you need for analysis or presentations.", nav:"pipeline"},
      {title:"Target Approvals", desc:"Target proposals that require Sales Strategy sign-off land here. Review, approve, or reject each one with a note.", nav:"target-approvals"},
      {title:"Internal Requests Inbox", desc:"Custom deck requests, market data queries, and pricing clearances from reps and RHs land here for your team's action. Respond with status updates and attach outputs.", nav:"internal-requests"},
      {title:"All Region Heads Scorecard", desc:"Scorecard for each RH — pipeline value, targets, and team activity. Useful for preparing strategic reviews and monthly presentations.", nav:"nsh-rh-scorecard"},
      {title:"All Sales Reps", desc:"Individual rep performance across all regions — deals, meetings, targets, and tasks. Drill into any rep for a full picture.", nav:"nsh-rep-scorecard"},
      {title:"You're all set! 🎉", desc:"Focus areas: Internal Requests inbox first thing → Target Approvals → Revenue Tracker for deal pattern analysis. Tap '?' anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  cro: {
    welcome:{ title:"Welcome, CRO!", subtitle:"Board-level revenue intelligence", bullets:["⬡ National War Room — regional health at a glance","◈ Revenue Tracker — full pipeline by region & quarter","✦ Strategic deal approvals — final sign-off authority","◇ Region Heads and Sales Rep scorecards"] },
    steps:[
      {title:"Overview", desc:"The Overview tab shows national planning activity — NSH meetings, RH schedules, and rep-level plans. Use it to gauge daily sales momentum at a glance.", nav:"my-plan"},
      {title:"National War Room", desc:"Your pulse check. At-risk clients, overdue follow-ups, and active rep counts across all regions. Open this every morning for a 30-second national health check.", nav:"warroom"},
      {title:"Revenue Tracker", desc:"Full national pipeline — sort by amount, region, stage, or quarter. Active deals show weighted pipeline value; RO Received = achieved revenue. Use filters to drill into any region or quarter.", nav:"pipeline"},
      {title:"Targets", desc:"National revenue targets and quarterly progress. Drill into any region or quarter to see where actuals are tracking against plan.", nav:"targets"},
      {title:"Target Approvals", desc:"Final-level approval queue for CRO sign-off. Review and approve or reject strategic targets submitted by NSH or Region Heads.", nav:"target-approvals"},
      {title:"All Region Heads", desc:"Scorecard view for each Region Head — pipeline value, target achievement, and team engagement. Your weekly performance review input.", nav:"nsh-rh-scorecard"},
      {title:"All Sales Reps", desc:"Individual rep analytics — deals pipeline, meeting count, target achievement, and task completion. Useful for performance conversations with NSH.", nav:"nsh-rep-scorecard"},
      {title:"You're all set! 🎉", desc:"Your rhythm: Morning → War Room (30 seconds). Weekly → Revenue Tracker + All Region Heads. Monthly → Targets review. Tap '?' anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  admin: {
    welcome:{ title:"Welcome, Admin!", subtitle:"System access and configuration", bullets:["◎ Access Management — approve sign-ups & assign roles","✦ Approval Queue — review pending system requests","⬆ Data Management — add/edit reps, clients & bulk import","⚙ System Config — manage system-wide settings"] },
    steps:[
      {title:"Access Management", desc:"New user sign-up requests land here. Review each one, approve or reject, and assign the correct role (Sales Rep, Region Head, NSH, etc.) and region before they can log in.", nav:"admin-access"},
      {title:"Approval Queue", desc:"Internal requests that need admin-level review — escalations, role override requests, or items that fall outside normal department routing.", nav:"admin-approvals"},
      {title:"Data Management", desc:"Add or edit sales reps, manage the client master list, and bulk-upload deals or meetings from CSV. Changes to reps and clients apply instantly for all users.", nav:"import"},
      {title:"You're all set! 🎉", desc:"Your focus: keep Access Management clear (no pending sign-ups unreviewed) and Approval Queue actioned promptly. Tap '?' anytime to replay this tour.", nav:"admin-access"},
    ]
  },
};
export function CROApp({ user, onLogout }) {
  // Home screen (platform landing) vs CRM shell
  const [showHome, setShowHome] = useState(false);

  // T009: Correct CRM landing per role
  const getCRMDefaultView = () => {
    const role = user?.role || "";
    if (role === "ADMIN" || user?.email==="admin@odishatv.com") return "admin-access";
    if (role === "REGION HEAD") return "rh-dashboard";
    if (["SALES HEAD","CRO","SALES STRATEGY"].includes(role)) return "warroom";
    if (role === "DIGI OPS") return "digi-deals";
    return "rep-dashboard"; // Sales Rep — lands on Dashboard
  };
  const [view, setView] = useState(getCRMDefaultView);
  // T009: Reset landing view whenever the logged-in user switches roles
  useEffect(() => { setView(getCRMDefaultView()); }, [user?.email]);

  // Home screen handled inline in render (hooks must be unconditional)

  // ── DATA STATE — CROApp now owns all entity state (no prop drilling) ──────

  // Deals: API-backed state owned directly by CROApp
  const [deals, setDeals] = useApiEntityState<Deal>("/api/deals", "otv_deals", []);

  // Meetings: DB-backed via useMeetings hook (sole source of truth)
  const { meetings, isLoading: meetingsLoading, setMeetings } = useMeetings();

  // WeeklyPlans: local persisted state owned by CROApp
  const [weeklyPlans, setWeeklyPlans] = usePersistedState("otv_wplans", []);

  // att: local persisted state for attendance display
  const [att, setAtt] = usePersistedState("otv_att", {});

  // ── Demo bootstrap: seed sample meetings for first-time demo users ───────────
  // Runs once after useMeetings has loaded and the user is a demo provider with 0 meetings.
  useEffect(() => {
    if (meetingsLoading) return;
    const u = user as any;
    if (u?.provider !== "demo" || meetings.length > 0 || !u?.id) return;
    const addDays = (n: number) => {
      const d = new Date(); d.setDate(d.getDate() + n);
      return d.toISOString().split("T")[0];
    };
    const base = { userId: u.id, repId: u.repId ?? null, region: u.region || "North", mode: "Physical", status: "planned", meetingKind: "ACTIONABLE" };
    const seeds = [
      { ...base, id: `demo_${u.id}_1`, clientName: "Star Cement Ltd",    contactName: "Rahul Sharma",    agenda: "Q3 sponsorship package pitch",     date: addDays(0), time: "10:00" },
      { ...base, id: `demo_${u.id}_2`, clientName: "Patanjali Foods",    contactName: "Anita Panigrahi", agenda: "Prime time slot renewal",           date: addDays(1), time: "11:30", mode: "Virtual" },
      { ...base, id: `demo_${u.id}_3`, clientName: "OdishaMart Digital", contactName: "Priya Das",       agenda: "Digital + OTT package proposal",    date: addDays(2), time: "14:00" },
      { ...base, id: `demo_${u.id}_4`, clientName: "Utkal Alumina",      contactName: "Biju Nayak",      agenda: "Brand activation follow-up",        date: addDays(4), time: "10:30" },
      { ...base, id: `demo_${u.id}_5`, clientName: "Heritage Foods",     contactName: "Sandeep Mishra",  agenda: "News ticker campaign pitch",        date: addDays(5), time: "15:00" },
    ];
    const flagKey = `bootstrapped_demo_${u.id}`;
    (async () => {
      const flagData = await apiFetch(`/api/state/${flagKey}`).catch(() => null);
      if ((flagData as any)?.value) return;
      const settled = await Promise.allSettled(seeds.map(m => meetingsSvc.createMeeting(m).catch(() => null)));
      const seeded = settled.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && !!(r as PromiseFulfilledResult<any>).value).map(r => r.value);
      if (seeded.length) setMeetings(seeded as any);
      apiFetch(`/api/state/${flagKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: true }),
      }).catch(() => {});
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsLoading]);

  // Countdown to 11:30 PM — shown in topbar for all users
  const [countdown, setCountdown] = useState("");
  // 11 PM fullscreen block — dismissed when rep taps "Log remaining" or "Nothing more today"
  const [eodBlockDismissed, setEodBlockDismissed] = useState(false);
  const [nothingMoreToday,  setNothingMoreToday]  = useState(false);
  useEffect(() => {
    const tick = () => {
      const now = new Date(), dl = new Date();
      dl.setHours(23, 30, 0, 0);
      const diff = +dl - +now;
      if (diff <= 0) { setCountdown("11:30 PM passed"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m left`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  const [absenceReports, setAbsenceReports] = usePersistedState<AbsenceReport[]>("otv_absence", []);
  const [exceptionModal, setExceptionModal] = useState<any>(null); // { reportId, repName }
  const [exceptionReason, setExceptionReason] = useState("");
  const {
    records: attDbRecords,
    exceptions: attExcRequests,
    isLoading: attDbLoading,
    refresh: fetchAttendanceData,
  } = useAttendance();
  const [excReqOpen, setExcReqOpen]             = useState(false);
  const [excReqRecord, setExcReqRecord]         = useState<any>(null);
  const [excReqForm, setExcReqForm]             = useState({reason:"", notes:""});
  const [excReqSubmitting, setExcReqSubmitting] = useState(false);

  useEffect(() => {
    if (view === "hr") fetchAttendanceData();
  }, [view, fetchAttendanceData]);

  // Derive activeUser from login email — prevents role spoofing via DevTools
  const derivedUserId = useMemo(() => {
    if (!user?.email) return "admin";
    const email = user.email.toLowerCase();
    // Direct email match against USER_ROLES name patterns
    const emailToId = {
      "darpan@odishatv.com":     "sales_analysis",
      "saleshead@odishatv.com":  "sales_head",
      "nsh@odishatv.com":        "sales_head",
      "sachin@odishatv.com":     "sales_strategy",
      "admin@odishatv.com":      "admin",
      "digiops@odishatv.com":    "digi_ops",
      "digital@odishatv.com":    "digi_ops",
      "rh.national@odishatv.com": "rh_national",
      "rh.north@odishatv.com":   "rh_north",
      "rh.south@odishatv.com":   "rh_south",
      "rh.east@odishatv.com":    "rh_east",
      "rh.west@odishatv.com":    "rh_west",
      "rh.central@odishatv.com": "rh_central",
      "arjun@odishatv.com":      "rep_arjun",
      "priya@odishatv.com":      "rep_priya",
      "rohit@odishatv.com":      "rep_rohit",
      "sneha@odishatv.com":      "rep_sneha",
      "vikram@odishatv.com":     "rep_vikram",
      "meera@odishatv.com":      "rep_meera",
    };
    return emailToId[email] || "admin";
  }, [user?.email]);
  const [activeUser, setActiveUser] = useState(() => derivedUserId);
  const [filterRegion, setFilterRegion] = useState("All");
  const [filterQ, setFilterQ]     = useState("Q1 FY26");
  const [expanded, setExpanded]   = useState(null);
  const [toast, setToast]         = useState<any>(null);
  const [noteModal, setNoteModal] = useState<any>(null);   // {title, placeholder, onSubmit}
  const [noteModalVal, setNoteModalVal] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const { tasks, setTasks, isLoading: tasksLoading, syncError: tasksError } = useTasks(!!user);
  const [taskModal, setTaskModal]       = useState(false);
  const [selfTaskMode, setSelfTaskMode] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const importRef = useRef<HTMLInputElement>(null);
  // My Plan calendar state — must be at component level (React hooks rule)
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calDayView, setCalDayView]       = useState<string|null>(null); // date string "YYYY-MM-DD"
  const [myPlanTab,  setMyPlanTab]        = useState<"plan"|"log">("plan"); // My Plan sub-tabs
  const [addPlanFor, setAddPlanFor]       = useState(null);
  const [planForm, setPlanForm]           = useState({agency:"",client:"",brand:"",contactName:"",phone:"",time:"10:00",agenda:"",pitchType:"",meetingType:"Physical",touchpointType:"Deal Meeting",meetingKind:"ACTIONABLE",needsMeet:false,syncToCalendar:false,calPlatform:"google"});
  const [planEditId, setPlanEditId]       = useState<string|null>(null);
  const [planEditForm, setPlanEditForm]   = useState({time:"",clientAgencyName:"",contactName:"",phone:"",agenda:"",pitchType:""});
  const [loginProvider, setLoginProvider] = useState<"google"|"demo">("demo");
  const planInlineState                   = useState(null); // [inlineLogPlan, setInlineLogPlan]
  const planInlineStatusState             = useState<string>(""); // [inlineLogStatus, setInlineLogStatus]
  const [planLoggedMsg, setPlanLoggedMsg] = useState<Record<string,string>>({}); // Part 8: post-log messages
  const [weekSummaryDismissed, setWeekSummaryDismissed] = useState<string|null>(null); // "YYYY-MM-DD" of Monday dismissed
  const [rhRepDrill, setRhRepDrill]       = useState(null); // Region Head targets drilldown
  const [nshRHDrill,  setNshRHDrill]      = useState(null); // NSH drills into specific RH region
  const [rhDrillPlan, setRhDrillPlan]     = useState<any>(null); // RH team meetings drill-down item
  const [rhTeamFilter, setRhTeamFilter]   = useState({rep:"",dateRange:"today-tomorrow",client:"",status:""}); // RH team meetings filter
  const [rhWarroomClient, setRhWarroomClient] = useState(""); // pre-filter warroom to a stalled client from dashboard
  const [rhWarroomRep,    setRhWarroomRep]    = useState(""); // pre-filter warroom to a stalled rep from dashboard
  const [rhTeamReportRep, setRhTeamReportRep] = useState(""); // pre-filter team report to a specific rep from dashboard overdue chip
  const [nshRegion,   setNshRegion]       = useState("all"); // NSH rep-CRM region filter
  const BLANK_TASK_FORM = {title:"",assignedTo:"",assignedToUserId:"",clientCompany:"",description:"",priority:"High",dueDate:TOMORROW};
  const [taskForm, setTaskForm]           = useState(BLANK_TASK_FORM);
  useEffect(() => {
    if (!profileOpen) return;
    const close = (e) => { setProfileOpen(false); };
    const tid = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(tid); document.removeEventListener("click", close); };
  }, [profileOpen]);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [logOpen, setLogOpen]     = useState(false);
  const [viewMeetingId, setViewMeetingId] = useState<string|null>(null);
  const [meetingEditMode, setMeetingEditMode] = useState(false);
  const [meetingEditForm, setMeetingEditForm] = useState<any>({});
  const [targetDrilldown, setTargetDrilldown] = useState(null); // { key, label, color, icon } — NSH region tile
  const [nshRepDrill,    setNshRepDrill]      = useState(null); // rep id — NSH → region → rep drill
  // ── VIRTUAL TOUR STATE ──
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [tourActive,  setTourActive]  = useState(false);
  const [tourStep,    setTourStep]    = useState(0);
  const [tourKey,     setTourKey]     = useState("rep");
  // Welcome modal is manual-only — opened via the ? button in the top bar
  // Tour card dynamic positioning: track target element's bounding rect
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect|null>(null);
  // Auto-navigate when tour step changes + compute target highlight rect
  useEffect(() => {
    if (!tourActive) return;
    const step = (TOUR_DATA[tourKey]?.steps || [])[tourStep];
    if (step?.nav) setView(step.nav);
    // Slight delay so the view re-renders before we measure
    const tid = setTimeout(() => {
      if (!step?.target) { setTourTargetRect(null); return; }
      const el = document.querySelector(`[data-tour="${(step as any).target}"]`) as HTMLElement|null;
      if (el) {
        el.scrollIntoView({ behavior:"smooth", block:"nearest" });
        setTourTargetRect(el.getBoundingClientRect());
      } else {
        setTourTargetRect(null);
      }
    }, 120);
    return () => clearTimeout(tid);
  }, [tourStep, tourActive, tourKey]);
  const [rtTab, setRtTab] = useState("accounts"); // Revenue Tracker tab

  // Part 1+3: `stage` is the canonical field; `outcome` kept for legacy compat
  const BLANK_DEAL = { clientCompany:"", repId:"", clientAccountId:"", contactName:"", designation:"", contactLevel:"", phone:"", email:"", dealType:"", outcome:"Prospect", stage:"Prospect", amount:"", pipelineAmount:"", targetAmount:"", lossReason:"", priority:"Regular", quarter:"Q1 FY26", notes:"", nextStep:"", nextStepDate:"", agencyName:"", reqs:[], auditLog:[] };
  const BLANK_NEXT_STEP_ITEM = {action:"", actionType:"", details:"", neededFrom:"", remarks:"", dueDate:""};
  const ACTION_TYPES = ["Approval needed","Document needed","Attend a meeting","Introduction needed","Flag for follow-up"];
  const BLANK_ACTION_REQUIRED = {what:"", from:"", description:"", byWhen:""};
  const BLANK_LOG = {
    repId:"",
    planId:"",
    meetingDbId:"",
    meetingTime:"", clientOrAgency:"Client",
    dealId:"", clientAgencyName:"",
    agency:"", client:"", brand:"",
    dealAmount:"",
    contactName:"", designation:"", mobile:"",
    meetingType:"Physical",
    meetingKind:"ACTIONABLE",         // "PR" | "ACTIONABLE"
    // Part 1: new Touchpoint fields
    touchpointType:"Deal Meeting",    // "Deal Meeting" | "Relationship"
    contactLevel:"",                  // C-Suite / VP-GM / etc.
    discussion:"", clientFeedback:"", // `discussion` = whatHappened (kept for legacy)
    stageUpdate:"",                   // required for Deal Meeting — moved to end of form
    lossReason:"",
    pitchType:"", nextSteps:"", followUpDate:"", status:"",
    // Unified Action Required (replaces nextStepItems + supportRequest)
    actionRequired:[{...BLANK_ACTION_REQUIRED}],
    seniorRequested:"No", seniorRequestedName:"", seniorRequestedRole:"",
    scheduleNext:false,
    nextMeetingDate:"", nextMeetingTime:"", nextAgenda:"",
    calendarPlatform:"google", addMeetLink:true,
    attendeeEmails:"",
    calendarEventId:"", meetLink:"", calendarStatus:"",
    // Legacy compat — kept for existing meetings in state
    nextStepItems:[] as any[],
    supportRequest:{dept:"", description:"", priority:"Medium", dueDate:""},
  };
  const [dealForm, setDealForm]   = useState(BLANK_DEAL);
  const [logForm, setLogForm]     = useState(BLANK_LOG);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [adminConfig, setAdminConfig]         = usePersistedState("otv_adminConfig", {
    approvalThresholds: { RH: 5000000, NSH: 10000000, CXO: 30000000 },
    slaHours:           { "Region Head": 48, NSH: 48, "Sales Strategy": 48, CXO: 72, default: 48 },
    inactivityDaysRisk: 7,
    inactivityDaysEscalate: 14,
    webhookUrl: "",
    platformLive: true,   // Part 7: Pre-launch / Live state (true = Live)
    launchDate: "",       // Part 7: Shown to reps during pre-launch
  });
  const [clientMasterList, setClientMasterList] = usePersistedState<string[]>("otv_clientMaster", []);
  const [masterNewName, setMasterNewName]         = useState("");

  // ── DEAL INACTIVITY ENFORCEMENT — runs on load and when adminConfig changes ──
  useEffect(() => {
    const escalateDays = adminConfig?.inactivityDaysEscalate || 14;
    const riskDays     = adminConfig?.inactivityDaysRisk     || 7;
    setDeals(prev => prev.map(d => {
      const ds = dealStage(d);
      // Closed deals never escalate
      if (ds === "RO Received" || ds === "Mail Confirmed" || ds === "Lost") return d;
      // Part 4: Escalation clock is only reset by Deal Meeting touchpoints
      // Use lastDealMeetingDate if available, else fall back to lastContact
      const idleClock = d.lastDealMeetingDate || d.lastContact;
      const idle = daysSince(idleClock);
      // 7+ days without a Deal Meeting → mark at risk
      if (idle >= riskDays && idle < escalateDays && !d.atRisk) {
        return { ...d, atRisk: true };
      }
      // escalateDays+ idle → auto-escalate to NSH if not already flagged
      if (idle >= escalateDays && !d.awaitingApproval) {
        return {
          ...d, atRisk: true,
          awaitingApproval:      "NSH",
          awaitingApprovalSince: TODAY,
          auditLog: [...(d.auditLog || []), {
            at: TODAY, by: "System", role: "AUTO",
            action: "Auto-escalated", from: null, to: "NSH",
            note: `No Deal Meeting for ${idle} days — auto-escalated (threshold: ${escalateDays}d)`,
          }],
        };
      }
      // Clear atRisk if a Deal Meeting was logged recently
      if (idle < riskDays && d.atRisk) {
        return { ...d, atRisk: false };
      }
      return d;
    }));
  }, [adminConfig?.inactivityDaysEscalate, adminConfig?.inactivityDaysRisk]);

  // RO PARSER STATE
  const [roFiles, setRoFiles]         = useState<any[]>([]);
  const [roInputText, setRoInputText] = useState("");
  const [roLoading, setRoLoading]     = useState(false);
  const [roResults, setRoResults]     = useState<any[]>([]);
  const [roActiveDoc, setRoActiveDoc] = useState(0);
  const [roError, setRoError]         = useState<string|null>(null);
  const [roProgress, setRoProgress]   = useState("");
  const [roSearch, setRoSearch]       = useState("");
  const [savedROs, setSavedROs]       = usePersistedState<SavedRO[]>("otv_savedROs", []);
  const roFileRef = useRef<HTMLInputElement>(null);

  // RO MANAGEMENT STATE
  const [roMgmtChannel, setRoMgmtChannel]           = useState("all");
  const [roMgmtStatus, setRoMgmtStatus]             = useState("all");
  const [roMgmtViewRO, setRoMgmtViewRO]             = useState(null);
  const [roMgmtConfirmDelete, setRoMgmtConfirmDelete] = useState(null);
  const [properties, setProperties]                   = usePersistedState("otv_properties", []);
  const [ipProposals, setIpProposals]                  = usePersistedState("otv_ipProposals", []);
  const [ipPropOpen, setIpPropOpen]                    = useState<string|null>(null); // "ipId-elemId"
  const [ipPropClient, setIpPropClient]                = useState("");
  const [ipPropNote, setIpPropNote]                    = useState("");
  const [ipPropValue, setIpPropValue]                  = useState("");
  const [ipApprovalPrices, setIpApprovalPrices]        = useState<Record<string,string>>({});
  const [internalReqs, setInternalReqs, , irError]            = useApiEntityState<InternalReq>("/api/internal-requests", "otv_internalReqs", []);
  const [irStatusFilter, setIrStatusFilter]                   = useState("all");
  const [lbTab, setLbTab]                                     = useState("team");
  const [targetSubs, setTargetSubs, targetLoading, targetError] = useApiEntityState<TargetSub>("/api/targets",        "otv_targetSubs",      []);
  const [revenueEntries, setRevenueEntries, revLoading, revError] = useApiEntityState<RevenueEntry>("/api/revenue",      "otv_revenueEntries",  []);
  // ── Part 1: New data model objects ──────────────────────────────────────
  const [clientAccounts, setClientAccounts, , caError] = useApiEntityState<ClientAccount>("/api/client-accounts", "otv_clientAccounts", []);
  const { touchpoints, setTouchpoints, syncError: tpError } = useTouchpoints(!!user);

  // Part 1: One-time migration — runs when clientAccounts is empty but deals/meetings exist
  useEffect(() => {
    if (clientAccounts.length > 0) return; // already migrated
    if (deals.length === 0 && meetings.length === 0) return; // nothing to migrate
    const accountMap: Record<string, any> = {}; // key: `${clientCompany}|${repId}`
    deals.forEach(d => {
      const key = `${d.clientCompany}|${d.repId}`;
      if (!accountMap[key]) {
        const rep = USER_ROLES.find(r => String(r.repId)===String(d.repId));
        accountMap[key] = {
          id: uid(), clientName: d.clientCompany, repId: d.repId,
          region: rep?.region || d.region || "",
          fiscalYear: d.quarter?.slice(-3) === "FY26" ? "FY26" : "FY26",
          annualTarget: parseCurrency(d.targetAmount || "0") || 0,
          currentStage: mapLegacyOutcome(d.outcome || "Prospect"),
          lastContactDate: d.lastContact || "",
          lastDealMeetingDate: d.lastContact || "",
          createdAt: d.createdAt || TODAY, updatedAt: TODAY,
        };
      }
      // link deal back to its account
      if (!d.clientAccountId) {
        setDeals(prev => prev.map(x => x.id === d.id ? {...x, clientAccountId: accountMap[key].id, stage: mapLegacyOutcome(x.outcome||"Prospect"), pipelineAmount: parseCurrency(x.amount||"0")||0} : x));
      }
    });
    const newAccounts = Object.values(accountMap);
    if (newAccounts.length > 0) setClientAccounts(newAccounts);
    // Migrate meetings → touchpoints
    const newTouchpoints = meetings.map(m => {
      const deal = deals.find(d => d.id === m.dealId || d.clientCompany === m.clientAgencyName);
      const acctKey = deal ? `${deal.clientCompany}|${deal.repId}` : null;
      const acct = acctKey ? accountMap[acctKey] : null;
      return {
        id: m.id, clientAccountId: acct?.id || "", dealId: m.dealId || deal?.id || "",
        repId: m.repId, date: m.date, time: m.meetingTime || "",
        meetingType: m.meetingType || "Physical Meeting",
        touchpointType: "Deal Meeting", contactName: m.contactName || "",
        contactDesignation: m.designation || "", contactLevel: m.contactLevel || "",
        whatHappened: m.discussion || "", clientFeedback: m.clientFeedback || "",
        stageUpdate: mapLegacyOutcome(String(m.outcome || "Prospect")),
        actionItems: m.actionItems || [],
        loggedAt: m.loggedAt || m.date, loggedLate: m.loggedLate || false,
        loggedByUserId: m.loggedByUserId || String(m.repId),
      };
    }).filter(t => t.clientAccountId);
    // @ts-ignore
    if (newTouchpoints.length > 0) setTouchpoints(newTouchpoints as unknown as Touchpoint[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Normalise adminConfig.slaHours: rename legacy short keys (RH→Region Head, etc.) ──
  useEffect(() => {
    const CANONICAL: Record<string,string> = { RH:"Region Head", NSH:"NSH", CXO:"CXO", "Sales Strategy":"Sales Strategy" };
    const DEFAULTS:  Record<string,number> = { "Region Head":48, NSH:48, "Sales Strategy":48, CXO:72, default:48 };
    const sla = (adminConfig?.slaHours || {}) as Record<string,number>;
    let changed = false;
    const next: Record<string,number> = {};
    for (const [k,v] of Object.entries(sla)) {
      const canonical = CANONICAL[k] ?? k;
      next[canonical] = v;
      if (canonical !== k) changed = true;
    }
    for (const [k,def] of Object.entries(DEFAULTS)) {
      if (next[k] === undefined || next[k] === 0) { next[k] = def; changed = true; }
    }
    if (changed) setAdminConfig((p:any) => ({...p, slaHours: next}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── One-time cleanup: remove any auto-stub revenue entries created by the old
  //    broken logic that added deal.amount to revenueEntries on Mail Confirmed.
  //    Safe to run repeatedly — only fires when stubs exist.
  const stubsCleanedRef = useRef(false);
  useEffect(() => {
    if (stubsCleanedRef.current) return;
    const hasStubs = revenueEntries.some(
      e => e.invoiceRef === "PO Pending" && String(e.notes||"").startsWith("Auto-stub:")
    );
    if (!hasStubs) return;
    stubsCleanedRef.current = true;
    setRevenueEntries(p => p.filter(
      e => !(e.invoiceRef === "PO Pending" && String(e.notes||"").startsWith("Auto-stub:"))
    ));
  }, [revenueEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Part 5: 4-number dashboard helpers ──────────────────────────────────
  const CURRENT_FY = "FY26";
  const getAchieved   = (repId?: string | null, fy = CURRENT_FY) =>
    revenueEntries.filter(e => (repId == null || String(e.repId)===String(repId)) && (e.fiscalYear === fy || fy === "all")).reduce((s, e) => s + (parseCurrency(e.amount||"0")||0), 0);
  // COMMITTED = clientAccounts at Mail Confirmed stage (per spec: read annualTarget from clientAccounts, never from deals.amount)
  const getCommitted  = (repId?: string | null) =>
    clientAccounts.filter(a => (repId == null || String(a.repId)===String(repId)) && a.currentStage === "Mail Confirmed").reduce((s, a) => s + (a.annualTarget||0), 0);
  // IN PLAY = clientAccounts at In Discussion or Negotiation stage
  const getInPlay     = (repId?: string | null) =>
    clientAccounts.filter(a => (repId == null || String(a.repId)===String(repId)) && ["In Discussion","Negotiation"].includes(a.currentStage||"")).reduce((s, a) => s + (a.annualTarget||0), 0);
  const getShortfall  = (target: number, repId?: string | null) => Math.max(0, target - getAchieved(repId));

  // Part 5: Stacked bar — proportions of annual target: Achieved (green) / Committed (blue) / In Play (amber) / Shortfall (red)
  // When shortfall reaches zero the entire bar turns solid green.
  const stackedBar = (target: number, ach: number, comm: number, inpl: number, sf: number, mt=12) => {
    if (target <= 0) return null;
    if (sf <= 0) return <div style={{marginTop:mt,height:8,background:C.green,borderRadius:4}} />;
    const aW = Math.min((ach  / target) * 100, 100);
    const cW = Math.min((comm / target) * 100, Math.max(0, 100 - aW));
    const iW = Math.min((inpl / target) * 100, Math.max(0, 100 - aW - cW));
    const sW = Math.max(0, 100 - aW - cW - iW);
    return (
      <div style={{marginTop:mt,display:"flex",height:8,borderRadius:4,overflow:"hidden",background:C.s3}}>
        {aW>0 && <div style={{width:`${aW}%`,background:C.green,flexShrink:0}} />}
        {cW>0 && <div style={{width:`${cW}%`,background:C.blue,flexShrink:0}} />}
        {iW>0 && <div style={{width:`${iW}%`,background:"#d97706",flexShrink:0}} />}
        {sW>0 && <div style={{width:`${sW}%`,background:`${C.red}66`,flexShrink:0}} />}
      </div>
    );
  };

  // Part 9: Return total approved annual target for a rep (sum of all approved targetSubs for CURRENT_FY)
  const getAnnualTarget = (repId?: string | null) => {
    const subs = targetSubs.filter(s => (repId == null || String(s.repId)===String(repId)) && s.status === "Approved");
    return { amount: subs.reduce((s, sub) => s + (sub.totalTarget || 0), 0) };
  };

  const [targetSubTab, setTargetSubTab]                 = useState("mine");
  const [revTab, setRevTab]                             = useState("log");
  const BLANK_IR_FORM = {type:"Send Proposal",dept:"NSH",subject:"",details:"",clientCompany:""};
  const [irFormOpen, setIrFormOpen]                     = useState(false);
  const [irForm, setIrForm]                             = useState(BLANK_IR_FORM);
  const [editIrId, setEditIrId]                         = useState<string|null>(null);
  // Admin user management — sourced entirely from API (no localStorage)
  const [pendingUsers, setPendingUsers]                 = useState<any[]>([]);
  const [liveRoles, setLiveRoles]                       = useState<any[]>([]);
  const [adminUsersLoading, setAdminUsersLoading]       = useState(false);
  const [adminUsersError, setAdminUsersError]           = useState<string|null>(null);
  const refreshAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    try {
      const apiUsers = await adminSvc.listAdminUsers();
      if (!Array.isArray(apiUsers)) return;
      setPendingUsers(apiUsers.filter(u => u.status === "pending").map(u => ({
        id: `api_${u.id}`, _apiId: u.id, name: u.name, email: u.email,
        requestedAt: u.requestedAt ?? u.createdAt, intendedRole: u.role,
      })));
      setLiveRoles(apiUsers.filter(u => u.status === "active").map(u => ({
        id: `api_${u.id}`, _apiId: u.id, name: u.name, email: u.email,
        role: u.role, region: u.region ?? "",
        canView: u.role === "SALES REP" ? "self" : u.role === "REGION HEAD" ? "region" : "all",
      })));
      setAdminUsersError(null);
    } catch { setAdminUsersError("Network error — could not load users"); }
    finally { setAdminUsersLoading(false); }
  }, []);
  useEffect(() => {
    refreshAdminUsers();
    const t = setInterval(refreshAdminUsers, 30_000);
    return () => clearInterval(t);
  }, [refreshAdminUsers]);
  const [reps, setReps]                                 = usePersistedState("otv_reps", REPS);
  const [masterClients, setMasterClients]               = usePersistedState("otv_masterClients", []);
  const [newClients, setNewClients]                     = useState([{clientCompany:"",dealType:"Linear TV",targetAmount:""}]);
  const [addClientModalOpen, setAddClientModalOpen]     = useState(false);
  const [addClientForm, setAddClientForm]               = useState({clientCompany:"",dealType:"Linear TV",targetAmount:""});
  // S9: Setup Wizard state
  const [wizardStep, setWizardStep]                     = useState(0);
  const [wizardClients, setWizardClients]               = useState<{agency:string,client:string,brand:string,q1:string,q2:string,q3:string,q4:string}[]>([{agency:"",client:"",brand:"",q1:"",q2:"",q3:"",q4:""}]);
  const [wizardRegion, setWizardRegion]                 = useState("");
  const [wizardRM, setWizardRM]                         = useState("");
  // Track whether the wizard was pre-filled from myRep — prevents re-filling after user clears RM
  const wizardPrefilled = useRef(false);
  // Part 6: Client Account Thread modal
  const [accountThreadOpen, setAccountThreadOpen]       = useState(false);
  const [accountThreadClient, setAccountThreadClient]   = useState<string|null>(null);
  const [threadAIForm, setThreadAIForm]                 = useState<{entryId:string,actionType:string,details:string,neededFrom:string,dueDate:string}|null>(null);
  const [planUploadOpen, setPlanUploadOpen]             = useState(false);
  const [planUploadForm, setPlanUploadForm]             = useState<{repId:string,year:string,annualClients:{agencyName:string,clientName:string,brandName:string,q1Target:string,q2Target:string,q3Target:string,q4Target:string}[]}>({repId:"",year:String(new Date().getFullYear()),annualClients:[{agencyName:"",clientName:"",brandName:"",q1Target:"",q2Target:"",q3Target:"",q4Target:""}]});
  const [editSubId, setEditSubId]                       = useState(null);
  const [editSubClients, setEditSubClients]             = useState<any[]>([]);
  const [revForm, setRevForm]                           = useState({clientCompany:"",agencyName:"",brand:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:"",notes:""});
  const [editingRevId, setEditingRevId]                 = useState<string|null>(null);
  const [editRevData, setEditRevData]                   = useState<any>({});
  const [importTab, setImportTab]                       = useState("targets");
  const [dmTab, setDmTab]                               = useState<"reps"|"clients"|"bulk">("reps");
  const [repEditId, setRepEditId]                       = useState<number|null>(null);
  const [repEditForm, setRepEditForm]                   = useState<any>({});
  const [repAddMode, setRepAddMode]                     = useState(false);
  const [repAddForm, setRepAddForm]                     = useState({name:"",region:"North",role:"Sales Executive",target:10000000,active:true});
  const [clientEditId, setClientEditId]                 = useState<string|null>(null);
  const [clientEditForm, setClientEditForm]             = useState<any>({});
  const [clientAddMode, setClientAddMode]               = useState(false);
  const [clientAddForm, setClientAddForm]               = useState({company:"",industry:"",contact:"",phone:"",email:"",region:"National"});

  // Global search
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const searchRef                       = useRef<HTMLDivElement>(null);

  // Mobile responsive
  const [windowW, setWindowW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = windowW < 768;

  // Hoisted parseCurrency — usable everywhere in CROApp
  const parseCurrency = v => {
    if (!v) return 0;
    const s = String(v).replace(/[,₹]/g, "").trim();
    if (/^[0-9]+(\.[0-9]+)?[Cc][Rr]$/.test(s)) return Math.round(parseFloat(s) * 10000000);
    if (/^[0-9]+(\.[0-9]+)?[Ll]$/.test(s))   return Math.round(parseFloat(s) * 100000);
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n);
  };

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const openNoteModal = (title, placeholder, onSubmit) => {
    setNoteModalVal(placeholder || "");
    setNoteModal({ title, placeholder: placeholder || "", onSubmit });
  };

  // RO PARSER HANDLERS
  const roParseAll = async () => {
    if(!roFiles.length&&!roInputText.trim())return;
    setRoLoading(true);setRoError(null);setRoResults([]);
    try{
      const parsed: any[]=[];
      if(roFiles.length>0){
        for(let i=0;i<roFiles.length;i++){
          setRoProgress(`Parsing ${i+1}/${roFiles.length}: ${roFiles[i].name}...`);
          const msgs=await roBuildMessages(roFiles[i]);
          const text=await roCallAPI(msgs);
          const raw=roExtractJSON(text);
          const deals=Array.isArray(raw)?raw:[raw];
          deals.forEach((result,di)=>{roNormalizeDoc(result);result._filename=roFiles[i].name+(deals.length>1?` [${di+1}]`:"");parsed.push(result);});
        }
      }else{
        setRoProgress("Parsing...");
        const text=await roCallAPI([{role:"user",content:"Parse this TV RO. If multiple channels return JSON array:\n\n"+roInputText}]);
        const raw=roExtractJSON(text);
        const deals=Array.isArray(raw)?raw:[raw];
        deals.forEach((result,di)=>{roNormalizeDoc(result);result._filename="Pasted Text"+(deals.length>1?` [${di+1}]`:"");parsed.push(result);});
      }
      setRoResults(parsed);setRoActiveDoc(0);
    }catch(err: any) {setRoError(roFriendlyError(err));}
    finally{setRoLoading(false);setRoProgress("");}
  };

  const roExportSingle = async (r) => {
    if(!r)return;
    const XLSX=await loadXLSX();
    const exp=roBuildExport(r);
    const wb=XLSX.utils.book_new();
    roMakeSheet(wb,"Deal",exp.dealRow);
    if(exp.breakupRows.length)roMakeSheet(wb,"Deal Breakup",exp.breakupRows);
    roMakeSheet(wb,"Summary",exp.summaryRow);
    XLSX.writeFile(wb,(r.client_name||"ro").replace(/[^a-zA-Z0-9]/g,"_")+"_Export.xlsx");
    // Auto-save to management
    const saved={id:`ro_${Date.now()}`,savedAt:new Date().toISOString(),client_name:r.client_name||"",brand_name:r.brand_name||"",agency_name:r.agency_name||"",channel:roNormalizeChannel(r.channel||""),ro_number:r.ro_number||"",ro_date:r.ro_date||"",gross_amount:r.gross_amount||0,total_payable:r.total_payable||0,filename:r._filename||"",data:r,status:"Exported"};
    setSavedROs(p=>[saved,...p.filter(x=>x.ro_number!==saved.ro_number||!saved.ro_number)]);
    showToast("Exported + saved to RO Management");
  };

  const roSaveResult = (r) => {
    const saved={id:`ro_${Date.now()}`,savedAt:new Date().toISOString(),client_name:r.client_name||"",brand_name:r.brand_name||"",agency_name:r.agency_name||"",channel:roNormalizeChannel(r.channel||""),ro_number:r.ro_number||"",ro_date:r.ro_date||"",gross_amount:r.gross_amount||0,total_payable:r.total_payable||0,filename:r._filename||"",data:r,status:"Parsed"};
    setSavedROs(p=>[saved,...p.filter(x=>x.ro_number!==saved.ro_number||!saved.ro_number)]);
    showToast("Saved to RO Management");
  };

  // RO → Pipeline bridge
  const roPushToPipeline = (roResult) => {
    if (!roResult) return;
    // Map RO fields to deal form
    const dealType = (() => {
      const t = roResult.document_type || "";
      const comps = roResult.components || [];
      const hasFCT    = comps.some(c => c.is_fct);
      const hasNonFCT = comps.some(c => !c.is_fct);
      const hasSpon   = JSON.stringify(roResult).match(/pwd by|co pwd by|powered by|sponsored/i);
      if (hasSpon) return "IPs";
      if (hasFCT && hasNonFCT) return "Integrated Packages";
      return "Linear TV";
    })();

    const rep  = reps.find(r => r.region === "National") || reps[0];
    const prefilled = {
      clientCompany:  roResult.client_name   || roResult.brand_name  || "",
      contactName:    roResult.contact_person || "",
      designation:    "",
      phone:          "",
      email:          "",
      dealType,
      outcome:        "Needs Callback",
      amount:         String(roResult.total_payable || roResult.gross_amount || 0),
      targetAmount:   String(roResult.gross_amount  || roResult.total_payable || 0),
      priority:       "Regular",
      quarter:        filterQ,
      notes:          [
        roResult.ro_number   ? `RO# ${roResult.ro_number}`   : "",
        roResult.ro_date     ? `Dated: ${roResult.ro_date}`   : "",
        roResult.agency_name ? `Agency: ${roResult.agency_name}` : "",
        roResult.campaign_name ? `Campaign: ${roResult.campaign_name}` : "",
        roResult.channel     ? `Channel: ${roResult.channel}` : "",
      ].filter(Boolean).join(" · "),
      nextStep:       "Follow up on RO",
      nextStepDate:   roResult.start_date || TOMORROW,
      repId:          String(user_role?.repId || rep?.id || ""),
      reqs:           [],
      _fromRO:        roResult.ro_number || "",
    };
    setDealForm(prefilled as any);
    setAddDealOpen(true);
    showToast(`RO pre-filled → deal form opened ✓`);
  };

  const roExportAll = async () => {
    if(!roResults.length)return;
    const XLSX=await loadXLSX();
    const wb=XLSX.utils.book_new();
    const allDeals: any[]=[],allBreakup: any[]=[],allSummary: any[]=[];
    roResults.forEach(r=>{const exp=roBuildExport(r);allDeals.push(exp.dealRow);allBreakup.push(...exp.breakupRows);allSummary.push(exp.summaryRow);});
    roMakeSheet(wb,"Deals",allDeals);roMakeSheet(wb,"Deal Breakup",allBreakup);roMakeSheet(wb,"Summary",allSummary);
    XLSX.writeFile(wb,"All_Deals_Export.xlsx");
    showToast("All ROs exported");
  };

  // ── PUSH NOTIFICATIONS — fire-and-forget webhook to Zapier/Make/Slack ──
  const pushNotification = (event) => {
    const url = adminConfig?.webhookUrl?.trim();
    if (!url) return;
    externalPost(url, { source: "OTV CRM", timestamp: new Date().toISOString(), ...event });
  };

  // HR ENGINE — simulates EOD auto-fire
  // In production this runs server-side at 23:59 daily via cron
  const fireAbsenceReport = (rep, date) => {
    const alreadyFiled = absenceReports.find(r => String(r.repId)===String(rep.id) && r.date === date);
    if (alreadyFiled) { showToast("Report already filed for this date", "err"); return; }
    const report = {
      id: `ab${Date.now()}`, repId: rep.id, repName: rep.name, region: rep.region, role: rep.role,
      date, generatedAt: new Date().toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit",hour12:false}),
      status: "Sent to HR", sentTo: HR_EMAIL, markedAs: "Absent",
      exception: null, exceptionBy: null, exceptionReason: null, generatedBy: "System (Auto)"
    };
    setAbsenceReports(p => [report, ...p]);
    showToast(`Absence report fired to HR for ${rep.name}`);
  };

  // Simulate EOD run — 11:30 PM check: today logged AND tomorrow planned both required
  const runEODCheck = () => {
    let count = 0;
    reps.forEach(rep => {
      const todayLogged = meetings.some(m=>m.repId===rep.id&&m.date===TODAY);
      const tmrwPlanned = meetings.some(m=>m.repId===rep.id&&m.date===TOMORROW&&m.status==="planned");
      const bothDone = todayLogged && tmrwPlanned;
      if (!bothDone) {
        const alreadyFiled = absenceReports.find(r => String(r.repId)===String(rep.id) && r.date === TODAY);
        if (!alreadyFiled) {
          const reason = !todayLogged && !tmrwPlanned ? "Neither today's meetings logged nor tomorrow planned"
            : !todayLogged ? "Today's meetings not logged by 11:30 PM"
            : "Tomorrow's meetings not planned by 11:30 PM";
          setAbsenceReports(p => [{
            id:`ab${Date.now()+rep.id}`, repId:rep.id, repName:rep.name, region:rep.region, role:rep.role,
            date:TODAY, generatedAt:"23:30", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent",
            exception:null, exceptionBy:null, exceptionReason:null,
            generatedBy:`System (Auto — EOD: ${reason})`,
          }, ...p]);
          count++;
        }
      }
    });
    if (count === 0) showToast("All reps compliant — logged + planned ✓");
    else {
      showToast(`EOD: ${count} absence report${count!==1?"s":""} sent to HR`);
      pushNotification({ event: "eod_absence", count, date: TODAY, message: `EOD check: ${count} absence report${count!==1?"s":""} generated for ${TODAY}` });
    }
  };

  // EOD auto-run — fires automatically when clock hits 11:30 PM (client-side)
  const eodFiredRef = useRef(false);
  useEffect(() => {
    if (countdown === "11:30 PM passed" && !eodFiredRef.current) {
      eodFiredRef.current = true;
      runEODCheck();
    }
  }, [countdown]);

  // ONLY Litisha can grant exception
  const grantException = () => {
    if (!canGrantException) { showToast("Only Admin or CXO can grant exceptions", "err"); return; }
    if (!exceptionReason.trim()) { showToast("Reason required", "err"); return; }
    setAbsenceReports(p => p.map(r => r.id === exceptionModal.reportId
      ? { ...r, status:"Exception Granted", markedAs:"Present", exception:"Overridden", exceptionBy:user_role?.name||"Admin", exceptionReason: exceptionReason.trim() }
      : r
    ));
    // Also mark them present in attendance
    // @ts-ignore
    const rep = absenceReports.find(r => r.id === exceptionModal.reportId);
    if (rep) setAtt(p => ({...p, [rep.date]: {...(p[rep.date]||{}), [rep.repId]: true}}));
    setExceptionModal(null); setExceptionReason("");
    showToast("Exception granted — HR notified, marked Present");
  };

  const revokeException = (reportId) => {
    if (!canGrantException) { showToast("Only Admin or CXO can revoke exceptions", "err"); return; }
    setAbsenceReports(p => p.map(r => r.id === reportId
      ? { ...r, status:"Sent to HR", markedAs:"Absent", exception:null, exceptionBy:null, exceptionReason:null }
      : r
    ));
    showToast("Exception revoked — marked Absent again");
  };
  const user_role = USER_ROLES.find(u=>u.id===activeUser) || USER_ROLES.find(u=>u.id==="admin") || USER_ROLES[0];
  const canGrantException = ["ADMIN","CXO","CEO","CRO"].includes(user_role?.role);

  // Maps an IR dept string → the assignedToUserId of the right person to task
  const deptToUserId = (dept: string): string => {
    const rhByRegion: Record<string,string> = {North:"rh_north",South:"rh_south",East:"rh_east",West:"rh_west",National:"rh_national",Central:"rh_central"};
    const repRegion = user_role?.region || (deals as any[]).find((d: any)=>d.repId===user_role?.repId)?.region;
    if (dept==="Region Head")    return rhByRegion[repRegion||""] || "rh_north";
    if (dept==="NSH")            return "sales_head";
    if (dept==="CXO")            return "admin";
    if (dept==="Sales Strategy") return "sales_strategy";
    if (dept==="Digital")        return "digi_ops";
    if (dept==="Digi Ops")       return "digi_ops";
    if (dept==="CRO")            return "sales_analysis";
    if (dept==="Finance")        return "admin";
    if (dept==="Legal")          return "admin";
    if (dept==="Marketing")      return "admin";
    return "admin"; // HR, Branding, Content, Other → admin
  };

  // Pre-fill wizard region + RM once from the rep record (on first load only).
  // After pre-fill, the user fully controls both fields; changing region clears RM.
  // We do NOT use a render-time fallback (|| myRep.x) because that would re-populate
  // stale values after the user explicitly changes region and clears the RM selection.
  useEffect(() => {
    if (wizardPrefilled.current) return; // already done
    const myRepId = user_role?.repId;
    if (!myRepId) return;
    const myRep = reps.find((r:any) => r.id === myRepId || String(r.repId)===String(myRepId));
    if (!myRep) return;
    wizardPrefilled.current = true;
    if (!wizardRegion && myRep.region) setWizardRegion(myRep.region);
    if (!wizardRM    && (myRep as any).reportingManager) setWizardRM((myRep as any).reportingManager);
  }, [reps, user_role?.repId]);

  // Auto-fill repId when log meeting modal opens for a Sales Rep
  useEffect(()=>{
    if (logOpen && user_role?.repId) {
      setLogForm(p => ({...p, repId: String(user_role.repId)}));
    }
    if (!logOpen) {
      setLogForm(p => ({...BLANK_LOG, repId: user_role?.repId ? String(user_role.repId) : ""}));
    }
  }, [logOpen, activeUser]);

  // Section 18 — Trigger 3: actionItems & tasks where dueDate < today AND status = "Open" → escalate
  // 4-step escalation chain: Original → +12h → Region Head → +12h → NSH → +12h → Sales Strategy → +12h → CRO
  const ESC_CHAIN = ["Region Head","NSH","Sales Strategy","CRO"];
  useEffect(() => {
    const now = Date.now();
    const hasOpenTasks = tasks.some(t => t.dueDate && t.dueDate < TODAY && ["Open","Escalated"].includes(t.status||"Open"));
    if (hasOpenTasks) {
      (setTasks as React.Dispatch<React.SetStateAction<any>>)(prev => prev.map((t: any) => {
        if (!t.dueDate || t.dueDate >= TODAY) return t;
        if (!["Open","Escalated"].includes(t.status||"Open")) return t;
        const level = Number(t.escLevel)||0;
        const escAt: number = t.escAt ? new Date(t.escAt).getTime() : new Date(t.dueDate).getTime() + 12*3600000;
        if (now < escAt) return t.status==="Open"?{...t,status:"Escalated",escAt:t.escAt||new Date(new Date(t.dueDate).getTime()+12*3600000).toISOString()}:t;
        const newLevel = Math.min(level+1, ESC_CHAIN.length);
        const nextEscAt = new Date(escAt+12*3600000).toISOString();
        return {...t,status:"Escalated",escLevel:newLevel,escDept:ESC_CHAIN[newLevel-1]||t.escDept,escAt:nextEscAt};
      }));
    }
    // Auto-escalate IRs along the 4-step chain
    const hasOpenIRs = internalReqs.some(r => r.status==="Pending"&&r.escalationAt&&new Date(r.escalationAt).getTime()<now);
    if (hasOpenIRs) {
      setInternalReqs(prev => prev.map(r => {
        if (r.status!=="Pending"||!r.escalationAt) return r;
        // @ts-ignore
        if (new Date(r.escalationAt).getTime()>=now) return r;
        const level = Number(r.escLevel)||0;
        const newLevel = Math.min(level+1, ESC_CHAIN.length);
        const nextEscAt = new Date(new Date(r.escalationAt).getTime()+12*3600000).toISOString();
        return {...r,status:"Pending",escLevel:newLevel,escDept:ESC_CHAIN[newLevel-1]||r.dept,escalationAt:nextEscAt};
      }));
    }
  }, []); // Run once on page load

  // Auto-absence marking: check if any working day in the past week has no logged meeting and mark absent
  useEffect(() => {
    if (!isRep||!user_role?.repId) return;
    const repId = user_role.repId;
    const now = new Date();
    const hour = now.getHours()+now.getMinutes()/60;
    // Build list of past working days (Mon–Sat) going back 7 days
    const pastDays: string[] = [];
    for (let i=1; i<=7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate()-i);
      const dow = d.getDay(); // 0=Sun
      if (dow===0) continue; // skip Sunday
      pastDays.push(d.toISOString().slice(0,10));
    }
    // Check today too if past 11:30 PM (hour >= 23.5)
    if (hour >= 23.5) pastDays.unshift(TODAY);
    const toMark: string[] = [];
    pastDays.forEach(day => {
      const hasLog = (meetings||[]).some(m=>m.repId===repId&&m.date===day);
      const alreadyMarked = (absenceReports||[]).some(a=>a.repId===repId&&a.date===day);
      if (!hasLog&&!alreadyMarked) toMark.push(day);
    });
    if (toMark.length>0) {
      setAbsenceReports((prev)=>[...(prev as any[]),...toMark.map((day:string)=>({
        id:`abs_auto_${day}_${repId}`,repId,date:day,markedAs:"Absent",
        exception:null,exceptionBy:null,exceptionReason:null,
        status:"Auto-marked",autoMarked:true,createdAt:TODAY,
      }))]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]); // Re-check when user switches

  // Annual mode helpers — when "FY26 Annual" is selected the quarter filter spans all quarters
  const isAnnual = filterQ === "FY26 Annual";
  // "FY26 Annual" deals/targets must be visible under any quarterly filter within FY26.
  const qMatch   = (q: string) => isAnnual || q === filterQ || q === "FY26 Annual";
  // When logging new entries in annual mode, store under the current real quarter
  const entryQ   = isAnnual ? "Q4 FY26" : filterQ;

  // Filtered visible deals
  const visibleDeals = (deals as any[]).filter((d: any) => {
    const regionOk = user_role.canView==="all" ? (filterRegion==="All"||d.region===filterRegion) : user_role.canView==="region" ? d.region===user_role.region : d.repId===user_role.repId;
    return regionOk && qMatch(d.quarter||"");
  }) as Deal[];

  // Revenue Tracker: group visibleDeals by client
  const rtClientMap: Record<string, any> = {};
  visibleDeals.forEach((d: any)=>{
    if(!rtClientMap[d.clientCompany]) rtClientMap[d.clientCompany]={
      clientCompany:d.clientCompany, repId:d.repId, lastContact:d.lastContact,
      deals:[], fct:0, digital:0, integrated:0, sponsorship:0, branded:0, total:0, target:0
    };
    const c = rtClientMap[d.clientCompany];
    c.deals.push(d);
    c.target += (d.targetAmount||0);
    if(!c.lastContact||d.lastContact>c.lastContact) c.lastContact=d.lastContact;
  });
  // Formula Fix B: achievement totals from revenueEntries, not deal.amount
  (revenueEntries as any[]).forEach((e: any) => {
    const c = rtClientMap[e.clientCompany];
    if (!c) return;
    if (e.dealType==="Linear TV")              c.fct          += (e.amount||0);
    else if (e.dealType==="Digital")            c.digital      += (e.amount||0);
    else if (e.dealType==="Integrated Packages") c.integrated  += (e.amount||0);
    else if (e.dealType==="IPs")                c.sponsorship  += (e.amount||0);
    else if (e.dealType==="Media Solutions")    c.branded      += (e.amount||0);
    c.total += (e.amount||0);
  });
  const rtClients = Object.values(rtClientMap).sort((a: any, b: any)=>daysSince(b.lastContact)-daysSince(a.lastContact));

  const closedDeals  = visibleDeals.filter(d=>d.outcome==="Mail Confirmed");
  const activeDeals  = visibleDeals.filter(d=>d.outcome!=="Not Interested");
  // Bug 5 fix: CLOSED QTD in War Room must equal sum of actual revenue entries, not deal pipeline amounts.
  // We determine visible reps from visibleDeals, then sum their revenue entries for the current quarter.
  const visibleRepIdsSet = new Set(visibleDeals.map(d=>d.repId));
  const closedRevenue = (revenueEntries as any[]).filter((e: any) => visibleRepIdsSet.has(e.repId) && qMatch(e.quarter||"")).reduce((s: number, e: any)=>s+(e.amount||0), 0);
  // Part 4: at-risk = clientAccounts (spec: In Discussion / Negotiation / Mail Confirmed, 7+ days since last DEAL meeting)
  const atRisk       = (clientAccounts as any[]).filter((a: any) => visibleRepIdsSet.has(a.repId) && ["In Discussion","Negotiation","Mail Confirmed"].includes(a.currentStage||"") && daysSince(a.lastDealMeetingDate||a.lastContactDate) >= 7);
  const overdueNext  = activeDeals.filter((d: any)=>d.nextStepDate && d.nextStepDate<TODAY && d.outcome!=="Mail Confirmed");
  const allReqs      = (deals as any[]).flatMap((d: any)=>((d.reqs)||[]).map((r: any,i: number)=>({...r,dealId:d.id,reqIdx:i,clientCompany:d.clientCompany,amount:d.amount,repId:d.repId})));
  const todayMtgs    = meetings.filter(m=>m.date===TODAY);

  // @ts-ignore
  const totalTarget  = visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
  // @ts-ignore
  const weightedPipe = activeDeals.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
  const forecast     = closedRevenue+weightedPipe;
  const gap          = Math.max(0,totalTarget-forecast);
  const closePct     = totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0;
  const fcastPct     = totalTarget>0?Math.round((forecast/totalTarget)*100):0;

  const repScores = useMemo(() => reps
    .filter(r => user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId)
    .map(rep => {
      const rd      = (deals as any[]).filter((d: any)=>String(d.repId)===String(rep.id)&&qMatch(d.quarter||""));
      const closed  = (revenueEntries as any[]).filter((e: any)=>String(e.repId)===String(rep.id)&&qMatch(e.quarter||"")).reduce((s: number, e: any)=>s+(e.amount||0), 0);
      const pipe    = rd.filter((d: any)=>!["Mail Confirmed","Not Interested"].includes(d.outcome||"")).reduce((s: number, d: any)=>s+(d.amount||0), 0);
      const rm      = (meetings as any[]).filter((m: any)=>String(m.repId)===String(rep.id));
      const seniorM = rm.filter((m: any)=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel||"")).length;
      const risk    = rd.filter((d: any)=>!["Mail Confirmed","Not Interested"].includes(d.outcome||"")&&daysSince(d.lastContact)>=7).length;
      const attOk   = att[TODAY]?.[rep.id];
      const cPct    = rep.target>0?Math.round((closed/rep.target)*100):0;
      const senPct  = rm.length>0?Math.round((seniorM/rm.length)*100):0;
      return {...rep,closed,pipe,meetings:rm.length,seniorM,senPct,risk,attOk,cPct,coverage:rep.target>0?Math.round(((closed+pipe)/rep.target)*100):0};
    }).sort((a,b)=>b.cPct-a.cPct), [deals, meetings, att, filterQ, user_role]);

  // ── ROLE CONSTANTS (defined here so searchResults useMemo can use them) ──
  const isRep          = user_role?.role === "SALES REP";
  const isRH           = user_role?.role === "REGION HEAD";
  const isNSH          = user_role?.role === "SALES HEAD";
  const isCRORole      = user_role?.role === "CRO";
  const isStrategy     = user_role?.role === "SALES STRATEGY";
  const isDigiOps      = user_role?.role === "DIGI OPS";
  const isAdmin        = user_role?.role === "ADMIN";
  const isNSHDashboard = ["SALES HEAD","CRO","SALES STRATEGY"].includes(user_role?.role);
  const canLogMeeting  = !["CRO","SALES STRATEGY"].includes(user_role?.role);
  const isCEORole      = false;
  const isMDRole       = false;

  // Global search results — scoped to what the current user is allowed to see,
  // and navigates only to sidebar views that exist for the current role.
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const canView  = user_role?.canView || "self";
    const myRepId  = user_role?.repId;
    const myRegion = user_role?.region;

    // Determine which sidebar page each result type should land on.
    // null means the role has no such page — those results are suppressed.
    const dealView    = isAdmin ? null : "pipeline";
    const meetingView = (isAdmin || isDigiOps) ? null : "my-plan";
    const taskView    = isRep      ? "tasks"
                      : isRH       ? "rh-dashboard"
                      : isNSH      ? "my-tasks"
                      : isStrategy ? "nsh-rep-tasks"
                      : isCRORole  ? "nsh-rep-tasks"
                      : isDigiOps  ? "digi-tasks"
                      : null; // Admin: no task view

    // Scope data to what the user is allowed to see
    const scopedDeals = !dealView ? [] : canView==="all"
      ? deals
      : canView==="region"
        // @ts-ignore
        ? deals.filter(d=>d.region===myRegion)
        // @ts-ignore
        : deals.filter(d=>d.repId===myRepId);
    const scopedMeetings = !meetingView ? [] : canView==="all"
      ? meetings
      : canView==="region"
        ? meetings.filter(m=>reps.find(r=>r.id===m.repId)?.region===myRegion)
        : meetings.filter(m=>m.repId===myRepId);
    const scopedTasks = !taskView ? [] : canView==="all"
      ? tasks
      : canView==="region"
        ? tasks.filter(t=>reps.find(r=>r.id===t.repId)?.region===myRegion)
        : tasks.filter(t=>t.assignedTo===myRepId||t.assignedToUserId===activeUser||t.assignedBy===activeUser);

    const out: any[] = [];
    scopedDeals.filter(d =>
      // @ts-ignore
      d.clientCompany?.toLowerCase().includes(q) ||
      // @ts-ignore
      d.contactName?.toLowerCase().includes(q) ||
      // @ts-ignore
      d.notes?.toLowerCase().includes(q)
    // @ts-ignore
    ).slice(0, 5).forEach(d => out.push({ type:"deal", label:d.clientCompany, sub:`${d.outcome} · ${fmtR(d.amount)}`, action:()=>{ setView(dealView); setGlobalSearch(""); setSearchOpen(false); } }));
    scopedMeetings.filter(m =>
      // @ts-ignore
      m.clientCompany?.toLowerCase().includes(q) ||
      // @ts-ignore
      m.discussion?.toLowerCase().includes(q) ||
      m.contactName?.toLowerCase().includes(q)
    // @ts-ignore
    ).slice(0, 3).forEach(m => out.push({ type:"meeting", label:m.clientCompany, sub:`${m.date} · ${(m.discussion||"").slice(0,55)}`, action:()=>{ setView(meetingView); setGlobalSearch(""); setSearchOpen(false); } }));
    scopedTasks.filter(t =>
      t.clientCompany?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q)
    // @ts-ignore
    ).slice(0, 3).forEach(t => out.push({ type:"task", label:t.title, sub:t.clientCompany, action:()=>{ setView(taskView); setGlobalSearch(""); setSearchOpen(false); } }));
    return out.slice(0, 8);
  }, [globalSearch, deals, meetings, tasks, user_role, reps, activeUser,
      isRep, isRH, isNSH, isStrategy, isCRORole, isDigiOps, isAdmin]);

  const updateOutcome = (id: string, outcome: string) => {
    const closed = outcome === "Mail Confirmed";
    setDeals(p => p.map((d: any) => {
      if (d.id !== id) return d;
      const entry = closed && d.awaitingApproval ? [{
        at: TODAY, by: user_role?.name||"Manager", role: user_role?.role||"",
        action: "Closed", from: d.awaitingApproval, to: null, note: "Deal closed — approval cleared",
      }] : [];
      return {
        ...d, outcome, lastContact: TODAY,
        awaitingApproval:      closed ? null : d.awaitingApproval,
        awaitingApprovalSince: closed ? null : d.awaitingApprovalSince,
        atRisk: closed ? false : d.atRisk,
        auditLog: [...(d.auditLog||[]), ...entry],
      } as any;
    }) as Deal[]);
    if (closed) {
      const deal = deals.find((d: Deal) => d.id === id);
      if (deal) {
        pushNotification({ event: "deal_closed", client: deal.clientCompany, amount: deal.amount, rep: (deal as any).repName, message: `Deal won: ${deal.clientCompany} — ${fmtR(deal.amount)}` });
        showToast(`Deal marked won: ${deal.clientCompany}. Log the booked amount in Revenue Log.`);
      }
    }
  };
  const updateReq     = (dealId: string, reqIdx: number, status: string) => setDeals(p=>p.map(d=>d.id===dealId?{...d,reqs:(d.reqs||[]).map((r: any,i: number)=>i===reqIdx?{...r,status}:r)}:d) as Deal[]);

  const openSelfTask = () => {
    setTaskForm({...BLANK_TASK_FORM, assignedToUserId: activeUser, dueDate: TOMORROW});
    setSelfTaskMode(true);
    setTaskModal(true);
  };

  const openAddDeal = (prefillDealType?: string) => {
    setDealForm({...BLANK_DEAL, quarter: entryQ, repId: isRep ? String(user_role.repId) : "", dealType: prefillDealType || ""});
    setAddDealOpen(true);
  };

  const handleAddDeal = () => {
    const parsedRepId = parseInt(dealForm.repId);
    if (!dealForm.clientCompany||!parsedRepId||!dealForm.targetAmount){showToast("Fill required fields (client, rep, target)","err");return;}
    if (!reps.find(r=>r.id===parsedRepId)){showToast("Select a valid rep","err");return;}
    const rep = reps.find(r=>r.id===parseInt(dealForm.repId));
    const tgtAmt = parseCurrency(dealForm.targetAmount);
    const dealQ  = dealForm.quarter || entryQ;
    const newDealId = `d${Date.now()}`;
    // @ts-ignore
    setDeals(p=>[...p,{id:newDealId,...dealForm,repId:parsedRepId,repName:rep.name,region:rep.region,amount:parseCurrency(dealForm.amount||dealForm.targetAmount),targetAmount:tgtAmt,lastContact:TODAY,reqs:[]}]);
    // Upsert clientAccount so the new deal has a linked account
    // @ts-ignore
    setClientAccounts(prev => {
      // @ts-ignore
      const existing = prev.find(a => a.clientName === dealForm.clientCompany.trim() && String(a.repId)===String(parsedRepId));
      if (existing) {
        return prev;
      }
      const newAcct = {
        id: uid(), clientName: dealForm.clientCompany.trim(), repId: parsedRepId,
        region: rep.region || "", fiscalYear: CURRENT_FY,
        annualTarget: tgtAmt, currentStage: mapLegacyOutcome(dealForm.outcome||"Prospect"),
        lastContactDate: TODAY, lastDealMeetingDate: TODAY,
        createdAt: TODAY, updatedAt: TODAY,
      };
      // Link the new deal to this account
      // @ts-ignore
      setDeals(p => p.map(d => d.id === newDealId ? {...d, clientAccountId: newAcct.id} : d));
      return [...prev, newAcct];
    });
    // When a manager adds a deal for a rep, also submit a target plan entry so it
    // appears in the rep's My Targets view once the plan clears the approval chain.
    if (!isRep) {
      const initStatus = isRH?"Pending NSH":isNSH?"Pending Strategy":isStrategy?"Pending CRO":isCRORole?"Approved":"Pending NSH";
      const steps = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO"];
      const startIdx = steps.indexOf(initStatus);
      const skipLog  = steps.slice(0,startIdx).map(step=>({step,by:user_role?.name||"",at:TODAY,note:`Submitted by ${user_role?.role}`}));
      const newEntry = {clientCompany:dealForm.clientCompany.trim(),dealType:dealForm.dealType||"Linear TV",targetAmount:tgtAmt};
      // Never modify an approved (frozen) submission — always create a new one
      // @ts-ignore
      const existingSub = targetSubs.find(s=>s.repId===parsedRepId&&s.quarter===dealQ&&s.status===initStatus&&s.status!=="Approved"&&s.submittedByRole===user_role?.role);
      if (existingSub) {
        setTargetSubs(p=>p.map(s=>s.id===existingSub.id?{...s,clients:[...(s.clients||[]),newEntry],totalTarget:s.totalTarget+tgtAmt}:s) as TargetSub[]);
      } else {
        setTargetSubs(p=>[...p,{
          id:`ts${Date.now()}`,
          repId:String(parsedRepId),repName:(rep as any).name,region:(rep as any).region,
          quarter:dealQ,clients:[newEntry],totalTarget:tgtAmt,
          // Freeze immediately if auto-approved at CRO level
          ...(initStatus==="Approved" ? {frozenTarget: tgtAmt} : {}),
          status:initStatus,submittedAt:TODAY,
          submittedByName:user_role?.name||"",submittedByRole:user_role?.role||"",
          approvalLog:skipLog,
        } as unknown as TargetSub]);
      }
      showToast(initStatus==="Approved"?`Deal added + target auto-approved ✓`:`Deal added + target plan submitted → ${initStatus} ✓`);
    } else {
      showToast("Deal added ✓");
    }
    setDealForm(BLANK_DEAL); setAddDealOpen(false);
  };

  // ── TOUR HELPERS ──
  const _tourKey = isRep?"rep":isRH?"rh":isNSH?"nsh":isStrategy?"strategy":isCRORole?"cro":isAdmin?"admin":"rep";
  const currentTourData  = TOUR_DATA[_tourKey] || TOUR_DATA.rep;
  const currentTourSteps = currentTourData.steps;
  const startTour = () => {
    setTourKey(_tourKey);
    setTourStep(0);
    setShowWelcomeModal(false);
    setTourActive(true);
    localStorage.setItem(`otv_welcome_${activeUser}`, "1");
  };
  const closeTour = () => { setTourActive(false); setTourStep(0); };
  const openWelcome = () => { setTourActive(false); setShowWelcomeModal(true); };

  // FIX 5: Trigger guided tour for rep when their first target is approved (runs once per device)
  React.useEffect(() => {
    if (!isRep) return;
    const myRepId = user_role?.repId;
    const hasApproved = targetSubs.some(s => String(s.repId) === String(myRepId) && s.status === "Approved");
    if (hasApproved && !localStorage.getItem("otv_tour_seen")) {
      openWelcome();
    }
  }, [targetSubs, isRep, activeUser]);

  // ── APPROVAL HELPERS ──
  const APPROVAL_THRESHOLDS = {
    RH:   5000000,   // Deals > ₹50L need RH approval
    NSH:  10000000,  // Deals > ₹1Cr need NSH approval
    CXO:  30000000,  // Deals > ₹3Cr need CXO approval
  };

  const getRequiredApprover = (amount) => {
    if (amount >= APPROVAL_THRESHOLDS.CXO) return "CXO";
    if (amount >= APPROVAL_THRESHOLDS.NSH) return "NSH";
    if (amount >= APPROVAL_THRESHOLDS.RH)  return "NSH"; // RH approves then routes to NSH
    return "NSH"; // default
  };

  const getApprovalChainNext = (currentApprover, amount) => {
    if (currentApprover === "NSH")            return amount >= APPROVAL_THRESHOLDS.CXO ? "CXO" : "Sales Strategy";
    if (currentApprover === "Sales Strategy") return "CXO";
    if (currentApprover === "CXO")            return null;
    if (currentApprover === "RH")             return "NSH";
    return null;
  };

  const canApprove = (deal) => {
    const wa = deal.awaitingApproval;
    if (!wa) return false;
    if (isAdmin) return true;
    if (wa === "NSH" && isNSH) return true;
    if (wa === "CXO" && (isAdmin || user_role?.role === "CXO" || user_role?.role === "CRO")) return true;
    if (wa === "RH"  && isRH && deal.region === rhRegion) return true;
    if (wa === "Sales Strategy" && isStrategy) return true;
    if (wa === "Digital"        && isDigiOps)  return true;
    return false;
  };

  const approveDeal = (dealId: string, note = "") => {
    setDeals(prev => prev.map((d: any) => {
      if (d.id !== dealId) return d;
      const next  = getApprovalChainNext(d.awaitingApproval, d.amount);
      const entry = {
        at: TODAY, by: user_role?.name || "Unknown", role: user_role?.role || "",
        action: "Approved", from: d.awaitingApproval, to: next, note,
      };
      return { ...d, awaitingApproval: next, awaitingApprovalSince: next ? TODAY : null, auditLog: [...(d.auditLog || []), entry] } as any;
    }) as Deal[]);
    const d = deals.find((x: Deal) => x.id === dealId) as any;
    const next = d ? getApprovalChainNext(d.awaitingApproval, d.amount) : null;
    showToast(next ? `Approved → forwarded to ${next}` : "Deal fully approved ✓");
    if (d) pushNotification({ event: next ? "deal_approval_advanced" : "deal_fully_approved", client: d.clientCompany, amount: d.amount, approvedBy: user_role?.name, next, message: next ? `${d.clientCompany} approval forwarded to ${next}` : `${d.clientCompany} fully approved — ${fmtR(d.amount)}` });
  };

  const rejectDeal = (dealId: string, note = "") => {
    setDeals(prev => prev.map((d: any) => {
      if (d.id !== dealId) return d;
      const entry = {
        at: TODAY, by: user_role?.name || "Unknown", role: user_role?.role || "",
        action: "Rejected", from: d.awaitingApproval, to: null, note,
      };
      return { ...d, awaitingApproval: null, awaitingApprovalSince: null, outcome: "Price Concern", auditLog: [...(d.auditLog || []), entry] } as any;
    }) as Deal[]);
    showToast("Deal rejected — rep notified");
  };

  // ── BADGE COUNTS ──
  const rhEscBadge = deals.filter(d=>d.awaitingApproval==="NSH"&&daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length||null;
  const escBadge   = allReqs.filter(r=>r.status==="Overdue").length||null;
  const hrBadge    = absenceReports.filter(r=>r.markedAs==="Absent"&&r.status==="Sent to HR").length||null;
  const rhRegion   = user_role?.region;
  const rhApprovalBadge = isRH?(targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length+internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval").length)||null:null;
  const rhTaskBadge    = isRH ? (tasks as any[]).filter((t: any)=>t.assignedToUserId===activeUser&&t.status!=="Done").length||null : null;
  const rhDashBadge    = isRH ? (()=>{
    const _myRepIdsDB = reps.filter(r=>r.region===rhRegion).map(r=>r.id);
    const notLoggedDB = _myRepIdsDB.filter(id=>!(meetings||[]).some(m=>m.repId===id&&m.date===TODAY)).length;
    const pendingAppDB= (targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length+internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval").length);
    return (notLoggedDB+pendingAppDB)||null;
  })() : null;

  const myRepTaskBadge = isRep
    // @ts-ignore
    ? tasks.filter(t=>(t.assignedToUserId===activeUser||t.assignedTo===user_role?.repId)&&t.status!=="Done").length||null
    // @ts-ignore
    : tasks.filter(t=>t.status!=="Done").length||null;

  // ── SECTIONED NAV BUILDER ──
  const N = (id: any, label: any, icon: any, badge: any = null) => ({id,label,icon,badge});
  const getSidebarSections = () => {
    if (view === "ro-parser") return [];

    const irBadge      = internalReqs.filter(r=>r.status!=="Done"&&r.raisedBy===activeUser).length||null;
    const irInboxDept  = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":isDigiOps?"Digital":null;
    const irInboxBadge = irInboxDept
      // @ts-ignore
      ? internalReqs.filter(r=>r.status!=="Done"&&r.dept===irInboxDept).length||null
      // @ts-ignore
      : internalReqs.filter(r=>r.status!=="Done"&&["NSH","Sales Strategy","CRO","Branding Team","Content Team","Digital","Finance","Legal"].includes(r.dept)).length||null;

    // ── SALES REP ──
    if (isRep) return [
      { label:"DAILY WORK", items:[
        N("rep-dashboard",       "Dashboard",           "⊡"),
        N("my-plan",             "My Plan",             "◎"),
        N("revenue-log",         "Revenue Log",         "₹"),
        N("internal-requests",   "Internal Requests",   "⬆", irBadge),
        N("tasks",               "Tasks",               "✓", myRepTaskBadge),
        N("hr",                  "HR Report",           "⊘", hrBadge),
      ]},
    ];

    // ── REGION HEAD ──
    if (isRH) return [
      { label:"MY TEAM", items:[
        N("rh-dashboard",        "Dashboard",           "⬡", rhDashBadge),
        N("rh-team-plan",        "Team Meetings",       "◎"),
        N("warroom",             "War Room",            "⬡"),
        N("pipeline",            "Pipeline",            "◈"),
      ]},
      { label:"MY WORK", items:[
        N("my-plan",             "My Plan",             "◎"),
        N("target-approvals",    "Approvals",           "◎", rhApprovalBadge),
        N("my-tasks",            "My Tasks",            "✓", rhTaskBadge),
        N("internal-requests",   "Requests",            "⬆", irBadge),
      ]},
      { label:"REPORTS", items:[
        N("rh-escalations",      "Escalations",         "⚠", rhEscBadge),
        N("rh-team-report",      "Team Report",         "◈"),
        N("rh-my-hr",            "My HR",               "⊘", hrBadge),
      ]},
    ];

    // ── NSH (logs meetings) ──
    if (isNSH) return [
      { label:"PLANNING",    items:[N("my-plan","My Plan","◎"), N("nsh-rh-plan","RH's Plan","◎"), N("nsh-regional-plan","Rep's Plan","◎")] },
      { label:"COMMAND",     items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending NSH").length||undefined),
        N("my-tasks","My Tasks","✓"),
        N("escalations","Escalations","▲",escBadge),
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        N("hr","My HR Report","⊘",hrBadge),
      ]},
      { label:"REGION HEADS", items:[
        N("nsh-rh-scorecard","All Region Heads","◇"),
        N("nsh-rh-targets","RH Targets","◎"),
        N("nsh-rh-tasks","RH Tasks","✓"),
        N("nsh-rh-hr","RH's HR Reports","⊘"),
      ]},
      { label:"SALES REPS",  items:[
        N("nsh-rep-scorecard","All Sales Reps","◇"),
        N("nsh-rep-targets","Rep Targets","◎"),
        N("nsh-rep-tasks","Rep Tasks","✓"),
        N("nsh-rep-hr","Sales Reps' HR Reports","⊘"),
      ]},
      { label:"LEADERBOARD", items:[
        N("lb-region","By Region","◇"),
        N("lb-all","By Sales Rep","◇"),
      ]},
    ];

    // ── SALES STRATEGY (same dashboard as NSH) ──
    if (isStrategy) return [
      { label:"PLANNING",    items:[
        N("my-plan","Overview","◎"),
        N("nsh-myplan","NSH's Plan","◎"),
        N("nsh-rh-plan","RH's Plan","◎"),
        N("nsh-regional-plan","Rep's Plans","◎"),
      ]},
      { label:"COMMAND",     items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎"),
        N("escalations","Escalations","▲",escBadge),
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        N("hr","My HR Report","⊘",hrBadge),
      ]},
      { label:"REGION HEADS", items:[
        N("nsh-rh-scorecard","All Region Heads","◇"),
        N("nsh-rh-targets","RH Targets","◎"),
        N("nsh-rh-tasks","RH Tasks","✓"),
        N("nsh-rh-hr","RH's HR Reports","⊘"),
      ]},
      { label:"SALES REPS",  items:[
        N("nsh-rep-scorecard","All Sales Reps","◇"),
        N("nsh-rep-targets","Rep Targets","◎"),
        N("nsh-rep-tasks","Rep Tasks","✓"),
        N("nsh-rep-hr","Sales Reps' HR Reports","⊘"),
      ]},
      { label:"LEADERBOARD", items:[
        N("lb-region","By Region","◇"),
        N("lb-all","By Sales Rep","◇"),
      ]},
      { label:"SETTINGS",    items:[
        N("strategy-config","Approval Settings","⚙"),
      ]},
    ];

    // ── CRO (same dashboard as NSH, no log meeting) ──
    if (isCRORole) return [
      { label:"PLANNING",    items:[
        N("my-plan","Overview","◎"),
        N("nsh-myplan","NSH's Plan","◎"),
        N("nsh-rh-plan","RH's Plan","◎"),
        N("nsh-regional-plan","Rep's Plans","◎"),
      ]},
      { label:"COMMAND",     items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending CRO").length||undefined),
        N("escalations","Escalations","▲",escBadge),
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        N("hr","My HR Report","⊘",hrBadge),
      ]},
      { label:"REGION HEADS", items:[
        N("nsh-rh-scorecard","All Region Heads","◇"),
        N("nsh-rh-targets","RH Targets","◎"),
        N("nsh-rh-tasks","RH Tasks","✓"),
        N("nsh-rh-hr","RH's HR Reports","⊘"),
      ]},
      { label:"SALES REPS",  items:[
        N("nsh-rep-scorecard","All Sales Reps","◇"),
        N("nsh-rep-targets","Rep Targets","◎"),
        N("nsh-rep-tasks","Rep Tasks","✓"),
        N("nsh-rep-hr","Sales Reps' HR Reports","⊘"),
      ]},
      { label:"LEADERBOARD", items:[
        N("lb-region","By Region","◇"),
        N("lb-all","By Sales Rep","◇"),
      ]},
    ];

    // ── DIGI OPS ──
    if (isDigiOps) return [
      { label:"DIGITAL",     items:[
        N("digi-deals","Digital Deals","◉"),
        N("digi-tv-deals","TV + Digital Deals","◉"),
        N("digi-tasks","My Tasks","✓",(tasks as any[]).filter((t: any)=>t.dept==="Digital"&&t.status!=="Done").length||undefined),
        N("digi-projects","Digital Projects","◈"),
      ]},
      { label:"PIPELINE",    items:[N("pipeline","Revenue Tracker","◈")] },
      { label:"APPROVALS",   items:[N("internal-requests","Internal Requests","⬆",irInboxBadge)] },
      { label:"LEADERBOARD", items:[N("leaderboard","Leaderboard","◇")] },
    ];

    // ── ADMIN ──
    if (isAdmin) return [
      { label:"ACCESS",    items:[N("admin-access","Access Management","◎",pendingUsers.length||undefined)] },
      { label:"PLATFORM",  items:[N("import","Target Import","⬆"), N("admin-config","Platform Config","⚙")] },
      { label:"MONITOR",   items:[N("warroom","War Room","⬡"), N("pipeline","Revenue Tracker","◈")] },
      { label:"APPROVALS", items:[N("admin-approvals","Approval Queue","✦",(internalReqs as any[]).filter((r:any)=>r.status==="Pending"||r.status==="Overdue").length||undefined)] },
    ];

    // Fallback — should never reach here but prevents blank screen
    return [
      { label:"CRM", items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("leaderboard","Leaderboard","◇"),
      ]},
    ];
  };

  const navSections = getSidebarSections();
  const nav = navSections.flatMap(s => s.items); // flat nav kept for any legacy usage

  // Global API status — collected from all API-backed entity hooks
  const crmLoading = tasksLoading || targetLoading || revLoading;
  const syncError  = tasksError || tpError || irError || targetError || revError || caError;

  // ── CROApp context value — provided to all extracted views ──────────────────
  const ctxValue: CROAppContextValue = {
    user,
    deals, setDeals,
    meetings, setMeetings,
    tasks, setTasks,
    targetSubs, setTargetSubs,
    revenueEntries, setRevenueEntries,
    clientAccounts, setClientAccounts,
    touchpoints, setTouchpoints,
    internalReqs, setInternalReqs,
    reps, setReps,
    masterClients, setMasterClients,
    clientMasterList, setClientMasterList,
    adminConfig, setAdminConfig,
    savedROs, setSavedROs,
    att, setAtt,
    absenceReports, setAbsenceReports,
    weeklyPlans, setWeeklyPlans,
    properties, setProperties,
    ipProposals, setIpProposals,
    attDbRecords, attExcRequests, attDbLoading, fetchAttendanceData,
    user_role, isRep, isRH, isNSH, isCRORole, isStrategy, isDigiOps, isAdmin, isNSHDashboard,
    canLogMeeting, canGrantException,
    rhRegion,
    activeUser, setActiveUser,
    filterQ, setFilterQ,
    filterRegion, setFilterRegion,
    entryQ,
    visibleDeals, atRisk, overdueNext, closedRevenue, repScores, qMatch,
    parseCurrency, fmt, fmtR, daysSince, uid, dealStage, oColor, riskColor, riskLabel, lColor, mapLegacyOutcome, deptToUserId,
    getAchieved, getCommitted, getInPlay, getShortfall, getAnnualTarget, stackedBar,
    showToast, openNoteModal, pushNotification,
    updateOutcome, approveDeal, rejectDeal, updateReq,
    openAddDeal, handleAddDeal, openSelfTask,
    grantException, revokeException, fireAbsenceReport, runEODCheck, roPushToPipeline,
    addDealOpen, setAddDealOpen, dealForm, setDealForm,
    logOpen, setLogOpen, logForm, setLogForm,
    viewMeetingId, setViewMeetingId,
    meetingEditMode, setMeetingEditMode, meetingEditForm, setMeetingEditForm,
    taskModal, setTaskModal, selfTaskMode, setSelfTaskMode, taskForm, setTaskForm,
    noteModal, setNoteModal, noteModalVal, setNoteModalVal,
    expanded, setExpanded,
    toast, setToast,
    profileOpen, setProfileOpen,
    accountThreadOpen, setAccountThreadOpen, accountThreadClient, setAccountThreadClient, threadAIForm, setThreadAIForm,
    DEAL_STAGES, STAGE_PROB, DEAL_TYPES, REGIONS, ALL_ROLES, QUARTERS,
    C, TODAY, TOMORROW, CURRENT_FY,
  };

  return showHome ? (
    <HomeScreen
      user={user}
      onSelect={() => setShowHome(false)}
      onLogout={onLogout}
    />
  ) : (
    <CROAppProvider value={ctxValue}>
    <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",fontSize:13}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes loadpulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${C.s3};border-radius:2px}
        .sans{font-family:'DM Sans',sans-serif}
        input,select,textarea{font-family:'DM Mono',monospace;font-size:12px;color:${C.text};background:${C.s2};border:1px solid ${C.border};border-radius:4px;padding:7px 10px;outline:none;width:100%;transition:border-color .15s}
        input:focus,select:focus,textarea:focus{border-color:${C.accent}}
        select option{background:${C.s2}}
        .card{background:${C.surface};border:1px solid ${C.border};border-radius:6px}
        .row{background:${C.surface};border:1px solid ${C.border};border-radius:5px;padding:11px 14px;margin-bottom:6px;transition:border-color .15s}
        .row:hover{border-color:${C.accent}88}
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
        .modal{background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:18px;width:560px;max-height:94vh;overflow-y:auto}
        .pbar{height:5px;background:${C.s3};border-radius:3px;overflow:hidden}
        .pfill{height:100%;border-radius:3px;transition:width .6s}
        th{text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;color:${C.dim};padding:7px 10px;border-bottom:1px solid ${C.border};text-transform:uppercase;white-space:nowrap}
        td{padding:9px 10px;border-bottom:1px solid ${C.border};vertical-align:middle;font-size:12px}
        tr:last-child td{border-bottom:none}
        tr:hover td{background:${C.s2}}
        table{width:100%;border-collapse:collapse}
        label{font-size:10px;color:${C.dim};display:block;margin-bottom:4px;letter-spacing:.06em;text-transform:uppercase}
      `}</style>

      {/* ── API Loading indicator — thin amber bar at top while initial data loads ── */}
      {crmLoading && (
        <div style={{position:"fixed",top:0,left:0,right:0,height:2,background:C.accent,zIndex:9999,animation:"loadpulse 1.2s ease-in-out infinite",pointerEvents:"none"}} />
      )}

      {/* ── Sync error toast — bottom-right, auto-clears on next successful write ── */}
      {syncError && (
        <div style={{position:"fixed",bottom:20,right:20,zIndex:9998,maxWidth:300,background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.red}`,borderRadius:6,padding:"10px 14px",boxShadow:"0 4px 16px rgba(0,0,0,.12)"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Sync Error</div>
          <div style={{fontSize:11,color:C.dim}}>{syncError}</div>
        </div>
      )}

      {/* ── Admin users loading/error banner (admin panel only) ── */}
      {adminUsersError && view === "admin-access" && (
        <div style={{position:"fixed",bottom:20,left:20,zIndex:9998,maxWidth:280,background:C.surface,border:`1px solid ${C.orange}55`,borderLeft:`3px solid ${C.orange}`,borderRadius:6,padding:"10px 14px",boxShadow:"0 4px 16px rgba(0,0,0,.1)"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.orange,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>User Fetch Error</div>
          <div style={{fontSize:11,color:C.dim}}>{adminUsersError}</div>
        </div>
      )}
      {/* TOPBAR */}
      <AppTopbar
        C={C} user={user} user_role={user_role}
        activeUser={activeUser} setActiveUser={setActiveUser}
        isMobile={isMobile} filterQ={filterQ} setFilterQ={setFilterQ}
        filterRegion={filterRegion} setFilterRegion={setFilterRegion}
        QUARTERS={QUARTERS} REGIONS={REGIONS}
        globalSearch={globalSearch} setGlobalSearch={setGlobalSearch}
        searchOpen={searchOpen} setSearchOpen={setSearchOpen}
        searchResults={searchResults} searchRef={searchRef}
        profileOpen={profileOpen} setProfileOpen={setProfileOpen}
        countdown={countdown} isRep={isRep} isRH={isRH}
        openWelcome={openWelcome} onLogout={onLogout} setShowHome={setShowHome}
      />
      {/* WELCOME MODAL */}
      {showWelcomeModal && (
        <WelcomeModal
          C={C} activeUser={activeUser} currentTourData={currentTourData}
          startTour={startTour} onClose={()=>{ localStorage.setItem("otv_tour_seen","1"); setShowWelcomeModal(false); }}
        />
      )}
      {/* TOUR OVERLAY */}
      {tourActive && (
        <TourOverlay
          C={C} tourStep={tourStep} setTourStep={setTourStep}
          currentTourSteps={currentTourSteps} tourTargetRect={tourTargetRect}
          closeTour={closeTour}
        />
      )}

      <div style={{display:"flex",flex:1,overflow:"hidden",flexDirection: isMobile ? "column" : "row"}}>
        {/* SIDEBAR — vertical on desktop, horizontal tab bar on mobile */}
        {isMobile ? (
          <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto",flexShrink:0,padding:"4px 8px",gap:2}}>
            {navSections.flatMap(sec => sec.items).map(n => (
              <button key={n.id} onClick={()=>setView(n.id)}
                style={{flexShrink:0,padding:"6px 10px",background:view===n.id?`${C.accent}18`:"transparent",border:"none",borderBottom:view===n.id?`2px solid ${C.accent}`:"2px solid transparent",color:view===n.id?C.accent:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:view===n.id?600:400,whiteSpace:"nowrap",transition:"all .1s"}}>
                <span style={{fontSize:11}}>{n.icon}</span>
                <span>{n.label}</span>
                {(n.badge||0)>0&&<span style={{background:C.red,color:"#fff",borderRadius:8,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,padding:"0 3px"}}>{n.badge}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div style={{width:182,background:C.surface,borderRight:`1px solid ${C.border}`,padding:"6px 0 0",flexShrink:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
            {navSections.map((sec,si) => (
              <div key={si} style={{marginBottom:2}}>
                <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",padding:si===0?"6px 14px 3px":"10px 14px 3px"}}>{sec.label}</div>
                {sec.items.map(n => (
                  <button key={n.id} onClick={()=>setView(n.id)}
                    data-tour={n.id}
                    style={{width:"100%",padding:"8px 14px",background:view===n.id?`${C.accent}12`:"transparent",border:"none",borderLeft:view===n.id?`2px solid ${C.accent}`:"2px solid transparent",color:view===n.id?C.accent:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:view===n.id?600:400,letterSpacing:".03em",textAlign:"left",transition:"all .1s"}}>
                    <span style={{fontSize:12,opacity:.75}}>{n.icon}</span>
                    <span style={{flex:1}}>{n.label}</span>
                    {(n.badge||0)>0&&<span style={{background:C.red,color:"#fff",borderRadius:8,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,padding:"0 3px"}}>{n.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
            <div style={{flex:1}} />
          </div>
        )}

        {/* MAIN */}
        <div data-tour="content-area" style={{flex:1,overflow:"auto",padding: isMobile ? 12 : 20}}>

          {/* Soft banner: targets not yet finalised — does not block the platform */}
          {isRep && adminConfig.platformLive === false && view === "target-submit" && (targetSubs as any[]).filter((t:any)=>t.repId===user_role?.repId).length === 0 && (
            <div style={{background:"#fffbeb",border:"1px solid #f59e0b44",borderRadius:8,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⚠</span>
              <span style={{fontSize:12,color:"#92400e",fontFamily:"'DM Sans',sans-serif"}}>No targets assigned yet. Contact your Admin or CRO to get started.</span>
            </div>
          )}

          {/* ═══ SETUP WIZARD ═══ */}
          <SetupWizardView
            view={view} setView={setView}
            wizardStep={wizardStep} setWizardStep={setWizardStep}
            wizardClients={wizardClients} setWizardClients={setWizardClients}
            wizardRegion={wizardRegion} setWizardRegion={setWizardRegion}
            wizardRM={wizardRM} setWizardRM={setWizardRM}
            newClients={newClients} setNewClients={setNewClients}
            addClientModalOpen={addClientModalOpen} setAddClientModalOpen={setAddClientModalOpen}
            addClientForm={addClientForm} setAddClientForm={setAddClientForm}
          />
          {/* ═══ REP DASHBOARD ═══ */}
          {view==="rep-dashboard" && isRep && (()=>{
            const myRepId   = user_role?.repId;
            const annualTgt = getAnnualTarget(myRepId).amount;
            const ach       = getAchieved(myRepId);
            const comm      = getCommitted(myRepId);
            const inpl      = getInPlay(myRepId);
            const sf        = getShortfall(annualTgt, myRepId);
            const pct       = annualTgt > 0 ? Math.min(100, Math.round((ach / annualTgt) * 100)) : 0;
            const todayM    = new Date().getMonth() + 1;
            const qIdx      = todayM >= 4 && todayM <= 6 ? 0 : todayM >= 7 && todayM <= 9 ? 1 : todayM >= 10 && todayM <= 12 ? 2 : 3;
            const currentQ  = QUARTERS[qIdx];
            const qSubs     = targetSubs.filter(s => String(s.repId)===String(myRepId) && s.quarter === currentQ && s.status === "Approved");
            const qTarget   = qSubs.reduce((s,x) => s + (x.totalTarget||0), 0);
            const qAch      = revenueEntries.filter(e => String(e.repId)===String(myRepId) && e.quarter === currentQ).reduce((s,e) => s + (parseCurrency(e.amount||"0")||0), 0);
            const myTargetSub  = targetSubs.find(s => String(s.repId)===String(myRepId));
            const targetApprovalStatus = !myTargetSub ? "none" : myTargetSub.status === "Approved" ? "approved" : "pending";
            return (
              <RepDashboard
                userRole={user_role}
                activeUser={activeUser}
                currentQ={currentQ}
                annualTgt={annualTgt}
                ach={ach}
                comm={comm}
                inpl={inpl}
                sf={sf}
                pct={pct}
                qTarget={qTarget}
                qAch={qAch}
                targetApprovalStatus={targetApprovalStatus}
                internalReqs={internalReqs as any}
                hrBadge={hrBadge}
                stackedBar={stackedBar}
                onLogRevenue={({clientName,amount,invoiceRef,date}) => {
                  const amt  = parseCurrency(amount);
                  if(!amt){showToast("Enter a valid amount (e.g. 5L or 50000)","err");return;}
                  const ikey = `ikey_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const id   = `re_d${Date.now()}`;
                  const entry = {id,repId:myRepId,clientCompany:clientName.trim(),dealType:"Linear TV",amount:amt,invoiceRef:invoiceRef.trim(),date:date||TODAY,quarter:entryQ,fiscalYear:CURRENT_FY,notes:""};
                  setRevenueEntries(p=>[entry,...p]);
                  revSvc.createRevenueEntry({
                    id, repId:myRepId, clientCompany:clientName.trim(), amount:amt,
                    invoiceRef:invoiceRef.trim(), date:date||TODAY,
                    quarter:entryQ, fiscalYear:CURRENT_FY, idempotencyKey:ikey,
                  }).then(()=>{
                    showToast(`₹${(amt/100000).toFixed(1)}L logged for ${clientName.trim()} ✓`);
                  }).catch((err:any)=>{
                    showToast(err?.body?.error||"Failed to save revenue entry","err");
                    setRevenueEntries(p=>p.filter(e=>e.id!==id));
                  });
                }}
                onNavigate={setView}
              />
            );
          })()}

          {/* ═══ MY PLAN ═══ */}
          {view==="my-plan" && (
            <MyPlan
              userRole={user_role}
              activeUser={activeUser}
              isRep={isRep}
              isNSH={isNSHDashboard}
              isRH={isRH}
              isStrategy={isStrategy}
              isCRORole={isCRORole}
              isAdmin={isAdmin}
              isDigiOps={isDigiOps}
              deals={deals as any}
              filterQ={filterQ}
              adminConfig={adminConfig}
              reps={reps}
              countdown={countdown}
              setDealForm={setDealForm}
              setAddDealOpen={setAddDealOpen}
              setViewMeetingId={setViewMeetingId}
              showToast={showToast}
              qMatch={qMatch}
              BLANK_DEAL={BLANK_DEAL}
              onNavigate={setView}
              onNavigateRevenue={(prefill)=>{
                if(prefill){setRevForm(p=>({...p,clientCompany:prefill.clientCompany||p.clientCompany,agencyName:prefill.agency||p.agencyName,amount:prefill.amount!==undefined?String(prefill.amount):p.amount}))}
                setView("revenue-log");
              }}
            />
          )}

          {/* ═══ WARROOM (RH, NSH, REP) ═══ */}
          <WarroomView
            view={view} setView={setView} isMobile={isMobile}
            rhWarroomClient={rhWarroomClient} setRhWarroomClient={setRhWarroomClient}
            rhWarroomRep={rhWarroomRep} setRhWarroomRep={setRhWarroomRep}
          />
          {/* ═══ REVENUE TRACKER ═══ */}
          <PipelineView
            view={view} setView={setView} isMobile={isMobile}
            rtTab={rtTab} setRtTab={setRtTab}
          />
          {/* ═══ LEADERBOARD ═══ */}
          <LeaderboardView view={view} setView={setView} lbTab={lbTab} setLbTab={setLbTab} />
          {/* ═══ INTERNAL REQUESTS ═══ */}
          <InternalRequestsView
            view={view} setView={setView}
            irFormOpen={irFormOpen} setIrFormOpen={setIrFormOpen}
            irForm={irForm} setIrForm={setIrForm}
            editIrId={editIrId} setEditIrId={setEditIrId}
            irStatusFilter={irStatusFilter} setIrStatusFilter={setIrStatusFilter}
          />
          {/* ═══ ADMIN ═══ */}
          {(view==="admin-access"||view==="admin-approvals"||view==="admin-export"||view==="admin-system") && isAdmin && (
            <AdminView
              view={view}
              setView={setView}
            />
          )}

                    {/* ═══ TARGETS ═══ */}
          <TargetsView
            view={view} setView={setView}
            targetSubTab={targetSubTab} setTargetSubTab={setTargetSubTab}
            editSubId={editSubId} setEditSubId={setEditSubId}
            editSubClients={editSubClients} setEditSubClients={setEditSubClients}
            planUploadOpen={planUploadOpen} setPlanUploadOpen={setPlanUploadOpen}
            planUploadForm={planUploadForm} setPlanUploadForm={setPlanUploadForm}
            newClients={newClients} setNewClients={setNewClients}
            addClientModalOpen={addClientModalOpen} setAddClientModalOpen={setAddClientModalOpen}
            addClientForm={addClientForm} setAddClientForm={setAddClientForm}
            rhRepDrill={rhRepDrill} setRhRepDrill={setRhRepDrill}
            targetDrilldown={targetDrilldown} setTargetDrilldown={setTargetDrilldown}
            nshRepDrill={nshRepDrill} setNshRepDrill={setNshRepDrill}
          />
          {/* ═══ RH ESCALATIONS + TEAM ═══ */}
          <RHView
            view={view} setView={setView} isMobile={isMobile}
            rhRepDrill={rhRepDrill} setRhRepDrill={setRhRepDrill}
            rhDrillPlan={rhDrillPlan} setRhDrillPlan={setRhDrillPlan}
            rhTeamFilter={rhTeamFilter} setRhTeamFilter={setRhTeamFilter}
            rhWarroomClient={rhWarroomClient} setRhWarroomClient={setRhWarroomClient}
            rhWarroomRep={rhWarroomRep} setRhWarroomRep={setRhWarroomRep}
            rhTeamReportRep={rhTeamReportRep} setRhTeamReportRep={setRhTeamReportRep}
          />
          <TeamView view={view} setView={setView} />
          {/* ═══ ACTIVITY ═══ */}
          <ActivityView view={view} setView={setView} />
          {/* ═══ ESCALATIONS ═══ */}
          <EscalationsView view={view} setView={setView} />
          {/* ═══ COMPLIANCE ═══ */}
          <ComplianceView view={view} setView={setView} />
          {/* ═══ HR REPORTS ═══ */}
          <HRView
            view={view} setView={setView}
            exceptionModal={exceptionModal} setExceptionModal={setExceptionModal}
            exceptionReason={exceptionReason} setExceptionReason={setExceptionReason}
            excReqOpen={excReqOpen} setExcReqOpen={setExcReqOpen}
            excReqRecord={excReqRecord} setExcReqRecord={setExcReqRecord}
            excReqForm={excReqForm} setExcReqForm={setExcReqForm}
            excReqSubmitting={excReqSubmitting} setExcReqSubmitting={setExcReqSubmitting}
          />
          {/* ═══ TASKS ═══ */}
          <TasksView view={view} setView={setView} />
          {/* ═══ REVENUE LOG ═══ */}
          <RevenueLogView
            view={view} setView={setView}
            revTab={revTab} setRevTab={setRevTab}
            revForm={revForm} setRevForm={setRevForm}
            editingRevId={editingRevId} setEditingRevId={setEditingRevId}
            editRevData={editRevData} setEditRevData={setEditRevData}
          />
          {/* ═══ STRATEGY / ADMIN CONFIG / DATA MANAGEMENT ═══ */}
          {(view==="strategy-config"||view==="admin-config"||view==="import") && (
            <SystemConfigView view={view} />
          )}

          {/* ═══ NSH/STRATEGY + CRO MANAGEMENT VIEWS ═══ */}
          {/* NSHView handles all NSH/Strategy/CRO management screens using isNSHDashboard flag */}
          <NSHView
            view={view} setView={setView} isMobile={isMobile}
            nshRHDrill={nshRHDrill} setNshRHDrill={setNshRHDrill}
            nshRegion={nshRegion} setNshRegion={setNshRegion}
            targetDrilldown={targetDrilldown} setTargetDrilldown={setTargetDrilldown}
            nshRepDrill={nshRepDrill} setNshRepDrill={setNshRepDrill}
          />
          <DigiOpsView view={view} setView={setView} />
          {view==="ro-parser" && (
            <div>
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RO PARSER</div>
                <div style={{fontSize:11,color:C.dim}}>Upload any agency Release Order — PDF, Excel, image, CSV or paste text. Exports Deal + Breakup sheets.</div>
              </div>

              {/* Upload area */}
              <div className="card" style={{padding:18,marginBottom:16}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Upload Files</div>
                    <div
                      // @ts-ignore
                      onClick={()=>roFileRef.current.click()}
                      style={{border:`2px dashed ${roFiles.length?C.green:C.border}`,borderRadius:8,padding:"20px 16px",textAlign:"center",cursor:"pointer",transition:"border-color .15s",background:C.s2}}
                      onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=C.accent;}}
                      onDragLeave={e=>{e.currentTarget.style.borderColor=roFiles.length?C.green:C.border;}}
                      onDrop={e=>{e.preventDefault();const files=Array.from(e.dataTransfer.files).filter(f=>/\.(pdf|xlsx|xls|csv|png|jpg|jpeg|webp)$/i.test(f.name));setRoFiles(p=>[...p,...files]);e.currentTarget.style.borderColor=files.length?C.green:C.border;}}>
                      <div style={{fontSize:24,marginBottom:6}}>📎</div>
                      <div style={{fontSize:12,color:C.text,fontWeight:600}}>Drop files here or click to upload</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:4}}>PDF · Excel · Images · CSV</div>
                    </div>
                    <input ref={roFileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp" style={{display:"none"}}
                      onChange={e=>setRoFiles(p=>[...p,...Array.from((e.target as HTMLInputElement).files||[])])} />
                    {roFiles.length>0&&(
                      <div style={{marginTop:8}}>
                        {roFiles.map((f,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.s2,borderRadius:5,padding:"5px 10px",marginBottom:4}}>
                            <span style={{fontSize:11,flex:1,color:C.text}}>{f.name}</span>
                            <button onClick={()=>setRoFiles(p=>p.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:13}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{color:C.muted,fontSize:11,paddingTop:40,alignSelf:"center"}}>— or —</div>

                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Paste RO Text</div>
                    <textarea
                      placeholder="Paste RO text here..."
                      value={roInputText}
                      onChange={e=>setRoInputText(e.target.value)}
                      rows={6}
                      style={{width:"100%",background:C.s2,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",resize:"vertical",outline:"none"}}
                    />
                  </div>
                </div>

                <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14}}>
                  <button
                    onClick={roParseAll}
                    disabled={roLoading||(!roFiles.length&&!roInputText.trim())}
                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"9px 24px",borderRadius:6,cursor:roLoading?"wait":"pointer",fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace",opacity:(!roFiles.length&&!roInputText.trim())?0.4:1,transition:"opacity .15s"}}>
                    {roLoading?`⏳ ${roProgress||"Parsing..."}`:"⚡ Parse RO"}
                  </button>
                  {roLoading && (
                    <button onClick={()=>{roCancelParse();setRoLoading(false);setRoProgress("");setRoError("Parse cancelled.");}}
                      style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                      ✕ Cancel
                    </button>
                  )}
                  {(roFiles.length>0||roInputText.trim())&&!roLoading&&(
                    <button onClick={()=>{setRoFiles([]);setRoInputText("");setRoResults([]);setRoError(null);}}
                      style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                      Clear All
                    </button>
                  )}
                  {roError&&<span style={{color:C.red,fontSize:11}}>⚠ {roError}</span>}
                </div>
              </div>

              {/* Results */}
              {roResults.length>0&&(
                <div>
                  {roResults.length>1&&(
                    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                      {roResults.map((r,i)=>(
                        <button key={i} onClick={()=>setRoActiveDoc(i)}
                          style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${roActiveDoc===i?C.accent:C.border}`,background:roActiveDoc===i?`${C.accent}18`:"transparent",color:roActiveDoc===i?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                          {r._filename||`Doc ${i+1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  <ROCard
                    result={roResults[roActiveDoc]}
                    onExport={()=>roExportSingle(roResults[roActiveDoc])}
                    onPushToPipeline={roPushToPipeline}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══ RO MANAGEMENT ═══ */}
          <ROManagementView
            view={view} setView={setView}
            roMgmtChannel={roMgmtChannel} setRoMgmtChannel={setRoMgmtChannel}
            roMgmtStatus={roMgmtStatus} setRoMgmtStatus={setRoMgmtStatus}
            roMgmtViewRO={roMgmtViewRO} setRoMgmtViewRO={setRoMgmtViewRO}
            roMgmtConfirmDelete={roMgmtConfirmDelete} setRoMgmtConfirmDelete={setRoMgmtConfirmDelete}
            ROCard={ROCard} roExportSingle={roExportSingle}
          />
          {/* ═══ RH XSCORE / REP SCOREBOARDS ═══ */}
          <RHXScoreView view={view} setView={setView} />
          <RepAllRepsView view={view} setView={setView} />
          <RepTeamView view={view} setView={setView} />

        </div>
      </div>

      {/* ASSIGN TASK MODAL */}
      <AssignTaskModal
        taskModal={taskModal} selfTaskMode={selfTaskMode}
        taskForm={taskForm} setTaskForm={setTaskForm}
        isRep={isRep} user_role={user_role} activeUser={activeUser} user={user}
        BLANK_TASK_FORM={BLANK_TASK_FORM}
        setTaskModal={setTaskModal} setSelfTaskMode={setSelfTaskMode}
        setTasks={setTasks} showToast={showToast}
      />
      {/* PLAN UPLOAD MODAL */}
      {planUploadOpen && !isRep && (
        <PlanUploadModal
          C={C} reps={reps} user_role={user_role}
          isRH={isRH} isNSH={isNSH} isStrategy={isStrategy} isCRORole={isCRORole}
          planUploadForm={planUploadForm} setPlanUploadForm={setPlanUploadForm}
          clientMasterList={clientMasterList} deals={deals} setDeals={setDeals}
          targetSubs={targetSubs} setTargetSubs={setTargetSubs}
          TODAY={TODAY} parseCurrency={parseCurrency} fmtR={fmtR}
          showToast={showToast} onClose={()=>setPlanUploadOpen(false)}
        />
      )}
      {/* ADD DEAL MODAL */}
      {addDealOpen && (
        <AddDealModal
          C={C} dealForm={dealForm} setDealForm={setDealForm}
          reps={reps} user_role={user_role} isRep={isRep} isRH={isRH}
          targetSubs={targetSubs} deals={deals}
          handleAddDeal={handleAddDeal} onClose={()=>setAddDealOpen(false)}
        />
      )}

      {/* LOG TOUCHPOINT MODAL — global standalone entry point (no parent meeting) */}
      {logOpen && (
        <LogMeeting
          open={logOpen}
          meeting={null}
          onClose={() => { setLogOpen(false); }}
          onSubmit={(_tp) => { setLogOpen(false); showToast("Touchpoint logged ✓"); }}
          userRole={user_role}
          deals={deals}
          showToast={showToast}
          onNavigateRevenue={(prefill) => { setLogOpen(false); if(prefill){setRevForm(p=>({...p,clientCompany:prefill.clientCompany||p.clientCompany,agencyName:prefill.agency||p.agencyName,amount:prefill.amount!==undefined?String(prefill.amount):p.amount}))} setView('revenue-log'); }}
        />
      )}
      {/* MEETING DETAIL MODAL */}
      <MeetingDetailModal
        C={C} viewMeetingId={viewMeetingId} setViewMeetingId={setViewMeetingId}
        meetings={meetings} setMeetings={setMeetings}
        meetingEditMode={meetingEditMode} setMeetingEditMode={setMeetingEditMode}
        meetingEditForm={meetingEditForm} setMeetingEditForm={setMeetingEditForm}
        isRep={isRep} user_role={user_role}
        internalReqs={internalReqs} tasks={tasks} showToast={showToast}
      />
      {/* EDIT INTERNAL REQUEST MODAL */}
      {editIrId && (
        <EditIRModal
          C={C} editIrId={editIrId} irForm={irForm} setIrForm={setIrForm}
          deals={deals} user_role={user_role} setInternalReqs={setInternalReqs}
          BLANK_IR_FORM={BLANK_IR_FORM} showToast={showToast}
          onClose={()=>{setEditIrId(null);setIrForm(BLANK_IR_FORM);}}
        />
      )}
      {/* EXCEPTION REQUEST MODAL */}
      {excReqOpen && (
        <ExceptionRequestModal
          C={C} excReqRecord={excReqRecord} excReqForm={excReqForm} setExcReqForm={setExcReqForm}
          excReqSubmitting={excReqSubmitting} setExcReqSubmitting={setExcReqSubmitting}
          showToast={showToast} fetchAttendanceData={fetchAttendanceData}
          onClose={()=>setExcReqOpen(false)}
        />
      )}
      {/* EXCEPTION MODAL */}
      <ExceptionModal
        C={C} exceptionModal={exceptionModal} exceptionReason={exceptionReason}
        setExceptionReason={setExceptionReason} user_role={user_role}
        grantException={grantException} onClose={()=>setExceptionModal(null)}
      />
      {/* ═══ CLIENT ACCOUNT THREAD MODAL ═══ */}
      {accountThreadOpen && accountThreadClient && (
        <AccountThreadModal
          C={C} accountThreadClient={accountThreadClient}
          deals={deals} touchpoints={touchpoints} clientAccounts={clientAccounts}
          revenueEntries={revenueEntries} meetings={meetings} reps={reps}
          tasks={tasks} internalReqs={internalReqs} setInternalReqs={setInternalReqs}
          setTasks={setTasks} setLogForm={setLogForm} setLogOpen={setLogOpen}
          BLANK_LOG={BLANK_LOG} user_role={user_role} activeUser={activeUser}
          TODAY={TODAY} TOMORROW={TOMORROW}
          threadAIForm={threadAIForm} setThreadAIForm={setThreadAIForm}
          dealStage={dealStage} oColor={oColor} daysSince={daysSince}
          fmtR={fmtR} stackedBar={stackedBar} showToast={showToast}
          onClose={()=>{setAccountThreadOpen(false);setAccountThreadClient(null);}}
        />
      )}

      {/* NOTE MODAL */}
      {noteModal && (
        <NoteModal
          noteModal={noteModal}
          onClose={() => setNoteModal(null)}
        />
      )}

      {/* TOAST */}
      {toast && <div className="fin" style={{position:"fixed",bottom:18,right:18,background:toast.type==="err"?C.red:C.green,color:"#fff",padding:"9px 16px",borderRadius:5,fontWeight:700,fontSize:12,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{toast.msg}</div>}
    </div>
    </CROAppProvider>
  );
}
