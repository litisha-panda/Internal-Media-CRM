// Shared module-level constants extracted from CROApp
// All view files import from here instead of duplicating

export const REGIONS   = ["North", "South", "East", "West", "National", "Central"];
export const ALL_ROLES = ["SALES REP","REGION HEAD","SALES HEAD","CRO","SALES STRATEGY","DIGI OPS","ADMIN"];
export const DEAL_TYPES = ["Linear TV", "IPs", "Digital", "Media Solutions", "Integrated Packages"];
export const CONTACT_LEVELS = ["C-Suite / Owner", "VP / GM", "Marketing Head", "Brand Manager", "Agency Lead", "Junior/Exec"];
export const DEAL_STAGES = ["Prospect", "Qualified", "Proposal Sent", "Negotiation", "Verbal Commit", "PO Received", "RO Received", "Won", "Lost", "Cancelled", "Archived", "On Hold"];
export const OUTCOMES = DEAL_STAGES;
export const DEPARTMENTS = ["Sales Strategy", "Digital", "Production", "National Head", "Finance", "Legal"];
export const REQ_STATUS = ["Pending", "In Progress", "Done", "Overdue"];
export const SLA: Record<string,number> = { "Sales Strategy": 24, "Digital": 24, "Production": 48, "National Head": 12, "Finance": 48, "Legal": 72 };
export const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26", "FY26 Annual"];
export const STAGE_PROB: Record<string,number> = {
  "Prospect": 10, "Qualified": 20, "Proposal Sent": 40,
  "Negotiation": 70, "Verbal Commit": 85, "PO Received": 95,
  "RO Received": 100, "Won": 100, "Lost": 0,
  "Cancelled": 0, "Archived": 0, "On Hold": 15,
  // Legacy outcome labels — kept for backward compat with existing DB rows
  "In Discussion": 40, "Mail Confirmed": 90,
  "Very Interested": 40, "Interested – Needs Revision": 50, "Price Concern": 30,
  "Needs Callback": 10, "Not Interested": 0,
};
export const PITCH_TYPES = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "IPs", "Others"];
export const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation", "RO Received"];
export const MEETING_TYPES  = ["Physical", "Online", "Phone Call"];
export const CLIENT_OR_AGENCY = ["Client", "Agency"];
export const TASK_PRIORITIES = ["High", "Medium", "Low"];
export const TASK_STATUSES   = ["Open", "In Progress", "Done", "Overdue"];
export const APPROVAL_TARGETS = [
  "Region Head", "NSH", "Branding Team", "Content Team",
  "Sales Strategy", "Digital", "Finance", "Legal", "CXO",
];
export const APPROVAL_SLA_DAYS = 2;
export const PLAN_STATUS = ["Planned", "Done", "Cancelled", "Rescheduled"];
export const PLAN_DEADLINE = "23:30";
export const HR_EMAIL = "hr@odishatv.com";
export const TARGET_APPROVAL_CHAIN = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO","Approved"];
export const ALL_CHANNELS = ["Odisha TV","Tarang","Tarang Music","Alankar","Prarthana"];
export const IP_CATALOG: any[] = [];

export const TODAY    = new Date().toISOString().split("T")[0];
export const TOMORROW = new Date(Date.now() + 86400000).toISOString().split("T")[0];
export const D1     = new Date(Date.now() - 86400000).toISOString().split("T")[0];
export const D3     = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
export const D7     = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
export const D14    = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

export const getToday    = () => new Date().toISOString().split("T")[0];
export const getTomorrow = () => new Date(Date.now() + 86400000).toISOString().split("T")[0];

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
export const THIS_WEEK_START = getWeekStart(TODAY);
export const MONDAY = THIS_WEEK_START;
export const SUNDAY = (() => { const d = new Date(MONDAY); d.setDate(d.getDate() + 6); return d.toISOString().split("T")[0]; })();

export const C = {
  bg:"#f0f4f9", surface:"#ffffff", s2:"#e8eef7", s3:"#dde5f0", border:"#c8d3e5",
  accent:"#c47d00", green:"#15803d", red:"#c92828", blue:"#1d5db4", purple:"#7920e8",
  orange:"#c24000", text:"#18243a", dim:"#4d5e78", muted:"#8a97ae"
};


export const ACTION_TYPES = ["Approval needed","Document needed","Attend a meeting","Introduction needed","Flag for follow-up"];

