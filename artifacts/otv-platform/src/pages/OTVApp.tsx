// @ts-nocheck
import { useState, useRef, useEffect } from "react";

const REGIONS = ["North", "South", "East", "West", "National"];
const DEAL_TYPES = ["Linear TV", "Digital", "Sponsorship", "Branded Content", "Integrated Package"];
const CONTACT_LEVELS = ["C-Suite / Owner", "VP / GM", "Marketing Head", "Brand Manager", "Agency Lead", "Junior/Exec"];
const OUTCOMES = ["Proposal Accepted", "Very Interested", "Interested – Needs Revision", "Price Concern", "Needs Callback", "Not Interested"];
const DEPARTMENTS = ["Sales Strategy", "Digital", "Production", "National Head", "Finance", "Legal"];
const REQ_STATUS = ["Pending", "In Progress", "Done", "Overdue"];
const SLA = { "Sales Strategy": 24, "Digital": 24, "Production": 48, "National Head": 12, "Finance": 48, "Legal": 72 };
const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26"];
const STAGE_PROB = { "Proposal Accepted": 100, "Very Interested": 70, "Interested – Needs Revision": 50, "Price Concern": 30, "Needs Callback": 20, "Not Interested": 0 };
const PITCH_TYPES = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "Sponsorship", "Others"];
const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation", "Closed"];
const CLIENT_OR_AGENCY = ["Client", "Agency"];

const TODAY  = new Date().toISOString().split("T")[0];
const D1     = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const D3     = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
const D7     = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
const D14    = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

// HR ABSENCE ENGINE
// In production: EOD job (11:59pm) checks att[TODAY] for each rep.
// If not logged → auto-generates AbsenceReport → POST to HR system API → marks Absent in HRMS.
// No regularization path exists in system. Only Admin or CXO can grant exceptions.
const DEADLINE = "12:00"; // 12pm daily
const HR_EMAIL = "hr@odishatv.com"; // where reports fire
const SEED_ABSENCE_REPORTS = [
  { id:"ab1", repId:3, repName:"Rohit Nanda", region:"East", role:"Sales Executive", date:TODAY, generatedAt:"23:59", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent", exception:null, exceptionBy:null, exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab2", repId:3, repName:"Rohit Nanda", region:"East", role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent", exception:null, exceptionBy:null, exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab3", repId:1, repName:"Arjun Mishra",region:"North",role:"Sales Executive", date:D3,    generatedAt:"23:59", status:"Exception Granted", sentTo:HR_EMAIL, markedAs:"Present", exception:"Overridden", exceptionBy:"Litisha (CXO)", exceptionReason:"Client emergency — Reliance site visit, phone network down.", generatedBy:"System (Auto)" },
];

const REPS = [
  { id: 1, name: "Arjun Mishra",  region: "North",    role: "Sales Executive",          target: 18000000 },
  { id: 2, name: "Priya Dash",    region: "South",    role: "Senior Sales",             target: 22000000 },
  { id: 3, name: "Rohit Nanda",   region: "East",     role: "Sales Executive",          target: 12000000 },
  { id: 4, name: "Sneha Patel",   region: "West",     role: "Senior Sales",             target: 16000000 },
  { id: 5, name: "Vikram Sen",    region: "National", role: "National Account Manager", target: 45000000 },
  { id: 6, name: "Meera Rao",     region: "South",    role: "Sales Executive",          target: 14000000 },
];

const USER_ROLES = [
  // FULL ACCESS
  { id: "admin",          name: "Admin",                  role: "ADMIN",          canView: "all",    region: null },
  { id: "litisha",        name: "Litisha (CXO)",          role: "CXO",            canView: "all",    region: null },
  { id: "jaggi",          name: "Jaggi (CXO)",            role: "CXO",            canView: "all",    region: null },
  { id: "sales_head",     name: "Sales Head",             role: "SALES HEAD",     canView: "all",    region: null },
  { id: "sales_strategy", name: "Sachin (Sales Strategy)",role: "SALES STRATEGY", canView: "all",    region: null },
  { id: "sales_analysis", name: "Darpan (Sales Analysis)",role: "SALES ANALYSIS", canView: "all",    region: null },
  { id: "digital",        name: "Digital Team",           role: "DIGITAL",        canView: "all",    region: null },
  // REGION ACCESS
  { id: "rh_north",       name: "Region Head – North",   role: "REGION HEAD",    canView: "region", region: "North" },
  { id: "rh_south",       name: "Region Head – South",   role: "REGION HEAD",    canView: "region", region: "South" },
  { id: "rh_east",        name: "Region Head – East",    role: "REGION HEAD",    canView: "region", region: "East" },
  { id: "rh_west",        name: "Region Head – West",    role: "REGION HEAD",    canView: "region", region: "West" },
  { id: "rh_national",    name: "Region Head – National",role: "REGION HEAD",    canView: "region", region: "National" },
  // SELF ONLY
  { id: "rep_arjun",      name: "Arjun Mishra",          role: "SALES REP",      canView: "self",   region: "North",    repId: 1 },
  { id: "rep_priya",      name: "Priya Dash",            role: "SALES REP",      canView: "self",   region: "South",    repId: 2 },
  { id: "rep_rohit",      name: "Rohit Nanda",           role: "SALES REP",      canView: "self",   region: "East",     repId: 3 },
  { id: "rep_sneha",      name: "Sneha Patel",           role: "SALES REP",      canView: "self",   region: "West",     repId: 4 },
  { id: "rep_vikram",     name: "Vikram Sen",            role: "SALES REP",      canView: "self",   region: "National", repId: 5 },
  { id: "rep_meera",      name: "Meera Rao",             role: "SALES REP",      canView: "self",   region: "South",    repId: 6 },
];

const SEED_DEALS = [
  { id:"d1",  repId:5, clientCompany:"Havells India",    contactName:"Deepa Menon",    designation:"VP Marketing",        contactLevel:"VP / GM",         phone:"9823401234", email:"deepa@havells.com",     dealType:"Sponsorship",         outcome:"Very Interested",            amount:15000000, targetAmount:15000000, region:"National", lastContact:TODAY, nextStep:"Send H2 sponsorship deck by EOD",          nextStepDate:D1,    reqs:[{dept:"Sales Strategy",desc:"H2 sponsorship deck",status:"In Progress",raisedAt:"14:00"},{dept:"Production",desc:"Show property reel",status:"Pending",raisedAt:"14:05"}], notes:"Budget confirmed at 1.2Cr. CMO personally interested.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d2",  repId:5, clientCompany:"Asian Paints",     contactName:"Harsh Goenka",   designation:"CMO",                 contactLevel:"C-Suite / Owner", phone:"9834512345", email:"harsh@asianpaints.com", dealType:"Sponsorship",         outcome:"Very Interested",            amount:12000000, targetAmount:12000000, region:"National", lastContact:D3,    nextStep:"CMO meeting – present flagship package",   nextStepDate:D1,    reqs:[], notes:"CMO meeting scheduled. Need CEO to attend.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d3",  repId:5, clientCompany:"Tata Consumer",    contactName:"Ravi Shankar",   designation:"VP Marketing",        contactLevel:"VP / GM",         phone:"9812309876", email:"ravi@tataconsumer.com", dealType:"Integrated Package",  outcome:"Interested – Needs Revision",amount:9000000,  targetAmount:9000000,  region:"National", lastContact:D7,    nextStep:"Revised multi-brand grid needed",          nextStepDate:D3,    reqs:[{dept:"Sales Strategy",desc:"Multi-brand integrated grid",status:"Overdue",raisedAt:"09:00"}], notes:"Multi-brand portfolio. Last grid rejected on pricing.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d4",  repId:2, clientCompany:"Berger Paints",    contactName:"Rajesh Kumar",   designation:"Brand Manager",       contactLevel:"Brand Manager",   phone:"9812345678", email:"rajesh@berger.com",     dealType:"Linear TV",           outcome:"Proposal Accepted",          amount:2200000,  targetAmount:3500000,  region:"South",    lastContact:TODAY, nextStep:"PO follow-up + brand guidelines for FCT",  nextStepDate:TODAY, reqs:[], notes:"6-week primetime deal closed. PO expected Friday.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d5",  repId:6, clientCompany:"Apollo Hospitals", contactName:"Ravi Krishnan",  designation:"GM Marketing",        contactLevel:"VP / GM",         phone:"9901234567", email:"ravi@apollo.com",       dealType:"Digital",             outcome:"Very Interested",            amount:6000000,  targetAmount:7500000,  region:"South",    lastContact:D1,    nextStep:"Custom digital media plan due Monday",     nextStepDate:D3,    reqs:[{dept:"Digital",desc:"Custom digital plan for Apollo Health",status:"Done",raisedAt:"12:00"}], notes:"High intent. Full digital takeover for health initiative.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d6",  repId:4, clientCompany:"Zydus Wellness",   contactName:"Karishma Shah",  designation:"Marketing Director",  contactLevel:"Marketing Head",  phone:"9867891234", email:"karishma@zydus.com",    dealType:"Branded Content",     outcome:"Price Concern",              amount:3500000,  targetAmount:4500000,  region:"West",     lastContact:D1,    nextStep:"Counter-proposal with revised pricing",    nextStepDate:TODAY, reqs:[{dept:"National Head",desc:"Approve 15% pricing flex on Zydus",status:"Pending",raisedAt:"16:30"}], notes:"20% budget gap. Negotiation required. Competitor Zee also pitching.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d7",  repId:1, clientCompany:"Reliance Retail",  contactName:"Sameer Joshi",   designation:"Marketing Head",      contactLevel:"Marketing Head",  phone:"9876543210", email:"sameer@rretail.com",    dealType:"Integrated Package",  outcome:"Interested – Needs Revision",amount:4500000,  targetAmount:8000000,  region:"North",    lastContact:TODAY, nextStep:"Revised grid with digital + OTT package",  nextStepDate:D1,    reqs:[{dept:"Digital",desc:"OTT add-on pricing grid",status:"Pending",raisedAt:"09:30"}], notes:"Was 6Cr last year. Targeting upgrade to integrated.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d8",  repId:1, clientCompany:"ITC Foods",        contactName:"Saurabh Tiwari", designation:"Nat. Trade Mkt Head", contactLevel:"Marketing Head",  phone:"9823456789", email:"saurabh@itc.com",       dealType:"Linear TV",           outcome:"Needs Callback",             amount:5000000,  targetAmount:5000000,  region:"North",    lastContact:D7,    nextStep:"Present Q3 integrated package",            nextStepDate:D1,    reqs:[], notes:"Annual contract renewal due April. Competitor aggressive.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d9",  repId:3, clientCompany:"Bikaji Foods",     contactName:"Priya Sharma",   designation:"Brand Manager",       contactLevel:"Brand Manager",   phone:"9745612890", email:"priya@bikaji.com",       dealType:"Linear TV",           outcome:"Needs Callback",             amount:800000,   targetAmount:2000000,  region:"East",     lastContact:D3,    nextStep:"BM meeting rescheduled – follow up",       nextStepDate:TODAY, reqs:[], notes:"Was stuck at junior level. Escalated to BM.", priority:"Regular", quarter:"Q1 FY26" },
  { id:"d10", repId:4, clientCompany:"Marico",           contactName:"Neha Gupta",     designation:"Digital Head",        contactLevel:"Brand Manager",   phone:"9867001234", email:"neha@marico.com",        dealType:"Digital",             outcome:"Very Interested",            amount:3000000,  targetAmount:3000000,  region:"West",     lastContact:D1,    nextStep:"Send digital-only performance package",    nextStepDate:D1,    reqs:[{dept:"Digital",desc:"Performance digital package for Marico",status:"In Progress",raisedAt:"11:00"}], notes:"Digital-first brand. Good intent.", priority:"Regular", quarter:"Q1 FY26" },
  { id:"d11", repId:2, clientCompany:"HUL",              contactName:"Amit Rao",       designation:"Media Director",      contactLevel:"VP / GM",         phone:"9823001122", email:"amit.rao@hul.com",       dealType:"Integrated Package",  outcome:"Not Interested",             amount:0,        targetAmount:10000000, region:"South",    lastContact:D14,   nextStep:"Re-engage after Q2 budget cycle",          nextStepDate:null,  reqs:[], notes:"Lost this quarter. Budget frozen. Re-target Q2.", priority:"Top 5", quarter:"Q1 FY26" },
  { id:"d12", repId:5, clientCompany:"LG Electronics",   contactName:"Park Joon",      designation:"Marketing GM",        contactLevel:"VP / GM",         phone:"9811223344", email:"park@lg.com",            dealType:"Sponsorship",         outcome:"Price Concern",              amount:7000000,  targetAmount:7000000,  region:"National", lastContact:D3,    nextStep:"Revised package – lower entry, higher freq",nextStepDate:D1,    reqs:[{dept:"Sales Strategy",desc:"LG revised sponsorship tiers",status:"Pending",raisedAt:"10:30"}], notes:"Strong interest but rate card too high. Competitor offering 20% lower.", priority:"Top 5", quarter:"Q1 FY26" },
];

const SEED_MEETINGS = [
  { id:"ml1", repId:5, repName:"Vikram Sen",  region:"National", dealId:"d1", clientCompany:"Havells India",    contactName:"Deepa Menon",   contactLevel:"VP / GM",       outcome:"Very Interested",            discussion:"Flagship show sponsorship for H2. Budget confirmed.", nextStep:"Send sponsorship deck EOD",  date:TODAY, loggedAt:"09:15", late:false },
  { id:"ml2", repId:2, repName:"Priya Dash",  region:"South",    dealId:"d4", clientCompany:"Berger Paints",    contactName:"Rajesh Kumar",  contactLevel:"Brand Manager", outcome:"Proposal Accepted",          discussion:"Closed 6-week primetime deal. PO by Friday.",         nextStep:"PO follow-up",              date:TODAY, loggedAt:"11:20", late:false },
  { id:"ml3", repId:3, repName:"Rohit Nanda", region:"East",     dealId:"d9", clientCompany:"Bikaji Foods",     contactName:"Ankit Shah",    contactLevel:"Junior/Exec",   outcome:"Needs Callback",             discussion:"Junior exec meeting. No authority.",                  nextStep:"Escalate to BM",            date:TODAY, loggedAt:"13:10", late:true  },
  { id:"ml4", repId:1, repName:"Arjun Mishra",region:"North",    dealId:"d7", clientCompany:"Reliance Retail",  contactName:"Sameer Joshi",  contactLevel:"Marketing Head",outcome:"Interested – Needs Revision", discussion:"Wants digital add-on to existing grid.",              nextStep:"Revised grid with OTT",     date:TODAY, loggedAt:"10:45", late:false },
  { id:"ml5", repId:6, repName:"Meera Rao",   region:"South",    dealId:"d5", clientCompany:"Apollo Hospitals", contactName:"Ravi Krishnan", contactLevel:"VP / GM",       outcome:"Very Interested",            discussion:"Full digital takeover proposal well received.",        nextStep:"Send digital media plan",   date:D1,    loggedAt:"10:30", late:false },
  { id:"ml6", repId:4, repName:"Sneha Patel", region:"West",     dealId:"d6", clientCompany:"Zydus Wellness",   contactName:"Karishma Shah", contactLevel:"Marketing Head",outcome:"Price Concern",               discussion:"20% gap. Competitor Zee also pitching.",             nextStep:"Counter-proposal",          date:D1,    loggedAt:"11:00", late:false },
];

