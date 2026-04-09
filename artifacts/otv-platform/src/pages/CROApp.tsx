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
// Context scaffold — provider wired in Task 12B
import { CROAppProvider } from "../contexts/CROAppContext";
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
import { CROManagementView } from "../views/cro/CROManagementView";
import { DigiOpsView } from "../views/digiops/DigiOpsView";
// eslint-disable-next-line
declare const window: Window & typeof globalThis & { XLSX?: any; };


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
      // @ts-ignore
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
  const [absenceReports, setAbsenceReports] = usePersistedState<any[]>("otv_absence", []);
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
  // @ts-ignore
  const importRef = useRef<HTMLInputElement>(null);
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
    // @ts-ignore
    setDeals(prev => prev.map(d => {
      const ds = dealStage(d);
      // Closed deals never escalate
      if (ds === "RO Received" || ds === "Mail Confirmed" || ds === "Lost") return d;
      // Part 4: Escalation clock is only reset by Deal Meeting touchpoints
      // Use lastDealMeetingDate if available, else fall back to lastContact
      // @ts-ignore
      const idleClock = d.lastDealMeetingDate || d.lastContact;
      const idle = daysSince(idleClock);
      // 7+ days without a Deal Meeting → mark at risk
      // @ts-ignore
      if (idle >= riskDays && idle < escalateDays && !d.atRisk) {
        // @ts-ignore
        return { ...d, atRisk: true };
      }
      // escalateDays+ idle → auto-escalate to NSH if not already flagged
      // @ts-ignore
      if (idle >= escalateDays && !d.awaitingApproval) {
        return {
          // @ts-ignore
          ...d, atRisk: true,
          awaitingApproval:      "NSH",
          awaitingApprovalSince: TODAY,
          // @ts-ignore
          auditLog: [...(d.auditLog || []), {
            at: TODAY, by: "System", role: "AUTO",
            action: "Auto-escalated", from: null, to: "NSH",
            note: `No Deal Meeting for ${idle} days — auto-escalated (threshold: ${escalateDays}d)`,
          }],
        };
      }
      // Clear atRisk if a Deal Meeting was logged recently
      // @ts-ignore
      if (idle < riskDays && d.atRisk) {
        // @ts-ignore
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
  const [savedROs, setSavedROs]       = usePersistedState("otv_savedROs", []);
  // @ts-ignore
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
  const [internalReqs, setInternalReqs, , irError]            = useApiEntityState("/api/internal-requests", "otv_internalReqs", []);
  const [irStatusFilter, setIrStatusFilter]                   = useState("all");
  const [lbTab, setLbTab]                                     = useState("team");
  const [targetSubs, setTargetSubs, targetLoading, targetError] = useApiEntityState("/api/targets",        "otv_targetSubs",      []);
  const [revenueEntries, setRevenueEntries, revLoading, revError]: [any[], any, any, any] = useApiEntityState("/api/revenue",      "otv_revenueEntries",  []);
  // ── Part 1: New data model objects ──────────────────────────────────────
  const [clientAccounts, setClientAccounts, , caError] = useApiEntityState("/api/client-accounts", "otv_clientAccounts", []);
  const { touchpoints, setTouchpoints, syncError: tpError } = useTouchpoints(!!user);

  // Part 1: One-time migration — runs when clientAccounts is empty but deals/meetings exist
  useEffect(() => {
    if (clientAccounts.length > 0) return; // already migrated
    if (deals.length === 0 && meetings.length === 0) return; // nothing to migrate
    const accountMap: Record<string, any> = {}; // key: `${clientCompany}|${repId}`
    deals.forEach(d => {
      // @ts-ignore
      const key = `${d.clientCompany}|${d.repId}`;
      if (!accountMap[key]) {
        // @ts-ignore
        const rep = USER_ROLES.find(r => r.repId === d.repId);
        accountMap[key] = {
          // @ts-ignore
          id: uid(), clientName: d.clientCompany, repId: d.repId,
          // @ts-ignore
          zohoAccountId: d.zohoAccountId || "",
          // @ts-ignore
          region: rep?.region || d.region || "",
          // @ts-ignore
          fiscalYear: d.quarter?.slice(-3) === "FY26" ? "FY26" : "FY26",
          // @ts-ignore
          annualTarget: parseCurrency(d.targetAmount || "0") || 0,
          // @ts-ignore
          currentStage: mapLegacyOutcome(d.outcome || "Prospect"),
          // @ts-ignore
          lastContactDate: d.lastContact || "",
          // @ts-ignore
          lastDealMeetingDate: d.lastContact || "",
          // @ts-ignore
          createdAt: d.createdAt || TODAY, updatedAt: TODAY,
        };
      }
      // link deal back to its account
      // @ts-ignore
      if (!d.clientAccountId) {
        // @ts-ignore
        setDeals(prev => prev.map(x => x.id === d.id ? {...x, clientAccountId: accountMap[key].id, stage: mapLegacyOutcome(x.outcome||"Prospect"), pipelineAmount: parseCurrency(x.amount||"0")||0} : x));
      }
    });
    const newAccounts = Object.values(accountMap);
    // @ts-ignore
    if (newAccounts.length > 0) setClientAccounts(newAccounts);
    // Migrate meetings → touchpoints
    const newTouchpoints = meetings.map(m => {
      // @ts-ignore
      const deal = deals.find(d => d.id === m.dealId || d.clientCompany === m.clientAgencyName);
      // @ts-ignore
      const acctKey = deal ? `${deal.clientCompany}|${deal.repId}` : null;
      const acct = acctKey ? accountMap[acctKey] : null;
      return {
        // @ts-ignore
        id: m.id, clientAccountId: acct?.id || "", dealId: m.dealId || deal?.id || "",
        repId: m.repId, date: m.date, time: m.meetingTime || "",
        meetingType: m.meetingType || "Physical Meeting",
        touchpointType: "Deal Meeting", contactName: m.contactName || "",
        contactDesignation: m.designation || "", contactLevel: m.contactLevel || "",
        whatHappened: m.discussion || "", clientFeedback: m.clientFeedback || "",
        // @ts-ignore
        stageUpdate: mapLegacyOutcome(m.outcome || "Prospect"),
        actionItems: m.actionItems || [],
        loggedAt: m.loggedAt || m.date, loggedLate: m.loggedLate || false,
        loggedByUserId: m.loggedByUserId || String(m.repId),
      };
    }).filter(t => t.clientAccountId);
    // @ts-ignore
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
      // @ts-ignore
      e => e.invoiceRef === "PO Pending" && String(e.notes||"").startsWith("Auto-stub:")
    );
    if (!hasStubs) return;
    stubsCleanedRef.current = true;
    setRevenueEntries(p => p.filter(
      // @ts-ignore
      e => !(e.invoiceRef === "PO Pending" && String(e.notes||"").startsWith("Auto-stub:"))
    ));
  }, [revenueEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Part 5: 4-number dashboard helpers ──────────────────────────────────
  const CURRENT_FY = "FY26";
  const getAchieved   = (repId?: number, fy = CURRENT_FY) =>
    // @ts-ignore
    revenueEntries.filter(e => (repId == null || e.repId === repId) && (e.fiscalYear === fy || fy === "all")).reduce((s, e) => s + (parseCurrency(e.amount||"0")||0), 0);
  // COMMITTED = clientAccounts at Mail Confirmed stage (per spec: read annualTarget from clientAccounts, never from deals.amount)
  const getCommitted  = (repId?: number) =>
    // @ts-ignore
    clientAccounts.filter(a => (repId == null || a.repId === repId) && a.currentStage === "Mail Confirmed").reduce((s, a) => s + (a.annualTarget||0), 0);
  // IN PLAY = clientAccounts at In Discussion or Negotiation stage
  const getInPlay     = (repId?: number) =>
    // @ts-ignore
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
    // @ts-ignore
    const subs = targetSubs.filter(s => (repId == null || s.repId === repId) && s.status === "Approved");
    // @ts-ignore
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
  const [editSubClients, setEditSubClients]             = useState<any[]>([]);
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

  // @ts-ignore
  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const openNoteModal = (title, placeholder, onSubmit) => {
    setNoteModalVal(placeholder || "");
    // @ts-ignore
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
          // @ts-ignore
          deals.forEach((result,di)=>{roNormalizeDoc(result);result._filename=roFiles[i].name+(deals.length>1?` [${di+1}]`:"");parsed.push(result);});
        }
      }else{
        setRoProgress("Parsing...");
        const text=await roCallAPI([{role:"user",content:"Parse this TV RO. If multiple channels return JSON array:\n\n"+roInputText}]);
        const raw=roExtractJSON(text);
        const deals=Array.isArray(raw)?raw:[raw];
        // @ts-ignore
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
    XLSX.writeFile(wb,(r.client_name||"ro").replace(/[^a-zA-Z0-9]/g,"_")+"_Zoho.xlsx");
    // Auto-save to management
    const saved={id:`ro_${Date.now()}`,savedAt:new Date().toISOString(),client_name:r.client_name||"",brand_name:r.brand_name||"",agency_name:r.agency_name||"",channel:roNormalizeChannel(r.channel||""),ro_number:r.ro_number||"",ro_date:r.ro_date||"",gross_amount:r.gross_amount||0,total_payable:r.total_payable||0,filename:r._filename||"",data:r,status:"Exported"};
    // @ts-ignore
    setSavedROs(p=>[saved,...p.filter(x=>x.ro_number!==saved.ro_number||!saved.ro_number)]);
    showToast("Exported + saved to RO Management");
  };

  const roSaveResult = (r) => {
    const saved={id:`ro_${Date.now()}`,savedAt:new Date().toISOString(),client_name:r.client_name||"",brand_name:r.brand_name||"",agency_name:r.agency_name||"",channel:roNormalizeChannel(r.channel||""),ro_number:r.ro_number||"",ro_date:r.ro_date||"",gross_amount:r.gross_amount||0,total_payable:r.total_payable||0,filename:r._filename||"",data:r,status:"Parsed"};
    // @ts-ignore
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
    // @ts-ignore
    setDealForm(prefilled);
    setAddDealOpen(true);
    showToast(`RO pre-filled → deal form opened ✓`);
  };

  const roExportAll = async () => {
    if(!roResults.length)return;
    const XLSX=await loadXLSX();
    const wb=XLSX.utils.book_new();
    const allDeals=[],allBreakup=[],allSummary=[];
    // @ts-ignore
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
    // @ts-ignore
    const alreadyFiled = absenceReports.find(r => r.repId === rep.id && r.date === date);
    if (alreadyFiled) { showToast("Report already filed for this date", "err"); return; }
    const report = {
      id: `ab${Date.now()}`, repId: rep.id, repName: rep.name, region: rep.region, role: rep.role,
      date, generatedAt: new Date().toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit",hour12:false}),
      status: "Sent to HR", sentTo: HR_EMAIL, markedAs: "Absent",
      exception: null, exceptionBy: null, exceptionReason: null, generatedBy: "System (Auto)"
    };
    // @ts-ignore
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
        // @ts-ignore
        const alreadyFiled = absenceReports.find(r => r.repId === rep.id && r.date === TODAY);
        if (!alreadyFiled) {
          const reason = !todayLogged && !tmrwPlanned ? "Neither today's meetings logged nor tomorrow planned"
            : !todayLogged ? "Today's meetings not logged by 11:30 PM"
            : "Tomorrow's meetings not planned by 11:30 PM";
          // @ts-ignore
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
    // @ts-ignore
    setAbsenceReports(p => p.map(r => r.id === exceptionModal.reportId
      ? { ...r, status:"Exception Granted", markedAs:"Present", exception:"Overridden", exceptionBy:user_role?.name||"Admin", exceptionReason: exceptionReason.trim() }
      : r
    ));
    // Also mark them present in attendance
    // @ts-ignore
    const rep = absenceReports.find(r => r.id === exceptionModal.reportId);
    // @ts-ignore
    if (rep) setAtt(p => ({...p, [rep.date]: {...(p[rep.date]||{}), [rep.repId]: true}}));
    setExceptionModal(null); setExceptionReason("");
    showToast("Exception granted — HR notified, marked Present");
  };

  const revokeException = (reportId) => {
    if (!canGrantException) { showToast("Only Admin or CXO can revoke exceptions", "err"); return; }
    // @ts-ignore
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
        // @ts-ignore
        const escAt = t.escAt ? new Date(t.escAt).getTime() : new Date(t.dueDate).getTime() + 12*3600000;
        if (now < escAt) return t.status==="Open"?{...t,status:"Escalated",escAt:t.escAt||new Date(new Date(t.dueDate).getTime()+12*3600000).toISOString()}:t;
        // @ts-ignore
        const newLevel = Math.min(level+1, ESC_CHAIN.length);
        const nextEscAt = new Date(escAt+12*3600000).toISOString();
        return {...t,status:"Escalated",escLevel:newLevel,escDept:ESC_CHAIN[newLevel-1]||t.escDept,escAt:nextEscAt};
      }));
    }
    // Auto-escalate IRs along the 4-step chain
    // @ts-ignore
    const hasOpenIRs = internalReqs.some(r => r.status==="Pending"&&r.escalationAt&&new Date(r.escalationAt).getTime()<now);
    if (hasOpenIRs) {
      // @ts-ignore
      setInternalReqs(prev => prev.map(r => {
        // @ts-ignore
        if (r.status!=="Pending"||!r.escalationAt) return r;
        // @ts-ignore
        if (new Date(r.escalationAt).getTime()>=now) return r;
        // @ts-ignore
        const level = r.escLevel||0;
        const newLevel = Math.min(level+1, ESC_CHAIN.length);
        // @ts-ignore
        const nextEscAt = new Date(new Date(r.escalationAt).getTime()+12*3600000).toISOString();
        // @ts-ignore
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
      // @ts-ignore
      const alreadyMarked = (absenceReports||[]).some(a=>a.repId===repId&&a.date===day);
      if (!hasLog&&!alreadyMarked) toMark.push(day);
    });
    if (toMark.length>0) {
      // @ts-ignore
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
    // @ts-ignore
    const regionOk = user_role.canView==="all" ? (filterRegion==="All"||d.region===filterRegion) : user_role.canView==="region" ? d.region===user_role.region : d.repId===user_role.repId;
    // @ts-ignore
    return regionOk && qMatch(d.quarter);
  });

  // Revenue Tracker: group visibleDeals by client
  const rtClientMap = {};
  visibleDeals.forEach(d=>{
    // @ts-ignore
    if(!rtClientMap[d.clientCompany]) rtClientMap[d.clientCompany]={
      // @ts-ignore
      clientCompany:d.clientCompany, repId:d.repId, lastContact:d.lastContact,
      deals:[], fct:0, digital:0, integrated:0, sponsorship:0, branded:0, total:0, target:0
    };
    // @ts-ignore
    const c = rtClientMap[d.clientCompany];
    c.deals.push(d);
    // @ts-ignore
    c.target += (d.targetAmount||0);
    // @ts-ignore
    if(d.outcome==="Mail Confirmed"){
      // @ts-ignore
      if(d.dealType==="Linear TV") c.fct += d.amount;
      // @ts-ignore
      else if(d.dealType==="Digital") c.digital += d.amount;
      // @ts-ignore
      else if(d.dealType==="Integrated Packages") c.integrated += d.amount;
      // @ts-ignore
      else if(d.dealType==="IPs") c.sponsorship += d.amount;
      // @ts-ignore
      else if(d.dealType==="Media Solutions") c.branded += d.amount;
      // @ts-ignore
      c.total += d.amount;
    }
    // @ts-ignore
    if(!c.lastContact||d.lastContact>c.lastContact) c.lastContact=d.lastContact;
  });
  // @ts-ignore
  const rtClients = Object.values(rtClientMap).sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact));

  // @ts-ignore
  const closedDeals  = visibleDeals.filter(d=>d.outcome==="Mail Confirmed");
  // @ts-ignore
  const activeDeals  = visibleDeals.filter(d=>d.outcome!=="Not Interested");
  // Bug 5 fix: CLOSED QTD in War Room must equal sum of actual revenue entries, not deal pipeline amounts.
  // We determine visible reps from visibleDeals, then sum their revenue entries for the current quarter.
  // @ts-ignore
  const visibleRepIdsSet = new Set(visibleDeals.map(d=>d.repId));
  // @ts-ignore
  const closedRevenue = revenueEntries.filter(e => visibleRepIdsSet.has(e.repId) && qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
  // Part 4: at-risk = clientAccounts (spec: In Discussion / Negotiation / Mail Confirmed, 7+ days since last DEAL meeting)
  // @ts-ignore
  const atRisk       = clientAccounts.filter(a => visibleRepIdsSet.has(a.repId) && ["In Discussion","Negotiation","Mail Confirmed"].includes(a.currentStage||"") && daysSince(a.lastDealMeetingDate||a.lastContactDate) >= 7);
  // @ts-ignore
  const overdueNext  = activeDeals.filter(d=>d.nextStepDate && d.nextStepDate<TODAY && d.outcome!=="Mail Confirmed");
  // @ts-ignore
  const allReqs      = deals.flatMap((d,_)=>d.reqs.map((r,i)=>({...r,dealId:d.id,reqIdx:i,clientCompany:d.clientCompany,amount:d.amount,repId:d.repId})));
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
      // @ts-ignore
      const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
      // @ts-ignore
      const closed  = revenueEntries.filter(e=>e.repId===rep.id&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
      // @ts-ignore
      const pipe    = rd.filter(d=>!["Mail Confirmed","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
      const rm      = meetings.filter(m=>m.repId===rep.id);
      // @ts-ignore
      const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
      // @ts-ignore
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

  const updateOutcome = (id, outcome) => {
    const closed = outcome === "Mail Confirmed";
    // @ts-ignore
    setDeals(p => p.map(d => {
      // @ts-ignore
      if (d.id !== id) return d;
      // @ts-ignore
      const entry  = closed && d.awaitingApproval ? [{
        at: TODAY, by: user_role?.name||"Manager", role: user_role?.role||"",
        // @ts-ignore
        action: "Closed", from: d.awaitingApproval, to: null, note: "Deal closed — approval cleared",
      }] : [];
      return {
        // @ts-ignore
        ...d, outcome, lastContact: TODAY,
        // @ts-ignore
        awaitingApproval:      closed ? null : d.awaitingApproval,
        // @ts-ignore
        awaitingApprovalSince: closed ? null : d.awaitingApprovalSince,
        // @ts-ignore
        atRisk: closed ? false : d.atRisk,
        // @ts-ignore
        auditLog: [...(d.auditLog||[]), ...entry],
      };
    }));
    if (closed) {
      // @ts-ignore
      const deal = deals.find(d => d.id === id);
      if (deal) {
        // @ts-ignore
        pushNotification({ event: "deal_closed", client: deal.clientCompany, amount: deal.amount, rep: deal.repName, message: `Deal won: ${deal.clientCompany} — ${fmtR(deal.amount)}` });
        // @ts-ignore
        showToast(`Deal marked won: ${deal.clientCompany}. Log the booked amount in Revenue Log.`);
      }
    }
  };
  // @ts-ignore
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
    // @ts-ignore
    setDeals(p=>[...p,{id:newDealId,...dealForm,repId:parsedRepId,repName:rep.name,region:rep.region,amount:parseCurrency(dealForm.amount||dealForm.targetAmount),targetAmount:tgtAmt,lastContact:TODAY,reqs:[]}]);
    // Upsert clientAccount so the new deal has a linked account with its Zoho ID
    // @ts-ignore
    setClientAccounts(prev => {
      // @ts-ignore
      const existing = prev.find(a => a.clientName === dealForm.clientCompany.trim() && a.repId === parsedRepId);
      if (existing) {
        // @ts-ignore
        if (!existing.zohoAccountId && dealForm.zohoAccountId) {
          // @ts-ignore
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
        // @ts-ignore
        setTargetSubs(p=>p.map(s=>s.id===existingSub.id?{...s,clients:[...s.clients,newEntry],totalTarget:s.totalTarget+tgtAmt}:s));
      } else {
        // @ts-ignore
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
    // @ts-ignore
    setDeals(prev => prev.map(d => {
      // @ts-ignore
      if (d.id !== dealId) return d;
      // @ts-ignore
      const next  = getApprovalChainNext(d.awaitingApproval, d.amount);
      const entry = {
        at:       TODAY,
        by:       user_role?.name || "Unknown",
        role:     user_role?.role || "",
        action:   "Approved",
        // @ts-ignore
        from:     d.awaitingApproval,
        to:       next,
        note,
      };
      return {
        // @ts-ignore
        ...d,
        awaitingApproval:      next,
        awaitingApprovalSince: next ? TODAY : null,
        // @ts-ignore
        auditLog:              [...(d.auditLog || []), entry],
      };
    }));
    // @ts-ignore
    const d = deals.find(x => x.id === dealId);
    // @ts-ignore
    const next = d ? getApprovalChainNext(d.awaitingApproval, d.amount) : null;
    showToast(next ? `Approved → forwarded to ${next}` : "Deal fully approved ✓");
    // @ts-ignore
    if (d) pushNotification({ event: next ? "deal_approval_advanced" : "deal_fully_approved", client: d.clientCompany, amount: d.amount, approvedBy: user_role?.name, next, message: next ? `${d.clientCompany} approval forwarded to ${next}` : `${d.clientCompany} fully approved — ${fmtR(d.amount)}` });
  };

  const rejectDeal = (dealId, note = "") => {
    // @ts-ignore
    setDeals(prev => prev.map(d => {
      // @ts-ignore
      if (d.id !== dealId) return d;
      const entry = {
        at:     TODAY,
        by:     user_role?.name || "Unknown",
        role:   user_role?.role || "",
        action: "Rejected",
        // @ts-ignore
        from:   d.awaitingApproval,
        to:     null,
        note,
      };
      return {
        // @ts-ignore
        ...d,
        awaitingApproval:      null,
        awaitingApprovalSince: null,
        outcome:               "Price Concern",
        // @ts-ignore
        auditLog:              [...(d.auditLog || []), entry],
      };
    }));
    showToast("Deal rejected — rep notified");
  };

  // ── BADGE COUNTS ──
  // @ts-ignore
  const rhEscBadge = deals.filter(d=>d.awaitingApproval==="NSH"&&daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length||null;
  const escBadge   = allReqs.filter(r=>r.status==="Overdue").length||null;
  // @ts-ignore
  const hrBadge    = absenceReports.filter(r=>r.markedAs==="Absent"&&r.status==="Sent to HR").length||null;
  const rhRegion   = user_role?.region;
  // @ts-ignore
  const rhApprovalBadge = isRH?(targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length+internalReqs.filter(r=>r.dept==="Region Head"&&r.status==="Pending"&&r.type==="Approval").length)||null:null;
  // @ts-ignore
  const rhTaskBadge    = isRH ? tasks.filter(t=>t.assignedToUserId===activeUser&&t.status!=="Done").length||null : null;
  const rhDashBadge    = isRH ? (()=>{
    const _myRepIdsDB = reps.filter(r=>r.region===rhRegion).map(r=>r.id);
    const notLoggedDB = _myRepIdsDB.filter(id=>!(meetings||[]).some(m=>m.repId===id&&m.date===TODAY)).length;
    // @ts-ignore
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

    // @ts-ignore
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
        // @ts-ignore
        N("internal-requests",   "Internal Requests",   "⬆", irBadge),
        // @ts-ignore
        N("tasks",               "Tasks",               "✓", myRepTaskBadge),
        // @ts-ignore
        N("hr",                  "HR Report",           "⊘", hrBadge),
      ]},
    ];

    // ── REGION HEAD ──
    if (isRH) return [
      { label:"MY TEAM", items:[
        // @ts-ignore
        N("rh-dashboard",        "Dashboard",           "⬡", rhDashBadge),
        N("rh-team-plan",        "Team Meetings",       "◎"),
        N("warroom",             "War Room",            "⬡"),
        N("pipeline",            "Pipeline",            "◈"),
      ]},
      { label:"MY WORK", items:[
        N("my-plan",             "My Plan",             "◎"),
        // @ts-ignore
        N("target-approvals",    "Approvals",           "◎", rhApprovalBadge),
        // @ts-ignore
        N("my-tasks",            "My Tasks",            "✓", rhTaskBadge),
        // @ts-ignore
        N("internal-requests",   "Requests",            "⬆", irBadge),
      ]},
      { label:"REPORTS", items:[
        // @ts-ignore
        N("rh-escalations",      "Escalations",         "⚠", rhEscBadge),
        N("rh-team-report",      "Team Report",         "◈"),
        // @ts-ignore
        N("rh-my-hr",            "My HR",               "⊘", hrBadge),
      ]},
    ];

    // ── NSH (logs meetings) ──
    if (isNSH) return [
      { label:"PLANNING",    items:[N("my-plan","My Plan","◎"), N("nsh-rh-plan","RH's Plan","◎"), N("nsh-regional-plan","Rep's Plan","◎")] },
      { label:"COMMAND",     items:[
        // @ts-ignore
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        // @ts-ignore
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending NSH").length||undefined),
        N("my-tasks","My Tasks","✓"),
        // @ts-ignore
        N("escalations","Escalations","▲",escBadge),
        // @ts-ignore
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        // @ts-ignore
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
        // @ts-ignore
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        // @ts-ignore
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending Strategy").length||undefined),
        // @ts-ignore
        N("escalations","Escalations","▲",escBadge),
        // @ts-ignore
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        // @ts-ignore
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
        // @ts-ignore
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||undefined),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","Targets","◎"),
        // @ts-ignore
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.status==="Pending CRO").length||undefined),
        // @ts-ignore
        N("escalations","Escalations","▲",escBadge),
        // @ts-ignore
        N("internal-requests","Internal Requests","⬆",irInboxBadge),
        N("compliance","Compliance","✦"),
        // @ts-ignore
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
        // @ts-ignore
        N("digi-tasks","My Tasks","✓",tasks.filter(t=>t.dept==="Digital"&&t.status!=="Done").length||undefined),
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
        // @ts-ignore
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
  const ctxValue = {
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
    <CROAppProvider value={ctxValue as any}>
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
          <button onClick={()=>setShowHome(true)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:5,transition:"border-color .15s,color .15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
            ← Home
          </button>
          <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:3}}>OTV</span>
          <span style={{color:C.muted}}>|</span>
          <span className="sans" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:2,textTransform:"uppercase"}}>CRM</span>
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
                      // @ts-ignore
                      background: r.type==="deal"?`${C.accent}22`:r.type==="meeting"?`${C.blue}22`:`${C.green}22`,
                      // @ts-ignore
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
                <div style={{fontSize:12,color:C.dim,lineHeight:1.7,marginBottom:(step as any).tip?10:0}}>{step.desc}</div>
                {/* Tip */}
                {(step as any).tip && (
                  <div style={{background:`${C.accent}12`,border:`1px solid ${C.accent}30`,borderRadius:6,padding:"8px 12px",fontSize:11,color:C.accent,lineHeight:1.5}}>
                    💡 {(step as any).tip}
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
            rhRepDrill={rhRepDrill} setRhRepDrill={setRhRepDrill}
            targetDrilldown={targetDrilldown} setTargetDrilldown={setTargetDrilldown}
            nshRepDrill={nshRepDrill} setNshRepDrill={setNshRepDrill}
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
            // @ts-ignore
            const qSubs     = targetSubs.filter(s => s.repId === myRepId && s.quarter === currentQ && s.status === "Approved");
            // @ts-ignore
            const qTarget   = qSubs.reduce((s,x) => s + (x.totalTarget||0), 0);
            // @ts-ignore
            const qAch      = revenueEntries.filter(e => e.repId === myRepId && e.quarter === currentQ).reduce((s,e) => s + (parseCurrency(e.amount||"0")||0), 0);
            // @ts-ignore
            const myTargetSub  = targetSubs.find(s => s.repId === myRepId);
            // @ts-ignore
            const targetApprovalStatus = !myTargetSub ? "none" : myTargetSub.status === "Approved" ? "approved" : "pending";
            return (
              <RepDashboard
                // @ts-ignore
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
                  // @ts-ignore
                  setRevenueEntries(p=>[entry,...p]);
                  revSvc.createRevenueEntry({
                    id, repId:myRepId, clientCompany:clientName.trim(), amount:amt,
                    invoiceRef:invoiceRef.trim(), date:date||TODAY,
                    quarter:entryQ, fiscalYear:CURRENT_FY, idempotencyKey:ikey,
                  }).then(()=>{
                    showToast(`₹${(amt/100000).toFixed(1)}L logged for ${clientName.trim()} ✓`);
                  }).catch((err:any)=>{
                    showToast(err?.body?.error||"Failed to save revenue entry","err");
                    // @ts-ignore
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
              // @ts-ignore
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
          {(view==="admin-access"||view==="admin-approvals") && isAdmin && (
            <AdminView
              view={view}
              pendingUsers={pendingUsers}
              liveRoles={liveRoles}
              adminUsersLoading={adminUsersLoading}
              refreshAdminUsers={refreshAdminUsers}
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
          <CROManagementView
            view={view} setView={setView} isMobile={isMobile}
            nshRHDrill={nshRHDrill} setNshRHDrill={setNshRHDrill}
            nshRegion={nshRegion} setNshRegion={setNshRegion}
            targetDrilldown={targetDrilldown} setTargetDrilldown={setTargetDrilldown}
            nshRepDrill={nshRepDrill} setNshRepDrill={setNshRepDrill}
          />
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
                <div style={{fontSize:11,color:C.dim}}>Upload any agency Release Order — PDF, Excel, image, CSV or paste text. Exports Zoho-ready sheets.</div>
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
                      // @ts-ignore
                      onChange={e=>setRoFiles(p=>[...p,...Array.from((e.target as HTMLInputElement).files)])} />
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
                // @ts-ignore
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
                      // @ts-ignore
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
                    // @ts-ignore
                    if(newDeals.length>0) setDeals(p=>[...p,...newDeals]);
                    showToast(`Plan auto-approved — ${clients.length} client${clients.length!==1?"s":""} added to ${rep?.name||"rep"}'s targets ✓`);
                  } else {
                    showToast(`Plan submitted for ${rep?.name||"rep"} — enters at ${initStatus} ✓`);
                  }
                  // @ts-ignore
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
          // @ts-ignore
          .filter(s=>String(s.repId)===formRepId && s.status==="Approved")
          .flatMap((s:any)=>s.clients||[]);
        const isDuplicateDeal = !!(dealForm.clientCompany && dealForm.dealType && dealForm.quarter &&
          deals.some(d=>
            // @ts-ignore
            String(d.repId)===formRepId &&
            // @ts-ignore
            (d.clientCompany||"").toLowerCase()===(dealForm.clientCompany||"").toLowerCase() &&
            // @ts-ignore
            d.quarter===dealForm.quarter &&
            // @ts-ignore
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
          // @ts-ignore
          userRole={user_role}
          deals={deals}
          showToast={showToast}
          onNavigateRevenue={() => { setLogOpen(false); setView('revenue-log'); }}
        />
      )}

      {/* MEETING DETAIL MODAL — view logged meeting */}
      {viewMeetingId && (()=>{
        const vm: any = meetings.find(m=>m.id===viewMeetingId);
        if (!vm) return null;
        const ef: any = meetingEditMode ? meetingEditForm : vm;
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
                    // @ts-ignore
                    : <div className="sans" style={{fontSize:17,fontWeight:700,color:C.text}}>{vm.clientCompany}</div>
                  }
                  <div style={{fontSize:11,color:C.dim,marginTop:4,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {meetingEditMode
                      ? <input type="date" min="2020-01-01" max="2099-12-31" value={ef.date||""} onChange={e=>setEf({date:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim}} />
                      : <span>{vm.date}</span>
                    }
                    {meetingEditMode
                      ? <input type="time" value={ef.loggedAt||""} onChange={e=>setEf({loggedAt:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim,width:90}} />
                      // @ts-ignore
                      : <span>{vm.loggedAt||"—"}</span>
                    }
                    {meetingEditMode
                      ? <select value={ef.meetingType||"Physical"} onChange={e=>setEf({meetingType:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim}}>
                          {["Physical","Online","Phone Call"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      // @ts-ignore
                      : <span>{vm.meetingType||"Physical"}</span>
                    }
                    {meetingEditMode
                      ? <select value={ef.pitchType||""} onChange={e=>setEf({pitchType:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.accent}}>
                          <option value="">No pitch type</option>
                          {["Linear TV","IPs","Digital","Media Solutions","Integrated Packages","FCT","Generic"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      // @ts-ignore
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
                  // @ts-ignore
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
                // @ts-ignore
                const items = (vm.nextStepItems||[]).filter(i=>i.action);
                const addItem = () => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    // @ts-ignore
                    nextStepItems:[...(m.nextStepItems||[]),{action:"",neededFrom:"",remarks:"",dueDate:""}]
                  }:m));
                };
                const updateItem = (idx:number, field:string, val:string) => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    // @ts-ignore
                    nextStepItems:(m.nextStepItems||[]).map((it,i)=>i===idx?{...it,[field]:val}:it)
                  }:m));
                };
                const removeItem = (idx:number) => {
                  setMeetings(p => p.map(m => m.id===viewMeetingId ? {
                    ...m,
                    // @ts-ignore
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
                    {((vm as any).nextStepItems||[]).length===0 && !meetingEditMode && (
                      vm.nextSteps
                        ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"10px 12px"}}>{vm.nextSteps}</div>
                        : <div style={{fontSize:11,color:C.muted}}>No action items recorded.</div>
                    )}
                    {((vm as any).nextStepItems||[]).map((item, idx) => {
                      // @ts-ignore
                      const linkedIR: any = item.action ? (internalReqs as any[]).find(r=>r.meetingLogId===vm.id&&r.subject===item.action) : null;
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
                                  // @ts-ignore
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
                {[...new Set(deals.filter((d:any)=>user_role?.repId?d.repId===user_role.repId:true).map((d:any)=>d.clientCompany))].sort().map(c=><option key={c} value={c}>{c}</option>)}
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
                // @ts-ignore
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
        // @ts-ignore
        const clientDeals: any[] = (deals as any[]).filter((d:any) => d.clientCompany === clientName);
        // @ts-ignore
        const clientTPs   = touchpoints.filter(t => clientDeals.some(d => d.id === t.dealId) || t.clientAccountId === clientDeals[0]?.clientAccountId);
        // Revenue matching: prefer zohoAccountId over name string; fall back for legacy entries
        // @ts-ignore
        const accountZohoId = clientAccounts.find(a=>a.clientName===clientName)?.zohoAccountId || deals.find(d=>d.clientCompany===clientName)?.zohoAccountId || "";
        const clientRevs  = revenueEntries.filter(e =>
          // @ts-ignore
          accountZohoId && e.zohoAccountId
            ? e.zohoAccountId === accountZohoId
            // @ts-ignore
            : e.clientCompany === clientName
        );
        // @ts-ignore
        const account     = clientAccounts.find(a => a.clientName === clientName) || clientDeals[0];
        // @ts-ignore
        const currentStage = account?.currentStage || dealStage(clientDeals[0]||{});
        // @ts-ignore
        const repObj: any  = (reps as any[]).find((r:any) => r.id === (clientDeals[0]?.repId));
        // 4-number metrics for this client
        // @ts-ignore
        const cTarget     = clientDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
        // @ts-ignore
        const cAchieved   = clientRevs.reduce((s,e)=>s+(e.amount||0),0);
        // @ts-ignore
        const cCommitted  = clientDeals.filter(d=>dealStage(d)==="Mail Confirmed").reduce((s,d)=>s+(d.pipelineAmount||parseCurrency(d.amount||"0")||0),0);
        // @ts-ignore
        const cInPlay     = clientDeals.filter(d=>["In Discussion","Negotiation"].includes(dealStage(d))).reduce((s,d)=>s+(d.pipelineAmount||parseCurrency(d.amount||"0")||0),0);
        const cShortfall  = Math.max(0, cTarget - cAchieved - cCommitted - cInPlay);
        // Merge meetings + touchpoints into thread (touchpoints preferred)
        const legacyMeetings = meetings.filter(m => m.clientCompany === clientName && !clientTPs.some(t => t.meetingLogId === m.id));
        const allEntries  = [
          ...clientTPs.map(t => ({...t, _type:"tp"})),
          ...legacyMeetings.map(m => ({...m, _type:"meeting"})),
          // @ts-ignore
          ...clientRevs.map(r => ({...r, _type:"revenue"})),
        ].sort((a,b) => ((b.date||"") > (a.date||"") ? 1 : -1));
        // Pending action items from tasks
        // @ts-ignore
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
                                  <select value={threadAIForm?.actionType} onChange={e=>setThreadAIForm(p=>p?({...p,actionType:e.target.value}):null)}>
                                    <option value="">Select type…</option>
                                    {ACTION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Who *</div>
                                  <select value={threadAIForm?.neededFrom} onChange={e=>setThreadAIForm(p=>p?({...p,neededFrom:e.target.value}):null)}>
                                    <option value="">Needed from…</option>
                                    {APPROVAL_TARGETS.map(t=><option key={t} value={t}>{t}</option>)}
                                    <option value="Self">Myself</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{marginBottom:8}}>
                                <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Details <span style={{fontWeight:400}}>(max 150 chars)</span></div>
                                <input maxLength={150} placeholder="What exactly is needed…" value={threadAIForm?.details} onChange={e=>setThreadAIForm(p=>p?({...p,details:e.target.value}):null)} />
                              </div>
                              <div style={{marginBottom:10}}>
                                <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>By When *</div>
                                <input type="date" min="2020-01-01" max="2099-12-31" value={threadAIForm?.dueDate} onChange={e=>setThreadAIForm(p=>p?({...p,dueDate:e.target.value}):null)} />
                              </div>
                              {threadAIForm?.actionType&&threadAIForm?.neededFrom&&(
                                <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:8}}>
                                  {threadAIForm?.actionType==="Approval needed"&&`→ Approvals tab of ${threadAIForm?.neededFrom}`}
                                  {threadAIForm?.actionType==="Attend a meeting"&&`→ My Plan of ${threadAIForm?.neededFrom}`}
                                  {["Document needed","Introduction needed","Flag for follow-up"].includes(threadAIForm?.actionType)&&`→ My Tasks of ${threadAIForm?.neededFrom}`}
                                  {threadAIForm?.neededFrom==="Self"&&" (personal reminder — no one else notified)"}
                                </div>
                              )}
                              <div style={{display:"flex",gap:8}}>
                                <button onClick={()=>setThreadAIForm(null)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"6px 0",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                                <button onClick={()=>{
                                  if(!threadAIForm?.actionType||!threadAIForm?.neededFrom||!threadAIForm?.dueDate){showToast("Fill all required fields");return;}
                                  const aType=threadAIForm?.actionType;
                                  const neededFrom=threadAIForm?.neededFrom;
                                  const details=threadAIForm?.details;
                                  const dueDate=threadAIForm?.dueDate;
                                  const repName=user_role?.name||"Rep";
                                  const ts=`ai_tp_${Date.now()}`;
                                  // @ts-ignore
                                  const baseTask:any={id:ts,assignedTo:null,assignedToUserId:null,assignedDept:neededFrom==="Self"?"Self":neededFrom,repId:clientDeals[0]?.repId||null,clientCompany:clientName,title:`${aType} — ${clientName}${details?` — ${details}`:""} — by ${dueDate} — from ${repName}`.slice(0,160),description:details,priority:"High",status:"Open",dueDate,createdAt:TODAY,assignedBy:activeUser,assignedByName:repName,fromMeetingLog:true,actionType:aType};
                                  setTasks(p=>[baseTask,...p]);
                                  if(aType==="Approval needed"&&neededFrom!=="Self"){
                                    // @ts-ignore
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
              // @ts-ignore
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();noteModal.onSubmit(noteModalVal||noteModal.placeholder);setNoteModal(null);}}}
              style={{width:"100%",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace",resize:"none",outline:"none"}}
              // @ts-ignore
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
    </CROAppProvider>
  );
}