export const USER_ROLES: any[] = [
  { id: "admin",          name: "Admin",                  role: "ADMIN",          canView: "all",    region: null },
  { id: "sales_head",     name: "Sales Head",             role: "SALES HEAD",     canView: "all",    region: null },
  { id: "sales_strategy", name: "Sachin (Sales Strategy)",role: "SALES STRATEGY", canView: "all",    region: null },
  { id: "sales_analysis", name: "Darpan (CRO)",           role: "CRO",            canView: "all",    region: null },
  { id: "digi_ops",       name: "Digi Ops Team",          role: "DIGI OPS",       canView: "all",    region: null },
  { id: "rh_north",       name: "Region Head – North",   role: "REGION HEAD",    canView: "region", region: "North" },
  { id: "rh_south",       name: "Region Head – South",   role: "REGION HEAD",    canView: "region", region: "South" },
  { id: "rh_east",        name: "Region Head – East",    role: "REGION HEAD",    canView: "region", region: "East" },
  { id: "rh_west",        name: "Region Head – West",    role: "REGION HEAD",    canView: "region", region: "West" },
  { id: "rh_national",    name: "Region Head – National",role: "REGION HEAD",    canView: "region", region: "National" },
  { id: "rh_central",     name: "Region Head – Central", role: "REGION HEAD",    canView: "region", region: "Central" },
  { id: "rep_arjun",      name: "Arjun Mishra",          role: "SALES REP",      canView: "self",   region: "North",    repId:  1 },
  { id: "rep_rahul",      name: "Rahul Sharma",          role: "SALES REP",      canView: "self",   region: "North",    repId:  7 },
  { id: "rep_kavya",      name: "Kavya Singh",           role: "SALES REP",      canView: "self",   region: "North",    repId:  8 },
  { id: "rep_manish",     name: "Manish Tiwari",         role: "SALES REP",      canView: "self",   region: "North",    repId:  9 },
  { id: "rep_pooja",      name: "Pooja Agarwal",         role: "SALES REP",      canView: "self",   region: "North",    repId: 10 },
  { id: "rep_priya",      name: "Priya Dash",            role: "SALES REP",      canView: "self",   region: "South",    repId:  2 },
  { id: "rep_meera",      name: "Meera Rao",             role: "SALES REP",      canView: "self",   region: "South",    repId:  6 },
  { id: "rep_suresh",     name: "Suresh Reddy",          role: "SALES REP",      canView: "self",   region: "South",    repId: 11 },
  { id: "rep_ananya",     name: "Ananya Krishnan",       role: "SALES REP",      canView: "self",   region: "South",    repId: 12 },
  { id: "rep_karthik",    name: "Karthik Iyer",          role: "SALES REP",      canView: "self",   region: "South",    repId: 13 },
  { id: "rep_rohit",      name: "Rohit Nanda",           role: "SALES REP",      canView: "self",   region: "East",     repId:  3 },
  { id: "rep_sanjay",     name: "Sanjay Mohanty",        role: "SALES REP",      canView: "self",   region: "East",     repId: 14 },
  { id: "rep_debasmita",  name: "Debasmita Das",         role: "SALES REP",      canView: "self",   region: "East",     repId: 15 },
  { id: "rep_bikash",     name: "Bikash Pradhan",        role: "SALES REP",      canView: "self",   region: "East",     repId: 16 },
  { id: "rep_rina",       name: "Rina Panda",            role: "SALES REP",      canView: "self",   region: "East",     repId: 17 },
  { id: "rep_sneha",      name: "Sneha Patel",           role: "SALES REP",      canView: "self",   region: "West",     repId:  4 },
  { id: "rep_varun",      name: "Varun Mehta",           role: "SALES REP",      canView: "self",   region: "West",     repId: 18 },
  { id: "rep_divya",      name: "Divya Joshi",           role: "SALES REP",      canView: "self",   region: "West",     repId: 19 },
  { id: "rep_amit_d",     name: "Amit Desai",            role: "SALES REP",      canView: "self",   region: "West",     repId: 20 },
  { id: "rep_preethi",    name: "Preethi Shah",          role: "SALES REP",      canView: "self",   region: "West",     repId: 21 },
  { id: "rep_vikram",     name: "Vikram Sen",            role: "SALES REP",      canView: "self",   region: "National", repId:  5 },
  { id: "rep_neha",       name: "Neha Kapoor",           role: "SALES REP",      canView: "self",   region: "National", repId: 22 },
  { id: "rep_rajesh_m",   name: "Rajesh Malhotra",       role: "SALES REP",      canView: "self",   region: "National", repId: 23 },
  { id: "rep_shreya",     name: "Shreya Bose",           role: "SALES REP",      canView: "self",   region: "National", repId: 24 },
  { id: "rep_aditya",     name: "Aditya Kumar",          role: "SALES REP",      canView: "self",   region: "National", repId: 25 },
  { id: "rep_sameer",     name: "Sameer Nayak",          role: "SALES REP",      canView: "self",   region: "Central",  repId: 26 },
  { id: "rep_lipika",     name: "Lipika Mishra",         role: "SALES REP",      canView: "self",   region: "Central",  repId: 27 },
  { id: "rep_pratap",     name: "Pratap Rath",           role: "SALES REP",      canView: "self",   region: "Central",  repId: 28 },
  { id: "rep_sunita",     name: "Sunita Sahoo",          role: "SALES REP",      canView: "self",   region: "Central",  repId: 29 },
  { id: "rep_debadatta",  name: "Debadatta Patra",       role: "SALES REP",      canView: "self",   region: "Central",  repId: 30 },
];

