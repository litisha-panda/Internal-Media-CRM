// @ts-nocheck
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ZohoSearchInput from "../components/ZohoSearchInput";
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
import { useAttendance } from "../hooks/useAttendance";
import { usePersistedState } from "../hooks/usePersistedState";
import { useApiEntityState } from "../hooks/useApiEntityState";
import { RepDashboard } from "../views/rep/RepDashboard";
import { MyPlan } from "../views/rep/MyPlan";
import { LogMeeting } from "../views/rep/LogMeeting";
import { externalPost } from "../services/api/external";


// Route all Claude API calls through the API server proxy (key stays server-side)
const CLAUDE_PROXY_URL = `${window.location.protocol}//${window.location.hostname}:8080/api/claude`;
const REGIONS   = ["North", "South", "East", "West", "National", "Central"];
const ALL_ROLES = ["SALES REP","REGION HEAD","SALES HEAD","CRO","SALES STRATEGY","DIGI OPS","ADMIN"];
const DEAL_TYPES = ["Linear TV", "IPs", "Digital", "Media Solutions", "Integrated Packages"];
const CONTACT_LEVELS = ["C-Suite / Owner", "VP / GM", "Marketing Head", "Brand Manager", "Agency Lead", "Junior/Exec"];
// Part 3 — canonical deal stages (replaces old OUTCOMES enum)
const DEAL_STAGES = ["Prospect", "In Discussion", "Negotiation", "Mail Confirmed", "RO Received", "Lost"];
// Keep OUTCOMES as legacy alias so old deal records still render until fully migrated
const OUTCOMES = DEAL_STAGES;
const DEPARTMENTS = ["Sales Strategy", "Digital", "Production", "National Head", "Finance", "Legal"];
const REQ_STATUS = ["Pending", "In Progress", "Done", "Overdue"];
const SLA = { "Sales Strategy": 24, "Digital": 24, "Production": 48, "National Head": 12, "Finance": 48, "Legal": 72 };
const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26", "FY26 Annual"];
const STAGE_PROB = { "Prospect": 10, "In Discussion": 40, "Negotiation": 70, "Mail Confirmed": 90, "RO Received": 100, "Lost": 0,
  // legacy mapping so old records still resolve
  "Very Interested": 40, "Interested – Needs Revision": 50, "Price Concern": 30, "Needs Callback": 10, "Not Interested": 0 };
const PITCH_TYPES = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "IPs", "Others"];
const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation", "RO Received"];
const MEETING_TYPES  = ["Physical", "Online", "Phone Call"];
const CLIENT_OR_AGENCY = ["Client", "Agency"];
const TASK_PRIORITIES = ["High", "Medium", "Low"];
const TASK_STATUSES   = ["Open", "In Progress", "Done", "Overdue"];

const APPROVAL_TARGETS = [
  "Region Head",
  "NSH",
  "Branding Team",
  "Content Team",
  "Sales Strategy",
  "Digital",
  "Finance",
  "Legal",
  "CXO",
];
// If approval has been pending more than this many days → auto-escalates
const APPROVAL_SLA_DAYS = 2;

// ── DATE CONSTANTS — must be before any seed data that references them ──
const TODAY    = new Date().toISOString().split("T")[0];
const TOMORROW = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const D1     = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const D3     = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
const D7     = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
const D14    = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

// Live date helpers — call these in handlers/effects so dates stay correct across midnight
const getToday    = () => new Date().toISOString().split("T")[0];
const getTomorrow = () => new Date(Date.now() + 86400000).toISOString().split("T")[0];

const SEED_TASKS: any[] = [];

// Get start of current week (Monday)
function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
const THIS_WEEK_START = getWeekStart(TODAY);

// PLANNING ENGINE
// Rule: By 11:30 PM every night, rep must have:
//   1. Logged today's meetings
//   2. Planned tomorrow's meetings
// Both required. Either missing = absent.
// Weekly plan due by Saturday 11:30 PM.
const PLAN_DEADLINE = "23:30";
const HR_EMAIL = "hr@odishatv.com";

// Plan status
const PLAN_STATUS = ["Planned", "Done", "Cancelled", "Rescheduled"];


const SEED_WEEKLY_PLANS: any[] = [];
const SEED_ABSENCE_REPORTS: any[] = [];
const REPS: any[]              = [];

const USER_ROLES = [
  // FULL ACCESS
  { id: "admin",          name: "Admin",                  role: "ADMIN",          canView: "all",    region: null },
  { id: "sales_head",     name: "Sales Head",             role: "SALES HEAD",     canView: "all",    region: null },
  { id: "sales_strategy", name: "Sachin (Sales Strategy)",role: "SALES STRATEGY", canView: "all",    region: null },
  { id: "sales_analysis", name: "Darpan (CRO)",           role: "CRO",            canView: "all",    region: null },
  { id: "digi_ops",       name: "Digi Ops Team",          role: "DIGI OPS",       canView: "all",    region: null },
  // REGION ACCESS
  { id: "rh_north",       name: "Region Head – North",   role: "REGION HEAD",    canView: "region", region: "North" },
  { id: "rh_south",       name: "Region Head – South",   role: "REGION HEAD",    canView: "region", region: "South" },
  { id: "rh_east",        name: "Region Head – East",    role: "REGION HEAD",    canView: "region", region: "East" },
  { id: "rh_west",        name: "Region Head – West",    role: "REGION HEAD",    canView: "region", region: "West" },
  { id: "rh_national",    name: "Region Head – National",role: "REGION HEAD",    canView: "region", region: "National" },
  { id: "rh_central",     name: "Region Head – Central", role: "REGION HEAD",    canView: "region", region: "Central" },
  // SELF ONLY — NORTH
  { id: "rep_arjun",      name: "Arjun Mishra",          role: "SALES REP",      canView: "self",   region: "North",    repId:  1 },
  { id: "rep_rahul",      name: "Rahul Sharma",          role: "SALES REP",      canView: "self",   region: "North",    repId:  7 },
  { id: "rep_kavya",      name: "Kavya Singh",           role: "SALES REP",      canView: "self",   region: "North",    repId:  8 },
  { id: "rep_manish",     name: "Manish Tiwari",         role: "SALES REP",      canView: "self",   region: "North",    repId:  9 },
  { id: "rep_pooja",      name: "Pooja Agarwal",         role: "SALES REP",      canView: "self",   region: "North",    repId: 10 },
  // SOUTH
  { id: "rep_priya",      name: "Priya Dash",            role: "SALES REP",      canView: "self",   region: "South",    repId:  2 },
  { id: "rep_meera",      name: "Meera Rao",             role: "SALES REP",      canView: "self",   region: "South",    repId:  6 },
  { id: "rep_suresh",     name: "Suresh Reddy",          role: "SALES REP",      canView: "self",   region: "South",    repId: 11 },
  { id: "rep_ananya",     name: "Ananya Krishnan",       role: "SALES REP",      canView: "self",   region: "South",    repId: 12 },
  { id: "rep_karthik",    name: "Karthik Iyer",          role: "SALES REP",      canView: "self",   region: "South",    repId: 13 },
  // EAST
  { id: "rep_rohit",      name: "Rohit Nanda",           role: "SALES REP",      canView: "self",   region: "East",     repId:  3 },
  { id: "rep_sanjay",     name: "Sanjay Mohanty",        role: "SALES REP",      canView: "self",   region: "East",     repId: 14 },
  { id: "rep_debasmita",  name: "Debasmita Das",         role: "SALES REP",      canView: "self",   region: "East",     repId: 15 },
  { id: "rep_bikash",     name: "Bikash Pradhan",        role: "SALES REP",      canView: "self",   region: "East",     repId: 16 },
  { id: "rep_rina",       name: "Rina Panda",            role: "SALES REP",      canView: "self",   region: "East",     repId: 17 },
  // WEST
  { id: "rep_sneha",      name: "Sneha Patel",           role: "SALES REP",      canView: "self",   region: "West",     repId:  4 },
  { id: "rep_varun",      name: "Varun Mehta",           role: "SALES REP",      canView: "self",   region: "West",     repId: 18 },
  { id: "rep_divya",      name: "Divya Joshi",           role: "SALES REP",      canView: "self",   region: "West",     repId: 19 },
  { id: "rep_amit_d",     name: "Amit Desai",            role: "SALES REP",      canView: "self",   region: "West",     repId: 20 },
  { id: "rep_preethi",    name: "Preethi Shah",          role: "SALES REP",      canView: "self",   region: "West",     repId: 21 },
  // NATIONAL
  { id: "rep_vikram",     name: "Vikram Sen",            role: "SALES REP",      canView: "self",   region: "National", repId:  5 },
  { id: "rep_neha",       name: "Neha Kapoor",           role: "SALES REP",      canView: "self",   region: "National", repId: 22 },
  { id: "rep_rajesh_m",   name: "Rajesh Malhotra",       role: "SALES REP",      canView: "self",   region: "National", repId: 23 },
  { id: "rep_shreya",     name: "Shreya Bose",           role: "SALES REP",      canView: "self",   region: "National", repId: 24 },
  { id: "rep_aditya",     name: "Aditya Kumar",          role: "SALES REP",      canView: "self",   region: "National", repId: 25 },
  // CENTRAL
  { id: "rep_sameer",     name: "Sameer Nayak",          role: "SALES REP",      canView: "self",   region: "Central",  repId: 26 },
  { id: "rep_lipika",     name: "Lipika Mishra",         role: "SALES REP",      canView: "self",   region: "Central",  repId: 27 },
  { id: "rep_pratap",     name: "Pratap Rath",           role: "SALES REP",      canView: "self",   region: "Central",  repId: 28 },
  { id: "rep_sunita",     name: "Sunita Sahoo",          role: "SALES REP",      canView: "self",   region: "Central",  repId: 29 },
  { id: "rep_debadatta",  name: "Debadatta Patra",       role: "SALES REP",      canView: "self",   region: "Central",  repId: 30 },
];

const SEED_PROPERTIES: any[] = [];

const IP_CATALOG: any[] = [];

// Target approval chain: Draft → Pending RH → Pending NSH → Pending Strategy → Pending CRO → Approved
const TARGET_APPROVAL_CHAIN = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO","Approved"];

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = { bg:"#f0f4f9", surface:"#ffffff", s2:"#e8eef7", s3:"#dde5f0", border:"#c8d3e5", accent:"#c47d00", green:"#15803d", red:"#c92828", blue:"#1d5db4", purple:"#7920e8", orange:"#c24000", text:"#18243a", dim:"#4d5e78", muted:"#8a97ae" };

const fmt = (n) => { if (n == null || n === "") return "—"; if (n===0) return "0"; if (n>=10000000) return `${(n/10000000).toFixed(1)}Cr`; if (n>=100000) return `${(n/100000).toFixed(1)}L`; return `${(n/1000).toFixed(0)}K`; };
const fmtR = (n) => (n == null || n === "") ? "—" : `₹${fmt(n)}`;
const daysSince = (d) => { if (!d) return 999; return Math.floor((Date.now()-new Date(d).getTime())/86400000); };
// Part 1: helper to read stage from either new `stage` field or legacy `outcome` field
const dealStage = (d) => d.stage || d.outcome || "Prospect";
// Part 3: oColor supports both new and legacy stage values
const oColor = (o) => ({
  "Prospect": C.muted, "In Discussion": C.blue, "Negotiation": C.accent,
  "Mail Confirmed": C.green, "RO Received": "#0f6b2f", "Lost": C.red,
  // legacy
  "Very Interested": C.blue, "Interested – Needs Revision": C.accent,
  "Price Concern": C.orange, "Needs Callback": C.blue, "Not Interested": C.muted,
}[o] || C.dim);
const riskColor = (d) => { const s=dealStage(d); if (s==="Lost") return C.muted; if (s==="Mail Confirmed"||s==="RO Received") return C.green; const x=daysSince(d.lastDealMeetingDate||d.lastContact); return x>=7?C.red:x>=3?C.orange:C.green; };
const riskLabel = (d) => { const s=dealStage(d); if (s==="Lost") return "Lost"; if (s==="RO Received") return "Closed"; if (s==="Mail Confirmed") return "Committed"; if (d.atRisk) return "At Risk"; const x=daysSince(d.lastDealMeetingDate||d.lastContact); return x>=7?"At Risk":x>=3?"Cooling":"Active"; };
const lColor = (l) => ({ "C-Suite / Owner":C.purple, "VP / GM":C.blue, "Marketing Head":C.green, "Brand Manager":C.accent, "Agency Lead":"#6366f1", "Junior/Exec":C.red }[l]||C.dim);
// Part 1: map legacy outcome values → new canonical stage (used during migration and legacy rendering)
const mapLegacyOutcome = (o: string): string => ({
  "Mail Confirmed": "Mail Confirmed", "Very Interested": "In Discussion",
  "Interested – Needs Revision": "Negotiation", "Proposal Shared": "Negotiation",
  "Negotiation": "Negotiation", "Price Concern": "Negotiation",
  "Needs Callback": "Prospect", "Not Interested": "Lost",
  "Prospect": "Prospect", "In Discussion": "In Discussion",
  "RO Received": "RO Received", "Lost": "Lost",
}[o] || "Prospect");
// Simple unique ID generator — avoids dependency on nanoid
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

// ═══════════════════════════════════════════════════════════════════
// RO PARSER ENGINE — full v9.5 embedded
// ═══════════════════════════════════════════════════════════════════
const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let _xlsxLoaded = false, _xlsxPromise = null;
function loadXLSX() {
  if (_xlsxLoaded) return Promise.resolve(window.XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = XLSX_CDN;
    s.onload = () => { _xlsxLoaded = true; res(window.XLSX); };
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
  if(!my&&r.start_date){try{const d=new Date(r.start_date);if(!isNaN(d))my=d.toLocaleDateString("en-IN",{month:"short",year:"numeric"});}catch(e){}}
  return [client,agency,ch,my].filter(Boolean).join(" - ");
}
function roMakeSheet(wb,name,rows){
  if(!rows||(Array.isArray(rows)&&!rows.length))return;
  const ws=window.XLSX.utils.json_to_sheet(Array.isArray(rows)?rows:[rows]);
  ws["!cols"]=Array(50).fill({wch:18}); window.XLSX.utils.book_append_sheet(wb,ws,name);
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

function ROFieldCard({label,value,highlight,warn}){
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
function ZohoHierarchy({r,exp}){
  const ch=roNormalizeChannel(r.channel||"");
  const company=RO_CHANNEL_COMPANY[ch]||"Odisha Television Ltd";
  const dealType=roDetectDealType(r);
  const dtColor=dealType==="IPs"?"#f0a500":dealType==="Impact"?"#f97316":"#a855f7";
  const chValid=ALL_CHANNELS.includes(ch); const m=exp.meta;
  return(
    <div style={{background:"#080a0f",border:"1px solid #1e2d3d",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
      <div style={{fontSize:10,fontWeight:700,color:"#2a3a4d",textTransform:"uppercase",letterSpacing:".08em",marginBottom:9}}>Zoho Routing</div>
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
      {!chValid&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:6,padding:"7px 11px",fontSize:11,color:"#fca5a5"}}>⚠ "{ch}" not in Zoho channel list. Valid: {ALL_CHANNELS.join(" · ")}</div>}
      <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"7px 11px",fontSize:11,color:"#16c784",marginTop:7}}>
        ⚠ <strong>Contract Type</strong> and <strong>Secondary Type</strong> left blank — select in Zoho. <strong>Timeband Name</strong> pre-filled from RO — verify against Zoho pre-feed list.
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
        <button onClick={()=>onExport(result)} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"8px 22px",borderRadius:7,cursor:"pointer",fontWeight:700,fontSize:13}}>Export to Zoho</button>
        {onPushToPipeline && (
          <button onClick={()=>onPushToPipeline(result)} style={{background:"linear-gradient(135deg,#16c784,#0ea570)",color:"#fff",border:"none",padding:"8px 22px",borderRadius:7,cursor:"pointer",fontWeight:700,fontSize:13}}>⬡ Push to Pipeline</button>
        )}
        <span style={{color:"#7d8590",fontSize:11}}>Deal + Breakup + Summary sheets</span>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #1e2d3d",overflowX:"auto"}}>
        {tabs.map(t=>{const a=activeTab===t.id;return<button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"9px 16px",background:"transparent",border:"none",color:a?"#a855f7":"#7d8590",fontWeight:a?700:400,fontSize:12,cursor:"pointer",borderBottom:a?"2px solid #a855f7":"2px solid transparent",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>{t.label}</button>;})}
      </div>
      <div style={{padding:16}}>
        {activeTab==="deal"&&<div><ZohoHierarchy r={result} exp={exp} /><div style={{fontSize:10,fontWeight:700,color:"#7d8590",textTransform:"uppercase",marginBottom:7,letterSpacing:".08em"}}>Deal Form Fields</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:7}}>{Object.entries(exp.dealRow).filter(([,v])=>v).map(([k,v])=><ROFieldCard key={k} label={k} value={String(v)} highlight={k==="Deal Name"||k==="Advertiser"} warn={k==="Commission"&&v==="AGENCY BILLING ON NET"} />)}</div></div>}
        {activeTab==="breakup"&&<div><div style={{background:"#1a1a0a",border:"1px solid #854d0e",borderRadius:6,padding:"7px 11px",marginBottom:10,fontSize:11,color:"#f0a500"}}>⚠ Contract Type and Secondary Type blank — fill in Zoho directly.</div><ROTableView rows={exp.breakupRows} /></div>}
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
        const wb=XLSX.read(e.target.result,{type:"array",cellFormula:false,cellNF:false,raw:false});
        let text="";
        wb.SheetNames.forEach(n=>{text+="\n=== Sheet: "+n+" ===\n";text+=XLSX.utils.sheet_to_csv(wb.Sheets[n]);});
        res(text);
      }catch(err){rej(err);}
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
        const b64=r.result.split(",")[1];
        const block=file.type==="application/pdf"?{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}:{type:"image",source:{type:"base64",media_type:file.type,data:b64}};
        res([{role:"user",content:[block,{type:"text",text:"Parse this TV Release Order. Extract ALL items. If multiple channels return JSON ARRAY one object per channel."}]}]);
      };
      r.readAsDataURL(file);
    });
  }
  return new Promise(res=>{const r=new FileReader();r.onload=()=>res([{role:"user",content:"Parse this TV RO. If multiple channels return JSON array:\n\n"+r.result}]);r.readAsText(file);});
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
function roCancelParse() { if (_roAbortCtrl) { _roAbortCtrl.abort(); _roAbortCtrl = null; } }

async function roCallAPI(msgs) {
  roCancelParse();
  _roAbortCtrl = new AbortController();
  const tid = setTimeout(() => { if (_roAbortCtrl) _roAbortCtrl.abort(); }, 120000);
  try {
    const resp = await fetch("/api/claude", {
      method: "POST",
      signal: _roAbortCtrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:16000, system:RO_PROMPT, messages:msgs })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return (data.content || []).map(b => b.text || "").join("").trim();
  } catch(err) {
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
const ZOHO_CLIENT_ID   = "1000.TQ0C2M1CLOJC0ES8EPEJJWG5LUJ9ON";

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
      {title:"Adding & Updating Deals", desc:"Click '+ Add Deal' to create a new pipeline entry. Fill in client, deal type, quarter, and target amount. Stage advances automatically when you log a Deal Meeting touchpoint — Prospect → In Discussion → Negotiation → Mail Confirmed.", nav:"pipeline", target:"content-area", tip:"Deal types: Linear TV = air-time, IPs = integrated properties, Media Solutions = branded content. Ask your RH if unsure."},
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
      {title:"Revenue Tracker", desc:"Full national pipeline. Filter by region, rep, deal type, stage, or quarter. Mail Confirmed deals are your committed revenue; In Discussion and Negotiation show what's in play.", nav:"pipeline"},
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
      {title:"Revenue Tracker", desc:"Full national pipeline — sort by amount, region, stage, or quarter. Mail Confirmed = committed revenue. In Discussion and Negotiation = in play. RO Received = achieved.", nav:"pipeline"},
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
export function CROApp({ user, onLogout, section, onGoHome }) {
  // T009: Correct CRM landing per role
  const getCRMDefaultView = () => {
    if (section === "ro") return "ro-parser";
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

  // ── DATA STATE — CROApp now owns all entity state (no prop drilling) ──────

  // Deals: API-backed state owned directly by CROApp
  const [deals, setDeals] = useApiEntityState("/api/deals", "otv_deals", []);

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
      const seeded = settled.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
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
      const diff = dl - now;
      if (diff <= 0) { setCountdown("11:30 PM passed"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m left`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  const [absenceReports, setAbsenceReports] = usePersistedState("otv_absence", SEED_ABSENCE_REPORTS);
  const [exceptionModal, setExceptionModal] = useState(null); // { reportId, repName }
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
  const [toast, setToast]         = useState(null);
  const [noteModal, setNoteModal] = useState(null);   // {title, placeholder, onSubmit}
  const [noteModalVal, setNoteModalVal] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const { tasks, setTasks, isLoading: tasksLoading, syncError: tasksError } = useTasks(!!user);
  const [taskModal, setTaskModal]       = useState(false);
  const [selfTaskMode, setSelfTaskMode] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const importRef = useRef();
  // My Plan calendar state — must be at component level (React hooks rule)
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calDayView, setCalDayView]       = useState<string|null>(null); // date string "YYYY-MM-DD"
  const [myPlanTab,  setMyPlanTab]        = useState<"plan"|"log">("plan"); // My Plan sub-tabs
  const [addPlanFor, setAddPlanFor]       = useState(null);
  const [planForm, setPlanForm]           = useState({agency:"",client:"",brand:"",contactName:"",phone:"",time:"10:00",agenda:"",pitchType:"",meetingType:"Physical",touchpointType:"Deal Meeting",meetingKind:"ACTIONABLE",needsMeet:false,syncToCalendar:false,calPlatform:"google"});
  const [planEditId, setPlanEditId]       = useState<string|null>(null);
  const [planEditForm, setPlanEditForm]   = useState({time:"",clientAgencyName:"",contactName:"",phone:"",agenda:"",pitchType:""});
  const [loginProvider, setLoginProvider] = useState<"google"|"zoho"|"demo">("demo");
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
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement|null;
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
  const BLANK_DEAL = { clientCompany:"", zohoAccountId:"", repId:"", clientAccountId:"", contactName:"", designation:"", contactLevel:"", phone:"", email:"", dealType:"", outcome:"Prospect", stage:"Prospect", amount:"", pipelineAmount:"", targetAmount:"", lossReason:"", priority:"Regular", quarter:"Q1 FY26", notes:"", nextStep:"", nextStepDate:"", agencyName:"", zohoAgencyId:"", reqs:[], auditLog:[] };
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
  const [zohoImporting, setZohoImporting]         = useState(false);
  const [zohoAccounts, setZohoAccounts]           = useState<string[]>([]);
  const [zohoError, setZohoError]                 = useState<string|null>(null);
  const [zohoSearchQ, setZohoSearchQ]             = useState("");

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
  const [roFiles, setRoFiles]         = useState([]);
  const [roInputText, setRoInputText] = useState("");
  const [roLoading, setRoLoading]     = useState(false);
  const [roResults, setRoResults]     = useState([]);
  const [roActiveDoc, setRoActiveDoc] = useState(0);
  const [roError, setRoError]         = useState(null);
  const [roProgress, setRoProgress]   = useState("");
  const [roSearch, setRoSearch]       = useState("");
  const [savedROs, setSavedROs]       = usePersistedState("otv_savedROs", []);
  const roFileRef = useRef();

  // RO MANAGEMENT STATE
  const [roMgmtChannel, setRoMgmtChannel]           = useState("all");
  const [roMgmtStatus, setRoMgmtStatus]             = useState("all");
  const [roMgmtViewRO, setRoMgmtViewRO]             = useState(null);
  const [roMgmtConfirmDelete, setRoMgmtConfirmDelete] = useState(null);
  const [properties, setProperties]                   = usePersistedState("otv_properties", SEED_PROPERTIES);
  const [ipProposals, setIpProposals]                  = usePersistedState("otv_ipProposals", []);
  const [ipPropOpen, setIpPropOpen]                    = useState<string|null>(null); // "ipId-elemId"
  const [ipPropClient, setIpPropClient]                = useState("");
  const [ipPropNote, setIpPropNote]                    = useState("");
  const [ipPropValue, setIpPropValue]                  = useState("");
  const [ipApprovalPrices, setIpApprovalPrices]        = useState<Record<string,string>>({});
  const [internalReqs, setInternalReqs, , irError]            = useApiEntityState("/api/internal-requests", "otv_internalReqs", []);
  const [irStatusFilter, setIrStatusFilter]                   = useState("all");
  const [lbTab, setLbTab]                                     = useState("team");
  const [targetSubs, setTargetSubs, targetLoading, targetError] = useApiEntityState("/api/targets",        "otv_targetSubs",      []);
  const [revenueEntries, setRevenueEntries, revLoading, revError] = useApiEntityState("/api/revenue",      "otv_revenueEntries",  []);
  // ── Part 1: New data model objects ──────────────────────────────────────
  const [clientAccounts, setClientAccounts, , caError] = useApiEntityState("/api/client-accounts", "otv_clientAccounts", []);
  const { touchpoints, setTouchpoints, syncError: tpError } = useTouchpoints(!!user);

  // Part 1: One-time migration — runs when clientAccounts is empty but deals/meetings exist
  useEffect(() => {
    if (clientAccounts.length > 0) return; // already migrated
    if (deals.length === 0 && meetings.length === 0) return; // nothing to migrate
    const accountMap: Record<string, any> = {}; // key: `${clientCompany}|${repId}`
    deals.forEach(d => {
      const key = `${d.clientCompany}|${d.repId}`;
      if (!accountMap[key]) {
        const rep = USER_ROLES.find(r => r.repId === d.repId);
        accountMap[key] = {
          id: uid(), clientName: d.clientCompany, repId: d.repId,
          zohoAccountId: d.zohoAccountId || "",
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
        stageUpdate: mapLegacyOutcome(m.outcome || "Prospect"),
        actionItems: m.actionItems || [],
        loggedAt: m.loggedAt || m.date, loggedLate: m.loggedLate || false,
        loggedByUserId: m.loggedByUserId || String(m.repId),
      };
    }).filter(t => t.clientAccountId);
    if (newTouchpoints.length > 0) setTouchpoints(newTouchpoints);
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
  const getAchieved   = (repId?: number, fy = CURRENT_FY) =>
    revenueEntries.filter(e => (repId == null || e.repId === repId) && (e.fiscalYear === fy || fy === "all")).reduce((s, e) => s + (parseCurrency(e.amount||"0")||0), 0);
  // COMMITTED = clientAccounts at Mail Confirmed stage (per spec: read annualTarget from clientAccounts, never from deals.amount)
  const getCommitted  = (repId?: number) =>
    clientAccounts.filter(a => (repId == null || a.repId === repId) && a.currentStage === "Mail Confirmed").reduce((s, a) => s + (a.annualTarget||0), 0);
  // IN PLAY = clientAccounts at In Discussion or Negotiation stage
  const getInPlay     = (repId?: number) =>
    clientAccounts.filter(a => (repId == null || a.repId === repId) && ["In Discussion","Negotiation"].includes(a.currentStage||"")).reduce((s, a) => s + (a.annualTarget||0), 0);
  const getShortfall  = (target: number, repId?: number) => Math.max(0, target - getAchieved(repId) - getCommitted(repId) - getInPlay(repId));

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
  const getAnnualTarget = (repId?: number) => {
    const subs = targetSubs.filter(s => (repId == null || s.repId === repId) && s.status === "Approved");
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
  const [addClientForm, setAddClientForm]               = useState({clientCompany:"",zohoAccountId:"",dealType:"Linear TV",targetAmount:""});
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
  const [planUploadForm, setPlanUploadForm]             = useState<{repId:string,quarter:string,clients:{clientCompany:string,dealType:string,targetAmount:string}[]}>({repId:"",quarter:"Q1 FY26",clients:[{clientCompany:"",dealType:"Linear TV",targetAmount:""}]});
  const [editSubId, setEditSubId]                       = useState(null);
  const [editSubClients, setEditSubClients]             = useState([]);
  const [revForm, setRevForm]                           = useState({clientCompany:"",zohoAccountId:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:"",notes:""});
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
  const searchRef                       = useRef(null);

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
      const parsed=[];
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
    }catch(err){setRoError(roFriendlyError(err));}
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
    XLSX.writeFile(wb,(r.client_name||"ro").replace(/[^a-zA-Z0-9]/g,"_")+"_Zoho.xlsx");
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
    setDealForm(prefilled);
    setAddDealOpen(true);
    showToast(`RO pre-filled → deal form opened ✓`);
  };

  const roExportAll = async () => {
    if(!roResults.length)return;
    const XLSX=await loadXLSX();
    const wb=XLSX.utils.book_new();
    const allDeals=[],allBreakup=[],allSummary=[];
    roResults.forEach(r=>{const exp=roBuildExport(r);allDeals.push(exp.dealRow);allBreakup.push(...exp.breakupRows);allSummary.push(exp.summaryRow);});
    roMakeSheet(wb,"Deals",allDeals);roMakeSheet(wb,"Deal Breakup",allBreakup);roMakeSheet(wb,"Summary",allSummary);
    XLSX.writeFile(wb,"All_Deals_Zoho.xlsx");
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
    const alreadyFiled = absenceReports.find(r => r.repId === rep.id && r.date === date);
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
        const alreadyFiled = absenceReports.find(r => r.repId === rep.id && r.date === TODAY);
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
    const myRep = reps.find((r:any) => r.id === myRepId || r.repId === myRepId);
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
      setTasks(prev => prev.map(t => {
        if (!t.dueDate || t.dueDate >= TODAY) return t;
        if (!["Open","Escalated"].includes(t.status||"Open")) return t;
        const level = t.escLevel||0;
        const escAt = t.escAt ? new Date(t.escAt).getTime() : new Date(t.dueDate).getTime() + 12*3600000;
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
        if (new Date(r.escalationAt).getTime()>=now) return r;
        const level = r.escLevel||0;
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
      setAbsenceReports((prev:any[])=>[...prev,...toMark.map(day=>({
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
  const visibleDeals = deals.filter(d => {
    const regionOk = user_role.canView==="all" ? (filterRegion==="All"||d.region===filterRegion) : user_role.canView==="region" ? d.region===user_role.region : d.repId===user_role.repId;
    return regionOk && qMatch(d.quarter);
  });

  // Revenue Tracker: group visibleDeals by client
  const rtClientMap = {};
  visibleDeals.forEach(d=>{
    if(!rtClientMap[d.clientCompany]) rtClientMap[d.clientCompany]={
      clientCompany:d.clientCompany, repId:d.repId, lastContact:d.lastContact,
      deals:[], fct:0, digital:0, integrated:0, sponsorship:0, branded:0, total:0, target:0
    };
    const c = rtClientMap[d.clientCompany];
    c.deals.push(d);
    c.target += (d.targetAmount||0);
    if(d.outcome==="Mail Confirmed"){
      if(d.dealType==="Linear TV") c.fct += d.amount;
      else if(d.dealType==="Digital") c.digital += d.amount;
      else if(d.dealType==="Integrated Packages") c.integrated += d.amount;
      else if(d.dealType==="IPs") c.sponsorship += d.amount;
      else if(d.dealType==="Media Solutions") c.branded += d.amount;
      c.total += d.amount;
    }
    if(!c.lastContact||d.lastContact>c.lastContact) c.lastContact=d.lastContact;
  });
  const rtClients = Object.values(rtClientMap).sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact));

  const closedDeals  = visibleDeals.filter(d=>d.outcome==="Mail Confirmed");
  const activeDeals  = visibleDeals.filter(d=>d.outcome!=="Not Interested");
  // Bug 5 fix: CLOSED QTD in War Room must equal sum of actual revenue entries, not deal pipeline amounts.
  // We determine visible reps from visibleDeals, then sum their revenue entries for the current quarter.
  const visibleRepIdsSet = new Set(visibleDeals.map(d=>d.repId));
  const closedRevenue = revenueEntries.filter(e => visibleRepIdsSet.has(e.repId) && qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
  // Part 4: at-risk = clientAccounts (spec: In Discussion / Negotiation / Mail Confirmed, 7+ days since last DEAL meeting)
  const atRisk       = clientAccounts.filter(a => visibleRepIdsSet.has(a.repId) && ["In Discussion","Negotiation","Mail Confirmed"].includes(a.currentStage||"") && daysSince(a.lastDealMeetingDate||a.lastContactDate) >= 7);
  const overdueNext  = activeDeals.filter(d=>d.nextStepDate && d.nextStepDate<TODAY && d.outcome!=="Mail Confirmed");
  const allReqs      = deals.flatMap((d,_)=>d.reqs.map((r,i)=>({...r,dealId:d.id,reqIdx:i,clientCompany:d.clientCompany,amount:d.amount,repId:d.repId})));
  const todayMtgs    = meetings.filter(m=>m.date===TODAY);

  const totalTarget  = visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
  const weightedPipe = activeDeals.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
  const forecast     = closedRevenue+weightedPipe;
  const gap          = Math.max(0,totalTarget-forecast);
  const closePct     = totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0;
  const fcastPct     = totalTarget>0?Math.round((forecast/totalTarget)*100):0;

  const repScores = useMemo(() => reps
    .filter(r => user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId)
    .map(rep => {
      const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
      const closed  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
      const pipe    = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
      const rm      = meetings.filter(m=>m.repId===rep.id);
      const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
      const risk    = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
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
        ? deals.filter(d=>d.region===myRegion)
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

    const out = [];
    scopedDeals.filter(d =>
      d.clientCompany?.toLowerCase().includes(q) ||
      d.contactName?.toLowerCase().includes(q) ||
      d.notes?.toLowerCase().includes(q)
    ).slice(0, 5).forEach(d => out.push({ type:"deal", label:d.clientCompany, sub:`${d.outcome} · ${fmtR(d.amount)}`, action:()=>{ setView(dealView); setGlobalSearch(""); setSearchOpen(false); } }));
    scopedMeetings.filter(m =>
      m.clientCompany?.toLowerCase().includes(q) ||
      m.discussion?.toLowerCase().includes(q) ||
      m.contactName?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(m => out.push({ type:"meeting", label:m.clientCompany, sub:`${m.date} · ${(m.discussion||"").slice(0,55)}`, action:()=>{ setView(meetingView); setGlobalSearch(""); setSearchOpen(false); } }));
    scopedTasks.filter(t =>
      t.clientCompany?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(t => out.push({ type:"task", label:t.title, sub:t.clientCompany, action:()=>{ setView(taskView); setGlobalSearch(""); setSearchOpen(false); } }));
    return out.slice(0, 8);
  }, [globalSearch, deals, meetings, tasks, user_role, reps, activeUser,
      isRep, isRH, isNSH, isStrategy, isCRORole, isDigiOps, isAdmin]);

  const updateOutcome = (id, outcome) => {
    const closed = outcome === "Mail Confirmed";
    setDeals(p => p.map(d => {
      if (d.id !== id) return d;
      const entry  = closed && d.awaitingApproval ? [{
        at: TODAY, by: user_role?.name||"Manager", role: user_role?.role||"",
        action: "Closed", from: d.awaitingApproval, to: null, note: "Deal closed — approval cleared",
      }] : [];
      return {
        ...d, outcome, lastContact: TODAY,
        awaitingApproval:      closed ? null : d.awaitingApproval,
        awaitingApprovalSince: closed ? null : d.awaitingApprovalSince,
        atRisk: closed ? false : d.atRisk,
        auditLog: [...(d.auditLog||[]), ...entry],
      };
    }));
    if (closed) {
      const deal = deals.find(d => d.id === id);
      if (deal) {
        pushNotification({ event: "deal_closed", client: deal.clientCompany, amount: deal.amount, rep: deal.repName, message: `Deal won: ${deal.clientCompany} — ${fmtR(deal.amount)}` });
        showToast(`Deal marked won: ${deal.clientCompany}. Log the booked amount in Revenue Log.`);
      }
    }
  };
  const updateReq     = (dealId, reqIdx, status) => setDeals(p=>p.map(d=>d.id===dealId?{...d,reqs:d.reqs.map((r,i)=>i===reqIdx?{...r,status}:r)}:d));

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
    setDeals(p=>[...p,{id:newDealId,...dealForm,repId:parsedRepId,repName:rep.name,region:rep.region,amount:parseCurrency(dealForm.amount||dealForm.targetAmount),targetAmount:tgtAmt,lastContact:TODAY,reqs:[]}]);
    // Upsert clientAccount so the new deal has a linked account with its Zoho ID
    setClientAccounts(prev => {
      const existing = prev.find(a => a.clientName === dealForm.clientCompany.trim() && a.repId === parsedRepId);
      if (existing) {
        if (!existing.zohoAccountId && dealForm.zohoAccountId) {
          return prev.map(a => a.id === existing.id ? {...a, zohoAccountId: dealForm.zohoAccountId, updatedAt: TODAY} : a);
        }
        return prev;
      }
      const newAcct = {
        id: uid(), clientName: dealForm.clientCompany.trim(), repId: parsedRepId,
        zohoAccountId: dealForm.zohoAccountId || "",
        region: rep.region || "", fiscalYear: CURRENT_FY,
        annualTarget: tgtAmt, currentStage: mapLegacyOutcome(dealForm.outcome||"Prospect"),
        lastContactDate: TODAY, lastDealMeetingDate: TODAY,
        createdAt: TODAY, updatedAt: TODAY,
      };
      // Link the new deal to this account
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
      const existingSub = targetSubs.find(s=>s.repId===parsedRepId&&s.quarter===dealQ&&s.status===initStatus&&s.status!=="Approved"&&s.submittedByRole===user_role?.role);
      if (existingSub) {
        setTargetSubs(p=>p.map(s=>s.id===existingSub.id?{...s,clients:[...s.clients,newEntry],totalTarget:s.totalTarget+tgtAmt}:s));
      } else {
        setTargetSubs(p=>[...p,{
          id:`ts${Date.now()}`,
          repId:parsedRepId,repName:rep.name,region:rep.region,
          quarter:dealQ,clients:[newEntry],totalTarget:tgtAmt,
          // Freeze immediately if auto-approved at CRO level
          ...(initStatus==="Approved" ? {frozenTarget: tgtAmt} : {}),
          status:initStatus,submittedAt:TODAY,
          submittedByName:user_role?.name||"",submittedByRole:user_role?.role||"",
          approvalLog:skipLog,
        }]);
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

  const approveDeal = (dealId, note = "") => {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const next  = getApprovalChainNext(d.awaitingApproval, d.amount);
      const entry = {
        at:       TODAY,
        by:       user_role?.name || "Unknown",
        role:     user_role?.role || "",
        action:   "Approved",
        from:     d.awaitingApproval,
        to:       next,
        note,
      };
      return {
        ...d,
        awaitingApproval:      next,
        awaitingApprovalSince: next ? TODAY : null,
        auditLog:              [...(d.auditLog || []), entry],
      };
    }));
    const d = deals.find(x => x.id === dealId);
    const next = d ? getApprovalChainNext(d.awaitingApproval, d.amount) : null;
    showToast(next ? `Approved → forwarded to ${next}` : "Deal fully approved ✓");
    if (d) pushNotification({ event: next ? "deal_approval_advanced" : "deal_fully_approved", client: d.clientCompany, amount: d.amount, approvedBy: user_role?.name, next, message: next ? `${d.clientCompany} approval forwarded to ${next}` : `${d.clientCompany} fully approved — ${fmtR(d.amount)}` });
  };

  const rejectDeal = (dealId, note = "") => {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const entry = {
        at:     TODAY,
        by:     user_role?.name || "Unknown",
        role:   user_role?.role || "",
        action: "Rejected",
        from:   d.awaitingApproval,
        to:     null,
        note,
      };
      return {
        ...d,
        awaitingApproval:      null,
        awaitingApprovalSince: null,
        outcome:               "Price Concern",
        auditLog:              [...(d.auditLog || []), entry],
      };
    }));
    showToast("Deal rejected — rep notified");
  };

  // ── BADGE COUNTS ──
  const rhEscBadge = deals.filter(d=>d.awaitingApproval==="NSH"&&daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length||null;
  const escBadge   = allReqs.filter(r=>r.status==="Overdue").length||null;
  const hrBadge    = absenceReports.filter(r=>r.markedAs==="Absent"&&r.status==="Sent to HR").length||null;
  const rhRegion   = user_role?.region;
  const rhApprovalBadge = isRH?(targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length+internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval").length)||null:null;
  const rhTaskBadge    = isRH ? tasks.filter(t=>t.assignedToUserId===activeUser&&t.status!=="Done").length||null : null;
  const rhDashBadge    = isRH ? (()=>{
    const _myRepIdsDB = reps.filter(r=>r.region===rhRegion).map(r=>r.id);
    const notLoggedDB = _myRepIdsDB.filter(id=>!(meetings||[]).some(m=>m.repId===id&&m.date===TODAY)).length;
    const pendingAppDB= (targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length+internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval").length);
    return (notLoggedDB+pendingAppDB)||null;
  })() : null;

  const myRepTaskBadge = isRep
    ? tasks.filter(t=>(t.assignedToUserId===activeUser||t.assignedTo===user_role?.repId)&&t.status!=="Done").length||null
    : tasks.filter(t=>t.status!=="Done").length||null;

  // ── SECTIONED NAV BUILDER ──
  const N = (id,label,icon,badge=null) => ({id,label,icon,badge});
  const getSidebarSections = () => {
    if (section === "ro") return [];

    const irBadge      = internalReqs.filter(r=>r.status!=="Done"&&r.raisedBy===activeUser).length||null;
    const irInboxDept  = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":isDigiOps?"Digital":null;
    const irInboxBadge = irInboxDept
      ? internalReqs.filter(r=>r.status!=="Done"&&r.dept===irInboxDept).length||null
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
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||null),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending NSH").length||null),
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
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||null),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending Strategy").length||null),
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
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||null),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending CRO").length||null),
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
        N("digi-tasks","My Tasks","✓",tasks.filter(t=>t.dept==="Digital"&&t.status!=="Done").length||null),
        N("digi-projects","Digital Projects","◈"),
      ]},
      { label:"PIPELINE",    items:[N("pipeline","Revenue Tracker","◈")] },
      { label:"APPROVALS",   items:[N("internal-requests","Internal Requests","⬆",irInboxBadge)] },
      { label:"LEADERBOARD", items:[N("leaderboard","Leaderboard","◇")] },
    ];

    // ── ADMIN ──
    if (isAdmin) return [
      { label:"ACCESS",    items:[N("admin-access","Access Management","◎",pendingUsers.length||null)] },
      { label:"PLATFORM",  items:[N("import","Target Import","⬆"), N("admin-config","Platform Config","⚙")] },
      { label:"MONITOR",   items:[N("warroom","War Room","⬡"), N("pipeline","Revenue Tracker","◈")] },
      { label:"APPROVALS", items:[N("admin-approvals","Approval Queue","✦",internalReqs.filter(r=>r.status==="Pending"||r.status==="Overdue").length||null)] },
    ];

    // Fallback — should never reach here but prevents blank screen
    return [
      { label:"CRM", items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||null),
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

  return (
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
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {/* Back to home */}
          <button onClick={onGoHome} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:5,transition:"border-color .15s,color .15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
            ← Home
          </button>
          <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:3}}>OTV</span>
          <span style={{color:C.muted}}>|</span>
          <span className="sans" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:2,textTransform:"uppercase"}}>{section==="ro"?"RO Management":section==="crm"?"CRM":"CRO Platform"}</span>
        </div>

        {/* ── GLOBAL SEARCH ── */}
        {!isMobile && (
          <div ref={searchRef} style={{position:"relative",flex:1,maxWidth:320,margin:"0 16px"}}>
            <div style={{position:"relative",display:"flex",alignItems:"center"}}>
              <span style={{position:"absolute",left:9,color:C.dim,fontSize:13,pointerEvents:"none"}}>⌕</span>
              <input
                value={globalSearch}
                onChange={e=>{setGlobalSearch(e.target.value);setSearchOpen(true);}}
                onFocus={()=>setSearchOpen(true)}
                onBlur={()=>setTimeout(()=>setSearchOpen(false),150)}
                placeholder="Search clients, deals, tasks…"
                style={{width:"100%",background:C.s2,border:`1px solid ${globalSearch?C.accent:C.border}`,borderRadius:6,padding:"5px 10px 5px 28px",fontSize:11,color:C.text,fontFamily:"'DM Mono',monospace",outline:"none",transition:"border-color .15s"}}
              />
              {globalSearch && <button onClick={()=>{setGlobalSearch("");setSearchOpen(false);}} style={{position:"absolute",right:7,background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:13,lineHeight:1}}>×</button>}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,zIndex:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",overflow:"hidden"}}>
                {searchResults.map((r,i)=>(
                  <div key={i} onMouseDown={e=>{e.preventDefault();r.action();}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",borderBottom:i<searchResults.length-1?`1px solid ${C.border}`:"none",transition:"background .1s"}}
                    onMouseOver={e=>e.currentTarget.style.background=C.s2}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,
                      background: r.type==="deal"?`${C.accent}22`:r.type==="meeting"?`${C.blue}22`:`${C.green}22`,
                      color: r.type==="deal"?C.accent:r.type==="meeting"?C.blue:C.green,
                      whiteSpace:"nowrap"}}>
                      {r.type==="deal"?"DEAL":r.type==="meeting"?"MTG":"TASK"}
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                      <div style={{fontSize:10,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <select value={filterQ} onChange={e=>setFilterQ(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select>
          {user_role.canView==="all" && <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}><option>All</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>}
          <div style={{width:1,height:20,background:C.border}} />
          {/* Preview-as-role — Admin and CXO only */}
          {["ADMIN","CXO","CEO","CRO"].includes(user_role?.role) && (
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Preview as</span>
              <select value={activeUser} onChange={e=>setActiveUser(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px",color:C.accent,background:`${C.accent}18`,borderColor:`${C.accent}44`}}>
                {USER_ROLES.map(u=><option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
              </select>
            </div>
          )}
          <div style={{width:1,height:20,background:C.border}} />

          {/* Virtual Tour / Help button */}
          <button onClick={openWelcome}
            title="Virtual Tour & Help"
            style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:C.dim,fontWeight:700,transition:"border-color .15s,color .15s",flexShrink:0}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>?</button>

          {/* Countdown — only reps + RHs have 11:30 PM obligation */}
          {(isRep || isRH) && (()=>{
            const hr = new Date().getHours();
            const cdColor = countdown.includes("passed") ? C.red : hr >= 21 ? C.red : hr >= 18 ? C.orange : C.green;
            return <div style={{fontSize:11,fontWeight:700,color:cdColor,background:`${cdColor}12`,border:`1px solid ${cdColor}33`,padding:"3px 10px",borderRadius:4,whiteSpace:"nowrap"}}>⏱ {countdown}</div>;
          })()}

          {/* Profile button — click to open dropdown with sign out */}
          <div style={{position:"relative"}}>
            <button
              onClick={()=>setProfileOpen(p=>!p)}
              style={{display:"flex",alignItems:"center",gap:7,background:"transparent",border:`1px solid ${profileOpen?C.accent:C.border}`,borderRadius:6,padding:"4px 10px 4px 6px",cursor:"pointer",transition:"border-color .15s"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent,flexShrink:0}}>
                {(user.name||"?")[0].toUpperCase()}
              </div>
              <span style={{fontSize:11,color:C.text,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
              <span style={{fontSize:9,color:C.dim,marginLeft:2}}>{profileOpen?"▲":"▼"}</span>
            </button>
            {profileOpen && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:8,zIndex:200,minWidth:180,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
                <div style={{padding:"8px 12px",marginBottom:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{user.name}</div>
                  <div style={{fontSize:10,color:C.dim,marginTop:1}}>{user.email}</div>
                  <div style={{fontSize:10,color:C.accent,marginTop:2,fontWeight:600}}>{user_role?.role}</div>
                </div>
                <div style={{height:1,background:C.border,margin:"4px 0"}} />
                <button
                  onClick={()=>{setProfileOpen(false);onLogout();}}
                  style={{width:"100%",background:"transparent",border:"none",padding:"8px 12px",textAlign:"left",color:C.red,fontSize:12,cursor:"pointer",borderRadius:5,fontFamily:"'DM Mono',monospace",transition:"background .1s"}}
                  onMouseOver={e=>e.currentTarget.style.background=`${C.red}18`}
                  onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── WELCOME MODAL ────────────────────────────────────────────────── */}
      {showWelcomeModal && (()=>{
        const wd = currentTourData.welcome;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:16,maxWidth:460,width:"100%",padding:"36px 40px",boxShadow:"0 24px 80px rgba(0,0,0,.6)",position:"relative"}}>
              {/* Close X */}
              <button onClick={()=>{setShowWelcomeModal(false);localStorage.setItem(`otv_welcome_${activeUser}`,"1");}}
                style={{position:"absolute",top:14,right:16,background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
              {/* OTV badge */}
              <div style={{width:48,height:48,borderRadius:12,background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:C.accent,marginBottom:20}}>OTV</div>
              <div className="sans" style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>{wd.title}</div>
              <div style={{fontSize:13,color:C.dim,marginBottom:24}}>{wd.subtitle}</div>
              {/* Bullet highlights */}
              <div style={{background:C.s2,borderRadius:10,padding:"16px 20px",marginBottom:28}}>
                {wd.bullets.map((b,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:i<wd.bullets.length-1?10:0}}>
                    <span style={{color:C.accent,marginTop:1,fontSize:14}}>{b.split(" ")[0]}</span>
                    <span style={{fontSize:12,color:C.text,lineHeight:1.5}}>{b.split(" ").slice(1).join(" ")}</span>
                  </div>
                ))}
              </div>
              {/* Action buttons */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={startTour}
                  style={{flex:1,background:C.accent,border:"none",color:"#000",borderRadius:8,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:.3}}>
                  Start Tour →
                </button>
                <button onClick={()=>{setShowWelcomeModal(false);localStorage.setItem(`otv_welcome_${activeUser}`,"1");}}
                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:"12px 20px",fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                  Skip for now
                </button>
              </div>
              <div style={{fontSize:10,color:C.muted,marginTop:14,textAlign:"center"}}>You can replay this tour anytime by clicking the <strong>?</strong> button in the top bar</div>
            </div>
          </div>
        );
      })()}

      {/* ── TOUR OVERLAY ─────────────────────────────────────────────────── */}
      {tourActive && (()=>{
        const steps = currentTourSteps;
        const step  = steps[tourStep];
        const total = steps.length;
        const isLast = tourStep === total - 1;
        const isFirst = tourStep === 0;
        const pct = Math.round(((tourStep + 1) / total) * 100);

        // ── Dynamic card positioning ──
        const CARD_W = 390;
        const GAP = 18;
        const PAD = 16;
        let cardStyle: React.CSSProperties = { bottom: 32, right: 32 }; // fallback
        if (tourTargetRect) {
          const W = window.innerWidth;
          const H = window.innerHeight;
          const spaceRight  = W - tourTargetRect.right;
          const spaceLeft   = tourTargetRect.left;
          const spaceBottom = H - tourTargetRect.bottom;
          const spaceTop    = tourTargetRect.top;
          if (spaceRight >= CARD_W + GAP) {
            // Place card to the right
            cardStyle = {
              position:"fixed", left: tourTargetRect.right + GAP,
              top: Math.max(PAD, Math.min(tourTargetRect.top, H - 350 - PAD)),
              width: CARD_W,
            };
          } else if (spaceLeft >= CARD_W + GAP) {
            // Place card to the left
            cardStyle = {
              position:"fixed", right: W - tourTargetRect.left + GAP,
              top: Math.max(PAD, Math.min(tourTargetRect.top, H - 350 - PAD)),
              width: CARD_W,
            };
          } else if (spaceBottom >= 300 + GAP) {
            // Place card below
            cardStyle = {
              position:"fixed", top: tourTargetRect.bottom + GAP,
              left: Math.max(PAD, Math.min(tourTargetRect.left, W - CARD_W - PAD)),
              width: CARD_W,
            };
          } else if (spaceTop >= 300 + GAP) {
            // Place card above
            cardStyle = {
              position:"fixed", bottom: H - tourTargetRect.top + GAP,
              left: Math.max(PAD, Math.min(tourTargetRect.left, W - CARD_W - PAD)),
              width: CARD_W,
            };
          } else {
            // Center fallback
            cardStyle = {
              position:"fixed", bottom: 32, left: "50%",
              transform:"translateX(-50%)", width: CARD_W,
            };
          }
        }

        return (
          <>
            {/* Dark backdrop */}
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:8000,pointerEvents:"none"}} />
            {/* Spotlight highlight ring around target */}
            {tourTargetRect && (
              <div style={{
                position:"fixed",
                left: tourTargetRect.left - 5,
                top:  tourTargetRect.top  - 5,
                width:  tourTargetRect.width  + 10,
                height: tourTargetRect.height + 10,
                border:`2px solid ${C.accent}`,
                borderRadius:8,
                boxShadow:`0 0 0 3px ${C.accent}44, 0 0 22px 4px ${C.accent}55`,
                zIndex:8002,
                pointerEvents:"none",
                transition:"all .25s cubic-bezier(.4,0,.2,1)",
              }} />
            )}
            {/* Floating tooltip card — dynamically positioned */}
            <div style={{...cardStyle,position:"fixed",zIndex:8003,background:C.surface,border:`1px solid ${C.accent}55`,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.7)",overflow:"hidden",transition:"top .25s,left .25s,right .25s,bottom .25s"}}>
              {/* Progress bar */}
              <div style={{height:3,background:C.s2}}>
                <div style={{height:"100%",width:`${pct}%`,background:C.accent,transition:"width .35s"}} />
              </div>
              <div style={{padding:"20px 22px 18px"}}>
                {/* Step counter */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>Step {tourStep+1} of {total}</span>
                  <button onClick={closeTour} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
                </div>
                {/* Title */}
                <div className="sans" style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8,lineHeight:1.3}}>{step.title}</div>
                {/* Description */}
                <div style={{fontSize:12,color:C.dim,lineHeight:1.7,marginBottom:step.tip?10:0}}>{step.desc}</div>
                {/* Tip */}
                {step.tip && (
                  <div style={{background:`${C.accent}12`,border:`1px solid ${C.accent}30`,borderRadius:6,padding:"8px 12px",fontSize:11,color:C.accent,lineHeight:1.5}}>
                    💡 {step.tip}
                  </div>
                )}
              </div>
              {/* Navigation */}
              <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setTourStep(s=>Math.max(0,s-1))} disabled={isFirst}
                  style={{background:"transparent",border:`1px solid ${isFirst?C.s3:C.border}`,borderRadius:6,padding:"6px 14px",color:isFirst?C.muted:C.dim,fontSize:11,cursor:isFirst?"default":"pointer",fontFamily:"'DM Mono',monospace"}}>
                  ← Prev
                </button>
                {isLast ? (
                  <button onClick={closeTour}
                    style={{flex:1,background:C.accent,border:"none",color:"#000",borderRadius:6,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                    Done ✓
                  </button>
                ) : (
                  <button onClick={()=>setTourStep(s=>Math.min(total-1,s+1))}
                    style={{flex:1,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"8px 14px",fontSize:12,color:C.accent,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                    Next →
                  </button>
                )}
                <button onClick={closeTour}
                  style={{background:"transparent",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",padding:"6px 8px"}}>
                  Skip all
                </button>
              </div>
            </div>
          </>
        );
      })()}

      <div style={{display:"flex",flex:1,overflow:"hidden",flexDirection: isMobile ? "column" : "row"}}>
        {/* SIDEBAR — vertical on desktop, horizontal tab bar on mobile */}
        {isMobile ? (
          <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto",flexShrink:0,padding:"4px 8px",gap:2}}>
            {navSections.flatMap(sec => sec.items).map(n => (
              <button key={n.id} onClick={()=>setView(n.id)}
                style={{flexShrink:0,padding:"6px 10px",background:view===n.id?`${C.accent}18`:"transparent",border:"none",borderBottom:view===n.id?`2px solid ${C.accent}`:"2px solid transparent",color:view===n.id?C.accent:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:view===n.id?600:400,whiteSpace:"nowrap",transition:"all .1s"}}>
                <span style={{fontSize:11}}>{n.icon}</span>
                <span>{n.label}</span>
                {n.badge>0&&<span style={{background:C.red,color:"#fff",borderRadius:8,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,padding:"0 3px"}}>{n.badge}</span>}
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
                    {n.badge>0&&<span style={{background:C.red,color:"#fff",borderRadius:8,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,padding:"0 3px"}}>{n.badge}</span>}
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
          {isRep && adminConfig.platformLive === false && view === "target-submit" && targetSubs.filter(t=>t.repId===user_role?.repId).length === 0 && (
            <div style={{background:"#fffbeb",border:"1px solid #f59e0b44",borderRadius:8,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⚠</span>
              <span style={{fontSize:12,color:"#92400e",fontFamily:"'DM Sans',sans-serif"}}>No targets assigned yet. Contact your Admin or CRO to get started.</span>
            </div>
          )}

          {/* ═══ SETUP WIZARD ═══ */}
          {view==="setup-wizard" && isRep && (()=>{
            const myRepId   = user_role?.repId;
            const myRep     = reps.find(r=>r.id===myRepId);
            const mySubs    = targetSubs.filter(t=>t.repId===myRepId);
            const alreadySubmitted = mySubs.length > 0;

            const wStep    = wizardStep;
            const setWStep = setWizardStep;
            const wClients    = wizardClients;
            const setWClients = setWizardClients;
            const wRegion  = wizardRegion;
            const wRM      = wizardRM;

            const parseLakh = (v) => {
              const s = String(v||"").replace(/,/g,"").trim();
              if (!s) return 0;
              if (/^\d+(\.\d+)?[Ll]$/.test(s)) return Math.round(parseFloat(s)*100000);
              if (/^\d+(\.\d+)?[Cc][Rr]?$/.test(s)) return Math.round(parseFloat(s)*10000000);
              return Math.round(parseFloat(s)||0);
            };

            const totalTarget = wClients.reduce((s,c)=>s+parseLakh(c.q1)+parseLakh(c.q2)+parseLakh(c.q3)+parseLakh(c.q4),0);

            const doSubmit = () => {
              if (!wRegion) { showToast("Select your region before submitting","err"); setWStep(1); return; }
              if (!wRM.trim()) { showToast("Enter your Reporting Manager's name before submitting","err"); setWStep(1); return; }
              const repIdInt = myRepId;
              const repName  = myRep?.name || user?.name || "Sales Rep";
              const rhRegion = wRegion;
              const now      = new Date().toISOString();
              const newSubs  = QUARTERS.slice(0,4).map((q,qi)=>{
                const clients = wClients.map(c=>({
                  clientCompany: (c.client||c.agency||c.brand||"").trim(),
                  agency: c.agency.trim(),
                  brand: c.brand.trim(),
                  dealType:"Linear TV",
                  targetAmount: parseLakh(qi===0?c.q1:qi===1?c.q2:qi===2?c.q3:c.q4),
                })).filter(c=>c.clientCompany&&c.targetAmount>0);
                if (clients.length===0) return null;
                const total = clients.reduce((s,c)=>s+(c.targetAmount||0),0);
                const id = `ts_wizard_${Date.now()}_q${qi}_${Math.random().toString(36).slice(2,4)}`;
                return {id,repId:repIdInt,repName,region:rhRegion,quarter:q,clients,totalTarget:total,status:"Pending RH",submittedAt:now,submittedByRole:"SALES REP",approvedAt:null,approvedBy:null,frozenTarget:null,awaitingApprovalSince:now,auditLog:[{at:now,by:"SELF",role:"SALES REP",action:"Submitted (Setup Wizard)"}]};
              }).filter(Boolean);
              if (newSubs.length===0) { showToast("Add at least one client with a target amount","err"); return; }
              setTargetSubs(p=>[...newSubs,...p]);
              apiFetch("/api/targets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newSubs[0])}).catch(()=>{});
              showToast("Target submitted for approval ✓");
              setView("rep-dashboard");
            };

            const StepDot = ({n,label}) => (
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:wStep>=n?C.accent:`${C.dim}30`,color:wStep>=n?"#fff":C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,transition:"all .2s"}}>{wStep>n?"✓":n+1}</div>
                <span style={{fontSize:10,color:wStep>=n?C.text:C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:wStep===n?700:400}}>{label}</span>
              </div>
            );

            return (
              <div className="fin">
                <h2 style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",margin:"0 0 4px"}}>Welcome to OTV CRM</h2>
                <p style={{fontSize:12,color:C.dim,fontFamily:"'DM Sans',sans-serif",margin:"0 0 20px"}}>Let's get your account set up — it takes 2 minutes.</p>

                {/* Step tracker */}
                <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
                  {[["Welcome","0"],["Your Profile","1"],["Set Targets","2"],["Review","3"]].map(([lbl],i)=><StepDot key={i} n={i} label={lbl}/>)}
                </div>

                {/* ── Step 0: Welcome ── */}
                {wStep===0 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:32,marginBottom:12}}>👋</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>Hi{myRep?.name?", "+myRep.name.split(" ")[0]:""}!</div>
                    <div style={{fontSize:13,color:C.dim,fontFamily:"'DM Sans',sans-serif",marginBottom:16,lineHeight:1.6}}>
                      You're about to set up your sales workspace. Here's what you'll need:<br/>
                      • Your client list for this fiscal year<br/>
                      • Approximate quarterly targets per client<br/>
                      • 2 minutes of your time 😊
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                      {[["📅","My Plan","Plan & log daily client meetings"],["₹","Revenue Log","Record revenue when deals close"],["⬆","Requests","Raise approvals & support requests"],["⊡","Dashboard","Track your targets and performance"]].map(([icon,name,desc])=>(
                        <div key={name} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",background:C.s2,borderRadius:7}}>
                          <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
                          <div><div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{name}</div><div style={{fontSize:11,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>{desc}</div></div>
                        </div>
                      ))}
                    </div>
                    {alreadySubmitted && (
                      <div style={{padding:"8px 12px",background:`${C.green}10`,border:`1px solid ${C.green}33`,borderRadius:6,marginBottom:12,fontSize:11,color:C.green,fontFamily:"'DM Sans',sans-serif"}}>
                        ✓ You already have a target submission. You can skip to the dashboard.
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      {alreadySubmitted && <button onClick={()=>setView("rep-dashboard")} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Go to Dashboard</button>}
                      <button onClick={()=>setWStep(1)} style={{flex:2,padding:"10px 0",background:C.accent,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Let's get started →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 1: Profile ── */}
                {wStep===1 && (()=>{
                  const canAdvance = !!wRegion && !!wRM.trim();
                  // RH users for this region — drawn from USER_ROLES (no admin API needed)
                  const rhForRegion = USER_ROLES.filter(u=>u.role==="REGION HEAD"&&u.region===wRegion);
                  const doAdvance = () => {
                    if(!canAdvance) return;
                    const repIdNum = user_role?.repId;
                    if(!repIdNum){showToast("Cannot identify your rep record — contact Admin","err");return;}
                    // Persist region + reportingManager on the rep record; gate advancement on success
                    adminSvc.patchRepProfile(repIdNum, {region:wRegion,reportingManager:wRM})
                      .then(()=>{
                        // Sync local reps blob so myRep reflects new values immediately
                        setReps((p:any[])=>p.map((r:any)=>r.id===repIdNum||r.repId===repIdNum?{...r,region:wRegion,reportingManager:wRM}:r));
                        setWStep(2);
                      })
                      .catch((err:any)=>showToast(err?.body?.error||"Network error — please try again","err"));
                  };
                  return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Your Profile</div>
                    {/* Read-only: Name + Role */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                      {[["Name",myRep?.name||user?.name||"—"],["Role",user_role?.role||"SALES REP"]].map(([lbl,val])=>(
                        <div key={lbl} style={{padding:"10px 14px",background:C.s2,borderRadius:7}}>
                          <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase"}}>{lbl}</div>
                          <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginTop:3}}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Region selector — required */}
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>Region <span style={{color:C.red}}>*</span></div>
                      <select value={wRegion} onChange={e=>{setWizardRegion(e.target.value);setWizardRM("");}}
                        style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRegion?C.green:C.border}`,borderRadius:5,color:wRegion?C.text:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                        <option value="">Select your territory…</option>
                        {REGIONS.filter(r=>r!=="National").map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                      {wRegion && <div style={{fontSize:9,color:C.green,marginTop:3}}>✓ Region set</div>}
                    </div>
                    {/* Reporting Manager — dropdown of RH users for this region */}
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif",letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>Reporting Manager <span style={{color:C.red}}>*</span></div>
                      {rhForRegion.length > 0 ? (
                        <select value={wRM} onChange={e=>setWizardRM(e.target.value)}
                          style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRM.trim()?C.green:C.border}`,borderRadius:5,color:wRM.trim()?C.text:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          <option value="">Select your Region Head…</option>
                          {rhForRegion.map(rh=><option key={rh.id} value={rh.name}>{rh.name}</option>)}
                        </select>
                      ) : (
                        <input value={wRM} onChange={e=>setWizardRM(e.target.value)}
                          placeholder={wRegion?"Enter Region Head's name":"Select region first"}
                          disabled={!wRegion}
                          style={{width:"100%",padding:"8px 10px",background:C.s2,border:`1px solid ${wRM.trim()?C.green:C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",opacity:wRegion?1:0.6}}/>
                      )}
                      <div style={{fontSize:9,color:C.muted,marginTop:3}}>The Region Head who approves your targets and attendance.</div>
                    </div>
                    {!canAdvance && (
                      <div style={{padding:"8px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}33`,borderRadius:6,marginBottom:12,fontSize:11,color:C.orange,fontFamily:"'DM Sans',sans-serif"}}>
                        Region and Reporting Manager are required to continue.
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(0)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back</button>
                      <button onClick={doAdvance} style={{flex:2,padding:"10px 0",background:canAdvance?C.accent:`${C.dim}44`,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:canAdvance?"pointer":"default",fontFamily:"'DM Mono',monospace",opacity:canAdvance?1:0.7}}>Looks good →</button>
                    </div>
                  </div>
                  );
                })()}

                {/* ── Step 2: Set Targets ── */}
                {wStep===2 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Set Your Targets</div>
                    <div style={{fontSize:11,color:C.dim,fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>Add clients and quarterly targets. You can always add more later from the Target Submission page.</div>

                    {wClients.map((c,ci)=>(
                      <div key={ci} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:10,background:C.s2}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>Client {ci+1}</div>
                          {wClients.length>1&&<button onClick={()=>setWClients(p=>p.filter((_,i)=>i!==ci))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>✕</button>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Agency (opt.)</label>
                            <input value={c.agency} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,agency:e.target.value}:x))} placeholder="e.g. Dentsu" style={{fontSize:12}} />
                          </div>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Client *</label>
                            <input value={c.client} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,client:e.target.value}:x))} placeholder="e.g. Tata Motors" style={{fontSize:12}} />
                          </div>
                          <div>
                            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>Brand (opt.)</label>
                            <input value={c.brand} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,brand:e.target.value}:x))} placeholder="e.g. Nexon" style={{fontSize:12}} />
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                          {(["Q1","Q2","Q3","Q4"] as const).map((q,qi)=>(
                            <div key={q}>
                              <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>{q} FY26 (₹)</label>
                              <input value={c[q.toLowerCase() as "q1"|"q2"|"q3"|"q4"]} onChange={e=>setWClients(p=>p.map((x,i)=>i===ci?{...x,[q.toLowerCase()]:e.target.value}:x))} placeholder="e.g. 25L" style={{fontSize:12}} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button onClick={()=>setWClients(p=>[...p,{agency:"",client:"",brand:"",q1:"",q2:"",q3:"",q4:""}])}
                      style={{width:"100%",padding:"8px 0",border:`1px dashed ${C.border}`,background:"transparent",color:C.blue,borderRadius:6,fontSize:12,cursor:"pointer",marginBottom:14,fontFamily:"'DM Mono',monospace"}}>
                      + Add another client
                    </button>

                    {totalTarget>0&&<div style={{padding:"8px 14px",background:`${C.green}10`,border:`1px solid ${C.green}33`,borderRadius:6,fontSize:12,color:C.green,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Total annual target: {fmtR(totalTarget)}</div>}

                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(1)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back</button>
                      <button onClick={()=>setWStep(3)} disabled={totalTarget===0} style={{flex:2,padding:"10px 0",background:totalTarget>0?C.accent:`${C.dim}44`,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:totalTarget>0?"pointer":"default",fontFamily:"'DM Mono',monospace"}}>Review →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Review & Submit ── */}
                {wStep===3 && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>Review & Submit</div>
                    <div style={{marginBottom:14}}>
                      {wClients.filter(c=>c.client||c.agency).map((c,ci)=>{
                        const qs = {Q1:parseLakh(c.q1),Q2:parseLakh(c.q2),Q3:parseLakh(c.q3),Q4:parseLakh(c.q4)};
                        const tot = Object.values(qs).reduce((s,v)=>s+v,0);
                        return (
                          <div key={ci} style={{padding:"10px 14px",background:C.s2,borderRadius:7,marginBottom:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div style={{fontWeight:700,fontSize:12,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{c.client||c.agency} {c.brand?`· ${c.brand}`:""}</div>
                              <div style={{fontWeight:700,fontSize:12,color:C.green}}>{fmtR(tot)}</div>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              {Object.entries(qs).filter(([,v])=>v>0).map(([q,v])=>(
                                <div key={q} style={{fontSize:10,color:C.dim,fontFamily:"'DM Sans',sans-serif"}}>{q}: {fmtR(v as number)}</div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{padding:"10px 14px",background:`${C.accent}10`,border:`1px solid ${C.accent}33`,borderRadius:7,marginBottom:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif"}}>
                        <div style={{fontSize:12,color:C.text}}>Total Annual Target</div>
                        <div style={{fontSize:15,fontWeight:800,color:C.accent}}>{fmtR(totalTarget)}</div>
                      </div>
                      <div style={{fontSize:10,color:C.dim,marginTop:4}}>Submitted → Region Head → NSH → Sales Strategy → CRO</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWStep(2)} style={{flex:1,padding:"10px 0",border:`1px solid ${C.border}`,background:"transparent",color:C.dim,borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Edit</button>
                      <button onClick={doSubmit} style={{flex:2,padding:"10px 0",background:C.green,color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Submit for Approval ✓</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
            const qSubs     = targetSubs.filter(s => s.repId === myRepId && s.quarter === currentQ && s.status === "Approved");
            const qTarget   = qSubs.reduce((s,x) => s + (x.totalTarget||0), 0);
            const qAch      = revenueEntries.filter(e => e.repId === myRepId && e.quarter === currentQ).reduce((s,e) => s + (parseCurrency(e.amount||"0")||0), 0);
            const myTargetSub  = targetSubs.find(s => s.repId === myRepId);
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
                internalReqs={internalReqs}
                hrBadge={hrBadge}
                stackedBar={stackedBar}
                onLogRevenue={({clientName,amount,invoiceRef,date}) => {
                  const amt  = parseCurrency(amount);
                  if(!amt){showToast("Enter a valid amount (e.g. 5L or 50000)","err");return;}
                  const ikey = `ikey_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const id   = `re_d${Date.now()}`;
                  const entry = {id,repId:myRepId,clientCompany:clientName.trim(),zohoAccountId:"",dealType:"Linear TV",amount:amt,invoiceRef:invoiceRef.trim(),date:date||TODAY,quarter:entryQ,fiscalYear:CURRENT_FY,notes:""};
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
              loginProvider={loginProvider}
              isRep={isRep}
              isNSH={isNSHDashboard}
              isRH={isRH}
              isStrategy={isStrategy}
              isCRORole={isCRORole}
              isAdmin={isAdmin}
              isDigiOps={isDigiOps}
              deals={deals}
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
              onNavigateRevenue={()=>{setView("revenue-log");}}
            />
          )}

          {/* ═══ RH WAR ROOM (Region Head) ═══ */}
          {view==="warroom" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = reps.filter(r => r.region === rhRegion);
            const myRepIds = myReps.map(r => r.id);
            const rhDeals  = visibleDeals;

            // ── MY OWN ACTIONABLES (directed to Region Head) ──
            const myApprovals = rhDeals.filter(d =>
              d.awaitingApproval === "NSH" && d.awaitingApprovalSince && myRepIds.includes(d.repId)
            );
            const myTasks_rh = tasks.filter(t =>
              t.dept === "NSH" && t.status !== "Done" && myRepIds.includes(t.repId)
            );
            const myOverdueTasks = tasks.filter(t =>
              t.assignedTo && myRepIds.includes(t.repId) && t.dueDate < TODAY && t.status !== "Done"
            );

            // ── TEAM NUMBERS ──
            const rhT  = rhDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhC  = revenueEntries.filter(e=>myRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const rhP  = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct= rhT>0?Math.round((rhC/rhT)*100):0;
            // Part 4+9: escalation clock = lastDealMeetingDate, tiered at 7/10/14 days
            const rhAtRisk   = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=7;});
            const rh10d      = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=10;});
            const rh14d      = rhDeals.filter(d=>{const ds=dealStage(d);return !["Mail Confirmed","RO Received","Lost"].includes(ds)&&daysSince(d.lastDealMeetingDate||d.lastContact)>=14;});
            const rhOverdue  = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&dealStage(d)!=="Mail Confirmed");

            // Part 4 — Trigger 2A: 4+ Deal Meeting touchpoints with same client in 30 days, no stage movement
            const thirtyDaysAgo = new Date(Date.now()-30*864e5).toISOString().slice(0,10);
            const trigger2A: {repName:string,clientCompany:string,count:number,stageNow:string}[] = [];
            {
              const dealMeetings30 = touchpoints.filter(t=>t.touchpointType==="Deal Meeting"&&(t.date||"")>=thirtyDaysAgo&&myRepIds.includes(t.repId as any));
              const byDealId: Record<string,typeof touchpoints> = {};
              dealMeetings30.forEach(t=>{if(t.dealId){if(!byDealId[t.dealId])byDealId[t.dealId]=[];byDealId[t.dealId].push(t);}});
              Object.entries(byDealId).forEach(([dealId,tps])=>{
                if(tps.length>=4){
                  const deal=rhDeals.find(d=>d.id===dealId);
                  if(!deal||["Mail Confirmed","RO Received","Lost"].includes(dealStage(deal)))return;
                  const stages=new Set(tps.map(t=>t.stageUpdate).filter(Boolean));
                  const noMovement=stages.size<=1;
                  if(noMovement){
                    const rep=reps.find(r=>r.id===deal.repId);
                    trigger2A.push({repName:rep?.name||"Unknown",clientCompany:deal.clientCompany,count:tps.length,stageNow:dealStage(deal)});
                  }
                }
              });
            }

            // Part 4 — Trigger 2B: <15 touchpoints in current calendar month for any rep in region
            const monthStart = TODAY.slice(0,7)+"-01";
            const trigger2B: {repName:string,count:number,repId:number}[] = [];
            {
              myReps.forEach(r=>{
                const monthTPs=touchpoints.filter(t=>t.repId===r.id&&(t.date||"")>=monthStart).length;
                if(monthTPs<15) trigger2B.push({repName:r.name,count:monthTPs,repId:r.id});
              });
            }

            const totalActions = myApprovals.length + myTasks_rh.length;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:rhWarroomClient?8:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}</div>
                  </div>
                </div>

                {/* ── STALLED CLIENT/REP FILTER BANNER (from dashboard chip click) ── */}
                {rhWarroomClient && (()=>{
                  const filterRep = reps.find(r=>String(r.id)===rhWarroomRep);
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.purple}10`,border:`1.5px solid ${C.purple}44`,borderRadius:7,padding:"7px 14px",marginBottom:14}}>
                      <span style={{fontSize:13}}>⏸</span>
                      <span style={{flex:1,fontSize:12,color:C.purple,fontWeight:600}}>
                        Filtered to stalled deal: <strong>{rhWarroomClient}</strong>
                        {filterRep && <span style={{fontWeight:400,color:C.dim}}> · {filterRep.name}</span>}
                      </span>
                      <button onClick={()=>{setRhWarroomClient("");setRhWarroomRep("");}}
                        style={{background:"none",border:`1px solid ${C.purple}55`,borderRadius:4,padding:"2px 10px",fontSize:11,color:C.purple,fontWeight:700,cursor:"pointer"}}>
                        × Clear filter
                      </button>
                    </div>
                  );
                })()}

                {/* ── PIPELINE GAP STRIP ── */}
                {(()=>{
                  const rhGap = Math.max(0, rhT - rhC - rhP);
                  const rhPipelinePct = rhT>0?Math.round((rhP/rhT)*100):0;
                  return (
                    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                      {[
                        {label:"ANNUAL TARGET", val:fmtR(rhT), color:C.text},
                        {label:`ACHIEVED (${rhPct}%)`, val:fmtR(rhC), color:C.green},
                        {label:`ACTIVE PIPELINE (${rhPipelinePct}%)`, val:fmtR(rhP), color:C.blue},
                        {label:"PIPELINE GAP", val:rhGap===0?"✓ On track":fmtR(rhGap), color:rhGap===0?C.green:C.red},
                      ].map(m=>(
                        <div key={m.label} style={{flex:"1 1 140px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{m.label}</div>
                          <div className="sans" style={{fontSize:16,fontWeight:800,color:m.color}}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── SUPPORT REQUESTS (to RH's region reps) ── */}
                {(()=>{
                  const regionSRs = internalReqs.filter(r=>
                    r.type==="Support Request" &&
                    !["Done","Withdrawn","Rejected"].includes(r.status||"") &&
                    myRepIds.includes(r.repId as any)
                  );
                  if (!regionSRs.length) return null;
                  return (
                    <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13}}>🆘</span>
                          <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {regionSRs.length} open from your region</span>
                        </div>
                        <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                      </div>
                      {regionSRs.slice(0,4).map(sr=>{
                        const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                        const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                        const rep = reps.find(r=>r.id===sr.repId);
                        return (
                          <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                              <div style={{fontSize:10,color:C.dim}}>{rep?.name||sr.raisedByName} · → {sr.dept}</div>
                            </div>
                            <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                            {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                          </div>
                        );
                      })}
                      {regionSRs.length>4&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{regionSRs.length-4} more</div>}
                    </div>
                  );
                })()}

                {/* ── SECTION A: MY ACTIONABLES ── */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                    MY ACTIONABLES · {totalActions} item{totalActions!==1?"s":""} need your decision
                  </div>

                  {totalActions===0 && myOverdueTasks.length===0 && (
                    <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:7,padding:"11px 16px",fontSize:12,color:C.green}}>✓ No items waiting on you right now.</div>
                  )}

                  {/* Approvals pending RH sign-off */}
                  {myApprovals.map(d=>{
                    const rep = reps.find(r=>r.id===d.repId);
                    const dw  = daysSince(d.awaitingApprovalSince||TODAY);
                    return (
                      <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}33`,borderRadius:7,padding:"11px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:C.orange,fontSize:13}}>⏳</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700}}>{d.clientCompany} <span style={{color:C.dim,fontWeight:400,fontSize:11}}>· {rep?.name}</span></div>
                          <div style={{fontSize:11,color:C.dim,marginTop:2}}>{d.nextStep}</div>
                        </div>
                        <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{dw}d waiting</span>
                        <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        <button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()}
                          style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Approve →</button>
                      </div>
                    );
                  })}

                  {/* Tasks created by reps needing NSH */}
                  {myTasks_rh.map(t=>{
                    const rep = reps.find(r=>r.id===t.repId);
                    return (
                      <div key={t.id} style={{background:`${C.blue}06`,border:`1px solid ${C.blue}33`,borderRadius:7,padding:"11px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:C.blue,fontSize:13}}>📋</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700}}>{t.title} <span style={{color:C.dim,fontWeight:400,fontSize:11}}>· {rep?.name} · {t.clientCompany}</span></div>
                          {t.description&&<div style={{fontSize:11,color:C.dim,marginTop:2}}>{t.description}</div>}
                        </div>
                        <span style={{fontSize:10,color:C.dim}}>Due {t.dueDate}</span>
                        <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))}
                          style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button>
                      </div>
                    );
                  })}
                </div>

                {/* ── DYNAMIC ANALYSIS ── */}
                {(()=>{
                  const staleDeals   = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                  const overdueSteps = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                  const highRiskBig  = rhDeals.filter(d=>d.amount>=5000000&&!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=5);
                  const repPcts      = myReps.map(r=>{
                    const rd=rhDeals.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=revenueEntries.filter(e=>e.repId===r.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    return {name:r.name,pct:t>0?Math.round((c/t)*100):null};
                  }).filter(r=>r.pct!==null);
                  const laggingReps  = repPcts.filter(r=>r.pct<40);
                  const pendingApps  = targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH");
                  const closingSoon  = rhDeals.filter(d=>["Very Interested","Interested – Needs Revision"].includes(d.outcome)&&d.nextStepDate&&d.nextStepDate<=TOMORROW);

                  const insights: {priority:"critical"|"warning"|"good", text:string}[] = [];
                  if(staleDeals.length>0) insights.push({priority:"critical",  text:`${staleDeals.length} active deal${staleDeals.length>1?"s":""} with no contact in 7+ days — ${staleDeals.slice(0,2).map(d=>d.clientCompany).join(", ")}${staleDeals.length>2?" +more":""}.`});
                  if(highRiskBig.length>0) insights.push({priority:"critical",  text:`${highRiskBig.length} high-value deal${highRiskBig.length>1?"s":""} (₹50L+) going cold — ${highRiskBig.slice(0,2).map(d=>d.clientCompany).join(", ")}.`});
                  if(overdueSteps.length>0) insights.push({priority:"warning",   text:`${overdueSteps.length} overdue next step${overdueSteps.length>1?"s":""} — reps need follow-ups today.`});
                  if(laggingReps.length>0)  insights.push({priority:"warning",   text:`${laggingReps.map(r=>`${r.name} (${r.pct}%)`).join(", ")} significantly below target — needs coaching.`});
                  if(pendingApps.length>0)  insights.push({priority:"warning",   text:`${pendingApps.length} target submission${pendingApps.length>1?"s":""} awaiting your approval.`});
                  if(closingSoon.length>0)  insights.push({priority:"good",      text:`${closingSoon.length} deal${closingSoon.length>1?"s":""} poised to close this week — ${closingSoon.slice(0,2).map(d=>d.clientCompany).join(", ")}.`});
                  if(insights.length===0)   insights.push({priority:"good",      text:"All deals active, no stale contacts, reps on track. Strong position."});

                  const pIcon = {critical:"🔴",warning:"🟡",good:"🟢"};
                  const pBorder = {critical:C.red,warning:C.orange,good:C.green};
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{height:1,background:C.border,marginBottom:16}} />
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                        DYNAMIC ANALYSIS · What needs your attention
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {insights.map((ins,i)=>(
                          <div key={i} style={{background:C.surface,border:`1px solid ${pBorder[ins.priority]}44`,borderLeft:`3px solid ${pBorder[ins.priority]}`,borderRadius:7,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <span style={{fontSize:13,flexShrink:0}}>{pIcon[ins.priority]}</span>
                            <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ins.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── SECTION B: TEAM OVERVIEW ── */}
                <div style={{height:1,background:C.border,marginBottom:16}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                  TEAM OVERVIEW · {rhRegion} Region
                </div>

                {/* Team KPIs */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                  {[
                    {label:"REGION TARGET",  value:fmtR(rhT),       color:C.blue},
                    {label:"REGION CLOSED",  value:fmtR(rhC),       color:C.green},
                    {label:"PIPELINE",       value:fmtR(rhP),       color:C.accent},
                    {label:"ACHIEVEMENT",    value:`${rhPct}%`,      color:rhPct>=80?C.green:rhPct>=50?C.accent:C.red},
                  ].map(k=>(
                    <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div className="sans" style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Rep-by-rep snapshot */}
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Rep","Closed","Pipeline","Target","Achieve %","At Risk","Next Step Due"].map(h=>(
                        <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {myReps.map(rep=>{
                        const rd  = rhDeals.filter(d=>d.repId===rep.id);
                        const rC  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const rP  = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                        const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const rPct= rT>0?Math.round((rC/rT)*100):0;
                        const rRisk = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        const rOverdue = rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                        const sc = rPct>=80?C.green:rPct>=50?C.accent:C.red;
                        return (
                          <tr key={rep.id} style={{borderBottom:`1px solid ${C.s2}`}}
                            onMouseOver={e=>e.currentTarget.style.background=C.s2}
                            onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{rep.name}</div></td>
                            <td style={{padding:"9px 12px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                            <td style={{padding:"9px 12px",color:C.accent}}>{fmtR(rP)}</td>
                            <td style={{padding:"9px 12px",color:C.dim}}>{fmtR(rT)}</td>
                            <td style={{padding:"9px 12px"}}><span style={{color:sc,fontWeight:700}}>{rPct}%</span></td>
                            <td style={{padding:"9px 12px"}}>{rRisk>0?<span style={{color:C.red,fontWeight:700}}>{rRisk} ⚠</span>:<span style={{color:C.green}}>✓</span>}</td>
                            <td style={{padding:"9px 12px",color:rOverdue.length>0?C.orange:C.dim,fontSize:11}}>{rOverdue.length>0?rOverdue[0].nextStepDate+" ("+rOverdue.length+" overdue)":"On track"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Part 9: Tiered escalation alerts — 7 / 10 / 14 day triggers */}
                {rh14d.filter(d=>(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ INTERVENE REQUIRED — 14+ DAYS NO DEAL MEETING</div>
                    {rh14d.filter(d=>(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      const taskId=`rh14-${d.id}`;
                      const alreadyTasked=tasks.some(t=>t.id===taskId);
                      return (
                        <div key={d.id} style={{background:`${C.red}10`,border:`1.5px solid ${C.red}55`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:C.red}}>🔴</span>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{background:`${C.red}22`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{idle}d no deal meeting</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                          {!alreadyTasked&&(
                            <button onClick={()=>{
                              setTasks(p=>[...p,{id:taskId,title:`Intervene — ${d.clientCompany} — ${idle}d — ${rep?.name||""}`,dept:"Region Head",status:"Open",dueDate:TODAY,repId:d.repId,createdAt:TODAY,priority:"High"}]);
                              showToast(`Task created: Intervene — ${d.clientCompany}`);
                            }} style={{background:C.red,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              Create Task
                            </button>
                          )}
                          {alreadyTasked&&<span style={{color:C.green,fontSize:10,fontWeight:700}}>✓ Task created</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {rh10d.filter(d=>!rh14d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>ℹ 10+ DAYS NO DEAL MEETING — MONITOR CLOSELY</div>
                    {rh10d.filter(d=>!rh14d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      return (
                        <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}33`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:C.orange}}>⚡</span>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{idle}d no deal meeting</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {rhAtRisk.filter(d=>!rh10d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>NO DEAL MEETING 7+ DAYS — TEAM AT RISK</div>
                    {rhAtRisk.filter(d=>!rh10d.includes(d)&&(!rhWarroomClient||d.clientCompany===rhWarroomClient)&&(!rhWarroomRep||String(d.repId)===rhWarroomRep)).map(d=>{
                      const rep=reps.find(r=>r.id===d.repId);
                      const idle=daysSince(d.lastDealMeetingDate||d.lastContact);
                      return (
                        <div key={d.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{color:C.red,fontSize:11}}>{idle}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Part 4 — Trigger 2A: Stalling deals (4+ meetings, no stage movement in 30d) */}
                {trigger2A.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ STALLING DEALS — 4+ MEETINGS, NO STAGE MOVEMENT IN 30 DAYS</div>
                    {trigger2A.map((t,i)=>(
                      <div key={i} style={{background:`${C.orange}08`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,color:C.orange}}>🔁</span>
                        <span style={{flex:1}}><strong>{t.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {t.repName}</span></span>
                        <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{t.count} meetings</span>
                        <span style={{background:`${oColor(t.stageNow)}18`,color:oColor(t.stageNow),padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.stageNow}</span>
                        <span style={{fontSize:10,color:C.muted}}>No stage change in 30d</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Part 4 — Trigger 2B: Reps below 15 touchpoints this month */}
                {trigger2B.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📉 LOW ACTIVITY — UNDER 15 TOUCHPOINTS THIS MONTH</div>
                    {trigger2B.map((t,i)=>(
                      <div key={i} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <span style={{flex:1}}><strong>{t.repName}</strong></span>
                        <span style={{background:`${C.red}22`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{t.count} touchpoints this month</span>
                        <span style={{fontSize:10,color:C.muted}}>Minimum expected: 15</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── NEW CLIENTS ADDED BY REPS ── */}
                {(()=>{
                  const newDeals = rhDeals.filter(d=>d.lastContact===TODAY||d.lastContact===TOMORROW).slice(0,5);
                  if(!newDeals.length) return null;
                  return (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>NEW CLIENTS ADDED TODAY</div>
                      {newDeals.map(d=>{
                        const rep=reps.find(r=>r.id===d.repId);
                        return (
                          <div key={d.id} style={{background:`${C.green}06`,border:`1px solid ${C.green}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name} · {d.dealType}</span></span>
                            <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{d.outcome}</span>
                            <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.targetAmount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── TEAM PLAN: TODAY + TOMORROW ── */}
                {(()=>{
                  const rhTodayPlans = (plans||[]).filter(p=>myRepIds.includes(p.repId)&&p.date===TODAY);
                  const rhTmrwPlans  = (plans||[]).filter(p=>myRepIds.includes(p.repId)&&p.date===TOMORROW);
                  if(!rhTodayPlans.length&&!rhTmrwPlans.length) return null;
                  const renderPlanRow = (p) => {
                    const rep=reps.find(r=>r.id===p.repId);
                    return (
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:C.s2,borderRadius:5,marginBottom:5}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:600,fontSize:12}}>{p.clientAgencyName}</span>
                          <span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span>
                          {p.time&&<span style={{color:C.muted,fontSize:10}}> @ {p.time}</span>}
                        </div>
                        {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{p.pitchType}</span>}
                        <span style={{background:p.status==="Done"?`${C.green}22`:`${C.blue}18`,color:p.status==="Done"?C.green:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{p.status}</span>
                      </div>
                    );
                  };
                  return (
                    <div style={{marginTop:16}}>
                      <div style={{height:1,background:C.border,marginBottom:16}}/>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>TEAM PLAN · {rhTodayPlans.length} today · {rhTmrwPlans.length} tomorrow</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        {[{label:"TODAY",list:rhTodayPlans},{label:"TOMORROW",list:rhTmrwPlans}].map(({label,list})=>(
                          <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                            <div style={{padding:"6px 12px",background:C.s2,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{label} · {list.length} meeting{list.length!==1?"s":""}</div>
                            <div style={{padding:"8px 10px",minHeight:40}}>
                              {list.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:8}}>Nothing planned</div>}
                              {list.map(renderPlanRow)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ═══ RH TARGETS (Region Head) ═══ */}
          {view==="targets" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const rhDeals  = visibleDeals;
            const rhT = rhDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhRepIds_t = [...new Set(rhDeals.map(d=>d.repId))];
            const rhC = revenueEntries.filter(e=>rhRepIds_t.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const rhP = rhDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct = rhT>0?Math.round((rhC/rhT)*100):0;
            const sc = rhPct>=80?C.green:rhPct>=50?C.accent:C.red;

            // All clients sorted by gap (biggest gap = least achieved vs target = top of list)
            const clientRows = rhDeals
              .filter(d=>d.outcome!=="Not Interested")
              .map(d=>{
                const ach = revenueEntries.filter(e=>e.repId===d.repId&&e.clientCompany===d.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const gap = Math.max(0,(d.targetAmount||0)-ach);
                const pct = d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                const rep = reps.find(r=>r.id===d.repId);
                return {...d, ach, gap, pct, rep};
              })
              .sort((a,b)=>b.gap-a.gap); // worst gap first

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TARGETS — {rhRegion}</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · Region summary + client drill-down</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Client</button>
                </div>

                {/* 4 Summary stat cards — consistent with Sales Rep view */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {(()=>{
                    const sf = Math.max(0, rhT - rhC);
                    return [
                      {label:"TOTAL TARGET",  value:fmtR(rhT),   color:C.accent,  sub:rhRegion+" region"},
                      {label:"ACHIEVED",       value:fmtR(rhC),   color:C.green,   sub:"Closed deals"},
                      {label:"SHORTFALL",      value:fmtR(sf),    color:sf===0?C.green:C.red, sub:sf===0?"On target":"Gap to close"},
                      {label:"% COMPLETE",     value:`${rhPct}%`, color:sc,        sub:"vs target"},
                    ];
                  })().map(card=>(
                    <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                      <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:20}}>
                  <div style={{height:"100%",width:`${Math.min(rhPct,100)}%`,background:sc,borderRadius:3}}/>
                </div>

                {/* Client table — consistent columns with Sales Rep */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                  All Clients · Sorted by Shortfall (highest first)
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Client","Sales Rep","Deal Type","Target","Achieved","Shortfall","Stage"].map(h=>(
                        <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {clientRows.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>No deals for {filterQ} yet.</td></tr>}
                      {clientRows.map(d=>(
                        <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                          onMouseOver={e=>e.currentTarget.style.background=C.s2}
                          onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px 14px"}}>
                            <div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>
                            {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <div style={{fontWeight:600,fontSize:12}}>{d.rep?.name||"—"}</div>
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span>
                          </td>
                          <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                          <td style={{padding:"10px 14px",color:d.ach>0?C.green:C.muted,fontWeight:d.ach>0?700:400}}>
                            {d.ach>0?fmtR(d.ach):"—"}{d.ach>0&&<div style={{fontSize:9,color:C.dim}}>{d.pct}%</div>}
                          </td>
                          <td style={{padding:"10px 14px",color:d.gap===0?C.green:C.red,fontWeight:700}}>
                            {d.gap===0?"✓":fmtR(d.gap)}
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}


          {/* ═══ NSH WAR ROOM ═══ */}
          {view==="warroom" && isNSHDashboard && (()=>{
            const allD = deals.filter(d=>qMatch(d.quarter));
            const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totP = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const totW = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
            const forecast = totC + totW;
            const gap = Math.max(0, totT - forecast);
            const closePct  = totT>0?Math.round((totC/totT)*100):0;
            const fcastPct  = totT>0?Math.round((forecast/totT)*100):0;
            const fsc = fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red;

            // Region-wise breakdown
            const regions = REGIONS;
            const regionStats = regions.map(r=>{
              const rd = allD.filter(d=>d.region===r);
              const rT = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rRepIds=[...new Set(rd.map(d=>d.repId))];
              const rC = revenueEntries.filter(e=>rRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const rRisk = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
              return {region:r, rT, rC, rPct, rRisk};
            });

            // High-risk deals — highest target, lowest achievement %
            const highRisk = allD
              .filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested")
              .map(d=>{
                const achieved=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const pct = d.targetAmount>0?Math.round((achieved/d.targetAmount)*100):0;
                return {...d, pct};
              })
              .sort((a,b)=> (b.targetAmount - a.targetAmount) || (a.pct - b.pct)) // biggest target first, then lowest achieved
              .slice(0,8);

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>National overview · {filterQ} · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-ghost" onClick={()=>{
                      const allD = deals.filter(d=>qMatch(d.quarter));
                      const totC = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const blocked = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");
                      const atRiskD = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                      const nonCompliant = reps.filter(r=>!att[TODAY]?.[r.id]);
                      const pct = totT>0?Math.round((totC/totT)*100):0;
                      const digest = [
                        `📊 OTV Sales Digest — ${TODAY}`,
                        ``,
                        `Revenue: ${fmtR(totC)} closed / ${fmtR(totT)} target (${pct}%)`,
                        ``,
                        blocked.length ? `⏳ ${blocked.length} deal(s) awaiting approval:` : `✅ No deals blocked`,
                        ...blocked.slice(0,5).map(d=>`  • ${d.clientCompany} — ${fmtR(d.amount)} → ${d.awaitingApproval} (${daysSince(d.awaitingApprovalSince||TODAY)}d)`),
                        ``,
                        atRiskD.length ? `🔴 ${atRiskD.length} deal(s) at risk (7+ days no contact):` : `✅ No at-risk deals`,
                        ...atRiskD.slice(0,5).map(d=>{const r=reps.find(x=>x.id===d.repId);return`  • ${d.clientCompany} — ${r?.name||""} (${daysSince(d.lastContact)}d idle)`;}),
                        ``,
                        nonCompliant.length ? `⚠️ Not logged today: ${nonCompliant.map(r=>r.name).join(", ")}` : `✅ All reps logged`,
                      ].join("\n");
                      navigator.clipboard?.writeText(digest);
                      showToast("Daily digest copied to clipboard ✓");
                    }} title="Copy daily digest for WhatsApp/email">📋 Digest</button>
                  </div>
                </div>

                {/* ── TOTAL SALES DASHBOARD ── */}
                <div style={{background:C.surface,border:`2px solid ${fsc}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Total Sales Dashboard · All Regions</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end",marginBottom:14}}>
                    {[["TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["PIPELINE",fmtR(totP),C.accent],["FORECAST",fmtR(forecast),fsc],["GAP",fmtR(gap),gap===0?C.green:C.red]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div className="sans" style={{fontSize:48,fontWeight:800,color:fsc,lineHeight:1}}>{fcastPct}%</div>
                      <div style={{fontSize:10,color:C.dim}}>forecast · {closePct}% closed</div>
                    </div>
                  </div>
                  {/* Progress bar: closed + weighted pipe */}
                  <div style={{height:8,background:C.s3,borderRadius:4,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(closePct,100)}%`,background:C.green,borderRadius:4}} />
                    <div style={{position:"absolute",left:`${closePct}%`,height:"100%",width:`${Math.min(fcastPct-closePct,100-closePct)}%`,background:`${C.accent}88`}} />
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:C.dim}}>
                    <span style={{color:C.green}}>■ Closed {closePct}%</span>
                    <span style={{color:C.accent}}>■ Weighted pipe {fcastPct-closePct}%</span>
                    <span>■ Gap {100-fcastPct}%</span>
                  </div>
                </div>

                {/* Region scoreline */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
                  {regionStats.map(rs=>{
                    const sc = rs.rPct>=80?C.green:rs.rPct>=50?C.accent:C.red;
                    return (
                      <div key={rs.region} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`2px solid ${sc}`,borderRadius:7,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{rs.region}</div>
                        <div className="sans" style={{fontSize:22,fontWeight:800,color:sc,lineHeight:1}}>{rs.rPct}%</div>
                        <div style={{fontSize:10,color:C.dim,marginTop:3}}>{fmtR(rs.rC)} / {fmtR(rs.rT)}</div>
                        <div style={{marginTop:5,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(rs.rPct,100)}%`,background:sc}} />
                        </div>
                        {rs.rRisk>0&&<div style={{marginTop:4,fontSize:9,color:C.red,fontWeight:700}}>{rs.rRisk} at risk</div>}
                      </div>
                    );
                  })}
                </div>

                {/* ── SECTION 1: REVENUE ── */}
                <div style={{height:1,background:C.border,marginBottom:16,marginTop:4}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>1 · Revenue · {filterQ}</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["","April–Till Date Target","Monthly Target","Projection","Achieved Till Date","LY Month Total"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(()=>{
                        const allD    = deals.filter(d=>qMatch(d.quarter));
                        const aprilTarget = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const monthTarget = Math.round(aprilTarget/3);
                        const achieved  = revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const pipeline  = allD.filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
                        const projection = achieved + pipeline;
                        return [["Linear TV","Linear TV"],["IPs","IPs"],["Digital","Digital"],["Media Solutions","Media Solutions"],["Integrated Packages","Integrated Packages"]].map(([label,type])=>{
                          const td = allD.filter(d=>d.dealType===type);
                          const t  = td.reduce((s,d)=>s+(d.targetAmount||0),0);
                          const a  = revenueEntries.filter(e=>e.dealType===type&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                          const p  = td.filter(d=>d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
                          const proj = a + p;
                          const sc = t>0&&proj>=t?C.green:t>0&&proj>=t*0.7?C.accent:t>0?C.red:C.dim;
                          return (
                            <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{t>0?fmtR(t):"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{t>0?fmtR(Math.round(t/3)):"—"}</td>
                              <td style={{padding:"10px 14px",color:sc,fontWeight:700}}>{proj>0?fmtR(proj):"—"}</td>
                              <td style={{padding:"10px 14px",color:a>0?C.green:C.muted,fontWeight:700}}>{a>0?fmtR(a):"—"}</td>
                              <td style={{padding:"10px 14px",color:C.muted}}>—</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* ── CALL REPORT SECTION ── */}
                <div style={{height:1,background:C.border,marginBottom:16,marginTop:4}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>2 · Call Report</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["","Today — Logged","Tomorrow — Planned"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {label:"Region Heads", rows: (() => {
                          const rhs = USER_ROLES.filter(u=>u.role==="REGION HEAD");
                          const todayLogged  = rhs.filter(r=>meetings.some(m=>m.repId===r.repId&&m.date===TODAY)).length;
                          const tmrwPlanned  = rhs.filter(r=>(plans||[]).some(p=>p.repId===r.repId&&p.date===TOMORROW&&p.status==="Planned")).length;
                          return {logged:todayLogged, planned:tmrwPlanned, total:rhs.length};
                        })()},
                        {label:"Sales Executives", rows: (() => {
                          const todayLogged  = reps.filter(r=>meetings.some(m=>m.repId===r.id&&m.date===TODAY)).length;
                          const tmrwPlanned  = reps.filter(r=>(plans||[]).some(p=>p.repId===r.id&&p.date===TOMORROW&&p.status==="Planned")).length;
                          return {logged:todayLogged, planned:tmrwPlanned, total:reps.length};
                        })()},
                      ].map(({label,rows})=>(
                        <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                          <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{color:rows.logged===rows.total?C.green:rows.logged>0?C.accent:C.red,fontWeight:700}}>{rows.logged}</span>
                            <span style={{color:C.dim}}> / {rows.total}</span>
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{color:rows.planned===rows.total?C.green:rows.planned>0?C.accent:C.red,fontWeight:700}}>{rows.planned}</span>
                            <span style={{color:C.dim}}> / {rows.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── TASKS RECEIVED ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>3 · Tasks Received</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["From","Count","Overdue"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {["RH","Exec"].map(from=>{
                        const fromTasks = tasks.filter(t=>t.dept==="NSH"&&t.status!=="Done");
                        const overdue   = fromTasks.filter(t=>t.dueDate&&t.dueDate<TODAY).length;
                        return (
                          <tr key={from} style={{borderBottom:`1px solid ${C.s2}`}}>
                            <td style={{padding:"10px 14px",fontWeight:700}}>{from==="RH"?"Region Heads":"Sales Executives"}</td>
                            <td style={{padding:"10px 14px",color:C.accent,fontWeight:700}}>{from==="RH"?Math.ceil(fromTasks.length/2):Math.floor(fromTasks.length/2)}</td>
                            <td style={{padding:"10px 14px",color:overdue>0?C.red:C.green,fontWeight:700}}>{from==="RH"?Math.ceil(overdue/2):Math.floor(overdue/2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── TASKS GIVEN ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>4 · Tasks Given</div>
                <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["To","Open","Overdue"].map(h=>(
                        <th key={h} style={{padding:"7px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {label:"Region Heads",     depts:["RH North","RH South","RH East","RH West","RH National"]},
                        {label:"Sales Executives",  depts:reps.map(r=>String(r.id))},
                        {label:"Sales Strategy",    depts:["Sales Strategy"]},
                      ].map(({label,depts})=>{
                        const open    = tasks.filter(t=>depts.some(d=>t.dept===d||String(t.assignedTo)===d)&&t.status!=="Done").length;
                        const overdue = tasks.filter(t=>depts.some(d=>t.dept===d||String(t.assignedTo)===d)&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY).length;
                        return (
                          <tr key={label} style={{borderBottom:`1px solid ${C.s2}`}}>
                            <td style={{padding:"10px 14px",fontWeight:700}}>{label}</td>
                            <td style={{padding:"10px 14px",color:open>0?C.accent:C.green,fontWeight:700}}>{open}</td>
                            <td style={{padding:"10px 14px",color:overdue>0?C.red:C.green,fontWeight:700}}>{overdue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── ESCALATIONS / APPROVALS ── */}
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>5 · Escalations / Approvals</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                  {[
                    {label:"Pending Approvals",  val:internalReqs.filter(r=>r.dept==="NSH"&&r.status==="Pending").length,   color:C.orange},
                    {label:"Overdue Approvals",  val:internalReqs.filter(r=>r.dept==="NSH"&&r.status==="Overdue").length,   color:C.red},
                    {label:"Target Approvals",   val:targetSubs.filter(t=>t.status==="Pending NSH").length,                  color:C.accent},
                    {label:"Deals Awaiting NSH", val:deals.filter(d=>d.awaitingApproval==="NSH"&&d.outcome!=="Mail Confirmed").length, color:C.purple},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"12px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                      <div className="sans" style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* ── SUPPORT REQUESTS panel (NSH War Room) ── */}
                {(()=>{
                  const openSRsNSH = internalReqs.filter(r=>
                    r.type==="Support Request" &&
                    !["Done","Withdrawn","Rejected"].includes(r.status||"")
                  );
                  if (!openSRsNSH.length) return null;
                  return (
                    <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13}}>🆘</span>
                          <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {openSRsNSH.length} open</span>
                        </div>
                        <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                      </div>
                      {openSRsNSH.slice(0,4).map(sr=>{
                        const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                        const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                        return (
                          <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                              <div style={{fontSize:10,color:C.dim}}>{sr.raisedByName} · → {sr.dept}</div>
                            </div>
                            <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                            {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                          </div>
                        );
                      })}
                      {openSRsNSH.length>4&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{openSRsNSH.length-4} more</div>}
                    </div>
                  );
                })()}

                {/* ── DYNAMIC ANALYSIS ── */}
                {(()=>{
                  const activeD  = allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome));
                  const closedD  = allD.filter(d=>d.outcome==="Mail Confirmed");

                  // National-level signals
                  const staleNational  = activeD.filter(d=>daysSince(d.lastContact)>=7);
                  const bigStale       = staleNational.filter(d=>d.targetAmount>=5000000);
                  const overdueNational= allD.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                  const closingSoon    = activeD.filter(d=>["Very Interested","Interested – Needs Revision"].includes(d.outcome)&&d.nextStepDate&&d.nextStepDate<=TOMORROW);
                  const pendingNSH     = targetSubs.filter(t=>t.status==="Pending NSH");
                  const blockedDeals   = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");

                  // Region-level analysis
                  const GEOS = ["North","South","East","West","Odisha"];
                  const regionAnalysis = GEOS.map(reg=>{
                    const rd  = allD.filter(d=>d.region===reg);
                    const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const rRegIds=[...new Set(rd.map(d=>d.repId))];
                    const rC  = revenueEntries.filter(e=>rRegIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    const rPct= rT>0?Math.round((rC/rT)*100):null;
                    const hasDigital = rd.some(d=>d.dealType==="Digital"&&d.outcome!=="Not Interested");
                    return {reg, rT, rC, rPct, hasDigital, count:rd.length};
                  });
                  const laggingRegions  = regionAnalysis.filter(r=>r.rPct!==null&&r.rPct<40);
                  const noDigitalRegions= regionAnalysis.filter(r=>r.count>0&&!r.hasDigital);

                  // Rep-level signals
                  const repPcts = reps.map(r=>{
                    const rd=allD.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=revenueEntries.filter(e=>e.repId===r.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    return {name:r.name,region:r.region,pct:t>0?Math.round((c/t)*100):null};
                  }).filter(r=>r.pct!==null);
                  const laggingReps = repPcts.filter(r=>r.pct<30);

                  // Forecast vs target gap
                  const fcastGapSevere = gap > totT * 0.3; // >30% gap to forecast

                  const insights: {priority:"critical"|"warning"|"good", text:string}[] = [];

                  // Critical
                  if(bigStale.length>0)       insights.push({priority:"critical", text:`${bigStale.length} high-value deal${bigStale.length>1?"s":""} (₹50L+) with no contact in 7+ days — ${bigStale.slice(0,3).map(d=>d.clientCompany).join(", ")}${bigStale.length>3?" +more":""}.`});
                  if(fcastGapSevere)           insights.push({priority:"critical", text:`Forecast gap of ${fmtR(gap)} (${Math.round((gap/totT)*100)}% of target) — aggressive recovery actions required this week.`});
                  if(laggingRegions.length>0)  insights.push({priority:"critical", text:`${laggingRegions.map(r=>`${r.reg} (${r.rPct}%)`).join(", ")} ${laggingRegions.length===1?"region is":"regions are"} significantly below target — escalate to Region Head.`});
                  if(blockedDeals.length>0)    insights.push({priority:"critical", text:`${blockedDeals.length} deal${blockedDeals.length>1?"s":""} blocked awaiting approval — ${blockedDeals.slice(0,2).map(d=>d.clientCompany).join(", ")}. Unblock immediately.`});

                  // Warning
                  if(staleNational.length>0)   insights.push({priority:"warning",  text:`${staleNational.length} active deal${staleNational.length>1?"s":""} with no contact in 7+ days across all regions.`});
                  if(overdueNational.length>0)  insights.push({priority:"warning",  text:`${overdueNational.length} overdue next step${overdueNational.length>1?"s":""} organisation-wide — reps need to action today.`});
                  if(pendingNSH.length>0)       insights.push({priority:"warning",  text:`${pendingNSH.length} target submission${pendingNSH.length>1?"s":""} pending your approval.`});
                  if(laggingReps.length>0)      insights.push({priority:"warning",  text:`${laggingReps.map(r=>`${r.name}/${r.region} (${r.pct}%)`).join(", ")} ${laggingReps.length===1?"is":"are"} well below 30% — flag to RH for coaching.`});
                  if(noDigitalRegions.length>0) insights.push({priority:"warning",  text:`${noDigitalRegions.map(r=>r.reg).join(", ")} ${noDigitalRegions.length===1?"region has":"regions have"} no Digital deals in pipeline — push for cross-sell.`});

                  // Good
                  if(closingSoon.length>0)      insights.push({priority:"good",     text:`${closingSoon.length} deal${closingSoon.length>1?"s":""} likely to close this week — ${closingSoon.slice(0,3).map(d=>d.clientCompany).join(", ")}.`});
                  if(closePct>=80)               insights.push({priority:"good",     text:`Organisation at ${closePct}% of target — strong performance. Focus on pipeline hygiene to protect the number.`});
                  if(insights.filter(i=>i.priority==="critical").length===0&&insights.filter(i=>i.priority==="warning").length===0) insights.push({priority:"good", text:"No critical issues nationally. All regions active, approvals clear, reps on track."});

                  const pIcon   = {critical:"🔴",warning:"🟡",good:"🟢"};
                  const pBorder = {critical:C.red,warning:C.orange,good:C.green};
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{height:1,background:C.border,marginBottom:16}} />
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}>
                        DYNAMIC ANALYSIS · National Intelligence
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {insights.map((ins,i)=>(
                          <div key={i} style={{background:C.surface,border:`1px solid ${pBorder[ins.priority]}44`,borderLeft:`3px solid ${pBorder[ins.priority]}`,borderRadius:7,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <span style={{fontSize:13,flexShrink:0}}>{pIcon[ins.priority]}</span>
                            <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{ins.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

          {/* ═══ WAR ROOM ═══ */}
          {view==="warroom" && !isRH && !isNSHDashboard && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
              </div>

              {/* ── PIPELINE GAP STRIP ── */}
              {(()=>{
                const wrAllD = visibleDeals.filter(d=>qMatch(d.quarter));
                const wrT  = wrAllD.reduce((s,d)=>s+(d.targetAmount||0),0);
                const wrC  = revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const wrP  = wrAllD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const wrGap = Math.max(0, wrT - wrC - wrP);
                const wrPct  = wrT>0?Math.round((wrC/wrT)*100):0;
                const wrPPct = wrT>0?Math.round((wrP/wrT)*100):0;
                if(!wrT) return null;
                return (
                  <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                    {[
                      {label:"TARGET", val:fmtR(wrT), color:C.text},
                      {label:`ACHIEVED (${wrPct}%)`, val:fmtR(wrC), color:C.green},
                      {label:`PIPELINE (${wrPPct}%)`, val:fmtR(wrP), color:C.blue},
                      {label:"PIPELINE GAP", val:wrGap===0?"✓ On track":fmtR(wrGap), color:wrGap===0?C.green:C.red},
                    ].map(m=>(
                      <div key={m.label} style={{flex:"1 1 120px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{m.label}</div>
                        <div className="sans" style={{fontSize:16,fontWeight:800,color:m.color}}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── SUPPORT REQUESTS (system-wide open, visible to Strategy/CRO/Admin) ── */}
              {!isRep && (()=>{
                const openSRs = internalReqs.filter(r=>
                  r.type==="Support Request" &&
                  !["Done","Withdrawn","Rejected"].includes(r.status||"")
                );
                if (!openSRs.length) return null;
                return (
                  <div style={{background:`${C.purple}06`,border:`1.5px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13}}>🆘</span>
                        <span className="sans" style={{fontWeight:700,fontSize:12,color:C.purple}}>SUPPORT REQUESTS · {openSRs.length} open system-wide</span>
                      </div>
                      <button onClick={()=>setView("internal-requests")} style={{background:C.purple,color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>View All →</button>
                    </div>
                    {openSRs.slice(0,5).map(sr=>{
                      const pColor = sr.priority==="Urgent"?C.red:sr.priority==="High"?C.orange:C.blue;
                      const sc = sr.status==="Accepted"?C.green:sr.status==="In Progress"?C.blue:C.orange;
                      return (
                        <div key={sr.id} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",marginBottom:5,borderLeft:`3px solid ${sc}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:11,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sr.subject.replace(/^\[Support\]\s*/,"")}</div>
                            <div style={{fontSize:10,color:C.dim}}>{sr.raisedByName} · → {sr.dept}</div>
                          </div>
                          <span style={{background:`${sc}22`,color:sc,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{sr.status}</span>
                          {sr.priority&&sr.priority!=="Medium"&&<span style={{background:`${pColor}18`,color:pColor,padding:"1px 6px",borderRadius:4,fontSize:9,whiteSpace:"nowrap"}}>{sr.priority}</span>}
                        </div>
                      );
                    })}
                    {openSRs.length>5&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>+{openSRs.length-5} more</div>}
                  </div>
                );
              })()}

              {/* REP ACTION ITEMS — only for sales reps */}
              {isRep && (()=>{
                const myRepId = user_role?.repId;
                const myDeals = visibleDeals.filter(d=>d.repId===myRepId);
                const myOverdue = myDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed");
                const myAtRisk  = myDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&(d.atRisk||daysSince(d.lastContact)>=7));
                const myBlocked = myDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed");
                const myTasks_r = tasks.filter(t=>(t.assignedTo===myRepId||t.assignedToUserId===activeUser)&&t.status!=="Done");
                const total = myOverdue.length+myAtRisk.length+myTasks_r.length+myBlocked.length;
                if(!total) return <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:12,color:C.green}}>✓ No action items. You're on track.</div>;
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:16}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Action Items · {total} pending</div>
                    {myOverdue.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.orange,fontSize:12,flexShrink:0}}>⚠</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · Next step overdue: {d.nextStep}</span></div>
                        <span style={{fontSize:10,color:C.orange,whiteSpace:"nowrap"}}>was due {d.nextStepDate}</span>
                      </div>
                    ))}
                    {myAtRisk.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.red,fontSize:12,flexShrink:0}}>●</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · No contact in {daysSince(d.lastContact)} days</span></div>
                        <span style={{color:C.accent,fontWeight:700,fontSize:11}}>{fmtR(d.amount)}</span>
                      </div>
                    ))}
                    {myBlocked.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.orange,fontSize:12,flexShrink:0}}>⏳</span>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:600}}>{d.clientCompany}</span>
                          <span style={{color:C.dim,fontSize:11}}> · waiting on </span>
                          <span style={{color:C.orange,fontWeight:600,fontSize:11}}>{d.awaitingApproval}</span>
                          <span style={{color:C.muted,fontSize:10}}> ({daysSince(d.awaitingApprovalSince||TODAY)}d)</span>
                        </div>
                        <span style={{color:C.accent,fontWeight:700,fontSize:11}}>{fmtR(d.amount)}</span>
                      </div>
                    ))}
                    {myTasks_r.map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.s2}`}}>
                        <span style={{color:C.blue,fontSize:12,flexShrink:0}}>📋</span>
                        <div style={{flex:1}}><span style={{fontWeight:600}}>{t.title}</span>{t.clientCompany&&<span style={{color:C.dim,fontSize:11}}> · {t.clientCompany}</span>}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:10,color:C.dim}}>Due {t.dueDate}</span>
                          <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* KPIs — rep: 4 calcNumbers cards + 2 count tiles; management: 5 cards */}
              {isRep ? (()=>{
                const wrRepId  = user_role?.repId;
                const wrTarget = targetSubs.filter(t=>t.repId===wrRepId&&t.status==="Approved").reduce((s,t)=>s+(t.totalTarget||t.clients?.reduce((ss,c)=>ss+(c.targetAmount||0),0)||0),0);
                const wrAch    = getAchieved(wrRepId);
                const wrCmt    = getCommitted(wrRepId);
                const wrInp    = getInPlay(wrRepId);
                const wrSf     = getShortfall(wrTarget,wrRepId);
                const wrPct    = wrTarget>0?Math.round((wrAch/wrTarget)*100):0;
                const wrOpenAI = tasks.filter(t=>(t.assignedTo===wrRepId||t.assignedToUserId===activeUser)&&t.status!=="Done").length;
                const wrAtRisk = visibleDeals.filter(d=>d.repId===wrRepId&&!["Mail Confirmed","Not Interested"].includes(dealStage(d))&&daysSince(d.lastContact||d.lastDealMeetingDate)>=7).length;
                return (<>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
                    {[
                      {label:"ACHIEVED",  value:fmtR(wrAch), color:C.green,  sub:`${wrPct}% of target`},
                      {label:"COMMITTED", value:fmtR(wrCmt), color:C.blue,   sub:"Mail Confirmed"},
                      {label:"IN PLAY",   value:fmtR(wrInp), color:C.accent, sub:"In Discussion / Negotiation"},
                      {label:"SHORTFALL", value:fmtR(wrSf),  color:wrSf===0?C.green:C.red, sub:wrSf===0?"On track":"Gap remaining"},
                    ].map(k=>(
                      <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                        <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                        {k.sub&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <div className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Open Action Items</div>
                        <div className="sans" style={{fontSize:26,fontWeight:800,color:wrOpenAI>0?C.orange:C.green}}>{wrOpenAI}</div>
                      </div>
                      <span style={{fontSize:28,opacity:.25}}>📋</span>
                    </div>
                    <div className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>At-Risk Clients</div>
                        <div className="sans" style={{fontSize:26,fontWeight:800,color:wrAtRisk>0?C.red:C.green}}>{wrAtRisk}</div>
                      </div>
                      <span style={{fontSize:28,opacity:.25}}>⚠</span>
                    </div>
                  </div>
                </>);
              })() : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"CLOSED QTD",    value:fmtR(closedRevenue),   sub:`${totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0}% of target`, color:C.green,  bar:totalTarget>0?Math.round((closedRevenue/totalTarget)*100):0},
                  {label:"FORECAST",      value:fmtR(forecast),         sub:`${fcastPct}% likely`,    color:fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red, bar:fcastPct},
                  {label:"GAP TO TARGET", value:fmtR(gap),             sub:gap===0?"on track":"uncovered", color:gap===0?C.green:C.red},
                  {label:"AT RISK",       value:atRisk.length,          sub:`${fmtR(atRisk.reduce((s,a)=>s+(a.annualTarget||0),0))} at stake`, color:atRisk.length>0?C.red:C.green},
                  {label:"OVERDUE",       value:overdueNext.length,     sub:"next steps past due",    color:overdueNext.length>0?C.orange:C.green},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                    <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    {k.sub&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>}
                    {k.bar!=null&&<div className="pbar" style={{marginTop:7}}><div className="pfill" style={{width:`${Math.min(k.bar,100)}%`,background:k.color}} /></div>}
                  </div>
                ))}
              </div>)}

              {/* MANAGEMENT SECTIONS — hidden from reps */}
              {!isRep && (
                <div>
                  {/* At risk */}
                  {atRisk.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>NO CONTACT 7+ DAYS</div>
                      {atRisk.map(a=>{const rep=reps.find(r=>r.id===a.repId);return(
                        <div key={a.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:5,padding:"9px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{a.clientName}</span><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span><span className="pill" style={{background:`${oColor(a.currentStage)}22`,color:oColor(a.currentStage),marginLeft:8,fontSize:10}}>{a.currentStage}</span></div>
                          <span style={{color:C.red,fontSize:11,whiteSpace:"nowrap"}}>{daysSince(a.lastDealMeetingDate||a.lastContactDate)}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(a.annualTarget)}</span>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* Overdue next steps */}
                  {overdueNext.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>OVERDUE NEXT STEPS</div>
                      {overdueNext.map(d=>{const rep=reps.find(r=>r.id===d.repId);return(
                        <div key={d.id} style={{background:`${C.orange}06`,border:`1px solid ${C.orange}22`,borderRadius:5,padding:"9px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · {rep?.name} · {d.nextStep}</span></div>
                          <span style={{color:C.orange,fontSize:11,whiteSpace:"nowrap"}}>was due {d.nextStepDate}</span>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* High probability + compliance — two columns */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div className="card" style={{padding:14}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>HIGH PROBABILITY — PUSH TO CLOSE</div>
                      {visibleDeals.filter(d=>["Very Interested","Mail Confirmed"].includes(d.outcome)).sort((a,b)=>b.amount-a.amount).slice(0,4).map(d=>{
                        const rep=reps.find(r=>r.id===d.repId);
                        return(
                          <div key={d.id} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.s2}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <span className="sans" style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</span>
                              <span style={{color:C.green,fontWeight:700,fontSize:12}}>{fmtR(d.amount)}</span>
                            </div>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:10,color:C.dim}}>{rep?.name}</span>
                              <span style={{padding:"2px 8px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{d.outcome}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="card" style={{padding:14}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>COMPLIANCE — TODAY · 11:30 PM</div>
                      {reps.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(r=>{
                        const tL=meetings.some(m=>m.repId===r.id&&m.date===TODAY&&m.status==="logged");
                        const tP=meetings.some(m=>m.repId===r.id&&m.date===TOMORROW&&m.status==="planned");
                        const ok=tL&&tP;
                        return(
                          <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontSize:13,color:ok?C.green:C.red,fontWeight:700,width:16}}>{ok?"✓":"✗"}</span>
                            <span className="sans" style={{flex:1,fontSize:12,fontWeight:600}}>{r.name}</span>
                            <span style={{fontSize:10,color:tL?C.green:C.red}}>Log</span>
                            <span style={{fontSize:10,color:tP?C.green:C.orange}}>Plan</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ REVENUE TRACKER ═══ */}
          {view==="pipeline" && (
            <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REVENUE TRACKER</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{isDigiOps?"Website · App · Social · Direct · Internal · Programmatic":"Linear TV · IPs · Digital · Media Solutions · Integrated Packages"}</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Deal</button>
                </div>

                {/* Tab switcher */}
                <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
                  {(isDigiOps ? [
                    {id:"accounts",    label:"Website",      sub:"Digital"},
                    {id:"digi-app",    label:"App",          sub:"Mobile"},
                    {id:"digi-social", label:"Social Media", sub:"Platforms"},
                    {id:"digi-direct", label:"Direct",       sub:"Direct sales"},
                    {id:"digi-internal",label:"Internal",    sub:"Cross-sell"},
                    {id:"digi-prog",   label:"Programmatic", sub:"Automated"},
                  ] : [
                    {id:"accounts",        label:"Accounts",            sub:"All clients"},
                    {id:"linear-tv",       label:"Linear TV",           sub:"TV deals"},
                    {id:"properties",      label:"IPs",                 sub:"IP inventory"},
                    {id:"digital",         label:"Digital",             sub:"Online deals"},
                    {id:"brand",           label:"Media Solutions",     sub:"Custom packages"},
                    {id:"integrated",      label:"Integrated Packages", sub:"Multi-platform"},
                    {id:"revenue-report",  label:"Revenue Report",      sub:"From entries"},
                  ]).map(t=>(
                    <button key={t.id} onClick={()=>setRtTab(t.id)}
                      style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:rtTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",color:rtTab===t.id?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:rtTab===t.id?700:400,textAlign:"left",whiteSpace:"nowrap"}}>
                      <div>{t.label}</div>
                      <div style={{fontSize:9,color:C.muted,marginTop:1}}>{t.sub}</div>
                    </button>
                  ))}
                </div>

                {/* ── ACCOUNTS TAB ── spec: all clientAccounts for visible reps, per-account numbers ── */}
                {rtTab==="accounts" && (()=>{
                  const visibleAccts = clientAccounts
                    .filter(a => visibleRepIdsSet.has(a.repId))
                    .sort((a,b) => daysSince(b.lastDealMeetingDate||b.lastContactDate) - daysSince(a.lastDealMeetingDate||a.lastContactDate));
                  return (
                  <div>
                    {visibleAccts.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No approved client accounts yet.</div>}
                    {visibleAccts.length>0&&(
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {visibleAccts.map(a=>{
                              const rep = reps.find(r=>r.id===a.repId);
                              const ach = revenueEntries.filter(e=>(e.clientAccountId===a.id||(e.repId===a.repId&&e.clientCompany===a.clientName&&!e.clientAccountId))&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                              const cmt = a.currentStage==="Mail Confirmed"?(a.annualTarget||0):0;
                              const inp = ["In Discussion","Negotiation"].includes(a.currentStage||"")?(a.annualTarget||0):0;
                              const sf  = Math.max(0,(a.annualTarget||0)-ach-cmt-inp);
                              const idle = daysSince(a.lastDealMeetingDate||a.lastContactDate);
                              const pct  = (a.annualTarget||0)>0?Math.round((ach/(a.annualTarget||0))*100):0;
                              return (
                                <tr key={a.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                                  onClick={()=>{setAccountThreadClient(a.clientName);setAccountThreadOpen(true);}}
                                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                  onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}>
                                    <div className="sans" style={{fontWeight:700}}>{a.clientName}</div>
                                    {idle>=7&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>COLD {idle}d</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{a.channel||"—"}</td>
                                  <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(a.annualTarget||0)}</td>
                                  <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>
                                    {ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}
                                  </td>
                                  <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                  <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                  <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                  <td style={{padding:"9px 14px"}}>
                                    <span style={{padding:"2px 8px",background:`${oColor(a.currentStage)}18`,border:`1px solid ${oColor(a.currentStage)}44`,borderRadius:5,color:oColor(a.currentStage),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{a.currentStage||"—"}</span>
                                  </td>
                                  <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* ── LINEAR TV TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Linear TV");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Linear TV"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dP=dtDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="linear-tv" ? (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* ── PROPERTIES / IPs TAB ── */}
                {rtTab==="properties" && (()=>{
                  // Part 10+12: IPs tab is read-only for Sales Reps
                  if (isRep) return (
                    <div style={{textAlign:"center",padding:"48px 24px",color:C.dim,background:C.s2,borderRadius:10,marginTop:8}}>
                      <div style={{fontSize:24,marginBottom:12}}>📋</div>
                      <div className="sans" style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8}}>IP Inventory — Read Only</div>
                      <div style={{fontSize:12,color:C.dim,maxWidth:400,margin:"0 auto",lineHeight:1.7}}>
                        IP inventory is managed centrally by Sales Strategy. Speak to your Region Head to link an IP deal to your targets.
                      </div>
                    </div>
                  );
                  // Deals-based metrics (mirrors Linear TV tab structure)
                  const ipDeals = visibleDeals.filter(d=>d.dealType==="IPs");
                  const ipDT = ipDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const ipDC = revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="IPs"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const ipDG = Math.max(0,ipDT-ipDC); const ipPct = ipDT>0?Math.round((ipDC/ipDT)*100):0;
                  const ipDsc = ipPct>=80?C.green:ipPct>=50?C.accent:C.red;

                  const visibleIPs = IP_CATALOG.filter(ip=>qMatch(ip.quarter));
                  const canApprove  = isStrategy || isNSH || isCRORole || isAdmin;
                  const stColor = s => s==="Committed"?C.green:s==="In Discussion"?C.orange:C.muted;
                  // Closed-at visible to: RH/NSH/CRO/Strategy/Admin, or the rep who owns the proposal/elem
                  const canSeeCA = (ownRepId) =>
                    isRH || isNSH || isCRORole || isStrategy || isAdmin ||
                    (isRep && ownRepId === user_role?.repId);

                  // Helper: get live proposals for one element
                  const getEP = (ipId, elemId) => ipProposals.filter(p=>p.ipId===ipId&&p.elemId===elemId);

                  // Submit a new proposal + create linked IPs deal in pipeline
                  const submitProposal = (ip, elem) => {
                    if (!ipPropClient.trim()) { showToast("Enter client name","err"); return; }
                    const myRep = reps.find(r=>r.id===user_role?.repId);
                    const propId = `ipr${Date.now()}`;
                    const prop = {
                      id: propId,
                      ipId: ip.id, elemId: elem.id,
                      repId: user_role?.repId, repName: myRep?.name||user_role?.name||"Rep",
                      client: ipPropClient.trim(),
                      proposedValue: parseCurrency(ipPropValue)||null,
                      note: ipPropNote.trim(),
                      proposedAt: TODAY,
                      status: "Pending",
                      closedAt: null, approvedBy: null, approvedAt: null,
                    };
                    setIpProposals(prev=>[...prev, prop]);
                    // Create linked IPs deal so it appears in the rep's pipeline
                    const existingIpDeal = deals.find(d=>d.repId===user_role?.repId&&d.dealType==="IPs"&&d.clientCompany===ipPropClient.trim()&&d.ipPropId===propId);
                    if (!existingIpDeal) {
                      const newDeal = {
                        id:`d_ip_${Date.now()}`, repId:user_role?.repId, repName:myRep?.name||"",
                        region:myRep?.region||"", clientCompany:ipPropClient.trim(),
                        contactName:"", designation:"", contactLevel:"", phone:"", email:"",
                        dealType:"IPs", outcome:"In Discussion", stage:"In Discussion",
                        amount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        pipelineAmount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        targetAmount: parseCurrency(ipPropValue)||elem.rackRate||0,
                        lossReason:"", priority:"Regular", quarter:ip.quarter||filterQ,
                        notes:ipPropNote.trim(), nextStep:"", nextStepDate:"",
                        agencyName:"", zohoAgencyId:"", reqs:[], auditLog:[],
                        ipId:ip.id, elemId:elem.id, ipPropId:propId,
                        lastDealMeetingDate:TODAY, lastContact:TODAY,
                      };
                      setDeals(prev=>[newDeal,...prev]);
                    }
                    setIpPropClient(""); setIpPropNote(""); setIpPropValue(""); setIpPropOpen(null);
                    showToast(`Pitched to client — deal added to pipeline. Awaiting Sales Strategy approval ✓`);
                  };

                  // Approve a proposal
                  const approveProposal = (prop) => {
                    const price = parseCurrency(ipApprovalPrices[prop.id]||"") || null;
                    setIpProposals(prev=>prev.map(p=>p.id===prop.id
                      ? {...p, status:"Approved", closedAt:price, approvedBy:activeUser, approvedAt:TODAY}
                      : p));
                    setIpApprovalPrices(prev=>{const n={...prev};delete n[prop.id];return n;});
                    showToast(`${prop.client} approved for ${prop.repName} ✓`);
                  };

                  // Reject a proposal
                  const rejectProposal = (prop) => {
                    setIpProposals(prev=>prev.map(p=>p.id===prop.id ? {...p, status:"Rejected"} : p));
                    showToast(`Proposal rejected`,"ok");
                  };

                  return (
                    <div>
                      {/* ── IPs DEALS PIPELINE (deals-based, mirrors Linear TV) ── */}
                      {ipDT>0&&(
                        <div style={{marginBottom:20}}>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[{label:"TARGET",value:fmtR(ipDT),color:C.accent},{label:"ACHIEVED",value:fmtR(ipDC),color:C.green},{label:"SHORTFALL",value:fmtR(ipDG),color:ipDG===0?C.green:C.red},{label:"% COMPLETE",value:`${ipPct}%`,color:ipDsc}].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                            <div style={{height:"100%",width:`${Math.min(ipPct,100)}%`,background:ipDsc,borderRadius:2}}/>
                          </div>
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                              <tbody>
                                {ipDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                  const rep=reps.find(r=>r.id===d.repId);
                                  const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                  const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                  const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                  const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                  const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                      <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                      <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                      <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                      <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                      <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                      <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                      <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                      <td style={{padding:"9px 14px"}}><span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span></td>
                                      <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div style={{height:1,background:C.border,marginBottom:20}}/>
                        </div>
                      )}
                      {/* ── IP CATALOG / INVENTORY ── */}
                      {visibleIPs.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No IPs scheduled for {filterQ}.</div>}
                      {visibleIPs.map(ip=>{
                        // Live per-element status (proposals override static)
                        const liveElem = (elem) => {
                          const ep = getEP(ip.id, elem.id);
                          const approved = ep.filter(p=>p.status==="Approved");
                          const pending  = ep.filter(p=>p.status==="Pending");
                          const effStatus = approved.length>0?"Committed"
                            : pending.length>0&&elem.status==="Available"?"In Discussion"
                            : elem.status;
                          return {ep, approved, pending, effStatus};
                        };
                        const totalRack    = ip.elements.reduce((s,e)=>s+e.rackRate,0);
                        const committedVal = ip.elements.reduce((s,e)=>{
                          const {effStatus}=liveElem(e); return effStatus==="Committed"?s+e.rackRate:s;},0);
                        const discVal      = ip.elements.reduce((s,e)=>{
                          const {effStatus}=liveElem(e); return effStatus==="In Discussion"?s+e.rackRate:s;},0);
                        const committedCnt = ip.elements.filter(e=>liveElem(e).effStatus==="Committed").length;
                        const discCnt      = ip.elements.filter(e=>liveElem(e).effStatus==="In Discussion").length;
                        const availCnt     = ip.elements.filter(e=>liveElem(e).effStatus==="Available").length;
                        const soldPct      = totalRack>0?Math.round((committedVal/totalRack)*100):0;
                        const pipePct      = totalRack>0?Math.round((discVal/totalRack)*100):0;

                        return (
                          <div key={ip.id} className="card" style={{marginBottom:14,padding:"16px 18px"}}>
                            {/* IP header */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                              <div>
                                <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:3}}>{ip.name}</div>
                                <div style={{fontSize:11,color:C.dim}}>{ip.type} · {ip.channel} · {ip.airDates}</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:11,color:C.dim,marginBottom:3}}>Rack Value: <span style={{color:C.text,fontWeight:700}}>{fmtR(totalRack)}</span></div>
                                <div style={{fontSize:10,color:C.dim}}>
                                  <span style={{color:C.green,fontWeight:700}}>{committedCnt} committed</span>
                                  {" · "}
                                  <span style={{color:C.orange,fontWeight:700}}>{discCnt} in discussion</span>
                                  {" · "}
                                  <span style={{color:C.muted}}>{availCnt} available</span>
                                </div>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",position:"relative",marginBottom:14}}>
                              <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(soldPct,100)}%`,background:C.green,borderRadius:2}}/>
                              <div style={{position:"absolute",left:`${soldPct}%`,height:"100%",width:`${Math.min(pipePct,100-soldPct)}%`,background:`${C.accent}88`,borderRadius:2}}/>
                            </div>
                            {/* Elements table */}
                            <div style={{background:C.s2,borderRadius:6,overflow:"hidden"}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                <thead>
                                  <tr>
                                    {["Element","Rack Rate","Status","Client","Sales Rep","Closed At",""].map((h,hi)=>(
                                      <th key={hi} style={{padding:"8px 12px",background:C.s3,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>
                                        {hi===5 && isRep && !canApprove ? "Closed At 🔒" : h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {ip.elements.map((elem,ei)=>{
                                    const {ep, approved, pending, effStatus} = liveElem(elem);
                                    const rejected = ep.filter(p=>p.status==="Rejected");
                                    const sc  = stColor(effStatus);
                                    const fk  = `${ip.id}-${elem.id}`;
                                    const panelOpen = ipPropOpen===fk;
                                    const myProposal = isRep ? ep.find(p=>p.repId===user_role?.repId) : null;
                                    // Effective display values
                                    const effClient  = approved.length>0 ? approved.map(p=>p.client).join(", ") : elem.client;
                                    const effRepName = approved.length>0 ? approved.map(p=>p.repName).join(", ") : (elem.repId?reps.find(r=>r.id===elem.repId)?.name:null);
                                    const effClosedAt= approved.length>0 ? approved[0].closedAt : elem.closedAt;
                                    const effRepId   = approved.length>0 ? approved[0].repId    : elem.repId;
                                    const seeCA      = canSeeCA(effRepId);
                                    // Pending visible to strategy or the proposing rep
                                    const showPendingBadge = canApprove&&pending.length>0;
                                    const canPropose = isRep && !myProposal && effStatus!=="Committed";
                                    const rowBg = panelOpen?`${C.accent}08`:ei%2===0?"transparent":C.s2+"44";

                                    return (
                                      <React.Fragment key={elem.id}>
                                        {/* Main element row */}
                                        <tr style={{borderBottom:panelOpen?`1px solid ${C.accent}44`:`1px solid ${C.border}`,background:rowBg}}>
                                          <td style={{padding:"10px 12px",fontWeight:600,color:C.text}}>{elem.label}</td>
                                          <td style={{padding:"10px 12px",fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>{fmtR(elem.rackRate)}</td>
                                          <td style={{padding:"10px 12px"}}>
                                            <span style={{background:`${sc}22`,color:sc,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{effStatus}</span>
                                            {pending.length>0&&effStatus!=="Committed"&&<span style={{marginLeft:5,background:`${C.orange}22`,color:C.orange,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>{pending.length} proposal{pending.length!==1?"s":""}</span>}
                                          </td>
                                          <td style={{padding:"10px 12px",color:effClient?C.text:C.muted,fontSize:11}}>
                                            {effClient||
                                              (pending.length>0&&!canApprove&&myProposal&&myProposal.status==="Pending"
                                                ? <span style={{color:C.orange,fontStyle:"italic"}}>Your proposal pending</span>
                                                : "—")}
                                          </td>
                                          <td style={{padding:"10px 12px",color:effRepName?C.dim:C.muted,fontSize:11}}>{effRepName||"—"}</td>
                                          <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                                            {effStatus==="Available"&&!pending.length ? (
                                              <span style={{color:C.muted,fontSize:11}}>—</span>
                                            ) : seeCA ? (
                                              effClosedAt!=null ? (
                                                <span style={{color:C.green,fontWeight:700}}>{fmtR(effClosedAt)}
                                                  {effClosedAt<elem.rackRate&&<span style={{color:C.red,fontSize:10,marginLeft:5}}>({Math.round((1-effClosedAt/elem.rackRate)*100)}% off)</span>}
                                                </span>
                                              ) : <span style={{color:C.orange,fontSize:11}}>Pending close</span>
                                            ) : (
                                              <span style={{color:C.muted,fontSize:11,fontStyle:"italic"}}>Confidential</span>
                                            )}
                                          </td>
                                          {/* Action cell */}
                                          <td style={{padding:"6px 12px",whiteSpace:"nowrap",textAlign:"right"}}>
                                            {canPropose&&(
                                              <button onClick={()=>{setIpPropOpen(panelOpen?null:fk);setIpPropClient("");setIpPropNote("");setIpPropValue("");}}
                                                style={{background:panelOpen?C.s3:`${C.blue}18`,border:`1px solid ${panelOpen?C.border:C.blue}44`,color:panelOpen?C.dim:C.blue,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                {panelOpen?"✕ Cancel":"+ Propose"}
                                              </button>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Pending"&&(
                                              <span style={{background:`${C.orange}15`,border:`1px solid ${C.orange}44`,color:C.orange,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>⏳ Pending</span>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Approved"&&(
                                              <span style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>✓ Approved</span>
                                            )}
                                            {isRep&&myProposal&&myProposal.status==="Rejected"&&(
                                              <span style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700}}>✗ Rejected</span>
                                            )}
                                            {showPendingBadge&&(
                                              <button onClick={()=>setIpPropOpen(panelOpen?null:fk)}
                                                style={{background:panelOpen?C.s3:`${C.orange}18`,border:`1px solid ${panelOpen?C.border:C.orange}55`,color:panelOpen?C.dim:C.orange,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                {panelOpen?"✕ Close":`Review ${pending.length}`}
                                              </button>
                                            )}
                                          </td>
                                        </tr>

                                        {/* ── Expandable panel ── */}
                                        {panelOpen&&(
                                          <tr>
                                            <td colSpan={7} style={{padding:0,borderBottom:`2px solid ${C.accent}33`}}>
                                              <div style={{padding:"12px 18px",background:`${C.accent}05`}}>

                                                {/* Rep proposal form */}
                                                {canPropose&&(
                                                  <div style={{marginBottom:canApprove?14:0}}>
                                                    <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:8,letterSpacing:".05em"}}>PROPOSE A CLIENT FOR THIS ELEMENT</div>
                                                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
                                                      <div style={{flex:"1 1 160px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Client name *</div>
                                                        <input value={ipPropClient} onChange={e=>setIpPropClient(e.target.value)}
                                                          placeholder="e.g. Godrej Consumer"
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <div style={{flex:"1 1 120px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Proposed value (optional)</div>
                                                        <input value={ipPropValue} onChange={e=>setIpPropValue(e.target.value)}
                                                          placeholder={`e.g. ${(elem.rackRate/100000).toFixed(0)}L`}
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <div style={{flex:"2 1 180px"}}>
                                                        <div style={{fontSize:10,color:C.dim,marginBottom:3}}>Note</div>
                                                        <input value={ipPropNote} onChange={e=>setIpPropNote(e.target.value)}
                                                          placeholder="Budget confirmed / in discussion…"
                                                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                                                      </div>
                                                      <button onClick={()=>submitProposal(ip,elem)}
                                                        style={{background:C.blue,border:"none",color:"#fff",borderRadius:5,padding:"6px 16px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>
                                                        Submit →
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Strategy / management approval panel */}
                                                {canApprove&&(pending.length>0||approved.length>0||rejected.length>0)&&(
                                                  <div>
                                                    <div style={{fontSize:11,fontWeight:700,color:C.dim,marginBottom:8,letterSpacing:".05em"}}>PROPOSALS</div>
                                                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                                      {[...pending,...approved,...rejected].map(prop=>{
                                                        const pRep = reps.find(r=>r.id===prop.repId);
                                                        const statusColor = prop.status==="Approved"?C.green:prop.status==="Rejected"?C.red:C.orange;
                                                        return (
                                                          <div key={prop.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:6,border:`1px solid ${statusColor}33`,flexWrap:"wrap"}}>
                                                            <div style={{flex:"1 1 200px"}}>
                                                              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{prop.client}</div>
                                                              <div style={{fontSize:10,color:C.dim}}>{pRep?.name||prop.repName} · {prop.proposedAt}{prop.note?` · "${prop.note}"`:""}</div>
                                                              {prop.proposedValue&&<div style={{fontSize:10,color:C.accent}}>Proposed: {fmtR(prop.proposedValue)}</div>}
                                                            </div>
                                                            <span style={{background:`${statusColor}18`,color:statusColor,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{prop.status}</span>
                                                            {prop.status==="Approved"&&prop.closedAt&&(
                                                              <span style={{fontSize:11,color:C.green,fontWeight:700}}>Closed: {fmtR(prop.closedAt)}</span>
                                                            )}
                                                            {prop.status==="Pending"&&canApprove&&(
                                                              <>
                                                                <input
                                                                  value={ipApprovalPrices[prop.id]||""}
                                                                  onChange={e=>setIpApprovalPrices(prev=>({...prev,[prop.id]:e.target.value}))}
                                                                  placeholder={`Closed at (e.g. ${(elem.rackRate/100000).toFixed(0)}L)`}
                                                                  style={{background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",width:140}}/>
                                                                <button onClick={()=>approveProposal(prop)}
                                                                  style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"4px 12px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                                                  Approve ✓
                                                                </button>
                                                                <button onClick={()=>rejectProposal(prop)}
                                                                  style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:5,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                                                  Reject
                                                                </button>
                                                              </>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Empty state for strategy when no proposals yet */}
                                                {canApprove&&ep.length===0&&(
                                                  <div style={{color:C.muted,fontSize:11,fontStyle:"italic"}}>No proposals submitted yet for this element.</div>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── ACTIVE DEALS TAB ── */}
                {/* ── BRAND SOLUTIONS TAB ── */}
                {rtTab==="brand" && (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:11,color:C.dim}}>Custom packages combining TV + Digital + On-ground + Content for brand campaigns</div>
                      {/* Part 12: No New Package button for Sales Rep */}
                      {!isRep && <button className="btn btn-primary" onClick={()=>{
                        const client = "New Client";  // use inline deal form
                        const pkg = "Custom Package";
                        const val = "1000000";
                        // TODO: replace with Add Deal modal
                        const newDeal = {...BLANK_DEAL,clientCompany:client,dealType:"Media Solutions",outcome:"Needs Callback",amount:parseCurrency(val||"0"),targetAmount:parseCurrency(val||"0"),quarter:entryQ,repId:user_role?.repId||"",lastContact:TODAY,notes:pkg};
                        setDeals(p=>[{id:`d${Date.now()}`,...newDeal,repId:parseInt(newDeal.repId)||5,region:user_role?.region||"National",reqs:[]},...p]);
                        showToast("Brand Solutions deal created ✓");
                      }}>+ New Package</button>}
                    </div>

                    {/* Brand Solutions deals */}
                    {(()=>{
                      const bsDeals = visibleDeals.filter(d=>d.dealType==="Media Solutions"||d.dealType==="Integrated Packages");
                      if(!bsDeals.length) return (
                        <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>No target set for this category this fiscal year.</div>
                        </div>
                      );
                      return bsDeals.map(d=>{
                        const rep = reps.find(r=>r.id===d.repId);
                        const idle = daysSince(d.lastContact);
                        const idleC = idle>=7?C.red:idle>=3?C.orange:C.green;
                        const stageC = oColor(d.outcome);
                        return (
                          <div key={d.id} className="card" style={{padding:"16px 18px",marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                  <span className="sans" style={{fontSize:15,fontWeight:700}}>{d.clientCompany}</span>
                                  <span style={{background:`${C.purple}18`,color:C.purple,padding:"1px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{d.dealType}</span>
                                </div>
                                <div style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region} · Last contact: <span style={{color:idleC,fontWeight:600}}>{idle===0?"today":`${idle}d ago`}</span></div>
                                {d.notes&&<div style={{fontSize:11,color:C.dim,marginTop:3,fontStyle:"italic"}}>{d.notes}</div>}
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div className="sans" style={{fontSize:20,fontWeight:800,color:C.green}}>{fmtR(d.amount)}</div>
                                <span style={{background:`${stageC}22`,color:stageC,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{d.outcome}</span>
                              </div>
                            </div>
                            {/* Package components */}
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                              {["TV FCT","Digital Video","On-Ground","Content","Influencer","OTT"].map(comp=>(
                                <span key={comp} style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10,border:`1px dashed ${C.border}`,cursor:"pointer"}}
                                  title="Click to mark as included">
                                  {comp}
                                </span>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                              <button onClick={()=>{setLogForm(p=>({...BLANK_LOG,repId:String(d.repId),dealId:d.id,clientAgencyName:d.clientCompany,contactName:d.contactName||""}));setLogOpen(true);}}
                                style={{background:`${C.accent}18`,border:"none",color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Log Touchpoint</button>
                              <button onClick={()=>{const ir={id:`ir${Date.now()}`,type:"Support",dept:"Branding Team",subject:`Brand Solutions deck for ${d.clientCompany}`,details:`Custom package deck needed. Estimated value: ${fmtR(d.amount)}.`,raisedBy:activeUser,raisedByName:user_role?.name||"",repId:d.repId,dealId:d.id,clientCompany:d.clientCompany,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};setInternalReqs(p=>[ir,...p]);showToast("Deck request raised → Branding Team ✓");}}
                                style={{background:`${C.purple}18`,border:"none",color:C.purple,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Request Deck</button>
                              <button onClick={()=>{const ir={id:`ir${Date.now()}`,type:"Approval",dept:"NSH",subject:`Brand Solutions approval: ${d.clientCompany} — ${fmtR(d.amount)}`,details:`Custom package deal needs NSH sign-off before presenting to client.`,raisedBy:activeUser,raisedByName:user_role?.name||"",repId:d.repId,dealId:d.id,clientCompany:d.clientCompany,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};setInternalReqs(p=>[ir,...p]);showToast("Approval request raised → NSH ✓");}}
                                style={{background:`${C.orange}18`,border:"none",color:C.orange,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Request Approval</button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* ── DIGITAL TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Digital");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Digital"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="digital" ? (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* ── INTEGRATED PACKAGES TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Integrated Packages");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=revenueEntries.filter(e=>visibleRepIdsSet.has(e.repId)&&e.dealType==="Integrated Packages"&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const dG=Math.max(0,dT-dC); const dPct=dT>0?Math.round((dC/dT)*100):0;
                  const dsc=dPct>=80?C.green:dPct>=50?C.accent:C.red;
                  return rtTab==="integrated" ? (
                    <div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Multi-platform packages combining Linear TV + Digital + On-ground + Content</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                        {[{label:"TARGET",value:fmtR(dT),color:C.accent},{label:"ACHIEVED",value:fmtR(dC),color:C.green},{label:"SHORTFALL",value:fmtR(dG),color:dG===0?C.green:C.red},{label:"% COMPLETE",value:`${dPct}%`,color:dsc}].map(card=>(
                          <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color}}>{card.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",marginBottom:14}}>
                        <div style={{height:"100%",width:`${Math.min(dPct,100)}%`,background:dsc,borderRadius:2}}/>
                      </div>
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No target set for this category this fiscal year.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Channel","Annual Target","Achieved","Committed","In Play","Shortfall","Stage","Days"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>(b.targetAmount||0)-(a.targetAmount||0)).map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                const cmt=(dealStage(d)==="Mail Confirmed")?(d.targetAmount||0):0;
                                const inp=(["In Discussion","Negotiation"].includes(dealStage(d)))?(d.targetAmount||0):0;
                                const idle=daysSince(d.lastContact||d.lastDealMeetingDate||TODAY);
                                const sf=Math.max(0,(d.targetAmount||0)-ach-cmt-inp);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{d.channel||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:cmt>0?C.green:C.muted,fontWeight:cmt>0?700:400}}>{cmt>0?fmtR(cmt):"—"}</td>
                                    <td style={{padding:"9px 14px",color:inp>0?C.accent:C.muted,fontWeight:inp>0?700:400}}>{inp>0?fmtR(inp):"—"}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <span style={{padding:"2px 8px",background:`${oColor(dealStage(d))}18`,border:`1px solid ${oColor(dealStage(d))}44`,borderRadius:5,color:oColor(dealStage(d)),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{dealStage(d)}</span>
                                    </td>
                                    <td style={{padding:"9px 14px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11,fontWeight:idle>=7?700:400}}>{idle===0?"Today":`${idle}d`}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {rtTab==="deals" && (
                  <div>
                    {/* Blocked deals banner */}
                    {(()=>{
                      const blocked = visibleDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested");
                      if(!blocked.length) return null;
                      return (
                        <div style={{background:`${C.orange}08`,border:`1px solid ${C.orange}33`,borderRadius:7,padding:"10px 16px",marginBottom:14}}>
                          <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>⏳ {blocked.length} Deal{blocked.length!==1?"s":""} Awaiting Approval</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {blocked.map(d=>{
                              const dw = d.awaitingApprovalSince?daysSince(d.awaitingApprovalSince):0;
                              const ov = dw>=APPROVAL_SLA_DAYS;
                              return (
                                <div key={d.id} style={{background:ov?`${C.red}12`:`${C.orange}10`,border:`1px solid ${ov?C.red:C.orange}33`,borderRadius:5,padding:"6px 10px",display:"flex",gap:8,alignItems:"center"}}>
                                  <span style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</span>
                                  <span style={{background:ov?`${C.red}22`:`${C.orange}22`,color:ov?C.red:C.orange,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:600}}>→ {d.awaitingApproval}</span>
                                  <span style={{fontSize:10,color:C.dim}}>{dw}d{ov?" — ESCALATE":""}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {visibleDeals.length === 0 && (
                      <div style={{textAlign:"center",padding:"60px 20px",color:C.dim}}>
                        <div style={{fontSize:32,marginBottom:12}}>📭</div>
                        <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:C.text}}>No deals match these filters</div>
                        <button onClick={()=>{setFilterRegion("All");setFilterQ("Q1 FY26");}} style={{color:C.accent,background:"none",border:`1px solid ${C.accent}`,borderRadius:5,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>Reset filters</button>
                      </div>
                    )}

                    {OUTCOMES.map(stage=>{
                      const sd=visibleDeals.filter(d=>d.outcome===stage);
                      if(!sd.length) return null;
                      const sv=sd.reduce((s,d)=>s+d.amount,0);
                      const prob=STAGE_PROB[stage];
                      return (
                        <div key={stage} style={{marginBottom:18}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                            <span className="pill sans" style={{background:`${oColor(stage)}22`,color:oColor(stage),fontSize:12,fontWeight:700,padding:"3px 10px"}}>{stage}</span>
                            <span style={{color:C.dim,fontSize:11}}>{sd.length} deal{sd.length!==1?"s":""} · {fmtR(sv)}</span>
                            <span style={{color:C.muted,fontSize:11}}>weighted {fmtR(sv*prob/100)} ({prob}%)</span>
                          </div>
                          <div className="card" style={{overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>
                                <th>Client</th><th>Rep</th><th>Amount</th><th>Idle</th>
                                <th style={{color:C.orange}}>Awaiting</th>
                                <th>Next Step</th><th>Stage</th>
                              </tr></thead>
                              <tbody>
                                {sd.sort((a,b)=>b.amount-a.amount).map(d=>{
                                  const rep=reps.find(r=>r.id===d.repId);
                                  const idle=daysSince(d.lastContact);
                                  const dw=d.awaitingApproval&&d.awaitingApprovalSince?daysSince(d.awaitingApprovalSince):0;
                                  const ov=d.awaitingApproval&&dw>=APPROVAL_SLA_DAYS;
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                                      onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                      onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                      <td style={{color:C.dim,fontSize:11}}>{rep?.name}</td>
                                      <td style={{fontWeight:700}}>{fmtR(d.amount)}</td>
                                      <td style={{color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11}}>{idle===0?"Today":`${idle}d`}</td>
                                      <td>{d.awaitingApproval?<span style={{background:ov?`${C.red}22`:`${C.orange}22`,color:ov?C.red:C.orange,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{d.awaitingApproval} {dw>0?`${dw}d`:""}</span>:<span style={{color:C.muted,fontSize:10}}>—</span>}</td>
                                      <td style={{fontSize:11,color:C.dim,maxWidth:180}}>{d.nextStep||"—"}</td>
                                      <td>
                                        <span style={{padding:"2px 8px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{d.outcome}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── REVENUE REPORT TAB — from revenue_entries only ── */}
                {rtTab==="revenue-report" && (()=>{
                  const visibleEntries = revenueEntries.filter(e =>
                    !e.isReversed && !e.reversalOf && visibleRepIdsSet.has(e.repId)
                  );
                  const totalRev = visibleEntries.reduce((s, e) => s + (e.amount||0), 0);

                  const byMonth: Record<string,number> = {};
                  visibleEntries.forEach(e => {
                    const ym = (e.date||e.createdAt||"").slice(0,7) || "Unknown";
                    byMonth[ym] = (byMonth[ym]||0) + (e.amount||0);
                  });
                  const monthRows = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0]));

                  const byClient: Record<string,number> = {};
                  visibleEntries.forEach(e => { const k=e.clientCompany||"Unknown"; byClient[k]=(byClient[k]||0)+(e.amount||0); });
                  const clientRows = Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,20);

                  const byChannel: Record<string,number> = {};
                  visibleEntries.forEach(e => { const k=e.dealType||e.channel||"Other"; byChannel[k]=(byChannel[k]||0)+(e.amount||0); });
                  const channelRows = Object.entries(byChannel).sort((a,b)=>b[1]-a[1]);

                  const byRegion: Record<string,number> = {};
                  visibleEntries.forEach(e => { const rep=reps.find(r=>r.id===e.repId); const k=rep?.region||e.region||"Unknown"; byRegion[k]=(byRegion[k]||0)+(e.amount||0); });
                  const regionRows = Object.entries(byRegion).sort((a,b)=>b[1]-a[1]);

                  const RevTbl = ({rows, col1}:{rows:[string,number][], col1:string}) => (
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{col1}</th>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"right",borderBottom:`1px solid ${C.border}`,width:140}}>Revenue</th>
                          <th style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"right",borderBottom:`1px solid ${C.border}`,width:80}}>Share</th>
                        </tr></thead>
                        <tbody>
                          {rows.map(([k,v])=>(
                            <tr key={k} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={e=>e.currentTarget.style.background=C.s2}
                              onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"8px 14px",fontWeight:600,color:C.text}}>{k}</td>
                              <td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:C.green}}>{fmtR(v)}</td>
                              <td style={{padding:"8px 14px",textAlign:"right",color:C.dim,fontSize:11}}>{totalRev>0?`${Math.round((v/totalRev)*100)}%`:"—"}</td>
                            </tr>
                          ))}
                          {rows.length===0&&<tr><td colSpan={3} style={{padding:"20px",color:C.muted,textAlign:"center",fontSize:11}}>No revenue entries yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  );

                  return (
                    <div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 20px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Total Revenue — All Entries</div>
                          <div className="sans" style={{fontSize:24,fontWeight:800,color:C.green}}>{fmtR(totalRev)}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:10,color:C.dim}}>{visibleEntries.length} entr{visibleEntries.length===1?"y":"ies"}</div>
                          <div style={{fontSize:10,color:C.muted,marginTop:2}}>Revenue entries only · Reversals excluded</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Month-wise</div>
                          <RevTbl rows={monthRows} col1="Month" />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Channel-wise</div>
                          <RevTbl rows={channelRows} col1="Channel" />
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Client-wise (Top 20)</div>
                          <RevTbl rows={clientRows} col1="Client" />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Region-wise</div>
                          <RevTbl rows={regionRows} col1="Region" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
          )}

          {/* ═══ LEADERBOARD ═══ */}
          {(view==="leaderboard"||view==="lb-team"||view==="lb-region"||view==="lb-all") && (()=>{
            const medals = ["🥇","🥈","🥉"];
            const myRegion = user_role?.region;
            // For Sales Rep, tab is driven by sidebar view; for others, by lbTab state
            const effectiveLbTab = view==="lb-team"?"team":view==="lb-region"?"region":view==="lb-all"?"all":lbTab;
            const showTabBar = view==="leaderboard"; // only non-rep roles use the internal tab switcher

            // ── Always rank ALL reps for the leaderboard (activity + target% only, no revenue amounts) ──
            const lbAllReps = reps.map(rep => {
              const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const closed  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rm      = meetings.filter(m=>m.repId===rep.id);
              const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
              const risk    = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
              const attOk   = att[TODAY]?.[rep.id];
              const cPct    = rep.target>0?Math.round((closed/rep.target)*100):0;
              return {...rep, closed, meetings:rm.length, seniorM, risk, attOk, cPct};
            }).sort((a,b)=>b.cPct-a.cPct);

            // Filter sets per tab
            const teamReps   = lbAllReps.filter(r => myRegion ? r.region===myRegion : true);
            const allReps    = lbAllReps;

            // Region rollup for Region tab
            const regionMap  = {};
            lbAllReps.forEach(r => {
              if (!regionMap[r.region]) regionMap[r.region] = {region:r.region, reps:0, meetings:0, seniorM:0, risk:0, attOk:0, cPct:0};
              const g = regionMap[r.region];
              g.reps++;
              g.meetings  += r.meetings;
              g.seniorM   += r.seniorM;
              g.risk      += r.risk;
              g.attOk     += r.attOk ? 1 : 0;
              g.cPct      += r.cPct;
            });
            const regionRows = Object.values(regionMap).map(g => ({
              ...g,
              avgMeetings: g.reps ? Math.round(g.meetings/g.reps) : 0,
              senPct:      g.meetings ? Math.round((g.seniorM/g.meetings)*100) : 0,
              attPct:      g.reps ? Math.round((g.attOk/g.reps)*100) : 0,
              avgCPct:     g.reps ? Math.round(g.cPct/g.reps) : 0,
            })).sort((a,b) => b.avgCPct - a.avgCPct);

            const myRepId = isRep ? user_role?.repId : null;
            const RepCard = ({rep, rank}) => {
              const sc     = rep.cPct>=80?C.green:rep.cPct>=50?C.accent:C.red;
              const isMe   = rep.id === myRepId;
              return (
                <div className="card" style={{padding:"14px 16px",marginBottom:8,border:isMe?`1px solid ${C.accent}66`:undefined,background:isMe?`${C.accent}05`:undefined}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:rank<3?`${[C.accent,C.blue,C.green][rank]}33`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?17:12,fontWeight:800,color:rank<3?[C.accent,C.blue,C.green][rank]:C.dim,flexShrink:0}}>
                      {rank<3?medals[rank]:`#${rank+1}`}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span className="sans" style={{fontWeight:700,fontSize:14}}>{rep.name}</span>
                        {isMe&&<span style={{background:`${C.accent}22`,color:C.accent,fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:8}}>YOU</span>}
                        <span style={{fontSize:11,color:C.dim}}>{rep.region}</span>
                      </div>
                      <div style={{fontSize:10,color:C.dim,marginTop:2}}>{rep.role}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:sc}}>{rep.cPct}%</div>
                      <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>TARGET CLOSED</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginTop:10}}>
                    {[
                      {label:"MEETINGS",      value:rep.meetings, color:C.blue},
                      {label:"TARGET CLOSED", value:`${rep.cPct}%`, color:sc},
                    ].map(s=>(
                      <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"7px 10px"}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:2}}>{s.label}</div>
                        <div className="sans" style={{fontSize:14,fontWeight:700,color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:8,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(rep.cPct,100)}%`,background:sc,borderRadius:2}}/>
                  </div>
                </div>
              );
            };

            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>LEADERBOARD</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Activity, compliance and target performance — no revenue figures shown</div>

                {/* Tab switcher — only for non-rep roles that use internal tab state */}
                {showTabBar && (
                  <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
                    {[
                      {id:"team",   label:"My Team",          sub:myRegion||"All"},
                      {id:"region", label:"By Region",        sub:"Aggregated"},
                      {id:"all",    label:"All Sales Reps",   sub:"Company-wide"},
                    ].map(t=>(
                      <button key={t.id} onClick={()=>setLbTab(t.id)}
                        style={{padding:"10px 20px",background:"transparent",border:"none",
                          borderBottom:effectiveLbTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                          color:effectiveLbTab===t.id?C.accent:C.dim,cursor:"pointer",
                          fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:effectiveLbTab===t.id?700:400,textAlign:"left"}}>
                        <div>{t.label}</div>
                        <div style={{fontSize:9,color:C.muted,marginTop:1}}>{t.sub}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── MY TEAM TAB ── */}
                {effectiveLbTab==="team" && (
                  <div>
                    {teamReps.length===0 && <div style={{textAlign:"center",padding:40,color:C.muted}}>No reps in your team.</div>}
                    {teamReps.map((rep,rank)=><RepCard key={rep.id} rep={rep} rank={rank}/>)}
                  </div>
                )}

                {/* ── BY REGION TAB ── */}
                {effectiveLbTab==="region" && (
                  <div>
                    {regionRows.map((g,rank)=>{
                      const sc = g.avgCPct>=80?C.green:g.avgCPct>=50?C.accent:C.red;
                      return (
                        <div key={g.region} className="card" style={{padding:"14px 18px",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                            <div style={{width:32,height:32,borderRadius:"50%",background:rank<3?`${[C.accent,C.blue,C.green][rank]}33`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?17:12,fontWeight:800,color:rank<3?[C.accent,C.blue,C.green][rank]:C.dim,flexShrink:0}}>
                              {rank<3?medals[rank]:`#${rank+1}`}
                            </div>
                            <div style={{flex:1}}>
                              <div className="sans" style={{fontWeight:700,fontSize:15}}>{g.region}</div>
                              <div style={{fontSize:11,color:C.dim}}>{g.reps} rep{g.reps!==1?"s":""}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div className="sans" style={{fontSize:22,fontWeight:800,color:sc}}>{g.avgCPct}%</div>
                              <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>AVG TARGET CLOSED</div>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                            {[
                              {label:"TOTAL MEETINGS", value:g.meetings,    color:C.blue},
                              {label:"AVG MTG/REP",    value:g.avgMeetings, color:C.blue},
                            ].map(s=>(
                              <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:2}}>{s.label}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:s.color}}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{marginTop:8,height:3,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.min(g.avgCPct,100)}%`,background:sc,borderRadius:2}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── ALL SALES REPS TAB ── */}
                {effectiveLbTab==="all" && (
                  <div>
                    {allReps.length===0 && <div style={{textAlign:"center",padding:40,color:C.muted}}>No rep data.</div>}
                    {allReps.map((rep,rank)=><RepCard key={rep.id} rep={rep} rank={rank}/>)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ INTERNAL REQUESTS ═══ */}
          {view==="internal-requests" && (() => {
            const IR_DEPTS = ["NSH","Sales Strategy","Branding Team","Content Team","Digital","Finance","Legal","CXO"];
            // Which dept "inbox" does the current user own?
            const myInboxDept = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":isDigiOps?"Digital":null;
            // Requests ADDRESSED TO the current user's department
            const inboxReqs = myInboxDept ? internalReqs.filter(r=>r.dept===myInboxDept) : [];
            const myReqs  = isRep
              ? internalReqs.filter(r=>r.raisedBy===activeUser)
              : isRH
                ? internalReqs.filter(r=>r.raisedBy===activeUser || (r.dept==="Region Head" && USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion))
                : isDigiOps
                  ? internalReqs.filter(r=>r.dept==="Digital")
                  : internalReqs;
            const filtered = irStatusFilter==="all" ? myReqs : myReqs.filter(r=>r.status===irStatusFilter);
            const pending  = myReqs.filter(r=>r.status==="Pending"||r.status==="Overdue");
            const inprog   = myReqs.filter(r=>r.status==="In Progress");
            const done     = myReqs.filter(r=>r.status==="Done");

            const statusColor = s => s==="Done"?C.green:s==="In Progress"?C.blue:s==="Overdue"?C.red:s==="Withdrawn"?C.muted:C.orange;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>INTERNAL REQUESTS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Approvals · Escalations · Support requests</div>
                  </div>
                  <button className="btn btn-primary" onClick={()=>{setIrFormOpen(p=>!p);setIrForm(BLANK_IR_FORM);}}>
                    {irFormOpen?"✕ Cancel":"+ New Request"}
                  </button>
                </div>

                {/* ── Inline New Request Form ── */}
                {irFormOpen&&(
                  <div style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"16px 18px",marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:12,letterSpacing:".06em"}}>NEW INTERNAL REQUEST</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Request type *</div>
                        <select value={irForm.type} onChange={e=>setIrForm(f=>({...f,type:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          {["Send Proposal","Send FCT Grid","Send Revised Rate Card","Send Sponsorship Deck","Get Budget Approval","Arrange Senior Meeting","Get Rate Approval","Follow Up with Client","Share Digital Plan","Content / Script Needed","Legal / Contract Review","Get PO / Release","Other"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Who do you need it from? *</div>
                        <select value={irForm.dept} onChange={e=>setIrForm(f=>({...f,dept:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                          {["Region Head","NSH","CXO","Sales Strategy","Digital","Branding Team","Content Team","Finance","Legal","HR"].map(d=><option key={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Subject / What do you need? *</div>
                      <input value={irForm.subject} onChange={e=>setIrForm(f=>({...f,subject:e.target.value}))}
                        placeholder="e.g. Discount approval — 10% off rate card for Havells"
                        style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Client / Account (optional)</div>
                        <select value={irForm.clientCompany} onChange={e=>setIrForm(f=>({...f,clientCompany:e.target.value}))}
                          style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:irForm.clientCompany?C.text:C.dim,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}>
                          <option value="">— Select client —</option>
                          {[...new Set(deals.filter(d=>user_role?.repId?d.repId===user_role.repId:true).map(d=>d.clientCompany))].sort().map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Details / Context</div>
                      <textarea value={irForm.details} onChange={e=>setIrForm(f=>({...f,details:e.target.value}))}
                        rows={3} placeholder="Provide context — client budget, ask, deadline, any relevant background…"
                        style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",resize:"vertical",boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setIrFormOpen(false);setIrForm(BLANK_IR_FORM);}}
                        style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                      <button onClick={()=>{
                        if(!irForm.subject.trim()){showToast("Subject is required","err");return;}
                        const irId = `ir${Date.now()}`;
                        const newReq={id:irId,type:irForm.type,dept:irForm.dept,subject:irForm.subject.trim(),details:irForm.details.trim(),raisedBy:activeUser,raisedByName:user_role?.name||"",repId:user_role?.repId||null,dealId:null,clientCompany:irForm.clientCompany.trim(),status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};
                        setInternalReqs(p=>[newReq,...p]);
                        // Auto-create a Task assigned to the "dept" person
                        const assigneeId = deptToUserId(irForm.dept);
                        const assigneeName = USER_ROLES.find(u=>u.id===assigneeId)?.name || irForm.dept;
                        const newTask = {
                          id:`t${Date.now()+1}`,
                          title:`[IR] ${irForm.subject.trim()}`,
                          assignedToUserId: assigneeId,
                          assignedTo: null,
                          assignedBy: activeUser,
                          assignedByName: user_role?.name || "",
                          assignedDept: irForm.dept,
                          clientCompany: irForm.clientCompany.trim(),
                          description: "Requested by " + (user_role?.name||"Sales Rep") + (irForm.clientCompany ? " for " + irForm.clientCompany.trim() : "") + ": " + (irForm.details.trim()||irForm.subject.trim()),
                          priority: "High",
                          status: "Open",
                          dueDate: TOMORROW,
                          createdAt: TODAY,
                          repId: user_role?.repId||null,
                          irId,
                        };
                        setTasks(p=>[...p, newTask]);
                        setIrFormOpen(false);setIrForm(BLANK_IR_FORM);
                        showToast(`Request raised → ${assigneeName} · Task created ✓`);
                      }} style={{background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        Submit Request →
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary pills */}
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  {[
                    {label:"Pending / Overdue", count:pending.length, color:C.red},
                    {label:"Accepted",           count:myReqs.filter(r=>r.status==="Accepted").length, color:C.green},
                    {label:"In Progress",        count:inprog.length,  color:C.blue},
                    {label:"Done",               count:done.length,    color:C.green},
                    {label:"Rejected",           count:myReqs.filter(r=>r.status==="Rejected").length, color:C.red},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"10px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{s.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:s.color,marginTop:2}}>{s.count}</div>
                    </div>
                  ))}
                </div>

                {/* Status filter */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {["all","Pending","Accepted","In Progress","Done","Rejected","Withdrawn"].map(s=>(
                    <button key={s} onClick={()=>setIrStatusFilter(s)}
                      style={{padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:irStatusFilter===s?700:400,
                        background:irStatusFilter===s?C.accent:`${C.accent}12`,
                        color:irStatusFilter===s?"#fff":C.dim,border:"none"}}>
                      {s==="all"?"All":s}
                    </button>
                  ))}
                </div>

                {/* ── 📥 Inbox: Requests addressed TO this user's dept ── */}
                {myInboxDept && (
                  <div style={{marginBottom:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div className="sans" style={{fontSize:13,fontWeight:700,color:C.accent,letterSpacing:".04em"}}>📥 REQUESTS TO YOU</div>
                      <span style={{background:`${C.accent}22`,color:C.accent,borderRadius:10,padding:"1px 10px",fontSize:10,fontWeight:700}}>{inboxReqs.filter(r=>r.status!=="Done").length} open</span>
                      <div style={{fontSize:10,color:C.dim}}>directed to {myInboxDept}</div>
                    </div>
                    {inboxReqs.length===0 && (
                      <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:8,padding:"22px",textAlign:"center",color:C.muted,fontSize:12}}>No requests directed to you yet.</div>
                    )}
                    {inboxReqs.map(req=>{
                      const daysOld = daysSince(req.raisedAt);
                      const overdue = daysOld >= (req.slaHours/24) && req.status!=="Done";
                      const sc = statusColor(overdue?"Overdue":req.status);
                      const deal = deals.find(d=>d.id===req.dealId);
                      return (
                        <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:8,borderLeft:`3px solid ${sc}`,background:`${C.accent}04`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                              <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                              <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:600}}>{req.type}</span>
                              <span style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10}}>from {req.raisedByName||req.raisedBy}</span>
                            </div>
                            <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}{overdue?" — SLA breached":""}</span>
                          </div>
                          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                          {req.clientCompany&&<div style={{fontSize:11,color:C.dim,marginBottom:4}}>Re: {req.clientCompany}{deal?` · ${fmtR(deal.amount)}`:""}</div>}
                          {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:6,lineHeight:1.5}}>{req.details}</div>}
                          {req.priority&&req.priority!=="Medium"&&<div style={{fontSize:10,fontWeight:700,color:req.priority==="Urgent"?C.red:req.priority==="High"?C.orange:C.green,marginBottom:6}}>Priority: {req.priority}{req.dueDate?` · Needed by ${req.dueDate}`:""}</div>}
                          {req.notes&&<div style={{fontSize:11,color:C.blue,background:`${C.blue}08`,padding:"5px 9px",borderRadius:5,marginBottom:6}}>💬 {req.notes}</div>}
                          {req.resolverNote&&<div style={{fontSize:11,color:C.green,background:`${C.green}08`,padding:"6px 10px",borderRadius:5,marginBottom:8}}>✓ {req.resolverNote}</div>}
                          {req.status!=="Done" && req.status!=="Rejected" && (
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                              {req.status==="Pending"&&(
                                <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Accepted",acceptedAt:TODAY}:r))}
                                  style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Accept</button>
                              )}
                              {req.status!=="In Progress"&&req.status!=="Accepted"&&(
                                <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r))}
                                  style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>In Progress</button>
                              )}
                              <button onClick={()=>openNoteModal("Add Note / Update","Noted",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,notes:note}:r)))}
                                style={{background:`${C.accent}12`,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>+ Note</button>
                              <button onClick={()=>openNoteModal("Resolution Note","Resolved",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)))}
                                style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Mark Done</button>
                              <button onClick={()=>openNoteModal("Reason for rejection","Rejected",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Rejected",resolvedAt:TODAY,resolverNote:note}:r)))}
                                style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✗ Reject</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{borderBottom:`1px solid ${C.border}`,marginBottom:20,marginTop:8}}/>
                    <div className="sans" style={{fontSize:12,fontWeight:700,color:C.dim,letterSpacing:".04em",marginBottom:12}}>ALL REQUESTS (SYSTEM-WIDE)</div>
                  </div>
                )}

                {/* Request cards */}
                {filtered.length===0 && <div style={{textAlign:"center",padding:50,color:C.muted}}>{irStatusFilter==="all"?"No requests yet. Hit + New Request to raise one.":"No requests with this status."}</div>}
                {filtered.map(req=>{
                  const daysOld = daysSince(req.raisedAt);
                  const overdue = daysOld >= (req.slaHours/24) && req.status!=="Done";
                  const sc = statusColor(overdue?"Overdue":req.status);
                  const deal = deals.find(d=>d.id===req.dealId);
                  return (
                    <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${sc}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                          <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:600}}>{req.type}</span>
                          <span style={{background:C.s3,color:C.dim,padding:"2px 9px",borderRadius:8,fontSize:10}}>→ {req.dept}</span>
                        </div>
                        <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}{overdue?" — SLA breached":""}</span>
                      </div>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                      {req.clientCompany&&<div style={{fontSize:11,color:C.dim,marginBottom:4}}>Re: {req.clientCompany}{deal?` · ${fmtR(deal.amount)}`:""}</div>}
                      {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:8,lineHeight:1.5}}>{req.details}</div>}
                      {req.resolverNote&&<div style={{fontSize:11,color:C.green,background:`${C.green}08`,padding:"6px 10px",borderRadius:5,marginBottom:8}}>✓ {req.resolverNote}</div>}
                      <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                        {isNSHDashboard && req.status!=="Done" && (
                          <>
                            <button onClick={()=>{setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r));}} style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Mark In Progress</button>
                            <button onClick={()=>{openNoteModal("Resolution Note", "Resolved", note => setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)));}} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Resolve</button>
                          </>
                        )}
                        {/* Escalate: visible to rep/RH for any active non-escalation request */}
                        {(isRep||isRH) && req.status!=="Done" && req.status!=="Withdrawn" && req.type!=="Escalation" && (
                          <button onClick={()=>{
                            const escalatedDept = req.dept==="NSH"?"CXO":req.dept==="Sales Strategy"?"NSH":req.dept==="Region Head"?"NSH":req.dept==="CXO"?"CXO":"Region Head";
                            const escalated = {
                              id:`ir${Date.now()}`,
                              type:"Escalation",
                              dept: escalatedDept,
                              subject:`ESCALATION: ${req.subject}`,
                              details:`Original request to ${req.dept} has breached SLA (${daysOld}d). Escalating for urgent action.\n\nOriginal: ${req.details||""}`,
                              raisedBy:activeUser, raisedByName:user_role?.name||"",
                              repId:user_role?.repId||req.repId||null,
                              dealId:req.dealId||null, clientCompany:req.clientCompany||"",
                              status:"Pending", raisedAt:TODAY, slaHours:24, resolvedAt:null, resolverNote:"",
                            };
                            setInternalReqs(p=>[escalated,...p.map(r=>r.id===req.id?{...r,status:"Withdrawn"}:r)]);
                            showToast(`Escalated to ${escalated.dept} ✓`);
                          }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                            ↑ Escalate
                          </button>
                        )}
                        {(isRep||isRH) && req.status==="Pending" && (
                          <button onClick={()=>{setEditIrId(req.id);setIrForm({type:req.type||"Send Proposal",dept:req.dept||"NSH",subject:req.subject||"",details:req.details||"",clientCompany:req.clientCompany||""});}} style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✎ Edit</button>
                        )}
                        {(isRep||isRH) && req.status!=="Done" && req.status!=="Withdrawn" && (
                          <button onClick={()=>{setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Withdrawn"}:r));showToast("Request withdrawn");}} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Withdraw</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Global client-name datalist — used by all clientCompany inputs */}
          <datalist id="cm-list">
            {clientMasterList.map((n,i)=><option key={i} value={n}/>)}
          </datalist>

          {/* ═══ ADMIN ═══ */}
          {(view==="admin-access"||view==="admin-approvals") && isAdmin && (
              <div className="fin">
                {/* Pre-launch demo data banner */}
                {(()=>{
                  const DEMO_CLIENTS = ["Havells India","Berger Paints","Asian Paints"];
                  const demoFound = deals.some(d=>DEMO_CLIENTS.includes(d.clientCompany));
                  if (!demoFound) return null;
                  return (
                    <div style={{background:`${C.red}12`,border:`2px solid ${C.red}`,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                      <div style={{fontSize:22,lineHeight:1}}>⚠️</div>
                      <div style={{flex:1}}>
                        <div className="sans" style={{fontWeight:800,fontSize:13,color:C.red,marginBottom:4}}>DEMO DATA IS ACTIVE — DO NOT ONBOARD REAL USERS YET</div>
                        <div style={{fontSize:11,color:C.dim,marginBottom:10}}>
                          Seed clients (Havells India, Berger Paints, Asian Paints etc.) are still in the database. Every new rep will see this fake data in their pipeline from day one. Run a full reset <strong>before</strong> the first real user logs in.
                        </div>
                        <button onClick={async()=>{
                          const typed = window.prompt("Type  RESET  (all caps) to wipe all demo data and start clean.\n\nThis cannot be undone.");
                          if(typed===null)return;
                          if(typed.trim()!=="RESET"){showToast("Reset cancelled — type RESET exactly","err");return;}
                          try{
                            const j=await apiFetch("/api/state/reset-all",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmText:"RESET",triggeredBy:user?.email||"admin",role:"ADMIN"})}) as any;
                            if(j.ok){Object.keys(localStorage).filter(k=>k.startsWith("otv_")).forEach(k=>localStorage.removeItem(k));showToast("Demo data cleared — reloading…");setTimeout(()=>window.location.reload(),800);}
                            else showToast("Reset failed: "+j.error,"err");
                          }catch{showToast("Reset failed","err");}
                        }} style={{background:C.red,border:"none",color:"#fff",borderRadius:6,padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          🗑 Clear All Demo Data Now
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>
                  {view==="admin-access"?"ACCESS MANAGEMENT":"APPROVAL QUEUE"}
                </div>

                {/* ── ACCESS MANAGEMENT ── */}
                {view==="admin-access" && (
                  <div>
                    {/* Loading indicator */}
                    {adminUsersLoading && (
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,color:C.muted,fontSize:11}}>
                        <div style={{width:12,height:12,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
                        Refreshing user list...
                      </div>
                    )}
                    {/* Pending signups */}
                    {pendingUsers.length>0&&(
                      <div style={{marginBottom:24}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                          <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>Pending Access Requests</div>
                          <span style={{background:`${C.orange}22`,color:C.orange,padding:"1px 8px",borderRadius:8,fontSize:11,fontWeight:700}}>{pendingUsers.length}</span>
                        </div>
                        {pendingUsers.map(pu=>(
                          <div key={pu.id} className="card" style={{padding:"14px 18px",marginBottom:8,borderLeft:`3px solid ${C.orange}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                            <div style={{width:36,height:36,borderRadius:"50%",background:`${C.orange}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.orange,flexShrink:0}}>{pu.name[0]}</div>
                            <div style={{flex:1}}>
                              <div className="sans" style={{fontWeight:700,fontSize:13}}>{pu.name}</div>
                              <div style={{fontSize:11,color:C.dim}}>{pu.email} · Requested {daysSince(pu.requestedAt)===0?"today":`${daysSince(pu.requestedAt)}d ago`}</div>
                              {/* Extra details from self-registration */}
                              {(pu.phone||pu.designation||pu.intendedRole) && (
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                                  {pu.phone&&<span style={{fontSize:10,background:`${C.s2}`,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 7px",color:C.dim}}>📞 {pu.phone}</span>}
                                  {pu.designation&&<span style={{fontSize:10,background:`${C.s2}`,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 7px",color:C.dim}}>{pu.designation}</span>}
                                  {pu.intendedRole&&<span style={{fontSize:10,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,borderRadius:4,padding:"1px 7px",color:C.accent,fontWeight:700}}>Wants: {pu.intendedRole}</span>}
                                  {pu.preferredRegion&&<span style={{fontSize:10,background:`${C.blue}18`,border:`1px solid ${C.blue}33`,borderRadius:4,padding:"1px 7px",color:C.blue}}>📍 {pu.preferredRegion}</span>}
                                </div>
                              )}
                            </div>
                            {/* Role + Region selectors inline — pre-fill from signup if available */}
                            <select id={`role-${pu.id}`} defaultValue={pu.intendedRole||"SALES REP"}
                              style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                              {ALL_ROLES.filter(r=>r!=="ADMIN").map(r=><option key={r}>{r}</option>)}
                            </select>
                            <select id={`region-${pu.id}`} defaultValue={pu.preferredRegion||"North"}
                              style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                              {REGIONS.map(r=><option key={r}>{r}</option>)}
                            </select>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={async ()=>{
                                const roleEl   = document.getElementById(`role-${pu.id}`);
                                const regionEl = document.getElementById(`region-${pu.id}`);
                                const role     = roleEl?.value || "SALES REP";
                                const region   = regionEl?.value || "North";
                                try {
                                  await adminSvc.approveUser(pu._apiId, role, region);
                                  if (role === "SALES REP") {
                                    setReps(prev => {
                                      const nextId = prev.length > 0 ? Math.max(...prev.map(r=>r.id)) + 1 : 1;
                                      return [...prev, {id:nextId, name:pu.name, region, role:"Sales Executive", target:0}];
                                    });
                                  }
                                  await refreshAdminUsers();
                                  showToast(`${pu.name} approved as ${role} ✓`);
                                } catch { showToast("Network error — approval failed","err"); }
                              }} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                ✓ Approve
                              </button>
                              <button onClick={async ()=>{
                                try {
                                  await adminSvc.rejectUser(pu._apiId);
                                  await refreshAdminUsers();
                                  showToast(`${pu.name} rejected`,"err");
                                } catch { showToast("Network error","err"); }
                              }} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active users */}
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>
                      Active Users ({liveRoles.length})
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {liveRoles.map(u=>(
                        <div key={u.id} className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                          <div style={{width:32,height:32,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent,flexShrink:0}}>{u.name[0]}</div>
                          <div style={{flex:1,minWidth:120}}>
                            <div className="sans" style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                            <div style={{fontSize:10,color:C.dim}}>{u.region||"All regions"}</div>
                          </div>
                          {/* Editable role */}
                          <select value={u.role} onChange={async e=>{
                            const newRole = e.target.value;
                            try {
                              await adminSvc.patchUserRole(u._apiId, newRole, u.region);
                              await refreshAdminUsers();
                              showToast(`${u.name} role updated to ${newRole}`);
                            } catch { showToast("Network error","err"); }
                          }} style={{padding:"4px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                            {ALL_ROLES.map(r=><option key={r}>{r}</option>)}
                          </select>
                          <button onClick={async ()=>{
                            if(!window.confirm(`Revoke access for ${u.name}?`)) return;
                            try {
                              await adminSvc.deleteUser(u._apiId);
                              await refreshAdminUsers();
                              showToast(`${u.name}'s access revoked`,"err");
                            } catch { showToast("Network error","err"); }
                          }} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"4px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Revoke</button>
                        </div>
                      ))}
                    </div>

                    {/* ── DANGER ZONE: RESET ── */}
                    <div style={{marginTop:28,padding:"16px 18px",background:`${C.red}0a`,border:`1px solid ${C.red}33`,borderRadius:8}}>
                      <div style={{fontWeight:700,fontSize:11,color:C.red,letterSpacing:1,marginBottom:6}}>DANGER ZONE — SYSTEM RESET</div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:4}}>Wipes ALL data from the platform (deals, meetings, targets, reps, users, plans). Use once before going live. Cannot be undone.</div>
                      <div style={{fontSize:11,color:C.red,fontWeight:600,marginBottom:12}}>Admin access only. Each trigger is logged with your email and timestamp.</div>
                      <button onClick={async ()=>{
                        const typed = window.prompt('Type  RESET  (all caps) to confirm deletion of all platform data.\n\nThis cannot be undone. Your email and the timestamp will be logged.');
                        if (typed === null) return;
                        if (typed.trim() !== "RESET") { showToast("Reset cancelled — confirmation text did not match","err"); return; }
                        try {
                          const j = await apiFetch("/api/state/reset-all", {
                            method:"POST",
                            headers:{"Content-Type":"application/json"},
                            body: JSON.stringify({ confirmText:"RESET", triggeredBy: user?.email||"admin", role:"ADMIN" })
                          }) as any;
                          if (j.ok) {
                            Object.keys(localStorage).filter(k=>k.startsWith("otv_")).forEach(k=>localStorage.removeItem(k));
                            showToast("All data cleared — reloading…");
                            setTimeout(()=>window.location.reload(), 800);
                          } else {
                            showToast("Reset failed: "+j.error,"err");
                          }
                        } catch(e) {
                          showToast("Reset failed","err");
                        }
                      }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"7px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        ⚠ Reset All App Data
                      </button>
                    </div>
                  </div>
                )}

                {/* ── APPROVAL QUEUE ── */}
                {view==="admin-approvals" && (
                  <div>
                    <div style={{fontSize:11,color:C.dim,marginBottom:16}}>All pending approvals across teams.</div>
                    {internalReqs.filter(r=>r.status!=="Done").length===0&&<div style={{textAlign:"center",padding:50,color:C.muted}}>No pending approvals.</div>}
                    {internalReqs.filter(r=>r.status!=="Done").map(req=>{
                      const daysOld=daysSince(req.raisedAt);
                      const overdue=daysOld>=(req.slaHours/24);
                      const sc=overdue?C.red:req.status==="In Progress"?C.blue:C.orange;
                      return (
                        <div key={req.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${sc}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              <span style={{background:`${sc}22`,color:sc,padding:"2px 9px",borderRadius:8,fontSize:10,fontWeight:700}}>{overdue?"OVERDUE":req.status}</span>
                              <span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10}}>{req.type}</span>
                              <span style={{fontSize:11,color:C.dim}}>From: {req.raisedByName} → {req.dept}</span>
                            </div>
                            <span style={{fontSize:10,color:overdue?C.red:C.muted}}>{daysOld===0?"Today":`${daysOld}d ago`}</span>
                          </div>
                          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{req.subject}</div>
                          {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:8}}>{req.details}</div>}
                          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                            <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r))} style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>In Progress</button>
                            <button onClick={()=>{openNoteModal("Resolution Note", "Resolved by admin", note => setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)));}} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Resolve</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          )}

          {/* ═══ TARGETS ═══ */}
          {view==="targets" && !isRH && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:8}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TARGETS vs ACHIEVEMENT</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.dim}}>Viewing as <span style={{color:C.accent}}>{user_role.name}</span></span>
                  <button className="btn btn-primary" onClick={()=>openAddDeal()}>+ Add Client</button>
                </div>
              </div>

              {isRep ? (() => {
                const myRepId = user_role?.repId;
                const myDeals = deals.filter(d=>d.repId===myRepId&&qMatch(d.quarter));
                const mT=myDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                // Part 5: 4-number dashboard
                const mC=getAchieved(myRepId);
                const mCommitted=getCommitted(myRepId);
                const mInPlay=getInPlay(myRepId);
                const mG=getShortfall(mT,myRepId);
                const mPct=mT>0?Math.round((mC/mT)*100):0;
                const sc=mPct>=100?C.green:mPct>=50?C.accent:C.red;
                return (
                  <div>
                    <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:12,textTransform:"uppercase"}}>My Targets · {filterQ}</div>
                      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(mT),C.text],["ACHIEVED",fmtR(mC),C.green],["COMMITTED",fmtR(mCommitted),C.blue],["IN PLAY",fmtR(mInPlay),C.accent],["SHORTFALL",fmtR(mG),mG===0?C.green:C.red]].map(([l,v,c])=>(
                          <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:c as string}}>{v}</div></div>
                        ))}
                        <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:48,fontWeight:800,color:sc,lineHeight:1}}>{mPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                      </div>
                      {stackedBar(mT, mC, mCommitted, mInPlay, mG)}
                    </div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {myDeals.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>No deals for {filterQ} yet.</td></tr>}
                          {myDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                            const ds=dealStage(d);
                            const ach=revenueEntries.filter(e=>e.clientCompany===d.clientCompany&&(isRep?e.repId===myRepId:true)).reduce((s,e)=>s+(e.amount||0),0);
                            const pip=d.pipelineAmount||parseCurrency(d.amount||"0")||0;
                            const sf=Math.max(0,(d.targetAmount||0)-ach);
                            const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                            return (
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                <td style={{padding:"10px 14px",color:pip>0?C.accent:C.muted}}>{pip>0?fmtR(pip):"—"}</td>
                                <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(ds)}18`,color:oColor(ds),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{ds}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : isRH ? (()=>{
                // ── REGION HEAD TARGETS: rep-wise tiles → click → client list ──
                const myRegion = user_role?.region;
                const myReps   = reps.filter(r=>r.region===myRegion);
                if (rhRepDrill) {
                  // Client detail for selected rep
                  const repObj = reps.find(r=>r.id===rhRepDrill);
                  const repDeals = visibleDeals.filter(d=>d.repId===rhRepDrill);
                  const rT=repDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  // Part 5: 4-number dashboard for rep drill
                  const rC=getAchieved(rhRepDrill);
                  const rCommitted=getCommitted(rhRepDrill);
                  const rInPlay=getInPlay(rhRepDrill);
                  const rG=getShortfall(rT,rhRepDrill);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const sc=rPct>=100?C.green:rPct>=50?C.accent:C.red;
                  return (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                        <button onClick={()=>setRhRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← Back to Reps</button>
                        <div className="sans" style={{fontSize:15,fontWeight:700}}>{repObj?.name}</div>
                        <div style={{fontSize:11,color:C.dim}}>{repObj?.region} · {repDeals.length} clients</div>
                      </div>
                      <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"14px 20px",marginBottom:16}}>
                        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                          {[["TARGET",fmtR(rT),C.text],["ACHIEVED",fmtR(rC),C.green],["COMMITTED",fmtR(rCommitted),C.blue],["IN PLAY",fmtR(rInPlay),C.accent],["SHORTFALL",fmtR(rG),rG===0?C.green:C.red]].map(([l,v,c])=>(
                            <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c as string}}>{v}</div></div>
                          ))}
                          <div style={{marginLeft:"auto"}}><div className="sans" style={{fontSize:40,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                        </div>
                        {stackedBar(rT, rC, rCommitted, rInPlay, rG, 10)}
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {repDeals.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No deals for {filterQ}.</td></tr>}
                            {repDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                              const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                              const pip=!["Mail Confirmed","Not Interested"].includes(d.outcome)?d.amount:0;
                              const sf=Math.max(0,(d.targetAmount||0)-ach);
                              const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                  <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                  <td style={{padding:"10px 14px",color:pip>0?C.accent:C.muted}}>{pip>0?fmtR(pip):"—"}</td>
                                  <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                // Rep tiles view
                const regionT=visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                const regionRepIds=new Set(myReps.map(r=>r.id));
                const regionC=revenueEntries.filter(e=>regionRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const regionPct=regionT>0?Math.round((regionC/regionT)*100):0;
                const rsc=regionPct>=100?C.green:regionPct>=60?C.accent:C.red;
                return (
                  <div>
                    {/* Region summary tile */}
                    <div style={{background:C.surface,border:`2px solid ${rsc}`,borderRadius:10,padding:"16px 20px",marginBottom:18}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>{myRegion} Region · {filterQ}</div>
                      <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(regionT),C.text],["CLOSED",fmtR(regionC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),C.accent],["GAP",fmtR(Math.max(0,regionT-regionC)),regionT-regionC<=0?C.green:C.red]].map(([l,v,c])=>(
                          <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                        ))}
                        <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:rsc,lineHeight:1}}>{regionPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                      </div>
                      <div style={{marginTop:10,height:5,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(regionPct,100)}%`,background:rsc}} /></div>
                    </div>
                    {/* Rep tiles — click to drill down */}
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Your Sales Reps — click to view clients</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                      {myReps.map(rep=>{
                        const rd=visibleDeals.filter(d=>d.repId===rep.id);
                        const rT2=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const rC2=revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const rP2=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const rPct2=rT2>0?Math.round((rC2/rT2)*100):0;
                        const sc2=rPct2>=80?C.green:rPct2>=50?C.accent:C.red;
                        const rAtRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        return (
                          <div key={rep.id} onClick={()=>setRhRepDrill(rep.id)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}} onMouseOver={e=>{e.currentTarget.style.borderColor=sc2;e.currentTarget.style.transform="translateY(-2px)";}} onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                              <div>
                                <div className="sans" style={{fontWeight:700,fontSize:14,marginBottom:2}}>{rep.name}</div>
                                <div style={{fontSize:10,color:C.dim}}>{rep.role} · {rd.length} clients</div>
                              </div>
                              <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:26,fontWeight:800,color:sc2,lineHeight:1}}>{rPct2}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                              {[["Target",fmtR(rT2)],["Closed",fmtR(rC2)],["Pipeline",fmtR(rP2)],["Gap",fmtR(Math.max(0,rT2-rC2))]].map(([l,v])=>(
                                <div key={l} style={{background:C.s2,borderRadius:4,padding:"5px 8px"}}><div style={{fontSize:9,color:C.dim}}>{l}</div><div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:l==="Gap"?(rT2-rC2<=0?C.green:C.red):C.text}}>{v}</div></div>
                              ))}
                            </div>
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct2,100)}%`,background:sc2}} /></div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,alignItems:"center"}}>
                              {rAtRisk>0&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 6px",borderRadius:5,fontSize:9,fontWeight:700}}>{rAtRisk} at risk</span>}
                              <span style={{fontSize:9,color:C.dim,marginLeft:"auto"}}>View clients →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : (() => {
                const allD=deals.filter(d=>qMatch(d.quarter));
                const mT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                const mC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                const mP=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const mW=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                const mF=mC+mW; const mG=Math.max(0,mT-mF);
                const mCP=mT>0?Math.round((mC/mT)*100):0; const mFP=mT>0?Math.round((mF/mT)*100):0;
                const sc=mFP>=100?C.green:mFP>=75?C.accent:C.red;
                const TILES=[
                  {key:"North",label:"North",icon:"↑",color:"#60a5fa"},
                  {key:"South",label:"South",icon:"↓",color:"#a855f7"},
                  {key:"West", label:"West", icon:"←",color:"#f97316"},
                  {key:"East", label:"East", icon:"→",color:"#16c784"},
                  {key:"Odisha",label:"Odisha",icon:"◈",color:"#f0a500"},
                  {key:"DigitalOnly",label:"Digital Only",icon:"◉",color:"#2d7dd2"},
                  {key:"DigitalTV",label:"Digital + TV",icon:"⬡",color:"#ea3943"},
                ];
                const getTileDeals=k=>{
                  if(k==="DigitalOnly") return allD.filter(d=>d.dealType==="Digital");
                  if(k==="DigitalTV")   return allD.filter(d=>["Digital","Linear TV","Integrated Packages","Media Solutions"].includes(d.dealType));
                  return allD.filter(d=>d.region===k);
                };
                return (
                  <div>
                    {/* ── OVERVIEW: only when no drilldown is active ── */}
                    {!targetDrilldown && <div>
                    {/* 4 Summary stat cards — consistent across all roles */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                      {[
                        {label:"TOTAL TARGET",value:fmtR(mT),  color:C.accent,  sub:"Organisation · "+filterQ},
                        {label:"ACHIEVED",    value:fmtR(mC),  color:C.green,   sub:"Closed deals"},
                        {label:"SHORTFALL",   value:fmtR(mG),  color:mG===0?C.green:C.red, sub:mG===0?"On target":"Gap to close"},
                        {label:"% COMPLETE",  value:`${mCP}%`, color:sc,        sub:`Forecast ${mFP}%`},
                      ].map(card=>(
                        <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",position:"relative",marginBottom:16}}>
                      <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(mCP,100)}%`,background:C.green,borderRadius:3}} />
                      <div style={{position:"absolute",left:`${mCP}%`,height:"100%",width:`${Math.min(mFP-mCP,100-mCP)}%`,background:`${C.accent}99`}} />
                    </div>
                    {/* Region tiles */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                      {TILES.map(tile=>{
                        const td=getTileDeals(tile.key);
                        const tRepIds=[...new Set(td.map(d=>d.repId))];
                        const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const tC=revenueEntries.filter(e=>tRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                        const tP=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const tW=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                        const tF=tC+tW; const tG=Math.max(0,tT-tF);
                        const tCP=tT>0?Math.round((tC/tT)*100):0; const tFP=tT>0?Math.round((tF/tT)*100):0;
                        const tc=tFP>=100?C.green:tFP>=75?C.accent:tFP>=50?tile.color:C.red;
                        const risk=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        return (
                          <div key={tile.key} onClick={()=>{setTargetDrilldown(tile);setNshRepDrill(null);}}
                            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}}
                            onMouseOver={e=>{e.currentTarget.style.borderColor=tile.color;e.currentTarget.style.transform="translateY(-2px)";}}
                            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:28,height:28,borderRadius:6,background:`${tile.color}22`,border:`1px solid ${tile.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:tile.color,fontWeight:700}}>{tile.icon}</div>
                                <div><div className="sans" style={{fontSize:13,fontWeight:700}}>{tile.label}</div><div style={{fontSize:10,color:C.dim}}>{td.length} deal{td.length!==1?"s":""}</div></div>
                              </div>
                              <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:20,fontWeight:800,color:tc}}>{tFP}%</div><div style={{fontSize:9,color:C.dim}}>forecast</div></div>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                              {[["Target",fmtR(tT)],[`Closed`,fmtR(tC)],["Pipeline",fmtR(tP)],["Gap",fmtR(tG)]].map(([l,v])=>(
                                <div key={l} style={{background:C.s2,borderRadius:4,padding:"6px 8px"}}>
                                  <div style={{fontSize:9,color:C.dim,letterSpacing:".05em"}}>{l}</div>
                                  <div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:l==="Gap"?(tG===0?C.green:C.red):C.text}}>{v}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(tCP,100)}%`,background:C.green}} />
                              <div style={{position:"absolute",left:`${tCP}%`,height:"100%",width:`${Math.min(tFP-tCP,100-tCP)}%`,background:`${tile.color}99`}} />
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                              {risk>0&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>{risk} at risk</span>}
                              <span style={{fontSize:9,color:C.dim,marginLeft:"auto"}}>View clients →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </div>}
                    {/* ── DRILLDOWN LEVEL 2: Rep → Client List ── */}
                    {targetDrilldown && nshRepDrill && (()=>{
                      const tile    = TILES.find(t=>t.key===targetDrilldown.key);
                      const repObj  = reps.find(r=>r.id===nshRepDrill);
                      const rd      = getTileDeals(targetDrilldown.key).filter(d=>d.repId===nshRepDrill);
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>e.repId===nshRepDrill&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rG=Math.max(0,rT-rC);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rsc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (
                        <div style={{marginTop:16}}>
                          {/* Breadcrumb */}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                            <button onClick={()=>{setTargetDrilldown(null);setNshRepDrill(null);}} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← All Regions</button>
                            <button onClick={()=>setNshRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← {tile?.label} Reps</button>
                            <div className="sans" style={{fontSize:15,fontWeight:700}}>{repObj?.name}</div>
                            <div style={{fontSize:11,color:C.dim}}>{repObj?.region} · {rd.length} client{rd.length!==1?"s":""}</div>
                          </div>
                          {/* 4 stat cards */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[
                              {label:"TOTAL TARGET",value:fmtR(rT),  color:C.accent,  sub:repObj?.region},
                              {label:"ACHIEVED",    value:fmtR(rC),  color:C.green,   sub:"Closed deals"},
                              {label:"SHORTFALL",   value:fmtR(rG),  color:rG===0?C.green:C.red, sub:rG===0?"On target":"Gap to close"},
                              {label:"% COMPLETE",  value:`${rPct}%`,color:rsc,       sub:"vs target"},
                            ].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                                <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:14}}>
                            <div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:rsc,borderRadius:3}}/>
                          </div>
                          {/* Client table */}
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Client","Deal Type","Target","Achieved","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                              <tbody>
                                {rd.length===0&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.muted}}>No clients.</td></tr>}
                                {rd.sort((a,b)=>{
                                  const achA=revenueEntries.filter(e=>e.repId===a.repId&&(a.zohoAccountId&&e.zohoAccountId?a.zohoAccountId===e.zohoAccountId:e.clientCompany===a.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const achB=revenueEntries.filter(e=>e.repId===b.repId&&(b.zohoAccountId&&e.zohoAccountId?b.zohoAccountId===e.zohoAccountId:e.clientCompany===b.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  return Math.max(0,(b.targetAmount||0)-achB)-Math.max(0,(a.targetAmount||0)-achA);
                                }).map(d=>{
                                  const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                  const sf=Math.max(0,(d.targetAmount||0)-ach);
                                  const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                      <td style={{padding:"10px 14px"}}>
                                        <div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>
                                        {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                                        {d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:5,fontSize:9,fontWeight:700,marginTop:2,display:"inline-block"}}>TOP 5</span>}
                                      </td>
                                      <td style={{padding:"10px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                      <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                      <td style={{padding:"10px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>
                                        {ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}
                                      </td>
                                      <td style={{padding:"10px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                      <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── DRILLDOWN LEVEL 1: Region → Rep Tiles ── */}
                    {targetDrilldown && !nshRepDrill && (() => {
                      const tile     = TILES.find(t=>t.key===targetDrilldown.key);
                      const td       = getTileDeals(targetDrilldown.key);
                      const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const tRepIds2=[...new Set(td.map(d=>d.repId))];
                      const tC=revenueEntries.filter(e=>tRepIds2.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const tG=Math.max(0,tT-tC);
                      const tPct=tT>0?Math.round((tC/tT)*100):0;
                      const tsc=tPct>=80?C.green:tPct>=50?C.accent:C.red;
                      // Geographic regions: drill to rep tiles; deal-type tiles: flat list
                      const isGeoTile = ["North","South","West","East","Odisha"].includes(targetDrilldown.key);
                      const regionReps = isGeoTile ? reps.filter(r=>r.region===targetDrilldown.key) : [];
                      return (
                        <div style={{marginTop:16}}>
                          {/* Back + header */}
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                            <button onClick={()=>{setTargetDrilldown(null);setNshRepDrill(null);}} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>← All Regions</button>
                            <div style={{width:28,height:28,borderRadius:6,background:`${tile?.color}22`,border:`1px solid ${tile?.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:tile?.color,fontWeight:700}}>{tile?.icon}</div>
                            <div className="sans" style={{fontSize:15,fontWeight:700}}>{tile?.label}</div>
                            <div style={{fontSize:11,color:C.dim}}>{td.length} deal{td.length!==1?"s":""}</div>
                          </div>
                          {/* 4 stat cards for this region */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                            {[
                              {label:"TOTAL TARGET",value:fmtR(tT),  color:C.accent,  sub:tile?.label+" region"},
                              {label:"ACHIEVED",    value:fmtR(tC),  color:C.green,   sub:"Closed deals"},
                              {label:"SHORTFALL",   value:fmtR(tG),  color:tG===0?C.green:C.red, sub:tG===0?"On target":"Gap to close"},
                              {label:"% COMPLETE",  value:`${tPct}%`,color:tsc,       sub:"vs target"},
                            ].map(card=>(
                              <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                                <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                                <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                                <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",marginBottom:16}}>
                            <div style={{height:"100%",width:`${Math.min(tPct,100)}%`,background:tsc,borderRadius:3}}/>
                          </div>

                          {/* Geographic & Deal-type tiles: flat client list with Sales Rep column */}
                          {(()=>{
                            const cols = isGeoTile
                              ? ["Client","Sales Rep","Deal Type","Target","Achieved","Shortfall","Stage"]
                              : ["Client","Rep","Deal Type","Target","Achieved","Shortfall","Stage"];
                            const colSpan = cols.length;
                            return (
                            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                <thead><tr>{cols.map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                                <tbody>
                                  {td.length===0&&<tr><td colSpan={colSpan} style={{padding:24,textAlign:"center",color:C.muted}}>No target set for this category this fiscal year.</td></tr>}
                                  {td.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                                    const rep=reps.find(r=>r.id===d.repId);
                                    const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                                    const sf=Math.max(0,(d.targetAmount||0)-ach);
                                    const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                    return (
                                      <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                        <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:5,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                        <td style={{padding:"9px 14px",fontSize:11,color:C.dim}}>{rep?.name||"—"}</td>
                                        <td style={{padding:"9px 14px"}}><span style={{background:C.s3,color:C.dim,padding:"2px 6px",borderRadius:4,fontSize:10}}>{d.dealType||"—"}</span></td>
                                        <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                        <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                        <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                        <td style={{padding:"9px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ RH ESCALATIONS ═══ */}
          {view==="rh-escalations" && isRH && (
            <div className="fin">
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY ESCALATIONS</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · Items escalated to you because SLA was missed · Distinct from Approvals queue</div>
              </div>
              {(()=>{
                const myRegion = user_role?.region;
                const myRepIds = reps.filter(r=>r.region===myRegion).map(r=>r.id);

                // 1. IRs escalated to RH via ESC_CHAIN (escDept="Region Head" or dept=Region Head + past SLA)
                const escalatedIRs = internalReqs.filter(r=>
                  (r.escDept==="Region Head" || (r.dept==="Region Head" && r.status==="Overdue" && daysSince(r.raisedAt)>=(r.slaHours||48)/24)) &&
                  r.status!=="Done" && r.status!=="Withdrawn"
                );

                // 2. Tasks escalated to RH (assignedToUserId=activeUser and overdue, or escDept=Region Head)
                const escalatedTasks = tasks.filter(t=>
                  (t.escDept==="Region Head" || t.assignedToUserId===activeUser) &&
                  t.status!=="Done" && t.dueDate && t.dueDate < TODAY
                );

                // 3. Stalled deals in region (no contact 7+ days, not closed)
                const stalledDeals = visibleDeals.filter(d=>
                  myRepIds.includes(d.repId) &&
                  !["Lost","RO Received","Mail Confirmed"].includes(d.outcome||"") &&
                  daysSince(d.lastContact||d.createdAt||TODAY) >= 7
                );

                // 4. Overdue rep tasks in region (broader — for rep management)
                const overdueRepTasks = tasks.filter(t=>
                  myRepIds.includes(t.repId) &&
                  t.dueDate < TODAY && t.status !== "Done" &&
                  t.assignedToUserId !== activeUser // exclude RH's own tasks (shown in #2)
                );

                // Historical: deals awaiting approval past SLA
                const blockedDeals = visibleDeals.filter(d=>
                  myRepIds.includes(d.repId) &&
                  d.awaitingApproval && d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  !["Mail Confirmed","RO Received","Not Interested"].includes(d.outcome||"")
                );
                const total = escalatedIRs.length + escalatedTasks.length + stalledDeals.length + overdueRepTasks.length + blockedDeals.length;
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                      {[
                        {label:"ESCALATED IRs",      value:escalatedIRs.length,    color:C.red,    desc:"Requests overdue → escalated to you"},
                        {label:"TASKS ON YOU",        value:escalatedTasks.length,  color:C.orange, desc:"Overdue tasks assigned to you"},
                        {label:"STALLED DEALS",       value:stalledDeals.length,    color:C.purple, desc:"No contact for 7+ days"},
                        {label:"REP TASKS OVERDUE",   value:overdueRepTasks.length, color:C.blue,   desc:"Rep tasks past due date"},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                          <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color,marginBottom:2}}>{k.value}</div>
                          <div style={{fontSize:10,color:C.muted}}>{k.desc}</div>
                        </div>
                      ))}
                    </div>

                    {total===0 && <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:8}}>✓</div>
                      <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>No escalations</div>
                      <div style={{fontSize:11,color:C.dim}}>All items in {rhRegion} are on track. Approvals are under My Approvals →</div>
                    </div>}

                    {/* Escalated IRs */}
                    {escalatedIRs.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⬆ Escalated Requests (SLA Breached)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Rep","Subject","Type","Raised","SLA","Status","Action"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{escalatedIRs.map(r=>{
                              const dw=daysSince(r.raisedAt);
                              return (
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.red}04`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{r.raisedByName||"—"}</td>
                                  <td style={{padding:"10px 14px",maxWidth:200,fontSize:12}}>{r.subject}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.type}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{r.raisedAt}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{dw}d</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.status}</span></td>
                                  <td style={{padding:"10px 14px",whiteSpace:"nowrap",display:"flex",gap:4}}>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"In Progress",resolverNote:"Acknowledged by "+user_role?.name}:x))}
                                      style={{background:`${C.blue}18`,color:C.blue,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Accept</button>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY,resolverNote:"Resolved by "+user_role?.name}:x))}
                                      style={{background:`${C.green}18`,color:C.green,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Done</button>
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tasks escalated to RH */}
                    {escalatedTasks.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ Overdue Tasks Assigned to You</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Task","From","Client","Priority","Due","Days Over","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{escalatedTasks.map(t=>{
                              return (
                                <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}04`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{t.title}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.assignedByName||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(t.dueDate)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Stalled deals */}
                    {stalledDeals.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.purple,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⏸ Stalled Deals (No Contact 7+ Days)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Stage","Last Contact","Days Idle"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{stalledDeals.map(d=>{
                              const rep=reps.find(r=>r.id===d.repId);
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{d.lastContact||d.createdAt||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.purple,fontWeight:700}}>{daysSince(d.lastContact||d.createdAt||TODAY)}d</td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Overdue rep tasks in region */}
                    {overdueRepTasks.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 Rep Tasks Overdue in Your Region</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Task","Assigned To","Client","Priority","Due","Days Over","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{overdueRepTasks.map(t=>{
                              const rep=reps.find(r=>r.id===t.repId);
                              return (
                                <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{t.title}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(t.dueDate)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Blocked deals */}
                    {blockedDeals.length>0&&(
                      <div>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>🔒 Deals Blocked — Approval Past SLA</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Waiting For","Days","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{blockedDeals.map(d=>{
                              const rep=reps.find(r=>r.id===d.repId);
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:600}}>{d.awaitingApproval}</span></td>
                                  <td style={{padding:"10px 14px",color:C.orange,fontWeight:600}}>{daysSince(d.awaitingApprovalSince)}d</td>
                                  <td style={{padding:"10px 14px"}}><select value={d.awaitingApproval||""} onChange={e=>setDeals(p=>p.map(x=>x.id===d.id?{...x,awaitingApproval:e.target.value||null,awaitingApprovalSince:e.target.value?TODAY:null}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}><option value="">— Resolved —</option>{APPROVAL_TARGETS.map(t2=><option key={t2}>{t2}</option>)}</select></td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TEAM ═══ — Region Head sees their region team only */}
          {view==="team" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = reps.filter(r => r.region === rhRegion);
            const rhDeals  = visibleDeals;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM — {rhRegion}</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Revenue, pipeline, contact quality and compliance — your reps only</div>

                {myReps.map((rep,rank)=>{
                  const rd   = rhDeals.filter(d=>d.repId===rep.id);
                  const rC   = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP   = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct = rT>0?Math.round((rC/rT)*100):0;
                  const rRisk= rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver= rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed").length;
                  const rTasks = tasks.filter(t=>t.repId===rep.id&&t.status!=="Done").length;
                  const rBlocked= rd.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed").length;
                  const sc  = rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const tL  = meetings.some(m=>m.repId===rep.id&&m.date===TODAY);
                  const tP  = (plans||[]).some(p=>p.repId===rep.id&&p.date===TOMORROW);
                  const rankColor = rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rep.id} className="card" style={{padding:16,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        {/* Rank badge */}
                        <div style={{width:28,height:28,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:15,fontWeight:700}}>{rep.name}</span>
                            <span style={{fontSize:10,color:C.dim}}>{rep.region}</span>
                            {/* Compliance pills */}
                            <span style={{background:tL?`${C.green}22`:`${C.red}22`,color:tL?C.green:C.red,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{tL?"✓ Logged":"✗ Not logged"}</span>
                            <span style={{background:tP?`${C.green}22`:`${C.orange}22`,color:tP?C.green:C.orange,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{tP?"✓ Planned":"✗ Tmrw not planned"}</span>
                          </div>
                          {/* Revenue grid */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["DEALS",rd.length,C.blue]].map(([l,v,c])=>(
                              <div key={l} style={{background:C.s2,borderRadius:5,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".06em",marginBottom:2}}>{l}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {/* Alert badges */}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rRisk} at risk</span>}
                            {rOver>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rOver} overdue next steps</span>}
                            {rTasks>0&&<span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rTasks} open tasks</span>}
                            {rBlocked>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rBlocked} awaiting approval</span>}
                            {rRisk===0&&rOver===0&&rBlocked===0&&<span style={{background:`${C.green}18`,color:C.green,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>✓ On track</span>}
                          </div>
                        </div>
                        {/* Big % */}
                        <div style={{textAlign:"right",minWidth:56}}>
                          <div className="sans" style={{fontSize:32,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div>
                          <div style={{fontSize:9,color:C.dim}}>achieved</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ TEAM ═══ — Management view (non-RH) */}
          {view==="team" && !isRH && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM SCORECARD</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Revenue, pipeline coverage, contact quality, and compliance — per rep</div>
              {repScores.map((rep,rank)=>{
                const statColor=rep.cPct>=80?C.green:rep.cPct>=50?C.accent:C.red;
                return (
                  <div key={rep.id} className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:rank===0?`${C.accent}33`:rank===1?`${C.blue}22`:C.s3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rank===0?C.accent:rank===1?C.blue:C.dim,flexShrink:0}}>#{rank+1}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                          <div><span className="sans" style={{fontWeight:700,fontSize:14}}>{rep.name}</span><span style={{color:C.dim,fontSize:12,marginLeft:8}}>{rep.role} · {rep.region}</span></div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {!rep.attOk&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>NEG ATT TODAY</span>}
                            {rep.risk>0&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>{rep.risk} at risk</span>}
                            <span className="pill" style={{background:`${statColor}22`,color:statColor}}>{rep.cPct}% closed</span>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:10}}>
                          {[
                            {label:"CLOSED",      value:fmtR(rep.closed),  color:rep.closed>0?C.green:C.muted},
                            {label:"PIPELINE",    value:fmtR(rep.pipe),    color:C.accent},
                            {label:"TARGET",      value:fmtR(rep.target),  color:C.dim},
                            {label:"MEETINGS",    value:rep.meetings,       color:C.blue},
                            {label:"SENIOR MTG %",value:`${rep.senPct}%`,  color:rep.senPct>=70?C.green:rep.senPct>=40?C.accent:C.red},
                          ].map(s=>(
                            <div key={s.label} style={{background:C.s2,borderRadius:4,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:3}}>{s.label}</div>
                              <div className="sans" style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="pbar"><div className="pfill" style={{width:`${Math.min(rep.cPct,100)}%`,background:statColor}} /></div>
                        <div style={{display:"flex",gap:12,marginTop:5}}>
                          <span style={{fontSize:10,color:statColor}}>● Closed {rep.cPct}%</span>
                          <span style={{fontSize:10,color:C.accent}}>● Coverage {rep.coverage}%</span>
                          {rep.senPct<50&&<span style={{fontSize:10,color:C.red}}>⚠ {rep.senPct}% senior meetings — coaching needed</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ACTIVITY ═══ */}
          {view==="activity" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ACTIVITY LOG</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Every client interaction. Log before 12pm. {meetings.length} meetings recorded.</div>
                </div>
                {canLogMeeting && <button className="btn btn-primary" onClick={()=>setLogOpen(true)}>+ Log Touchpoint</button>}
              </div>

              {/* KPI cards — filtered to own meetings for reps */}
              {(()=>{
                const myRepId = user_role?.repId;
                const visM = isRep
                  ? meetings.filter(m=>m.repId===myRepId)
                  : meetings;
                return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"TODAY'S MEETINGS",  value:visM.filter(m=>m.date===TODAY).length,                 color:C.blue},
                  {label:"ON TIME",            value:visM.filter(m=>m.date===TODAY&&!m.late).length,        color:C.green},
                  {label:"LOGGED LATE",        value:visM.filter(m=>m.date===TODAY&&m.late).length,         color:C.orange},
                  {label:"SENIOR REQUESTS",    value:visM.filter(m=>m.seniorRequested==="Yes").length,      color:C.accent},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em"}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color,marginTop:3}}>{k.value}</div>
                  </div>
                ))}
              </div>
                );
              })()}

              {/* SENIOR ESCALATION REQUESTS — Darpan's requirement */}
              {meetings.filter(m=>m.seniorRequested==="Yes").length>0 && (
                <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                  <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Senior Meeting Requests — Pending Follow-Through</div>
                  {meetings.filter(m=>m.seniorRequested==="Yes").map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:C.s2,borderRadius:5,padding:"9px 12px",marginBottom:6,flexWrap:"wrap"}}>
                      <div style={{flex:1}}>
                        <span className="sans" style={{fontWeight:700}}>{m.repName}</span>
                        <span style={{color:C.dim,fontSize:12}}> asked for </span>
                        <span style={{color:C.blue,fontWeight:600}}>{m.seniorRequestedName||m.seniorRequestedRole}</span>
                        <span style={{color:C.dim,fontSize:12}}> ({m.seniorRequestedRole}) for next round with </span>
                        <span style={{fontWeight:600}}>{m.clientCompany}</span>
                      </div>
                      <div style={{fontSize:11,color:C.dim}}>Meeting on {m.date}</div>
                      <span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>PENDING</span>
                    </div>
                  ))}
                </div>
              )}

              {/* NEXT DAY PLAN — Sachin's requirement */}
              {meetings.filter(m=>m.scheduleNext&&m.nextMeetingDate).length>0 && (
                <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                  <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Next Day Plan — Scheduled Meetings</div>
                  {meetings.filter(m=>m.scheduleNext&&m.nextMeetingDate).sort((a,b)=>a.nextMeetingDate>b.nextMeetingDate?1:-1).map(m=>(
                    <div key={m.id} style={{background:C.s2,borderRadius:5,padding:"10px 14px",marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <span className="sans" style={{fontWeight:700}}>{m.repName}</span>
                          <span style={{color:C.dim,fontSize:12}}> → </span>
                          <span style={{fontWeight:600}}>{m.clientCompany}</span>
                          {m.contactName&&<span style={{color:C.dim,fontSize:12}}> · {m.contactName}</span>}
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:11,color:C.green}}>📅 {m.nextMeetingDate}{m.nextMeetingTime?` @ ${m.nextMeetingTime}`:""}</span>
                          {m.calendarStatus&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>{m.calendarPlatform==="google"?"GCal ✓":"ZCal ✓"}</span>}
                          {m.meetLink&&(
                            <a href={m.meetLink} target="_blank" rel="noreferrer"
                              style={{display:"inline-flex",alignItems:"center",gap:4,background:"#4285F422",color:"#4285F4",padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none",border:"1px solid #4285F444"}}>
                              🎥 Meet
                            </a>
                          )}
                        </div>
                      </div>
                      {m.nextAgenda&&<div style={{fontSize:11,color:C.dim,marginTop:5}}>Agenda: {m.nextAgenda}</div>}
                      {m.discussion&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>Last discussion: {m.discussion.slice(0,100)}{m.discussion.length>100?"...":""}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* FOLLOW-UP & NEXT MEETING REMINDERS */}
              {(()=>{
                const fuPlans = (plans||[]).filter(p =>
                  (p.autoCreatedFrom === "follow-up" || p.autoCreatedFrom === "next-meeting") &&
                  p.status !== "Done" && p.status !== "Cancelled" &&
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? reps.find(r=>r.id===p.repId)?.region===user_role.region : p.repId===user_role.repId)
                ).sort((a,b)=>a.date>b.date?1:-1).slice(0,10);
                if (!fuPlans.length) return null;
                return (
                  <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>📞 Follow-ups & Next Meetings ({fuPlans.length})</div>
                    {fuPlans.map(p=>{
                      const rep = reps.find(r=>r.id===p.repId);
                      const isOverdue = p.date < TODAY;
                      const isToday   = p.date === TODAY;
                      return (
                        <div key={p.id} style={{background:C.s2,borderRadius:5,padding:"10px 14px",marginBottom:6,borderLeft:`3px solid ${isOverdue?C.red:isToday?C.orange:C.blue}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <span style={{background:p.autoCreatedFrom==="next-meeting"?`${C.green}22`:`${C.blue}22`,color:p.autoCreatedFrom==="next-meeting"?C.green:C.blue,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,whiteSpace:"nowrap"}}>{p.autoCreatedFrom==="next-meeting"?"📅 Next Mtg":"📞 Follow-up"}</span>
                              {rep&&<span className="sans" style={{fontWeight:700}}>{rep.name}</span>}
                              {rep&&<span style={{color:C.dim,fontSize:12}}> → </span>}
                              <span style={{fontWeight:600}}>{p.clientAgencyName}</span>
                              {p.contactName&&<span style={{color:C.dim,fontSize:12}}> · {p.contactName}</span>}
                            </div>
                            <span style={{fontSize:11,color:isOverdue?C.red:isToday?C.orange:C.blue,fontWeight:600}}>
                              {isOverdue?"⚠ Overdue · ":isToday?"Today · ":""}{p.date}
                            </span>
                          </div>
                          {p.agenda&&<div style={{fontSize:11,color:C.dim,marginTop:4}}>{p.agenda}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ACTION ITEM DUE DATE ALERTS */}
              {(()=>{
                const visReps = (user_role.canView==="all" ? reps : user_role.canView==="region" ? reps.filter(r=>r.region===user_role.region) : reps.filter(r=>r.id===user_role.repId)).map(r=>r.id);
                const dueTasks = tasks.filter(t => visReps.includes(t.repId) && t.status!=="Done" && t.dueDate);
                const stepDuePlansWR = (plans||[]).filter(p => visReps.includes(p.repId) && p.autoCreatedFrom==="next-step" && p.status!=="Done");
                const all = [
                  ...dueTasks.filter(t=>t.dueDate<TODAY).map(t=>({...t, _urgency:"overdue"})),
                  ...stepDuePlansWR.filter(p=>p.date<TODAY).map(p=>({...p, title:p.agenda, _urgency:"overdue"})),
                  ...dueTasks.filter(t=>t.dueDate===TODAY).map(t=>({...t, _urgency:"today"})),
                  ...stepDuePlansWR.filter(p=>p.date===TODAY).map(p=>({...p, title:p.agenda, _urgency:"today"})),
                  ...dueTasks.filter(t=>t.dueDate===TOMORROW).map(t=>({...t, _urgency:"tomorrow"})),
                  ...stepDuePlansWR.filter(p=>p.date===TOMORROW).map(p=>({...p, title:p.agenda, _urgency:"tomorrow"})),
                ];
                if (!all.length) return null;
                return (
                  <div style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>⏰ Action Item Due Dates ({all.length})</div>
                    {all.slice(0,12).map((item,i)=>{
                      const clr = item._urgency==="overdue"?C.red:item._urgency==="today"?C.orange:C.blue;
                      const rep = reps.find(r=>r.id===(item.repId||item.assignedTo));
                      return (
                        <div key={item.id||i} style={{background:C.s2,borderRadius:5,padding:"8px 12px",marginBottom:4,borderLeft:`3px solid ${clr}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{item.title||"—"}</div>
                            <div style={{fontSize:10,color:C.dim}}>
                              {rep&&<span>{rep.name} · </span>}
                              {(item.clientCompany||item.clientAgencyName)&&<span>{item.clientCompany||item.clientAgencyName}</span>}
                              {(item.assignedDept||item.neededFrom)&&<span> → {item.assignedDept||item.neededFrom}</span>}
                            </div>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,color:clr,whiteSpace:"nowrap"}}>
                            {item._urgency==="overdue"?"⚠ OVERDUE":item._urgency==="today"?"Due TODAY":"Due TOMORROW"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* MEETING LOG — day by day */}
              {meetings.length === 0 && (
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:10}}>📝</div>
                  <div className="sans" style={{fontWeight:700,marginBottom:5}}>No meetings logged yet</div>
                  <div style={{color:C.dim,fontSize:12,marginBottom:16}}>Click "+ Log Touchpoint" above to record today's client touchpoints</div>
                </div>
              )}

              {[TODAY,D1,D3,D7].map(date=>{
                const dm = meetings.filter(m => m.date===date &&
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? reps.find(r=>r.id===m.repId)?.region===user_role.region : m.repId===user_role.repId)
                );
                if (!dm.length) return null;
                const label = date===TODAY?"TODAY":date===D1?"YESTERDAY":date===D3?"3 DAYS AGO":"LAST WEEK";
                return (
                  <div key={date} style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                      <span>{label} — {date}</span>
                      <span style={{color:C.muted}}>{dm.length} meeting{dm.length!==1?"s":""}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {dm.map(m=>(
                        <div key={m.id} style={{background:C.surface,border:`1px solid ${m.late?C.orange:C.border}`,borderRadius:8,padding:"12px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
                            {/* Left — who */}
                            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                              <div style={{width:32,height:32,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.accent,flexShrink:0}}>
                                {(m.repName||"?")[0]}
                              </div>
                              <div>
                                <div className="sans" style={{fontWeight:700,fontSize:13}}>{m.repName}</div>
                                <div style={{fontSize:11,color:C.dim}}>{m.region} · {m.meetingTime||"Time not set"}</div>
                              </div>
                            </div>
                            {/* Right — meta */}
                            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                              {m.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{m.pitchType}</span>}
                              {m.meetingType&&<span style={{background:(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?`${C.green}18`:(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"#4285F418":`${C.blue}18`,color:(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?C.green:(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"#4285F4":C.blue,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{(m.meetingType==="Physical"||m.meetingType==="Physical Meeting")?"🤝":(m.meetingType==="Online"||m.meetingType==="Online Meeting")?"💻":"📞"} {m.meetingType}</span>}
                              {m.clientOrAgency&&<span style={{background:C.s3,color:C.dim,padding:"2px 7px",borderRadius:8,fontSize:10}}>{m.clientOrAgency}</span>}
                              <span style={{fontSize:11,color:m.late?C.orange:C.green,fontWeight:600}}>{m.loggedAt} {m.late?"⚠ late":"✓"}</span>
                            </div>
                          </div>

                          {/* Client + contact */}
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8,alignItems:"center"}}>
                            <span className="sans" style={{fontWeight:700,fontSize:14}}>{m.clientCompany}</span>
                            {m.contactName&&<span style={{color:C.dim,fontSize:12}}>· {m.contactName}{m.designation?`, ${m.designation}`:""}</span>}
                            {m.status&&<span style={{background:`${oColor(m.outcome)}18`,color:oColor(m.outcome),padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600,marginLeft:"auto"}}>{m.status}</span>}
                          </div>

                          {/* Discussion + feedback — GK: free text */}
                          {m.discussion&&<div style={{fontSize:12,color:C.text,marginBottom:4,lineHeight:1.6}}>{m.discussion}</div>}
                          {m.clientFeedback&&<div style={{fontSize:11,color:C.dim,background:C.s2,padding:"6px 10px",borderRadius:5,marginBottom:6}}>Client feedback: {m.clientFeedback}</div>}

                          {/* Next steps + follow-up */}
                          {(m.nextSteps||m.followUpDate)&&(
                            <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:6}}>
                              {m.nextSteps&&<div style={{fontSize:11,color:C.accent}}>→ {m.nextSteps}</div>}
                              {m.followUpDate&&<div style={{fontSize:11,color:C.blue}}>📅 Follow-up: {m.followUpDate}</div>}
                            </div>
                          )}

                          {/* Senior escalation */}
                          {m.seniorRequested==="Yes"&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:7,background:`${C.blue}10`,padding:"5px 10px",borderRadius:5}}>
                              <span style={{color:C.blue,fontSize:12}}>⬆</span>
                              <span style={{fontSize:11,color:C.blue}}>Senior requested: <strong>{m.seniorRequestedName||m.seniorRequestedRole}</strong> ({m.seniorRequestedRole}) for next round</span>
                            </div>
                          )}

                          {/* Next meeting scheduled */}
                          {m.scheduleNext&&m.nextMeetingDate&&(
                            <div style={{marginTop:8,background:`${C.green}10`,border:`1px solid ${C.green}22`,borderRadius:5,padding:"8px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,color:C.green,fontWeight:600}}>📅 Next: {m.nextMeetingDate}{m.nextMeetingTime?` @ ${m.nextMeetingTime}`:""}</span>
                                {m.calendarStatus&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>{m.calendarPlatform==="google"?"Google Calendar":"Zoho Calendar"} ✓</span>}
                                {m.meetLink&&(
                                  <a href={m.meetLink} target="_blank" rel="noreferrer"
                                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"#4285F422",color:"#4285F4",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none",border:"1px solid #4285F444"}}>
                                    🎥 Join Google Meet
                                  </a>
                                )}
                              </div>
                              {m.nextAgenda&&<div style={{fontSize:11,color:C.dim,marginTop:4}}>Agenda: {m.nextAgenda}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ESCALATIONS ═══ */}
          {view==="escalations" && (
            <div className="fin">
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>Approvals overdue · Internal requests stuck · Tasks you're tagged in</div>
              </div>

              {(() => {
                const myRepId = user_role?.repId;

                // 1. Approval overdue (awaitingApproval set + past SLA)
                const approvalEsc = visibleDeals.filter(d =>
                  d.awaitingApproval &&
                  d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  d.outcome !== "Mail Confirmed" &&
                  d.outcome !== "Not Interested" &&
                  (user_role.canView!=="self" || d.repId===myRepId)
                );

                // 2. Internal department requests overdue (legacy deal reqs)
                const reqEsc = deals.flatMap((d,_) =>
                  (d.reqs||[])
                    .map((r,i) => ({...r, dealId:d.id, reqIdx:i, clientCompany:d.clientCompany, repId:d.repId, amount:d.amount}))
                    .filter(r => r.status==="Overdue" && (user_role.canView!=="self" || d.repId===myRepId))
                );

                // 2b. SLA-breached Internal Requests (internalReqs pending 48h+)
                const irSLABreached = internalReqs.filter(ir =>
                  ir.status === "Pending" &&
                  daysSince(ir.raisedAt) >= APPROVAL_SLA_DAYS &&
                  (user_role.canView!=="self" ? true : ir.repId===myRepId || ir.raisedBy===activeUser)
                );

                // 3. Tasks overdue and tagged to this user's deals or assigned to them
                const taskEsc = tasks.filter(t =>
                  t.status !== "Done" &&
                  (t.dueDate < TODAY || t.status === "Overdue") &&
                  (user_role.canView!=="self" ? true : t.assignedTo===myRepId||t.assignedToUserId===activeUser)
                );

                const total = approvalEsc.length + reqEsc.length + taskEsc.length;

                return (
                  <div>
                    {/* Summary strip */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                      {[
                        {label:"APPROVALS OVERDUE",  value:approvalEsc.length,   color:C.red,    desc:`Pending >${APPROVAL_SLA_DAYS}d without response`},
                        {label:"REQUESTS BREACHED",   value:irSLABreached.length, color:C.orange, desc:"Internal requests past 48h SLA"},
                        {label:"TASKS OVERDUE",       value:taskEsc.length,       color:C.blue,   desc:"Tasks past due date"},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                          <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color,marginBottom:2}}>{k.value}</div>
                          <div style={{fontSize:10,color:C.muted}}>{k.desc}</div>
                        </div>
                      ))}
                    </div>

                    {total===0 && (
                      <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:8}}>✓</div>
                        <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>No escalations</div>
                        <div style={{fontSize:11,color:C.dim}}>All approvals, requests and tasks are on track.</div>
                      </div>
                    )}

                    {/* SECTION 1: Approvals overdue */}
                    {approvalEsc.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          ⏳ Approvals Pending Over {APPROVAL_SLA_DAYS} Days
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Client","Rep","Amount","Waiting For","Days Waiting","Stage","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {approvalEsc.map(d=>{
                                const rep=reps.find(r=>r.id===d.repId);
                                const dw=daysSince(d.awaitingApprovalSince);
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.red}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.red}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.red}04`}>
                                    <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                    <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 9px",borderRadius:5,fontSize:11,fontWeight:700}}>{d.awaitingApproval}</span></td>
                                    <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{dw}d overdue</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                    <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                      <button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()}
                                        style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginRight:4}}>
                                        Resolved
                                      </button>
                                      <button onClick={()=>setView("pipeline")}
                                        style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                        View Deal
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: Internal requests stuck */}
                    {reqEsc.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          🔧 Internal Requests Overdue
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Client","Department","Request","SLA","Status","Update"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {reqEsc.map((r,i)=>{
                                const sla = SLA[r.dept]||24;
                                return (
                                  <tr key={i} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.orange}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.orange}04`}>
                                    <td style={{padding:"10px 14px"}}><div style={{fontWeight:600}}>{r.clientCompany}</div></td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}22`,color:C.blue,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.dept}</span></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:200,whiteSpace:"normal"}}>{r.desc}</td>
                                    <td style={{padding:"10px 14px",color:C.accent,fontSize:11}}>{sla}h SLA</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>OVERDUE</span></td>
                                    <td style={{padding:"10px 14px"}}>
                                      <select value={r.status} onChange={e=>updateReq(r.dealId,r.reqIdx,e.target.value)}
                                        style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                        {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2b: SLA-breached Internal Requests */}
                    {irSLABreached.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          ⚠ Internal Requests — SLA Breached (48h+)
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["From","Type","Subject","Client","Raised","Days","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {irSLABreached.map(r=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.orange}06`}}>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{r.raisedByName}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.type}</span></td>
                                  <td style={{padding:"10px 14px",maxWidth:200,fontSize:12}}>{r.subject}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{r.clientCompany||"—"}</td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{r.raisedAt}</td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{daysSince(r.raisedAt)}d</td>
                                  <td style={{padding:"10px 14px",whiteSpace:"nowrap",display:"flex",gap:4}}>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"In Progress"}:x))} style={{background:`${C.blue}18`,color:C.blue,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Accept</button>
                                    <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY}:x))} style={{background:`${C.green}18`,color:C.green,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Done</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: Overdue tasks */}
                    {taskEsc.length>0&&(
                      <div>
                        <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                          📋 Tasks Overdue
                        </div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Task","Assigned To","Client","Priority","Due","Days Overdue","Update"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {taskEsc.map(t=>{
                                const rep=reps.find(r=>r.id===t.assignedTo);
                                const daysOver=daysSince(t.dueDate);
                                return (
                                  <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.blue}04`}}
                                    onMouseOver={e=>e.currentTarget.style.background=`${C.blue}08`}
                                    onMouseOut={e=>e.currentTarget.style.background=`${C.blue}04`}>
                                    <td style={{padding:"10px 14px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                    <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                    <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.dueDate}</td>
                                    <td style={{padding:"10px 14px",color:C.red,fontWeight:700,fontSize:11}}>{daysOver}d</td>
                                    <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                      <select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))}
                                        style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                        {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ ACTIVITY ═══ */}

          {/* ═══ ESCALATIONS ═══ */}

          {/* ═══ COMPLIANCE ═══ */}
          {view==="compliance" && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>COMPLIANCE</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>12pm hard deadline. Missed = negative attendance. Non-regularisable.</div>
              {[TODAY,D1].map(date=>{
                const a=att[date]||{};
                const label=date===TODAY?"TODAY":"YESTERDAY";
                return (
                  <div key={date} style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8}}>{label} — {date}</div>
                    <div className="card" style={{overflow:"hidden"}}>
                      <table>
                        <thead><tr><th>Rep</th><th>Region</th><th>Role</th><th>Logged</th><th>Meetings</th><th>Status</th></tr></thead>
                        <tbody>
                          {reps.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(rep=>{
                            const logged=a[rep.id];
                            const rm=meetings.filter(m=>m.repId===rep.id&&m.date===date);
                            const hasLate=rm.some(m=>m.late);
                            return (
                              <tr key={rep.id}>
                                <td className="sans" style={{fontWeight:700}}>{rep.name}</td>
                                <td style={{color:C.dim}}>{rep.region}</td>
                                <td style={{color:C.dim,fontSize:11}}>{rep.role}</td>
                                <td style={{color:logged?C.green:C.red,fontSize:16,fontWeight:700}}>{logged?"✓":"✗"}</td>
                                <td>{rm.length}</td>
                                <td>
                                  {!logged&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>NEG ATTENDANCE</span>}
                                  {logged&&hasLate&&<span className="pill" style={{background:`${C.orange}22`,color:C.orange}}>LOGGED LATE</span>}
                                  {logged&&!hasLate&&<span className="pill" style={{background:`${C.green}22`,color:C.green}}>ON TIME</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ HR REPORTS ═══ */}
          {view==="hr" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>HR ABSENCE REPORTS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Auto-generated 23:30 · Sent to <span style={{color:C.accent}}>{HR_EMAIL}</span></div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {attDbLoading&&<span style={{fontSize:11,color:C.muted}}>Loading…</span>}
                  <button className="btn" style={{fontSize:11,padding:"5px 10px"}} onClick={fetchAttendanceData}>↻ Refresh</button>
                  {canGrantException&&<button className="btn btn-primary" onClick={()=>{
                    runEODCheck();
                    attendSvc.simulateEod().then(()=>fetchAttendanceData()).catch(()=>{});
                  }}>▶ Simulate EOD Run</button>}
                </div>
              </div>

              {/* Rules — compact strip */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {[
                  {label:"Deadline",  val:"11:30 PM daily"},
                  {label:"Trigger",   val:"No log + no plan = absent"},
                  {label:"Override",  val:"Admin / CXO only"},
                  {label:"Audit",     val:"Every exception logged"},
                ].map(r=>(
                  <div key={r.label} style={{background:`${C.red}08`,border:`1px solid ${C.red}22`,borderRadius:5,padding:"6px 12px",display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:10,color:C.red,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{r.label}:</span>
                    <span style={{fontSize:11,color:C.text}}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* ── PERSONAL: Own attendance records — DB is sole source of truth ── */}
              {!isAdmin && (()=>{
                const myUserId   = user?.id || "";
                const dbRecs     = attDbRecords.filter(r=>r.userId===myUserId);
                const TODAY_DATE = TODAY;
                const YESTERDAY  = new Date(Date.now()-86400000).toISOString().slice(0,10);
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
                      {[
                        {label:"MY ABSENCES", value:dbRecs.filter(r=>r.status==="absent").length,  color:C.red},
                        {label:"EXCEPTIONS",  value:attExcRequests.filter(r=>r.userId===myUserId&&r.status==="granted").length, color:C.green},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:4,textTransform:"uppercase"}}>{k.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                    {attDbLoading ? (
                      <div style={{textAlign:"center",padding:32,color:C.muted,fontSize:12}}>Loading attendance records…</div>
                    ) : dbRecs.length===0 ? (
                      <div style={{textAlign:"center",padding:40,color:C.muted,border:`1px dashed ${C.border}`,borderRadius:8,fontSize:12}}>
                        No compliance records yet. Records are written by the compliance engine at 11:30 PM IST each day.
                        <br/><span style={{fontSize:11,color:C.dim,marginTop:4,display:"block"}}>Ask your Region Head or Admin to run the EOD simulation.</span>
                      </div>
                    ) : (
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",padding:"8px 14px",background:C.s2,borderBottom:`1px solid ${C.border}`}}>MY ATTENDANCE LOG (compliance engine)</div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Date","Touchpoint","Plan","Status","Exception","Action"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{dbRecs.map(r=>{
                            const stColor = r.status==="absent"?C.red:r.status==="partial"?C.orange:r.status==="exception_granted"?C.purple:C.green;
                            const stLabel = r.status==="absent"?"Absent":r.status==="partial"?"Partial":r.status==="exception_granted"?"Exc. Granted":"Present";
                            const exc = attExcRequests.find(e=>e.userId===myUserId&&e.date===r.date);
                            const canRequest = (r.status==="absent"||r.status==="partial") && !exc && (r.date===TODAY_DATE||r.date===YESTERDAY);
                            return (
                              <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                <td style={{padding:"9px 14px"}}><span style={{color:r.touchpointLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.touchpointLogged==="yes"?"✓":"✗"}</span></td>
                                <td style={{padding:"9px 14px"}}><span style={{color:r.planLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.planLogged==="yes"?"✓":"✗"}</span></td>
                                <td style={{padding:"9px 14px"}}><span style={{background:`${stColor}22`,color:stColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{stLabel}</span></td>
                                <td style={{padding:"9px 14px"}}>
                                  {exc ? (
                                    <div>
                                      <span style={{background:exc.status==="granted"?`${C.green}22`:exc.status==="rejected"?`${C.red}22`:`${C.orange}22`,color:exc.status==="granted"?C.green:exc.status==="rejected"?C.red:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>
                                        {exc.status==="granted"?"Granted":exc.status==="rejected"?"Rejected":`Pending (${exc.currentStage})`}
                                      </span>
                                      {exc.grantedBy&&<div style={{fontSize:10,color:C.dim,marginTop:2}}>by {exc.grantedBy}</div>}
                                    </div>
                                  ) : <span style={{color:C.muted,fontSize:11}}>—</span>}
                                </td>
                                <td style={{padding:"9px 14px"}}>
                                  {canRequest&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.blue}18`,color:C.blue,border:`1px solid ${C.blue}44`}} onClick={()=>{setExcReqRecord(r);setExcReqForm({reason:"",notes:""});setExcReqOpen(true);}}>Request Exception</button>}
                                  {exc&&exc.status==="pending"&&<span style={{fontSize:10,color:C.muted}}>Awaiting {exc.currentStage}</span>}
                                </td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── ADMIN absence log table (full org view) ── */}
              {isAdmin && (()=>{
                const useDb = attDbRecords.length > 0;
                const dbReports = attDbRecords;
                const blobReports = absenceReports;
                return (
                  <div>
                    {/* DB Records Table */}
                    {useDb && (
                      <div style={{marginBottom:24}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>Attendance Records — DB (Compliance Engine)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Rep","Region","Date","Touchpoint","Plan","Status","Exception","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>{dbReports.map(r=>{
                              const stColor = r.status==="absent"?C.red:r.status==="partial"?C.orange:r.status==="exception_granted"?C.purple:C.green;
                              const stLabel = r.status==="absent"?"Absent":r.status==="partial"?"Partial":r.status==="exception_granted"?"Exc. Granted":"Present";
                              const exc = attExcRequests.find(e=>e.userId===r.userId&&e.date===r.date);
                              const excGranted = exc?.status==="granted";
                              return (
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}><div style={{fontWeight:600}}>{r.userName||r.userId}</div></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region||"—"}</span></td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                  <td style={{padding:"9px 14px"}}><span style={{color:r.touchpointLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.touchpointLogged==="yes"?"✓":"✗"}</span></td>
                                  <td style={{padding:"9px 14px"}}><span style={{color:r.planLogged==="yes"?C.green:C.red,fontWeight:700}}>{r.planLogged==="yes"?"✓":"✗"}</span></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${stColor}22`,color:stColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{stLabel}</span></td>
                                  <td style={{padding:"9px 14px"}}>
                                    {exc ? (
                                      <span style={{background:excGranted?`${C.green}22`:exc.status==="rejected"?`${C.red}22`:`${C.orange}22`,color:excGranted?C.green:exc.status==="rejected"?C.red:C.orange,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>
                                        {excGranted?"Granted":exc.status==="rejected"?"Rejected":`Pending: ${exc.currentStage}`}
                                      </span>
                                    ) : <span style={{color:C.muted,fontSize:11}}>—</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                                    {(r.status==="absent"||r.status==="partial")&&!excGranted&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`}} onClick={()=>{
                                      const reason=prompt("Grant exception reason:");
                                      if(!reason?.trim()) return;
                                      attendSvc.grantException(r.id, reason)
                                        .then(()=>fetchAttendanceData()).catch(()=>{});
                                    }}>Grant Exception</button>}
                                    {exc&&exc.status==="pending"&&<span style={{fontSize:10,color:C.muted,marginLeft:4}}>Chain: {exc.currentStage}</span>}
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {/* Legacy blob table */}
                    {blobReports.length>0 && (
                      <div>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>Legacy Absence Reports (Blob)</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>
                              {["Rep","Region","Date","Generated","Status","Exception","Action"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {blobReports.map(r=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"9px 14px"}}><div style={{fontWeight:600}}>{r.repName}</div></td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region}</span></td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                  <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.generatedAt}</td>
                                  <td style={{padding:"9px 14px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                                  <td style={{padding:"9px 14px"}}>
                                    {r.exception?<div><span style={{background:`${C.green}22`,color:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>by {r.exceptionBy}</span></div>:<span style={{color:C.muted,fontSize:11}}>—</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                                    {r.markedAs==="Absent"&&!r.exception&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`}} onClick={()=>{setExceptionModal({reportId:r.id,repName:r.repName});setExceptionReason("");}}>Grant Exception</button>}
                                    {r.exception==="Overridden"&&<button className="btn" style={{fontSize:10,padding:"3px 9px",background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,marginLeft:4}} onClick={()=>revokeException(r.id)}>Revoke</button>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {!useDb&&!blobReports.length&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No absence records. Run Simulate EOD or wait for the 23:30 compliance engine.</div>}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TASKS ═══ */}
          {view==="tasks" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TASKS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Assign tasks to reps · reps see these in War Room</div>
                </div>
                {/* Reps can create tasks for themselves; managers assign to others */}
                <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>
                  {isRep ? "+ Create Task" : "+ Assign Task"}
                </button>
              </div>

              {(()=>{
                const repId_s = user_role?.repId;
                const myTaskSet = isRep
                  ? tasks.filter(t=>t.assignedTo===repId_s||t.assignedToUserId===activeUser)
                  : tasks;
                return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"OPEN",       value:myTaskSet.filter(t=>t.status==="Open").length,                             color:C.blue},
                  {label:"IN PROGRESS",value:myTaskSet.filter(t=>t.status==="In Progress").length,                      color:C.accent},
                  {label:"OVERDUE",    value:myTaskSet.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,             color:C.red},
                  {label:"DONE",       value:myTaskSet.filter(t=>t.status==="Done").length,                              color:C.green},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                  </div>
                ))}
              </div>
                );
              })()}

              {(() => {
                const myRepId=user_role?.repId;
                const vis=isRep?tasks.filter(t=>t.assignedTo===myRepId||t.assignedToUserId===activeUser):tasks;
                if(!vis.length) return <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>{isRep?"No tasks assigned to you yet.":"No tasks yet. Assign one above."}</div>;
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>
                        {(!isRep?["Assigned To"]:[]). concat(["Task","Client","Priority","Status","Due","Action"]).map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {vis.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(task=>{
                          const assignee=task.assignedToUserId?USER_ROLES.find(u=>u.id===task.assignedToUserId):reps.find(r=>r.id===task.assignedTo);
                          const rep=assignee||(task.assignedTo?reps.find(r=>r.id===task.assignedTo):null);
                          const overdue=task.dueDate<TODAY&&task.status!=="Done";
                          const sc=task.status==="Done"?C.green:overdue?C.red:task.status==="In Progress"?C.blue:C.accent;
                          return (
                            <tr key={task.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}}
                              onMouseOver={e=>e.currentTarget.style.background=overdue?`${C.red}08`:C.s2}
                              onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                              {!isRep&&<td style={{padding:"10px 14px"}}><div style={{fontWeight:600,fontSize:12}}>{rep?.name||task.assignedToName||"—"}</div><div style={{fontSize:10,color:C.dim}}>{rep?.region||(assignee&&(assignee as any).role!=="SALES REP"?(assignee as any).role:null)}</div>{task.assignedDept&&<span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,marginTop:2,display:"inline-block"}}>dept: {task.assignedDept}</span>}</td>}
                              <td style={{padding:"10px 14px"}}><div style={{fontWeight:600,fontSize:12}}>{task.title}</div>{task.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:220,whiteSpace:"normal",lineHeight:1.4}}>{task.description}</div>}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{task.clientCompany||"—"}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:task.priority==="High"?`${C.red}18`:task.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:task.priority==="High"?C.red:task.priority==="Medium"?C.orange:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{task.priority}</span></td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":task.status}</span></td>
                              <td style={{padding:"10px 14px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{task.dueDate}</td>
                              <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                {(()=>{
                                  const canEdit = isAdmin || task.assignedToUserId===activeUser || task.assignedTo===user_role?.repId || task.assignedBy===activeUser;
                                  return task.status!=="Done" && canEdit ? (
                                    <select value={task.status} onChange={e=>setTasks(p=>p.map(t=>t.id===task.id?{...t,status:e.target.value}:t))}
                                      style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,marginRight:6}}>
                                      {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                    </select>
                                  ) : task.status!=="Done" ? (
                                    <span style={{color:C.muted,fontSize:10}}>—</span>
                                  ) : null;
                                })()}
                                {isAdmin&&<button onClick={()=>setTasks(p=>p.filter(t=>t.id!==task.id))} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 5px"}}>✕</button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TARGET SUBMISSION (REP) ═══ */}
          {view==="target-submit" && isRep && (()=>{
            const myRepId = user_role?.repId;
            const mySubs  = targetSubs.filter(t=>t.repId===myRepId);
            const dealTypes = ["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"];
            const statusColor = s => s==="Approved"?C.green:s==="Pending RH"||s==="Pending NSH"||s==="Pending Strategy"||s==="Pending CRO"?C.orange:s==="Rejected"?C.red:C.dim;

            // Summary stats — target only from APPROVED subs; achievement from revenue entries
            const qSubs         = mySubs.filter(s=>qMatch(s.quarter));
            const allActiveSubs = qSubs.filter(s=>s.status!=="Rejected");
            const approvedSubs  = qSubs.filter(s=>s.status==="Approved");
            const activeSub     = allActiveSubs.length > 0; // used to show/hide section
            const isFrozen      = approvedSubs.some(s=>s.frozenTarget!=null);
            // Target = frozenTarget if CRO has locked it, else live totalTarget — never changes after freeze
            const totalTarget   = approvedSubs.reduce((s,sub)=>s+(sub.frozenTarget??sub.totalTarget),0);
            // Achievement = ALL revenue entries for rep in current quarter (matches War Room CLOSED QTD)
            const totalAchieved = revenueEntries.filter(e=>e.repId===myRepId&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const pct = totalTarget>0 ? Math.round((totalAchieved/totalTarget)*100) : 0;
            const pctColor = pct>=80?C.green:pct>=50?C.accent:C.red;

            return (
              <div className="fin">
                {/* Header row: title + Add Client button top-right */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TARGETS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Submit your client-wise targets for approval. Once CRO approves, they become your official quota.</div>
                  </div>
                  <button onClick={()=>{ setAddClientForm({clientCompany:"",dealType:"Linear TV",targetAmount:""}); setAddClientModalOpen(true); }}
                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:7,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    + Add Client
                  </button>
                </div>

                {/* Approval chain indicator — live step highlighting */}
                {(()=>{
                  const latestSub = allActiveSubs.length>0 ? allActiveSubs.reduce((a,b)=>((a.submittedAt||"")>=(b.submittedAt||"") ? a : b)) : null;
                  const chainStatus = latestSub?.status || null;
                  const stepMap:Record<string,number> = {"Pending RH":1,"Pending NSH":2,"Pending Strategy":3,"Pending CRO":4,"Approved":5};
                  const activeStep = chainStatus ? (stepMap[chainStatus]??0) : 0;
                  const pillLabels = ["You","Region Head","NSH","Sales Strategy","CRO → Approved"];
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:0,marginTop:14,marginBottom:16,flexWrap:"wrap"}}>
                      {pillLabels.map((s,i)=>{
                        const done    = activeStep===5 || i<activeStep;
                        const current = activeStep<5 && i===activeStep;
                        const bg    = done ? `${C.green}18` : current ? `${C.accent}18` : `${C.dim}10`;
                        const bdr   = done ? `1px solid ${C.green}44` : current ? `1px solid ${C.accent}55` : `1px solid ${C.border}`;
                        const col   = done ? C.green : current ? C.accent : C.muted;
                        const fw    = (done||current) ? 700 : 500;
                        return (
                          <div key={s} style={{display:"flex",alignItems:"center"}}>
                            <div style={{background:bg,border:bdr,borderRadius:6,padding:"4px 10px",fontSize:10,color:col,fontWeight:fw,whiteSpace:"nowrap",transition:"all .2s"}}>
                              {done&&i<4?"✓ "+s:s}
                            </div>
                            {i<4&&<div style={{width:16,height:1,background:done?C.green:C.border,transition:"background .2s"}}/>}
                          </div>
                        );
                      })}
                      {chainStatus&&chainStatus!=="Approved"&&<div style={{marginLeft:12,fontSize:10,color:C.dim}}>Awaiting {pillLabels[activeStep]}</div>}
                      {chainStatus==="Approved"&&<div style={{marginLeft:12,fontSize:10,color:C.green,fontWeight:700}}>Fully Approved ✓</div>}
                    </div>
                  );
                })()}

                {/* ── Always-visible ACHIEVED card (even with no targets) ── */}
                {!activeSub && totalAchieved > 0 && (
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    <div className="card" style={{padding:"12px 16px",minWidth:140}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:2}}>ACHIEVED THIS QUARTER</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:C.green}}>{fmtR(totalAchieved)}</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:2}}>RO received · No target set yet</div>
                    </div>
                  </div>
                )}

                {/* ── Get Started for the Year banner (new reps with no targets) ── */}
                {!activeSub && (
                  <div style={{background:"linear-gradient(135deg,#6366f118,#8b5cf618)",border:"1px solid #8b5cf633",borderRadius:12,padding:"28px 24px",marginBottom:24,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:12}}>🚀</div>
                    <div className="sans" style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:8}}>Get Started for FY26!</div>
                    <div style={{fontSize:12,color:C.dim,lineHeight:1.7,marginBottom:20,maxWidth:420,margin:"0 auto 20px"}}>
                      You haven't submitted any targets yet for this quarter.<br/>
                      Add your client names and target amounts — your Region Head will review and send them up the chain for approval.
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:16,justifyContent:"center",marginBottom:20}}>
                      {[["1. You submit","Add clients + targets below"],["2. RH reviews","Region Head checks and approves"],["3. NSH & Strategy","Verify alignment with national plan"],["4. CRO locks it in","Becomes your official quota"]].map(([step,desc])=>(
                        <div key={step} style={{background:"#fff",border:"1px solid #c8d3e5",borderRadius:8,padding:"10px 14px",minWidth:130,textAlign:"left"}}>
                          <div style={{fontSize:10,fontWeight:700,color:"#8b5cf6",marginBottom:3,letterSpacing:".06em"}}>{step}</div>
                          <div style={{fontSize:11,color:C.dim}}>{desc}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>{ setAddClientForm({clientCompany:"",dealType:"Linear TV",targetAmount:""}); setAddClientModalOpen(true); }}
                      style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:8,padding:"11px 28px",fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                      + Add My First Client Target
                    </button>
                  </div>
                )}

                {/* Summary stats row — Part 5 four-number dashboard */}
                {activeSub && (()=>{
                  const committed = getCommitted(myRepId);
                  const inPlay    = getInPlay(myRepId);
                  const shortfall = getShortfall(totalTarget, myRepId);
                  const sfColor   = shortfall===0 ? C.green : C.red;
                  return (<>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:12}}>
                      {[
                        {label:"TOTAL TARGET", value:fmtR(totalTarget), color:C.accent, locked:isFrozen, sub:"Official quota"},
                        {label:"ACHIEVED",      value:fmtR(totalAchieved), color:pctColor,           sub:"RO received"},
                        {label:"COMMITTED",     value:fmtR(committed),     color:C.blue,             sub:"Mail confirmed"},
                        {label:"IN PLAY",       value:fmtR(inPlay),        color:"#d97706",          sub:"Active pipeline"},
                        {label:"SHORTFALL",     value:fmtR(shortfall),     color:sfColor,            sub:shortfall===0?"On target":"Gap remaining"},
                      ].map(s=>(
                        <div key={s.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{s.label}</div>
                            {s.locked && <span title="CRO-approved and frozen — cannot change" style={{fontSize:10,color:C.green}}>🔒</span>}
                          </div>
                          <div className="sans" style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                    {stackedBar(totalTarget, totalAchieved, committed, inPlay, shortfall, 0)}
                    <div style={{marginBottom:20}} />
                  </>);
                })()}

                {/* Add Client Modal */}
                {addClientModalOpen && (
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>{if(e.target===e.currentTarget)setAddClientModalOpen(false);}}>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:480,maxWidth:"95vw",boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isFrozen?12:20}}>
                        <div className="sans" style={{fontWeight:700,fontSize:15}}>{isFrozen?"Add Additional Revenue":"Add Client Target"} — {filterQ}</div>
                        <button onClick={()=>setAddClientModalOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
                      </div>
                      {isFrozen && (
                        <div style={{background:`${C.green}12`,border:`1px solid ${C.green}33`,borderRadius:6,padding:"8px 12px",marginBottom:16,fontSize:11,color:C.dim}}>
                          <span style={{color:C.green,fontWeight:700}}>🔒 Your official quota is locked</span> — adding clients here creates a <em>new</em> submission for approval. Your frozen target of <strong>{fmtR(totalTarget)}</strong> does not change.
                        </div>
                      )}
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>CLIENT NAME</div>
                          <ZohoSearchInput
                            value={addClientForm.clientCompany}
                            zohoId={addClientForm.zohoAccountId||""}
                            onChange={(name,id)=>setAddClientForm(p=>({...p,clientCompany:name,zohoAccountId:id}))}
                            endpoint="/api/zoho/clients"
                            placeholder="Type to search Zoho…"
                          />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>DEAL TYPE</div>
                          <select value={addClientForm.dealType} onChange={e=>setAddClientForm(p=>({...p,dealType:e.target.value}))}
                            style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                            {dealTypes.map(d=><option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>TARGET AMOUNT (₹)</div>
                          <input value={addClientForm.targetAmount} placeholder="e.g. 50L or 5000000"
                            onChange={e=>setAddClientForm(p=>({...p,targetAmount:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                      </div>
                      <div style={{marginTop:22,display:"flex",gap:10,justifyContent:"flex-end"}}>
                        <button onClick={()=>setAddClientModalOpen(false)} style={{padding:"9px 18px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                        <button onClick={()=>{
                          const {clientCompany,zohoAccountId,dealType,targetAmount} = addClientForm;
                          if(!clientCompany.trim()||!targetAmount){showToast("Fill in client name and target amount","err");return;}
                          const amt = parseCurrency(targetAmount);
                          // Part 7: When frozen, Additional Revenue Opportunity — no approval chain needed
                          if (isFrozen) {
                            const newEntry = {clientCompany:clientCompany.trim(),zohoAccountId:zohoAccountId||"",dealType,targetAmount:amt,isAdditionalRevOp:true};
                            const sub = {id:`ts${Date.now()}`,repId:myRepId,repName:user_role?.name||"",region:user_role?.region||"",quarter:entryQ,clients:[newEntry],totalTarget:amt,status:"Approved",submittedAt:TODAY,approvalLog:[{at:TODAY,by:user_role?.name||"Rep",action:"Auto-approved as Additional Revenue Opportunity",note:"No approval chain — rep adds directly"}],isAdditionalRevOp:true};
                            setTargetSubs(p=>[sub,...p]);
                            setAddClientModalOpen(false);
                            showToast(`${clientCompany.trim()} added as Additional Revenue Opportunity ✓`);
                            return;
                          }
                          const newEntry = {clientCompany:clientCompany.trim(),zohoAccountId:zohoAccountId||"",dealType,targetAmount:amt};
                          // Find existing pending sub for this quarter to append, or create new one
                          const existingSub = mySubs.find(s=>qMatch(s.quarter)&&s.status==="Pending RH");
                          if(existingSub){
                            const updated = {...existingSub, clients:[...existingSub.clients,newEntry], totalTarget:existingSub.totalTarget+amt};
                            setTargetSubs(p=>p.map(s=>s.id===existingSub.id?updated:s));
                          } else {
                            const sub = {id:`ts${Date.now()}`,repId:myRepId,repName:user_role?.name||"",region:user_role?.region||"",quarter:entryQ,clients:[newEntry],totalTarget:amt,status:"Pending RH",submittedAt:TODAY,approvalLog:[]};
                            setTargetSubs(p=>[sub,...p]);
                          }
                          setAddClientModalOpen(false);
                          showToast(`${clientCompany.trim()} added → submitted for approval ✓`);
                        }} style={{padding:"9px 22px",background:isFrozen?"linear-gradient(135deg,#15803d,#16a34a)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:6,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          {isFrozen ? "Add as Additional Revenue Opportunity →" : "Submit for Approval →"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current quarter client target vs achieved */}
                {(()=>{
                  // Collect ALL non-rejected subs for this quarter (approved + pending)
                  const activeSubs = mySubs.filter(s=>qMatch(s.quarter)&&s.status!=="Rejected");
                  if(!activeSubs.length) return null;
                  // Flatten clients, tagging each with their parent sub's status and submitter
                  const allClients = activeSubs.flatMap(sub=>
                    sub.clients.map(cl=>({...cl, subStatus:sub.status, approvalLog:sub.approvalLog||[], submittedByName:sub.submittedByName||"", submittedByRole:sub.submittedByRole||""}))
                  );
                  // Overall status badge: show the most advanced status
                  const overallStatus = activeSubs.find(s=>s.status==="Approved")?.status || activeSubs[0]?.status;
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{filterQ} · Client Targets</div>
                        <span style={{background:`${statusColor(overallStatus)}22`,color:statusColor(overallStatus),padding:"2px 10px",borderRadius:8,fontSize:10,fontWeight:700}}>{overallStatus}</span>
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>
                            {["Client","Deal Type","Target","Achieved","Shortfall","Progress"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {allClients.map((cl,i)=>{
                              const achieved = revenueEntries
                                .filter(e=>e.repId===myRepId&&e.clientCompany===cl.clientCompany&&qMatch(e.quarter))
                                .reduce((s,e)=>s+(e.amount||0),0);
                              const pct = cl.targetAmount>0?Math.min(100,Math.round((achieved/cl.targetAmount)*100)):0;
                              const pc = pct>=100?C.green:pct>=60?C.accent:C.red;
                              const shortfall = Math.max(0, cl.targetAmount - achieved);
                              const isPending = cl.subStatus!=="Approved" && achieved===0;
                              return (
                                <tr key={i} style={{borderBottom:`1px solid ${C.s2}`,opacity:isPending?0.7:1}}>
                                  <td style={{padding:"10px 14px",fontWeight:700}}>
                                    {cl.clientCompany}
                                    {cl.isAdditionalRevOp && <span style={{marginLeft:6,background:`${C.green}18`,color:C.green,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,verticalAlign:"middle"}}>Additional Revenue Opportunity</span>}
                                    {cl.submittedByRole && !cl.isAdditionalRevOp && <span style={{marginLeft:6,background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,verticalAlign:"middle"}}>by {cl.submittedByRole}</span>}
                                  </td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{cl.dealType}</span></td>
                                  <td style={{padding:"10px 14px",color:isPending?C.muted:C.dim}}>{isPending?"—":fmtR(cl.targetAmount)}</td>
                                  <td style={{padding:"10px 14px",fontWeight:700,color:achieved>0?pc:C.muted}}>{isPending||achieved===0?"—":fmtR(achieved)}</td>
                                  <td style={{padding:"10px 14px",color:shortfall===0?C.green:C.red,fontWeight:700}}>{isPending||achieved===0?"—":fmtR(shortfall)}</td>
                                  <td style={{padding:"10px 14px",minWidth:140}}>
                                    {isPending ? (
                                      <span style={{background:`${C.orange}18`,color:C.orange,padding:"3px 9px",borderRadius:5,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>⏳ Awaiting Approval</span>
                                    ) : (
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <div style={{flex:1,height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                                          <div style={{height:"100%",width:`${pct}%`,background:pc,borderRadius:2}}/>
                                        </div>
                                        <span style={{fontSize:10,color:pc,fontWeight:700,minWidth:30}}>{pct}%</span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Prior approvals log across all subs */}
                      {activeSubs.flatMap(s=>s.approvalLog||[]).length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                          {activeSubs.flatMap(s=>(s.approvalLog||[]).map((log,i)=>(
                            <span key={`${s.id}_${i}`} style={{background:`${C.green}12`,color:C.green,padding:"1px 8px",borderRadius:6,fontSize:10}}>✓ {log.by}: {log.note}</span>
                          )))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* REJECTED SUBMISSIONS — Edit & Resubmit */}
                {qSubs.filter(s=>s.status==="Rejected").map(sub=>(
                  <div key={sub.id} style={{marginBottom:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{filterQ} · Rejected Submission</div>
                      {editSubId!==sub.id
                        ? <button onClick={()=>{ setEditSubId(sub.id); setEditSubClients(sub.clients.map(c=>({...c,targetAmount:String(c.targetAmount)}))); }}
                            style={{background:`${C.orange}18`,border:`1px solid ${C.orange}44`,color:C.orange,borderRadius:6,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                            ✏ Edit &amp; Resubmit
                          </button>
                        : <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>setEditSubId(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 14px",fontSize:11,cursor:"pointer",color:C.dim,fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                            <button onClick={()=>{
                              const updated = editSubClients.map(c=>({...c,targetAmount:parseCurrency(String(c.targetAmount)),clientStatus:"Pending"}));
                              const newTotal = updated.reduce((s,c)=>s+(c.targetAmount||0),0);
                              setTargetSubs(p=>p.map(t=>t.id===sub.id?{
                                ...t,
                                clients: updated,
                                totalTarget: newTotal,
                                status: "Pending RH",
                                approvalLog: [],
                                submittedAt: TODAY,
                              }:t));
                              setEditSubId(null);
                              showToast("Revised targets submitted for approval ✓");
                            }} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:6,padding:"5px 16px",fontSize:11,cursor:"pointer",color:"#fff",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              Resubmit →
                            </button>
                          </div>
                      }
                    </div>
                    {/* Rejection reason from approval log */}
                    {(sub.approvalLog||[]).length>0&&(
                      <div style={{background:`${C.red}08`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"8px 14px",marginBottom:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                        {(sub.approvalLog||[]).filter(l=>l.action==="Rejected").map((l,i)=>(
                          <span key={i} style={{fontSize:11,color:C.red}}>✗ {l.by}: {l.note} ({l.at})</span>
                        ))}
                        {(sub.approvalLog||[]).filter(l=>l.action!=="Rejected").map((l,i)=>(
                          <span key={i} style={{fontSize:11,color:C.green}}>✓ {l.by}: {l.note}</span>
                        ))}
                      </div>
                    )}
                    <div className="card" style={{overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          {["Client","Deal Type","Target Amount",editSubId===sub.id?"New Amount":""].filter(Boolean).map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {(editSubId===sub.id ? editSubClients : sub.clients).map((cl,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${C.s2}`}}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{cl.clientCompany}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{cl.dealType}</span></td>
                              <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(sub.clients[i]?.targetAmount||cl.targetAmount)}</td>
                              {editSubId===sub.id&&(
                                <td style={{padding:"6px 14px"}}>
                                  <input
                                    value={editSubClients[i]?.targetAmount||""}
                                    onChange={e=>setEditSubClients(p=>p.map((c,j)=>j===i?{...c,targetAmount:e.target.value}:c))}
                                    placeholder="e.g. 50L"
                                    style={{width:120,padding:"6px 10px",background:C.s2,border:`1px solid ${C.accent}55`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}
                                  />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Past submissions (other quarters) */}
                {mySubs.filter(s=>s.quarter!==filterQ).length>0&&(
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Other Quarters</div>
                    {mySubs.filter(s=>s.quarter!==filterQ).map(sub=>(
                      <div key={sub.id} className="card" style={{padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span className="sans" style={{fontWeight:700,fontSize:12}}>{sub.quarter} · {fmtR(sub.totalTarget)}</span>
                        <span style={{background:`${statusColor(sub.status)}22`,color:statusColor(sub.status),padding:"1px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{sub.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ TARGET APPROVALS (RH / NSH / STRATEGY / CRO) ═══ */}
          {view==="target-approvals" && !isRep && (()=>{
            const pendingStep = isRH?"Pending RH":isNSH?"Pending NSH":isStrategy?"Pending Strategy":isCRORole?"Pending CRO":null;
            const nextStep    = isRH?"Pending NSH":isNSH?"Pending Strategy":isStrategy?"Pending CRO":isCRORole?"Approved":null;
            const myPending   = isRH
              ? targetSubs.filter(t=>t.status===pendingStep&&t.region===rhRegion)
              : targetSubs.filter(t=>t.status===pendingStep);
            const approved    = targetSubs.filter(t=>t.status==="Approved");
            const statusColor = s => s==="Approved"?C.green:s.startsWith("Pending")?C.orange:C.red;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TARGET APPROVALS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:3}}>
                      {isRH?"Review and approve target submissions from your region's sales reps.":
                       isNSH?"Approve targets cleared by Region Heads.":
                       isStrategy?"Review NSH-approved targets for strategic alignment.":
                       "Final CRO sign-off on targets cleared by Sales Strategy."}
                    </div>
                  </div>
                  <button onClick={()=>{setPlanUploadForm({repId:"",quarter:entryQ,clients:[{clientCompany:"",dealType:"Linear TV",targetAmount:""}]});setPlanUploadOpen(true);}}
                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:7,padding:"9px 18px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    ↑ Upload Plan for Rep
                  </button>
                </div>
                <div style={{marginBottom:16}}/>

                {/* Summary count cards */}
                {(()=>{
                  const scope = isRH ? targetSubs.filter(t=>t.region===rhRegion) : targetSubs;
                  const totalVal = scope.reduce((s,t)=>s+(t.targetAmount||0),0);
                  const approvedCt = scope.filter(t=>t.status==="Approved").length;
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                      {[
                        {label:"PENDING AT MY LEVEL", value:myPending.length,        color:myPending.length>0?C.orange:C.green, sub:"Awaiting your review"},
                        {label:"APPROVED",            value:approvedCt,              color:C.green,  sub:"Fully cleared"},
                        {label:"TOTAL IN PIPELINE",   value:scope.length,            color:C.accent, sub:"All submissions"},
                        {label:"TOTAL TARGET VALUE",  value:fmtR(totalVal),          color:C.text,   sub:"Across all submissions"},
                      ].map(card=>(
                        <div key={card.label} className="card" style={{padding:"12px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{card.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:800,color:card.color,marginBottom:2}}>{card.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* SECTION 2 — Action Item Approvals (all approver roles) */}
                {(()=>{
                  const myDept = isRH?"Region Head":isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isAdmin?"":null;
                  if (myDept===null) return null; // reps don't see this
                  const actionApprovals = myDept===""
                    ? internalReqs.filter(r=>r.status==="Pending"&&r.type==="Approval")
                    : internalReqs.filter(r=>r.dept===myDept&&r.status==="Pending"&&r.type==="Approval");
                  return (
                    <div style={{marginBottom:24}}>
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Section 2 — Action Item Approvals</div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Approval requests from reps tagged to your role. Each requires your sign-off.</div>
                      {actionApprovals.length===0 ? (
                        <div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:12}}>✓ No pending approval requests at your level</div>
                      ) : actionApprovals.map(r=>(
                        <div key={r.id} className="card" style={{padding:"14px 16px",marginBottom:8,borderLeft:`3px solid ${C.orange}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{r.subject}</div>
                              <div style={{fontSize:11,color:C.dim}}>{r.details}</div>
                              <div style={{fontSize:10,color:C.muted,marginTop:4}}>Raised by: {r.raisedByName||"—"} · {r.raisedAt} · Client: {r.clientCompany||"—"}</div>
                            </div>
                            <div style={{display:"flex",gap:8,flexShrink:0}}>
                              <button onClick={()=>{setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY,resolverNote:"Approved by "+user_role?.name}:x));showToast("Approved ✓");}}
                                style={{background:`${C.green}22`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Approve</button>
                              <button onClick={()=>{const note=prompt("Rejection reason (required):")||"";if(!note.trim()){showToast("Rejection reason is required","err");return;}setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Rejected",resolvedAt:TODAY,resolverNote:note}:x));showToast("Request rejected — rep notified");}}
                                style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✗ Reject</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* SECTION 1 — Target Submission Approvals */}
                <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Section 1 — Target Submissions</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Target proposals from reps / Region Heads requiring approval at your level.</div>
                {myPending.length===0 ? (
                  <div style={{textAlign:"center",padding:50,color:C.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>✓</div>
                    <div style={{fontWeight:700,color:C.green}}>No pending target submissions at your level</div>
                  </div>
                ) : myPending.map(sub=>{
                  const approvedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                  const rejectedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Rejected");
                  const pendingClients  = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Pending");
                  const canForward = approvedClients.length > 0;
                  const approvedTotal = approvedClients.reduce((s,c)=>s+(c.targetAmount||0),0);

                  // helper: update a single client's status inside this submission
                  // auto-rejects the whole submission if all clients end up rejected
                  const setClientStatus = (clientIdx, newStatus) => {
                    setTargetSubs(p=>p.map(t=>{
                      if(t.id!==sub.id) return t;
                      const updatedClients = t.clients.map((cl,i)=>i===clientIdx?{...cl,clientStatus:newStatus}:cl);
                      const allRejected = updatedClients.every(cl=>(cl.clientStatus||"Pending")==="Rejected");
                      return {
                        ...t,
                        clients: updatedClients,
                        ...(allRejected ? {
                          status: "Rejected",
                          approvalLog: [...(t.approvalLog||[]), {action:"Rejected", step:pendingStep, by:user_role?.name||"", at:TODAY, note:"All clients rejected by "+user_role?.name}]
                        } : {})
                      };
                    }));
                  };

                  return (
                    <div key={sub.id} className="card" style={{padding:"16px 18px",marginBottom:12,borderLeft:`3px solid ${C.orange}`}}>
                      {/* Header */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
                        <div>
                          <div className="sans" style={{fontWeight:700,fontSize:14}}>{sub.repName} · {sub.region}</div>
                          <div style={{fontSize:11,color:C.dim}}>{sub.quarter} · Submitted {daysSince(sub.submittedAt)===0?"today":`${daysSince(sub.submittedAt)}d ago`}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className="sans" style={{fontSize:20,fontWeight:800,color:C.accent}}>{fmtR(sub.totalTarget)}</div>
                          <div style={{fontSize:9,color:C.dim,marginTop:2}}>
                            {approvedClients.length>0&&<span style={{color:C.green,marginRight:6}}>✓ {approvedClients.length} approved</span>}
                            {rejectedClients.length>0&&<span style={{color:C.red,marginRight:6}}>✗ {rejectedClients.length} rejected</span>}
                            {pendingClients.length>0&&<span style={{color:C.orange}}>{pendingClients.length} pending review</span>}
                          </div>
                        </div>
                      </div>

                      {/* Per-client rows with individual Approve / Reject */}
                      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                        {sub.clients.map((cl,i)=>{
                          const cs = cl.clientStatus || "Pending";
                          return (
                            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:cs==="Approved"?`${C.green}0d`:cs==="Rejected"?`${C.red}0d`:C.s2,borderRadius:5,border:`1px solid ${cs==="Approved"?C.green+"44":cs==="Rejected"?C.red+"44":"transparent"}`}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:700,color:cs==="Approved"?C.green:cs==="Rejected"?C.red:C.text}}>{cl.clientCompany}</div>
                                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                                  <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9}}>{cl.dealType||"—"}</span>
                                  <span style={{fontSize:11,fontWeight:700,color:C.accent}}>{fmtR(cl.targetAmount)}</span>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:5,alignItems:"center",marginLeft:10,flexShrink:0}}>
                                {cs==="Pending" ? (
                                  <>
                                    <button onClick={()=>setClientStatus(i,"Approved")}
                                      style={{background:`${C.green}22`,border:`1px solid ${C.green}55`,color:C.green,borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Approve</button>
                                    <button onClick={()=>setClientStatus(i,"Rejected")}
                                      style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✗ Reject</button>
                                  </>
                                ) : (
                                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                    <span style={{fontSize:11,fontWeight:700,color:cs==="Approved"?C.green:C.red}}>{cs==="Approved"?"✓ Approved":"✗ Rejected"}</span>
                                    <button onClick={()=>setClientStatus(i,"Pending")}
                                      style={{background:C.s3,border:"none",color:C.dim,borderRadius:4,padding:"3px 7px",fontSize:9,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Undo</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prior approvals log */}
                      {sub.approvalLog.length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                          {sub.approvalLog.map((log,i)=>(
                            <span key={i} style={{background:`${C.green}12`,color:C.green,padding:"1px 8px",borderRadius:6,fontSize:10}}>✓ {log.by}: {log.note}</span>
                          ))}
                        </div>
                      )}

                      {/* Bottom action bar */}
                      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.s3}`,paddingTop:10}}>
                        <div style={{fontSize:11,color:C.dim}}>
                          {pendingClients.length>0
                            ? `Review all clients before forwarding (${pendingClients.length} pending)`
                            : canForward
                              ? `Forwarding ${approvedClients.length} approved client${approvedClients.length!==1?"s":""} · ${fmtR(approvedTotal)}`
                              : "All clients rejected — submit rejection"}
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{
                            setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,status:"Rejected",approvalLog:[...t.approvalLog,{action:"Rejected",step:pendingStep,by:user_role?.name||"",at:TODAY,note:"Rejected by "+user_role?.name}]}:t));
                            showToast("Submission rejected — rep will be notified");
                          }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Reject All</button>
                          <button
                            disabled={!canForward||pendingClients.length>0}
                            onClick={()=>{
                              const approvedOnly = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                              const newTotal = approvedOnly.reduce((s,c)=>s+(c.targetAmount||0),0);
                              setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,
                                clients: approvedOnly,
                                totalTarget: newTotal,
                                // Freeze the quota permanently at the moment CRO approves
                                ...(nextStep==="Approved" ? {frozenTarget: newTotal} : {}),
                                status: nextStep,
                                approvalLog:[...t.approvalLog,{step:pendingStep,by:user_role?.name||"",at:TODAY,note:`Approved ${approvedOnly.length} client${approvedOnly.length!==1?"s":""}`}]
                              }:t));
                              if(nextStep==="Approved"){
                                const newDeals = [];
                                approvedOnly.forEach(cl=>{
                                  const existing = deals.find(d=>d.repId===sub.repId&&d.clientCompany===cl.clientCompany&&d.quarter===sub.quarter);
                                  if(existing){
                                    setDeals(p=>p.map(d=>d.id===existing.id?{...d,targetAmount:cl.targetAmount}:d));
                                  } else {
                                    const rep = reps.find(r=>r.id===sub.repId);
                                    newDeals.push({
                                      id:`d_ts_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                                      repId:sub.repId, repName:sub.repName||rep?.name||"",
                                      region:sub.region||rep?.region||"",
                                      clientCompany:cl.clientCompany, contactName:"", designation:"",
                                      contactLevel:"", phone:"", email:"",
                                      dealType:cl.dealType||"Linear TV",
                                      channel:cl.channel||"",
                                      outcome:"Needs Callback",
                                      amount:cl.targetAmount, targetAmount:cl.targetAmount,
                                      priority:"Regular", quarter:sub.quarter,
                                      notes:`Auto-created from approved target submission`,
                                      nextStep:"", nextStepDate:null,
                                      lastContact:TODAY, reqs:[], auditLog:[],
                                      awaitingApproval:null, awaitingApprovalSince:null,
                                    });
                                  }
                                });
                                if(newDeals.length>0) setDeals(p=>[...p,...newDeals]);
                              }
                              showToast(nextStep==="Approved"?`✓ ${approvedOnly.length} targets approved!`:`Forwarded ${approvedOnly.length} clients → ${nextStep||""}`);
                            }}
                            style={{background:canForward&&pendingClients.length===0?"linear-gradient(135deg,#6366f1,#8b5cf6)":C.s3,border:"none",color:canForward&&pendingClients.length===0?"#fff":C.muted,borderRadius:4,padding:"6px 18px",fontSize:12,cursor:canForward&&pendingClients.length===0?"pointer":"not-allowed",fontFamily:"'DM Mono',monospace",fontWeight:700,transition:"all .15s"}}>
                            {nextStep==="Approved"?"✓ Final Approve":pendingClients.length>0?`Review all first (${pendingClients.length} left)`:`Approve ${approvedClients.length} → ${nextStep||""}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Approved targets summary */}
                {approved.length>0&&(
                  <div style={{marginTop:20}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Approved Targets This Quarter</div>
                    {approved.filter(t=>qMatch(t.quarter)).map(sub=>(
                      <div key={sub.id} className="card" style={{padding:"12px 16px",marginBottom:8,borderLeft:`3px solid ${C.green}`}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span className="sans" style={{fontWeight:700}}>{sub.repName} · {sub.region}</span>
                          <span style={{color:C.green,fontWeight:700}}>{fmtR(sub.totalTarget)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ REVENUE LOG ═══ */}
          {view==="revenue-log" && (()=>{
            const myRepId   = user_role?.repId;
            const myEntries = isRep ? revenueEntries.filter(e=>e.repId===myRepId) : revenueEntries;
            const totalRev  = myEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const dealTypes = ["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"];

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REVENUE LOG</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Log revenue booked per advertiser. Updates deal achieved amounts automatically.</div>
                  </div>
                  {/* Total pill */}
                  <div style={{textAlign:"right"}}>
                    <div className="sans" style={{fontSize:22,fontWeight:800,color:C.green}}>{fmtR(totalRev)}</div>
                    <div style={{fontSize:9,color:C.dim,letterSpacing:".06em"}}>{filterQ} LOGGED</div>
                  </div>
                </div>

                {/* ── Annual summary stats ── shown only in FY26 Annual mode */}
                {isAnnual && (()=>{
                  const FY_START_MS  = new Date("2025-04-01").getTime();
                  const monthsElapsed = Math.max(1, (Date.now() - FY_START_MS) / (1000 * 60 * 60 * 24 * 30.44));
                  const myApprovedSubs = (isRep
                    ? targetSubs.filter(s=>s.repId===myRepId&&s.status==="Approved")
                    : targetSubs.filter(s=>s.status==="Approved")
                  );
                  const annualTarget = myApprovedSubs.reduce((s,sub)=>s+sub.totalTarget,0);
                  const targetRunRate  = annualTarget>0 ? Math.round(annualTarget/12) : 0;
                  const currentRunRate = totalRev>0 ? Math.round((totalRev/monthsElapsed)*12) : 0;
                  const cards = [
                    {label:"YTD REVENUE",          value:fmtR(totalRev),         color:C.green,    sub:"All quarters · FY26"},
                    {label:"ANNUAL TARGET",         value:fmtR(annualTarget),     color:C.accent,   sub:"Approved targets across all Qs"},
                    {label:"TARGET RUN RATE",       value:fmtR(targetRunRate)+"/mo", color:C.blue,  sub:"Annual target ÷ 12 months"},
                    {label:"CURRENT RUN RATE",      value:fmtR(currentRunRate)+"/mo", color:currentRunRate>=targetRunRate?C.green:C.red, sub:`Based on ${monthsElapsed.toFixed(1)} months elapsed`},
                  ];
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                      {cards.map(c=>(
                        <div key={c.label} className="card" style={{padding:"14px 16px"}}>
                          <div style={{fontSize:9,color:C.dim,letterSpacing:".08em",fontWeight:700,marginBottom:6}}>{c.label}</div>
                          <div className="sans" style={{fontSize:18,fontWeight:800,color:c.color,marginBottom:3}}>{c.value}</div>
                          <div style={{fontSize:9,color:C.muted}}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Log new revenue entry */}
                <div className="card" style={{padding:"16px 18px",marginBottom:20}}>
                  <div className="sans" style={{fontWeight:700,fontSize:13,marginBottom:12}}>Log New Revenue</div>
                  {(()=>{
                    const rf = revForm;
                    const setRf = setRevForm;
                    // Spec §8: Revenue Log client = clients in fully CRO-approved targetSubs for this rep
                    // Note: clientAccounts.approvalStatus is never set; derive from targetSubs instead
                    const myApprovedAccts = isRep
                      ? (()=>{
                          // Collect all client names from approved targetSubs for this rep
                          const approvedNames = new Set<string>(
                            targetSubs
                              .filter(s=>s.repId===myRepId&&s.status==="Approved")
                              .flatMap(s=>(s.clients||[])
                                .filter(cl=>!cl.clientStatus||cl.clientStatus==="Approved")
                                .map((cl:any)=>cl.clientCompany||cl.clientName||"")
                              )
                              .filter(Boolean)
                          );
                          // Match to clientAccounts (for zohoAccountId, etc.)
                          const fromAccts = clientAccounts.filter(a=>a.repId===myRepId&&approvedNames.has(a.clientName));
                          const matched   = new Set(fromAccts.map(a=>a.clientName));
                          // For approved names not yet in clientAccounts, create minimal stubs
                          const stubs = [...approvedNames]
                            .filter(n=>!matched.has(n))
                            .map(n=>({id:`stub_${n}`,clientName:n,repId:myRepId,zohoAccountId:""}));
                          return [...fromAccts,...stubs];
                        })()
                      : clientAccounts; // Managers/admins see all accounts
                    return (
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>CLIENT / ADVERTISER</div>
                            <select value={rf.clientCompany} onChange={e=>{
                              const sel = e.target.value;
                              // Auto-populate from clientAccount (the canonical source)
                              const matchAcct = myApprovedAccts.find(a=>a.clientName===sel);
                              setRf(p=>({...p,clientCompany:sel,clientAccountId:matchAcct?.id||"",zohoAccountId:matchAcct?.zohoAccountId||"",dealType:matchAcct?.dealType||p.dealType,channel:matchAcct?.channel||""}));
                            }}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${rf.zohoAccountId?C.green:C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                              <option value="">Select from approved targets…</option>
                              {myApprovedAccts.sort((a,b)=>a.clientName.localeCompare(b.clientName)).map(a=><option key={a.id} value={a.clientName}>{a.clientName}</option>)}
                            </select>
                            {rf.zohoAccountId&&<div style={{fontSize:9,color:C.green,marginTop:2}}>✓ Zoho ID linked — revenue will match correctly</div>}
                            {!rf.clientCompany&&<div style={{fontSize:9,color:C.dim,marginTop:2}}>Only approved target clients appear here.</div>}
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>DEAL TYPE</div>
                            <select value={rf.dealType} onChange={e=>setRf(p=>({...p,dealType:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                              {dealTypes.map(d=><option key={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>AMOUNT ₹</div>
                            <input value={rf.amount} placeholder="e.g. 5L or 1Cr" onChange={e=>setRf(p=>({...p,amount:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>INVOICE / PO REF</div>
                            <input value={rf.invoiceRef} placeholder="INV-2024-XXX" onChange={e=>setRf(p=>({...p,invoiceRef:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>DATE</div>
                            <input type="date" min="2020-01-01" max="2099-12-31" value={rf.date} onChange={e=>setRf(p=>({...p,date:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:C.dim,marginBottom:3}}>NOTES</div>
                          <input value={rf.notes} placeholder="Optional notes" onChange={e=>setRf(p=>({...p,notes:e.target.value}))}
                            style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                        <button onClick={()=>{
                          const client = rf.clientCompany;
                          if(!client||!rf.amount){showToast("Client and amount are required","err");return;}
                          if(!rf.invoiceRef){showToast("Invoice / RO reference is required — cannot submit without it","err");return;}
                          const amt = parseCurrency(rf.amount);
                          if(!amt){showToast("Invalid amount","err");return;}
                          const newId  = `re${Date.now()}`;
                          const ikey   = `ikey_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                          const entry = {id:newId,repId:isRep?myRepId:null,clientCompany:client,zohoAccountId:rf.zohoAccountId||"",dealType:rf.dealType,amount:amt,invoiceRef:rf.invoiceRef,date:rf.date||TODAY,quarter:entryQ,fiscalYear:CURRENT_FY,notes:rf.notes};
                          setRevenueEntries(p=>[entry,...p]);
                          revSvc.createRevenueEntry({
                            id:newId, repId:isRep?myRepId:undefined, clientCompany:client, zohoAccountId:rf.zohoAccountId||undefined,
                            dealType:rf.dealType, amount:amt, invoiceRef:rf.invoiceRef, date:rf.date||TODAY,
                            quarter:entryQ, fiscalYear:CURRENT_FY, notes:rf.notes||undefined, idempotencyKey:ikey,
                          }).catch((err:any)=>{showToast(err?.body?.error||"Network error — entry may not be saved","err");setRevenueEntries(p=>p.filter(e=>e.id!==newId));});
                          // Fix 6: IP slot committed — notify other reps with pending proposals for the same slot
                          if (rf.dealType==="IPs") {
                            const linkedDeal = deals.find(d=>(isRep?d.repId===myRepId:true)&&d.dealType==="IPs"&&d.clientCompany===client&&d.ipId&&d.elemId);
                            if (linkedDeal) {
                              const otherPending = ipProposals.filter(p=>p.ipId===linkedDeal.ipId&&p.elemId===linkedDeal.elemId&&p.repId!==myRepId&&p.status==="Pending");
                              if (otherPending.length) {
                                const notifTasks = otherPending.map(p=>({
                                  id:`t_ipnotify_${Date.now()}_${p.repId}`,
                                  assignedTo:p.repId, assignedToUserId:USER_ROLES.find(u=>u.repId===p.repId)?.id||null,
                                  assignedDept:"Sales Rep", repId:p.repId, clientCompany:p.client,
                                  title:`[IP Slot Committed] ${linkedDeal.ipId} · ${linkedDeal.elemId} has been committed to ${client} — your proposal for ${p.client} has been released.`,
                                  description:`The slot you pitched for ${p.client} is now committed. You can explore other elements in this IP.`,
                                  priority:"High", status:"Open", dueDate:TODAY, createdAt:TODAY,
                                  assignedBy:activeUser, assignedByName:user_role?.name||"System", fromMeetingLog:false,
                                }));
                                setTasks(prev=>[...notifTasks,...prev]);
                                // Mark their proposals as Released
                                setIpProposals(prev=>prev.map(p=>otherPending.some(op=>op.id===p.id)?{...p,status:"Released"}:p));
                                showToast(`IP slot committed. ${otherPending.length} rep${otherPending.length>1?"s":""} notified.`);
                              }
                            }
                          }
                          // Part 3+9: Auto-set deal stage to "RO Received" when revenue is logged
                          const matchDeal = deals.find(d=>(isRep?d.repId===myRepId:true)&&(rf.zohoAccountId&&d.zohoAccountId?d.zohoAccountId===rf.zohoAccountId:d.clientCompany===client)&&qMatch(d.quarter));
                          if(matchDeal){
                            setDeals(p=>p.map(d=>d.id===matchDeal.id?{...d,stage:"RO Received",outcome:"RO Received",lastContact:TODAY}:d));
                            // Update client account stage too
                            if (matchDeal.clientAccountId) {
                              setClientAccounts(p=>p.map(a=>a.id===matchDeal.clientAccountId?{...a,currentStage:"RO Received",lastContactDate:TODAY,updatedAt:TODAY}:a));
                            }
                          }
                          setRf({clientCompany:"",zohoAccountId:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:TODAY,notes:""});
                          const totalFY = [...revenueEntries.filter(e=>(isRep?e.repId===myRepId:true)&&e.fiscalYear===CURRENT_FY),entry].reduce((s,e)=>s+(e.amount||0),0);
                          // Part 9: Check if annual target reached
                          const annualTarget = isRep ? (getAnnualTarget(myRepId)?.amount||0) : 0;
                          if (annualTarget>0 && totalFY>=annualTarget) {
                            showToast(`Annual target achieved. ₹${(totalFY/100000).toFixed(1)}L this fiscal year.`);
                          } else {
                            showToast(`₹${(amt/100000).toFixed(1)}L logged for ${client} ✓  Your total ${CURRENT_FY}: ₹${(totalFY/100000).toFixed(1)}L`);
                          }
                        }} style={{background:"linear-gradient(135deg,#16c784,#0ea570)",border:"none",color:"#fff",borderRadius:5,padding:"8px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          ✓ Log Revenue
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Revenue history */}
                {myEntries.length===0 ? (
                  <div style={{textAlign:"center",padding:40,color:C.muted}}>No revenue logged yet.</div>
                ) : (
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Revenue Entries · {filterQ}</div>
                    <div className="card" style={{overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          {["Client","Deal Type","Amount","Invoice Ref","Date","Notes",""].map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {myEntries.filter(e=>qMatch(e.quarter)).sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                            editingRevId===e.id ? (
                              <tr key={e.id} style={{borderBottom:`1px solid ${C.border}`,background:C.s2}}>
                                <td colSpan={7} style={{padding:"12px 14px"}}>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"end"}}>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>AMOUNT ₹</div>
                                      <input value={editRevData.amount||""} onChange={e=>setEditRevData(p=>({...p,amount:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>DEAL TYPE</div>
                                      <select value={editRevData.dealType||"Linear TV"} onChange={ev=>setEditRevData(p=>({...p,dealType:ev.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                                        {dealTypes.map(d=><option key={d}>{d}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>INVOICE REF</div>
                                      <input value={editRevData.invoiceRef||""} onChange={e=>setEditRevData(p=>({...p,invoiceRef:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>DATE</div>
                                      <input type="date" value={editRevData.date||TODAY} onChange={e=>setEditRevData(p=>({...p,date:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:9,color:C.dim,marginBottom:3}}>NOTES</div>
                                      <input value={editRevData.notes||""} onChange={e=>setEditRevData(p=>({...p,notes:e.target.value}))}
                                        style={{width:"100%",padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                                    </div>
                                  </div>
                                  <div style={{display:"flex",gap:8}}>
                                    <button onClick={()=>{
                                      const amt=parseCurrency(editRevData.amount);
                                      if(!amt){showToast("Invalid amount","err");return;}
                                      setRevenueEntries(p=>p.map(x=>x.id===e.id?{...x,...editRevData,amount:amt,editHistory:[...(x.editHistory||[]),{editedAt:new Date().toISOString(),editedBy:user_role?.name||activeUser,oldAmount:x.amount}]}:x));
                                      setEditingRevId(null);showToast("Entry updated ✓");
                                    }} style={{background:`${C.green}22`,border:`1px solid ${C.green}44`,color:C.green,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>✓ Save</button>
                                    <button onClick={()=>setEditingRevId(null)} style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                                    <button onClick={()=>{if(!confirm("Delete this revenue entry?"))return;setRevenueEntries(p=>p.filter(x=>x.id!==e.id));setEditingRevId(null);showToast("Entry deleted");}}
                                      style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>🗑 Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                            <tr key={e.id} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={ev=>ev.currentTarget.style.background=C.s2}
                              onMouseOut={ev=>ev.currentTarget.style.background="transparent"}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{e.clientCompany}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{e.dealType}</span></td>
                              <td style={{padding:"10px 14px",fontWeight:700,color:C.green}}>{fmtR(e.amount)}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.invoiceRef||"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.date}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:160}}>{e.notes||"—"}</td>
                              <td style={{padding:"10px 14px",textAlign:"right"}}>
                                <button onClick={()=>{setEditingRevId(e.id);setEditRevData({amount:(e.amount/100000)+"L",dealType:e.dealType,invoiceRef:e.invoiceRef||"",date:e.date,notes:e.notes||""});}}
                                  style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✏ Edit</button>
                              </td>
                            </tr>
                            )
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ STRATEGY APPROVAL SETTINGS ═══ */}
          {view==="strategy-config" && isStrategy && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>APPROVAL SETTINGS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Configure deal approval thresholds and inactivity rules. Changes apply immediately for all users.</div>

              {/* Approval Thresholds */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:6}}>Approval Thresholds</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Deal amount determines who reviews it. Chain: NSH → Sales Strategy → CXO.</div>
                {[
                  {key:"RH",  label:"Region Head reviews deals above",  help:"Below this → Rep proceeds independently"},
                  {key:"NSH", label:"NSH reviews deals above",          help:"After RH clears the deal"},
                  {key:"CXO", label:"CXO sign-off required above",       help:"Strategic deals — final gate before closing"},
                ].map(({key,label,help})=>(
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap",padding:"10px 12px",background:C.s2,borderRadius:6}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:12,fontWeight:600}}>{label}</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:2}}>{help}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,color:C.dim}}>₹</span>
                      <input type="number" value={adminConfig.approvalThresholds?.[key]!=null?adminConfig.approvalThresholds[key]/100000:0}
                        onChange={e=>setAdminConfig(p=>({...p,approvalThresholds:{...p.approvalThresholds,[key]:parseFloat(e.target.value||"0")*100000}}))}
                        style={{width:80,padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                      <span style={{fontSize:11,color:C.dim}}>L</span>
                    </div>
                    <div style={{minWidth:90,fontSize:11,color:C.accent,fontWeight:700}}>{((adminConfig.approvalThresholds?.[key]||0)/100000).toFixed(0)}L = ₹{((adminConfig.approvalThresholds?.[key]||0)/10000000).toFixed(2)}Cr</div>
                  </div>
                ))}
              </div>

              {/* Deal Inactivity Rules */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:6}}>Deal Inactivity Rules</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Deals with no contact activity are flagged and auto-escalated based on these thresholds.</div>
                {[
                  {key:"inactivityDaysRisk",     label:"Flag deal as At Risk after",       suffix:"days without client contact"},
                  {key:"inactivityDaysEscalate", label:"Auto-escalate to NSH after",       suffix:"days without client contact"},
                ].map(({key,label,suffix})=>(
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"10px 12px",background:C.s2,borderRadius:6,flexWrap:"wrap"}}>
                    <div style={{flex:1,fontSize:12,fontWeight:600}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input type="number" value={adminConfig[key]||0}
                        onChange={e=>setAdminConfig(p=>({...p,[key]:parseInt(e.target.value||"0")}))}
                        style={{width:56,padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                      <span style={{fontSize:11,color:C.dim}}>{suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* SLA Hours */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:6}}>SLA Hours by Approver Level</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Approvals not actioned within these hours are flagged Overdue and escalated upward.</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {Object.entries(adminConfig.slaHours||{}).map(([k,v])=>(
                    <div key={k} style={{background:C.s2,borderRadius:6,padding:"10px 12px"}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:6}}>{k.toUpperCase()}</div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <input type="number" value={v as number}
                          onChange={e=>setAdminConfig(p=>({...p,slaHours:{...p.slaHours,[k]:parseInt(e.target.value||"48")}}))}
                          style={{width:50,padding:"4px 6px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                        <span style={{fontSize:10,color:C.dim}}>hrs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{background:`${C.green}10`,border:`1px solid ${C.green}44`,borderRadius:6,padding:"10px 14px",fontSize:11,color:C.green}}>
                ✓ All changes are saved automatically and take effect immediately for all logged-in users.
              </div>
            </div>
          )}

          {/* ═══ IMPORT DATA ═══ */}
          {/* ═══ ADMIN CONFIG ═══ */}
          {view==="admin-config" && isAdmin && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>SYSTEM CONFIGURATION</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Approval thresholds, SLA hours, inactivity rules — no code deploy needed.</div>

              {/* Part 7: Platform State — Pre-launch / Live */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14,border:`2px solid ${adminConfig.platformLive===false?C.orange:C.green}44`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div className="sans" style={{fontWeight:700}}>Platform State</div>
                  <span style={{background:adminConfig.platformLive===false?`${C.orange}22`:`${C.green}22`,color:adminConfig.platformLive===false?C.orange:C.green,padding:"3px 12px",borderRadius:6,fontSize:11,fontWeight:700}}>{adminConfig.platformLive===false?"PRE-LAUNCH":"LIVE"}</span>
                </div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Controls whether Sales Reps can access the CRM. Set to Pre-launch while targets are being finalised. Go Live after CRO approves all targets.</div>
                <div style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:5}}>PLATFORM STATE</div>
                    <div style={{display:"flex",gap:6}}>
                      {["Pre-launch","Live"].map(s=>(
                        <button key={s} onClick={()=>setAdminConfig(p=>({...p,platformLive:s==="Live"}))}
                          style={{padding:"7px 16px",fontSize:11,fontWeight:700,borderRadius:5,border:`1px solid ${((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?s==="Live"?C.green:C.orange:C.border}`,background:((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?`${s==="Live"?C.green:C.orange}18`:C.s2,color:((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?s==="Live"?C.green:C.orange:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                          {s==="Live"?"✓ Go Live":"🚀 Pre-launch"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {adminConfig.platformLive===false&&(
                    <div>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:5}}>LAUNCH DATE (shown to reps)</div>
                      <input type="date" value={adminConfig.launchDate||""} onChange={e=>setAdminConfig(p=>({...p,launchDate:e.target.value}))}
                        style={{padding:"6px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval Thresholds */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:12}}>Approval Thresholds</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Deal amount determines who must approve before it can proceed.</div>
                {[
                  {key:"RH",  label:"Region Head approves deals above",  help:"Below this → rep can proceed"},
                  {key:"NSH", label:"NSH approves deals above",          help:"After RH clears"},
                  {key:"CXO", label:"CXO approval required above",       help:"Final gate for strategic deals"},
                ].map(({key,label,help})=>(
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontSize:12,fontWeight:600}}>{label}</div>
                      <div style={{fontSize:10,color:C.dim}}>{help}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,color:C.dim}}>₹</span>
                      <input type="number" value={adminConfig.approvalThresholds[key]/100000}
                        onChange={e=>setAdminConfig(p=>({...p,approvalThresholds:{...p.approvalThresholds,[key]:parseFloat(e.target.value||0)*100000}}))}
                        style={{width:80,padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                      <span style={{fontSize:11,color:C.dim}}>L</span>
                    </div>
                    <div style={{minWidth:80,fontSize:11,color:C.accent,fontWeight:700}}>{(adminConfig.approvalThresholds[key]/100000).toFixed(0)}L = ₹{(adminConfig.approvalThresholds[key]/10000000).toFixed(2)}Cr</div>
                  </div>
                ))}
              </div>

              {/* SLA Hours */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:12}}>SLA Hours by Level</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Approvals breaching these hours are flagged Overdue and auto-escalate.</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {Object.entries(adminConfig.slaHours).map(([k,v])=>(
                    <div key={k} style={{background:C.s2,borderRadius:6,padding:"10px 12px"}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:6}}>{k.toUpperCase()}</div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <input type="number" value={v}
                          onChange={e=>setAdminConfig(p=>({...p,slaHours:{...p.slaHours,[k]:parseInt(e.target.value||48)}}))}
                          style={{width:50,padding:"4px 6px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                        <span style={{fontSize:10,color:C.dim}}>hrs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inactivity Rules */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:12}}>Deal Inactivity Rules</div>
                {[
                  {key:"inactivityDaysRisk",      label:"Flag as At Risk after",      suffix:"days no contact"},
                  {key:"inactivityDaysEscalate",  label:"Auto-escalate to NSH after", suffix:"days no contact"},
                ].map(({key,label,suffix})=>(
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <div style={{flex:1,fontSize:12,fontWeight:600}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input type="number" value={adminConfig[key]}
                        onChange={e=>setAdminConfig(p=>({...p,[key]:parseInt(e.target.value||7)}))}
                        style={{width:55,padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                      <span style={{fontSize:11,color:C.dim}}>{suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Push Notifications — Webhook */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div className="sans" style={{fontWeight:700,marginBottom:6}}>Push Notifications</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Paste a webhook URL (Zapier, Make, Slack) to receive automatic alerts for absences, deal wins, and SLA breaches. Leave blank to disable.</div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <input
                    type="url"
                    value={adminConfig.webhookUrl||""}
                    onChange={e=>setAdminConfig(p=>({...p,webhookUrl:e.target.value}))}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    style={{flex:1,minWidth:260,padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}
                  />
                  <button onClick={()=>{
                    const url=adminConfig.webhookUrl?.trim();
                    if(!url){showToast("No webhook URL configured","err");return;}
                    externalPost(url,{source:"OTV CRM",event:"test",message:"Webhook test from OTV CRM System Config",timestamp:new Date().toISOString()});
                    showToast("Test ping sent ✓");
                  }} style={{padding:"7px 14px",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,borderRadius:5,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>
                    Send Test Ping
                  </button>
                </div>
                <div style={{marginTop:10,fontSize:10,color:C.muted}}>
                  Triggers: EOD absence reports · Deal won · Approval breaches SLA
                </div>
              </div>

              {/* Client Master List */}
              <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:8}}>
                  <div className="sans" style={{fontWeight:700}}>Client Master List</div>
                  <span style={{fontSize:10,color:C.dim,background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:"2px 10px"}}>{clientMasterList.length} clients</span>
                </div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>
                  The canonical list of advertiser names. Reps see a searchable dropdown from this list when entering clients — preventing spelling variations that break revenue matching. Names must match exactly what the agency / client uses in ROs.
                </div>
                {/* Add new */}
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <input value={masterNewName} onChange={e=>setMasterNewName(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==="Enter"&&masterNewName.trim()){
                        const name=masterNewName.trim();
                        if(clientMasterList.some(n=>n.toLowerCase()===name.toLowerCase())){showToast("Already in list","err");return;}
                        setClientMasterList(p=>[...p,name].sort((a,b)=>a.localeCompare(b)));
                        setMasterNewName("");
                        showToast(`${name} added to client list ✓`);
                      }
                    }}
                    placeholder="Type client name and press Enter or click Add…"
                    style={{flex:1,padding:"8px 11px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                  <button onClick={()=>{
                    const name=masterNewName.trim();
                    if(!name){showToast("Enter a client name","err");return;}
                    if(clientMasterList.some(n=>n.toLowerCase()===name.toLowerCase())){showToast("Already in list","err");return;}
                    setClientMasterList(p=>[...p,name].sort((a,b)=>a.localeCompare(b)));
                    setMasterNewName("");
                    showToast(`${name} added ✓`);
                  }} style={{padding:"8px 16px",background:`${C.blue}18`,border:`1px solid ${C.blue}33`,borderRadius:5,color:C.blue,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>
                    + Add
                  </button>
                </div>
                {/* ── Import from Zoho CRM ── */}
                <div style={{marginBottom:12,padding:"12px 14px",background:`${C.green}08`,border:`1px solid ${C.green}33`,borderRadius:6}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8}}>
                    <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".06em"}}>IMPORT FROM ZOHO CRM</div>
                    <button onClick={async()=>{
                      setZohoError(null);
                      setZohoImporting(true);
                      setZohoAccounts([]);
                      try{
                        const url=zohoSearchQ.trim().length>=2
                          ?`/api/zoho/accounts?search=${encodeURIComponent(zohoSearchQ.trim())}`
                          :"/api/zoho/accounts";
                        const j=await apiFetch(url) as any;
                        if(j.ok){setZohoAccounts(j.accounts||[]);if(!j.accounts?.length)setZohoError("No accounts found in Zoho CRM.");}
                        else setZohoError(j.error||"Failed to fetch from Zoho CRM.");
                      }catch(e:unknown){setZohoError(e instanceof Error?e.message:"Network error");}
                      finally{setZohoImporting(false);}
                    }} disabled={zohoImporting}
                      style={{padding:"6px 14px",background:C.green,border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:zohoImporting?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,opacity:zohoImporting?0.6:1}}>
                      {zohoImporting?"Fetching…":"Fetch Accounts"}
                    </button>
                  </div>
                  <div style={{display:"flex",gap:6,marginBottom:8}}>
                    <input value={zohoSearchQ} onChange={e=>setZohoSearchQ(e.target.value)}
                      placeholder="Search Zoho accounts by name… (leave blank to fetch all)"
                      style={{flex:1,padding:"6px 10px",background:"#fff",border:`1px solid ${C.green}44`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}/>
                  </div>
                  {zohoError&&<div style={{fontSize:11,color:C.red,marginBottom:6}}>⚠ {zohoError}</div>}
                  {zohoAccounts.length>0&&(()=>{
                    const notYet=zohoAccounts.filter(a=>!clientMasterList.some(m=>m.toLowerCase()===a.toLowerCase()));
                    return (
                      <div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:6}}>{zohoAccounts.length} account{zohoAccounts.length!==1?"s":""} returned · {notYet.length} not yet in your list</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8,maxHeight:120,overflowY:"auto"}}>
                          {zohoAccounts.map(a=>{
                            const already=clientMasterList.some(m=>m.toLowerCase()===a.toLowerCase());
                            return <button key={a} onClick={()=>{
                              if(already)return;
                              setClientMasterList(p=>[...p,a].sort((x,y)=>x.localeCompare(y)));
                              showToast(`${a} added ✓`);
                            }}
                              style={{background:already?`${C.green}12`:`${C.green}20`,border:`1px solid ${already?C.green+"44":C.green+"66"}`,borderRadius:12,padding:"3px 11px",fontSize:11,color:already?C.muted:C.green,cursor:already?"default":"pointer",fontFamily:"'DM Mono',monospace",textDecoration:already?"line-through":"none"}}>
                              {already?"✓":"+"}  {a}
                            </button>;
                          })}
                        </div>
                        {notYet.length>0&&<button onClick={()=>{
                          setClientMasterList(p=>[...p,...notYet].sort((a,b)=>a.localeCompare(b)));
                          showToast(`${notYet.length} Zoho accounts imported ✓`);
                        }} style={{fontSize:10,background:`${C.green}22`,border:`1px solid ${C.green}55`,borderRadius:4,padding:"4px 12px",color:C.green,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          Import All {notYet.length} New
                        </button>}
                      </div>
                    );
                  })()}
                  {!zohoAccounts.length&&!zohoError&&!zohoImporting&&<div style={{fontSize:10,color:C.muted}}>Click "Fetch Accounts" to pull your advertiser list directly from Zoho CRM.</div>}
                </div>

                {/* Import from existing deals */}
                {(()=>{
                  const existingClients=[...new Set(deals.map(d=>d.clientCompany).filter(Boolean))].sort();
                  const notYetAdded=existingClients.filter(c=>!clientMasterList.some(m=>m.toLowerCase()===c.toLowerCase()));
                  if(!notYetAdded.length)return null;
                  return (
                    <div style={{marginBottom:12,padding:"10px 12px",background:`${C.accent}0a`,border:`1px solid ${C.accent}33`,borderRadius:6}}>
                      <div style={{fontSize:10,color:C.accent,fontWeight:700,marginBottom:8,letterSpacing:".06em"}}>IMPORT FROM EXISTING DEALS ({notYetAdded.length} not yet listed)</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                        {notYetAdded.map(c=>(
                          <button key={c} onClick={()=>{setClientMasterList(p=>[...p,c].sort((a,b)=>a.localeCompare(b)));showToast(`${c} added ✓`);}}
                            style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"3px 11px",fontSize:11,color:C.accent,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                            + {c}
                          </button>
                        ))}
                      </div>
                      <button onClick={()=>{
                        const toAdd=notYetAdded.filter(c=>!clientMasterList.some(m=>m.toLowerCase()===c.toLowerCase()));
                        setClientMasterList(p=>[...p,...toAdd].sort((a,b)=>a.localeCompare(b)));
                        showToast(`${toAdd.length} clients imported ✓`);
                      }} style={{fontSize:10,background:`${C.accent}22`,border:`1px solid ${C.accent}55`,borderRadius:4,padding:"4px 12px",color:C.accent,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        Import All {notYetAdded.length}
                      </button>
                    </div>
                  );
                })()}
                {/* Current list */}
                {clientMasterList.length===0
                  ? <div style={{textAlign:"center",padding:20,color:C.muted,fontSize:11}}>No clients added yet. Add them above or import from existing deals.</div>
                  : <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:200,overflowY:"auto"}}>
                      {clientMasterList.map((c,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:C.s2,border:`1px solid ${C.border}`,borderRadius:14,padding:"4px 10px 4px 12px",fontSize:11}}>
                          <span>{c}</span>
                          <button onClick={()=>{if(!window.confirm(`Remove "${c}" from client list?`))return;setClientMasterList(p=>p.filter((_,j)=>j!==i));showToast(`${c} removed`);}}
                            style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:"0 2px",lineHeight:1,fontSize:13}}>✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* Audit log summary */}
              <div className="card" style={{padding:"18px 20px"}}>
                <div className="sans" style={{fontWeight:700,marginBottom:12}}>Recent Approval Activity</div>
                {(()=>{
                  const allLogs = deals.flatMap(d=>(d.auditLog||[]).map(l=>({...l,dealId:d.id,clientCompany:d.clientCompany,amount:d.amount})));
                  const sorted  = allLogs.sort((a,b)=>b.at?.localeCompare(a.at||"")||0).slice(0,20);
                  if(!sorted.length) return <div style={{textAlign:"center",padding:20,color:C.muted}}>No approval actions yet.</div>;
                  return (
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {sorted.map((l,i)=>{
                        const ac = l.action==="Approved"?C.green:l.action==="Rejected"?C.red:C.orange;
                        return (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.s2,borderRadius:5,flexWrap:"wrap"}}>
                            <span style={{background:`${ac}22`,color:ac,padding:"1px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{l.action}</span>
                            <span style={{fontSize:11,fontWeight:600}}>{l.clientCompany}</span>
                            <span style={{fontSize:10,color:C.dim}}>by {l.by} ({l.role})</span>
                            <span style={{fontSize:10,color:C.dim}}>→ {l.to||"Cleared"}</span>
                            {l.note&&<span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>"{l.note}"</span>}
                            <span style={{fontSize:10,color:C.muted,marginLeft:"auto"}}>{l.at}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {view==="import" && isAdmin && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>DATA MANAGEMENT</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Add, edit, or deactivate sales reps and clients. Changes apply instantly for all users.</div>

              {/* ── TOP-LEVEL TABS ── */}
              <div style={{display:"flex",gap:0,marginBottom:22,borderBottom:`1px solid ${C.border}`}}>
                {([["reps","◇ Sales Reps"],["clients","◎ Clients"],["bulk","⬆ Bulk Import"]] as const).map(([id,label])=>(
                  <button key={id} onClick={()=>setDmTab(id)}
                    style={{padding:"10px 20px",background:"transparent",border:"none",
                      borderBottom:dmTab===id?`2px solid ${C.accent}`:"2px solid transparent",
                      color:dmTab===id?C.accent:C.dim,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:dmTab===id?700:400}}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── SALES REPS TAB ── */}
              {dmTab==="reps" && (()=>{
                const REGIONS = ["North","South","East","West","National","Central"];
                const ROLES   = ["Sales Executive","Senior Sales","Business Development"];
                const saveRep = () => {
                  if (!repEditForm.name?.trim()){showToast("Name required","err");return;}
                  setReps(p=>p.map(r=>r.id===repEditId?{...r,...repEditForm}:r));
                  setRepEditId(null); setRepEditForm({});
                  showToast("Rep updated");
                };
                const addRep = () => {
                  if (!repAddForm.name.trim()){showToast("Name required","err");return;}
                  const newId = Math.max(0,...reps.map(r=>r.id))+1;
                  setReps(p=>[...p,{id:newId,...repAddForm,active:true}]);
                  setRepAddMode(false);
                  setRepAddForm({name:"",region:"North",role:"Sales Executive",target:10000000,active:true});
                  showToast(`${repAddForm.name} added`);
                };
                return (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:12,color:C.dim}}>{reps.filter(r=>r.active!==false).length} active · {reps.filter(r=>r.active===false).length} inactive</div>
                      <button onClick={()=>{setRepAddMode(true);setRepEditId(null);}}
                        style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        + Add Rep
                      </button>
                    </div>

                    {/* Add rep inline form */}
                    {repAddMode && (
                      <div className="card" style={{padding:"16px 18px",marginBottom:14,border:`1px solid ${C.accent}44`}}>
                        <div className="sans" style={{fontWeight:700,marginBottom:12,fontSize:13}}>New Sales Rep</div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>FULL NAME *</div>
                            <input value={repAddForm.name} onChange={e=>setRepAddForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Sunita Patra"
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>REGION *</div>
                            <select value={repAddForm.region} onChange={e=>setRepAddForm(p=>({...p,region:e.target.value}))}
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                              {REGIONS.map(r=><option key={r}>{r}</option>)}
                            </select></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>ROLE</div>
                            <select value={repAddForm.role} onChange={e=>setRepAddForm(p=>({...p,role:e.target.value}))}
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                              {ROLES.map(r=><option key={r}>{r}</option>)}
                            </select></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>TARGET (₹L)</div>
                            <input type="number" value={repAddForm.target/100000} onChange={e=>setRepAddForm(p=>({...p,target:parseFloat(e.target.value||0)*100000}))}
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} /></div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={addRep} style={{background:C.accent,border:"none",color:"#000",borderRadius:5,padding:"7px 18px",fontSize:12,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Save Rep</button>
                          <button onClick={()=>setRepAddMode(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Reps table */}
                    <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:C.s2}}>
                            {["ID","Name","Region","Role","Target","Status","Actions"].map(h=>(
                              <th key={h} style={{padding:"9px 12px",color:C.dim,fontWeight:700,fontSize:10,letterSpacing:".07em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reps.map(rep=>{
                            const isEditing = repEditId===rep.id;
                            const inactive  = rep.active===false;
                            return (
                              <tr key={rep.id} style={{borderTop:`1px solid ${C.s2}`,background:inactive?"rgba(0,0,0,.03)":"transparent",opacity:inactive?.65:1}}>
                                <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{rep.id}</td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <input value={repEditForm.name||rep.name} onChange={e=>setRepEditForm(p=>({...p,name:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:140}} />
                                    : <span style={{fontWeight:600,color:inactive?C.muted:C.text}}>{rep.name}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <select value={repEditForm.region||rep.region} onChange={e=>setRepEditForm(p=>({...p,region:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12}}>
                                        {REGIONS.map(r=><option key={r}>{r}</option>)}
                                      </select>
                                    : <span style={{color:C.blue,fontFamily:"'DM Mono',monospace",fontSize:11}}>{rep.region}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <select value={repEditForm.role||rep.role} onChange={e=>setRepEditForm(p=>({...p,role:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12}}>
                                        {ROLES.map(r=><option key={r}>{r}</option>)}
                                      </select>
                                    : <span style={{color:C.dim,fontSize:11}}>{rep.role}</span>}
                                </td>
                                <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace"}}>
                                  {isEditing
                                    ? <input type="number" value={(repEditForm.target??rep.target)/100000}
                                        onChange={e=>setRepEditForm(p=>({...p,target:parseFloat(e.target.value||0)*100000}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:70,fontFamily:"'DM Mono',monospace"}} />
                                    : <span style={{color:C.accent}}>₹{((rep.target||0)/100000).toFixed(0)}L</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,
                                    background:inactive?`${C.red}18`:`${C.green}18`,
                                    color:inactive?C.red:C.green}}>
                                    {inactive?"INACTIVE":"ACTIVE"}
                                  </span>
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  <div style={{display:"flex",gap:6}}>
                                    {isEditing ? (
                                      <>
                                        <button onClick={saveRep}
                                          style={{background:C.green,border:"none",color:"#fff",borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>✓ Save</button>
                                        <button onClick={()=>{setRepEditId(null);setRepEditForm({});}}
                                          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕</button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={()=>{setRepEditId(rep.id);setRepEditForm({...rep});setRepAddMode(false);}}
                                          style={{background:`${C.blue}15`,border:"none",color:C.blue,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Edit</button>
                                        <button onClick={()=>{setReps(p=>p.map(r=>r.id===rep.id?{...r,active:!inactive}:r));showToast(inactive?"Rep activated":"Rep deactivated");}}
                                          style={{background:inactive?`${C.green}15`:`${C.red}12`,border:"none",color:inactive?C.green:C.red,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                          {inactive?"Activate":"Deactivate"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── CLIENT MASTER TAB ── */}
              {dmTab==="clients" && (()=>{
                const REGIONS  = ["North","South","East","West","National","Central"];
                const INDUSTRIES = ["FMCG","Banking/Finance","Automobile","Healthcare","Retail","Telecom","Technology","Steel/Manufacturing","Beverages","Paints","Media","Government","Other"];
                const saveClient = () => {
                  if (!clientEditForm.company?.trim()){showToast("Company name required","err");return;}
                  setMasterClients(p=>p.map(c=>c.id===clientEditId?{...c,...clientEditForm}:c));
                  setClientEditId(null); setClientEditForm({});
                  showToast("Client updated");
                };
                const addClient = () => {
                  if (!clientAddForm.company.trim()){showToast("Company name required","err");return;}
                  const newId = `mc${Date.now()}`;
                  setMasterClients(p=>[...p,{id:newId,...clientAddForm}]);
                  setClientAddMode(false);
                  setClientAddForm({company:"",industry:"",contact:"",phone:"",email:"",region:"National"});
                  showToast(`${clientAddForm.company} added to client master`);
                };
                return (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:12,color:C.dim}}>{masterClients.length} clients in master list</div>
                      <button onClick={()=>{setClientAddMode(true);setClientEditId(null);}}
                        style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                        + Add Client
                      </button>
                    </div>

                    {/* Add client form */}
                    {clientAddMode && (
                      <div className="card" style={{padding:"16px 18px",marginBottom:14,border:`1px solid ${C.accent}44`}}>
                        <div className="sans" style={{fontWeight:700,marginBottom:12,fontSize:13}}>New Client</div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}}>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>COMPANY NAME *</div>
                            <input value={clientAddForm.company} onChange={e=>setClientAddForm(p=>({...p,company:e.target.value}))} placeholder="e.g. Havells India"
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>INDUSTRY</div>
                            <select value={clientAddForm.industry} onChange={e=>setClientAddForm(p=>({...p,industry:e.target.value}))}
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                              <option value="">Select</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}
                            </select></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>REGION</div>
                            <select value={clientAddForm.region} onChange={e=>setClientAddForm(p=>({...p,region:e.target.value}))}
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                              {REGIONS.map(r=><option key={r}>{r}</option>)}
                            </select></div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:12}}>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>PRIMARY CONTACT</div>
                            <input value={clientAddForm.contact} onChange={e=>setClientAddForm(p=>({...p,contact:e.target.value}))} placeholder="Contact name"
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>PHONE</div>
                            <input value={clientAddForm.phone} onChange={e=>setClientAddForm(p=>({...p,phone:e.target.value}))} placeholder="9800000000"
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} /></div>
                          <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>EMAIL</div>
                            <input value={clientAddForm.email} onChange={e=>setClientAddForm(p=>({...p,email:e.target.value}))} placeholder="name@company.com"
                              style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} /></div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={addClient} style={{background:C.accent,border:"none",color:"#000",borderRadius:5,padding:"7px 18px",fontSize:12,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Save Client</button>
                          <button onClick={()=>setClientAddMode(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Clients table */}
                    <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:C.s2}}>
                            {["Company","Industry","Region","Contact","Phone","Email","Actions"].map(h=>(
                              <th key={h} style={{padding:"9px 12px",color:C.dim,fontWeight:700,fontSize:10,letterSpacing:".07em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {masterClients.map(cl=>{
                            const isEditing = clientEditId===cl.id;
                            return (
                              <tr key={cl.id} style={{borderTop:`1px solid ${C.s2}`}}>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <input value={clientEditForm.company??cl.company} onChange={e=>setClientEditForm(p=>({...p,company:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:140}} />
                                    : <span style={{fontWeight:600}}>{cl.company}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <select value={clientEditForm.industry??cl.industry} onChange={e=>setClientEditForm(p=>({...p,industry:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11}}>
                                        <option value="">-</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}
                                      </select>
                                    : <span style={{color:C.dim,fontSize:11}}>{cl.industry||"—"}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <select value={clientEditForm.region??cl.region} onChange={e=>setClientEditForm(p=>({...p,region:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11}}>
                                        {REGIONS.map(r=><option key={r}>{r}</option>)}
                                      </select>
                                    : <span style={{color:C.blue,fontFamily:"'DM Mono',monospace",fontSize:11}}>{cl.region||"—"}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  {isEditing
                                    ? <input value={clientEditForm.contact??cl.contact} onChange={e=>setClientEditForm(p=>({...p,contact:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:120}} />
                                    : <span style={{color:C.dim,fontSize:11}}>{cl.contact||"—"}</span>}
                                </td>
                                <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:11}}>
                                  {isEditing
                                    ? <input value={clientEditForm.phone??cl.phone} onChange={e=>setClientEditForm(p=>({...p,phone:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11,width:110,fontFamily:"'DM Mono',monospace"}} />
                                    : <span style={{color:C.dim}}>{cl.phone||"—"}</span>}
                                </td>
                                <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:11}}>
                                  {isEditing
                                    ? <input value={clientEditForm.email??cl.email} onChange={e=>setClientEditForm(p=>({...p,email:e.target.value}))}
                                        style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11,width:150,fontFamily:"'DM Mono',monospace"}} />
                                    : <span style={{color:C.muted}}>{cl.email||"—"}</span>}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  <div style={{display:"flex",gap:6}}>
                                    {isEditing ? (
                                      <>
                                        <button onClick={saveClient}
                                          style={{background:C.green,border:"none",color:"#fff",borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>✓ Save</button>
                                        <button onClick={()=>{setClientEditId(null);setClientEditForm({});}}
                                          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕</button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={()=>{setClientEditId(cl.id);setClientEditForm({...cl});setClientAddMode(false);}}
                                          style={{background:`${C.blue}15`,border:"none",color:C.blue,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Edit</button>
                                        <button onClick={()=>{setMasterClients(p=>p.filter(c=>c.id!==cl.id));showToast("Client removed");}}
                                          style={{background:`${C.red}12`,border:"none",color:C.red,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Remove</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── BULK IMPORT TAB (original CSV upload) ── */}
              {dmTab==="bulk" && (()=>{
                const tabs = [
                  {id:"targets",    label:"Targets",        icon:"✦", desc:"Annual client-wise targets per rep — 6 columns only"},
                  {id:"reps",       label:"Sales Reps",     icon:"◇", desc:"Rep names, regions, roles"},
                  {id:"clients",    label:"Clients",        icon:"◎", desc:"Client master list"},
                  {id:"revenue",    label:"Revenue Entries",icon:"₹", desc:"Actual revenue logged"},
                  {id:"properties", label:"IP Inventory",   icon:"⬡", desc:"IP / sponsorship inventory"},
                ];
                const [impTab, setImpTab] = [importTab, setImportTab];

                const TEMPLATES = {
                  targets:    ["Rep Name","Region","Client Company","Channel","Deal Type","Annual Target Amount"],
                  reps:       ["Rep Name","Email","Region","Role","Annual Quota"],
                  clients:    ["Client Company","Industry","Primary Contact","Phone","Email","Assigned Rep","Region"],
                  revenue:    ["Rep Name","Client Company","Deal Type","Amount","Invoice Ref","Date","Quarter"],
                  properties: ["IP Name","Channel","IP Type","Air Date","Duration (weeks)","Slot Type","Slot Rate","Total Slots Available"],
                };

                const downloadTemplate = (type) => {
                  const headers = TEMPLATES[type] || [];
                  const sampleRow = {
                    targets:    ["Vikram Sen","National","Havells India","OTV","Linear TV","15000000"],
                    reps:       ["Arjun Mishra","arjun@odishatv.com","North","SALES REP","10000000"],
                    clients:    ["Havells India","FMCG","Deepa Menon","9823401234","deepa@havells.com","Vikram Sen","National"],
                    revenue:    ["Vikram Sen","Havells India","IPs","5000000","INV-2024-001","2026-04-10","Q1 FY26"],
                    properties: ["Odia Idol S3","OTV","Reality Show","2026-07-15","8","Title Sponsor","5000000","4"],
                  }[type] || [];
                  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
                  const blob = new Blob([csv], {type:"text/csv"});
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `OTV_${type}_template.csv`;
                  a.click();
                };

                const processUpload = async (file, type) => {
                  const XLSX = await loadXLSX();
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const wb   = XLSX.read(ev.target.result, {type:"array", raw:false});
                      const ws   = wb.Sheets[wb.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json(ws);
                      setImportData({filename:file.name, rows, type});
                    } catch(err) { showToast("Could not read file: "+err.message, "err"); }
                  };
                  reader.readAsArrayBuffer(file);
                };

                const commitImport = () => {
                  if (!importData) return;
                  const {rows, type} = importData;
                  const parseCur = v => { if(!v)return 0; const s=String(v).replace(/[,₹]/g,"").trim(); if(/[0-9]+[Cc][Rr]$/.test(s))return parseFloat(s)*10000000; if(/[0-9]+[Ll]$/.test(s))return parseFloat(s)*100000; return parseFloat(s)||0; };

                  if (type==="revenue") {
                    const repLookup = r => reps.find(rep=>rep.name.toLowerCase().includes((r||"").toLowerCase().slice(0,5)));
                    const entries = rows.map((row,i)=>{
                      const rep = repLookup(row["Rep Name"]);
                      return {id:`re_imp_${Date.now()}_${i}`,repId:rep?.id||null,clientCompany:row["Client Company"]||"",dealType:row["Deal Type"]||"Linear TV",amount:parseCur(row["Amount"]),invoiceRef:row["Invoice Ref"]||"",date:row["Date"]||TODAY,quarter:row["Quarter"]||"Q1 FY26",notes:row["Notes"]||""};
                    });
                    setRevenueEntries(p=>[...p,...entries]);
                    showToast(`✓ ${entries.length} revenue entries imported`);
                  } else if (type==="targets") {
                    // Group rows by rep — one targetSub per rep, multiple client+deal entries per sub
                    const repGroups: Record<string, {rep:any, repName:string, region:string, rows:any[]}> = {};
                    rows.forEach(row => {
                      const repName = (row["Rep Name"]||"").trim();
                      const rep = reps.find(r=>r.name.toLowerCase()===repName.toLowerCase())
                               || reps.find(r=>r.name.toLowerCase().includes(repName.toLowerCase().slice(0,6)));
                      const key = rep?.id || repName;
                      if (!repGroups[key]) repGroups[key] = {rep, repName, region: rep?.region||row["Region"]||"", rows:[]};
                      repGroups[key].rows.push(row);
                    });
                    const now = Date.now();
                    const newSubs = Object.values(repGroups).map((g, i) => {
                      const clients = g.rows.map(row => ({
                        clientCompany: (row["Client Company"]||"").trim(),
                        channel:       (row["Channel"]||"OTV").trim(),
                        dealType:      (row["Deal Type"]||"Linear TV").trim(),
                        targetAmount:  parseCur(row["Annual Target Amount"]),
                        clientStatus:  "Pending",
                      }));
                      return {
                        id: `ts_imp_${now}_${i}`,
                        repId:      g.rep?.id||null,
                        repName:    g.rep?.name||g.repName,
                        region:     g.region,
                        quarter:    "FY26 Annual",
                        clients,
                        totalTarget: clients.reduce((s,c)=>s+c.targetAmount,0),
                        status:     "Pending RH",
                        submittedAt: TODAY,
                        approvalLog: [],
                      };
                    });
                    setTargetSubs(p=>[...p,...newSubs]);
                    const totalClients = newSubs.reduce((s,sub)=>s+sub.clients.length,0);
                    showToast(`✓ ${totalClients} client targets imported for ${newSubs.length} rep${newSubs.length!==1?"s":""} → pending RH approval`);
                  } else if (type==="properties") {
                    const grouped = {};
                    rows.forEach(row=>{
                      const name = row["Property Name"]||"";
                      if(!grouped[name]) grouped[name]={id:`pr_imp_${Date.now()}`,name,type:row["Type"]||"",channel:row["Channel"]||"",quarter:row["Quarter"]||"Q1 FY26",totalValue:parseCur(row["Total Value"]),slots:[]};
                      grouped[name].slots.push({id:`s_imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,label:row["Slot Label"]||"Slot",value:parseCur(row["Slot Value"]),status:row["Status"]||"Available",clientCompany:row["Client Company"]||"",repId:null});
                    });
                    setProperties(p=>[...p,...Object.values(grouped)]);
                    showToast(`✓ ${Object.values(grouped).length} properties imported`);
                  } else {
                    showToast(`${type} import noted — connect to your DB to persist`, "ok");
                  }
                  setImportData(null);
                };

                return (
                  <div>
                    {/* Tab switcher */}
                    <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                      {tabs.map(t=>(
                        <button key={t.id} onClick={()=>setImportTab(t.id)}
                          style={{padding:"10px 18px",background:"transparent",border:"none",
                            borderBottom:impTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                            color:impTab===t.id?C.accent:C.dim,cursor:"pointer",
                            fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:impTab===t.id?700:400}}>
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>

                    {tabs.filter(t=>t.id===impTab).map(tab=>(
                      <div key={tab.id}>
                        <div style={{fontSize:12,color:C.dim,marginBottom:16}}>{tab.desc} — {TEMPLATES[tab.id]?.length} columns</div>

                        {/* Step 1: Download template */}
                        <div className="card" style={{padding:"16px 20px",marginBottom:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div className="sans" style={{fontWeight:700,marginBottom:3}}>Step 1 — Download Template</div>
                              <div style={{fontSize:11,color:C.dim}}>Columns: {TEMPLATES[tab.id]?.join(" · ")}</div>
                            </div>
                            <button onClick={()=>downloadTemplate(tab.id)}
                              style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                              ↓ Download CSV
                            </button>
                          </div>
                        </div>

                        {/* Step 2: Upload */}
                        <div className="card" style={{padding:"16px 20px",marginBottom:14}}>
                          <div className="sans" style={{fontWeight:700,marginBottom:8}}>Step 2 — Upload Filled File</div>
                          <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Accepts .csv or .xlsx — first row must be column headers</div>
                          <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:C.s2,border:`2px dashed ${C.border}`,borderRadius:8,padding:"24px 20px",cursor:"pointer",transition:"border-color .15s"}}
                            onMouseOver={e=>e.currentTarget.style.borderColor=C.accent}
                            onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                            <input type="file" accept=".csv,.xlsx" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)processUpload(f,tab.id);e.target.value="";}}/>
                            <span style={{fontSize:24}}>📁</span>
                            <div>
                              <div style={{fontWeight:700,fontSize:13}}>Click to choose file</div>
                              <div style={{fontSize:11,color:C.dim,marginTop:2}}>CSV or Excel (.xlsx)</div>
                            </div>
                          </label>
                        </div>

                        {/* Step 3: Preview + confirm */}
                        {importData && importData.type===tab.id && (
                          <div className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${C.green}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                              <div>
                                <div className="sans" style={{fontWeight:700}}>{importData.filename}</div>
                                <div style={{fontSize:11,color:C.dim,marginTop:2}}>{importData.rows.length} rows ready to import</div>
                              </div>
                              <div style={{display:"flex",gap:8}}>
                                <button onClick={()=>setImportData(null)} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕ Cancel</button>
                                <button onClick={commitImport}
                                  style={{background:"linear-gradient(135deg,#16c784,#0ea570)",border:"none",color:"#fff",borderRadius:4,padding:"6px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                  ✓ Import {importData.rows.length} rows →
                                </button>
                              </div>
                            </div>
                            {/* Preview table */}
                            <div style={{overflowX:"auto",borderRadius:5,border:`1px solid ${C.border}`}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                                <thead><tr>
                                  {Object.keys(importData.rows[0]||{}).slice(0,7).map(h=>(
                                    <th key={h} style={{padding:"6px 10px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                  ))}
                                  {Object.keys(importData.rows[0]||{}).length>7&&<th style={{padding:"6px 10px",background:C.s2,color:C.muted,fontSize:10}}>+{Object.keys(importData.rows[0]).length-7} more</th>}
                                </tr></thead>
                                <tbody>
                                  {importData.rows.slice(0,5).map((row,i)=>(
                                    <tr key={i} style={{borderBottom:`1px solid ${C.s2}`}}>
                                      {Object.values(row).slice(0,7).map((v,j)=>(
                                        <td key={j} style={{padding:"7px 10px",color:C.text,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(v)}</td>
                                      ))}
                                      {Object.values(row).length>7&&<td style={{padding:"7px 10px",color:C.muted}}>…</td>}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {importData.rows.length>5&&<div style={{padding:"8px 12px",fontSize:11,color:C.dim,background:C.s2}}>…and {importData.rows.length-5} more rows</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Current stats */}
                    <div style={{marginTop:20,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                      {[
                        {label:"Deals in system",    val:deals.length,           color:C.accent},
                        {label:"Revenue entries",    val:revenueEntries.length,  color:C.green},
                        {label:"Target submissions", val:targetSubs.length,      color:C.blue},
                        {label:"Properties/IPs",     val:(properties||[]).length,color:C.purple},
                        {label:"Tasks",              val:tasks.length,           color:C.orange},
                        {label:"Meetings logged",    val:meetings.length,        color:C.dim},
                      ].map(s=>(
                        <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}33`,borderRadius:7,padding:"10px 14px"}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                          <div className="sans" style={{fontSize:20,fontWeight:800,color:s.color}}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


          {/* ══════════════ CEO VIEWS ══════════════ */}
          {view==="ceo-kpi" && isCEORole && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter));
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totW=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
            const forecast=totC+totW; const fcastPct=totT>0?Math.round((forecast/totT)*100):0; const closePct=totT>0?Math.round((totC/totT)*100):0;
            const fsc=fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red;
            const top5=allD.filter(d=>d.priority==="Top 5").sort((a,b)=>b.amount-a.amount);
            const regions=REGIONS;
            const regionStats=regions.map(r=>{const rd=allD.filter(d=>d.region===r);const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);const rRepIdsR=new Set(rd.map(d=>d.repId));const rC=revenueEntries.filter(e=>rRepIdsR.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);const rPct=rT>0?Math.round((rC/rT)*100):0;return{r,rT,rC,rPct};});
            const compliantReps=reps.filter(r=>att[TODAY]?.[r.id]).length;
            const openEsc=deals.filter(d=>d.awaitingApproval&&daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length;
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>STRATEGIC KPIs</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · Organisation-wide</div></div>
              <div style={{background:C.surface,border:`2px solid ${fsc}`,borderRadius:12,padding:"22px 28px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:40,flexWrap:"wrap"}}>
                  <div><div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Revenue Forecast · {filterQ}</div><div className="sans" style={{fontSize:64,fontWeight:900,color:fsc,lineHeight:1}}>{fcastPct}%</div><div style={{fontSize:13,color:C.dim,marginTop:4}}>of {fmtR(totT)} target</div></div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,flex:1,minWidth:240}}>
                    {[["Closed",fmtR(totC),C.green,closePct],["Forecast",fmtR(forecast),fsc,fcastPct],["Gap",fmtR(Math.max(0,totT-forecast)),C.red,null]].map(([l,v,c,pct])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:80,fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>{l}</div><div className="sans" style={{fontSize:16,fontWeight:700,color:c,minWidth:80}}>{v}</div>{pct!=null&&<div style={{flex:1,height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:c}} /></div>}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
                {regionStats.map(({r,rT,rC,rPct})=>{const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;return(<div key={r} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`2px solid ${sc}`,borderRadius:7,padding:"10px 12px"}}><div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>{r}</div><div className="sans" style={{fontSize:22,fontWeight:800,color:sc}}>{rPct}%</div><div style={{fontSize:10,color:C.dim,marginTop:2}}>{fmtR(rC)} / {fmtR(rT)}</div></div>);})}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Team Health · Today</div>
                  {[["Reps Compliant",`${compliantReps} / ${reps.length}`,compliantReps===reps.length?C.green:C.orange],["Open Escalations",openEsc,openEsc===0?C.green:C.red],["At-Risk Deals",atRisk.length,atRisk.length===0?C.green:C.red],["Overdue Next Steps",overdueNext.length,overdueNext.length===0?C.green:C.orange]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.s2}`}}><span style={{fontSize:12,color:C.dim}}>{l}</span><span className="sans" style={{fontSize:16,fontWeight:700,color:c}}>{v}</span></div>))}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Top 5 Deals</div>
                  {top5.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"20px 0"}}>No Top 5 deals tagged</div>}
                  {top5.slice(0,5).map(d=>{const rep=reps.find(r=>r.id===d.repId);return(<div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.s2}`}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{rep?.name}</div></div><div style={{textAlign:"right"}}><div className="sans" style={{fontSize:13,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{d.outcome}</span></div></div>);})}
                </div>
              </div>
            </div>);
          })()}

          {view==="ceo-risks" && isCEORole && (()=>{
            const highRisk=deals.filter(d=>qMatch(d.quarter)&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").map(d=>({...d,idle:daysSince(d.lastContact)})).sort((a,b)=>(b.targetAmount-a.targetAmount)||(b.idle-a.idle));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TOP RISKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Highest-value open deals · sorted by target size and idle time</div></div>
              {highRisk.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green}}>✓ No open risks.</div>}
              {highRisk.map((d,i)=>{const rep=reps.find(r=>r.id===d.repId);const riskColor=d.idle>=14?C.red:d.idle>=7?C.orange:C.blue;const riskLabel=d.idle>=14?"HIGH":d.idle>=7?"MEDIUM":"WATCH";return(
                <div key={d.id} style={{background:C.surface,border:`1px solid ${d.idle>=7?riskColor+"44":C.border}`,borderLeft:`3px solid ${riskColor}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{width:52,textAlign:"center",flexShrink:0}}><div className="sans" style={{fontSize:20,fontWeight:800,color:riskColor}}>#{i+1}</div><div style={{background:`${riskColor}22`,color:riskColor,padding:"2px 5px",borderRadius:4,fontSize:8,fontWeight:700,marginTop:3}}>{riskLabel}</div></div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5,flexWrap:"wrap"}}><span className="sans" style={{fontSize:15,fontWeight:700}}>{d.clientCompany}</span><span style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region}</span>{d.awaitingApproval&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>Blocked → {d.awaitingApproval}</span>}</div>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.dim}}>Target: <strong style={{color:C.text}}>{fmtR(d.targetAmount)}</strong></span><span style={{fontSize:11,color:C.dim}}>Pipeline: <strong style={{color:C.accent}}>{fmtR(d.amount)}</strong></span><span style={{fontSize:11,color:C.dim}}>Idle: <strong style={{color:riskColor}}>{d.idle===0?"Today":`${d.idle}d`}</strong></span><span style={{fontSize:11,color:C.dim}}>Next: <strong style={{color:C.text}}>{d.nextStep||"—"}</strong></span></div>
                  </div>
                  <span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"3px 9px",borderRadius:5,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{d.outcome}</span>
                </div>
              );})}
            </div>);
          })()}

          {view==="ceo-senior" && isCEORole && (()=>{
            const seniorReqs=meetings.filter(m=>m.seniorRequested==="Yes").sort((a,b)=>b.date>a.date?1:-1);
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>SENIOR REQUESTS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Meetings where a rep has asked for senior presence</div></div>
              {seniorReqs.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:40,textAlign:"center"}}><div style={{fontSize:24,marginBottom:8}}>✓</div><div className="sans" style={{fontWeight:700,color:C.green}}>No senior requests pending</div></div>}
              {seniorReqs.map(m=>{const rep=reps.find(r=>r.id===m.repId);const deal=deals.find(d=>d.repId===m.repId&&(d.clientCompany||"").toLowerCase().includes((m.clientCompany||"").toLowerCase().slice(0,5)));return(
                <div key={m.id} style={{background:C.surface,border:`1px solid ${C.blue}44`,borderLeft:`3px solid ${C.blue}`,borderRadius:8,padding:"14px 18px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span className="sans" style={{fontSize:15,fontWeight:700}}>{m.clientCompany}</span><span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600}}>Senior Needed</span></div><div style={{fontSize:11,color:C.dim,marginBottom:4}}><strong>{rep?.name}</strong> is asking for <strong style={{color:C.blue}}>{m.seniorRequestedName||m.seniorRequestedRole}</strong> ({m.seniorRequestedRole}) in the next round</div>{m.nextSteps&&<div style={{fontSize:11,color:C.text}}>Context: {m.nextSteps}</div>}</div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.dim,marginBottom:3}}>Meeting: {m.date}</div>{deal&&<div className="sans" style={{fontSize:13,fontWeight:700,color:C.accent}}>{fmtR(deal.amount)}</div>}{deal&&<span style={{background:`${oColor(deal.outcome)}18`,color:oColor(deal.outcome),padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{deal.outcome}</span>}</div>
                  </div>
                  {m.discussion&&<div style={{marginTop:8,padding:"8px 12px",background:C.s2,borderRadius:5,fontSize:11,color:C.dim}}>{m.discussion.slice(0,150)}{m.discussion.length>150?"...":""}</div>}
                </div>
              );})}
            </div>);
          })()}

          {view==="ceo-approvals" && isCEORole && (()=>{
            const pending=deals.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>APPROVALS QUEUE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All deals awaiting sign-off</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{label:"TOTAL PENDING",value:pending.length,color:C.orange},{label:"OVERDUE (>2D)",value:pending.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=2).length,color:C.red},{label:"TOTAL VALUE",value:fmtR(pending.reduce((s,d)=>s+(d.amount||0),0)),color:C.accent}].map(k=>(<div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.color}}>{k.value}</div></div>))}
              </div>
              {pending.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No pending approvals</div>}
              {pending.length>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Amount","Waiting For","Days","Stage","Action"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{pending.map(d=>{const rep=reps.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:dw>=2?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=dw>=2?`${C.red}04`:"transparent"}><td style={{padding:"10px 14px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td><td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{d.awaitingApproval}</span></td><td style={{padding:"10px 14px",color:dw>=2?C.red:C.dim,fontWeight:dw>=2?700:400}}>{dw}d</td><td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td><td style={{padding:"10px 14px",whiteSpace:"nowrap"}}><button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()} style={{background:canApprove(d)?`${C.green}22`:C.s3,border:"none",color:canApprove(d)?C.green:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{canApprove(d)?"Approve →":"🔒 Locked"}</button></td></tr>);})}</tbody></table></div>}
            </div>);
          })()}

          {/* ══════════════ MD VIEWS ══════════════ */}
          {view==="md-accounts" && isMDRole && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter)&&d.priority==="Top 5");
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0); const top5RepIds=new Set(allD.map(d=>d.repId)); const totC=revenueEntries.filter(e=>top5RepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totPct=totT>0?Math.round((totC/totT)*100):0; const sc=totPct>=80?C.green:totPct>=50?C.accent:C.red;
            const seniorReqs=meetings.filter(m=>m.seniorRequested==="Yes");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>KEY ACCOUNTS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Top 5 priority deals + senior meeting requests</div></div>
              <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"16px 22px",marginBottom:20,display:"flex",alignItems:"flex-end",gap:24,flexWrap:"wrap"}}>
                {[["KEY ACCOUNT TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["PENDING",fmtR(Math.max(0,totT-totC)),C.accent]].map(([l,v,c])=>(<div key={l}><div style={{fontSize:9,color:C.dim,letterSpacing:".08em",marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>))}
                <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:sc,lineHeight:1}}>{totPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
              </div>
              {allD.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=reps.find(r=>r.id===d.repId);const senReq=seniorReqs.find(m=>m.repId===d.repId&&(m.clientCompany||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5)));return(
                <div key={d.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${oColor(d.outcome)}`,borderRadius:8,padding:"14px 18px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                    <div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><span className="sans" style={{fontSize:15,fontWeight:700}}>{d.clientCompany}</span><span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>TOP 5</span>{senReq&&<span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>⬆ Senior Requested</span>}</div><div style={{fontSize:11,color:C.dim}}>{d.contactName&&<span>{d.contactName}{d.designation?`, ${d.designation}`:""} · </span>}<span>Managed by {rep?.name}</span></div>{d.nextStep&&<div style={{fontSize:11,color:C.text,marginTop:6}}>→ {d.nextStep}</div>}{d.awaitingApproval&&<div style={{marginTop:5}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>Blocked → {d.awaitingApproval} ({daysSince(d.awaitingApprovalSince||TODAY)}d)</span></div>}</div>
                    <div style={{textAlign:"right",minWidth:100}}><div className="sans" style={{fontSize:18,fontWeight:700,color:C.accent,marginBottom:4}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"3px 9px",borderRadius:5,fontSize:11,fontWeight:600}}>{d.outcome}</span>{d.lastContact&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>Last: {daysSince(d.lastContact)===0?"Today":`${daysSince(d.lastContact)}d ago`}</div>}</div>
                  </div>
                </div>
              );})}
              {allD.length===0&&<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No Top 5 deals tagged yet.</div>}
            </div>);
          })()}

          {view==="md-escalations" && isMDRole && (()=>{
            const mdEsc=deals.filter(d=>d.awaitingApproval&&["CXO","Legal","Finance"].includes(d.awaitingApproval)&&d.outcome!=="Mail Confirmed").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Items needing MD attention</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{label:"PENDING",value:mdEsc.length,color:C.orange},{label:"OVERDUE",value:mdEsc.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length,color:C.red},{label:"VALUE",value:fmtR(mdEsc.reduce((s,d)=>s+(d.amount||0),0)),color:C.accent}].map(k=>(<div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.color}}>{k.value}</div></div>))}
              </div>
              {mdEsc.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No escalations pending for MD</div>}
              {mdEsc.map(d=>{const rep=reps.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(
                <div key={d.id} style={{background:C.surface,border:`1px solid ${dw>=2?C.red+"44":C.border}`,borderLeft:`3px solid ${dw>=2?C.red:C.orange}`,borderRadius:8,padding:"14px 18px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><span className="sans" style={{fontSize:15,fontWeight:700}}>{d.clientCompany}</span><span style={{background:`${dw>=2?C.red:C.orange}22`,color:dw>=2?C.red:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{dw}d → {d.awaitingApproval}</span></div><div style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region}</div>{d.nextStep&&<div style={{fontSize:11,color:C.text,marginTop:5}}>Next: {d.nextStep}</div>}</div>
                    <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:16,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()} style={{marginTop:6,background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✓ Resolved</button></div>
                  </div>
                </div>
              );})}
            </div>);
          })()}

          {/* ══════════════ STRATEGY VIEWS ══════════════ */}
          {view==="strategy-analytics" && isStrategy && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter));
            const closed=allD.filter(d=>d.outcome==="Mail Confirmed");
            const open=allD.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome));
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totP=open.reduce((s,d)=>s+(d.amount||0),0);
            const dealTypes=[...new Set(allD.map(d=>d.dealType).filter(Boolean))];
            const typeStats=dealTypes.map(t=>{const td=allD.filter(d=>d.dealType===t);const tdRepIds=new Set(td.map(d=>d.repId));const tClosed=revenueEntries.filter(e=>tdRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);const tPipe=td.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);const pct=tT>0?Math.round((tClosed/tT)*100):0;return{t,count:td.length,tClosed,tPipe,tT,pct};}).sort((a,b)=>b.tT-a.tT);
            const stageFunnel=OUTCOMES.map(stage=>{const sd=allD.filter(d=>d.outcome===stage);return{stage,count:sd.length,value:sd.reduce((s,d)=>s+(d.amount||0),0)};}).filter(s=>s.count>0);
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ANALYTICS DASHBOARD</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · Pipeline intelligence</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[{l:"TOTAL TARGET",v:fmtR(totT),c:C.dim},{l:"CLOSED",v:fmtR(totC),c:C.green},{l:"IN PIPELINE",v:fmtR(totP),c:C.accent},{l:"WIN RATE",v:`${allD.length>0?Math.round((closed.length/allD.length)*100):0}%`,c:C.blue}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Deal Type Mix</div>
                  {typeStats.map(({t,count,tClosed,tPipe,tT,pct})=>{const sc=pct>=80?C.green:pct>=40?C.accent:C.red;return(<div key={t} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.s2}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontWeight:600,fontSize:12}}>{t||"Unspecified"}</span><span style={{fontSize:10,color:C.dim}}>{count} deals</span></div><div style={{display:"flex",gap:12,marginBottom:4}}><span style={{fontSize:10,color:C.green}}>{fmtR(tClosed)} closed</span><span style={{fontSize:10,color:C.accent}}>{fmtR(tPipe)} pipe</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:sc}} /></div><span style={{fontSize:10,fontWeight:700,color:sc,minWidth:28}}>{pct}%</span></div></div>);})}
                  {typeStats.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"20px 0"}}>No deals yet</div>}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Pipeline Funnel</div>
                  {stageFunnel.map(({stage,count,value})=>{const maxCount=Math.max(...stageFunnel.map(s=>s.count),1);return(<div key={stage} style={{marginBottom:8,display:"flex",alignItems:"center",gap:10}}><div style={{width:140,fontSize:10,color:C.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{stage}</div><div style={{flex:1,height:16,background:C.s2,borderRadius:3,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.round((count/maxCount)*100)}%`,background:`${oColor(stage)}44`}} /><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",paddingLeft:6,fontSize:9,fontWeight:600,color:oColor(stage)}}>{count} deal{count!==1?"s":""} · {fmtR(value)}</div></div></div>);})}
                </div>
              </div>
            </div>);
          })()}

          {view==="strategy-whitespace" && isStrategy && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter));
            const highValueStalled=allD.filter(d=>d.targetAmount>=5000000&&daysSince(d.lastContact)>=14&&d.outcome!=="Mail Confirmed");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WHITESPACE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>High-value accounts with no recent activity</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{l:"NO CONTACT 30D+",v:allD.filter(d=>daysSince(d.lastContact)>=30&&d.outcome!=="Mail Confirmed").length,c:C.red},{l:"HIGH-VALUE STALLED",v:highValueStalled.length,c:C.orange},{l:"VALUE AT RISK",v:fmtR(highValueStalled.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Target","Last Contact","Days Idle","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{[...highValueStalled].sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact)).map(d=>{const rep=reps.find(r=>r.id===d.repId);const idle=daysSince(d.lastContact);return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}><td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{d.lastContact||"Never"}</td><td style={{padding:"10px 14px",color:idle>=30?C.red:idle>=14?C.orange:C.dim,fontWeight:700}}>{idle}d</td><td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td></tr>);})} {highValueStalled.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No stalled high-value accounts!</td></tr>}</tbody></table></div>
            </div>);
          })()}

          {/* ══════════════ DIGI OPS VIEWS ══════════════ */}
          {/* ═══ DIGI OPS — TV + DIGITAL DEALS ═══ */}
          {view==="digi-tv-deals" && isDigiOps && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TV + DIGITAL DEALS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Integrated deals combining TV FCT with digital components</div>
              {(()=>{
                const tvDigiDeals = deals.filter(d=>d.dealType==="Integrated Packages"||d.dealType==="Media Solutions");
                if(!tvDigiDeals.length) return <div style={{textAlign:"center",padding:50,color:C.muted}}>No TV+Digital integrated deals yet.</div>;
                return tvDigiDeals.map(d=>{
                  const rep = reps.find(r=>r.id===d.repId);
                  const sc  = oColor(d.outcome);
                  return (
                    <div key={d.id} className="card" style={{padding:"14px 18px",marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div className="sans" style={{fontWeight:700,fontSize:14,marginBottom:3}}>{d.clientCompany}</div>
                          <div style={{fontSize:11,color:C.dim}}>{rep?.name} · {d.region} · {d.dealType}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className="sans" style={{fontSize:18,fontWeight:800,color:C.green}}>{fmtR(d.amount)}</div>
                          <span style={{background:`${sc}22`,color:sc,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{d.outcome}</span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                        {["TV FCT","Digital Video","Social","OTT","Display"].map(comp=>(
                          <span key={comp} style={{background:`${C.blue}12`,color:C.blue,padding:"2px 9px",borderRadius:8,fontSize:10,border:`1px dashed ${C.blue}33`}}>{comp}</span>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ═══ DIGI OPS — DIGITAL PROJECTS ═══ */}
          {view==="digi-projects" && isDigiOps && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>DIGITAL PROJECTS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Active digital production projects and campaigns</div>
              {(()=>{
                const projects = [
                  {id:"dp1",name:"Havells Digital Campaign",client:"Havells India",type:"Social + OTT",status:"In Progress",dueDate:D3,assignedTo:"Digi Ops",budget:1500000},
                  {id:"dp2",name:"Berger Paints Microsite",client:"Berger Paints",type:"Website",status:"Pending",dueDate:D7,assignedTo:"Digi Ops",budget:800000},
                  {id:"dp3",name:"ITC Programmatic Run",client:"ITC Limited",type:"Programmatic",status:"Live",dueDate:TODAY,assignedTo:"Digi Ops",budget:600000},
                ];
                const statusC = s => s==="Live"?C.green:s==="In Progress"?C.blue:s==="Pending"?C.orange:C.dim;
                return projects.map(p=>(
                  <div key={p.id} className="card" style={{padding:"14px 18px",marginBottom:10,borderLeft:`3px solid ${statusC(p.status)}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div className="sans" style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                        <div style={{fontSize:11,color:C.dim,marginTop:2}}>{p.client} · {p.type}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span style={{background:`${statusC(p.status)}22`,color:statusC(p.status),padding:"2px 9px",borderRadius:8,fontSize:11,fontWeight:700}}>{p.status}</span>
                        <div className="sans" style={{fontSize:14,fontWeight:700,color:C.accent,marginTop:4}}>{fmtR(p.budget)}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.dim}}>Due: {p.dueDate}</span>
                      <span style={{fontSize:10,color:C.dim}}>Assigned: {p.assignedTo}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {view==="digi-deals" && isDigiOps && (()=>{
            const digiDeals=deals.filter(d=>qMatch(d.quarter)&&(d.dealType==="Digital"||d.dealType==="Integrated Packages"||(d.reqs||[]).some(r=>r.dept==="Digital"))).sort((a,b)=>b.amount-a.amount);
            const blocked=digiDeals.filter(d=>d.awaitingApproval==="Digital");
            const digiTasks=tasks.filter(t=>t.dept==="Digital"&&t.status!=="Done");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>DIGITAL DEALS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · All deals with a digital component</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[{l:"TOTAL DIGITAL",v:fmtR(digiDeals.reduce((s,d)=>s+(d.amount||0),0)),c:C.blue},{l:"CLOSED",v:fmtR(revenueEntries.filter(e=>new Set(digiDeals.map(d=>d.repId)).has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0)),c:C.green},{l:"OPEN PIPELINE",v:fmtR(digiDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),c:C.accent},{l:"WAITING ON YOU",v:blocked.length,c:blocked.length>0?C.orange:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              {digiTasks.length>0&&(<div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 {digiTasks.length} Task{digiTasks.length!==1?"s":""} Assigned to Digital</div>{digiTasks.slice(0,4).map(t=>{const rep=reps.find(r=>r.id===t.repId);return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.s2,borderRadius:5,marginBottom:5}}><div style={{flex:1}}><div style={{fontWeight:600,fontSize:12}}>{t.title}</div><div style={{fontSize:10,color:C.dim}}>{t.clientCompany&&`${t.clientCompany} · `}{rep&&`from ${rep.name} · `}Due {t.dueDate}</div></div><span style={{background:t.dueDate<TODAY?`${C.red}22`:`${C.orange}18`,color:t.dueDate<TODAY?C.red:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.dueDate<TODAY?"OVERDUE":t.priority}</span><button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button></div>);})}{digiTasks.length>4&&<div style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:5}}>+{digiTasks.length-4} more · see My Tasks</div>}</div>)}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Type","Amount","Needs from Digital","Stage","Idle"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{digiDeals.length===0&&<tr><td colSpan={8} style={{padding:24,textAlign:"center",color:C.muted}}>No digital deals for {filterQ} yet</td></tr>}{digiDeals.map(d=>{const rep=reps.find(r=>r.id===d.repId);const idle=daysSince(d.lastContact);const digiReqs=(d.reqs||[]).filter(r=>r.dept==="Digital");const waitingOnUs=d.awaitingApproval==="Digital";return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:waitingOnUs?`${C.blue}06`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=waitingOnUs?`${C.blue}06`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div>{waitingOnUs&&<span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>Needs your action</span>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"9px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{d.dealType}</td><td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td><td style={{padding:"9px 12px"}}>{digiReqs.length>0?<div>{digiReqs.map((r,i)=><div key={i} style={{fontSize:10,color:C.blue}}>{r.desc}</div>)}</div>:waitingOnUs?<span style={{color:C.blue,fontSize:11}}>Approval needed</span>:<span style={{color:C.muted}}>—</span>}</td><td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td><td style={{padding:"9px 12px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11}}>{idle===0?"Today":`${idle}d`}</td></tr>);})}</tbody></table></div>
            </div>);
          })()}

          {view==="digi-tasks" && isDigiOps && (()=>{
            const myTasks=tasks.filter(t=>t.dept==="Digital").sort((a,b)=>a.dueDate>b.dueDate?1:-1);
            const overdueCount=myTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length;
            return(<div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Tasks assigned to Digital · {myTasks.length} total · {overdueCount} overdue</div></div><button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Create Task</button></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>{[{l:"OPEN",v:myTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:myTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:overdueCount,c:C.red},{l:"DONE",v:myTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {myTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No tasks assigned to Digital yet.</div>:<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Task","Client","Raised By","Priority","Status","Due","Update"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{myTasks.map(t=>{const rep=reps.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;return(<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name||t.assignedByName||"—"}</td><td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td><td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td><td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td><td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td></tr>);})}  </tbody></table></div>}
            </div>);
          })()}

          {view==="digi-escalations" && isDigiOps && (()=>{
            const digiBlocked=deals.filter(d=>d.awaitingApproval==="Digital"&&d.outcome!=="Mail Confirmed"&&d.outcome!=="Not Interested").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Deals waiting on Digital team</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>{[{l:"PENDING",v:digiBlocked.length,c:C.orange},{l:"OVERDUE (>2D)",v:digiBlocked.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=2).length,c:C.red},{l:"VALUE",v:fmtR(digiBlocked.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {digiBlocked.length===0?<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ Nothing waiting on Digital right now</div>:digiBlocked.map(d=>{const rep=reps.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(<div key={d.id} style={{background:C.surface,border:`1px solid ${dw>=2?C.red+"44":C.border}`,borderLeft:`3px solid ${dw>=2?C.red:C.orange}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><span className="sans" style={{fontSize:14,fontWeight:700}}>{d.clientCompany}</span><span style={{background:`${dw>=2?C.red:C.orange}22`,color:dw>=2?C.red:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{dw}d waiting</span></div><div style={{fontSize:11,color:C.dim,marginBottom:4}}>{rep?.name} · {d.region}</div>{d.nextStep&&<div style={{fontSize:11,color:C.text}}>Context: {d.nextStep}</div>}</div><div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}><div className="sans" style={{fontSize:15,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span><button onClick={()=>{
                                const nextApprover = d.amount >= 50000000 ? "CXO" : null;
                                setDeals(p=>p.map(x=>x.id===d.id?{...x,awaitingApproval:nextApprover,awaitingApprovalSince:nextApprover?TODAY:null}:x));
                                showToast(nextApprover ? `Approved → forwarded to CXO` : "Deal approved ✓");
                              }} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                {d.amount >= 50000000 ? "Approve → CXO" : "✓ Approve"}
                              </button></div></div>);})}
            </div>);
          })()}

          {/* ═══ RO PARSER ═══ */}

          {/* ═══ RO MANAGEMENT ═══ */}


          {/* ═══ RH DASHBOARD ═══ */}
          {view==="rh-dashboard" && isRH && (()=>{
            const myReps   = USER_ROLES.filter(u=>u.role==="SALES REP"&&u.region===rhRegion);
            const myRepIds2= myReps.map(u=>u.repId);
            const regionTarget   = targetSubs.filter(s=>myRepIds2.includes(s.repId)&&s.status==="Approved").reduce((s,t)=>s+t.totalTarget,0);
            const regionAchieved = revenueEntries.filter(e=>myRepIds2.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const regionShortfall= Math.max(0,regionTarget-regionAchieved);
            const regionPipeline = visibleDeals.filter(d=>myRepIds2.includes(d.repId)&&!["Lost","RO Received"].includes(d.outcome||"")).reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
            const notLoggedToday  = myReps.filter(u=>!(meetings||[]).some(m=>m.repId===u.repId&&m.date===TODAY));
            const notPlannedTmrw  = myReps.filter(u=>!(plans||[]).some(p=>p.repId===u.repId&&p.date===TOMORROW));
            const pendingApprovals= targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH");
            const pendingIRs      = internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval");
            const overdueActions  = tasks.filter(t=>myRepIds2.includes(t.repId)&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY);
            const stalledDeals    = visibleDeals.filter(d=>myRepIds2.includes(d.repId)&&!["Lost","RO Received"].includes(d.outcome||"")&&daysSince(d.lastContact||d.createdAt||TODAY)>=7);
            const myEscalations   = internalReqs.filter(r=>r.dept==="Region Head"&&r.status!=="Done"&&r.status!=="Withdrawn"&&USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion);
            const flags = [
              {label:"Reps not logged today",         items:notLoggedToday,    color:C.red,    icon:"⚠",
                nav:"rh-team-plan",    detail:(u:any)=>u.name,
                headerClick:()=>{setRhTeamFilter({rep:"",dateRange:"today",client:"",status:""});setView("rh-team-plan");},
                chipClick:(u:any)=>{setRhTeamFilter({rep:String(u.repId),dateRange:"today",client:"",status:""});setView("rh-team-plan");}},
              {label:"Reps not planned for tomorrow", items:notPlannedTmrw,    color:C.orange, icon:"⏰",
                nav:"rh-team-plan",    detail:(u:any)=>u.name,
                headerClick:()=>{setRhTeamFilter({rep:"",dateRange:"tomorrow",client:"",status:""});setView("rh-team-plan");},
                chipClick:(u:any)=>{setRhTeamFilter({rep:String(u.repId),dateRange:"tomorrow",client:"",status:""});setView("rh-team-plan");}},
              {label:"Target approvals pending",      items:pendingApprovals,  color:C.accent, icon:"◎",
                nav:"target-approvals", detail:(t:any)=>t.repName,
                headerClick:()=>setView("target-approvals"),
                chipClick:()=>setView("target-approvals")},
              {label:"IR approvals pending",          items:pendingIRs,        color:C.accent, icon:"⬆",
                nav:"internal-requests", detail:(r:any)=>r.subject,
                headerClick:()=>setView("internal-requests"),
                chipClick:()=>setView("internal-requests")},
              {label:"Overdue action items",          items:overdueActions,    color:C.red,    icon:"✗",
                nav:"rh-team-report",   detail:(t:any)=>t.title,
                headerClick:()=>{setRhTeamReportRep("");setView("rh-team-report");},
                chipClick:(t:any)=>{setRhTeamReportRep(String(t.repId||""));setView("rh-team-report");}},
              {label:"Stalled deals (7+ days idle)",  items:stalledDeals,      color:C.purple, icon:"⏸",
                nav:"warroom",          detail:(d:any)=>d.clientCompany,
                headerClick:()=>{setRhWarroomClient("");setRhWarroomRep("");setView("warroom");},
                chipClick:(d:any)=>{setRhWarroomClient(d.clientCompany);setRhWarroomRep(String(d.repId||""));setView("warroom");}},
              {label:"Escalated items to you",        items:myEscalations,     color:C.red,    icon:"⬆",
                nav:"rh-escalations",  detail:(r:any)=>r.subject,
                headerClick:()=>setView("rh-escalations"),
                chipClick:()=>setView("rh-escalations")},
            ].filter(f=>f.items.length>0);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>DASHBOARD</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · Real-time overview</div>
                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{TODAY}</div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:16,marginTop:10,flexWrap:"wrap"}}>
                  {[
                    {label:"TARGET",   value:fmtR(regionTarget),    color:C.accent},
                    {label:"ACHIEVED", value:fmtR(regionAchieved),  color:C.green},
                    {label:"SHORTFALL",value:fmtR(regionShortfall), color:regionShortfall>0?C.red:C.green},
                    {label:"PIPELINE", value:fmtR(regionPipeline),  color:C.blue},
                  ].map(card=>(
                    <div key={card.label} style={{flex:"1 1 100px",background:C.surface,border:`1px solid ${card.color}33`,borderLeft:`3px solid ${card.color}`,borderRadius:6,padding:"8px 12px"}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{card.label}</div>
                      <div className="sans" style={{fontSize:15,fontWeight:800,color:card.color}}>{card.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:8,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>
                  {flags.length===0?"STATUS FLAGS":`STATUS FLAGS · ${flags.length} item${flags.length!==1?"s":""} need attention`}
                </div>
                {flags.length===0&&(
                  <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",marginBottom:20}}>
                    <div style={{fontSize:22,marginBottom:8}}>✓</div>
                    <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>All clear</div>
                    <div style={{fontSize:11,color:C.dim}}>No alerts in {rhRegion} region right now.</div>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                  {flags.map((flag,fi)=>(
                    <div key={fi} style={{background:C.surface,border:`1px solid ${flag.color}33`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${flag.color}10`,borderBottom:`1px solid ${flag.color}22`,cursor:"pointer"}} onClick={flag.headerClick}>
                        <span style={{fontSize:14}}>{flag.icon}</span>
                        <span style={{fontWeight:700,fontSize:12,color:flag.color}}>{flag.label}</span>
                        <span style={{marginLeft:"auto",background:`${flag.color}22`,color:flag.color,padding:"1px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{flag.items.length}</span>
                        <span style={{fontSize:10,color:flag.color,opacity:.7}}>→</span>
                      </div>
                      <div style={{padding:"8px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                        {flag.items.slice(0,8).map((item:any,i:number)=>(
                          <span key={i} onClick={()=>flag.chipClick(item)}
                            title="Click to view →"
                            style={{background:C.s2,border:`1px solid ${flag.color}44`,borderRadius:4,padding:"3px 8px",fontSize:11,color:C.text,cursor:"pointer",transition:"background .1s"}}
                            onMouseOver={e=>(e.currentTarget.style.background=`${flag.color}18`)}
                            onMouseOut={e=>(e.currentTarget.style.background=C.s2)}>
                            {flag.detail(item)}
                          </span>
                        ))}
                        {flag.items.length>8&&<span style={{fontSize:11,color:C.muted,padding:"3px 8px"}}>+{flag.items.length-8} more</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>REP STATUS TODAY <span style={{fontSize:9,fontWeight:400,color:C.muted}}>· click any card to view their meetings</span></div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                  {myReps.map(rep=>{
                    const repId=rep.repId;
                    const loggedT  =(meetings||[]).some(m=>m.repId===repId&&m.date===TODAY);
                    const plannedT =(plans||[]).some(p=>p.repId===repId&&p.date===TOMORROW);
                    const openT    =tasks.filter(t=>t.repId===repId&&t.status!=="Done").length;
                    const achT     =revenueEntries.filter(e=>e.repId===repId&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                    const tgtT     =targetSubs.filter(s=>s.repId===repId&&s.status==="Approved").reduce((s,t)=>s+t.totalTarget,0);
                    const pctT     =tgtT>0?Math.round(achT/tgtT*100):0;
                    return (
                      <div key={rep.id}
                        onClick={()=>{setRhTeamFilter({rep:String(repId),dateRange:"today-tomorrow",client:"",status:""});setView("rh-team-plan");}}
                        style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",cursor:"pointer",transition:"border-color .12s"}}
                        onMouseOver={e=>e.currentTarget.style.borderColor=C.accent}
                        onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <div style={{width:24,height:24,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent}}>{rep.name[0]}</div>
                          <span style={{fontWeight:600,fontSize:12,flex:1}}>{rep.name}</span>
                          <span style={{fontSize:9,color:C.muted}}>›</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:10}}>
                          <span style={{color:loggedT?C.green:C.red,fontWeight:600}}>{loggedT?"✓ Logged":"✗ Not logged"}</span>
                          <span style={{color:plannedT?C.green:C.orange,fontWeight:600}}>{plannedT?"✓ Planned":"⏰ No plan"}</span>
                          <span style={{color:C.dim}}>Tasks: <strong style={{color:openT>0?C.orange:C.green}}>{openT}</strong></span>
                          <span style={{color:C.dim}}>Hit: <strong style={{color:pctT>=100?C.green:pctT>=70?C.orange:C.red}}>{pctT}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ═══ RH TEAM PLAN ═══ */}
          {view==="rh-team-plan" && isRH && (()=>{
            const myUserReps = USER_ROLES.filter(u=>u.role==="SALES REP"&&u.region===rhRegion);
            const myRepIds   = myUserReps.map(u=>u.repId);
            const tf = rhTeamFilter;
            // Build filtered plan list
            const dateRangeStart = tf.dateRange==="today"?TODAY:tf.dateRange==="tomorrow"?TOMORROW:TODAY;
            const dateRangeEnd   = tf.dateRange==="today"?TODAY:tf.dateRange==="tomorrow"?TOMORROW:tf.dateRange==="week"?SUNDAY:tf.dateRange==="month"?TODAY.slice(0,7)+"-31":"9999-12-31";
            const allTeamPlans = (plans||[]).filter(p=>myRepIds.includes(p.repId));
            const filtered = allTeamPlans.filter(p=>{
              if (tf.rep&&p.repId!==tf.rep) return false;
              if (tf.dateRange==="today-tomorrow"&&p.date!==TODAY&&p.date!==TOMORROW) return false;
              else if (tf.dateRange!=="today-tomorrow"&&(p.date<dateRangeStart||p.date>dateRangeEnd)) return false;
              if (tf.client){const cn=(p.client||p.agency||p.clientAgencyName||"").toLowerCase();if(!cn.includes(tf.client.toLowerCase()))return false;}
              if (tf.status&&p.status!==tf.status) return false;
              return true;
            }).sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:a.time>b.time?1:-1);
            const todayTP = allTeamPlans.filter(p=>p.date===TODAY);
            const tmrwTP  = allTeamPlans.filter(p=>p.date===TOMORROW);
            // Drill detail panel
            const drill = rhDrillPlan;
            const drillRep = drill ? (USER_ROLES.find(u=>u.repId===drill.repId)||reps.find(r=>r.id===drill.repId)) : null;
            const drillMtg = drill ? (meetings||[]).find(m=>m.id===drill.loggedMeetingId) : null;
            return (
              <div className="fin">
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TEAM'S MEETINGS</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {myUserReps.length} reps · visibility only</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,color:C.dim}}>{todayTP.length} today · {tmrwTP.length} tomorrow</span>
                  </div>
                </div>

                {/* Active rep filter banner — shown when navigated from dashboard/report with a pre-set rep */}
                {tf.rep&&(()=>{
                  const filterRepUser=USER_ROLES.find(u=>String(u.repId)===tf.rep)||myUserReps.find(u=>String(u.repId)===tf.rep);
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.blue}10`,border:`1.5px solid ${C.blue}44`,borderRadius:7,padding:"7px 14px",marginBottom:14,marginTop:10}}>
                      <span style={{flex:1,fontSize:12,color:C.blue,fontWeight:600}}>
                        Filtered to: <strong>{filterRepUser?.name||"Rep"}</strong>
                        {tf.dateRange&&tf.dateRange!=="today-tomorrow"&&<span style={{fontWeight:400,color:C.dim}}> · {tf.dateRange}</span>}
                      </span>
                      <button onClick={()=>setRhTeamFilter({rep:"",dateRange:"today-tomorrow",client:"",status:""})}
                        style={{background:"transparent",border:`1px solid ${C.blue}66`,borderRadius:4,padding:"3px 10px",color:C.blue,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                        × Clear filter
                      </button>
                    </div>
                  );
                })()}

                {/* Quick-glance today/tomorrow cards */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16,marginTop:14}}>
                  {[{label:"TODAY",date:TODAY,dp:todayTP},{label:"TOMORROW",date:TOMORROW,dp:tmrwTP}].map(({label,dp})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{background:C.s2,padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{label} · {dp.length} meeting{dp.length!==1?"s":""}</span>
                      </div>
                      <div style={{padding:"10px 14px",minHeight:52}}>
                        {dp.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:10}}>Nothing planned</div>}
                        {dp.slice(0,5).map(p=>{
                          const rep=USER_ROLES.find(u=>u.repId===p.repId)||reps.find(r=>r.id===p.repId);
                          return (
                            <div key={p.id} onClick={()=>setRhDrillPlan(p)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"6px 10px",background:C.s2,borderRadius:5,cursor:"pointer"}}
                              onMouseOver={e=>e.currentTarget.style.background=C.s3} onMouseOut={e=>e.currentTarget.style.background=C.s2}>
                              <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.client||p.agency||p.clientAgencyName}</div>
                                <div style={{fontSize:10,color:C.dim}}>{rep?.name} · {p.time}</div>
                              </div>
                              <span style={{background:`${p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent}18`,color:p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,flexShrink:0}}>{p.status}</span>
                            </div>
                          );
                        })}
                        {dp.length>5&&<div style={{fontSize:10,color:C.muted,textAlign:"center",padding:"4px 0"}}>+{dp.length-5} more below</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filter bar */}
                <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:".08em"}}>FILTER:</span>
                  <select value={tf.rep} onChange={e=>setRhTeamFilter(f=>({...f,rep:e.target.value}))} style={{fontSize:11,padding:"4px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface}}>
                    <option value="">All Reps</option>
                    {myUserReps.map(u=><option key={u.id} value={u.repId}>{u.name}</option>)}
                  </select>
                  <select value={tf.dateRange} onChange={e=>setRhTeamFilter(f=>({...f,dateRange:e.target.value}))} style={{fontSize:11,padding:"4px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface}}>
                    <option value="today-tomorrow">Today + Tomorrow</option>
                    <option value="today">Today only</option>
                    <option value="tomorrow">Tomorrow only</option>
                    <option value="week">This week</option>
                    <option value="all">All upcoming</option>
                  </select>
                  <input placeholder="Search client / agency…" value={tf.client} onChange={e=>setRhTeamFilter(f=>({...f,client:e.target.value}))} style={{fontSize:11,padding:"4px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,width:160}}/>
                  <select value={tf.status} onChange={e=>setRhTeamFilter(f=>({...f,status:e.target.value}))} style={{fontSize:11,padding:"4px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface}}>
                    <option value="">All Statuses</option>
                    {["Planned","Done","Cancelled","Rescheduled"].map(s=><option key={s}>{s}</option>)}
                  </select>
                  {(tf.rep||tf.client||tf.status||tf.dateRange!=="today-tomorrow")&&<button onClick={()=>setRhTeamFilter({rep:"",dateRange:"today-tomorrow",client:"",status:""})} style={{fontSize:10,color:C.red,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}>✕ Clear</button>}
                  <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{filtered.length} result{filtered.length!==1?"s":""}</span>
                </div>

                {/* Full meeting table */}
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:drill?0:0}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Agency","Client","Brand","Date","Time","Type","Stage","Status"].map(h=>(
                      <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {filtered.length===0&&<tr><td colSpan={9} style={{padding:24,textAlign:"center",color:C.muted}}>No meetings match your filter</td></tr>}
                      {filtered.map(p=>{
                        const rep=USER_ROLES.find(u=>u.repId===p.repId)||reps.find(r=>r.id===p.repId);
                        const isToday=p.date===TODAY;
                        const isSel = drill?.id===p.id;
                        return (
                          <tr key={p.id} onClick={()=>setRhDrillPlan(isSel?null:p)}
                            style={{borderBottom:`1px solid ${C.s2}`,background:isSel?`${C.accent}10`:isToday?`${C.accent}06`:"transparent",cursor:"pointer"}}
                            onMouseOver={e=>e.currentTarget.style.background=isSel?`${C.accent}10`:C.s2}
                            onMouseOut={e=>e.currentTarget.style.background=isSel?`${C.accent}10`:isToday?`${C.accent}06`:"transparent"}>
                            <td style={{padding:"8px 12px"}}><div style={{fontWeight:600}}>{rep?.name||"—"}</div></td>
                            <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{p.agency||"—"}</td>
                            <td style={{padding:"8px 12px",fontWeight:600}}>{p.client||p.clientAgencyName||"—"}</td>
                            <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{p.brand||"—"}</td>
                            <td style={{padding:"8px 12px",color:isToday?C.accent:C.dim,fontWeight:isToday?700:400,whiteSpace:"nowrap"}}>{isToday?"Today":p.date}</td>
                            <td style={{padding:"8px 12px",color:C.dim}}>{p.time||"—"}</td>
                            <td style={{padding:"8px 12px"}}>{p.pitchType?<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{p.pitchType}</span>:<span style={{color:C.muted}}>—</span>}</td>
                            <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{p.stage||"—"}</td>
                            <td style={{padding:"8px 12px"}}><span style={{background:p.status==="Done"?`${C.green}22`:p.status==="Cancelled"?`${C.red}22`:`${C.accent}18`,color:p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{p.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Drill-down detail panel */}
                {drill&&(
                  <div style={{background:C.surface,border:`2px solid ${C.accent}`,borderRadius:8,padding:"16px 18px",marginTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div className="sans" style={{fontWeight:700,fontSize:13,color:C.accent}}>MEETING DETAIL</div>
                      <button onClick={()=>setRhDrillPlan(null)} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16,padding:0}}>✕</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                      {[
                        {l:"Rep",      v:drillRep?.name||"—"},
                        {l:"Agency",   v:drill.agency||"—"},
                        {l:"Client",   v:drill.client||drill.clientAgencyName||"—"},
                        {l:"Brand",    v:drill.brand||"—"},
                        {l:"Contact",  v:drill.contactName||"—"},
                        {l:"Phone",    v:drill.phone||"—"},
                        {l:"Date",     v:drill.date===TODAY?"Today":drill.date},
                        {l:"Time",     v:drill.time||"—"},
                        {l:"Type",     v:`${drill.pitchType||"—"} · ${drill.meetingType||"Physical"}`},
                      ].map(f=>(
                        <div key={f.l}>
                          <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{f.l}</div>
                          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{f.v}</div>
                        </div>
                      ))}
                    </div>
                    {drill.agenda&&<div style={{marginBottom:10}}><div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>Agenda</div><div style={{fontSize:12,color:C.text}}>{drill.agenda}</div></div>}
                    {/* Show logged meeting info if available */}
                    {drillMtg&&(
                      <div style={{background:C.s2,borderRadius:6,padding:"10px 14px",marginTop:8}}>
                        <div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>✓ Meeting Logged</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {drillMtg.discussion&&<div><div style={{fontSize:9,color:C.muted,fontWeight:600,marginBottom:2}}>Discussion</div><div style={{fontSize:11}}>{drillMtg.discussion}</div></div>}
                          {drillMtg.outcome&&<div><div style={{fontSize:9,color:C.muted,fontWeight:600,marginBottom:2}}>Stage Update</div><div style={{fontSize:11,fontWeight:700,color:C.blue}}>{drillMtg.outcome}</div></div>}
                          {drillMtg.nextStep&&<div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.muted,fontWeight:600,marginBottom:2}}>Next Step</div><div style={{fontSize:11}}>{drillMtg.nextStep}</div></div>}
                          {(drillMtg.actionRequired||[]).length>0&&(
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:9,color:C.muted,fontWeight:600,marginBottom:4}}>Action Required</div>
                              {drillMtg.actionRequired.map((a:any,i:number)=>(
                                <div key={i} style={{fontSize:11,color:C.text,marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${C.accent}`}}>
                                  <strong>{a.what}</strong>{a.from?` → ${a.from}`:""}  {a.byWhen&&<span style={{color:C.red}}> · by {a.byWhen}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ MY TASKS (Region Head / NSH) ═══ */}
          {view==="my-tasks" && (isRH||isNSH) && (()=>{
            const myRepIds = isRH ? reps.filter(r=>r.region===rhRegion).map(r=>r.id) : reps.map(r=>r.id);
            const myActionTasks = tasks.filter(t=>t.dept==="NSH"&&t.status!=="Done"&&myRepIds.includes(t.repId));
            const myAssignedTasks = tasks.filter(t=>t.assignedToUserId===activeUser);
            const allMine = [...myAssignedTasks, ...myActionTasks.filter(t=>!myAssignedTasks.find(x=>x.id===t.id))];
            const openCount=allMine.filter(t=>t.status!=="Done").length;
            const doneCount=allMine.filter(t=>t.status==="Done").length;
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>MY TASKS</div>
                    <div style={{fontSize:11,color:C.dim}}>{openCount} open · {doneCount} done · Tasks assigned to you or created by you</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-primary" onClick={openSelfTask}>+ Create Task</button>
                    <button className="btn btn-primary" onClick={()=>setTaskModal(true)}
                      style={{background:C.blue,borderColor:C.blue}}>+ Assign to Rep</button>
                  </div>
                </div>

                {/* Summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[
                    {label:"OPEN",       value:allMine.filter(t=>t.status==="Open").length,                      color:C.blue},
                    {label:"IN PROGRESS",value:allMine.filter(t=>t.status==="In Progress").length,               color:C.accent},
                    {label:"OVERDUE",    value:allMine.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,      color:C.red},
                    {label:"DONE",       value:doneCount,                                                         color:C.green},
                  ].map(k=>(
                    <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {allMine.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No tasks yet. Create one for yourself above.</div>}
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  {allMine.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      {["Task","Client","From","Priority","Status","Due","Update"].map(h=>(
                        <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {allMine.sort((a,b)=>a.status==="Done"?1:b.status==="Done"?-1:a.dueDate>b.dueDate?1:-1).map(t=>{
                        const assigner = t.assignedBy ? USER_ROLES.find(u=>u.id===t.assignedBy)||reps.find(r=>r.id===t.assignedBy) : null;
                        const fromLabel = t.assignedBy===activeUser ? "Me" : assigner?.name || t.assignedByName || "—";
                        const overdue=t.dueDate<TODAY&&t.status!=="Done";
                        const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (
                          <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent",opacity:t.status==="Done"?.6:1}}
                            onMouseOver={e=>e.currentTarget.style.background=overdue?`${C.red}08`:C.s2}
                            onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                            <td style={{padding:"10px 14px"}}><div style={{fontWeight:700,textDecoration:t.status==="Done"?"line-through":"none"}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:220,whiteSpace:"normal",lineHeight:1.4}}>{t.description}</div>}</td>
                            <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                            <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{fromLabel}</td>
                            <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                            <td style={{padding:"10px 14px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                            <td style={{padding:"10px 14px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                            <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                              {t.status!=="Done"&&(
                                <select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))}
                                  style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,marginRight:4}}>
                                  {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                </select>
                              )}
                              {t.status==="Done"&&<span style={{color:C.green,fontSize:11}}>✓ Done</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>}
                </div>
              </div>
            );
          })()}

          {/* ═══ RH TEAM PIPELINE ═══ */}
          {view==="rh-team-pipeline" && isRH && (()=>{
            const myReps=reps.filter(r=>r.region===rhRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · All rep deals</div></div>
                </div>
                {myReps.map(rep=>{
                  const rd=visibleDeals.filter(d=>d.repId===rep.id&&d.outcome!=="Not Interested");
                  if(!rd.length) return null;
                  const rC=revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rP=rd.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+d.amount,0);
                  return (
                    <div key={rep.id} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{rep.name}</span>
                        <span style={{fontSize:11,color:C.dim}}>{rd.length} deals</span>
                        <span style={{color:C.green,fontWeight:600,fontSize:11,marginLeft:"auto"}}>{fmtR(rC)} closed</span>
                        <span style={{color:C.accent,fontSize:11}}>{fmtR(rP)} pipeline</span>
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {rd.sort((a,b)=>b.amount-a.amount).map(d=>(
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                                onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                <td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:180}}>{d.nextStep||"—"}</td>
                                <td style={{padding:"9px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ RH TEAM TARGETS ═══ — same as RH targets but labelled for Team */}
          {view==="rh-team-targets" && isRH && view==="rh-team-targets" && (()=>{
            const myReps=reps.filter(r=>r.region===rhRegion);
            const rhT=visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhRepIds_tm=[...new Set(myReps.map(r=>r.id))];
            const rhC=revenueEntries.filter(e=>rhRepIds_tm.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const rhPct=rhT>0?Math.round((rhC/rhT)*100):0;
            const sc=rhPct>=80?C.green:rhPct>=50?C.accent:C.red;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM TARGETS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · {filterQ}</div>
                <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"16px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>Region Total</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                    {[["TARGET",fmtR(rhT),C.text],["CLOSED",fmtR(rhC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0)),C.accent],["GAP",fmtR(Math.max(0,rhT-rhC)),rhC>=rhT?C.green:C.red]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:sc,lineHeight:1}}>{rhPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                  </div>
                  <div style={{marginTop:10,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rhPct,100)}%`,background:sc,borderRadius:3}} /></div>
                </div>
                {rhRepDrill ? (()=>{
                  const rep=reps.find(r=>r.id===rhRepDrill);
                  const rd=visibleDeals.filter(d=>d.repId===rhRepDrill);
                  return (
                    <div>
                      <button onClick={()=>setRhRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginBottom:12}}>← Back to Reps</button>
                      <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:10}}>{rep?.name} · Client List</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{rd.map(d=>{const ach=revenueEntries.filter(e=>e.repId===d.repId&&((d.zohoAccountId&&e.zohoAccountId&&d.zohoAccountId===e.zohoAccountId)||e.clientCompany===d.clientCompany)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);const sf=Math.max(0,(d.targetAmount||0)-ach);return(
                            <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"9px 12px",fontWeight:700}}>{d.clientCompany}</td>
                              <td style={{padding:"9px 12px"}}>{fmtR(d.targetAmount)}</td>
                              <td style={{padding:"9px 12px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}</td>
                              <td style={{padding:"9px 12px",color:C.accent}}>{fmtR(!["Mail Confirmed","Not Interested"].includes(d.outcome)?d.amount:0)}</td>
                              <td style={{padding:"9px 12px",color:sf===0?C.green:C.red,fontWeight:600}}>{sf===0?"✓":fmtR(sf)}</td>
                              <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                            </tr>
                          );})}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                    {myReps.map(rep=>{
                      const rd=visibleDeals.filter(d=>d.repId===rep.id);
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rsc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (
                        <div key={rep.id} onClick={()=>setRhRepDrill(rep.id)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s,transform .1s"}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div className="sans" style={{fontWeight:700}}>{rep.name}</div>
                            <div className="sans" style={{fontSize:20,fontWeight:800,color:rsc}}>{rPct}%</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                            {[["Target",fmtR(rT)],["Closed",fmtR(rC)]].map(([l,v])=>(
                              <div key={l} style={{background:C.s2,borderRadius:4,padding:"5px 8px"}}>
                                <div style={{fontSize:9,color:C.dim}}>{l}</div>
                                <div className="sans" style={{fontSize:13,fontWeight:700,color:l==="Closed"?C.green:C.text}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:rsc}} /></div>
                          <div style={{fontSize:9,color:C.dim,marginTop:5,textAlign:"right"}}>Click to see clients →</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH TEAM TASKS ═══ */}
          {view==="rh-team-tasks" && isRH && (()=>{
            const myRepIds=reps.filter(r=>r.region===rhRegion).map(r=>r.id);
            const teamTasks=tasks.filter(t=>myRepIds.includes(t.repId));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · All rep tasks</div></div>
                  <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Assign Task</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"OPEN",v:teamTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:teamTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:teamTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:teamTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {teamTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No tasks for your team yet.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Task","Client","Priority","Status","Due","Action"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{teamTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{rep?.name||"—"}</div></td>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                          <td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                          <td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH TEAM HR ═══ */}
          {view==="rh-team-hr" && isRH && (()=>{
            const myRepIds=reps.filter(r=>r.region===rhRegion).map(r=>r.id);
            const teamAbs=absenceReports.filter(r=>myRepIds.includes(r.repId));
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · All rep absence records</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"TOTAL ABSENCES",v:teamAbs.filter(r=>r.markedAs==="Absent").length,c:C.red},{l:"EXCEPTIONS",v:teamAbs.filter(r=>r.exception==="Overridden").length,c:C.orange},{l:"REPORTS SENT",v:teamAbs.length,c:C.dim}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {teamAbs.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No absence records for your team.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Date","Status","Exception","Notes"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{teamAbs.map(r=>(
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px",fontWeight:600}}>{r.repName}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                          <td style={{padding:"9px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception} · by {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{r.exceptionReason||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ RH MY HR ═══ */}
          {view==="rh-my-hr" && isRH && (()=>{
            // RH has no repId — use userId (activeUser) as their identifier throughout
            const myPlanRepId = user_role?.id; // "rh_north", "rh_south", etc.
            const myAbs       = absenceReports.filter((r:any)=>r.userId===activeUser||(r.repId!=null&&r.repId===user_role?.repId));
            const absentDays  = myAbs.filter((r:any)=>r.markedAs==="Absent").length;
            const exceptions  = myAbs.filter((r:any)=>r.exception==="Overridden").length;
            const sentToHR    = myAbs.filter((r:any)=>r.status==="Sent to HR").length;
            // RH logs meetings with loggedByUserId; plans stored with repId = their userId string
            const loggedToday = (meetings||[]).some(m=>m.loggedByUserId===activeUser&&m.date===TODAY);
            const plannedTmrw = (plans||[]).some(p=>p.repId===myPlanRepId&&p.date===TOMORROW);
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>MY HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Your own attendance and compliance record</div>
                <div className="card" style={{padding:"14px 16px",marginBottom:16,borderLeft:`3px solid ${loggedToday?C.green:C.red}`}}>
                  <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>TODAY'S LOG</div>
                      <div style={{fontWeight:700,fontSize:14,color:loggedToday?C.green:C.red}}>{loggedToday?"✓ Meeting logged":"✗ No meeting logged yet"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>TOMORROW'S PLAN</div>
                      <div style={{fontWeight:700,fontSize:14,color:plannedTmrw?C.green:C.orange}}>{plannedTmrw?"✓ Meeting planned":"⏰ Nothing scheduled"}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[
                    {l:"TOTAL RECORDS", v:myAbs.length,  c:C.dim},
                    {l:"ABSENT DAYS",   v:absentDays,    c:absentDays>0?C.red:C.green},
                    {l:"EXCEPTIONS",    v:exceptions,    c:C.orange},
                    {l:"SENT TO HR",    v:sentToHR,      c:C.accent},
                  ].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {/* RH compliance history: show last 30 working days based on logged meetings */}
                {(()=>{
                  // Build a 30-day compliance history for RH from meeting logs
                  const rhMeetings = (meetings||[]).filter(m=>m.loggedByUserId===activeUser||m.loggedByUserId===myPlanRepId);
                  const rhPlans    = (plans||[]).filter(p=>p.repId===myPlanRepId);
                  const checkDays: string[] = [];
                  for (let d = 0; d < 30; d++) {
                    const dt = new Date(Date.now() - d * 86400000);
                    const dow = dt.getDay(); // 0=Sun, 6=Sat
                    if (dow === 0) continue; // skip Sundays
                    checkDays.push(dt.toISOString().split("T")[0]);
                  }
                  const rows2 = checkDays.map(day => {
                    const logged  = rhMeetings.some(m=>m.date===day);
                    const planned = rhPlans.some(p=>p.date===day);
                    const late    = rhMeetings.filter(m=>m.date===day&&m.loggedLate).length > 0;
                    return {day, logged, planned, late};
                  });
                  const loggedDays = rows2.filter(r=>r.logged).length;
                  const missedDays = rows2.filter(r=>r.day<TODAY&&!r.logged).length;
                  const lateDays   = rows2.filter(r=>r.late).length;
                  const hitPct     = checkDays.filter(d=>d<TODAY).length > 0
                    ? Math.round(loggedDays / Math.max(1, checkDays.filter(d=>d<=TODAY).length) * 100) : 100;
                  return (
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                        {[
                          {l:"DAYS LOGGED (30d)",  v:loggedDays,    c:C.green},
                          {l:"DAYS MISSED",        v:missedDays,    c:missedDays>0?C.red:C.green},
                          {l:"LATE LOGS",          v:lateDays,      c:lateDays>0?C.orange:C.green},
                          {l:"COMPLIANCE %",       v:`${hitPct}%`,  c:hitPct>=90?C.green:hitPct>=70?C.orange:C.red},
                        ].map(k=>(
                          <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                            <div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>LAST 30 WORKING DAYS</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Date","Day","Logged?","Planned?","Late?"].map(h=>(
                            <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                          ))}</tr></thead>
                          <tbody>{rows2.map(r=>{
                            const dow2 = new Date(r.day+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short"});
                            return (
                              <tr key={r.day} style={{borderBottom:`1px solid ${C.s2}`,background:(!r.logged&&r.day<TODAY)?`${C.red}04`:"transparent"}}>
                                <td style={{padding:"8px 12px",fontWeight:600,color:r.day===TODAY?C.accent:C.text}}>{r.day}{r.day===TODAY?" (today)":""}</td>
                                <td style={{padding:"8px 12px",color:C.dim}}>{dow2}</td>
                                <td style={{padding:"8px 12px"}}><span style={{color:r.logged?C.green:r.day<TODAY?C.red:C.muted,fontWeight:700}}>{r.logged?"✓ Yes":r.day<TODAY?"✗ No":"—"}</span></td>
                                <td style={{padding:"8px 12px"}}><span style={{color:r.planned?C.green:C.muted,fontWeight:600}}>{r.planned?"✓":"—"}</span></td>
                                <td style={{padding:"8px 12px"}}>{r.late?<span style={{color:C.orange,fontWeight:700}}>⚠ Late</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                      {myAbs.length>0&&(
                        <div style={{marginTop:16}}>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>EXCEPTION / ABSENCE RECORDS</div>
                          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <thead><tr>{["Date","Status","Exception","Approved By","Notes"].map(h=>(
                                <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}</tr></thead>
                              <tbody>{[...myAbs].sort((a:any,b:any)=>b.date>a.date?1:-1).map((r:any)=>(
                                <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}}>
                                  <td style={{padding:"8px 12px",fontWeight:600}}>{r.date}</td>
                                  <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                                  <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception}</span>:<span style={{color:C.muted}}>—</span>}</td>
                                  <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.exceptionBy||"—"}</td>
                                  <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.exceptionReason||"—"}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ═══ RH TEAM REPORT ═══ */}
          {view==="rh-team-report" && isRH && (()=>{
            const myReps   = USER_ROLES.filter(u=>u.role==="SALES REP"&&u.region===rhRegion);
            const rows = myReps.map(rep=>{
              const repId       = rep.repId;
              const target      = targetSubs.filter(s=>s.repId===repId&&s.status==="Approved").reduce((s:number,t:any)=>s+t.totalTarget,0);
              const achieved    = revenueEntries.filter(e=>e.repId===repId&&qMatch(e.quarter)).reduce((s:number,e:any)=>s+(e.amount||0),0);
              const shortfall   = Math.max(0,target-achieved);
              const pct         = target>0?Math.round(achieved/target*100):0;
              const pipeline    = visibleDeals.filter(d=>d.repId===repId&&!["Lost","RO Received"].includes(d.outcome||"")).reduce((s:number,d:any)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
              const mtgsThisWk  = (meetings||[]).filter(m=>m.repId===repId&&m.date>=MONDAY&&m.date<=TODAY).length;
              const loggedToday = (meetings||[]).some(m=>m.repId===repId&&m.date===TODAY);
              const plannedTmrw = (plans||[]).some(p=>p.repId===repId&&p.date===TOMORROW);
              const openTasks   = tasks.filter(t=>t.repId===repId&&t.status!=="Done").length;
              const overdueTasks= tasks.filter(t=>t.repId===repId&&t.status!=="Done"&&t.dueDate&&t.dueDate<TODAY).length;
              const escCount    = internalReqs.filter(r=>r.repId===repId&&r.status!=="Done"&&r.status!=="Withdrawn"&&(r.escLevel>0||r.status==="Overdue")).length;
              return {rep,repId,target,achieved,shortfall,pct,pipeline,mtgsThisWk,loggedToday,plannedTmrw,openTasks,overdueTasks,escCount};
            });
            const totTarget   = rows.reduce((s,r)=>s+r.target,0);
            const totAchieved = rows.reduce((s,r)=>s+r.achieved,0);
            const totPipeline = rows.reduce((s,r)=>s+r.pipeline,0);
            const totOverdue  = rows.reduce((s,r)=>s+r.overdueTasks,0);
            // Filter table rows when navigated from overdue items chip
            const displayRows = rhTeamReportRep ? rows.filter(r=>String(r.repId)===rhTeamReportRep) : rows;
            const filterRepName = rhTeamReportRep ? (USER_ROLES.find(u=>String(u.repId)===rhTeamReportRep)||myReps.find(u=>String(u.repId)===rhTeamReportRep))?.name : "";
            return (
              <div className="fin">
                {/* Active rep filter banner */}
                {rhTeamReportRep&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.red}08`,border:`1.5px solid ${C.red}33`,borderRadius:7,padding:"7px 14px",marginBottom:14}}>
                    <span style={{flex:1,fontSize:12,color:C.red,fontWeight:600}}>
                      Filtered to rep: <strong>{filterRepName||"Rep"}</strong> <span style={{fontWeight:400,color:C.dim}}>· navigated from overdue action items</span>
                    </span>
                    <button onClick={()=>setRhTeamReportRep("")}
                      style={{background:"transparent",border:`1px solid ${C.red}66`,borderRadius:4,padding:"3px 10px",color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      × Show all reps
                    </button>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TEAM REPORT</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {filterQ} · {myReps.length} rep{myReps.length!==1?"s":""}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {[
                    {label:"TOTAL TARGET",   value:fmtR(totTarget),   color:C.accent},
                    {label:"TOTAL ACHIEVED", value:fmtR(totAchieved), color:C.green},
                    {label:"TOTAL PIPELINE", value:fmtR(totPipeline), color:C.blue},
                    {label:"OVERDUE TASKS",  value:totOverdue,         color:totOverdue>0?C.red:C.green},
                  ].map(c=>(
                    <div key={c.label} className="card" style={{padding:"12px 14px",borderTop:`2px solid ${c.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{c.label}</div>
                      <div className="sans" style={{fontSize:20,fontWeight:700,color:c.color}}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Target","Achieved","Hit%","Pipeline","Mtgs (wk)","Today","Tmrw","Tasks","Overdue","Esc","View"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {displayRows.length===0&&<tr><td colSpan={12} style={{padding:24,textAlign:"center",color:C.muted}}>No reps in {rhRegion} region</td></tr>}
                      {displayRows.map(row=>(
                        <tr key={row.repId}
                          style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                          onClick={()=>{setRhTeamFilter({rep:String(row.repId),dateRange:"today-tomorrow",client:"",status:""});setView("rh-team-plan");}}
                          onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=""}>
                          <td style={{padding:"10px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent}}>{row.rep.name[0]}</div>
                              <span style={{fontWeight:600}}>{row.rep.name}</span>
                            </div>
                          </td>
                          <td style={{padding:"10px 12px",color:C.dim}}>{row.target>0?fmtR(row.target):"—"}</td>
                          <td style={{padding:"10px 12px",fontWeight:600,color:row.achieved>0?C.green:C.muted}}>{row.achieved>0?fmtR(row.achieved):"—"}</td>
                          <td style={{padding:"10px 12px"}}>
                            <span style={{background:row.pct>=100?`${C.green}22`:row.pct>=70?`${C.orange}18`:`${C.red}18`,color:row.pct>=100?C.green:row.pct>=70?C.orange:C.red,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{row.target>0?`${row.pct}%`:"—"}</span>
                          </td>
                          <td style={{padding:"10px 12px",color:C.blue}}>{row.pipeline>0?fmtR(row.pipeline):"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:C.dim,fontWeight:600}}>{row.mtgsThisWk}</td>
                          <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{color:row.loggedToday?C.green:C.red,fontSize:16}}>{row.loggedToday?"✓":"✗"}</span></td>
                          <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{color:row.plannedTmrw?C.green:C.orange,fontSize:16}}>{row.plannedTmrw?"✓":"⏰"}</span></td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:600,color:row.openTasks>0?C.orange:C.green}}>{row.openTasks}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:600,color:row.overdueTasks>0?C.red:C.green}}>{row.overdueTasks||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontWeight:700,color:row.escCount>0?C.red:C.green}}>{row.escCount||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:C.blue,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>View ›</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ════════════════════════════════════════════
              NSH VIEWS
          ════════════════════════════════════════════ */}

          {/* ═══ NSH MY PLAN (read-only for CRO / Strategy) ═══ */}
          {view==="nsh-myplan" && isNSHDashboard && (()=>{
            const nshPlansToday  = (plans||[]).filter(p=>(!p.repId)&&p.date===TODAY);
            const nshPlansTmrw   = (plans||[]).filter(p=>(!p.repId)&&p.date===TOMORROW);
            const nshMeetings    = (meetings||[]).filter(m=>!m.repId).slice().sort((a,b)=>b.date?.localeCompare(a.date||"")||0);
            const recentMonths   = [...new Set(nshMeetings.map(m=>m.date?.slice(0,7)))].sort().reverse().slice(0,4);

            const allToday  = (plans||[]).filter(p=>p.date===TODAY);
            const allTmrw   = (plans||[]).filter(p=>p.date===TOMORROW);
            const totalMeetings = (meetings||[]).length;

            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>NSH'S PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:20}}>National Sales Head planned meetings — read-only view</div>

                {/* Summary stat cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {[
                    {label:"NSH Planned Today",   val:nshPlansToday.length,  color:C.accent},
                    {label:"NSH Planned Tomorrow", val:nshPlansTmrw.length,   color:C.blue},
                    {label:"Org-wide Today",       val:allToday.length,       color:C.green},
                    {label:"Total Org Meetings",   val:totalMeetings,         color:C.orange},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color}}>{val}</div>
                      <div style={{fontSize:10,color:C.dim,marginTop:4}}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* NSH Today and Tomorrow */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  {[{label:"TODAY",list:nshPlansToday},{label:"TOMORROW",list:nshPlansTmrw}].map(({label,list})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{background:C.s2,padding:"8px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{label}</span>
                        <span style={{fontSize:11,color:C.accent,fontWeight:700}}>{list.length} meetings</span>
                      </div>
                      <div style={{padding:12,minHeight:60}}>
                        {list.length===0&&<div style={{textAlign:"center",fontSize:11,color:C.muted,padding:"18px 0"}}>Nothing planned by NSH</div>}
                        {list.map(p=>(
                          <div key={p.id} style={{padding:"8px 10px",background:C.s2,borderRadius:6,marginBottom:6,borderLeft:`3px solid ${C.accent}`}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.clientAgencyName}</div>
                            <div style={{fontSize:10,color:C.dim,marginTop:2}}>{p.time||"—"} · {p.pitchType||"Meeting"} · {p.meetingType||"Physical"}</div>
                            {p.agenda&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{p.agenda}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* NSH Recent Meeting History */}
                <div style={{height:1,background:C.border,marginBottom:16}} />
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:12}}>NSH MEETING HISTORY</div>
                {recentMonths.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:11,padding:40}}>No meetings logged by NSH yet.</div>}
                {recentMonths.map(ym=>{
                  const ms = nshMeetings.filter(m=>m.date?.startsWith(ym));
                  const [yr,mo] = ym.split("-");
                  const label = new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
                  return (
                    <div key={ym} style={{marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"5px 10px",background:C.s2,borderRadius:5,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:12}}>{label}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{ms.length} meetings</span>
                      </div>
                      {ms.map(m=>(
                        <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,marginBottom:5}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{m.clientCompany}</div>
                            <div style={{fontSize:10,color:C.dim,marginTop:2}}>{m.date} · {m.pitchType||"—"}</div>
                            {m.discussion&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{m.discussion}</div>}
                          </div>
                          <span style={{background:m.outcome==="Mail Confirmed"?`${C.green}22`:`${C.blue}18`,color:m.outcome==="Mail Confirmed"?C.green:C.blue,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{m.outcome||m.status}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH PLAN ═══ */}
          {view==="nsh-rh-plan" && isNSHDashboard && (()=>{
            const regions = REGIONS;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>REGION HEADS' PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Today and tomorrow — region by region</div>

                {/* Two-column: today left, tomorrow right */}
                {regions.map(region=>{
                  const rReps   = reps.filter(r=>r.region===region).map(r=>r.id);
                  const todayP  = (plans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TODAY);
                  const tmrwP   = (plans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TOMORROW);
                  if (!todayP.length && !tmrwP.length) return null;
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      {/* Region label */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{reps.filter(r=>r.region===region).length} reps</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{todayP.length} today · {tmrwP.length} tomorrow</span>
                      </div>
                      {/* Two halves */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        {[{label:"TODAY",list:todayP},{label:"TOMORROW",list:tmrwP}].map(({label,list})=>(
                          <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                            <div style={{background:C.s2,padding:"6px 12px",borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em"}}>{label} · {list.length} meetings</div>
                            <div style={{padding:"8px 12px",minHeight:50}}>
                              {list.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"10px 0"}}>Nothing planned</div>}
                              {list.map(p=>{
                                const rep=reps.find(r=>r.id===p.repId);
                                return (
                                  <div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:7,paddingBottom:7,borderBottom:`1px solid ${C.s2}`}}>
                                    <div style={{width:20,height:20,borderRadius:"50%",background:`${C.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.clientAgencyName}</div>
                                      <div style={{fontSize:10,color:C.dim}}>{rep?.name} · {p.time||"—"}</div>
                                      {p.agenda&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{p.agenda}</div>}
                                    </div>
                                    {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.pitchType}</span>}
                                    <span style={{background:p.status==="Done"?`${C.green}22`:`${C.blue}18`,color:p.status==="Done"?C.green:C.blue,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.status}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH REGIONAL PLAN ═══ */}
          {view==="nsh-regional-plan" && isNSHDashboard && (()=>{
            const regions = REGIONS;
            const [selRegion, setSelRegion] = [nshRegion, setNshRegion];
            const displayRegions = selRegion==="all" ? regions : [selRegion];
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>SALES REPS' PLAN</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Today's client meetings · region by region</div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {["all",...regions].map(r=>(
                      <button key={r} onClick={()=>setSelRegion(r)}
                        style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${selRegion===r?C.accent:C.border}`,background:selRegion===r?`${C.accent}18`:"transparent",color:selRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                        {r==="all"?"All":r}
                      </button>
                    ))}
                  </div>
                </div>

                {displayRegions.map(region=>{
                  const rReps = reps.filter(r=>r.region===region);
                  const rRepIds = rReps.map(r=>r.id);
                  // Get today's deals with plans logged
                  const regionDeals = deals.filter(d=>d.region===region&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
                  const todayMtgs   = meetings.filter(m=>reps.find(r=>r.id===m.repId&&r.region===region)&&m.date===TODAY);
                  const todayPlanned= (plans||[]).filter(p=>rRepIds.includes(p.repId)&&p.date===TODAY);
                  const tmrwPlanned = (plans||[]).filter(p=>rRepIds.includes(p.repId)&&p.date===TOMORROW);
                  return (
                    <div key={region} style={{marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 14px",background:C.s2,borderRadius:7,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{rReps.length} reps · {todayPlanned.length} today · {tmrwPlanned.length} tomorrow</span>
                        <span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:600}}>
                          {fmtR(revenueEntries.filter(e=>rRepIds.includes(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0))} closed
                        </span>
                      </div>

                      {/* Client-centric table for region */}
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>
                            {["Client","Rep","Last Meeting","Meeting Status","Next Step","Pipeline Stage"].map(h=>(
                              <th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {regionDeals.length===0&&<tr><td colSpan={6} style={{padding:20,textAlign:"center",color:C.muted,fontSize:11}}>No deals for {region} in {filterQ}</td></tr>}
                            {regionDeals.sort((a,b)=>b.amount-a.amount).map(d=>{
                              const rep  = reps.find(r=>r.id===d.repId);
                              const lastM= meetings.filter(m=>m.repId===d.repId&&(m.clientCompany||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5))).sort((a,b)=>b.date>a.date?1:-1)[0];
                              const todayHasMeeting = todayPlanned.some(p=>p.repId===d.repId&&(p.clientAgencyName||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5)));
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:todayHasMeeting?`${C.green}04`:"transparent"}}
                                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                  onMouseOut={e=>e.currentTarget.style.background=todayHasMeeting?`${C.green}04`:"transparent"}>
                                  <td style={{padding:"9px 12px"}}>
                                    <div style={{fontWeight:700}}>{d.clientCompany}</div>
                                    {d.contactName&&<div style={{fontSize:10,color:C.dim}}>{d.contactName}</div>}
                                    {todayHasMeeting&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>Meeting today</span>}
                                  </td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{lastM?lastM.date:"No meeting yet"}</td>
                                  <td style={{padding:"9px 12px"}}>{lastM?.status?<span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{lastM.status}</span>:<span style={{color:C.muted}}>—</span>}</td>
                                  <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                                  <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Tomorrow's planned meetings for this region */}
                      {tmrwPlanned.length>0&&(
                        <div style={{marginTop:8,background:C.surface,border:`1px solid ${C.accent}33`,borderRadius:7,overflow:"hidden"}}>
                          <div style={{padding:"6px 12px",background:`${C.accent}08`,borderBottom:`1px solid ${C.accent}22`,fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>
                            TOMORROW's PLANNED MEETINGS · {tmrwPlanned.length}
                          </div>
                          <div style={{padding:"8px 12px",display:"flex",flexWrap:"wrap",gap:6}}>
                            {tmrwPlanned.map(p=>{
                              const rep=reps.find(r=>r.id===p.repId);
                              return (
                                <div key={p.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 10px",fontSize:11}}>
                                  <span style={{fontWeight:600}}>{p.clientAgencyName}</span>
                                  <span style={{color:C.dim}}> · {rep?.name}</span>
                                  {p.time&&<span style={{color:C.muted}}> @ {p.time}</span>}
                                  {p.pitchType&&<span style={{marginLeft:4,background:`${C.accent}18`,color:C.accent,padding:"0px 5px",borderRadius:3,fontSize:9,fontWeight:600}}>{p.pitchType}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH SCORECARD ═══ */}
          {view==="nsh-rh-scorecard" && isNSHDashboard && (()=>{
            const RH_USERS=USER_ROLES.filter(u=>u.role==="REGION HEAD");
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>REGION HEAD SCORECARD</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{filterQ} · How each region is performing</div>
                {RH_USERS.map((rhu,rank)=>{
                  const rd=deals.filter(d=>d.region===rhu.region&&qMatch(d.quarter));
                  const rhRepIdSet=new Set(rd.map(d=>d.repId));
                  const rC=revenueEntries.filter(e=>rhRepIdSet.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver=rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Mail Confirmed").length;
                  const rBlocked=rd.filter(d=>d.awaitingApproval&&d.outcome!=="Mail Confirmed").length;
                  const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const rankColor=rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rhu.id} className="card" style={{padding:16,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:15,fontWeight:700}}>{rhu.region} Region</span>
                            <span style={{fontSize:11,color:C.dim}}>{reps.filter(r=>r.region===rhu.region).length} reps · {rd.length} deals</span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["AT RISK",rRisk,rRisk>0?C.red:C.green]].map(([l,v,c])=>(
                              <div key={l} style={{background:C.s2,borderRadius:5,padding:"7px 10px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".06em",marginBottom:2}}>{l}</div>
                                <div className="sans" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rRisk} at risk</span>}
                            {rOver>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rOver} overdue</span>}
                            {rBlocked>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>{rBlocked} awaiting approval</span>}
                            {rRisk===0&&rOver===0&&<span style={{background:`${C.green}18`,color:C.green,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:600}}>✓ On track</span>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:56}}><div className="sans" style={{fontSize:32,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH PIPELINE ═══ */}
          {view==="nsh-rh-pipeline" && isNSHDashboard && (()=>{
            const regions=REGIONS;
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Pipeline grouped by region · {filterQ}</div></div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setNshRHDrill(null)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${!nshRHDrill?C.accent:C.border}`,background:!nshRHDrill?`${C.accent}18`:"transparent",color:!nshRHDrill?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>All Regions</button>
                    {regions.map(r=><button key={r} onClick={()=>setNshRHDrill(r)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${nshRHDrill===r?C.accent:C.border}`,background:nshRHDrill===r?`${C.accent}18`:"transparent",color:nshRHDrill===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r}</button>)}
                  </div>
                </div>
                {(nshRHDrill?[nshRHDrill]:regions).map(region=>{
                  const rd=deals.filter(d=>d.region===region&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
                  const blocked=rd.filter(d=>d.awaitingApproval);
                  const rdRepIds2=new Set(rd.map(d=>d.repId));
                  const rdClosed=revenueEntries.filter(e=>rdRepIds2.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:11,color:C.dim}}>{rd.length} deals</span>
                        <span style={{color:C.green,fontWeight:600,fontSize:11,marginLeft:"auto"}}>{fmtR(rdClosed)} closed</span>
                        <span style={{color:C.accent,fontSize:11}}>{fmtR(rd.filter(d=>d.outcome!=="Mail Confirmed").reduce((s,d)=>s+d.amount,0))} pipeline</span>
                        {blocked.length>0&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{blocked.length} blocked</span>}
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Rep","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {rd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=reps.find(r=>r.id===d.repId);return(
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"8px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                <td style={{padding:"8px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                <td style={{padding:"8px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                <td style={{padding:"8px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                                <td style={{padding:"8px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                              </tr>
                            );})}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH RH TARGETS ═══ */}
          {view==="nsh-rh-targets" && isNSHDashboard && (()=>{
            const regions=REGIONS;
            const totT=deals.filter(d=>qMatch(d.quarter)).reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=revenueEntries.filter(e=>qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            const totPct=totT>0?Math.round((totC/totT)*100):0;
            const tsc=totPct>=80?C.green:totPct>=50?C.accent:C.red;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RH TARGETS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:14}}>{filterQ} · Region-wise performance</div>
                <div style={{background:C.surface,border:`2px solid ${tsc}`,borderRadius:10,padding:"16px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>National Total</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                    {[["TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["ACHIEVEMENT",`${totPct}%`,tsc]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:tsc,lineHeight:1}}>{totPct}%</div></div>
                  </div>
                  <div style={{marginTop:10,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(totPct,100)}%`,background:tsc}} /></div>
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Region","Target","Closed","Pipeline","Achieve %","Reps","At Risk"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>{regions.map(region=>{
                      const rd=deals.filter(d=>d.region===region&&qMatch(d.quarter));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rRegionRepIds=new Set(rd.map(d=>d.repId));
                      const rC=revenueEntries.filter(e=>rRegionRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                      const nReps=reps.filter(r=>r.region===region).length;
                      const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return(<tr key={region} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{region}</div></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(rT)}</td>
                        <td style={{padding:"10px 14px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                        <td style={{padding:"10px 14px",color:C.accent}}>{fmtR(rP)}</td>
                        <td style={{padding:"10px 14px"}}><span style={{color:sc,fontWeight:700,fontSize:13}}>{rPct}%</span></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{nReps}</td>
                        <td style={{padding:"10px 14px"}}>{rRisk>0?<span style={{color:C.red,fontWeight:700}}>{rRisk} ⚠</span>:<span style={{color:C.green}}>✓</span>}</td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH RH TASKS ═══ */}
          {view==="nsh-rh-tasks" && isNSHDashboard && (()=>{
            const rhTasks=tasks.filter(t=>t.dept==="NSH"||t.assignedToUserId?.startsWith("rh_"));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Tasks assigned to / escalated from Region Heads</div></div>
                  <button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Assign to RH</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                  {[{l:"OPEN",v:rhTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:rhTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:rhTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:rhTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {rhTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim,fontSize:12}}>No RH tasks yet.</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Task","Client","Region","Priority","Status","Due","Update"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{rhTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?reps.find(r=>r.id===rep.id)?.region:"—"}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                          <td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                          <td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ NSH RH HR ═══ */}
          {view==="nsh-rh-hr" && isNSHDashboard && (()=>{
            const REGIONS = ["North","South","East","West","National"];
            const rhUsers = USER_ROLES.filter(u=>u.role==="REGION HEAD");
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RH'S HR REPORTS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Absence summary per Region Head's team · all regions</div>

                {/* Region summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
                  {REGIONS.map(reg=>{
                    const rh   = rhUsers.find(u=>u.region===reg);
                    const reps = reps.filter(r=>r.region===reg);
                    const rAbs = absenceReports.filter(a=>reps.map(r=>r.id).includes(a.repId));
                    const absent = rAbs.filter(a=>a.markedAs==="Absent").length;
                    const exc    = rAbs.filter(a=>a.exception==="Overridden").length;
                    return (
                      <div key={reg} style={{background:C.surface,border:`1px solid ${absent>0?C.red:C.border}`,borderTop:`2px solid ${absent>0?C.red:C.green}`,borderRadius:8,padding:"12px 14px"}}>
                        <div className="sans" style={{fontWeight:700,fontSize:13,marginBottom:2}}>{reg}</div>
                        <div style={{fontSize:10,color:C.dim,marginBottom:8}}>{rh?.name||"RH"} · {reps.length} reps</div>
                        <div style={{fontSize:10,color:C.red,fontWeight:700}}>{absent} absent</div>
                        <div style={{fontSize:10,color:C.green}}>{exc} exception{exc!==1?"s":""}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-region breakdown */}
                {REGIONS.map(reg=>{
                  const reps = reps.filter(r=>r.region===reg);
                  const rAbs = absenceReports.filter(a=>reps.map(r=>r.id).includes(a.repId));
                  if (!rAbs.length) return null;
                  const rh = rhUsers.find(u=>u.region===reg);
                  return (
                    <div key={reg} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{reg}</span>
                        <span style={{fontSize:10,color:C.dim}}>RH: {rh?.name||"—"}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.dim}}>{rAbs.length} records · {rAbs.filter(a=>a.markedAs==="Absent").length} absent</span>
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Rep","Date","Status","Exception"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{rAbs.map(r=>(
                            <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"8px 12px",fontWeight:600}}>{r.repName}</td>
                              <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                              <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                              <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>Overridden · {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {absenceReports.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted,fontSize:12}}>No absence records across all regions.</div>}
              </div>
            );
          })()}

          {/* ═══ NSH REP SCORECARD ═══ */}
          {view==="nsh-rep-scorecard" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const filterDeals=nshRegion==="all"?deals.filter(d=>qMatch(d.quarter)):deals.filter(d=>d.region===nshRegion&&qMatch(d.quarter));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP SCORECARD</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All reps · {filterQ}</div></div>
                  <div style={{display:"flex",gap:6}}>
                    {regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"capitalize"}}>{r==="all"?"All":r}</button>)}
                  </div>
                </div>
                {reps.filter(r=>nshRegion==="all"||r.region===nshRegion).map((rep,rank)=>{
                  const rd=filterDeals.filter(d=>d.repId===rep.id);
                  const rC=revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const tL=meetings.some(m=>m.repId===rep.id&&m.date===TODAY);
                  const tP=(plans||[]).some(p=>p.repId===rep.id&&p.date===TOMORROW);
                  const rankColor=rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rep.id} className="card" style={{padding:14,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:26,height:26,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:14,fontWeight:700}}>{rep.name}</span>
                            <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{rep.region}</span>
                            <span style={{background:tL?`${C.green}18`:`${C.red}18`,color:tL?C.green:C.red,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{tL?"✓ Logged":"✗ Not logged"}</span>
                            <span style={{background:tP?`${C.green}18`:`${C.orange}18`,color:tP?C.green:C.orange,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{tP?"✓ Planned":"✗ Not planned"}</span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:6}}>
                            {[["TARGET",fmtR(rT),C.dim],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["ACHIEVE",`${rPct}%`,sc],["AT RISK",rRisk,rRisk>0?C.red:C.green]].map(([l,v,c])=>(
                              <div key={l} style={{background:C.s2,borderRadius:4,padding:"6px 8px"}}>
                                <div style={{fontSize:9,color:C.dim,letterSpacing:".05em",marginBottom:1}}>{l}</div>
                                <div className="sans" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {rRisk>0&&<span style={{background:`${C.red}18`,color:C.red,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:600,marginRight:6}}>{rRisk} at risk</span>}
                        </div>
                        <div style={{textAlign:"right",minWidth:50}}><div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:9,color:C.dim}}>achieved</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ NSH REP PIPELINE ═══ */}
          {view==="nsh-rep-pipeline" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fd=nshRegion==="all"?deals.filter(d=>qMatch(d.quarter)&&d.outcome!=="Not Interested"):deals.filter(d=>d.region===nshRegion&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep deals · {filterQ}</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div className="card" style={{overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Client","Rep","Region","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {fd.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No deals found</td></tr>}
                      {fd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=reps.find(r=>r.id===d.repId);return(
                        <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.region}</span></td>
                          <td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td>
                          <td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11,maxWidth:160}}>{d.nextStep||"—"}</td>
                          <td style={{padding:"9px 12px"}}>{d.awaitingApproval?<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.awaitingApproval}</span>:<span style={{color:C.muted}}>—</span>}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH REP TARGETS ═══ */}
          {view==="nsh-rep-targets" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fReps=nshRegion==="all"?reps:reps.filter(r=>r.region===nshRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP TARGETS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Individual targets · {filterQ}</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Region","Target","Closed","Pipeline","Shortfall","Achieve %"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>{fReps.map(rep=>{
                      const rd=deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                      const rP=rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rG=Math.max(0,rT-rC);const rPct=rT>0?Math.round((rC/rT)*100):0;const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (<tr key={rep.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"10px 14px"}}><div style={{fontWeight:700}}>{rep.name}</div></td>
                        <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600}}>{rep.region}</span></td>
                        <td style={{padding:"10px 14px",color:C.dim}}>{fmtR(rT)}</td>
                        <td style={{padding:"10px 14px",color:C.green,fontWeight:600}}>{fmtR(rC)}</td>
                        <td style={{padding:"10px 14px",color:C.accent}}>{fmtR(rP)}</td>
                        <td style={{padding:"10px 14px",color:rG===0?C.green:C.red,fontWeight:600}}>{rG===0?"✓":fmtR(rG)}</td>
                        <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,background:C.s3,borderRadius:3,overflow:"hidden",minWidth:60}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:sc}} /></div><span style={{color:sc,fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>{rPct}%</span></div></td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ NSH REP TASKS ═══ */}
          {view==="nsh-rep-tasks" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fReps=nshRegion==="all"?reps.map(r=>r.id):reps.filter(r=>r.region===nshRegion).map(r=>r.id);
            const fTasks=tasks.filter(t=>fReps.includes(t.repId));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep tasks</div></div>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}
                    <button className="btn btn-primary" onClick={()=>setTaskModal(true)} style={{marginLeft:6}}>+ Assign Task</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                  {[{l:"OPEN",v:fTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:fTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:fTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length,c:C.red},{l:"DONE",v:fTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {fTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No tasks found</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Region","Task","Client","Priority","Status","Due"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{fTasks.sort((a,b)=>a.dueDate>b.dueDate?1:-1).map(t=>{
                        const rep=reps.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"8px 12px",fontWeight:600,fontSize:11}}>{rep?.name||"—"}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{rep?.region||"—"}</span></td>
                          <td style={{padding:"8px 12px"}}><div style={{fontWeight:600}}>{t.title}</div></td>
                          <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td>
                          <td style={{padding:"8px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ NSH REP HR ═══ */}
          {view==="nsh-rep-hr" && isNSHDashboard && (()=>{
            const regions=["all",...REGIONS];
            const fAbs=nshRegion==="all"?absenceReports:absenceReports.filter(r=>r.region===nshRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP HR REPORTS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All rep absence records</div></div>
                  <div style={{display:"flex",gap:5}}>{regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{r==="all"?"All":r}</button>)}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[{l:"TOTAL ABSENCES",v:fAbs.filter(r=>r.markedAs==="Absent").length,c:C.red},{l:"EXCEPTIONS",v:fAbs.filter(r=>r.exception==="Overridden").length,c:C.orange},{l:"REPORTS SENT",v:fAbs.length,c:C.dim}].map(k=>(
                    <div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
                {fAbs.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No absence records</div>:(
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr>{["Rep","Region","Date","Status","Exception"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>{fAbs.map(r=>(
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}} onClick={()=>{setAccountThreadClient(d.clientCompany);setAccountThreadOpen(true);}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"8px 12px",fontWeight:600}}>{r.repName}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region}</span></td>
                          <td style={{padding:"8px 12px",color:C.dim,fontSize:11}}>{r.date}</td>
                          <td style={{padding:"8px 12px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                          <td style={{padding:"8px 12px"}}>{r.exception?<span style={{color:C.green,fontSize:11}}>{r.exception} · {r.exceptionBy}</span>:<span style={{color:C.muted}}>—</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}


          {/* ═══ RO PARSER (CROApp) ═══ */}
          {view==="ro-parser" && (
            <div>
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RO PARSER</div>
                <div style={{fontSize:11,color:C.dim}}>Upload any agency Release Order — PDF, Excel, image, CSV or paste text. Exports Zoho-ready sheets.</div>
              </div>

              {/* Upload area */}
              <div className="card" style={{padding:18,marginBottom:16}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Upload Files</div>
                    <div
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
                      onChange={e=>setRoFiles(p=>[...p,...Array.from(e.target.files)])} />
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

          {/* ═══ RO MANAGEMENT (CROApp) ═══ */}
          {view==="ro-management" && (
            <div>
              <div style={{marginBottom:16}}>
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>RO MANAGEMENT</div>
                <div style={{fontSize:11,color:C.dim}}>All parsed and exported Release Orders. Search, filter, re-export or delete.</div>
              </div>

              {/* Stats strip */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"TOTAL ROs",    value:savedROs.length,                                                color:C.blue},
                  {label:"TOTAL VALUE",  value:roFmtMoney(savedROs.reduce((s,r)=>s+(r.total_payable||0),0)),  color:C.green},
                  {label:"EXPORTED",     value:savedROs.filter(r=>r.exportedAt).length,                       color:C.accent},
                  {label:"CHANNELS",     value:[...new Set(savedROs.map(r=>r.channel).filter(Boolean))].length,color:C.dim},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                    <div className="sans" style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <input placeholder="Search client, agency, RO number..."
                  value={roSearch} onChange={e=>setRoSearch(e.target.value)}
                  style={{flex:1,minWidth:200,background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none"}} />
                <select value={roMgmtChannel} onChange={e=>setRoMgmtChannel(e.target.value)}
                  style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                  <option value="all">All Channels</option>
                  {[...new Set(savedROs.map(r=>r.channel).filter(Boolean))].map(ch=><option key={ch}>{ch}</option>)}
                </select>
              </div>

              {savedROs.length===0?(
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:40,textAlign:"center",color:C.muted}}>
                  <div style={{fontSize:28,marginBottom:8}}>📋</div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>No saved ROs yet</div>
                  <div style={{fontSize:11}}>Parse and export an RO from the RO Parser tab to see it here.</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {savedROs
                    .filter(r=>{
                      const q=roSearch.toLowerCase();
                      const channelOk=roMgmtChannel==="all"||r.channel===roMgmtChannel;
                      const searchOk=!q||(r.client_name||"").toLowerCase().includes(q)||(r.agency_name||"").toLowerCase().includes(q)||(r.ro_number||"").toLowerCase().includes(q);
                      return channelOk&&searchOk;
                    })
                    .map(r=>(
                      <div key={r.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                              <span className="sans" style={{fontSize:14,fontWeight:700}}>{r.client_name}</span>
                              {r.brand_name&&<span style={{color:C.dim,fontSize:12}}>· {r.brand_name}</span>}
                              {r.channel&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:600}}>{r.channel}</span>}
                              {r.ro_number&&<span style={{color:C.muted,fontSize:11}}>#{r.ro_number}</span>}
                            </div>
                            <div style={{fontSize:11,color:C.dim,display:"flex",gap:16,flexWrap:"wrap"}}>
                              {r.agency_name&&<span>{r.agency_name}</span>}
                              {r.ro_date&&<span>{r.ro_date}</span>}
                              {r.total_payable>0&&<span style={{color:C.green,fontWeight:600}}>{roFmtMoney(r.total_payable)}</span>}
                              <span style={{color:C.muted}}>Saved {new Date(r.savedAt).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button
                              onClick={()=>{if(roMgmtViewRO===r.id)setRoMgmtViewRO(null);else setRoMgmtViewRO(r.id);}}
                              style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              {roMgmtViewRO===r.id?"Hide":"View"}
                            </button>
                            <button
                              onClick={()=>r.result&&roExportSingle(r.result)}
                              style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              Export
                            </button>
                            <button
                              onClick={()=>setRoMgmtConfirmDelete(r.id)}
                              style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:5,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {roMgmtViewRO===r.id&&r.result&&(
                          <div style={{marginTop:12}}>
                            <ROCard result={r.result} onExport={()=>roExportSingle(r.result)} />
                          </div>
                        )}
                        {roMgmtConfirmDelete===r.id&&(
                          <div style={{marginTop:10,background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:12,color:C.red,flex:1}}>Delete this RO permanently?</span>
                            <button onClick={()=>{setSavedROs(p=>p.filter(x=>x.id!==r.id));setRoMgmtConfirmDelete(null);}} style={{background:`${C.red}22`,border:"none",color:C.red,borderRadius:4,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Yes, Delete</button>
                            <button onClick={()=>setRoMgmtConfirmDelete(null)} style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* ═══ RH LEADERBOARD — cross-region scorecard for Region Heads ═══ */}
          {view==="rh-xscore" && isRH && (()=>{
            const myRepId = user_role?.repId;
            const rhList = USER_ROLES.filter(u=>u.role==="REGION HEAD");
            const rhScores = rhList.map((rhu,rank)=>{
              const rd  = deals.filter(d=>d.region===rhu.region&&qMatch(d.quarter));
              const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rhScoreRepIds=new Set(rd.map(d=>d.repId));
              const rC  = revenueEntries.filter(e=>rhScoreRepIds.has(e.repId)&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const isMe = rhu.region===user_role?.region;
              return {...rhu, rT, rC, rPct, isMe};
            }).sort((a,b)=>b.rPct-a.rPct);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RH LEADERBOARD</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>How your region stands vs other Region Heads · {filterQ}</div>
                </div>
                {rhScores.map((rhu,rank)=>{
                  const sc = rhu.rPct>=80?C.green:rhu.rPct>=50?C.accent:C.red;
                  const rankColor = rank===0?"#fbbf24":rank===1?"#94a3b8":rank===2?"#b45309":C.muted;
                  return (
                    <div key={rhu.id} style={{background:rhu.isMe?`${C.accent}08`:C.surface,border:`1px solid ${rhu.isMe?C.accent:C.border}`,borderLeft:`3px solid ${rhu.isMe?C.accent:sc}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:rankColor,flexShrink:0}}>
                        {rank===0?"🥇":rank===1?"🥈":rank===2?"🥉":`#${rank+1}`}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <span className="sans" style={{fontWeight:700,fontSize:14,color:rhu.isMe?C.accent:C.text}}>{rhu.region} Region</span>
                          {rhu.isMe&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOUR REGION</span>}
                        </div>
                        <div style={{height:5,background:C.s3,borderRadius:3,overflow:"hidden",maxWidth:260}}>
                          <div style={{height:"100%",width:`${Math.min(rhu.rPct,100)}%`,background:sc,borderRadius:3,transition:"width .6s"}} />
                        </div>
                      </div>
                      <div style={{textAlign:"right",minWidth:70}}>
                        <div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rhu.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:2}}>of target</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:12,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not displayed
                </div>
              </div>
            );
          })()}

          {/* ═══ REP ALL-REPS SCORECARD ═══ */}
          {view==="rep-allreps" && isRep && (()=>{
            const myRepId  = user_role?.repId;
            const allReps  = reps.map(rep=>{
              const rd   = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rC   = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const isMe = rep.id===myRepId;
              return {...rep, rPct, isMe};
            }).sort((a,b)=>b.rPct-a.rPct);

            const myRank = allReps.findIndex(r=>r.isMe);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ALL SALES REPS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Where you stand across the entire sales team · {filterQ}</div>
                </div>

                {/* Your rank callout */}
                {myRank>=0&&(
                  <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:28,fontWeight:800,color:C.accent,lineHeight:1}}>#{myRank+1}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>Your rank out of {allReps.length} sales reps</div>
                      <div style={{fontSize:11,color:C.dim,marginTop:2}}>{allReps[myRank]?.rPct}% achieved · {allReps[myRank]?.region} region</div>
                    </div>
                  </div>
                )}

                {allReps.map((rep,rank)=>{
                  const sc = rep.rPct>=80?C.green:rep.rPct>=50?C.accent:C.red;
                  const rankColor = rank===0?"#fbbf24":rank===1?"#94a3b8":rank===2?"#b45309":C.muted;
                  return (
                    <div key={rep.id} style={{background:rep.isMe?`${C.accent}08`:C.surface,border:`1px solid ${rep.isMe?C.accent:C.border}`,borderLeft:`3px solid ${rep.isMe?C.accent:sc}`,borderRadius:7,padding:"12px 16px",marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>
                        {rank===0?"🥇":rank===1?"🥈":rank===2?"🥉":`#${rank+1}`}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                          <span className="sans" style={{fontWeight:700,fontSize:13,color:rep.isMe?C.accent:C.text}}>{rep.name}</span>
                          <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{rep.region}</span>
                          {rep.isMe&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOU</span>}
                        </div>
                        <div style={{height:4,background:C.s3,borderRadius:2,overflow:"hidden",maxWidth:200}}>
                          <div style={{height:"100%",width:`${Math.min(rep.rPct,100)}%`,background:sc,borderRadius:2,transition:"width .6s"}} />
                        </div>
                      </div>
                      <div style={{textAlign:"right",minWidth:60}}>
                        <div className="sans" style={{fontSize:24,fontWeight:800,color:sc,lineHeight:1}}>{rep.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:1}}>of target</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:12,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not visible
                </div>
              </div>
            );
          })()}

          {/* ═══ REP TEAM SCORECARD ═══ */}
          {view==="rep-team" && isRep && (()=>{
            const myRepId   = user_role?.repId;
            const myRegion  = user_role?.region;
            // Show all reps in same region, sorted by % achieved
            const teammates = reps.filter(r => r.region === myRegion)
              .map(rep => {
                const rd  = deals.filter(d => d.repId === rep.id && d.quarter === filterQ);
                const rT  = rd.reduce((s,d) => s + (d.targetAmount||0), 0);
                const rC  = rd.filter(d => d.outcome === "Mail Confirmed").reduce((s,d) => s + d.amount, 0);
                const rPct = rT > 0 ? Math.round((rC / rT) * 100) : 0;
                const isMe = rep.id === myRepId;
                return { ...rep, rPct, isMe };
              })
              .sort((a,b) => b.rPct - a.rPct);

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM SCORECARD</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{myRegion} Region · {filterQ} · Achievement %</div>
                </div>

                {teammates.map((rep, rank) => {
                  const sc = rep.rPct >= 80 ? C.green : rep.rPct >= 50 ? C.accent : C.red;
                  const rankColor = rank === 0 ? "#fbbf24" : rank === 1 ? "#94a3b8" : rank === 2 ? "#b45309" : C.muted;
                  return (
                    <div key={rep.id} style={{
                      background: rep.isMe ? `${C.accent}08` : C.surface,
                      border: `1px solid ${rep.isMe ? C.accent : C.border}`,
                      borderLeft: `3px solid ${rep.isMe ? C.accent : sc}`,
                      borderRadius: 8,
                      padding: "14px 18px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}>
                      {/* Rank medal */}
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: `${rankColor}22`, border: `1px solid ${rankColor}55`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: rankColor, flexShrink: 0,
                      }}>
                        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank+1}`}
                      </div>

                      {/* Name */}
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span className="sans" style={{fontWeight:700,fontSize:14,color:rep.isMe?C.accent:C.text}}>
                            {rep.name}
                          </span>
                          {rep.isMe && (
                            <span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700}}>YOU</span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div style={{marginTop:6,height:5,background:C.s3,borderRadius:3,overflow:"hidden",maxWidth:220}}>
                          <div style={{height:"100%",width:`${Math.min(rep.rPct,100)}%`,background:sc,borderRadius:3,transition:"width .6s"}} />
                        </div>
                      </div>

                      {/* % only — no revenue */}
                      <div style={{textAlign:"right",minWidth:64}}>
                        <div className="sans" style={{fontSize:28,fontWeight:800,color:sc,lineHeight:1}}>{rep.rPct}%</div>
                        <div style={{fontSize:9,color:C.dim,marginTop:2}}>of target</div>
                      </div>
                    </div>
                  );
                })}

                <div style={{marginTop:14,padding:"10px 14px",background:C.s2,borderRadius:6,fontSize:11,color:C.dim,textAlign:"center"}}>
                  Showing achievement % only · Revenue figures are not visible here
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* ASSIGN TASK MODAL */}
      {taskModal && (() => {
        const closeTaskModal = () => { setTaskModal(false); setSelfTaskMode(false); setTaskForm(BLANK_TASK_FORM); };
        const modalTitle = selfTaskMode ? "Create Task for Myself" : isRep ? "Create Task" : "Assign Task";
        // For reps in non-self mode: default assignee is themselves (can override)
        const repDefaultUserId = (isRep && !selfTaskMode && !taskForm.assignedToUserId) ? (user_role?.id || "") : "";
        return (
        <div className="overlay" onClick={closeTaskModal}>
          <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:500}}>
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:4}}>{modalTitle}</div>
            {selfTaskMode&&<div style={{fontSize:11,color:C.dim,marginBottom:14}}>This task will appear in your My Tasks</div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* Assignee — locked to self when selfTaskMode, or full picker otherwise */}
              {selfTaskMode ? (
                <div>
                  <label>Assigned To</label>
                  <input readOnly value={(user_role?.name||"Me")+" (You)"} style={{color:C.text,background:C.s2,cursor:"default"}} />
                </div>
              ) : (
                <div><label>{isRep ? "Assign to (default: yourself)" : "Assign to *"}</label>
                  <select value={taskForm.assignedToUserId || repDefaultUserId} onChange={e=>setTaskForm(p=>({...p,assignedToUserId:e.target.value}))}>
                    <option value="">— Select person —</option>
                    <optgroup label="Leadership &amp; Strategy">
                      {USER_ROLES.filter(u=>["ADMIN","SALES HEAD","SALES STRATEGY","CRO","DIGI OPS"].includes(u.role)).map(u=>(
                        <option key={u.id} value={u.id}>{u.id===activeUser?"Me — "+u.name:u.name} · {u.role}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Region Heads">
                      {USER_ROLES.filter(u=>u.role==="REGION HEAD").map(u=>(
                        <option key={u.id} value={u.id}>{u.id===activeUser?"Me — "+u.name:u.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Sales Reps">
                      {USER_ROLES.filter(u=>u.role==="SALES REP").map(u=>(
                        <option key={u.id} value={u.id}>{u.id===activeUser?"Me — "+u.name:u.name} · {u.region}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}
              <div><label>Task *</label><input placeholder="What needs to happen?" value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))} /></div>
              <div><label>Related Client (optional)</label><input placeholder="Which client is this about?" value={taskForm.clientCompany} onChange={e=>setTaskForm(p=>({...p,clientCompany:e.target.value}))} /></div>
              <div><label>Details</label><textarea rows={3} placeholder="Add context or instructions..." value={taskForm.description} onChange={e=>setTaskForm(p=>({...p,description:e.target.value}))} style={{resize:"none"}} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label>Priority</label>
                  <select value={taskForm.priority} onChange={e=>setTaskForm(p=>({...p,priority:e.target.value}))}>
                    {TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}
                  </select></div>
                <div><label>Due Date</label><input type="date" min="2020-01-01" max="2099-12-31" value={taskForm.dueDate} onChange={e=>setTaskForm(p=>({...p,dueDate:e.target.value}))} /></div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={closeTaskModal}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>{
                const assignedUserId = taskForm.assignedToUserId || (isRep&&user_role?.id?user_role.id:"");
                if(!assignedUserId||!taskForm.title){showToast("Task title and assignee required","err");return;}
                const assignedUser = USER_ROLES.find(u=>u.id===assignedUserId);
                const repId = assignedUser?.repId||null;
                const taskDept = assignedUser?.role==="DIGI OPS"?"Digital"
                  :assignedUser?.role==="SALES HEAD"?"NSH"
                  :assignedUser?.role==="SALES STRATEGY"?"Sales Strategy"
                  :assignedUser?.role==="CRO"?"CRO"
                  :assignedUser?.role==="REGION HEAD"?"Region Head"
                  :null;
                setTasks(p=>[{id:`t${Date.now()}`,...taskForm,dept:taskDept,assignedToUserId:assignedUserId,assignedToName:assignedUser?.name||"",assignedTo:repId,repId:repId,assignedBy:activeUser,assignedByName:user_role?.name||user.name,status:"Open",createdAt:TODAY},...p]);
                closeTaskModal();
                showToast(assignedUserId===activeUser?"✓ Task created for yourself":"Task assigned to "+(assignedUser?.name||""));
              }}>{selfTaskMode?"Create Task":isRep?"Create Task":"Assign Task"}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── PLAN UPLOAD MODAL (managers only) ── */}
      {planUploadOpen && !isRep && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>{if(e.target===e.currentTarget)setPlanUploadOpen(false);}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:580,maxWidth:"95vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.55)"}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div className="sans" style={{fontWeight:700,fontSize:16,letterSpacing:.5}}>UPLOAD PLAN FOR REP</div>
                <div style={{fontSize:11,color:C.dim,marginTop:4}}>
                  This plan enters the approval chain at{" "}
                  <span style={{fontWeight:700,color:C.accent}}>{isRH?"NSH level":isNSH?"Sales Strategy level":isStrategy?"CRO level":isCRORole?"final approval (auto-approved)":"NSH level"}</span>.
                  Once fully approved, it shows in the rep's My Targets.
                </div>
              </div>
              <button onClick={()=>setPlanUploadOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1,marginLeft:12}}>✕</button>
            </div>
            {/* Approval chain visual */}
            <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:18,flexWrap:"wrap"}}>
              {(isRH
                ?[{s:"RH",done:true},{s:"NSH",done:false},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
                :isNSH
                ?[{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:false},{s:"CRO → ✓",done:false}]
                :isStrategy
                ?[{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:false}]
                :[{s:"RH",done:true},{s:"NSH",done:true},{s:"Strategy",done:true},{s:"CRO → ✓",done:true}]
              ).map((step,i,arr)=>(
                <div key={step.s} style={{display:"flex",alignItems:"center"}}>
                  <div style={{background:step.done?`${C.green}22`:`${C.accent}18`,border:`1px solid ${step.done?C.green+"55":C.accent+"44"}`,borderRadius:6,padding:"3px 10px",fontSize:10,color:step.done?C.green:C.accent,fontWeight:600,whiteSpace:"nowrap"}}>{step.done&&"✓ "}{step.s}</div>
                  {i<arr.length-1&&<div style={{width:14,height:1,background:C.border}}/>}
                </div>
              ))}
            </div>
            {/* Rep + Quarter */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div>
                <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>SALES REP *</div>
                {reps.filter(r=>isRH?r.region===user_role?.region:true).length===0
                  ? <div style={{padding:"9px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}`,borderRadius:6,color:C.orange,fontSize:12}}>No reps added yet — ask Admin to add reps first.</div>
                  : <select value={planUploadForm.repId} onChange={e=>setPlanUploadForm(p=>({...p,repId:e.target.value}))}
                    style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:planUploadForm.repId?C.text:C.muted,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                    <option value="">Select rep…</option>
                    {reps.filter(r=>isRH?r.region===user_role?.region:true).map(r=><option key={r.id} value={r.id}>{r.name} · {r.region}</option>)}
                  </select>
                }
              </div>
              <div>
                <div style={{fontSize:10,color:C.dim,marginBottom:5,letterSpacing:".05em",fontWeight:700}}>QUARTER *</div>
                <select value={planUploadForm.quarter} onChange={e=>setPlanUploadForm(p=>({...p,quarter:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                  {QUARTERS.map(q=><option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            {/* Client rows */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.dim,marginBottom:8,letterSpacing:".05em",fontWeight:700}}>CLIENT TARGETS</div>
              {planUploadForm.clients.map((cl,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.4fr 1.2fr auto",gap:8,marginBottom:7,alignItems:"center"}}>
                  {(()=>{
                    const val=cl.clientCompany.trim();
                    const offList=val.length>0&&clientMasterList.length>0&&!clientMasterList.some(n=>n.toLowerCase()===val.toLowerCase());
                    return <input list="cm-list" value={cl.clientCompany} placeholder={clientMasterList.length>0?"Search client list…":`Client ${i+1} name`}
                      onChange={e=>setPlanUploadForm(p=>({...p,clients:p.clients.map((c,j)=>j===i?{...c,clientCompany:e.target.value}:c)}))}
                      style={{padding:"8px 10px",background:C.s2,border:`1px solid ${offList?C.orange:C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}} title={offList?`"${val}" not in approved client list`:undefined}/>;
                  })()}
                  <select value={cl.dealType}
                    onChange={e=>setPlanUploadForm(p=>({...p,clients:p.clients.map((c,j)=>j===i?{...c,dealType:e.target.value}:c)}))}
                    style={{padding:"8px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                    {["Linear TV","IPs","Digital","Media Solutions","Integrated Packages"].map(d=><option key={d}>{d}</option>)}
                  </select>
                  <input value={cl.targetAmount} placeholder="Target e.g. 50L"
                    onChange={e=>setPlanUploadForm(p=>({...p,clients:p.clients.map((c,j)=>j===i?{...c,targetAmount:e.target.value}:c)}))}
                    style={{padding:"8px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                  {planUploadForm.clients.length>1
                    ? <button onClick={()=>setPlanUploadForm(p=>({...p,clients:p.clients.filter((_,j)=>j!==i)}))}
                        style={{background:`${C.red}18`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:4,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",lineHeight:1}}>✕</button>
                    : <div style={{width:36}}/>}
                </div>
              ))}
              <button onClick={()=>setPlanUploadForm(p=>({...p,clients:[...p.clients,{clientCompany:"",dealType:"Linear TV",targetAmount:""}]}))}
                style={{background:`${C.blue}18`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:2}}>
                + Add Client
              </button>
            </div>
            {/* Footer */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,color:C.muted}}>
                {(()=>{
                  const valid = planUploadForm.clients.filter(c=>c.clientCompany.trim()&&c.targetAmount);
                  const total = valid.reduce((s,c)=>s+parseCurrency(c.targetAmount),0);
                  return valid.length>0?`${valid.length} client${valid.length!==1?"s":""} · ${fmtR(total)} total`:"Add at least one client";
                })()}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setPlanUploadOpen(false)}
                  style={{padding:"9px 18px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                <button onClick={()=>{
                  const parsedRepId = parseInt(planUploadForm.repId);
                  const validClients = planUploadForm.clients.filter(c=>c.clientCompany.trim()&&c.targetAmount);
                  if(!parsedRepId){showToast("Select a sales rep","err");return;}
                  if(!validClients.length){showToast("Add at least one client with a target","err");return;}
                  const rep = reps.find(r=>r.id===parsedRepId);
                  const initStatus = isRH?"Pending NSH":isNSH?"Pending Strategy":isStrategy?"Pending CRO":isCRORole?"Approved":"Pending NSH";
                  const steps = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO"];
                  const startIdx = steps.indexOf(initStatus);
                  const skipLog  = steps.slice(0,startIdx).map(step=>({step,by:user_role?.name||"",at:TODAY,note:`Plan uploaded by ${user_role?.role}`}));
                  const clients  = validClients.map(c=>({clientCompany:c.clientCompany.trim(),dealType:c.dealType,targetAmount:parseCurrency(c.targetAmount)}));
                  const total    = clients.reduce((s,c)=>s+(c.targetAmount||0),0);
                  const sub = {
                    id:`ts${Date.now()}`,
                    repId:parsedRepId,repName:rep?.name||"",region:rep?.region||"",
                    quarter:planUploadForm.quarter,clients,totalTarget:total,
                    // Freeze quota at creation time when CRO uploads (auto-approved)
                    ...(initStatus==="Approved" ? {frozenTarget: total} : {}),
                    status:initStatus,submittedAt:TODAY,
                    submittedByName:user_role?.name||"",submittedByRole:user_role?.role||"",
                    approvalLog:skipLog,
                  };
                  // CRO submission → immediately approved → also create deal stubs
                  if(initStatus==="Approved"){
                    const newDeals = clients
                      .filter(cl=>!deals.find(d=>d.repId===parsedRepId&&d.clientCompany===cl.clientCompany&&d.quarter===planUploadForm.quarter))
                      .map(cl=>({
                        id:`d_plan_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
                        repId:parsedRepId,repName:rep?.name||"",region:rep?.region||"",
                        clientCompany:cl.clientCompany,contactName:"",designation:"",contactLevel:"",phone:"",email:"",
                        dealType:cl.dealType,outcome:"Needs Callback",
                        amount:cl.targetAmount,targetAmount:cl.targetAmount,
                        priority:"Regular",quarter:planUploadForm.quarter,
                        notes:`Plan uploaded by ${user_role?.role}`,
                        nextStep:"",nextStepDate:null,lastContact:TODAY,reqs:[],auditLog:[],
                        awaitingApproval:null,awaitingApprovalSince:null,
                      }));
                    if(newDeals.length>0) setDeals(p=>[...p,...newDeals]);
                    showToast(`Plan auto-approved — ${clients.length} client${clients.length!==1?"s":""} added to ${rep?.name||"rep"}'s targets ✓`);
                  } else {
                    showToast(`Plan submitted for ${rep?.name||"rep"} — enters at ${initStatus} ✓`);
                  }
                  setTargetSubs(p=>[sub,...p]);
                  setPlanUploadOpen(false);
                }}
                  style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",borderRadius:6,padding:"9px 22px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                  {isCRORole?"Submit & Auto-Approve ✓":"Submit Plan →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addDealOpen && (()=>{
        const formRepId = String(dealForm.repId);
        const approvedTargetClients = targetSubs
          .filter(s=>String(s.repId)===formRepId && s.status==="Approved")
          .flatMap((s:any)=>s.clients||[]);
        const isDuplicateDeal = !!(dealForm.clientCompany && dealForm.dealType && dealForm.quarter &&
          deals.some(d=>
            String(d.repId)===formRepId &&
            (d.clientCompany||"").toLowerCase()===(dealForm.clientCompany||"").toLowerCase() &&
            d.quarter===dealForm.quarter &&
            d.dealType===dealForm.dealType
          ));
        return (
        <div className="overlay" onClick={()=>setAddDealOpen(false)}>
          <div className="modal fin" onClick={e=>e.stopPropagation()}>
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:16}}>ADD NEW DEAL</div>

            {/* ── Approved target client quick-picks ── */}
            {approvedTargetClients.length > 0 && (
              <div style={{background:`${C.accent}08`,border:`1px solid ${C.accent}33`,borderRadius:7,padding:"10px 14px",marginBottom:14}}>
                <div style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Target Clients · Quick Pick</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {approvedTargetClients.map((c:any,i:number)=>{
                    const isSelected = dealForm.clientCompany.toLowerCase()===(c.clientCompany||"").toLowerCase() && dealForm.dealType===c.dealType;
                    return (
                      <button key={i}
                        onClick={()=>setDealForm(p=>({...p,clientCompany:c.clientCompany,dealType:c.dealType||p.dealType,targetAmount:c.targetAmount||p.targetAmount}))}
                        style={{padding:"3px 10px",fontSize:11,borderRadius:4,border:`1px solid ${isSelected?C.accent:C.border}`,background:isSelected?`${C.accent}18`:C.s2,color:isSelected?C.accent:C.text,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:isSelected?700:400}}>
                        {c.clientCompany}{c.dealType?` · ${c.dealType}`:""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Duplicate warning ── */}
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
              {/* Client Company — Zoho live search */}
              <div>
                <label>Client Company *</label>
                <ZohoSearchInput
                  value={dealForm.clientCompany||""}
                  zohoId={dealForm.zohoAccountId||""}
                  onChange={(name,id)=>setDealForm(p=>({...p,clientCompany:name,zohoAccountId:id}))}
                  endpoint="/api/zoho/clients"
                  placeholder="Type to search Zoho…"
                />
              </div>
              {/* Agency Name — optional Zoho live search */}
              <div>
                <label>Agency Name (optional)</label>
                <ZohoSearchInput
                  value={dealForm.agencyName||""}
                  zohoId={dealForm.zohoAgencyId||""}
                  onChange={(name,id)=>setDealForm(p=>({...p,agencyName:name,zohoAgencyId:id}))}
                  endpoint="/api/zoho/agencies"
                  placeholder="e.g. Madison, Wavemaker…"
                />
              </div>
              {[
                {label:"Contact Name",key:"contactName",type:"text",ph:"Full name"},
                {label:"Designation",key:"designation",type:"text",ph:"e.g. VP Marketing"},
                {label:"Phone",key:"phone",type:"text",ph:"Mobile"},
                {label:"Email",key:"email",type:"text",ph:"email@company.com"},
                {label:"Target Amount * — e.g. 50L or 2.5Cr",key:"targetAmount",type:"text",ph:"50L / 2.5Cr / 5000000"},
                {label:"Expected Amount — likely close (blank = same as target)",key:"amount",type:"text",ph:"50L / 2.5Cr / leave blank"},
                {label:"Next Step",key:"nextStep",type:"text",ph:"Action item"},
                {label:"Next Step Date",key:"nextStepDate",type:"date",ph:""},
              ].map(f=>(
                <div key={f.key}><label>{f.label}</label><input type={f.type} placeholder={f.ph} value={dealForm[f.key]||""} onChange={e=>setDealForm(p=>({...p,[f.key]:e.target.value}))} /></div>
              ))}
              <div><label>Assign Rep *</label>{isRep?(<input readOnly value={reps.find(r=>r.id===parseInt(dealForm.repId))?.name||""} style={{color:C.text,background:C.s2,cursor:"default"}} />):(reps.filter(r=>isRH?r.region===user_role?.region:true).length===0?(<div style={{padding:"9px 12px",background:`${C.orange}12`,border:`1px solid ${C.orange}`,borderRadius:6,color:C.orange,fontSize:12}}>No reps added yet — ask Admin to add reps first.</div>):(<select value={dealForm.repId} onChange={e=>setDealForm(p=>({...p,repId:e.target.value}))}><option value="">Select</option>{reps.filter(r=>isRH?r.region===user_role?.region:true).map(r=><option key={r.id} value={r.id}>{r.name} ({r.region})</option>)}</select>))}</div>
              <div><label>Deal Type</label><select value={dealForm.dealType} onChange={e=>setDealForm(p=>({...p,dealType:e.target.value}))}><option value="">Select</option>{DEAL_TYPES.map(d=><option key={d}>{d}</option>)}</select></div>
              <div><label>Contact Level</label><select value={dealForm.contactLevel} onChange={e=>setDealForm(p=>({...p,contactLevel:e.target.value}))}><option value="">Select</option>{CONTACT_LEVELS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label>Priority</label><select value={dealForm.priority} onChange={e=>setDealForm(p=>({...p,priority:e.target.value}))}><option>Top 5</option><option>Regular</option></select></div>
              <div><label>Quarter</label><select value={dealForm.quarter} onChange={e=>setDealForm(p=>({...p,quarter:e.target.value}))}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></div>
            </div>
            <div><label>Notes / Context</label><textarea rows={2} placeholder="Competitor intel, history, strategy..." value={dealForm.notes} onChange={e=>setDealForm(p=>({...p,notes:e.target.value}))} style={{resize:"none"}} /></div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setAddDealOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDeal}>ADD DEAL</button>
            </div>
          </div>
        </div>
        );
      })()}

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
          onNavigateRevenue={() => { setLogOpen(false); setView('revenue-log'); }}
        />
      )}

      {/* MEETING DETAIL MODAL — view logged meeting */}
      {viewMeetingId && (()=>{
        const vm = meetings.find(m=>m.id===viewMeetingId);
        if (!vm) return null;
        const ef = meetingEditMode ? meetingEditForm : vm;
        const statusColor = (ef.status||vm.status||"")===("Closed")?C.green:(ef.status||vm.status||"")===("Positive")?C.blue:(ef.status||vm.status||"")===("Follow-up Needed")?C.orange:C.dim;
        const canEdit = isRep ? vm.repId===user_role?.repId : true;
        const setEf = (patch) => setMeetingEditForm(f=>({...f,...patch}));
        const closeMeetingModal = () => { setViewMeetingId(null); setMeetingEditMode(false); setMeetingEditForm({}); };
        const startEdit = () => { setMeetingEditForm({...vm}); setMeetingEditMode(true); };
        const saveEdit = () => {
          if (!meetingEditForm.discussion?.trim()) { alert("What Happened is required"); return; }
          setMeetings(p=>p.map(m=>m.id===viewMeetingId?{...m,...meetingEditForm}:m));
          setMeetingEditMode(false);
          showToast("Meeting updated ✓");
        };
        return (
          <div className="overlay" onClick={closeMeetingModal}>
            <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:560,maxHeight:"88vh",overflowY:"auto"}}>
              {/* Header */}
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
                      : vm.pitchType&&<span style={{color:C.accent}}>{vm.pitchType}</span>
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

              {/* Contact row */}
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

              {/* What happened */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>What Happened {meetingEditMode&&<span style={{color:C.red,fontWeight:400}}>*</span>}</div>
                {meetingEditMode
                  ? <textarea rows={3} value={ef.discussion||""} onChange={e=>setEf({discussion:e.target.value})} placeholder="What was discussed, how the client reacted..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
                  : <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.discussion||<span style={{color:C.muted}}>Not recorded</span>}</div>
                }
              </div>

              {/* Client feedback */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Client Feedback</div>
                {meetingEditMode
                  ? <textarea rows={2} value={ef.clientFeedback||""} onChange={e=>setEf({clientFeedback:e.target.value})} placeholder="Positive, hesitant, needs approval..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
                  : vm.clientFeedback
                      ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.clientFeedback}</div>
                      : <div style={{fontSize:11,color:C.muted}}>—</div>
                }
              </div>

              {/* Action Items — hidden if ANY of stageUpdate/status/outcome is a terminal stage */}
              {!["Mail Confirmed","Lost","RO Received"].some(ts=>ts===(ef.stageUpdate||"")||ts===(ef.status||"")||ts===(ef.outcome||"")) && (()=>{
                const items = (vm.nextStepItems||[]).filter(i=>i.action);
                const addItem = () => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    nextStepItems:[...(m.nextStepItems||[]),{action:"",neededFrom:"",remarks:"",dueDate:""}]
                  }:m));
                };
                const updateItem = (idx:number, field:string, val:string) => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    nextStepItems:(m.nextStepItems||[]).map((it,i)=>i===idx?{...it,[field]:val}:it)
                  }:m));
                };
                const removeItem = (idx:number) => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    nextStepItems:(m.nextStepItems||[]).filter((_,i)=>i!==idx)
                  }:m));
                };
                const linkedIRColor = (status:string) => status==="Done"||status==="Resolved"?C.green:status==="In Progress"?C.blue:status==="Rejected"?C.red:C.accent;
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
                    {(vm.nextStepItems||[]).length===0 && !meetingEditMode && (
                      vm.nextSteps
                        ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"10px 12px"}}>{vm.nextSteps}</div>
                        : <div style={{fontSize:11,color:C.muted}}>No action items recorded.</div>
                    )}
                    {(vm.nextStepItems||[]).map((item, idx) => {
                      const linkedIR = item.action ? internalReqs.find(r=>r.meetingLogId===vm.id&&r.subject===item.action) : null;
                      const linkedTask = item.action ? tasks.find(t=>t.meetingLogId===vm.id&&t.title?.includes(item.action.slice(0,30))) : null;
                      return (
                        <div key={idx} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px",marginBottom:7}}>
                          {/* Row 1: action text + remove button */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                            <input
                              value={item.action||""}
                              onChange={e=>updateItem(idx,"action",e.target.value)}
                              placeholder="What needs to happen…"
                              style={{fontSize:12,fontWeight:600,width:"100%",color:C.text,flex:1}}
                            />
                            <button onClick={()=>removeItem(idx)} style={{fontSize:14,color:C.red,background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:0,marginLeft:4,flexShrink:0}}>×</button>
                          </div>
                          {/* Row 2: neededFrom + dueDate + remarks */}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:(linkedIR||linkedTask)?6:0}}>
                            <select value={item.neededFrom||""} onChange={e=>updateItem(idx,"neededFrom",e.target.value)} style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.dim}}>
                              <option value="">Self</option>
                              {["Region Head","NSH","CXO","Sales Strategy","Digital","Finance","Legal","Branding Team","Content Team","Client"].map(r=><option key={r}>{r}</option>)}
                            </select>
                            <input type="date" min="2020-01-01" max="2099-12-31" value={item.dueDate||""} onChange={e=>updateItem(idx,"dueDate",e.target.value)} style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.dim}} />
                            <input value={item.remarks||""} onChange={e=>updateItem(idx,"remarks",e.target.value)} placeholder="Notes…" style={{fontSize:11,flex:1,minWidth:80}} />
                          </div>
                          {/* Linked IR or Task status badge */}
                          {(linkedIR||linkedTask)&&(
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                              {linkedIR&&(
                                <span style={{fontSize:10,background:`${linkedIRColor(linkedIR.status)}18`,color:linkedIRColor(linkedIR.status),border:`1px solid ${linkedIRColor(linkedIR.status)}44`,borderRadius:4,padding:"2px 8px",fontWeight:600}}>
                                  IR → {linkedIR.dept}: {linkedIR.status}
                                </span>
                              )}
                              {linkedTask&&(
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

              {/* Follow-up & next meeting */}
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

              {/* Notes */}
              {meetingEditMode&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Additional Notes</div>
                  <textarea rows={2} value={ef.notes||""} onChange={e=>setEf({notes:e.target.value})} placeholder="Any other context or remarks..." style={{width:"100%",fontSize:12,resize:"vertical"}} />
                </div>
              )}
              {!meetingEditMode&&vm.notes&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Notes</div>
                  <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:C.s2,borderRadius:6,padding:"10px 12px"}}>{vm.notes}</div>
                </div>
              )}

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                <div>
                  {meetingEditMode&&<span style={{fontSize:10,color:C.muted}}>Fields marked * are required</span>}
                </div>
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
      })()}


      {/* EDIT INTERNAL REQUEST MODAL */}
      {editIrId && (
        <div className="overlay" onClick={()=>{setEditIrId(null);setIrForm(BLANK_IR_FORM);}}>
          <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:520}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div className="sans" style={{fontSize:15,fontWeight:700}}>Edit Request</div>
              <button onClick={()=>{setEditIrId(null);setIrForm(BLANK_IR_FORM);}} style={{background:"transparent",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Request Type *</div>
                <select value={irForm.type} onChange={e=>setIrForm(f=>({...f,type:e.target.value}))}
                  style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                  {["Send Proposal","Send FCT Grid","Send Revised Rate Card","Send Sponsorship Deck","Get Budget Approval","Arrange Senior Meeting","Get Rate Approval","Follow Up with Client","Share Digital Plan","Content / Script Needed","Legal / Contract Review","Get PO / Release","Other"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Who do you need it from? *</div>
                <select value={irForm.dept} onChange={e=>setIrForm(f=>({...f,dept:e.target.value}))}
                  style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                  {["Region Head","NSH","CXO","Sales Strategy","Digital","Branding Team","Content Team","Finance","Legal","HR"].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Subject / What do you need? *</div>
              <input value={irForm.subject} onChange={e=>setIrForm(f=>({...f,subject:e.target.value}))}
                placeholder="e.g. Discount approval — 10% off rate card for Havells"
                style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Client / Account (optional)</div>
              <select value={irForm.clientCompany} onChange={e=>setIrForm(f=>({...f,clientCompany:e.target.value}))}
                style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:irForm.clientCompany?C.text:C.dim,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}>
                <option value="">— Select client —</option>
                {[...new Set(deals.filter(d=>myRepId?d.repId===myRepId:true).map(d=>d.clientCompany))].sort().map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Details / Context</div>
              <textarea value={irForm.details} onChange={e=>setIrForm(f=>({...f,details:e.target.value}))}
                rows={4} placeholder="Provide context — client budget, ask, deadline, any relevant background…"
                style={{width:"100%",background:C.s3,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",resize:"vertical",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>{setEditIrId(null);setIrForm(BLANK_IR_FORM);}} style={{background:C.s3,border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
              <button onClick={()=>{
                if(!irForm.subject.trim()){showToast("Subject is required","err");return;}
                setInternalReqs(p=>p.map(r=>r.id===editIrId?{...r,type:irForm.type,dept:irForm.dept,subject:irForm.subject.trim(),details:irForm.details.trim(),clientCompany:irForm.clientCompany.trim()}:r));
                setEditIrId(null);setIrForm(BLANK_IR_FORM);
                showToast("Request updated ✓");
              }} style={{background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 20px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

          {/* EXCEPTION REQUEST MODAL — Rep submits chain request */}
      {excReqOpen && excReqRecord && (
        <div className="overlay" onClick={()=>setExcReqOpen(false)}>
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
              <select value={excReqForm.reason} onChange={e=>setExcReqForm(f=>({...f,reason:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text}}>
                <option value="">— Select reason —</option>
                {["Client Visit / Field Work","WFH (Work From Home)","Approved Leave","Travel / No Network","Medical Emergency","System / App Issue","Other"].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:C.dim,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Additional Notes</label>
              <textarea rows={3} value={excReqForm.notes} onChange={e=>setExcReqForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Was at site visit with XYZ client from 9am–7pm. Mentioned to RH via WhatsApp." style={{resize:"vertical",width:"100%",boxSizing:"border-box"}} />
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setExcReqOpen(false)} disabled={excReqSubmitting}>Cancel</button>
              <button className="btn btn-primary" disabled={!excReqForm.reason||excReqSubmitting} onClick={()=>{
                if(!excReqForm.reason){showToast("Select a reason","err");return;}
                setExcReqSubmitting(true);
                attendSvc.createException({date:excReqRecord.date,reason:excReqForm.reason,notes:excReqForm.notes,attendanceRecordId:excReqRecord.id})
                  .then(()=>{showToast("Exception request submitted — pending RH approval ✓");setExcReqOpen(false);fetchAttendanceData();})
                  .catch((err:any)=>showToast(err?.body?.error||"Failed to submit","err"))
                  .finally(()=>setExcReqSubmitting(false));
              }}>{excReqSubmitting?"Submitting…":"Submit to RH →"}</button>
            </div>
          </div>
        </div>
      )}

          {/* EXCEPTION MODAL — Litisha only */}
      {exceptionModal && (
        <div className="overlay" onClick={()=>setExceptionModal(null)}>
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
              <button className="btn btn-ghost" onClick={()=>setExceptionModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={grantException}>GRANT EXCEPTION</button>
            </div>
            <div style={{marginTop:12,fontSize:10,color:C.muted,textAlign:"center"}}>Logged as: {user_role?.name||"Admin"} ({user_role?.role}) · {new Date().toLocaleString("en-IN")} · Sent to HR</div>
          </div>
        </div>
      )}

      {/* ═══ PART 6: CLIENT ACCOUNT THREAD MODAL ═══ */}
      {accountThreadOpen && accountThreadClient && (()=>{
        const clientName = accountThreadClient;
        const clientDeals = deals.filter(d => d.clientCompany === clientName);
        const clientTPs   = touchpoints.filter(t => clientDeals.some(d => d.id === t.dealId) || t.clientAccountId === clientDeals[0]?.clientAccountId);
        // Revenue matching: prefer zohoAccountId over name string; fall back for legacy entries
        const accountZohoId = clientAccounts.find(a=>a.clientName===clientName)?.zohoAccountId || deals.find(d=>d.clientCompany===clientName)?.zohoAccountId || "";
        const clientRevs  = revenueEntries.filter(e =>
          accountZohoId && e.zohoAccountId
            ? e.zohoAccountId === accountZohoId
            : e.clientCompany === clientName
        );
        const account     = clientAccounts.find(a => a.clientName === clientName) || clientDeals[0];
        const currentStage = account?.currentStage || dealStage(clientDeals[0]||{});
        const repObj      = reps.find(r => r.id === (clientDeals[0]?.repId));
        // 4-number metrics for this client
        const cTarget     = clientDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
        const cAchieved   = clientRevs.reduce((s,e)=>s+(e.amount||0),0);
        const cCommitted  = clientDeals.filter(d=>dealStage(d)==="Mail Confirmed").reduce((s,d)=>s+(d.pipelineAmount||parseCurrency(d.amount||"0")||0),0);
        const cInPlay     = clientDeals.filter(d=>["In Discussion","Negotiation"].includes(dealStage(d))).reduce((s,d)=>s+(d.pipelineAmount||parseCurrency(d.amount||"0")||0),0);
        const cShortfall  = Math.max(0, cTarget - cAchieved - cCommitted - cInPlay);
        // Merge meetings + touchpoints into thread (touchpoints preferred)
        const legacyMeetings = meetings.filter(m => m.clientCompany === clientName && !clientTPs.some(t => t.meetingLogId === m.id));
        const allEntries  = [
          ...clientTPs.map(t => ({...t, _type:"tp"})),
          ...legacyMeetings.map(m => ({...m, _type:"meeting"})),
          ...clientRevs.map(r => ({...r, _type:"revenue"})),
        ].sort((a,b) => ((b.date||"") > (a.date||"") ? 1 : -1));
        // Pending action items from tasks
        const pendingAIs  = tasks.filter(t => t.clientCompany === clientName && t.status !== "Done" && t.status !== "Closed");
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}
            onClick={e=>{if(e.target===e.currentTarget){setAccountThreadOpen(false);setAccountThreadClient(null);}}}>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,width:"100%",maxWidth:660,boxShadow:"0 24px 60px rgba(0,0,0,.5)",padding:"24px 28px"}}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <div className="sans" style={{fontSize:18,fontWeight:800,letterSpacing:1}}>{clientName}</div>
                    <span style={{background:`${oColor(currentStage)}18`,color:oColor(currentStage),padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700}}>{currentStage}</span>
                  </div>
                  <div style={{fontSize:11,color:C.dim}}>
                    {repObj?.name} · {clientDeals[0]?.region}
                    {(()=>{const idleClock=account?.lastDealMeetingDate||clientDeals[0]?.lastDealMeetingDate||clientDeals[0]?.lastContact; const idle=daysSince(idleClock); return idleClock ? <span style={{color:idle>=7?C.red:idle>=3?C.orange:C.green,fontWeight:600,marginLeft:8}}>{idle===0?"Deal meeting today":`Last deal meeting: ${idle}d ago`}</span> : null;})()}
                  </div>
                </div>
                <button onClick={()=>{setAccountThreadOpen(false);setAccountThreadClient(null);}}
                  style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
              </div>
              {/* 4-number metrics row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
                {[["TARGET",fmtR(cTarget),C.dim],["ACHIEVED",fmtR(cAchieved),C.green],["COMMITTED",fmtR(cCommitted),C.blue],["IN PLAY",fmtR(cInPlay),"#d97706"],["SHORTFALL",fmtR(cShortfall),cShortfall===0?C.green:C.red]].map(([l,v,c])=>(
                  <div key={l} style={{background:C.s2,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:8,color:C.muted,letterSpacing:".07em",marginBottom:3,textTransform:"uppercase"}}>{l}</div>
                    <div className="sans" style={{fontSize:15,fontWeight:800,color:c as string}}>{v}</div>
                  </div>
                ))}
              </div>
              {stackedBar(cTarget, cAchieved, cCommitted, cInPlay, cShortfall, 8)}
              <div style={{marginBottom:10}} />
              {/* Pending action items */}
              {pendingAIs.length>0&&(
                <div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}33`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:6}}>PENDING ACTION ITEMS ({pendingAIs.length})</div>
                  {pendingAIs.slice(0,3).map(ai=>(
                    <div key={ai.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:11,color:C.text,flex:1}}>{ai.title}</span>
                      <span style={{fontSize:10,color:C.dim}}>→ {ai.assignedDept||"Self"}</span>
                      <span style={{background:`${C.orange}18`,color:C.orange,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{ai.status}</span>
                    </div>
                  ))}
                  {pendingAIs.length>3&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>+{pendingAIs.length-3} more</div>}
                </div>
              )}
              {/* Thread entries */}
              <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".07em",marginBottom:10,textTransform:"uppercase"}}>Activity Thread · {allEntries.length} entries</div>
              {allEntries.length===0&&<div style={{textAlign:"center",padding:32,color:C.muted,fontSize:12}}>No activity logged yet for this client.</div>}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {allEntries.map((entry,i)=>{
                  if(entry._type==="revenue") return (
                    <div key={entry.id||i} style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:16}}>💰</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.green}}>₹{((entry.amount||0)/100000).toFixed(1)}L revenue logged</div>
                        <div style={{fontSize:10,color:C.dim,marginTop:2}}>{entry.date} · Ref: {entry.invoiceRef||"—"} · {entry.dealType}</div>
                        {entry.notes&&<div style={{fontSize:11,color:C.dim,marginTop:3}}>{entry.notes}</div>}
                      </div>
                    </div>
                  );
                  const isTp = entry._type==="tp";
                  const tpBadgeColor = entry.touchpointType==="Relationship"?C.blue:C.accent;
                  const stageChangeText = isTp && entry.stageUpdate ? `Stage: ${entry.stageUpdate}` : entry.outcome ? `Stage: ${entry.outcome}` : null;
                  return (
                    <div key={entry.id||i} style={{background:C.s2,borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${tpBadgeColor}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:10,color:C.dim,fontWeight:600}}>{entry.date}</span>
                        {entry.time&&<span style={{fontSize:10,color:C.muted}}>{entry.time}</span>}
                        <span style={{background:`${tpBadgeColor}18`,color:tpBadgeColor,padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>{entry.touchpointType||"Deal Meeting"}</span>
                        {entry.meetingType&&<span style={{fontSize:10,color:C.muted,background:C.s3,padding:"1px 6px",borderRadius:4}}>{entry.meetingType}</span>}
                        {stageChangeText&&<span style={{fontSize:10,color:C.accent,fontWeight:600,background:`${C.accent}12`,padding:"1px 7px",borderRadius:4}}>{stageChangeText}</span>}
                      </div>
                      {(entry.contactName||entry.contactDesignation)&&(
                        <div style={{fontSize:11,color:C.dim,marginBottom:4}}>
                          Contact: <span style={{color:C.text,fontWeight:600}}>{entry.contactName}</span>
                          {entry.contactDesignation&&<span style={{color:C.muted}}> · {entry.contactDesignation}</span>}
                          {(entry.contactLevel||entry.designation)&&<span style={{color:C.muted}}> · {entry.contactLevel||entry.designation}</span>}
                        </div>
                      )}
                      {(entry.whatHappened||entry.discussion)&&(
                        <div style={{fontSize:12,color:C.text,marginBottom:4,lineHeight:1.5}}>{entry.whatHappened||entry.discussion}</div>
                      )}
                      {entry.clientFeedback&&(
                        <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:5,padding:"4px 8px",fontSize:11,color:C.blue,marginTop:4}}>
                          💬 {entry.clientFeedback}
                        </div>
                      )}
                      {entry.nextSteps&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>Next: {entry.nextSteps}</div>}
                      {/* Part 6: + Add Action Item on each thread entry — proper inline form */}
                      {isTp&&(
                        <div style={{marginTop:8}}>
                          {threadAIForm?.entryId===entry.id ? (
                            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginTop:4}}>
                              <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Add Action Item to this Touchpoint</div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                                <div>
                                  <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Action Type *</div>
                                  <select value={threadAIForm.actionType} onChange={e=>setThreadAIForm(p=>p?({...p,actionType:e.target.value}):null)}>
                                    <option value="">Select type…</option>
                                    {ACTION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Who *</div>
                                  <select value={threadAIForm.neededFrom} onChange={e=>setThreadAIForm(p=>p?({...p,neededFrom:e.target.value}):null)}>
                                    <option value="">Needed from…</option>
                                    {APPROVAL_TARGETS.map(t=><option key={t} value={t}>{t}</option>)}
                                    <option value="Self">Myself</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{marginBottom:8}}>
                                <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Details <span style={{fontWeight:400}}>(max 150 chars)</span></div>
                                <input maxLength={150} placeholder="What exactly is needed…" value={threadAIForm.details} onChange={e=>setThreadAIForm(p=>p?({...p,details:e.target.value}):null)} />
                              </div>
                              <div style={{marginBottom:10}}>
                                <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>By When *</div>
                                <input type="date" min="2020-01-01" max="2099-12-31" value={threadAIForm.dueDate} onChange={e=>setThreadAIForm(p=>p?({...p,dueDate:e.target.value}):null)} />
                              </div>
                              {threadAIForm.actionType&&threadAIForm.neededFrom&&(
                                <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:8}}>
                                  {threadAIForm.actionType==="Approval needed"&&`→ Approvals tab of ${threadAIForm.neededFrom}`}
                                  {threadAIForm.actionType==="Attend a meeting"&&`→ My Plan of ${threadAIForm.neededFrom}`}
                                  {["Document needed","Introduction needed","Flag for follow-up"].includes(threadAIForm.actionType)&&`→ My Tasks of ${threadAIForm.neededFrom}`}
                                  {threadAIForm.neededFrom==="Self"&&" (personal reminder — no one else notified)"}
                                </div>
                              )}
                              <div style={{display:"flex",gap:8}}>
                                <button onClick={()=>setThreadAIForm(null)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 0",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                                <button onClick={()=>{
                                  if(!threadAIForm.actionType||!threadAIForm.neededFrom||!threadAIForm.dueDate){showToast("Fill all required fields");return;}
                                  const aType=threadAIForm.actionType;
                                  const neededFrom=threadAIForm.neededFrom;
                                  const details=threadAIForm.details;
                                  const dueDate=threadAIForm.dueDate;
                                  const repName=user_role?.name||"Rep";
                                  const ts=`ai_tp_${Date.now()}`;
                                  const baseTask:any={id:ts,assignedTo:null,assignedToUserId:null,assignedDept:neededFrom==="Self"?"Self":neededFrom,repId:clientDeals[0]?.repId||null,clientCompany:clientName,title:`${aType} — ${clientName}${details?` — ${details}`:""} — by ${dueDate} — from ${repName}`.slice(0,160),description:details,priority:"High",status:"Open",dueDate,createdAt:TODAY,assignedBy:activeUser,assignedByName:repName,fromMeetingLog:true,actionType:aType};
                                  setTasks(p=>[baseTask,...p]);
                                  if(aType==="Approval needed"&&neededFrom!=="Self"){
                                    setInternalReqs(p=>[{id:`ir_tp_${Date.now()}`,type:"Approval",dept:neededFrom,subject:`[Approval needed] ${clientName}${details?` — ${details}`:""} — by ${dueDate} — from ${repName}`.slice(0,160),details,raisedBy:activeUser,raisedByName:repName,repId:clientDeals[0]?.repId||null,dealId:clientDeals[0]?.id||null,clientCompany:clientName,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""},...p]);
                                  }
                                  setThreadAIForm(null);
                                  showToast(`Action item → ${neededFrom} ✓`);
                                }} style={{flex:2,background:C.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px 0",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Add Item</button>
                              </div>
                            </div>
                          ):(
                            <button onClick={()=>setThreadAIForm({entryId:entry.id,actionType:"",details:"",neededFrom:"",dueDate:TOMORROW})}
                              style={{background:`${C.blue}10`,border:`1px solid ${C.blue}33`,color:C.blue,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              + Add Action Item
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
                <button onClick={()=>{setLogForm(p=>({...BLANK_LOG,clientAgencyName:clientName,repId:String(clientDeals[0]?.repId||"")}));setLogOpen(true);setAccountThreadOpen(false);}}
                  style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:6,padding:"7px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                  + Log New Meeting
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* NOTE MODAL */}
      {noteModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)setNoteModal(null);}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:24,width:380,boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
            <div className="sans" style={{fontWeight:700,fontSize:15,marginBottom:14}}>{noteModal.title}</div>
            <textarea autoFocus rows={3} value={noteModalVal} onChange={e=>setNoteModalVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();noteModal.onSubmit(noteModalVal||noteModal.placeholder);setNoteModal(null);}}}
              style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace",resize:"none",outline:"none"}}
              placeholder={noteModal.placeholder}/>
            <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
              <button onClick={()=>setNoteModal(null)} style={{padding:"7px 16px",background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>Cancel</button>
              <button onClick={()=>{noteModal.onSubmit(noteModalVal||noteModal.placeholder);setNoteModal(null);}}
                style={{padding:"7px 18px",background:C.accent,border:"none",color:"#fff",borderRadius:5,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:700}}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className="fin" style={{position:"fixed",bottom:18,right:18,background:toast.type==="err"?C.red:C.green,color:"#fff",padding:"9px 16px",borderRadius:5,fontWeight:700,fontSize:12,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{toast.msg}</div>}
    </div>
  );
}