const SEED_ATT = { [TODAY]: {1:true,2:true,3:false,4:true,5:true,6:true}, [D1]: {1:true,2:true,3:true,4:true,5:true,6:true} };

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = { bg:"#080a0f", surface:"#0d1117", s2:"#131920", s3:"#1a2332", border:"#1e2d3d", accent:"#f0a500", green:"#16c784", red:"#ea3943", blue:"#2d7dd2", purple:"#a855f7", orange:"#f97316", text:"#e6edf3", dim:"#7d8590", muted:"#2a3a4d" };

const fmt = (n) => { if (!n || n===0) return "—"; if (n>=10000000) return `${(n/10000000).toFixed(1)}Cr`; if (n>=100000) return `${(n/100000).toFixed(1)}L`; return `${(n/1000).toFixed(0)}K`; };
const fmtR = (n) => n ? `\u20B9${fmt(n)}` : "—";
const daysSince = (d) => { if (!d) return 999; return Math.floor((Date.now()-new Date(d).getTime())/86400000); };
const riskColor = (d) => { if (d.outcome==="Not Interested") return C.muted; if (d.outcome==="Proposal Accepted") return C.green; const x=daysSince(d.lastContact); return x>=7?C.red:x>=3?C.orange:C.green; };
const riskLabel = (d) => { if (d.outcome==="Not Interested") return "Lost"; if (d.outcome==="Proposal Accepted") return "Won"; const x=daysSince(d.lastContact); return x>=7?"At Risk":x>=3?"Cooling":"Active"; };
const oColor = (o) => ({ "Proposal Accepted":C.green, "Very Interested":"#4ade80", "Interested – Needs Revision":C.accent, "Price Concern":C.orange, "Needs Callback":C.blue, "Not Interested":C.muted }[o]||C.dim);
const lColor = (l) => ({ "C-Suite / Owner":C.purple, "VP / GM":C.blue, "Marketing Head":C.green, "Brand Manager":C.accent, "Agency Lead":"#6366f1", "Junior/Exec":C.red }[l]||C.dim);

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
  if(RO_SPONSORSHIP_KEYWORDS.some(k=>text.includes(k))||(r.components||[]).some(c=>["EVENT_FCT","SPONSORSHIP_ENTITLEMENT"].includes(c.component_type))) return "Sponsorship";
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
  const dtColor=dealType==="Sponsorship"?"#f0a500":dealType==="Impact"?"#f97316":"#a855f7";
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
function ROCard({result,onExport}){
  const [activeTab,setActiveTab]=useState("deal");
  const [copied,setCopied]=useState(false);
  const badge={RELEASE_ORDER:{bg:"#1a1a3a",color:"#a855f7",label:"Release Order"},RO_ADDITION:{bg:"#2a1a1a",color:"#f97316",label:"RO Addition"},SALES_AGREEMENT:{bg:"#0a1a0a",color:"#16c784",label:"Sales Agreement"}}[result.document_type]||{bg:"#1a2332",color:"#7d8590",label:"RO"};
  const exp=roBuildExport(result);
  const dealType=roDetectDealType(result);
  const dtColor=dealType==="Sponsorship"?"#f0a500":dealType==="Impact"?"#f97316":"#a855f7";
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
async function roCallAPI(msgs) {
  const base=import.meta.env.BASE_URL||"/";
  const apiUrl=base.endsWith("/")?base+"api/parse-ro":base+"/api/parse-ro";
  const resp=await fetch(apiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:msgs})});
  if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
  const data=await resp.json();
  if(data.error)throw new Error(data.error);
  return data.text||"";
}

// ─── LOGIN COMPONENT ──────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = "773380743026-i87vjdrj5n699von60sa3plqqv95mlem.apps.googleusercontent.com";
const ZOHO_CLIENT_ID   = "1000.TQ0C2M1CLOJC0ES8EPEJJWG5LUJ9ON";