export const fmt = (n: number | null | undefined | string): string => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (num === 0) return "0";
  if (num >= 10000000) return `${(num/10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num/100000).toFixed(1)}L`;
  return `${(num/1000).toFixed(0)}K`;
};
export const fmtR = (n: number | null | undefined | string): string =>
  (n == null || n === "") ? "—" : `₹${fmt(n)}`;
export const daysSince = (d: string | null | undefined): number => {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};
export const dealStage = (d: { stage?: string; outcome?: string }): string =>
  d.stage || d.outcome || "Prospect";
export const oColor = (o: string): string => (({
  "Prospect": C.muted, "Qualified": C.blue, "Proposal Sent": C.blue,
  "Negotiation": C.accent, "Verbal Commit": C.green, "PO Received": "#0f6b2f",
  "RO Received": "#0f6b2f", "Won": "#0f6b2f", "Lost": C.red,
  "Cancelled": C.red, "Archived": C.muted, "On Hold": C.accent,
  // Legacy compat
  "In Discussion": C.blue, "Mail Confirmed": C.green,
  "Very Interested": C.blue, "Interested – Needs Revision": C.accent,
  "Price Concern": C.orange, "Needs Callback": C.blue, "Not Interested": C.muted,
} as Record<string, string>)[o] || C.dim);
export const riskColor = (d: { stage?: string; outcome?: string; lastDealMeetingDate?: string; lastContact?: string }): string => {
  const s = dealStage(d);
  if (s === "Lost") return C.muted;
  if (s === "Mail Confirmed" || s === "RO Received") return C.green;
  const x = daysSince(d.lastDealMeetingDate || d.lastContact);
  return x >= 7 ? C.red : x >= 3 ? C.orange : C.green;
};
export const riskLabel = (d: { stage?: string; outcome?: string; atRisk?: boolean; lastDealMeetingDate?: string; lastContact?: string }): string => {
  const s = dealStage(d);
  if (s === "Lost") return "Lost";
  if (s === "RO Received") return "Closed";
  if (s === "Mail Confirmed") return "Committed";
  if (d.atRisk) return "At Risk";
  const x = daysSince(d.lastDealMeetingDate || d.lastContact);
  return x >= 7 ? "At Risk" : x >= 3 ? "Cooling" : "Active";
};
export const lColor = (l: string): string => (({
  "C-Suite / Owner": C.purple, "VP / GM": C.blue, "Marketing Head": C.green,
  "Brand Manager": C.accent, "Agency Lead": "#6366f1", "Junior/Exec": C.red,
} as Record<string, string>)[l] || C.dim);
export const mapLegacyOutcome = (o: string): string => (({
  "Mail Confirmed": "Mail Confirmed", "Very Interested": "In Discussion",
  "Interested – Needs Revision": "Negotiation", "Proposal Shared": "Negotiation",
  "Negotiation": "Negotiation", "Price Concern": "Negotiation",
  "Needs Callback": "Prospect", "Not Interested": "Lost",
  "Prospect": "Prospect", "In Discussion": "In Discussion",
  "RO Received": "RO Received", "Lost": "Lost",
} as Record<string, string>)[o] || "Prospect");
export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
export const REPS: any[] = [];