function LoginScreen({ onLogin }) {
  const [mode, setMode]       = useState("options"); // "options" | "email"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [isNew, setIsNew]     = useState(false);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const googleReady           = useRef(false);
  const hiddenGoogleBtn       = useRef(null);

  useEffect(() => {
    function initGIS() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (hiddenGoogleBtn.current) {
        window.google.accounts.id.renderButton(hiddenGoogleBtn.current, {
          theme: "outline", size: "large", width: 400,
        });
      }
      googleReady.current = true;
    }
    if (window.google?.accounts?.id) { initGIS(); return; }
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(interval); initGIS(); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  function handleGoogleCredential(response) {
    try {
      const parts = response.credential.split(".");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      onLogin({ name: payload.name || payload.email, email: payload.email, picture: payload.picture });
    } catch (e) {
      setErr("Google sign-in failed. Please try email login.");
      setLoading(false);
    }
  }

  function handleGoogleClick() {
    setErr(""); setLoading(true);
    if (googleReady.current && window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const btn = hiddenGoogleBtn.current?.querySelector("div[role='button']");
          if (btn) { btn.click(); }
          else { setErr("Google Sign-In popup was blocked. Please allow popups and try again."); setLoading(false); }
        }
      });
    } else {
      setLoading(false);
      setErr("Google Sign-In is still loading. Please wait a moment and try again.");
    }
  }

  function handleZohoClick() {
    setErr(""); setLoading(true);
    const redirectUri = window.location.origin + window.location.pathname.replace(/\/$/, "");
    const scope = "AaaServer.profile.Read";
    const authUrl = `https://accounts.zoho.in/oauth/v2/auth?response_type=token&client_id=${ZOHO_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=online&prompt=consent`;
    const popup = window.open(authUrl, "zoho-login", "width=560,height=660,left=300,top=80");
    if (!popup) {
      setErr("Popup was blocked. Please allow popups for this site and try again.");
      setLoading(false);
      return;
    }
    const timer = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          setErr("Zoho sign-in was cancelled.");
          setLoading(false);
          return;
        }
        const href = popup.location.href;
        if (href && href.includes("access_token")) {
          clearInterval(timer);
          const hash = popup.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const token = params.get("access_token");
          popup.close();
          try {
            const resp = await fetch("https://accounts.zoho.in/oauth/v2/userinfo", {
              headers: { Authorization: `Zoho-oauthtoken ${token}` },
            });
            const profile = await resp.json();
            const displayName = profile.display_name || profile.given_name || profile.first_name || profile.email;
            onLogin({ name: displayName, email: profile.email, picture: profile.picture });
          } catch (e) {
            setErr("Could not fetch Zoho profile. Please try again.");
            setLoading(false);
          }
        }
      } catch (_) {
        // Cross-origin error while popup is on Zoho's domain — safe to ignore, keep polling
      }
    }, 500);
  }

  const handleEmail = (e) => {
    e.preventDefault(); setErr("");
    if (!email.trim()) { setErr("Email is required"); return; }
    if (!password.trim()) { setErr("Password is required"); return; }
    if (isNew && !name.trim()) { setErr("Name is required"); return; }
    // Simulate auth — in production replace with real API call
    const stored = JSON.parse(localStorage.getItem("otv_crm_users") || "[]");
    const existing = stored.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      if (existing.password !== password) { setErr("Incorrect password"); return; }
      onLogin({ name: existing.name, email: existing.email });
    } else {
      if (!isNew) { setErr("No account found. Click 'Create account'."); return; }
      const newUser = { name: name.trim(), email: email.toLowerCase(), password };
      localStorage.setItem("otv_crm_users", JSON.stringify([...stored, newUser]));
      onLogin({ name: newUser.name, email: newUser.email });
    }
  };


  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#080a0f", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .login-input{background:#0d1117;border:1px solid #1e2d3d;border-radius:6px;padding:10px 14px;color:#e6edf3;font-size:13px;font-family:'DM Mono',monospace;outline:none;width:100%;transition:border-color .15s}
        .login-input:focus{border-color:#a855f7}
        .login-input::placeholder{color:#2a3a4d}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* LOGO */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:10, padding:"8px 14px", fontSize:15, fontWeight:700, color:"#fff", letterSpacing:2 }}>OTV</div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:700, color:"#e6edf3", letterSpacing:1 }}>CRO Command</div>
              <div style={{ fontSize:10, color:"#7d8590", letterSpacing:2, textTransform:"uppercase" }}>Sales Intelligence Platform</div>
            </div>
          </div>
        </div>

        <div style={{ background:"#0d1117", border:"1px solid #1e2d3d", borderRadius:12, overflow:"hidden" }}>

          {/* HEADER */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #1e2d3d" }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#e6edf3", marginBottom:3 }}>
              {mode==="email" ? (isNew ? "Create account" : "Sign in with email") : "Sign in"}
            </div>
            <div style={{ fontSize:11, color:"#7d8590" }}>Odisha Television Network · Internal use only</div>
          </div>

          <div style={{ padding:24 }}>
            {mode==="options" && (
              <>
                {/* SOCIAL BUTTONS */}
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                  <button
                    onClick={handleGoogleClick}
                    disabled={loading}
                    style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", color:"#3c4043", border:"1px solid #dadce0", borderRadius:6, padding:"10px 16px", cursor:loading?"wait":"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", transition:"box-shadow .15s", opacity:loading?0.7:1 }}
                    onMouseOver={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,.3)"}
                    onMouseOut={e=>e.currentTarget.style.boxShadow="none"}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
                    {loading ? "Signing in…" : "Continue with Google"}
                  </button>
                  <div ref={hiddenGoogleBtn} style={{ position:"absolute", opacity:0, pointerEvents:"none", width:1, height:1, overflow:"hidden" }} />
                  <button
                    onClick={handleZohoClick}
                    disabled={loading}
                    style={{ display:"flex", alignItems:"center", gap:10, background:"#e42527", color:"#fff", border:"none", borderRadius:6, padding:"10px 16px", cursor:loading?"wait":"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", transition:"opacity .15s", opacity:loading?0.7:1 }}
                    onMouseOver={e=>e.currentTarget.style.opacity=".88"}
                    onMouseOut={e=>e.currentTarget.style.opacity="1"}
                  >
                    <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="4" fill="#e42527"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">Z</text></svg>
                    {loading ? "Signing in…" : "Continue with Zoho"}
                  </button>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <div style={{ flex:1, height:1, background:"#1e2d3d" }} />
                  <span style={{ fontSize:11, color:"#7d8590" }}>or</span>
                  <div style={{ flex:1, height:1, background:"#1e2d3d" }} />
                </div>

                <button onClick={() => setMode("email")} style={{ width:"100%", background:"transparent", border:"1px solid #1e2d3d", borderRadius:6, padding:"10px 16px", color:"#e6edf3", fontSize:13, cursor:"pointer", fontFamily:"'DM Mono',monospace", transition:"border-color .15s" }}
                  onMouseOver={e=>e.currentTarget.style.borderColor="#a855f7"}
                  onMouseOut={e=>e.currentTarget.style.borderColor="#1e2d3d"}>
                  Continue with Email
                </button>

              </>
            )}

            {mode==="email" && (
              <form onSubmit={handleEmail}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {isNew && (
                    <div>
                      <label style={{ fontSize:10, color:"#7d8590", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Full Name</label>
                      <input className="login-input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} autoFocus />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize:10, color:"#7d8590", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Email</label>
                    <input className="login-input" type="email" placeholder="you@odishatv.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus={!isNew} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"#7d8590", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Password</label>
                    <input className="login-input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
                  </div>

                  {err && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#fca5a5" }}>{err}</div>}

                  <button type="submit" style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:6, padding:"11px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>
                    {isNew ? "Create Account" : "Sign In"}
                  </button>

                  <div style={{ textAlign:"center", fontSize:12, color:"#7d8590" }}>
                    {isNew
                      ? <span>Already have an account? <button type="button" onClick={()=>{setIsNew(false);setErr("");}} style={{ color:"#a855f7", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Sign in</button></span>
                      : <span>No account? <button type="button" onClick={()=>{setIsNew(true);setErr("");}} style={{ color:"#a855f7", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Create one</button></span>
                    }
                  </div>

                  <button type="button" onClick={()=>{setMode("options");setErr("");}} style={{ background:"transparent", border:"none", color:"#7d8590", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>← Back</button>
                </div>
              </form>
            )}

            {err && mode==="options" && <div style={{ marginTop:12, background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#fca5a5" }}>{err}</div>}
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:10, color:"#2a3a4d" }}>
          OTV CRO Command · Internal platform · Odisha Television Network
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function OTVApp() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [loginUser, setLoginUser] = useState(null);
  const [appMode, setAppMode]     = useState(null); // null = home, "ro" = RO module, "crm" = CRM

  const handleLogin = (user) => {
    setLoginUser(user);
    setLoggedIn(true);
    setAppMode(null);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setLoginUser(null);
    setAppMode(null);
  };

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  if (!appMode) return <HomeScreen user={loginUser} onSelect={setAppMode} onLogout={handleLogout} />;

  return <CROApp user={loginUser} onLogout={handleLogout} appMode={appMode} onHome={() => setAppMode(null)} onSwitchModule={setAppMode} />;
}

function HomeScreen({ user, onSelect, onLogout }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || "").split(" ")[0];

  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#080a0f", minHeight:"100vh", display:"flex", flexDirection:"column", color:"#e6edf3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .home-tile{background:#0d1117;border:1px solid #1e2d3d;border-radius:14px;padding:40px 36px;cursor:pointer;transition:border-color .2s,background .2s,transform .15s,box-shadow .2s;display:flex;flex-direction:column;align-items:flex-start;gap:14px;text-align:left}
        .home-tile:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.4)}
        .home-tile-ro:hover{border-color:#a855f7;background:#0f0d17}
        .home-tile-crm:hover{border-color:#f0a500;background:#110f08}
      `}</style>

      {/* TOPBAR */}
      <div style={{ background:"#0d1117", borderBottom:"1px solid #1e2d3d", padding:"0 32px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:7, padding:"5px 10px", fontSize:13, fontWeight:700, letterSpacing:2 }}>OTV</div>
          <span style={{ color:"#2a3a4d" }}>|</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:"#7d8590", letterSpacing:2, textTransform:"uppercase" }}>Platform</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"#a855f722", border:"1px solid #a855f755", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#a855f7" }}>
            {(user.name||"?")[0].toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:"#7d8590" }}>{user.name}</span>
          <button onClick={onLogout} style={{ background:"transparent", border:"1px solid #1e2d3d", borderRadius:4, padding:"3px 10px", color:"#7d8590", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#ea3943";e.currentTarget.style.color="#ea3943";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#1e2d3d";e.currentTarget.style.color="#7d8590";}}>
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>

        {/* GREETING */}
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:28, fontWeight:800, marginBottom:6, letterSpacing:-.5 }}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{ fontSize:13, color:"#7d8590" }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })} · Odisha Television Network
          </div>
        </div>

        {/* TWO TILES */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, width:"100%", maxWidth:720 }}>

          {/* RO MANAGEMENT TILE */}
          <div className="home-tile home-tile-ro" onClick={() => onSelect("ro")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#a855f722", border:"1px solid #a855f744", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              📋
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#e6edf3", marginBottom:6, letterSpacing:-.3 }}>RO Management</div>
              <div style={{ fontSize:12, color:"#7d8590", lineHeight:1.6 }}>Parse Release Orders from any agency format. Export Zoho-ready Deal + Breakup sheets. View and manage all saved ROs.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["PDF","Excel","Images","CSV"].map(f => (
                <span key={f} style={{ background:"#a855f715", color:"#a855f7", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
              {["WPP","Madison","Zenith","ENES"].map(f => (
                <span key={f} style={{ background:"#1a2332", color:"#7d8590", padding:"2px 8px", borderRadius:10, fontSize:10 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#a855f7", fontSize:12, fontWeight:600 }}>
              Open RO Module <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>

          {/* CRM TILE */}
          <div className="home-tile home-tile-crm" onClick={() => onSelect("crm")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#f0a50022", border:"1px solid #f0a50044", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              ⬡
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#e6edf3", marginBottom:6, letterSpacing:-.3 }}>CRO Command</div>
              <div style={{ fontSize:12, color:"#7d8590", lineHeight:1.6 }}>Pipeline, targets, team scorecards, meeting logs, escalations, HR compliance and absence reports.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["War Room","Pipeline","Targets","Team","HR Reports"].map(f => (
                <span key={f} style={{ background:"#f0a50015", color:"#f0a500", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#f0a500", fontSize:12, fontWeight:600 }}>
              Open CRM <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <div style={{ marginTop:40, fontSize:11, color:"#2a3a4d", textAlign:"center" }}>
          Odisha Television Network · Internal platform · Not for external distribution
        </div>
      </div>
    </div>
  );
}

function CROApp({ user, onLogout, appMode, onHome, onSwitchModule }) {
  const [view, setView] = useState(appMode === "ro" ? "ro-parser" : "warroom");

  useEffect(() => {
    setView(appMode === "ro" ? "ro-parser" : "warroom");
    setTargetDrilldown(null);
  }, [appMode]);
  const [deals, setDeals]         = useState(SEED_DEALS);
  const [meetings, setMeetings]   = useState(SEED_MEETINGS);
  const [att, setAtt]             = useState(SEED_ATT);
  const [absenceReports, setAbsenceReports] = useState(SEED_ABSENCE_REPORTS);
  const [exceptionModal, setExceptionModal] = useState(null); // { reportId, repName }
  const [exceptionReason, setExceptionReason] = useState("");
  const [activeUser, setActiveUser] = useState("litisha");
  const [filterRegion, setFilterRegion] = useState("All");
  const [filterQ, setFilterQ]     = useState("Q1 FY26");
  const [expanded, setExpanded]   = useState(null);
  const [toast, setToast]         = useState(null);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [logOpen, setLogOpen]     = useState(false);
  const [targetDrilldown, setTargetDrilldown] = useState(null); // { key, label, color }

  const BLANK_DEAL = { clientCompany:"", repId:"", contactName:"", designation:"", contactLevel:"", phone:"", email:"", dealType:"", outcome:"Needs Callback", amount:"", targetAmount:"", priority:"Regular", quarter:"Q1 FY26", notes:"", nextStep:"", nextStepDate:"", reqs:[] };
  const BLANK_LOG = {
    repId:"", meetingTime:"", clientOrAgency:"Client",
    dealId:"", clientAgencyName:"",
    contactName:"", designation:"", mobile:"",
    pitchType:"", discussion:"", clientFeedback:"",
    nextSteps:"", followUpDate:"", status:"",
    seniorRequested:"No", seniorRequestedName:"", seniorRequestedRole:"",
    scheduleNext:false,
    nextMeetingDate:"", nextMeetingTime:"", nextAgenda:"",
    calendarPlatform:"google", addMeetLink:true,
    attendeeEmails:"",
    calendarEventId:"", meetLink:"", calendarStatus:"",
  };
  const [dealForm, setDealForm]   = useState(BLANK_DEAL);
  const [logForm, setLogForm]     = useState(BLANK_LOG);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // RO PARSER STATE
  const [roFiles, setRoFiles]         = useState([]);
  const [roInputText, setRoInputText] = useState("");
  const [roLoading, setRoLoading]     = useState(false);
  const [roResults, setRoResults]     = useState([]);
  const [roActiveDoc, setRoActiveDoc] = useState(0);
  const [roError, setRoError]         = useState(null);
  const [roProgress, setRoProgress]   = useState("");
  const [roSearch, setRoSearch]       = useState("");
  const [savedROs, setSavedROs]       = useState([]);
  const roFileRef = useRef();

  // RO MANAGEMENT STATE
  const [roMgmtChannel, setRoMgmtChannel]           = useState("all");
  const [roMgmtStatus, setRoMgmtStatus]             = useState("all");
  const [roMgmtViewRO, setRoMgmtViewRO]             = useState(null);
  const [roMgmtConfirmDelete, setRoMgmtConfirmDelete] = useState(null);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

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
    }catch(err){setRoError(err.message);}
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

  // Simulate EOD run — checks all reps not logged today
  const runEODCheck = () => {
    const unlogged = REPS.filter(r => !att[TODAY]?.[r.id]);
    if (unlogged.length === 0) { showToast("All reps logged today. No absences."); return; }
    let count = 0;
    unlogged.forEach(rep => {
      const alreadyFiled = absenceReports.find(r => r.repId === rep.id && r.date === TODAY);
      if (!alreadyFiled) {
        setAbsenceReports(p => [{
          id:`ab${Date.now()+rep.id}`, repId:rep.id, repName:rep.name, region:rep.region, role:rep.role,
          date:TODAY, generatedAt:"23:59", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent",
          exception:null, exceptionBy:null, exceptionReason:null, generatedBy:"System (Auto — EOD)"
        }, ...p]);
        count++;
      }
    });
    showToast(`EOD run: ${count} absence report${count!==1?"s":""} sent to HR`);
  };

  // ONLY Litisha can grant exception
  const grantException = () => {
    if (!isCRO) { showToast("Only Admin or CXO can grant exceptions", "err"); return; }
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
    if (!isCRO) { showToast("Only Admin or CXO can revoke exceptions", "err"); return; }
    setAbsenceReports(p => p.map(r => r.id === reportId
      ? { ...r, status:"Sent to HR", markedAs:"Absent", exception:null, exceptionBy:null, exceptionReason:null }
      : r
    ));
    showToast("Exception revoked — marked Absent again");
  };
  const user_role = USER_ROLES.find(u=>u.id===activeUser);
  const isCRO = ["ADMIN","CXO"].includes(user_role?.role);

  // Filtered visible deals
  const visibleDeals = deals.filter(d => {
    const regionOk = user_role.canView==="all" ? (filterRegion==="All"||d.region===filterRegion) : user_role.canView==="region" ? d.region===user_role.region : d.repId===user_role.repId;
    return regionOk && d.quarter===filterQ;
  });

  const closedDeals  = visibleDeals.filter(d=>d.outcome==="Proposal Accepted");
  const activeDeals  = visibleDeals.filter(d=>d.outcome!=="Not Interested");
  const atRisk       = activeDeals.filter(d=>d.outcome!=="Proposal Accepted" && daysSince(d.lastContact)>=7);
  const overdueNext  = activeDeals.filter(d=>d.nextStepDate && d.nextStepDate<TODAY && d.outcome!=="Proposal Accepted");
  const allReqs      = deals.flatMap((d,_)=>d.reqs.map((r,i)=>({...r,dealId:d.id,reqIdx:i,clientCompany:d.clientCompany,amount:d.amount,repId:d.repId})));
  const todayMtgs    = meetings.filter(m=>m.date===TODAY);

  const totalTarget  = visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
  const totalClosed  = closedDeals.reduce((s,d)=>s+(d.amount||0),0);
  const weightedPipe = activeDeals.filter(d=>d.outcome!=="Proposal Accepted").reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
  const forecast     = totalClosed+weightedPipe;
  const gap          = Math.max(0,totalTarget-forecast);
  const closePct     = totalTarget>0?Math.round((totalClosed/totalTarget)*100):0;
  const fcastPct     = totalTarget>0?Math.round((forecast/totalTarget)*100):0;

  const repScores = REPS
    .filter(r => user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId)
    .map(rep => {
      const rd      = deals.filter(d=>d.repId===rep.id&&d.quarter===filterQ);
      const closed  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
      const pipe    = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
      const rm      = meetings.filter(m=>m.repId===rep.id);
      const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
      const risk    = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
      const attOk   = att[TODAY]?.[rep.id];
      const cPct    = rep.target>0?Math.round((closed/rep.target)*100):0;
      const senPct  = rm.length>0?Math.round((seniorM/rm.length)*100):0;
      return {...rep,closed,pipe,meetings:rm.length,seniorM,senPct,risk,attOk,cPct,coverage:rep.target>0?Math.round(((closed+pipe)/rep.target)*100):0};
    }).sort((a,b)=>b.closed-a.closed);

  const updateOutcome = (id, outcome) => setDeals(p=>p.map(d=>d.id===id?{...d,outcome,lastContact:TODAY}:d));
  const updateReq     = (dealId, reqIdx, status) => setDeals(p=>p.map(d=>d.id===dealId?{...d,reqs:d.reqs.map((r,i)=>i===reqIdx?{...r,status}:r)}:d));

  const handleAddDeal = () => {
    if (!dealForm.clientCompany||!dealForm.repId||!dealForm.targetAmount){showToast("Fill required fields","err");return;}
    const rep=REPS.find(r=>r.id===parseInt(dealForm.repId));
    setDeals(p=>[...p,{id:`d${Date.now()}`,...dealForm,repId:parseInt(dealForm.repId),repName:rep.name,region:rep.region,amount:parseInt(dealForm.amount||dealForm.targetAmount),targetAmount:parseInt(dealForm.targetAmount),lastContact:null,reqs:[]}]);
    setDealForm(BLANK_DEAL);setAddDealOpen(false);showToast("Deal added");
  };

  const handleLogMeeting = () => {
    if (!logForm.repId) { showToast("Select a Sales Rep", "err"); return; }
    const rep  = REPS.find(r => r.id === parseInt(logForm.repId));
    const deal = deals.find(d => d.id === logForm.dealId);
    const now  = new Date();
    const late = now.getHours() >= 12;
    const loggedAt = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const clientCompany = deal?.clientCompany || logForm.clientAgencyName || "";
    setMeetings(p => [{
      id: `ml${Date.now()}`,
      ...logForm,
      repId: parseInt(logForm.repId),
      repName: rep.name,
      region: rep.region,
      clientCompany,
      date: TODAY,
      loggedAt,
      late,
      // outcome maps from status for pipeline update
      outcome: logForm.status === "Closed" ? "Proposal Accepted" : logForm.status || "Needs Callback",
    }, ...p]);
    // Update deal last contact + outcome if deal selected
    if (deal) setDeals(p => p.map(d => d.id === logForm.dealId
      ? { ...d, lastContact: TODAY, outcome: logForm.status === "Closed" ? "Proposal Accepted" : d.outcome, nextStep: logForm.nextSteps, nextStepDate: logForm.followUpDate || d.nextStepDate }
      : d
    ));
    setAtt(p => ({ ...p, [TODAY]: { ...(p[TODAY]||{}), [parseInt(logForm.repId)]: true } }));
    setLogForm(BLANK_LOG);
    setLogOpen(false);
    showToast(late ? "Meeting logged — flagged as late (after 12pm)" : "Meeting logged ✓");
  };

  // ─── CALENDAR INTEGRATION ────────────────────────────────────────────────────
  const createCalendarEvent = async (meeting) => {
    if (!meeting.nextMeetingDate) { showToast("Set a meeting date first", "err"); return null; }
    setCalendarLoading(true);
    try {
      const rep    = REPS.find(r => r.id === parseInt(meeting.repId));
      const title  = `[OTV] ${rep?.name || "Sales"} × ${meeting.clientCompany || meeting.clientAgencyName} — ${meeting.pitchType || "Meeting"}`;
      const desc   = [
        meeting.nextAgenda ? `Agenda: ${meeting.nextAgenda}` : "",
        meeting.discussion  ? `Last discussion: ${meeting.discussion}` : "",
        meeting.clientFeedback ? `Client feedback: ${meeting.clientFeedback}` : "",
        meeting.nextSteps ? `Next steps: ${meeting.nextSteps}` : "",
        "—",
        "Logged via OTV CRO Command",
      ].filter(Boolean).join("\n");

      const startTime  = meeting.nextMeetingTime || "10:00";
      const [sh, sm]   = startTime.split(":").map(Number);
      const endH       = String(sh + 1).padStart(2, "0");
      const startISO   = `${meeting.nextMeetingDate}T${startTime.padStart(5,"0")}:00`;
      const endISO     = `${meeting.nextMeetingDate}T${endH}:${String(sm).padStart(2,"0")}:00`;

      // Attendees — rep email + any extra
      const repEmail  = `${(rep?.name||"").toLowerCase().replace(/\s/g,".")}@odishatv.com`;
      const extras    = (meeting.attendeeEmails||"").split(",").map(e=>e.trim()).filter(Boolean);
      const attendees = [repEmail, ...extras];

      const calPrompt = meeting.calendarPlatform === "google"
        ? `Create a Google Calendar event with these exact details:
Title: "${title}"
Date: ${meeting.nextMeetingDate}
Start time: ${startISO} IST (UTC+5:30)
End time: ${endISO} IST (UTC+5:30)
Timezone: Asia/Kolkata
Description: ${desc}
Attendees: ${attendees.join(", ")}
${meeting.addMeetLink ? "Add Google Meet video conferencing link." : ""}
Use the primary calendar. Return the event ID and Meet link if created.`
        : `I need to create a calendar event titled "${title}" on ${meeting.nextMeetingDate} from ${startTime} to ${endH}:${String(sm).padStart(2,"0")} IST. Attendees: ${attendees.join(", ")}. Description: ${desc}. Please create this event.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: calPrompt }],
          mcp_servers: meeting.calendarPlatform === "google"
            ? [{ type: "url", url: "https://gcal.mcp.claude.com/mcp", name: "google-calendar" }]
            : [],
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);

      // Extract event details from response
      const responseText = (data.content || []).map(b => b.text || "").join("").trim();
      const meetLinkMatch = responseText.match(/https:\/\/meet\.google\.com\/[a-z0-9\-]+/i);
      const eventIdMatch  = responseText.match(/event[_\s]?id[:\s]+([a-zA-Z0-9_]+)/i);
      const meetLink      = meetLinkMatch ? meetLinkMatch[0] : "";
      const eventId       = eventIdMatch  ? eventIdMatch[1]  : `gcal_${Date.now()}`;

      setCalendarLoading(false);
      return { eventId, meetLink, calendarStatus: "Created", calendarPlatform: meeting.calendarPlatform };
    } catch (err) {
      setCalendarLoading(false);
      showToast("Calendar error: " + err.message, "err");
      return null;
    }
  };

  const handleLogMeetingWithCalendar = async () => {
    if (!logForm.repId) { showToast("Select a Sales Rep", "err"); return; }
    let calResult = null;
    if (logForm.scheduleNext && logForm.nextMeetingDate) {
      calResult = await createCalendarEvent(logForm);
    }
    const updatedForm = calResult ? { ...logForm, ...calResult } : logForm;
    const rep  = REPS.find(r => r.id === parseInt(updatedForm.repId));
    const deal = deals.find(d => d.id === updatedForm.dealId);
    const now  = new Date();
    const late = now.getHours() >= 12;
    const loggedAt = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const clientCompany = deal?.clientCompany || updatedForm.clientAgencyName || "";
    setMeetings(p => [{
      id: `ml${Date.now()}`,
      ...updatedForm,
      repId: parseInt(updatedForm.repId),
      repName: rep.name, region: rep.region,
      clientCompany, date: TODAY, loggedAt, late,
      outcome: updatedForm.status === "Closed" ? "Proposal Accepted" : updatedForm.status || "Needs Callback",
    }, ...p]);
    if (deal) setDeals(p => p.map(d => d.id === updatedForm.dealId
      ? { ...d, lastContact: TODAY, outcome: updatedForm.status === "Closed" ? "Proposal Accepted" : d.outcome, nextStep: updatedForm.nextSteps, nextStepDate: updatedForm.followUpDate || d.nextStepDate }
      : d
    ));
    setAtt(p => ({ ...p, [TODAY]: { ...(p[TODAY]||{}), [parseInt(updatedForm.repId)]: true } }));
    setLogForm(BLANK_LOG);
    setLogOpen(false);
    if (calResult?.meetLink) {
      showToast(`Meeting logged + Calendar event created ✓`);
    } else {
      showToast(late ? "Meeting logged — flagged as late (after 12pm)" : "Meeting logged ✓");
    }
  };

  const ALL_NAV = [
    {id:"ro-parser",    label:"RO Parser",    icon:"↑", group:"ro"},
    {id:"ro-management",label:"RO Management",icon:"≡", group:"ro"},
    {id:"divider", group:"crm"},
    {id:"warroom",    label:"War Room",    icon:"⬡", badge:atRisk.length+overdueNext.length||null, group:"crm"},
    {id:"pipeline",   label:"Pipeline",    icon:"◈", group:"crm"},
    {id:"targets",    label:"Targets",     icon:"◎", group:"crm"},
    {id:"team",       label:"Team",        icon:"◇", group:"crm"},
    {id:"activity",   label:"Activity",    icon:"≡", group:"crm"},
    {id:"escalations",label:"Escalations", icon:"▲", badge:allReqs.filter(r=>r.status==="Overdue").length||null, group:"crm"},
    {id:"compliance", label:"Compliance",  icon:"✦", group:"crm"},
    {id:"hr",         label:"HR Reports",  icon:"⊘", badge:absenceReports.filter(r=>r.markedAs==="Absent"&&r.status==="Sent to HR").length||null, group:"crm"},
  ];

  const nav = appMode === "ro"
    ? ALL_NAV.filter(n => n.group === "ro")
    : ALL_NAV.filter(n => n.group === "crm" && n.id !== "divider");

  return (
    <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",fontSize:13}}>
      <style>{`
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
      `}</style>

      {/* TOPBAR */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:3}}>OTV</span>
          <span style={{color:C.muted}}>|</span>
          <span className="sans" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:2,textTransform:"uppercase"}}>{appMode==="ro"?"RO Management":"CRO Command"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onHome} style={{display:"flex",alignItems:"center",gap:5,background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"border-color .15s,color .15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
            ⌂ Home
          </button>
          <select value={filterQ} onChange={e=>setFilterQ(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select>
          {user_role.canView==="all" && <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}><option>All</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>}
          <div style={{width:1,height:20,background:C.border}} />
          <select value={activeUser} onChange={e=>setActiveUser(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px",color:C.accent,background:`${C.accent}18`,borderColor:`${C.accent}44`}}>
            {USER_ROLES.map(u=><option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
          </select>
          <div style={{width:1,height:20,background:C.border}} />
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent}}>
              {(user.name||"?")[0].toUpperCase()}
            </div>
            <span style={{fontSize:11,color:C.dim,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
          </div>
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 9px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"border-color .15s,color .15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
            Sign out
          </button>
          <span className="pulse" style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block"}} />
          <span style={{fontSize:10,color:C.green,fontWeight:700}}>LIVE</span>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* SIDEBAR */}
        <div style={{width:158,background:C.surface,borderRight:`1px solid ${C.border}`,padding:"10px 0",flexShrink:0,display:"flex",flexDirection:"column"}}>

          {/* MODULE SWITCHER */}
          <div style={{padding:"8px 10px 10px",borderBottom:`1px solid ${C.border}`,marginBottom:8}}>
            <div style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6,paddingLeft:4}}>Module</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {[
                {mode:"ro",  label:"RO Manager", icon:"📋", active:"#a855f7"},
                {mode:"crm", label:"CRM",         icon:"⬡",  active:C.accent},
              ].map(m=>(
                <button key={m.mode}
                  onClick={()=>{ onSwitchModule(m.mode); }}
                  style={{width:"100%",padding:"6px 10px",background:appMode===m.mode?`${m.active}18`:"transparent",border:`1px solid ${appMode===m.mode?`${m.active}55`:C.border}`,borderRadius:5,color:appMode===m.mode?m.active:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",textAlign:"left",display:"flex",alignItems:"center",gap:7,transition:"all .15s",fontWeight:appMode===m.mode?600:400}}
                  onMouseOver={e=>{if(appMode!==m.mode){e.currentTarget.style.borderColor=`${m.active}55`;e.currentTarget.style.color=m.active;}}}
                  onMouseOut={e=>{if(appMode!==m.mode){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}}>
                  <span style={{fontSize:12}}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
          </div>
          {nav.map(n=> n.id==="divider" ? (
            <div key="divider" style={{height:1,background:C.border,margin:"6px 14px"}} />
          ) : (
            <button key={n.id} onClick={()=>setView(n.id)} style={{width:"100%",padding:"9px 14px",background:view===n.id?`${C.accent}12`:"transparent",border:"none",borderLeft:view===n.id?`2px solid ${C.accent}`:"2px solid transparent",color:view===n.id?C.accent:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:view===n.id?600:400,letterSpacing:".04em",textAlign:"left",transition:"all .1s"}}>
              <span style={{fontSize:13,opacity:.8}}>{n.icon}</span>
              <span style={{flex:1}}>{n.label}</span>
              {n.badge>0 && <span style={{background:C.red,color:"#fff",borderRadius:"50%",width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800}}>{n.badge}</span>}
            </button>
          ))}
          <div style={{flex:1}} />
          {appMode==="crm" ? (
            <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.dim,marginBottom:5,letterSpacing:".08em",fontWeight:700}}>FORECAST QTD</div>
              <div className="sans" style={{fontSize:22,fontWeight:700,color:fcastPct>=100?C.green:fcastPct>=75?C.accent:C.red}}>{fcastPct}%</div>
              <div className="pbar" style={{marginTop:5}}><div className="pfill" style={{width:`${Math.min(fcastPct,100)}%`,background:fcastPct>=100?C.green:fcastPct>=75?C.accent:C.red}} /></div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>{fmtR(forecast)} / {fmtR(totalTarget)}</div>
            </div>
          ) : (
            <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.dim,marginBottom:5,letterSpacing:".08em",fontWeight:700}}>SAVED ROs</div>
              <div className="sans" style={{fontSize:22,fontWeight:700,color:C.accent}}>{savedROs.length}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>{savedROs.filter(r=>r.status==="Exported").length} exported</div>
            </div>
          )}
        </div>

        {/* MAIN */}
        <div style={{flex:1,overflow:"auto",padding:20}}>

          {/* ═══ RO PARSER ═══ */}
          {view==="ro-parser" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>RO PARSER</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Zoho CRM ready · Deal + Breakup + Summary · All agency formats · v9.5</div>
                </div>
                {roResults.length>1&&<button onClick={roExportAll} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"8px 18px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'DM Mono',monospace"}}>Export All ({roResults.length}) →</button>}
              </div>

              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:14}}>
                <div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"6px 11px",marginBottom:10,fontSize:11,color:"#16c784"}}>
                  Apple Numbers (.numbers) not supported — export as Excel (.xlsx) via File → Export To → Excel
                </div>
                <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={()=>roFileRef.current.click()} style={{background:C.s2,color:C.dim,border:`1px solid ${C.border}`,padding:"7px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                    {roFiles.length?`${roFiles.length} file(s) selected`:"Upload Files"}
                  </button>
                  <span style={{color:C.muted,fontSize:11}}>PDF · Image · Excel (.xlsx) · CSV · TXT</span>
                  {roFiles.length>0&&<span>{Array.from(roFiles).map((f,i)=><span key={i} style={{background:"#0f2a4a",color:"#60a5fa",padding:"2px 8px",borderRadius:10,fontSize:11,marginRight:4}}>{f.name}</span>)}<button onClick={()=>{setRoFiles([]);roFileRef.current.value="";}} style={{background:"transparent",color:C.red,border:"none",cursor:"pointer",fontSize:12}}>✕</button></span>}
                </div>
                <input ref={roFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.xlsx,.xls,.csv" multiple onChange={e=>{setRoFiles(Array.from(e.target.files));setRoResults([]);setRoError(null);}} style={{display:"none"}} />
                {roFiles.length===0&&<textarea value={roInputText} onChange={e=>setRoInputText(e.target.value)} placeholder="Or paste any RO text here..." style={{width:"100%",minHeight:80,background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:11,color:C.text,fontSize:12,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}} />}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {["WPP","EssenceMediacom","Zenith","Spark","Madison","FCBUlka","Prachar","ENES","Direct Client"].map(f=><span key={f} style={{background:C.s2,color:C.muted,padding:"2px 7px",borderRadius:8,fontSize:10,border:`1px solid ${C.border}`}}>✓ {f}</span>)}
                  </div>
                  <button onClick={roParseAll} disabled={(!roFiles.length&&!roInputText.trim())||roLoading} style={{background:(!roFiles.length&&!roInputText.trim())||roLoading?C.s3:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:(!roFiles.length&&!roInputText.trim())||roLoading?C.muted:"#fff",border:"none",padding:"9px 24px",borderRadius:6,cursor:(!roFiles.length&&!roInputText.trim())||roLoading?"not-allowed":"pointer",fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace"}}>
                    {roLoading?(roProgress||"Parsing..."):`Parse ${roFiles.length>1?roFiles.length+" ROs":"RO"}`}
                  </button>
                </div>
              </div>

              {roError&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:7,padding:11,color:"#fca5a5",fontSize:11,marginBottom:12,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{roError}</div>}

              {roResults.length>0&&(
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:7,alignItems:"center"}}>
                    {roResults.map((r,i)=>(
                      <button key={i} onClick={()=>setRoActiveDoc(i)} style={{background:roActiveDoc===i?"#6366f1":C.surface,color:roActiveDoc===i?"#fff":C.dim,border:`1px solid ${C.border}`,padding:"4px 11px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                        {roNormalizeChannel(r.channel)||r.client_name||r._filename}
                      </button>
                    ))}
                    <button onClick={()=>roSaveResult(roResults[roActiveDoc])} style={{background:C.s2,color:"#16c784",border:"1px solid #166534",padding:"4px 11px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>Save to RO Mgmt</button>
                  </div>
                  {roResults.length>1&&<div style={{background:"#0a1a0a",border:"1px solid #166534",borderRadius:6,padding:"5px 11px",fontSize:11,color:"#16c784"}}>{roResults.length} deal records — {roResults.map(r=>roNormalizeChannel(r.channel)||r.client_name).join(", ")}</div>}
                </div>
              )}

              {roResults[roActiveDoc]&&<ROCard result={roResults[roActiveDoc]} onExport={roExportSingle} />}
            </div>
          )}

          {/* ═══ RO MANAGEMENT ═══ */}
          {view==="ro-management" && (
            <div className="fin">
              {/* HEADER */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
                <div>
                  <div className="sans" style={{fontSize:20,fontWeight:700,margin:0}}>RO Management</div>
                  <p style={{color:C.dim,fontSize:13,margin:"3px 0 0"}}>{savedROs.length} release order{savedROs.length!==1?"s":""} total</p>
                </div>
                <button onClick={()=>setView("ro-parser")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>+ Add RO</button>
              </div>

              {/* TOOLBAR */}
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <input
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",color:C.text,fontSize:13,outline:"none",flex:1,minWidth:200,fontFamily:"'DM Mono',monospace"}}
                  placeholder="Search by client, RO number, agency..."
                  value={roSearch} onChange={e=>setRoSearch(e.target.value)}
                />
                <select
                  value={roMgmtChannel} onChange={e=>setRoMgmtChannel(e.target.value)}
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:12,outline:"none",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                  <option value="all">All Channels</option>
                  {Array.from(new Set(savedROs.map(r=>roNormalizeChannel(r.channel)).filter(Boolean))).map(ch=><option key={ch} value={ch}>{ch}</option>)}
                </select>
                <select
                  value={roMgmtStatus} onChange={e=>setRoMgmtStatus(e.target.value)}
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:12,outline:"none",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                  <option value="all">All Status</option>
                  <option value="Parsed">Parsed</option>
                  <option value="Exported">Exported</option>
                </select>
                {(roSearch||roMgmtChannel!=="all"||roMgmtStatus!=="all")&&(
                  <button onClick={()=>{setRoSearch("");setRoMgmtChannel("all");setRoMgmtStatus("all");}} style={{background:"#450a0a",color:C.red,border:"none",padding:"7px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>Clear filters</button>
                )}
              </div>

              {/* TABLE */}
              {(() => {
                const filtered=savedROs.filter(ro=>{
                  const q=roSearch.toLowerCase();
                  const matchSearch=!q||[(ro.client_name||""),(ro.ro_number||""),(ro.agency_name||""),(ro.brand_name||"")].some(v=>v.toLowerCase().includes(q));
                  const matchChannel=roMgmtChannel==="all"||roNormalizeChannel(ro.channel)===roMgmtChannel;
                  const matchStatus=roMgmtStatus==="all"||ro.status===roMgmtStatus;
                  return matchSearch&&matchChannel&&matchStatus;
                });
                return (
                  <>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:roMgmtViewRO?20:0}}>
                      {filtered.length===0?(
                        <div style={{padding:48,textAlign:"center",color:C.dim,fontSize:13}}>
                          {savedROs.length===0
                            ?<span>No ROs yet. <button onClick={()=>setView("ro-parser")} style={{color:"#a78bfa",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Parse your first RO →</button></span>
                            :"No ROs match the current filters."}
                        </div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr>{["Client / Brand","Channel","RO Number","Agency","Gross Amount","Date Saved","Status","Actions"].map(h=>(
                              <th key={h} style={{padding:"9px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",letterSpacing:".05em"}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {filtered.map(ro=>(
                              <tr key={ro.id} style={{background:roMgmtViewRO?.id===ro.id?"#1a1a3a":"transparent",transition:"background .15s"}}>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,color:C.text}}>
                                  <div style={{fontWeight:600}}>{ro.client_name||"---"}</div>
                                  {ro.brand_name&&<div style={{color:C.dim,fontSize:11}}>{ro.brand_name}</div>}
                                </td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`}}>
                                  <span style={{background:"#1a1a3a",color:"#a855f7",padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:600}}>
                                    {roNormalizeChannel(ro.channel)||"---"}
                                  </span>
                                </td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,color:C.dim,fontFamily:"monospace"}}>{ro.ro_number||"---"}</td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,color:C.dim,fontSize:11}}>{ro.agency_name||"---"}</td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,color:"#16c784",fontWeight:600}}>{ro.gross_amount?roFmtMoney(ro.gross_amount):"---"}</td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,color:C.dim}}>{(ro.savedAt||"").slice(0,10)}</td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`}}>
                                  <span style={{background:ro.status==="Exported"?"#0a1a0a":"#1a1a3a",color:ro.status==="Exported"?"#16c784":"#a855f7",padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:600}}>
                                    {ro.status}
                                  </span>
                                </td>
                                <td style={{padding:"11px 12px",borderBottom:`1px solid ${C.s2}`,whiteSpace:"nowrap"}}>
                                  <button style={{background:"transparent",border:"none",color:"#7dd3fc",cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:"'DM Mono',monospace"}}
                                    onClick={()=>setRoMgmtViewRO(roMgmtViewRO?.id===ro.id?null:ro)}>
                                    {roMgmtViewRO?.id===ro.id?"Hide":"View"}
                                  </button>
                                  <button style={{background:"transparent",border:"none",color:"#16c784",cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:"'DM Mono',monospace"}}
                                    onClick={()=>roExportSingle(ro.data)}>Export</button>
                                  <button style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:"'DM Mono',monospace"}}
                                    onClick={()=>setRoMgmtConfirmDelete(ro.id)}>Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* INLINE ROCard VIEW */}
                    {roMgmtViewRO&&(
                      <div style={{marginBottom:24}}>
                        <ROCard result={roMgmtViewRO.data} onExport={()=>roExportSingle(roMgmtViewRO.data)} />
                      </div>
                    )}

                    {/* DELETE CONFIRM MODAL */}
                    {roMgmtConfirmDelete&&(
                      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
                        <div style={{background:C.surface,border:"1px solid #7f1d1d",borderRadius:12,padding:28,maxWidth:360,width:"90%"}}>
                          <div style={{fontWeight:700,fontSize:16,marginBottom:10,color:C.text}}>Delete this RO?</div>
                          <div style={{color:C.dim,fontSize:13,marginBottom:24}}>This action cannot be undone.</div>
                          <div style={{display:"flex",gap:10}}>
                            <button onClick={()=>{setSavedROs(p=>p.filter(r=>r.id!==roMgmtConfirmDelete));if(roMgmtViewRO?.id===roMgmtConfirmDelete)setRoMgmtViewRO(null);setRoMgmtConfirmDelete(null);showToast("RO deleted");}}
                              style={{flex:1,background:"#7f1d1d",color:"#fca5a5",border:"none",borderRadius:8,padding:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Delete</button>
                            <button onClick={()=>setRoMgmtConfirmDelete(null)}
                              style={{flex:1,background:C.s3,color:C.dim,border:"none",borderRadius:8,padding:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {/* ═══ WAR ROOM ═══ */}
          {view==="warroom" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})} — What needs your attention today</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-ghost" onClick={()=>setLogOpen(true)}>+ Log Meeting</button>
                  <button className="btn btn-primary" onClick={()=>setAddDealOpen(true)}>+ Add Deal</button>
                </div>
              </div>

              {/* HEADLINE KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"CLOSED QTD",    value:fmtR(totalClosed), sub:`${closePct}% of target`,  color:C.green,  bar:closePct},
                  {label:"FORECAST",       value:fmtR(forecast),    sub:`${fcastPct}% likely`,     color:fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red, bar:fcastPct},
                  {label:"GAP TO TARGET",  value:fmtR(gap),         sub:gap===0?"on track":"uncovered", color:gap===0?C.green:C.red, bar:null},
                  {label:"AT RISK",        value:atRisk.length,     sub:`${fmtR(atRisk.reduce((s,d)=>s+d.amount,0))} at stake`, color:atRisk.length>0?C.red:C.green, bar:null},
                  {label:"OVERDUE ACTIONS",value:overdueNext.length,sub:"next steps past due",     color:overdueNext.length>0?C.orange:C.green, bar:null},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                    <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>
                    {k.bar!==null && <div className="pbar" style={{marginTop:7}}><div className="pfill" style={{width:`${Math.min(k.bar,100)}%`,background:k.color}} /></div>}
                  </div>
                ))}
              </div>

              {/* AT RISK */}
              {atRisk.length>0 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>NO CONTACT 7+ DAYS — DEALS AT RISK</div>
                  {atRisk.map(d=>{const rep=REPS.find(r=>r.id===d.repId); return (
                    <div key={d.id} style={{background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:5,padding:"9px 13px",marginBottom:5,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:12}}> · {d.contactName} · {d.designation}</span><span className="pill" style={{background:`${oColor(d.outcome)}22`,color:oColor(d.outcome),marginLeft:8}}>{d.outcome}</span></div>
                      <span style={{color:C.red,fontSize:11,whiteSpace:"nowrap"}}>{daysSince(d.lastContact)}d idle</span>
                      <span style={{color:C.accent,fontWeight:700,whiteSpace:"nowrap"}}>{fmtR(d.amount)}</span>
                      <span style={{color:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{rep?.name}</span>
                    </div>
                  );})}
                </div>
              )}

              {/* OVERDUE NEXT STEPS */}
              {overdueNext.length>0 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>OVERDUE NEXT STEPS</div>
                  {overdueNext.map(d=>{const rep=REPS.find(r=>r.id===d.repId); return (
                    <div key={d.id} style={{background:`${C.orange}08`,border:`1px solid ${C.orange}33`,borderRadius:5,padding:"9px 13px",marginBottom:5,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:12}}> · {d.nextStep}</span></div>
                      <span style={{color:C.orange,fontSize:11}}>was due {d.nextStepDate}</span>
                      <span style={{color:C.dim,fontSize:11}}>{rep?.name}</span>
                    </div>
                  );})}
                </div>
              )}

              {/* HIGH PROBABILITY DEALS */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>HIGH PROBABILITY — PUSH TO CLOSE</div>
                {visibleDeals.filter(d=>["Very Interested","Proposal Accepted"].includes(d.outcome)).sort((a,b)=>b.amount-a.amount).slice(0,6).map(d=>{
                  const rep=REPS.find(r=>r.id===d.repId); const prob=STAGE_PROB[d.outcome];
                  return (
                    <div key={d.id} className="row" style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:oColor(d.outcome),flexShrink:0}} />
                      <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:12}}> · {d.contactName}</span>{d.priority==="Top 5"&&<span className="pill" style={{background:`${C.accent}22`,color:C.accent,marginLeft:6,fontSize:10}}>T5</span>}</div>
                      <div className="pbar" style={{width:55}}><div className="pfill" style={{width:`${prob}%`,background:oColor(d.outcome)}} /></div>
                      <span style={{color:C.dim,fontSize:10,width:28}}>{prob}%</span>
                      <span style={{color:C.accent,fontWeight:700,width:60,textAlign:"right"}}>{fmtR(d.amount)}</span>
                      <span style={{color:C.dim,fontSize:11,width:90}}>{rep?.name}</span>
                      <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{width:175,fontSize:11,padding:"4px 6px",background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),border:`1px solid ${oColor(d.outcome)}44`,borderRadius:3}}>
                        {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* TODAY SUMMARY */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div className="card" style={{padding:14}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>TODAY — {todayMtgs.length} MEETINGS LOGGED</div>
                  {todayMtgs.length===0 && <div style={{color:C.muted,fontSize:12}}>No meetings logged yet today</div>}
                  {todayMtgs.map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span className="pill" style={{background:`${lColor(m.contactLevel)}22`,color:lColor(m.contactLevel)}}>{(m.contactLevel||"").split(" /")[0]||"—"}</span>
                      <span className="sans" style={{flex:1,fontSize:12,fontWeight:600}}>{m.clientCompany}</span>
                      <span style={{fontSize:10,color:m.late?C.orange:C.green}}>{m.loggedAt} {m.late?"⚠":"✓"}</span>
                      <span style={{fontSize:10,color:C.dim}}>{m.repName}</span>
                    </div>
                  ))}
                </div>
                <div className="card" style={{padding:14}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>COMPLIANCE — TODAY</div>
                  {REPS.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(r=>{
                    const logged=att[TODAY]?.[r.id];
                    return (
                      <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:13,color:logged?C.green:C.red,fontWeight:700}}>{logged?"✓":"✗"}</span>
                        <span className="sans" style={{flex:1,fontSize:12,fontWeight:logged?500:700,color:logged?C.text:C.red}}>{r.name}</span>
                        <span style={{fontSize:10,color:C.dim}}>{r.region}</span>
                        {!logged&&<span className="pill" style={{background:`${C.red}22`,color:C.red}}>NEG ATT</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ PIPELINE ═══ */}
          {view==="pipeline" && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>PIPELINE</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Weighted forecast: {fmtR(weightedPipe)} · {activeDeals.filter(d=>d.outcome!=="Proposal Accepted").length} open deals</div>
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
                      <table>
                        <thead><tr><th>Client</th><th>Contact</th><th>Level</th><th>Amount</th><th>Idle</th><th>Rep</th><th>Next Step</th><th>Risk</th><th>Update Stage</th></tr></thead>
                        <tbody>
                          {sd.sort((a,b)=>b.amount-a.amount).map(d=>{
                            const rep=REPS.find(r=>r.id===d.repId); const idle=daysSince(d.lastContact);
                            return (
                              <>
                                <tr key={d.id} style={{cursor:"pointer"}} onClick={()=>setExpanded(expanded===d.id?null:d.id)}>
                                  <td><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span>{d.priority==="Top 5"&&<span className="pill" style={{background:`${C.accent}22`,color:C.accent,marginLeft:5,fontSize:9}}>T5</span>}</td>
                                  <td style={{color:C.dim}}><div>{d.contactName}</div><div style={{fontSize:10}}>{d.designation}</div></td>
                                  <td><span className="pill" style={{background:`${lColor(d.contactLevel)}18`,color:lColor(d.contactLevel)}}>{(d.contactLevel||"").split(" /")[0]}</span></td>
                                  <td style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</td>
                                  <td style={{color:idle>=7?C.red:idle>=3?C.orange:C.green}}>{idle===0?"today":`${idle}d`}</td>
                                  <td style={{color:C.dim}}>{rep?.name}</td>
                                  <td style={{color:C.dim,maxWidth:150,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.nextStep||"—"}</td>
                                  <td><span className="pill" style={{background:`${riskColor(d)}22`,color:riskColor(d)}}>{riskLabel(d)}</span></td>
                                  <td>
                                    <select value={d.outcome} onClick={e=>e.stopPropagation()} onChange={e=>updateOutcome(d.id,e.target.value)} style={{width:165,fontSize:11,padding:"3px 6px",background:`${oColor(d.outcome)}15`,color:oColor(d.outcome),border:"none",borderRadius:3}}>
                                      {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                                    </select>
                                  </td>
                                </tr>
                                {expanded===d.id && (
                                  <tr key={`${d.id}-exp`}><td colSpan={9} style={{background:C.s2,padding:14}}>
                                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                                      <div><label>Notes</label><div>{d.notes||"—"}</div></div>
                                      <div><label>Contact</label><div>{d.phone}</div><div>{d.email}</div></div>
                                      <div><label>Internal Requests</label>
                                        {d.reqs.length===0&&<span style={{color:C.muted}}>None</span>}
                                        {d.reqs.map((r,i)=>(
                                          <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                                            <span className="pill" style={{background:`${C.blue}22`,color:C.blue,fontSize:10}}>{r.dept}</span>
                                            <span style={{flex:1,fontSize:11}}>{r.desc}</span>
                                            <select value={r.status} onChange={e=>updateReq(d.id,i,e.target.value)} style={{width:95,fontSize:10,padding:"2px 5px",background:r.status==="Done"?`${C.green}22`:`${C.orange}22`,color:r.status==="Done"?C.green:C.orange,border:"none",borderRadius:3}}>
                                              {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                                            </select>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td></tr>
                                )}
                              </>
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

          {/* ═══ TARGETS ═══ */}
          {view==="targets" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:8}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TARGETS vs ACHIEVEMENT</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{filterQ} · {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{fontSize:11,color:C.dim}}>Viewing as <span style={{color:C.accent}}>{user_role.name}</span> · <span style={{color:C.accent}}>{user_role.role}</span></div>
              </div>

              {/* ── MASTER SUMMARY TILE ── */}
              {(() => {
                const allD = deals.filter(d=>d.quarter===filterQ);
                const mTarget  = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                const mClosed  = allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                const mPipe    = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const mWPipe   = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                const mForecast= mClosed+mWPipe;
                const mGap     = Math.max(0,mTarget-mForecast);
                const mClosePct= mTarget>0?Math.round((mClosed/mTarget)*100):0;
                const mFcastPct= mTarget>0?Math.round((mForecast/mTarget)*100):0;
                const statusColor = mFcastPct>=100?C.green:mFcastPct>=75?C.accent:C.red;
                return (
                  <div style={{background:C.surface,border:`2px solid ${statusColor}`,borderRadius:12,padding:"22px 24px",marginBottom:20,position:"relative",overflow:"hidden"}}>
                    {/* Background glow */}
                    <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:`${statusColor}08`,pointerEvents:"none"}} />
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
                      <div>
                        <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Total Organisation · {filterQ}</div>
                        <div className="sans" style={{fontSize:13,color:C.dim,marginBottom:4}}>Target</div>
                        <div className="sans" style={{fontSize:36,fontWeight:800,color:C.text,lineHeight:1,marginBottom:8}}>{fmtR(mTarget)}</div>
                        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:2}}>CLOSED</div>
                            <div className="sans" style={{fontSize:20,fontWeight:700,color:C.green}}>{fmtR(mClosed)}</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:2}}>PIPELINE</div>
                            <div className="sans" style={{fontSize:20,fontWeight:700,color:C.accent}}>{fmtR(mPipe)}</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:2}}>FORECAST</div>
                            <div className="sans" style={{fontSize:20,fontWeight:700,color:statusColor}}>{fmtR(mForecast)}</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:2}}>GAP</div>
                            <div className="sans" style={{fontSize:20,fontWeight:700,color:mGap===0?C.green:C.red}}>{fmtR(mGap)}</div>
                          </div>
                        </div>
                      </div>
                      {/* Big percentage */}
                      <div style={{textAlign:"right"}}>
                        <div className="sans" style={{fontSize:64,fontWeight:800,color:statusColor,lineHeight:1}}>{mFcastPct}%</div>
                        <div style={{fontSize:11,color:C.dim,marginTop:4}}>forecast achievement</div>
                        <div style={{fontSize:11,color:C.green,marginTop:2}}>{mClosePct}% closed</div>
                      </div>
                    </div>
                    {/* Master progress bar */}
                    <div style={{marginTop:18}}>
                      <div style={{height:10,background:C.s3,borderRadius:5,overflow:"hidden",position:"relative"}}>
                        <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(mClosePct,100)}%`,background:C.green,borderRadius:5,transition:"width .6s"}} />
                        <div style={{position:"absolute",left:`${mClosePct}%`,height:"100%",width:`${Math.min(mFcastPct-mClosePct,100-mClosePct)}%`,background:`${C.accent}bb`,transition:"width .6s"}} />
                      </div>
                      <div style={{display:"flex",gap:20,marginTop:7}}>
                        <span style={{fontSize:10,color:C.green}}>● Closed {mClosePct}%</span>
                        <span style={{fontSize:10,color:C.accent}}>● Pipeline {mFcastPct-mClosePct}%</span>
                        <span style={{fontSize:10,color:C.muted}}>● Gap {Math.max(0,100-mFcastPct)}%</span>
                        <span style={{fontSize:10,color:C.dim,marginLeft:"auto"}}>{allD.filter(d=>d.outcome==="Proposal Accepted").length} deals closed · {allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).length} in pipeline</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── 7 REGION SUB-TILES ── */}
              {(() => {
                const REGION_TILES = [
                  { key:"North",       label:"North",          icon:"↑", color:"#60a5fa" },
                  { key:"South",       label:"South",          icon:"↓", color:"#a855f7" },
                  { key:"West",        label:"West",           icon:"←", color:"#f97316" },
                  { key:"East",        label:"East",           icon:"→", color:"#16c784" },
                  { key:"Odisha",      label:"Odisha",         icon:"◈", color:"#f0a500" },
                  { key:"DigitalOnly", label:"Digital Only",   icon:"◉", color:"#2d7dd2" },
                  { key:"DigitalTV",   label:"Digital + TV",   icon:"⬡", color:"#ea3943" },
                ];

                const getTileDeals = (key) => {
                  if (key==="DigitalOnly") return deals.filter(d=>d.quarter===filterQ && d.dealType==="Digital");
                  if (key==="DigitalTV")   return deals.filter(d=>d.quarter===filterQ && ["Digital","Linear TV","Integrated Package","Branded Content"].includes(d.dealType));
                  return deals.filter(d=>d.quarter===filterQ && d.region===key);
                };

                // DRILL-DOWN VIEW
                if (targetDrilldown) {
                  const tile = REGION_TILES.find(t=>t.key===targetDrilldown.key);
                  const tileDeals = getTileDeals(targetDrilldown.key);
                  const tTarget = tileDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const tClosed = tileDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                  const tPipe   = tileDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                  const tShortfall = Math.max(0,tTarget-tClosed);

                  return (
                    <div className="fin">
                      {/* BACK + HEADER */}
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
                        <button onClick={()=>setTargetDrilldown(null)}
                          style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:5,transition:"border-color .15s,color .15s"}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=tile.color;e.currentTarget.style.color=tile.color;}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                          ← Back
                        </button>
                        <div style={{width:34,height:34,borderRadius:8,background:`${tile.color}22`,border:`1px solid ${tile.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:tile.color,fontWeight:700}}>{tile.icon}</div>
                        <div>
                          <div className="sans" style={{fontSize:16,fontWeight:700,color:C.text}}>{tile.label}</div>
                          <div style={{fontSize:11,color:C.dim}}>{tileDeals.length} client{tileDeals.length!==1?"s":""} · {filterQ}</div>
                        </div>
                      </div>

                      {/* MINI SUMMARY STRIP */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:18}}>
                        {[
                          {label:"TARGET",    value:fmtR(tTarget),    color:C.blue},
                          {label:"ACHIEVED",  value:fmtR(tClosed),    color:C.green},
                          {label:"PIPELINE",  value:fmtR(tPipe),      color:C.accent},
                          {label:"SHORTFALL", value:fmtR(tShortfall), color:tShortfall===0?C.green:C.red},
                          {label:"ACHIEVE %", value:`${tTarget>0?Math.round((tClosed/tTarget)*100):0}%`, color:tTarget>0&&tClosed>=tTarget?C.green:C.accent},
                        ].map(k=>(
                          <div key={k.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`2px solid ${k.color}`,borderRadius:8,padding:"12px 14px"}}>
                            <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                            <div className="sans" style={{fontSize:18,fontWeight:700,color:k.color}}>{k.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* CLIENT TABLE */}
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr>
                              {["Client","Rep","Deal Type","Target","Achieved","In Pipeline","Shortfall","Stage"].map(h=>(
                                <th key={h} style={{padding:"9px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",letterSpacing:".05em"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tileDeals.length===0 && (
                              <tr><td colSpan={8} style={{padding:32,textAlign:"center",color:C.muted,fontSize:12}}>No deals found for this region / category.</td></tr>
                            )}
                            {tileDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                              const rep       = REPS.find(r=>r.id===d.repId);
                              const achieved  = d.outcome==="Proposal Accepted" ? d.amount : 0;
                              const pipeline  = !["Proposal Accepted","Not Interested"].includes(d.outcome) ? d.amount : 0;
                              const shortfall = Math.max(0,(d.targetAmount||0)-achieved);
                              const achPct    = d.targetAmount>0 ? Math.round((achieved/d.targetAmount)*100) : 0;
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,transition:"background .1s"}}
                                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                  onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"11px 12px"}}>
                                    <div className="sans" style={{fontWeight:700,color:C.text}}>{d.clientCompany}</div>
                                    {d.priority==="Top 5" && <span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 6px",borderRadius:8,fontSize:9,fontWeight:700}}>TOP 5</span>}
                                  </td>
                                  <td style={{padding:"11px 12px",color:C.dim,fontSize:11}}>
                                    <div>{rep?.name||"—"}</div>
                                    <div style={{fontSize:10,color:C.muted}}>{d.region}</div>
                                  </td>
                                  <td style={{padding:"11px 12px"}}>
                                    <span style={{background:C.s3,color:C.dim,padding:"2px 7px",borderRadius:8,fontSize:10}}>{d.dealType||"—"}</span>
                                  </td>
                                  <td style={{padding:"11px 12px",color:C.text,fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                  <td style={{padding:"11px 12px"}}>
                                    <div style={{color:achieved>0?C.green:C.muted,fontWeight:achieved>0?700:400}}>{achieved>0?fmtR(achieved):"—"}</div>
                                    {achieved>0 && <div style={{fontSize:9,color:C.dim,marginTop:1}}>{achPct}% of target</div>}
                                  </td>
                                  <td style={{padding:"11px 12px",color:pipeline>0?C.accent:C.muted,fontWeight:pipeline>0?600:400}}>{pipeline>0?fmtR(pipeline):"—"}</td>
                                  <td style={{padding:"11px 12px"}}>
                                    <div style={{color:shortfall===0?C.green:C.red,fontWeight:700}}>{shortfall===0?"✓ On track":fmtR(shortfall)}</div>
                                    {shortfall>0 && (
                                      <div style={{marginTop:3,height:3,width:60,background:C.s3,borderRadius:2,overflow:"hidden"}}>
                                        <div style={{height:"100%",width:`${Math.min(achPct,100)}%`,background:achPct>=100?C.green:achPct>=50?C.accent:C.red,borderRadius:2,transition:"width .4s"}} />
                                      </div>
                                    )}
                                  </td>
                                  <td style={{padding:"11px 12px"}}>
                                    <span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{d.outcome}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                // TILE GRID VIEW
                return (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                    {REGION_TILES.map(tile=>{
                      const tileDeals = getTileDeals(tile.key);
                      const tTarget  = tileDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const tClosed  = tileDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                      const tPipe    = tileDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const tWPipe   = tileDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                      const tForecast= tClosed+tWPipe;
                      const tGap     = Math.max(0,tTarget-tForecast);
                      const tClosePct= tTarget>0?Math.round((tClosed/tTarget)*100):0;
                      const tFcastPct= tTarget>0?Math.round((tForecast/tTarget)*100):0;
                      const tReps    = [...new Set(tileDeals.map(d=>d.repName))].filter(Boolean);
                      const tAtRisk  = tileDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                      const tColor   = tFcastPct>=100?C.green:tFcastPct>=75?C.accent:tFcastPct>=50?tile.color:C.red;

                      return (
                        <div key={tile.key}
                          onClick={()=>setTargetDrilldown(tile)}
                          style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px",transition:"border-color .2s,transform .15s,box-shadow .2s",cursor:"pointer"}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=tile.color;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 24px ${tile.color}18`;}}
                          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>

                          {/* Tile header */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:32,height:32,borderRadius:8,background:`${tile.color}22`,border:`1px solid ${tile.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:tile.color,fontWeight:700}}>
                                {tile.icon}
                              </div>
                              <div>
                                <div className="sans" style={{fontSize:13,fontWeight:700,color:C.text}}>{tile.label}</div>
                                <div style={{fontSize:10,color:C.dim}}>{tileDeals.length} client{tileDeals.length!==1?"s":""}</div>
                              </div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div className="sans" style={{fontSize:22,fontWeight:800,color:tColor,lineHeight:1}}>{tFcastPct}%</div>
                              <div style={{fontSize:9,color:C.dim}}>forecast</div>
                            </div>
                          </div>

                          {/* Numbers row */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                            <div style={{background:C.s2,borderRadius:5,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Target</div>
                              <div className="sans" style={{fontSize:15,fontWeight:700,color:C.text}}>{fmtR(tTarget)}</div>
                            </div>
                            <div style={{background:C.s2,borderRadius:5,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Closed</div>
                              <div className="sans" style={{fontSize:15,fontWeight:700,color:tClosed>0?C.green:C.muted}}>{fmtR(tClosed)}</div>
                            </div>
                            <div style={{background:C.s2,borderRadius:5,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Pipeline</div>
                              <div className="sans" style={{fontSize:15,fontWeight:700,color:tPipe>0?C.accent:C.muted}}>{fmtR(tPipe)}</div>
                            </div>
                            <div style={{background:C.s2,borderRadius:5,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Gap</div>
                              <div className="sans" style={{fontSize:15,fontWeight:700,color:tGap===0?C.green:C.red}}>{fmtR(tGap)}</div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div style={{marginBottom:10}}>
                            <div style={{height:6,background:C.s3,borderRadius:3,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",left:0,height:"100%",width:`${Math.min(tClosePct,100)}%`,background:C.green,borderRadius:3,transition:"width .5s"}} />
                              <div style={{position:"absolute",left:`${tClosePct}%`,height:"100%",width:`${Math.min(tFcastPct-tClosePct,100-tClosePct)}%`,background:`${tile.color}99`,transition:"width .5s"}} />
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                              <span style={{fontSize:9,color:C.green}}>{tClosePct}% closed</span>
                              <span style={{fontSize:9,color:tile.color}}>{tFcastPct}% forecast</span>
                            </div>
                          </div>

                          {/* Reps + risk + click hint */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                              {tReps.slice(0,3).map(r=>(
                                <span key={r} style={{background:C.s3,color:C.dim,padding:"1px 6px",borderRadius:8,fontSize:9}}>{r.split(" ")[0]}</span>
                              ))}
                              {tReps.length>3&&<span style={{fontSize:9,color:C.muted}}>+{tReps.length-3}</span>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {tAtRisk>0&&<span style={{background:`${C.red}22`,color:C.red,padding:"2px 7px",borderRadius:8,fontSize:9,fontWeight:700}}>{tAtRisk} at risk</span>}
                              <span style={{fontSize:9,color:C.dim}}>View clients →</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TEAM ═══ */}
          {view==="team" && (
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
                <button className="btn btn-primary" onClick={()=>setLogOpen(true)}>+ Log Meeting</button>
              </div>

              {/* GK FIX — today's count up front so reps can see what they logged */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"TODAY'S MEETINGS",  value:meetings.filter(m=>m.date===TODAY).length,                                     color:C.blue},
                  {label:"ON TIME",            value:meetings.filter(m=>m.date===TODAY&&!m.late).length,                            color:C.green},
                  {label:"LOGGED LATE",        value:meetings.filter(m=>m.date===TODAY&&m.late).length,                             color:C.orange},
                  {label:"SENIOR REQUESTS",    value:meetings.filter(m=>m.seniorRequested==="Yes").length,                          color:C.accent},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em"}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color,marginTop:3}}>{k.value}</div>
                  </div>
                ))}
              </div>

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

              {/* MEETING LOG — day by day */}
              {meetings.length === 0 && (
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:10}}>📝</div>
                  <div className="sans" style={{fontWeight:700,marginBottom:5}}>No meetings logged yet</div>
                  <div style={{color:C.dim,fontSize:12,marginBottom:16}}>Click "+ Log Meeting" above to record today's client meetings</div>
                </div>
              )}

              {[TODAY,D1,D3,D7].map(date=>{
                const dm = meetings.filter(m => m.date===date &&
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? REPS.find(r=>r.id===m.repId)?.region===user_role.region : m.repId===user_role.repId)
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
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>ESCALATIONS</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Internal blockers with SLA timers. Visible same day — not at quarter-end.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[
                  {label:"OVERDUE",     value:allReqs.filter(r=>r.status==="Overdue").length,     color:C.red},
                  {label:"IN PROGRESS", value:allReqs.filter(r=>r.status==="In Progress").length, color:C.blue},
                  {label:"RESOLVED",    value:allReqs.filter(r=>r.status==="Done").length,        color:C.green},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:14,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em"}}>{k.label}</div>
                    <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color,marginTop:4}}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {Object.entries(SLA).map(([dept,hrs])=>(
                  <div key={dept} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"5px 11px",display:"flex",gap:8,alignItems:"center"}}>
                    <span className="pill" style={{background:`${C.blue}22`,color:C.blue,fontSize:10}}>{dept}</span>
                    <span style={{color:C.accent,fontSize:11}}>{hrs}h SLA</span>
                  </div>
                ))}
              </div>
              {DEPARTMENTS.map(dept=>{
                const dr=allReqs.filter(r=>r.dept===dept);
                if(!dr.length) return null;
                const open=dr.filter(r=>r.status!=="Done");
                return (
                  <div key={dept} style={{marginBottom:12}}>
                    <div style={{display:"flex",gap:8,marginBottom:7,alignItems:"center"}}>
                      <span className="pill sans" style={{background:`${C.blue}22`,color:C.blue,fontSize:12,fontWeight:700,padding:"3px 10px"}}>{dept}</span>
                      {open.length>0?<span className="pill" style={{background:`${C.red}22`,color:C.red}}>{open.length} open</span>:<span className="pill" style={{background:`${C.green}22`,color:C.green}}>clear</span>}
                    </div>
                    {dr.map((r,i)=>{
                      const deal=deals.find(d=>d.id===r.dealId);
                      return (
                        <div key={i} className="row" style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:r.status==="Done"?C.green:r.status==="Overdue"?C.red:r.status==="In Progress"?C.blue:C.accent,flexShrink:0}} />
                          <div style={{flex:1}}>
                            <div className="sans" style={{fontWeight:600}}>{r.desc}</div>
                            <div style={{fontSize:11,color:C.dim,marginTop:2}}>For: <strong style={{color:C.text}}>{r.clientCompany}</strong> · {fmtR(r.amount)}</div>
                          </div>
                          <select value={r.status} onChange={e=>updateReq(r.dealId,r.reqIdx,e.target.value)} style={{width:120,fontSize:11,padding:"4px 6px",background:r.status==="Done"?`${C.green}22`:r.status==="Overdue"?`${C.red}22`:`${C.accent}22`,color:r.status==="Done"?C.green:r.status==="Overdue"?C.red:C.accent,border:"none",borderRadius:3}}>
                            {REQ_STATUS.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

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
                          {REPS.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(rep=>{
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

        </div>
      </div>

      {/* ADD DEAL MODAL */}
      {addDealOpen && (
        <div className="overlay" onClick={()=>setAddDealOpen(false)}>
          <div className="modal fin" onClick={e=>e.stopPropagation()}>
            <div className="sans" style={{fontSize:16,fontWeight:700,marginBottom:16}}>ADD NEW DEAL</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              {[
                {label:"Client Company *",key:"clientCompany",type:"text",ph:"Company name"},
                {label:"Contact Name",key:"contactName",type:"text",ph:"Full name"},
                {label:"Designation",key:"designation",type:"text",ph:"e.g. VP Marketing"},
                {label:"Phone",key:"phone",type:"text",ph:"Mobile"},
                {label:"Email",key:"email",type:"text",ph:"email@company.com"},
                {label:"Target Amount (Rs) *",key:"targetAmount",type:"number",ph:"0"},
                {label:"Expected Amount (Rs)",key:"amount",type:"number",ph:"0"},
                {label:"Next Step",key:"nextStep",type:"text",ph:"Action item"},
                {label:"Next Step Date",key:"nextStepDate",type:"date",ph:""},
              ].map(f=>(
                <div key={f.key}><label>{f.label}</label><input type={f.type} placeholder={f.ph} value={dealForm[f.key]||""} onChange={e=>setDealForm(p=>({...p,[f.key]:e.target.value}))} /></div>
              ))}
              <div><label>Assign Rep *</label><select value={dealForm.repId} onChange={e=>setDealForm(p=>({...p,repId:e.target.value}))}><option value="">Select</option>{REPS.map(r=><option key={r.id} value={r.id}>{r.name} ({r.region})</option>)}</select></div>
              <div><label>Deal Type</label><select value={dealForm.dealType} onChange={e=>setDealForm(p=>({...p,dealType:e.target.value}))}><option value="">Select</option>{DEAL_TYPES.map(d=><option key={d}>{d}</option>)}</select></div>
              <div><label>Contact Level</label><select value={dealForm.contactLevel} onChange={e=>setDealForm(p=>({...p,contactLevel:e.target.value}))}><option value="">Select</option>{CONTACT_LEVELS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label>Priority</label><select value={dealForm.priority} onChange={e=>setDealForm(p=>({...p,priority:e.target.value}))}><option>Top 5</option><option>Regular</option></select></div>
              <div><label>Stage</label><select value={dealForm.outcome} onChange={e=>setDealForm(p=>({...p,outcome:e.target.value}))}>{OUTCOMES.map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label>Quarter</label><select value={dealForm.quarter} onChange={e=>setDealForm(p=>({...p,quarter:e.target.value}))}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select></div>
            </div>
            <div><label>Notes / Context</label><textarea rows={2} placeholder="Competitor intel, history, strategy..." value={dealForm.notes} onChange={e=>setDealForm(p=>({...p,notes:e.target.value}))} style={{resize:"none"}} /></div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setAddDealOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDeal}>ADD DEAL</button>
            </div>
          </div>
        </div>
      )}

      {/* LOG MEETING MODAL — aligned to Today's Meetings Excel sheet */}
      {logOpen && (
        <div className="overlay" onClick={()=>setLogOpen(false)}>
          <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:640,maxHeight:"90vh",overflowY:"auto"}}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div>
                <div className="sans" style={{fontSize:16,fontWeight:700}}>LOG MEETING</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>{TODAY} · Today's Meetings</div>
              </div>
              <div style={{fontSize:11,padding:"4px 10px",borderRadius:4,background:new Date().getHours()>=12?`${C.orange}22`:`${C.green}22`,color:new Date().getHours()>=12?C.orange:C.green,fontWeight:700}}>
                {new Date().getHours()>=12?"⚠ After 12pm — will flag late":"✓ Before 12pm"}
              </div>
            </div>
            <div style={{height:1,background:C.border,margin:"12px 0"}} />

            {/* SECTION 1 — Who */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Who</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label>Sales Rep *</label>
                <select value={logForm.repId} onChange={e=>setLogForm(p=>({...p,repId:e.target.value}))}>
                  <option value="">Select rep</option>
                  {REPS.map(r=><option key={r.id} value={r.id}>{r.name} · {r.region}</option>)}
                </select>
              </div>
              <div>
                <label>Region</label>
                <input readOnly value={REPS.find(r=>r.id===parseInt(logForm.repId))?.region||""} style={{color:C.dim}} />
              </div>
              <div>
                <label>Meeting Time</label>
                <input type="time" value={logForm.meetingTime||""} onChange={e=>setLogForm(p=>({...p,meetingTime:e.target.value}))} />
              </div>
            </div>

            {/* SECTION 2 — Client/Agency */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Client / Agency</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label>Client or Agency?</label>
                <select value={logForm.clientOrAgency} onChange={e=>setLogForm(p=>({...p,clientOrAgency:e.target.value}))}>
                  {CLIENT_OR_AGENCY.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>{logForm.clientOrAgency} Name *</label>
                <select value={logForm.dealId} onChange={e=>{
                  const deal=deals.find(d=>d.id===e.target.value);
                  setLogForm(p=>({...p,dealId:e.target.value,clientAgencyName:deal?.clientCompany||""}));
                }}>
                  <option value="">Select from CRM</option>
                  {deals.filter(d=>!logForm.repId||d.repId===parseInt(logForm.repId)).map(d=><option key={d.id} value={d.id}>{d.clientCompany}</option>)}
                </select>
              </div>
              <div>
                <label>Or type name (new client)</label>
                <input placeholder="Not in CRM yet?" value={logForm.clientAgencyName||""} onChange={e=>setLogForm(p=>({...p,clientAgencyName:e.target.value,dealId:""}))} />
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label>Name of Person Met *</label>
                <input placeholder="Full name" value={logForm.contactName||""} onChange={e=>setLogForm(p=>({...p,contactName:e.target.value}))} />
              </div>
              <div>
                <label>Designation</label>
                <input placeholder="e.g. VP Marketing" value={logForm.designation||""} onChange={e=>setLogForm(p=>({...p,designation:e.target.value}))} />
              </div>
              <div>
                <label>Mobile No</label>
                <input placeholder="Contact number" value={logForm.mobile||""} onChange={e=>setLogForm(p=>({...p,mobile:e.target.value}))} />
              </div>
            </div>

            {/* SECTION 3 — Meeting Content (GK decision: free text, no discussion dropdown) */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Meeting Content</div>
            <div style={{marginBottom:10}}>
              <label>Pitch Type (Darpan's dropdown — only structured field)</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {PITCH_TYPES.map(pt=>(
                  <button key={pt} onClick={()=>setLogForm(p=>({...p,pitchType:pt}))}
                    style={{padding:"5px 12px",fontSize:11,borderRadius:4,border:`1px solid ${logForm.pitchType===pt?C.accent:C.border}`,background:logForm.pitchType===pt?`${C.accent}22`:C.s2,color:logForm.pitchType===pt?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all .1s"}}>
                    {pt}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label>Discussion <span style={{color:C.dim,fontWeight:400}}>(free text — GK: write what happened in the meeting)</span></label>
              <textarea rows={3} placeholder="What did you discuss? Campaign ideas, budget conversations, client objections, brand insights..." value={logForm.discussion||""} onChange={e=>setLogForm(p=>({...p,discussion:e.target.value}))} style={{resize:"vertical"}} />
            </div>
            <div style={{marginBottom:14}}>
              <label>Client Feedback <span style={{color:C.dim,fontWeight:400}}>(what did the client say/react?)</span></label>
              <textarea rows={2} placeholder="Positive, hesitant, needs approval, competitor mentioned..." value={logForm.clientFeedback||""} onChange={e=>setLogForm(p=>({...p,clientFeedback:e.target.value}))} style={{resize:"vertical"}} />
            </div>

            {/* SECTION 4 — Senior Escalation (Darpan requirement) */}
            <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:6,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Senior Meeting Request (Darpan: track escalations)</div>
              <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:10,alignItems:"end"}}>
                <div>
                  <label>Senior requested?</label>
                  <div style={{display:"flex",gap:6,marginTop:4}}>
                    {["No","Yes"].map(v=>(
                      <button key={v} onClick={()=>setLogForm(p=>({...p,seniorRequested:v}))}
                        style={{padding:"6px 14px",fontSize:11,borderRadius:4,border:`1px solid ${logForm.seniorRequested===v?(v==="Yes"?C.orange:C.green):C.border}`,background:logForm.seniorRequested===v?(v==="Yes"?`${C.orange}22`:`${C.green}22`):C.s2,color:logForm.seniorRequested===v?(v==="Yes"?C.orange:C.green):C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {logForm.seniorRequested==="Yes" && <>
                  <div>
                    <label>Senior's Name</label>
                    <input placeholder="Name of senior needed" value={logForm.seniorRequestedName||""} onChange={e=>setLogForm(p=>({...p,seniorRequestedName:e.target.value}))} />
                  </div>
                  <div>
                    <label>Role / Level</label>
                    <select value={logForm.seniorRequestedRole||""} onChange={e=>setLogForm(p=>({...p,seniorRequestedRole:e.target.value}))}>
                      <option value="">Select</option>
                      <option>Region Head</option>
                      <option>Sales Head</option>
                      <option>CXO</option>
                      <option>National Sales Head</option>
                      <option>Sales Strategy</option>
                    </select>
                  </div>
                </>}
              </div>
            </div>

            {/* SECTION 5 — Next Steps + Follow-Up */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Next Steps</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{gridColumn:"1/-1"}}>
                <label>Next Steps / Action Items</label>
                <textarea rows={2} placeholder="What needs to happen next? Be specific." value={logForm.nextSteps||""} onChange={e=>setLogForm(p=>({...p,nextSteps:e.target.value}))} style={{resize:"none"}} />
              </div>
              <div>
                <label>Follow-Up Date</label>
                <input type="date" value={logForm.followUpDate||""} onChange={e=>setLogForm(p=>({...p,followUpDate:e.target.value}))} />
              </div>
              <div>
                <label>Meeting Status</label>
                <select value={logForm.status||""} onChange={e=>setLogForm(p=>({...p,status:e.target.value}))}>
                  <option value="">Select</option>
                  {MEETING_STATUS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Sachin: schedule next meeting — with Calendar + Meet integration */}
            <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:6,padding:"10px 14px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setLogForm(p=>({...p,scheduleNext:!p.scheduleNext}))}
                  style={{width:18,height:18,borderRadius:3,border:`1px solid ${logForm.scheduleNext?C.green:C.border}`,background:logForm.scheduleNext?C.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12}}>
                  {logForm.scheduleNext?"✓":""}
                </button>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>Schedule next meeting</div>
                  <div style={{fontSize:10,color:C.dim}}>Creates calendar event + optional Google Meet / Zoho Meeting link</div>
                </div>
              </div>

              {logForm.scheduleNext && (
                <div style={{marginTop:12}}>
                  {/* Date + Time */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <div>
                      <label>Meeting Date *</label>
                      <input type="date" value={logForm.nextMeetingDate||""} onChange={e=>setLogForm(p=>({...p,nextMeetingDate:e.target.value}))} />
                    </div>
                    <div>
                      <label>Meeting Time</label>
                      <input type="time" value={logForm.nextMeetingTime||""} onChange={e=>setLogForm(p=>({...p,nextMeetingTime:e.target.value}))} />
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <label>Agenda for next meeting</label>
                      <textarea rows={2} placeholder="What will you go in with? e.g. Present revised FCT grid for Q2..." value={logForm.nextAgenda||""} onChange={e=>setLogForm(p=>({...p,nextAgenda:e.target.value}))} style={{resize:"none"}} />
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <label>Invite attendees (comma-separated emails)</label>
                      <input placeholder="e.g. client@brand.com, rh@odishatv.com" value={logForm.attendeeEmails||""} onChange={e=>setLogForm(p=>({...p,attendeeEmails:e.target.value}))} />
                    </div>
                  </div>

                  {/* Calendar Platform */}
                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Calendar Platform</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                      {[
                        {id:"google", label:"Google Calendar",  icon:"📅", color:"#4285F4", desc:"Creates event + auto-generates Google Meet link"},
                        {id:"zoho",   label:"Zoho Calendar",    icon:"📆", color:"#e42527", desc:"Creates event in Zoho Calendar"},
                        {id:"none",   label:"No Calendar",      icon:"⊘",  color:"#7d8590", desc:"Schedule internally only, no calendar invite"},
                      ].map(cp=>(
                        <button key={cp.id} onClick={()=>setLogForm(p=>({...p,calendarPlatform:cp.id}))}
                          style={{flex:1,minWidth:140,padding:"10px 12px",borderRadius:6,border:`1px solid ${logForm.calendarPlatform===cp.id?cp.color:C.border}`,background:logForm.calendarPlatform===cp.id?`${cp.color}18`:C.s2,cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                          <div style={{fontSize:14,marginBottom:3}}>{cp.icon} <span style={{fontWeight:700,fontSize:12,color:logForm.calendarPlatform===cp.id?cp.color:C.text}}>{cp.label}</span></div>
                          <div style={{fontSize:10,color:C.dim}}>{cp.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Video conferencing toggle */}
                    {logForm.calendarPlatform==="google" && (
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`#4285F418`,border:"1px solid #4285F444",borderRadius:5}}>
                        <button onClick={()=>setLogForm(p=>({...p,addMeetLink:!p.addMeetLink}))}
                          style={{width:16,height:16,borderRadius:3,border:`1px solid ${logForm.addMeetLink?"#4285F4":C.border}`,background:logForm.addMeetLink?"#4285F4":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,flexShrink:0}}>
                          {logForm.addMeetLink?"✓":""}
                        </button>
                        <div>
                          <span style={{fontSize:12,color:"#4285F4",fontWeight:600}}>Add Google Meet link</span>
                          <span style={{fontSize:11,color:C.dim}}> — auto-generated, shared with all attendees in invite</span>
                        </div>
                      </div>
                    )}
                    {logForm.calendarPlatform==="zoho" && (
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`#e4252718`,border:"1px solid #e4252744",borderRadius:5}}>
                        <span style={{fontSize:12,color:"#e42527",fontWeight:600}}>Zoho Meeting</span>
                        <span style={{fontSize:11,color:C.dim}}> — event created in Zoho Calendar (Zoho OAuth required in production)</span>
                      </div>
                    )}

                    {/* Calendar status feedback */}
                    {logForm.calendarStatus && (
                      <div style={{marginTop:8,padding:"8px 12px",background:`${C.green}18`,border:`1px solid ${C.green}44`,borderRadius:5,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:C.green,fontSize:14}}>✓</span>
                        <div>
                          <div style={{fontSize:12,color:C.green,fontWeight:600}}>Calendar event created</div>
                          {logForm.meetLink&&<a href={logForm.meetLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#4285F4",textDecoration:"none"}}>🎥 {logForm.meetLink}</a>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
              {calendarLoading && <span style={{fontSize:11,color:C.dim}}>Creating calendar event...</span>}
              <button className="btn btn-ghost" onClick={()=>{setLogOpen(false);setLogForm(BLANK_LOG);}}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLogMeetingWithCalendar} disabled={calendarLoading}
                style={{opacity:calendarLoading?.6:1}}>
                {calendarLoading ? "Creating..." : logForm.scheduleNext && logForm.calendarPlatform!=="none" ? "LOG + CREATE CALENDAR EVENT" : "LOG MEETING"}
              </button>
            </div>
          </div>
        </div>
      )}

          {/* ═══ HR REPORTS ═══ */}
          {view==="hr" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>HR ABSENCE REPORTS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Auto-generated at 23:59 for any rep who hasn't logged activity. Sent directly to <span style={{color:C.accent}}>{HR_EMAIL}</span></div>
                </div>
                {isCRO && (
                  <button className="btn btn-primary" onClick={runEODCheck} style={{whiteSpace:"nowrap"}}>▶ Simulate EOD Run</button>
                )}
              </div>

              {/* SYSTEM RULES BANNER */}
              <div style={{background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:6,padding:14,marginTop:14,marginBottom:18}}>
                <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:10}}>SYSTEM RULES — NON-NEGOTIABLE</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  {[
                    {rule:"Logging Deadline",   detail:"12:00 PM daily. Any entry after this is flagged late.",              icon:"◷"},
                    {rule:"Auto-Absent Trigger", detail:"No entry by 23:59 = absence report auto-fires to HR. No warnings.", icon:"⊘"},
                    {rule:"No Regularization",  detail:"Zero exceptions in system. Absent record is permanent by default.",  icon:"✗"},
                    {rule:"Exception Authority", detail:"ONLY Litisha can override. No one else. Not NSH, not CEO.",          icon:"✦"},
                    {rule:"Exception Audit",     detail:"Every exception is logged with reason, timestamp, and approver.",    icon:"≡"},
                    {rule:"HR Integration",      detail:`Reports POST to ${HR_EMAIL} and flag in HRMS automatically.`,       icon:"↗"},
                  ].map(r=>(
                    <div key={r.rule} style={{background:C.s2,borderRadius:4,padding:"10px 12px"}}>
                      <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
                        <span style={{color:C.red,fontSize:14}}>{r.icon}</span>
                        <span className="sans" style={{fontWeight:700,fontSize:12,color:C.text}}>{r.rule}</span>
                      </div>
                      <div style={{fontSize:11,color:C.dim}}>{r.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUMMARY STRIP */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                {[
                  {label:"TOTAL ABSENCES",     value:absenceReports.filter(r=>r.markedAs==="Absent").length,          color:C.red},
                  {label:"EXCEPTIONS GRANTED", value:absenceReports.filter(r=>r.exception==="Overridden").length,     color:C.orange},
                  {label:"PENDING REVIEW",     value:absenceReports.filter(r=>r.status==="Sent to HR"&&r.markedAs==="Absent").length, color:C.blue},
                  {label:"REPORTS SENT TO HR", value:absenceReports.length,                                           color:C.dim},
                ].map(k=>(
                  <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em"}}>{k.label}</div>
                    <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color,marginTop:4}}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* TODAY — unlogged reps */}
              {(() => {
                const unloggedToday = REPS.filter(r=>!att[TODAY]?.[r.id]);
                const filedToday    = absenceReports.filter(r=>r.date===TODAY);
                return unloggedToday.length > 0 || filedToday.length > 0 ? (
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:8}}>TODAY — NOT LOGGED</div>
                    {unloggedToday.map(rep=>{
                      const filed=absenceReports.find(r=>r.repId===rep.id&&r.date===TODAY);
                      return (
                        <div key={rep.id} style={{background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:5,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:12}}>
                          <div style={{flex:1}}>
                            <span className="sans" style={{fontWeight:700}}>{rep.name}</span>
                            <span style={{color:C.dim,fontSize:12}}> · {rep.role} · {rep.region}</span>
                          </div>
                          {filed
                            ? <span className="pill" style={{background:`${C.red}22`,color:C.red}}>ABSENT — Report Sent</span>
                            : <span className="pill" style={{background:`${C.orange}22`,color:C.orange}}>Not Yet Filed (EOD pending)</span>
                          }
                          {isCRO && filed && filed.markedAs==="Absent" && (
                            <button className="btn" style={{fontSize:11,padding:"4px 10px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`}} onClick={()=>{setExceptionModal({reportId:filed.id,repName:rep.name});setExceptionReason("");}}>
                              Grant Exception
                            </button>
                          )}
                          {isCRO && !filed && (
                            <button className="btn" style={{fontSize:11,padding:"4px 10px",background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`}} onClick={()=>fireAbsenceReport(rep,TODAY)}>
                              Fire Report Now
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}

              {/* ALL REPORTS */}
              <div>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10}}>ALL ABSENCE REPORTS — FULL AUDIT TRAIL</div>
                <div className="card" style={{overflow:"hidden"}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Rep</th>
                        <th>Date</th>
                        <th>Generated</th>
                        <th>Sent To</th>
                        <th>HRMS Status</th>
                        <th>Exception</th>
                        <th>{isCRO?"Action":""}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absenceReports.sort((a,b)=>b.date.localeCompare(a.date)).map(r=>(
                        <tr key={r.id}>
                          <td>
                            <div className="sans" style={{fontWeight:700}}>{r.repName}</div>
                            <div style={{fontSize:10,color:C.dim}}>{r.role} · {r.region}</div>
                          </td>
                          <td style={{fontFamily:"'DM Mono',monospace",color:C.dim}}>{r.date}</td>
                          <td>
                            <div style={{fontSize:11,color:C.dim}}>{r.generatedAt}</div>
                            <div style={{fontSize:10,color:C.muted}}>{r.generatedBy}</div>
                          </td>
                          <td style={{fontSize:11,color:C.dim}}>{r.sentTo}</td>
                          <td>
                            <span className="pill" style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,fontWeight:700}}>
                              {r.markedAs==="Absent"?"ABSENT":"PRESENT"}
                            </span>
                          </td>
                          <td>
                            {r.exception
                              ? (
                                <div>
                                  <span className="pill" style={{background:`${C.green}22`,color:C.green}}>Overridden by {r.exceptionBy}</span>
                                  <div style={{fontSize:10,color:C.dim,marginTop:3,maxWidth:200}}>{r.exceptionReason}</div>
                                </div>
                              )
                              : <span style={{color:C.muted,fontSize:11}}>None</span>
                            }
                          </td>
                          <td>
                            {isCRO && r.markedAs==="Absent" && (
                              <button className="btn" style={{fontSize:11,padding:"4px 10px",background:`${C.green}22`,color:C.green,border:`1px solid ${C.green}44`,whiteSpace:"nowrap"}} onClick={()=>{setExceptionModal({reportId:r.id,repName:r.repName});setExceptionReason("");}}>
                                Grant Exception
                              </button>
                            )}
                            {isCRO && r.exception==="Overridden" && (
                              <button className="btn" style={{fontSize:11,padding:"4px 10px",background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,whiteSpace:"nowrap"}} onClick={()=>revokeException(r.id)}>
                                Revoke
                              </button>
                            )}
                            {!isCRO && r.markedAs==="Absent" && (
                              <span style={{fontSize:11,color:C.muted}}>No access</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {absenceReports.length===0 && (
                        <tr><td colSpan={7} style={{textAlign:"center",color:C.muted,padding:20}}>No absence reports generated yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NON-LITISHA BLOCK MESSAGE */}
              {!isCRO && (
                <div style={{marginTop:16,padding:"12px 16px",background:`${C.orange}08`,border:`1px solid ${C.orange}33`,borderRadius:5,fontSize:12,color:C.orange}}>
                  ⚠ You are logged in as <strong>{user_role.name}</strong> ({user_role.role}). Only Admin or CXO can grant or revoke absence exceptions.
                </div>
              )}
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

      {/* TOAST */}
      {toast && <div className="fin" style={{position:"fixed",bottom:18,right:18,background:toast.type==="err"?C.red:C.green,color:"#fff",padding:"9px 16px",borderRadius:5,fontWeight:700,fontSize:12,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{toast.msg}</div>}
    </div>
  );
}