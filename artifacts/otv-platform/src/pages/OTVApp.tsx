// @ts-nocheck
import React, { useState, useRef, useEffect, useMemo } from "react";


// Route all Claude API calls through the API server proxy (key stays server-side)
const CLAUDE_PROXY_URL = `${window.location.protocol}//${window.location.hostname}:8080/api/claude`;
const REGIONS   = ["North", "South", "East", "West", "National", "Central"];
const ALL_ROLES = ["SALES REP","REGION HEAD","SALES HEAD","CRO","SALES STRATEGY","DIGI OPS","ADMIN"];
const DEAL_TYPES = ["Linear TV", "IPs", "Digital", "Media Solutions", "Integrated Packages"];
const CONTACT_LEVELS = ["C-Suite / Owner", "VP / GM", "Marketing Head", "Brand Manager", "Agency Lead", "Junior/Exec"];
const OUTCOMES = ["Proposal Accepted", "Very Interested", "Interested – Needs Revision", "Price Concern", "Needs Callback", "Not Interested"];
const DEPARTMENTS = ["Sales Strategy", "Digital", "Production", "National Head", "Finance", "Legal"];
const REQ_STATUS = ["Pending", "In Progress", "Done", "Overdue"];
const SLA = { "Sales Strategy": 24, "Digital": 24, "Production": 48, "National Head": 12, "Finance": 48, "Legal": 72 };
const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26", "FY26 Annual"];
const STAGE_PROB = { "Proposal Accepted": 100, "Very Interested": 70, "Interested – Needs Revision": 50, "Price Concern": 30, "Needs Callback": 20, "Not Interested": 0 };
const PITCH_TYPES = ["Generic", "FCT", "Property", "IP", "Non-FCT Element", "IPs", "Others"];
const MEETING_STATUS = ["Meeting Done", "Rescheduled", "Cancelled", "Follow-up Pending", "Proposal Shared", "Negotiation", "Closed"];
const MEETING_TYPES  = ["Physical Meeting", "Online Meeting", "Phone Call"];
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

const SEED_TASKS = [
  { id:"t1",  assignedTo:1,  assignedBy:"litisha",    assignedByName:"Litisha (CXO)",         repId:1,  clientCompany:"Havells India",      title:"Send revised sponsorship deck",              description:"Update the H2 deck with new property reel and resubmit to Deepa Menon by EOD.",                   priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t2",  assignedTo:5,  assignedBy:"litisha",    assignedByName:"Litisha (CXO)",         repId:5,  clientCompany:"Asian Paints",       title:"Escalate to CEO before CMO meeting",         description:"Confirm CEO availability for CMO meeting. Vikram to coordinate calendar with Litisha's EA.",       priority:"High",   status:"Open",        dueDate:TOMORROW, createdAt:TODAY },
  { id:"t3",  assignedTo:2,  assignedBy:"gk",         assignedByName:"GK (Sales Head)",       repId:2,  clientCompany:"Apollo Hospitals",   title:"Get digital media plan from Darpan",         description:"Chase Darpan for the custom Apollo digital plan. Needed before Friday pitch.",                   priority:"Medium", status:"In Progress", dueDate:TOMORROW, createdAt:D1 },
  { id:"t4",  assignedTo:7,  assignedBy:"rh_north",   assignedByName:"Region Head – North",   repId:7,  clientCompany:"Maruti Suzuki",      title:"Share FCT grid for summer campaign",         description:"Prepare and share the FCT grid proposal for Maruti's Alto & Swift campaign by Friday.",          priority:"High",   status:"Open",        dueDate:TOMORROW, createdAt:D1 },
  { id:"t5",  assignedTo:9,  assignedBy:"rh_north",   assignedByName:"Region Head – North",   repId:9,  clientCompany:"LG Electronics",     title:"Confirm premium slot availability",          description:"Check with programming team for H2 primetime slots and confirm with LG CMO Seema Jain.",         priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t6",  assignedTo:11, assignedBy:"rh_south",   assignedByName:"Region Head – South",   repId:11, clientCompany:"Dr Reddy's Labs",    title:"Follow up on digital health plan",           description:"Chase digital team for health awareness plan for Dr Reddy's South India campaign.",               priority:"Medium", status:"In Progress", dueDate:TOMORROW, createdAt:D3 },
  { id:"t7",  assignedTo:13, assignedBy:"rh_south",   assignedByName:"Region Head – South",   repId:13, clientCompany:"Britannia Industries",title:"Collect PO and invoice details",             description:"Britannia deal is closed. Collect the official PO and share invoice details with finance.",       priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t8",  assignedTo:14, assignedBy:"rh_east",    assignedByName:"Region Head – East",    repId:14, clientCompany:"Tata Steel",         title:"Prepare corporate brand campaign deck",      description:"Build a customised brand visibility deck for Tata Steel East India corporate campaign.",          priority:"Medium", status:"Open",        dueDate:D3,       createdAt:D7 },
  { id:"t9",  assignedTo:17, assignedBy:"rh_east",    assignedByName:"Region Head – East",    repId:17, clientCompany:"Patanjali Ayurved",  title:"Finalise Yoga IP tie-in structure",          description:"Get written confirmation from Patanjali on IP tie-in terms before the next pitch meeting.",       priority:"High",   status:"In Progress", dueDate:TOMORROW, createdAt:D1 },
  { id:"t10", assignedTo:19, assignedBy:"rh_west",    assignedByName:"Region Head – West",    repId:19, clientCompany:"Airtel India",       title:"Submit integrated package offer note",       description:"Draft and submit the premium integrated package deal note for Airtel CMO's approval.",            priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t11", assignedTo:21, assignedBy:"rh_west",    assignedByName:"Region Head – West",    repId:21, clientCompany:"Flipkart",           title:"Lock Big Billion Days campaign slots",       description:"Confirm and lock primetime + digital slots for Flipkart's festive campaign package.",             priority:"High",   status:"Open",        dueDate:TOMORROW, createdAt:TODAY },
  { id:"t12", assignedTo:22, assignedBy:"gk",         assignedByName:"GK (Sales Head)",       repId:22, clientCompany:"HUL",                title:"Get sign-off for national campaign package", description:"HUL CEO meeting planned — get package sign-off before end of week.",                             priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t13", assignedTo:25, assignedBy:"gk",         assignedByName:"GK (Sales Head)",       repId:25, clientCompany:"Coca-Cola India",    title:"Confirm summer campaign airing dates",       description:"Lock Q1 primetime slots for Coca-Cola summer campaign. Coordinate with programming.",              priority:"Medium", status:"In Progress", dueDate:TOMORROW, createdAt:D3 },
  { id:"t14", assignedTo:26, assignedBy:"rh_central", assignedByName:"Region Head – Central", repId:26, clientCompany:"ONGC",               title:"Prepare ONGC corporate PR campaign deck",   description:"Build customised corporate PR deck for ONGC Odisha operations team.",                             priority:"Medium", status:"Open",        dueDate:D3,       createdAt:D7 },
  { id:"t15", assignedTo:28, assignedBy:"rh_central", assignedByName:"Region Head – Central", repId:28, clientCompany:"BPCL",               title:"Send fuel brand campaign proposal",          description:"Finalise and send the Speed + Pure for Sure campaign deck to BPCL GM Marketing.",                priority:"High",   status:"Open",        dueDate:TODAY,    createdAt:D1 },
  { id:"t16", assignedTo:30, assignedBy:"rh_central", assignedByName:"Region Head – Central", repId:30, clientCompany:"Odisha State Coop",  title:"Follow up on cooperative IP sponsorship",   description:"OSCB CEO has confirmed interest. Send IP sponsorship terms and slot options.",                    priority:"High",   status:"Open",        dueDate:TOMORROW, createdAt:TODAY },
];

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

const SEED_PLANS = [
  { id:"p1",  repId:1,  date:TODAY,    time:"10:00", clientAgencyName:"Reliance Retail",      contactName:"Sameer Joshi",    agenda:"Present revised OTT + TV integrated grid",     pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p2",  repId:1,  date:TODAY,    time:"14:30", clientAgencyName:"ITC Foods",             contactName:"Saurabh Tiwari",  agenda:"Q3 renewal — push for 6-week primetime",       pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p3",  repId:2,  date:TODAY,    time:"11:00", clientAgencyName:"Berger Paints",         contactName:"Rajesh Kumar",    agenda:"PO follow-up, brand guidelines for FCT",       pitchType:"FCT",                 status:"Done",    loggedMeetingId:"ml2", isUnplanned:false },
  { id:"p4",  repId:5,  date:TODAY,    time:"09:00", clientAgencyName:"Havells India",         contactName:"Deepa Menon",     agenda:"H2 sponsorship deck walkthrough",               pitchType:"IPs",                 status:"Done",    loggedMeetingId:"ml1", isUnplanned:false },
  { id:"p5",  repId:1,  date:TOMORROW, time:"10:00", clientAgencyName:"Reliance Retail",      contactName:"Sameer Joshi",    agenda:"Follow-up on revised grid feedback",            pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p6",  repId:2,  date:TOMORROW, time:"15:00", clientAgencyName:"Apollo Hospitals",     contactName:"Ravi Krishnan",   agenda:"Digital health campaign proposal",              pitchType:"Digital",             status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p7",  repId:5,  date:TOMORROW, time:"11:30", clientAgencyName:"Asian Paints",         contactName:"Harsh Goenka",    agenda:"CMO meeting — flagship package",                pitchType:"IPs",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p8",  repId:7,  date:TODAY,    time:"10:30", clientAgencyName:"Maruti Suzuki",        contactName:"Arun Kapoor",     agenda:"Summer FCT grid walkthrough",                   pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p9",  repId:7,  date:TOMORROW, time:"14:00", clientAgencyName:"Nestle India",         contactName:"Priya Bhatt",     agenda:"Integrated grid review and revision",           pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p10", repId:9,  date:TODAY,    time:"11:00", clientAgencyName:"LG Electronics",       contactName:"Seema Jain",      agenda:"Premium slot package discussion with CMO",      pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p11", repId:9,  date:TOMORROW, time:"10:00", clientAgencyName:"Samsung India",        contactName:"Tarun Mehta",     agenda:"Campaign go-live PO handover",                  pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p12", repId:11, date:TODAY,    time:"09:30", clientAgencyName:"Dr Reddy's Labs",      contactName:"Kavitha Murthy",  agenda:"Digital health plan first look",                pitchType:"Digital",             status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p13", repId:13, date:TODAY,    time:"15:00", clientAgencyName:"Britannia Industries", contactName:"Harish Bhat",     agenda:"PO collection — deal closed",                   pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p14", repId:14, date:TODAY,    time:"10:00", clientAgencyName:"Tata Steel",           contactName:"Ajay Tandon",     agenda:"Corporate brand campaign kickoff",              pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p15", repId:17, date:TODAY,    time:"11:30", clientAgencyName:"Patanjali Ayurved",    contactName:"Divya Trivedi",   agenda:"Yoga IP tie-in terms finalisation",             pitchType:"IPs",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p16", repId:17, date:TOMORROW, time:"14:30", clientAgencyName:"Reliance Retail",      contactName:"Sneha Dey",       agenda:"Digital + FCT combo pitch",                     pitchType:"Digital",             status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p17", repId:19, date:TODAY,    time:"12:00", clientAgencyName:"Airtel India",         contactName:"Pawan Tiwari",    agenda:"Premium integrated package offer note",         pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p18", repId:21, date:TODAY,    time:"10:00", clientAgencyName:"Flipkart",             contactName:"Vikash Singhania",agenda:"Big Billion Days campaign slot locking",        pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p19", repId:22, date:TODAY,    time:"09:00", clientAgencyName:"HUL",                  contactName:"Sanjiv Mehta",    agenda:"National integrated campaign sign-off",         pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p20", repId:25, date:TODAY,    time:"11:00", clientAgencyName:"Coca-Cola India",      contactName:"Prasoon Joshi",   agenda:"Summer campaign airing date lock-in",           pitchType:"Integrated Packages", status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p21", repId:25, date:TOMORROW, time:"15:00", clientAgencyName:"Red Bull India",       contactName:"Simone Shah",     agenda:"Sports media solutions pitch",                  pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p22", repId:26, date:TODAY,    time:"10:00", clientAgencyName:"ONGC",                 contactName:"Subash Nayak",    agenda:"Corporate PR campaign deck walkthrough",        pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p23", repId:28, date:TODAY,    time:"11:30", clientAgencyName:"BPCL",                 contactName:"Mahesh Tripathy", agenda:"Fuel brand campaign deck presentation",         pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p24", repId:30, date:TODAY,    time:"14:00", clientAgencyName:"Odisha State Coop",    contactName:"Biswajit Pattnaik",agenda:"Cooperative banking IP sponsorship terms",     pitchType:"IPs",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
  { id:"p25", repId:30, date:TOMORROW, time:"10:30", clientAgencyName:"IDBI Bank",            contactName:"Saswat Rath",     agenda:"Banking campaign revised rate card review",     pitchType:"FCT",                 status:"Planned", loggedMeetingId:null,  isUnplanned:false },
];

// Weekly plans
const SEED_WEEKLY_PLANS = [
  { id:"wp1", repId:1, weekStart:THIS_WEEK_START, submittedAt:"2026-03-22T21:00:00", meetings:[
    { date:TODAY,    time:"10:00", clientAgencyName:"Reliance Retail",  agenda:"OTT + TV grid" },
    { date:TODAY,    time:"14:30", clientAgencyName:"ITC Foods",         agenda:"Q3 renewal" },
    { date:TOMORROW, time:"10:00", clientAgencyName:"Reliance Retail",  agenda:"Grid feedback" },
  ]},
];
const SEED_ABSENCE_REPORTS = [
  { id:"ab1",  repId:3,  repName:"Rohit Nanda",      region:"East",    role:"Sales Executive", date:TODAY, generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab2",  repId:3,  repName:"Rohit Nanda",      region:"East",    role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab3",  repId:1,  repName:"Arjun Mishra",     region:"North",   role:"Sales Executive", date:D3,    generatedAt:"23:59", status:"Exception Granted", sentTo:HR_EMAIL, markedAs:"Present", exception:"Overridden",exceptionBy:"Litisha (CXO)", exceptionReason:"Client emergency — Reliance site visit, phone network down.", generatedBy:"System (Auto)" },
  { id:"ab4",  repId:8,  repName:"Kavya Singh",      region:"North",   role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab5",  repId:12, repName:"Ananya Krishnan",  region:"South",   role:"Sales Executive", date:TODAY, generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab6",  repId:16, repName:"Bikash Pradhan",   region:"East",    role:"Sales Executive", date:D3,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab7",  repId:16, repName:"Bikash Pradhan",   region:"East",    role:"Sales Executive", date:D7,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab8",  repId:18, repName:"Varun Mehta",      region:"West",    role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Exception Granted", sentTo:HR_EMAIL, markedAs:"Present", exception:"Overridden",exceptionBy:"Litisha (CXO)", exceptionReason:"Client field visit — Reliance Jio site demo. Confirmed by RH.", generatedBy:"System (Auto)" },
  { id:"ab9",  repId:27, repName:"Lipika Mishra",    region:"Central", role:"Sales Executive", date:TODAY, generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab10", repId:29, repName:"Sunita Sahoo",     region:"Central", role:"Sales Executive", date:D3,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab11", repId:10, repName:"Pooja Agarwal",    region:"North",   role:"Sales Executive", date:D7,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
  { id:"ab12", repId:24, repName:"Shreya Bose",      region:"National",role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Sent to HR",       sentTo:HR_EMAIL, markedAs:"Absent",  exception:null,       exceptionBy:null,          exceptionReason:null, generatedBy:"System (Auto)" },
];

const REPS = [
  // ── NORTH (5 reps) ──
  { id:  1, name: "Arjun Mishra",     region: "North",    role: "Sales Executive",          target: 18000000 },
  { id:  7, name: "Rahul Sharma",     region: "North",    role: "Senior Sales",             target: 20000000 },
  { id:  8, name: "Kavya Singh",      region: "North",    role: "Sales Executive",          target: 15000000 },
  { id:  9, name: "Manish Tiwari",    region: "North",    role: "Senior Sales",             target: 22000000 },
  { id: 10, name: "Pooja Agarwal",    region: "North",    role: "Sales Executive",          target: 16000000 },
  // ── SOUTH (5 reps) ──
  { id:  2, name: "Priya Dash",       region: "South",    role: "Senior Sales",             target: 22000000 },
  { id:  6, name: "Meera Rao",        region: "South",    role: "Sales Executive",          target: 14000000 },
  { id: 11, name: "Suresh Reddy",     region: "South",    role: "Senior Sales",             target: 19000000 },
  { id: 12, name: "Ananya Krishnan",  region: "South",    role: "Sales Executive",          target: 13000000 },
  { id: 13, name: "Karthik Iyer",     region: "South",    role: "Senior Sales",             target: 21000000 },
  // ── EAST (5 reps) ──
  { id:  3, name: "Rohit Nanda",      region: "East",     role: "Sales Executive",          target: 12000000 },
  { id: 14, name: "Sanjay Mohanty",   region: "East",     role: "Senior Sales",             target: 17000000 },
  { id: 15, name: "Debasmita Das",    region: "East",     role: "Sales Executive",          target: 14000000 },
  { id: 16, name: "Bikash Pradhan",   region: "East",     role: "Sales Executive",          target: 11000000 },
  { id: 17, name: "Rina Panda",       region: "East",     role: "Senior Sales",             target: 18000000 },
  // ── WEST (5 reps) ──
  { id:  4, name: "Sneha Patel",      region: "West",     role: "Senior Sales",             target: 16000000 },
  { id: 18, name: "Varun Mehta",      region: "West",     role: "Sales Executive",          target: 13000000 },
  { id: 19, name: "Divya Joshi",      region: "West",     role: "Senior Sales",             target: 20000000 },
  { id: 20, name: "Amit Desai",       region: "West",     role: "Sales Executive",          target: 15000000 },
  { id: 21, name: "Preethi Shah",     region: "West",     role: "Senior Sales",             target: 17000000 },
  // ── NATIONAL (5 reps) ──
  { id:  5, name: "Vikram Sen",       region: "National", role: "National Account Manager", target: 45000000 },
  { id: 22, name: "Neha Kapoor",      region: "National", role: "Senior Sales",             target: 35000000 },
  { id: 23, name: "Rajesh Malhotra",  region: "National", role: "National Account Manager", target: 40000000 },
  { id: 24, name: "Shreya Bose",      region: "National", role: "Sales Executive",          target: 28000000 },
  { id: 25, name: "Aditya Kumar",     region: "National", role: "Senior Sales",             target: 32000000 },
  // ── CENTRAL (5 reps) ──
  { id: 26, name: "Sameer Nayak",     region: "Central",  role: "Senior Sales",             target: 18000000 },
  { id: 27, name: "Lipika Mishra",    region: "Central",  role: "Sales Executive",          target: 14000000 },
  { id: 28, name: "Pratap Rath",      region: "Central",  role: "Senior Sales",             target: 20000000 },
  { id: 29, name: "Sunita Sahoo",     region: "Central",  role: "Sales Executive",          target: 12000000 },
  { id: 30, name: "Debadatta Patra",  region: "Central",  role: "Senior Sales",             target: 16000000 },
];

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

const SEED_DEALS = [
  // ── NATIONAL (Vikram Sen, repId:5) ──
  { id:"d1",  repId:5, clientCompany:"Havells India",      contactName:"Deepa Menon",    designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9823401234", email:"deepa@havells.com",      dealType:"IPs",        outcome:"Very Interested",             amount:15000000, targetAmount:15000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Send H2 sponsorship deck",               nextStepDate:D1,       awaitingApproval:"NSH",            awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"H2 sponsorship deck",status:"In Progress",raisedAt:"14:00"}], notes:"Budget confirmed. CMO interested." },
  { id:"d2",  repId:5, clientCompany:"Asian Paints",       contactName:"Harsh Goenka",   designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9834512345", email:"harsh@asianpaints.com",  dealType:"IPs",        outcome:"Very Interested",             amount:12000000, targetAmount:12000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D3,    nextStep:"CMO meeting – present flagship package", nextStepDate:D1,       awaitingApproval:"CXO",            awaitingApprovalSince:D1,   reqs:[], notes:"Need CEO to attend CMO meeting." },
  { id:"d3",  repId:5, clientCompany:"Tata Consumer",      contactName:"Ravi Shankar",   designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9812309876", email:"ravi@tataconsumer.com",  dealType:"Integrated Packages", outcome:"Interested – Needs Revision", amount:9000000,  targetAmount:9000000,  region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised multi-brand grid",               nextStepDate:D3,       awaitingApproval:"Sales Strategy", awaitingApprovalSince:D7,   reqs:[{dept:"Sales Strategy",desc:"Multi-brand integrated grid",status:"Overdue",raisedAt:"09:00"}], notes:"Multi-brand portfolio." },
  // ── SOUTH (Priya Dash repId:2, Meera Rao repId:6) ──
  { id:"d4",  repId:2, clientCompany:"Berger Paints",      contactName:"Rajesh Kumar",   designation:"Brand Manager",  contactLevel:"Brand Manager",   phone:"9812345678", email:"rajesh@berger.com",      dealType:"Linear TV",          outcome:"Proposal Accepted",           amount:2200000,  targetAmount:3500000,  region:"South",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"PO follow-up",                           nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"6-week primetime deal closed." },
  { id:"d5",  repId:6, clientCompany:"Apollo Hospitals",   contactName:"Ravi Krishnan",  designation:"GM Marketing",   contactLevel:"VP / GM",         phone:"9901234567", email:"ravi@apollo.com",        dealType:"Digital",            outcome:"Very Interested",             amount:6000000,  targetAmount:7500000,  region:"South",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Custom digital media plan",              nextStepDate:D3,       awaitingApproval:"Digital",        awaitingApprovalSince:D1,   reqs:[{dept:"Digital",desc:"Custom digital plan",status:"Done",raisedAt:"12:00"}], notes:"Full digital takeover." },
  { id:"d6",  repId:2, clientCompany:"Sundaram Finance",   contactName:"Kavita Nair",    designation:"Marketing Head", contactLevel:"VP / GM",         phone:"9845612345", email:"kavita@sundaram.com",    dealType:"Linear TV",          outcome:"Needs Callback",              amount:3000000,  targetAmount:4000000,  region:"South",    priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Follow up after budget approval",        nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Q2 budget cycle." },
  // ── NORTH (Arjun Mishra, repId:1) ──
  { id:"d7",  repId:1, clientCompany:"Daikin India",       contactName:"Prashant Joshi", designation:"VP Sales",       contactLevel:"VP / GM",         phone:"9876543210", email:"prashant@daikin.in",     dealType:"Linear TV",          outcome:"Very Interested",             amount:4500000,  targetAmount:5000000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D1,    nextStep:"Revised FCT grid for summer campaign",   nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Summer AC campaign — high intent." },
  { id:"d8",  repId:1, clientCompany:"Relaxo Footwear",    contactName:"Amit Gupta",     designation:"Brand Manager",  contactLevel:"Brand Manager",   phone:"9911223344", email:"amit@relaxo.com",        dealType:"IPs",        outcome:"Interested – Needs Revision", amount:2800000,  targetAmount:3500000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Sponsorship deck with property details", nextStepDate:D1,       awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Property sponsorship deck",status:"Pending",raisedAt:"10:00"}], notes:"Property title rights needed." },
  // ── EAST (Rohit Nanda, repId:3) ──
  { id:"d9",  repId:3, clientCompany:"ITC Limited",        contactName:"Sumit Das",      designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9933445566", email:"sumit@itc.in",           dealType:"Integrated Packages", outcome:"Very Interested",             amount:5500000,  targetAmount:6000000,  region:"East",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Integrated plan for FMCG brands",        nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"ITC wants TV+Digital combo for East market." },
  { id:"d10", repId:3, clientCompany:"Emami Group",        contactName:"Harsha Reddy",   designation:"Brand Director", contactLevel:"VP / GM",         phone:"9955667788", email:"harsha@emami.com",       dealType:"Linear TV",          outcome:"Price Concern",               amount:2000000,  targetAmount:3000000,  region:"East",     priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised rate card with discount",        nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"Rate sensitivity. NSH approval needed on discount." },
  // ── WEST (Sneha Patel, repId:4) ──
  { id:"d11", repId:4, clientCompany:"Pidilite Industries",contactName:"Rakesh Shah",    designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9977889900", email:"rakesh@pidilite.com",    dealType:"IPs",        outcome:"Very Interested",             amount:7000000,  targetAmount:8000000,  region:"West",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Sponsorship deal for Fevicol brand",     nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"CMO personally keen. Premium slot required." },
  { id:"d12", repId:4, clientCompany:"Godrej Consumer",    contactName:"Nisha Mehta",    designation:"Marketing Head", contactLevel:"VP / GM",         phone:"9988001122", email:"nisha@godrej.com",       dealType:"Digital",            outcome:"Needs Callback",              amount:3500000,  targetAmount:5000000,  region:"West",     priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Digital campaign brief",                 nextStepDate:TOMORROW, awaitingApproval:"Digital",        awaitingApprovalSince:D3,   reqs:[{dept:"Digital",desc:"Campaign brief for GCPL",status:"In Progress",raisedAt:"11:00"}], notes:"GCPL digital push for West India." },
  // ── NORTH NEW REPS ──
  { id:"d13", repId:7,  clientCompany:"Maruti Suzuki",      contactName:"Arun Kapoor",    designation:"Marketing Head", contactLevel:"VP / GM",         phone:"9811001100", email:"arun@maruti.com",        dealType:"Linear TV",          outcome:"Very Interested",             amount:8500000,  targetAmount:9000000,  region:"North",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Summer campaign FCT grid",               nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Alto 800 & Swift campaign for North belt." },
  { id:"d14", repId:7,  clientCompany:"Nestle India",       contactName:"Priya Bhatt",    designation:"Brand Director", contactLevel:"VP / GM",         phone:"9822002200", email:"priya@nestle.com",       dealType:"Integrated Packages",outcome:"Interested – Needs Revision", amount:6000000,  targetAmount:7500000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Revised integrated grid with digital",   nextStepDate:TOMORROW, awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Integrated grid for Nestle",status:"Pending",raisedAt:"11:30"}], notes:"Maggi + KitKat combo campaign." },
  { id:"d15", repId:8,  clientCompany:"Dabur India",        contactName:"Vineet Sharma",  designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9833003300", email:"vineet@dabur.com",       dealType:"IPs",                outcome:"Price Concern",               amount:4200000,  targetAmount:5500000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised sponsorship rates",              nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"Chyawanprash season push. Rate sensitivity." },
  { id:"d16", repId:8,  clientCompany:"Bajaj Consumer",     contactName:"Rohit Bose",     designation:"Brand Manager",  contactLevel:"Brand Manager",   phone:"9844004400", email:"rohit@bajajconsumer.com",dealType:"Linear TV",          outcome:"Needs Callback",              amount:3000000,  targetAmount:4000000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Follow-up after Q2 budget cycle",        nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Almond Drops hair oil summer push." },
  { id:"d17", repId:9,  clientCompany:"LG Electronics",     contactName:"Seema Jain",     designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9855005500", email:"seema@lg.com",           dealType:"Integrated Packages",outcome:"Very Interested",             amount:11000000, targetAmount:12000000, region:"North",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Premium slot + OTT combo proposal",      nextStepDate:D1,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"AC & refrigerator summer campaign." },
  { id:"d18", repId:9,  clientCompany:"Samsung India",      contactName:"Tarun Mehta",    designation:"Marketing Head", contactLevel:"Marketing Head",  phone:"9866006600", email:"tarun@samsung.com",      dealType:"Digital",            outcome:"Proposal Accepted",           amount:5500000,  targetAmount:5500000,  region:"North",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO collection",                          nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Galaxy S series launch campaign. Closed." },
  { id:"d19", repId:10, clientCompany:"HUL – Lakme",        contactName:"Nandita Roy",    designation:"Brand Director", contactLevel:"VP / GM",         phone:"9877007700", email:"nandita@hul.com",        dealType:"Media Solutions",    outcome:"Interested – Needs Revision", amount:4000000,  targetAmount:5000000,  region:"North",    priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Custom media solutions deck",            nextStepDate:D3,       awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Media solutions for Lakme",status:"In Progress",raisedAt:"10:00"}], notes:"Beauty segment — wants strong female viewership data." },
  { id:"d20", repId:10, clientCompany:"Marico Industries",  contactName:"Ankit Sethi",    designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9888008800", email:"ankit@marico.com",       dealType:"Linear TV",          outcome:"Very Interested",             amount:6500000,  targetAmount:7000000,  region:"North",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Primetime slot confirmation",            nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Parachute & Saffola — dual brand campaign." },
  // ── SOUTH NEW REPS ──
  { id:"d21", repId:11, clientCompany:"Dr Reddy's Labs",    contactName:"Kavitha Murthy", designation:"Marketing Head", contactLevel:"Marketing Head",  phone:"9899009900", email:"kavitha@drreddys.com",   dealType:"Digital",            outcome:"Very Interested",             amount:5000000,  targetAmount:6000000,  region:"South",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Health campaign digital plan",           nextStepDate:D3,       awaitingApproval:"Digital",        awaitingApprovalSince:D1,   reqs:[{dept:"Digital",desc:"Health awareness digital plan",status:"In Progress",raisedAt:"09:30"}], notes:"Generic pharma OTC brand awareness South India." },
  { id:"d22", repId:11, clientCompany:"Cipla Health",       contactName:"Sridhar Rao",    designation:"Brand Director", contactLevel:"VP / GM",         phone:"9810101010", email:"sridhar@cipla.com",      dealType:"Linear TV",          outcome:"Price Concern",               amount:3500000,  targetAmount:5000000,  region:"South",    priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised rate card for Tamil Nadu belt",  nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"OTC product launch campaign. Tight budget." },
  { id:"d23", repId:12, clientCompany:"TVS Motors",         contactName:"Ganesh Iyer",    designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9821202020", email:"ganesh@tvsmotor.com",    dealType:"IPs",                outcome:"Very Interested",             amount:8000000,  targetAmount:9500000,  region:"South",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Cricket + Reality show sponsorship deal",nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Apache RTR sponsorship. Strong interest." },
  { id:"d24", repId:12, clientCompany:"Hero MotoCorp",      contactName:"Meenakshi Lal",  designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9832303030", email:"meenakshi@heromotocorp.com",dealType:"Linear TV",       outcome:"Needs Callback",              amount:4000000,  targetAmount:5500000,  region:"South",    priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Budget confirmation after board meet",   nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Splendor campaign. On hold pending Q2 budget." },
  { id:"d25", repId:13, clientCompany:"Britannia Industries",contactName:"Harish Bhat",   designation:"MD",             contactLevel:"C-Suite / Owner", phone:"9843404040", email:"harish@britannia.in",    dealType:"Integrated Packages",outcome:"Proposal Accepted",           amount:10500000, targetAmount:10500000, region:"South",    priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO and invoice",                         nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Good Day & Marie Gold biscuits. Deal sealed." },
  { id:"d26", repId:13, clientCompany:"Parle Products",     contactName:"Rohini Suresh",  designation:"Marketing Head", contactLevel:"Marketing Head",  phone:"9854505050", email:"rohini@parle.com",       dealType:"Linear TV",          outcome:"Interested – Needs Revision", amount:5500000,  targetAmount:7000000,  region:"South",    priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Festival campaign grid proposal",        nextStepDate:TOMORROW, awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Festival grid for Parle",status:"Pending",raisedAt:"12:00"}], notes:"Parle-G festive push. Needs primetime weekend slots." },
  // ── EAST NEW REPS ──
  { id:"d27", repId:14, clientCompany:"Tata Steel",         contactName:"Ajay Tandon",    designation:"VP Corporate Affairs",contactLevel:"VP / GM",     phone:"9865606060", email:"ajay@tatasteel.com",     dealType:"Media Solutions",    outcome:"Very Interested",             amount:7000000,  targetAmount:8000000,  region:"East",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Corporate brand campaign deck",          nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Brand visibility campaign. East-heavy mandate." },
  { id:"d28", repId:14, clientCompany:"Adani Wilmar",       contactName:"Preeti Gupta",   designation:"Brand Director", contactLevel:"VP / GM",         phone:"9876707070", email:"preeti@adaniwilmar.com", dealType:"IPs",                outcome:"Interested – Needs Revision", amount:4500000,  targetAmount:6000000,  region:"East",     priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Fortune Oil sponsorship proposal",       nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"Fortune brand — needs revised IP tie-in." },
  { id:"d29", repId:15, clientCompany:"NALCO",              contactName:"Bijaya Kumar",    designation:"GM PR",          contactLevel:"VP / GM",         phone:"9887808080", email:"bijaya@nalco.gov.in",    dealType:"Linear TV",          outcome:"Price Concern",               amount:2500000,  targetAmount:4000000,  region:"East",     priority:"Regular",quarter:"Q2 FY26", lastContact:D7,    nextStep:"Govt rate approval",                     nextStepDate:D7,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"PSU deal — tendering process. Long cycle." },
  { id:"d30", repId:15, clientCompany:"SAIL",               contactName:"Sunita Tripathy", designation:"DGM Marketing",  contactLevel:"VP / GM",        phone:"9898909090", email:"sunita@sail.in",         dealType:"Linear TV",          outcome:"Needs Callback",              amount:3000000,  targetAmount:4500000,  region:"East",     priority:"Regular",quarter:"Q2 FY26", lastContact:D3,    nextStep:"Revised proposal post management change",nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"New DGM took over. Needs re-introduction meeting." },
  { id:"d31", repId:16, clientCompany:"Vedanta Resources",  contactName:"Kapil Jain",     designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9809010101", email:"kapil@vedanta.com",      dealType:"Media Solutions",    outcome:"Very Interested",             amount:9000000,  targetAmount:10000000, region:"East",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"CSR + brand campaign media plan",        nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Vedanta wants strong CSR positioning in Odisha." },
  { id:"d32", repId:16, clientCompany:"Bhushan Power",      contactName:"Amit Ranjan",    designation:"Brand Manager",  contactLevel:"Brand Manager",   phone:"9820111111", email:"amit@bhushan.com",       dealType:"Linear TV",          outcome:"Proposal Accepted",           amount:3200000,  targetAmount:3200000,  region:"East",     priority:"Regular",quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO follow-up",                           nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Industrial brand — deal closed. PO due." },
  { id:"d33", repId:17, clientCompany:"Patanjali Ayurved",  contactName:"Divya Trivedi",  designation:"Marketing Head", contactLevel:"Marketing Head",  phone:"9831212121", email:"divya@patanjali.com",    dealType:"IPs",                outcome:"Very Interested",             amount:6500000,  targetAmount:7500000,  region:"East",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Yoga campaign IP tie-in",                nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Baba Ramdev campaign — East India focus." },
  { id:"d34", repId:17, clientCompany:"Reliance Retail",    contactName:"Sneha Dey",      designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9842313131", email:"sneha.dey@ril.com",      dealType:"Digital",            outcome:"Interested – Needs Revision", amount:5000000,  targetAmount:6500000,  region:"East",     priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Digital + FCT combo brief",              nextStepDate:TOMORROW, awaitingApproval:"Digital",        awaitingApprovalSince:D3,   reqs:[{dept:"Digital",desc:"Digital combo for Reliance East",status:"Pending",raisedAt:"14:00"}], notes:"JioMart East expansion push." },
  // ── WEST NEW REPS ──
  { id:"d35", repId:18, clientCompany:"Reliance Jio",       contactName:"Mohan Kapoor",   designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9853414141", email:"mohan@jio.com",          dealType:"Digital",            outcome:"Proposal Accepted",           amount:9000000,  targetAmount:9000000,  region:"West",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO and go-live",                         nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"5G launch campaign West India. Deal closed." },
  { id:"d36", repId:18, clientCompany:"Vodafone Idea",      contactName:"Kritika Bhatia", designation:"Brand Director", contactLevel:"VP / GM",         phone:"9864515151", email:"kritika@vi.com",         dealType:"Linear TV",          outcome:"Price Concern",               amount:4000000,  targetAmount:6000000,  region:"West",     priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised FCT rates",                      nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"Vi rebranding campaign. Tight budget. Rate issue." },
  { id:"d37", repId:19, clientCompany:"Airtel India",       contactName:"Pawan Tiwari",   designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9875616161", email:"pawan@airtel.com",       dealType:"Integrated Packages",outcome:"Very Interested",             amount:13000000, targetAmount:14000000, region:"West",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Premium integrated package deal",        nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Xstream + broadband combo campaign. Strong intent." },
  { id:"d38", repId:19, clientCompany:"Tata Communications",contactName:"Ritu Sharma",    designation:"Marketing Head", contactLevel:"Marketing Head",  phone:"9886717171", email:"ritu@tatacomm.com",      dealType:"Media Solutions",    outcome:"Needs Callback",              amount:5000000,  targetAmount:7000000,  region:"West",     priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Media solutions deck for enterprise",    nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Enterprise B2B segment — longer decision cycle." },
  { id:"d39", repId:20, clientCompany:"Zomato",             contactName:"Sundar Rajan",   designation:"VP Brand",       contactLevel:"VP / GM",         phone:"9897818181", email:"sundar@zomato.com",      dealType:"Digital",            outcome:"Very Interested",             amount:7500000,  targetAmount:8500000,  region:"West",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Social + digital heavy campaign brief",  nextStepDate:D3,       awaitingApproval:"Digital",        awaitingApprovalSince:D1,   reqs:[{dept:"Digital",desc:"Digital campaign for Zomato",status:"In Progress",raisedAt:"15:00"}], notes:"Hyperlocal food delivery awareness campaign." },
  { id:"d40", repId:20, clientCompany:"Swiggy",             contactName:"Asha Patel",     designation:"Marketing Director",contactLevel:"VP / GM",       phone:"9808919191", email:"asha@swiggy.in",         dealType:"Digital",            outcome:"Interested – Needs Revision", amount:4000000,  targetAmount:5500000,  region:"West",     priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Revised digital plan with reach data",   nextStepDate:TOMORROW, awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Reach data deck for Swiggy",status:"Pending",raisedAt:"11:00"}], notes:"Wants OTV reach data across West markets." },
  { id:"d41", repId:21, clientCompany:"Flipkart",           contactName:"Vikash Singhania",designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9819020202", email:"vikash@flipkart.com",    dealType:"Integrated Packages",outcome:"Very Interested",             amount:12000000, targetAmount:13000000, region:"West",     priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Big Billion Days campaign package",      nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Festive season combo push — TV + digital." },
  { id:"d42", repId:21, clientCompany:"Amazon India",       contactName:"Namrata Sinha",  designation:"Brand Manager",  contactLevel:"Brand Manager",   phone:"9830121212", email:"namrata@amazon.in",      dealType:"Linear TV",          outcome:"Needs Callback",              amount:6000000,  targetAmount:8000000,  region:"West",     priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Budget alignment with India marketing",  nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"India ops team needs US HQ approval for budget." },
  // ── NATIONAL NEW REPS ──
  { id:"d43", repId:22, clientCompany:"HUL",                contactName:"Sanjiv Mehta",   designation:"CEO",            contactLevel:"C-Suite / Owner", phone:"9841222222", email:"sanjiv@hul.com",         dealType:"Integrated Packages",outcome:"Very Interested",             amount:25000000, targetAmount:28000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"National integrated campaign package",   nextStepDate:D3,       awaitingApproval:"CXO",            awaitingApprovalSince:D1,   reqs:[], notes:"HUL multi-brand campaign — national mandate." },
  { id:"d44", repId:22, clientCompany:"Procter & Gamble",   contactName:"Madhusudan Kela",designation:"MD India",        contactLevel:"C-Suite / Owner", phone:"9852323232", email:"madhu@pg.com",           dealType:"IPs",                outcome:"Interested – Needs Revision", amount:18000000, targetAmount:22000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised sponsorship package for P&G",    nextStepDate:D3,       awaitingApproval:"Sales Strategy", awaitingApprovalSince:D7,   reqs:[{dept:"Sales Strategy",desc:"P&G national sponsorship deck",status:"Overdue",raisedAt:"09:00"}], notes:"Tide, Ariel, Pampers — multi-brand IP tie-in." },
  { id:"d45", repId:23, clientCompany:"Colgate Palmolive",  contactName:"Ram Raghavan",   designation:"MD",             contactLevel:"C-Suite / Owner", phone:"9863424242", email:"ram@colgate.com",         dealType:"Linear TV",          outcome:"Proposal Accepted",           amount:16000000, targetAmount:16000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO and invoice",                         nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"National FCT campaign closed. Flagship deal." },
  { id:"d46", repId:23, clientCompany:"Reckitt Benckiser",  contactName:"Laxman Narasimhan",designation:"Regional VP",  contactLevel:"C-Suite / Owner", phone:"9874525252", email:"laxman@reckitt.com",     dealType:"Integrated Packages",outcome:"Very Interested",             amount:20000000, targetAmount:22000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Dettol + Harpic national combo",         nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Hygiene category — national push post COVID." },
  { id:"d47", repId:24, clientCompany:"Mondelez India",     contactName:"Deepak Iyer",    designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9885626262", email:"deepak@mondelez.com",    dealType:"IPs",                outcome:"Very Interested",             amount:14000000, targetAmount:15000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Cadbury brand property sponsorship",     nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Silk + Bournvita dual brand IP deal." },
  { id:"d48", repId:24, clientCompany:"PepsiCo India",      contactName:"Ahmed Khan",     designation:"CMO",            contactLevel:"C-Suite / Owner", phone:"9896727272", email:"ahmed@pepsico.com",      dealType:"Digital",            outcome:"Interested – Needs Revision", amount:10000000, targetAmount:13000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:D3,    nextStep:"Digital-first campaign plan",            nextStepDate:D3,       awaitingApproval:"Digital",        awaitingApprovalSince:D3,   reqs:[{dept:"Digital",desc:"Digital plan for PepsiCo IPL season",status:"In Progress",raisedAt:"10:30"}], notes:"IPL season digital + OTT heavy campaign." },
  { id:"d49", repId:25, clientCompany:"Coca-Cola India",    contactName:"Prasoon Joshi",  designation:"VP Marketing",   contactLevel:"VP / GM",         phone:"9807828282", email:"prasoon@coca-cola.com",  dealType:"Integrated Packages",outcome:"Very Interested",             amount:18000000, targetAmount:20000000, region:"National", priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Summer campaign national package",        nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Thums Up + Limca summer push. High intent." },
  { id:"d50", repId:25, clientCompany:"Red Bull India",     contactName:"Simone Shah",    designation:"Country Head",   contactLevel:"C-Suite / Owner", phone:"9818929292", email:"simone@redbull.com",     dealType:"Media Solutions",    outcome:"Needs Callback",              amount:6000000,  targetAmount:8000000,  region:"National", priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Custom media solutions for sports segment",nextStepDate:D7,      awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Niche youth sports segment. Budget conservative." },
  // ── CENTRAL NEW REPS ──
  { id:"d51", repId:26, clientCompany:"ONGC",               contactName:"Subash Nayak",   designation:"CGM PR",         contactLevel:"VP / GM",         phone:"9829030303", email:"subash@ongc.co.in",      dealType:"Media Solutions",    outcome:"Very Interested",             amount:8000000,  targetAmount:10000000, region:"Central",  priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"Corporate PR campaign for Odisha ops",   nextStepDate:D3,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"ONGC local community outreach campaign." },
  { id:"d52", repId:26, clientCompany:"Coal India",         contactName:"Tapas Mohanty",  designation:"GM Corp Comm",   contactLevel:"VP / GM",         phone:"9840131313", email:"tapas@coalindia.in",     dealType:"Linear TV",          outcome:"Needs Callback",              amount:3500000,  targetAmount:5000000,  region:"Central",  priority:"Regular",quarter:"Q2 FY26", lastContact:D7,    nextStep:"Tender-based proposal",                  nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"PSU annual ad budget. Tender process." },
  { id:"d53", repId:27, clientCompany:"State Bank of India",contactName:"Rajesh Padhi",   designation:"DGM Marketing",  contactLevel:"VP / GM",         phone:"9851232323", email:"rajesh@sbi.co.in",       dealType:"Linear TV",          outcome:"Interested – Needs Revision", amount:5500000,  targetAmount:7000000,  region:"Central",  priority:"Top 5",  quarter:"Q1 FY26", lastContact:D3,    nextStep:"Festive savings campaign proposal",      nextStepDate:TOMORROW, awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"SBI festive campaign deck",status:"Pending",raisedAt:"09:00"}], notes:"SBI festive deposit drive campaign." },
  { id:"d54", repId:27, clientCompany:"LIC India",          contactName:"Suchitra Panda", designation:"DRM Marketing",  contactLevel:"VP / GM",         phone:"9862333333", email:"suchitra@lic.co.in",     dealType:"IPs",                outcome:"Price Concern",               amount:4000000,  targetAmount:6000000,  region:"Central",  priority:"Regular",quarter:"Q1 FY26", lastContact:D7,    nextStep:"Revised rates for insurance IP",         nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D7,   reqs:[], notes:"LIC annual policy campaign. PSU rate constraints." },
  { id:"d55", repId:28, clientCompany:"BPCL",               contactName:"Mahesh Tripathy",designation:"GM Marketing",   contactLevel:"VP / GM",         phone:"9873434343", email:"mahesh@bpcl.co.in",      dealType:"Media Solutions",    outcome:"Very Interested",             amount:7000000,  targetAmount:8000000,  region:"Central",  priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Fuel brand campaign deck",               nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Speed brand + Pure for Sure — Odisha push." },
  { id:"d56", repId:28, clientCompany:"Indian Oil",         contactName:"Pradeep Lenka",  designation:"DGM Corp Comm",  contactLevel:"VP / GM",         phone:"9884535353", email:"pradeep@iocl.co.in",     dealType:"Linear TV",          outcome:"Proposal Accepted",           amount:4200000,  targetAmount:4200000,  region:"Central",  priority:"Top 5",  quarter:"Q1 FY26", lastContact:D1,    nextStep:"PO and airing schedule",                 nextStepDate:TODAY,    awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"IOCL corporate campaign closed for Central region." },
  { id:"d57", repId:29, clientCompany:"NTPC",               contactName:"Kamala Nayak",   designation:"GM PR",          contactLevel:"VP / GM",         phone:"9895636363", email:"kamala@ntpc.co.in",      dealType:"Media Solutions",    outcome:"Interested – Needs Revision", amount:5000000,  targetAmount:7000000,  region:"Central",  priority:"Regular",quarter:"Q2 FY26", lastContact:D3,    nextStep:"Green energy campaign media plan",       nextStepDate:D7,       awaitingApproval:"Sales Strategy", awaitingApprovalSince:D3,   reqs:[{dept:"Sales Strategy",desc:"Green energy campaign for NTPC",status:"Pending",raisedAt:"10:00"}], notes:"Renewable energy push — green brand repositioning." },
  { id:"d58", repId:29, clientCompany:"Power Grid Corp",    contactName:"Umakant Das",    designation:"DGM Marketing",  contactLevel:"VP / GM",         phone:"9806737373", email:"umakant@powergrid.in",   dealType:"Linear TV",          outcome:"Needs Callback",              amount:2500000,  targetAmount:4000000,  region:"Central",  priority:"Regular",quarter:"Q2 FY26", lastContact:D7,    nextStep:"PSU annual campaign RFQ",                nextStepDate:D7,       awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"Tender in progress. Long gestation PSU deal." },
  { id:"d59", repId:30, clientCompany:"Odisha State Coop", contactName:"Biswajit Pattnaik",designation:"CEO",           contactLevel:"C-Suite / Owner", phone:"9817838383", email:"biswajit@oscb.co.in",    dealType:"IPs",                outcome:"Very Interested",             amount:6000000,  targetAmount:7000000,  region:"Central",  priority:"Top 5",  quarter:"Q1 FY26", lastContact:TODAY, nextStep:"Cooperative banking IP sponsorship",     nextStepDate:TOMORROW, awaitingApproval:null,             awaitingApprovalSince:null, reqs:[], notes:"OSCB wants strong rural Odisha brand presence." },
  { id:"d60", repId:30, clientCompany:"IDBI Bank",          contactName:"Saswat Rath",    designation:"DGM Marketing",  contactLevel:"VP / GM",         phone:"9828939393", email:"saswat@idbi.co.in",      dealType:"Linear TV",          outcome:"Price Concern",               amount:3000000,  targetAmount:4500000,  region:"Central",  priority:"Regular",quarter:"Q1 FY26", lastContact:D3,    nextStep:"Revised banking campaign rate card",     nextStepDate:D3,       awaitingApproval:"NSH",            awaitingApprovalSince:D3,   reqs:[], notes:"Bank restructuring campaign. Budget constraints." },
];

const SEED_PROPERTIES = [
  {
    id:"pr1", name:"Odia Idol S3", type:"Reality Show", channel:"OTV",
    quarter:"Q1 FY26", totalValue:12000000,
    slots:[
      {id:"s1",label:"Title Sponsor",value:5000000,status:"In Discussion",clientCompany:"Havells India",repId:5},
      {id:"s2",label:"Co-Sponsor",value:3000000,status:"Available",clientCompany:"",repId:null},
      {id:"s3",label:"Associate 1",value:1000000,status:"Committed",clientCompany:"Berger Paints",repId:2},
      {id:"s4",label:"Associate 2",value:1000000,status:"Available",clientCompany:"",repId:null},
      {id:"s5",label:"Associate 3",value:1000000,status:"Available",clientCompany:"",repId:null},
      {id:"s6",label:"Associate 4",value:1000000,status:"Available",clientCompany:"",repId:null},
    ]
  },
  {
    id:"pr2", name:"Tarang Music Awards", type:"Award Show", channel:"Tarang",
    quarter:"Q1 FY26", totalValue:8000000,
    slots:[
      {id:"s7",label:"Title Sponsor",value:4000000,status:"Available",clientCompany:"",repId:null},
      {id:"s8",label:"Co-Sponsor",value:2000000,status:"In Discussion",clientCompany:"Asian Paints",repId:5},
      {id:"s9",label:"Associate 1",value:1000000,status:"Available",clientCompany:"",repId:null},
      {id:"s10",label:"Associate 2",value:1000000,status:"Available",clientCompany:"",repId:null},
    ]
  },
];


const IP_CATALOG = [
  {
    id:"ip1", name:"Odia Idol Season 3", type:"Music Reality Show", channel:"OTV", quarter:"Q1 FY26", airDates:"Apr – Jun 2026",
    elements:[
      {id:"ie1",  label:"Title Sponsor",                    rackRate:12000000, repId:5,    client:"Havells India",    closedAt:10500000, status:"Committed"},
      {id:"ie2",  label:"Co-Presenter",                     rackRate:7000000,  repId:22,   client:"Asian Paints",     closedAt:null,     status:"In Discussion"},
      {id:"ie3",  label:"Powered By",                       rackRate:5000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie4",  label:"Associate Sponsor – A",            rackRate:3000000,  repId:1,    client:"Daikin India",     closedAt:2800000,  status:"Committed"},
      {id:"ie5",  label:"Associate Sponsor – B",            rackRate:3000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie6",  label:"Product Integration (Top 5 Ep.)",  rackRate:2000000,  repId:7,    client:"Maruti Suzuki",    closedAt:null,     status:"In Discussion"},
      {id:"ie7",  label:"Product Integration (Finale)",     rackRate:2500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie8",  label:"On-Ground Auditions Sponsor",      rackRate:1500000,  repId:2,    client:"Berger Paints",    closedAt:1200000,  status:"Committed"},
      {id:"ie9",  label:"Social Media Package",             rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
  {
    id:"ip2", name:"Tarang Music Awards 2026", type:"Award Show", channel:"Tarang TV", quarter:"Q1 FY26", airDates:"May 2026",
    elements:[
      {id:"ie10", label:"Title Sponsor",                    rackRate:10000000, repId:5,    client:"ITC Limited",      closedAt:null,     status:"In Discussion"},
      {id:"ie11", label:"Co-Presenter",                     rackRate:6000000,  repId:22,   client:"HUL",              closedAt:5500000,  status:"Committed"},
      {id:"ie12", label:"Best Playback Award Sponsor",      rackRate:2000000,  repId:23,   client:"Samsung India",    closedAt:1800000,  status:"Committed"},
      {id:"ie13", label:"Best Debut Award Sponsor",         rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie14", label:"Red Carpet Partner",               rackRate:2500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie15", label:"Digital Streaming Sponsor",        rackRate:2000000,  repId:25,   client:"Airtel",           closedAt:null,     status:"In Discussion"},
      {id:"ie16", label:"Trophy Partner",                   rackRate:2500000,  repId:24,   client:"Titan Company",    closedAt:2000000,  status:"Committed"},
      {id:"ie17", label:"Social Media Package",             rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
  {
    id:"ip3", name:"Odia Film Awards (OFA) 2026", type:"Award Show", channel:"OTV", quarter:"Q2 FY26", airDates:"Jul 2026",
    elements:[
      {id:"ie18", label:"Title Sponsor",                    rackRate:8000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie19", label:"Co-Presenter",                     rackRate:5000000,  repId:14,   client:"Tata Steel",       closedAt:null,     status:"In Discussion"},
      {id:"ie20", label:"Best Film Award Sponsor",          rackRate:2000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie21", label:"Best Director Award Sponsor",      rackRate:1500000,  repId:3,    client:"ITC Limited",      closedAt:1200000,  status:"Committed"},
      {id:"ie22", label:"Best Actor Award Sponsor",         rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie23", label:"Best Actress Award Sponsor",       rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie24", label:"Digital Voting Partner",           rackRate:1000000,  repId:15,   client:"Reliance Jio",     closedAt:null,     status:"In Discussion"},
      {id:"ie25", label:"Red Carpet Partner",               rackRate:1500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
  {
    id:"ip4", name:"Dance Odia Dance Season 4", type:"Dance Reality Show", channel:"OTV", quarter:"Q1 FY26", airDates:"Apr – May 2026",
    elements:[
      {id:"ie26", label:"Title Sponsor",                    rackRate:7000000,  repId:4,    client:"Reliance Retail",  closedAt:6000000,  status:"Committed"},
      {id:"ie27", label:"Co-Presenter",                     rackRate:4000000,  repId:19,   client:"Flipkart",         closedAt:null,     status:"In Discussion"},
      {id:"ie28", label:"Powered By",                       rackRate:2500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie29", label:"Associate Sponsor",                rackRate:2000000,  repId:20,   client:"Paytm",            closedAt:1700000,  status:"Committed"},
      {id:"ie30", label:"Finale Night Sponsor",             rackRate:2500000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie31", label:"Social Media Package",             rackRate:1000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
  {
    id:"ip5", name:"Tarang Cine Awards 2026", type:"Award Show", channel:"Tarang TV", quarter:"Q2 FY26", airDates:"Aug 2026",
    elements:[
      {id:"ie32", label:"Title Sponsor",                    rackRate:8000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie33", label:"Co-Presenter",                     rackRate:5000000,  repId:22,   client:"Samsung India",    closedAt:null,     status:"In Discussion"},
      {id:"ie34", label:"Powered By",                       rackRate:3000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie35", label:"Star Performance Sponsor",         rackRate:2000000,  repId:25,   client:"Marico",           closedAt:1800000,  status:"Committed"},
      {id:"ie36", label:"Digital Voting Partner",           rackRate:1000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie37", label:"Social Media Package",             rackRate:1000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
  {
    id:"ip6", name:"Super Singer Odia Season 2", type:"Kids Singing Reality", channel:"OTV", quarter:"Q1 FY26", airDates:"Apr – Jun 2026",
    elements:[
      {id:"ie38", label:"Title Sponsor",                    rackRate:5000000,  repId:26,   client:"Odisha Tourism",   closedAt:4500000,  status:"Committed"},
      {id:"ie39", label:"Co-Presenter",                     rackRate:3500000,  repId:28,   client:"LIC India",        closedAt:null,     status:"In Discussion"},
      {id:"ie40", label:"Powered By",                       rackRate:2500000,  repId:27,   client:"IDBI Bank",        closedAt:2000000,  status:"Committed"},
      {id:"ie41", label:"Associate Sponsor",                rackRate:2000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
      {id:"ie42", label:"School Auditions Sponsor",         rackRate:1000000,  repId:29,   client:"BPCL",             closedAt:null,     status:"In Discussion"},
      {id:"ie43", label:"Digital Package",                  rackRate:1000000,  repId:null, client:null,               closedAt:null,     status:"Available"},
    ]
  },
];

const SEED_INTERNAL_REQS = [
  { id:"ir1", type:"Approval",     raisedBy:"rep_arjun", raisedByName:"Arjun Mishra", repId:1, dealId:"d7", clientCompany:"Daikin India",   dept:"NSH",            subject:"Discount approval — 12% off rate card",       details:"Client pushing for 12% off. Standard is 8%. Need NSH sign-off to close.",        status:"Pending", raisedAt:D3,    slaHours:48, resolvedAt:null, resolverNote:"" },
  { id:"ir2", type:"Support",      raisedBy:"rep_vikram", raisedByName:"Vikram Sen",   repId:5, dealId:"d1", clientCompany:"Havells India",  dept:"Sales Strategy", subject:"H2 sponsorship deck for Havells",               details:"Need a customised deck with Odia Idol + Tarang Music Awards for Havells CMO.",    status:"In Progress", raisedAt:D3, slaHours:48, resolvedAt:null, resolverNote:"" },
  { id:"ir3", type:"Approval",     raisedBy:"rep_vikram", raisedByName:"Vikram Sen",   repId:5, dealId:"d2", clientCompany:"Asian Paints",   dept:"NSH",            subject:"CXO attendance at CMO meeting",                 details:"Asian Paints CMO wants CEO/NSH in the room to finalise ₹1.2Cr deal.",            status:"Overdue",  raisedAt:D7,    slaHours:48, resolvedAt:null, resolverNote:"" },
  { id:"ir4", type:"Creative",     raisedBy:"rep_priya",  raisedByName:"Priya Dash",   repId:2, dealId:"d4", clientCompany:"Berger Paints",  dept:"Branding Team",  subject:"On-air promo material for Berger Paints",       details:"Need 30-sec on-air promo. Brand guidelines shared on email.",                    status:"Done",     raisedAt:D7,    slaHours:48, resolvedAt:D3,  resolverNote:"Sent to production." },
  { id:"ir5", type:"Escalation",   raisedBy:"rep_rohit",  raisedByName:"Rohit Nanda",  repId:3, dealId:"d9", clientCompany:"ITC Limited",    dept:"NSH",            subject:"ITC deal stalled — NSH intervention needed",    details:"ITC VP wants a direct call with NSH before committing ₹55L integrated plan.",    status:"Pending", raisedAt:D1,    slaHours:48, resolvedAt:null, resolverNote:"" },
];

// Target approval chain: Draft → Pending RH → Pending NSH → Pending Strategy → Pending CRO → Approved
const TARGET_APPROVAL_CHAIN = ["Pending RH","Pending NSH","Pending Strategy","Pending CRO","Approved"];

const SEED_TARGET_SUBMISSIONS = [
  { id:"ts1",  repId:1,  repName:"Arjun Mishra",    region:"North",    quarter:"Q1 FY26",
    clients:[{clientCompany:"Daikin India",dealType:"Linear TV",targetAmount:5000000},{clientCompany:"LG Electronics",dealType:"Digital",targetAmount:2000000}],
    totalTarget:7000000,  status:"Approved",      submittedAt:D7,  approvalLog:[{step:"Pending RH",by:"RH North",at:D7,note:"Looks good"},{step:"Pending NSH",by:"NSH",at:D3,note:"Approved"},{step:"Pending Strategy",by:"Sales Strategy",at:D1,note:"Aligned"},{step:"Pending CRO",by:"CRO",at:TODAY,note:"Approved — go"}] },
  { id:"ts2",  repId:2,  repName:"Priya Dash",      region:"South",    quarter:"Q1 FY26",
    clients:[{clientCompany:"Berger Paints",dealType:"Linear TV",targetAmount:3500000},{clientCompany:"Sundaram Finance",dealType:"Linear TV",targetAmount:4000000}],
    totalTarget:7500000,  status:"Pending NSH",   submittedAt:D3,  approvalLog:[{step:"Pending RH",by:"RH South",at:D3,note:"Approved"}] },
  { id:"ts3",  repId:5,  repName:"Vikram Sen",      region:"National", quarter:"Q1 FY26",
    clients:[{clientCompany:"Havells India",dealType:"IPs",targetAmount:15000000},{clientCompany:"Asian Paints",dealType:"IPs",targetAmount:12000000},{clientCompany:"Tata Consumer",dealType:"Integrated Packages",targetAmount:9000000}],
    totalTarget:36000000, status:"Pending Strategy",submittedAt:D7, approvalLog:[{step:"Pending RH",by:"RH National",at:D7,note:"Okayed"},{step:"Pending NSH",by:"NSH",at:D3,note:"Approved"}] },
  { id:"ts4",  repId:7,  repName:"Rahul Sharma",    region:"North",    quarter:"Q1 FY26",
    clients:[{clientCompany:"Maruti Suzuki",dealType:"Linear TV",targetAmount:9000000},{clientCompany:"Nestle India",dealType:"Integrated Packages",targetAmount:7500000}],
    totalTarget:16500000, status:"Pending RH",     submittedAt:D1,  approvalLog:[] },
  { id:"ts5",  repId:9,  repName:"Manish Tiwari",   region:"North",    quarter:"Q1 FY26",
    clients:[{clientCompany:"LG Electronics",dealType:"Integrated Packages",targetAmount:12000000},{clientCompany:"Samsung India",dealType:"Digital",targetAmount:5500000}],
    totalTarget:17500000, status:"Pending NSH",    submittedAt:D7,  approvalLog:[{step:"Pending RH",by:"RH North",at:D3,note:"Strong pipeline"}] },
  { id:"ts6",  repId:11, repName:"Suresh Reddy",    region:"South",    quarter:"Q1 FY26",
    clients:[{clientCompany:"Dr Reddy's Labs",dealType:"Digital",targetAmount:6000000},{clientCompany:"Cipla Health",dealType:"Linear TV",targetAmount:5000000}],
    totalTarget:11000000, status:"Approved",       submittedAt:D14, approvalLog:[{step:"Pending RH",by:"RH South",at:D14,note:"Approved"},{step:"Pending NSH",by:"NSH",at:D7,note:"Good"},{step:"Pending Strategy",by:"Sales Strategy",at:D3,note:"Aligned"},{step:"Pending CRO",by:"CRO",at:D1,note:"Approved"}] },
  { id:"ts7",  repId:13, repName:"Karthik Iyer",    region:"South",    quarter:"Q1 FY26",
    clients:[{clientCompany:"Britannia Industries",dealType:"Integrated Packages",targetAmount:10500000},{clientCompany:"Parle Products",dealType:"Linear TV",targetAmount:7000000}],
    totalTarget:17500000, status:"Pending Strategy",submittedAt:D7, approvalLog:[{step:"Pending RH",by:"RH South",at:D7,note:"Excellent pipeline"},{step:"Pending NSH",by:"NSH",at:D3,note:"Approved"}] },
  { id:"ts8",  repId:14, repName:"Sanjay Mohanty",  region:"East",     quarter:"Q1 FY26",
    clients:[{clientCompany:"Tata Steel",dealType:"Media Solutions",targetAmount:8000000},{clientCompany:"Adani Wilmar",dealType:"IPs",targetAmount:6000000}],
    totalTarget:14000000, status:"Pending RH",     submittedAt:D1,  approvalLog:[] },
  { id:"ts9",  repId:17, repName:"Rina Panda",       region:"East",     quarter:"Q1 FY26",
    clients:[{clientCompany:"Patanjali Ayurved",dealType:"IPs",targetAmount:7500000},{clientCompany:"Reliance Retail",dealType:"Digital",targetAmount:6500000}],
    totalTarget:14000000, status:"Pending NSH",    submittedAt:D3,  approvalLog:[{step:"Pending RH",by:"RH East",at:D3,note:"Solid plan"}] },
  { id:"ts10", repId:19, repName:"Divya Joshi",      region:"West",     quarter:"Q1 FY26",
    clients:[{clientCompany:"Airtel India",dealType:"Integrated Packages",targetAmount:14000000},{clientCompany:"Tata Communications",dealType:"Media Solutions",targetAmount:7000000}],
    totalTarget:21000000, status:"Approved",       submittedAt:D14, approvalLog:[{step:"Pending RH",by:"RH West",at:D14,note:"Approved"},{step:"Pending NSH",by:"NSH",at:D7,note:"Approved"},{step:"Pending Strategy",by:"Sales Strategy",at:D3,note:"Aligned"},{step:"Pending CRO",by:"CRO",at:D1,note:"Go"}] },
  { id:"ts11", repId:21, repName:"Preethi Shah",     region:"West",     quarter:"Q1 FY26",
    clients:[{clientCompany:"Flipkart",dealType:"Integrated Packages",targetAmount:13000000},{clientCompany:"Amazon India",dealType:"Linear TV",targetAmount:8000000}],
    totalTarget:21000000, status:"Pending Strategy",submittedAt:D7, approvalLog:[{step:"Pending RH",by:"RH West",at:D7,note:"Strong"},{step:"Pending NSH",by:"NSH",at:D3,note:"Approved"}] },
  { id:"ts12", repId:22, repName:"Neha Kapoor",      region:"National", quarter:"Q1 FY26",
    clients:[{clientCompany:"HUL",dealType:"Integrated Packages",targetAmount:28000000},{clientCompany:"Procter & Gamble",dealType:"IPs",targetAmount:22000000}],
    totalTarget:50000000, status:"Pending CRO",    submittedAt:D7,  approvalLog:[{step:"Pending RH",by:"RH National",at:D7,note:"Approved"},{step:"Pending NSH",by:"NSH",at:D3,note:"Approved"},{step:"Pending Strategy",by:"Sales Strategy",at:D1,note:"Aligned"}] },
  { id:"ts13", repId:25, repName:"Aditya Kumar",     region:"National", quarter:"Q1 FY26",
    clients:[{clientCompany:"Coca-Cola India",dealType:"Integrated Packages",targetAmount:20000000},{clientCompany:"Red Bull India",dealType:"Media Solutions",targetAmount:8000000}],
    totalTarget:28000000, status:"Pending NSH",    submittedAt:D3,  approvalLog:[{step:"Pending RH",by:"RH National",at:D3,note:"Good pipeline"}] },
  { id:"ts14", repId:26, repName:"Sameer Nayak",     region:"Central",  quarter:"Q1 FY26",
    clients:[{clientCompany:"ONGC",dealType:"Media Solutions",targetAmount:10000000},{clientCompany:"Coal India",dealType:"Linear TV",targetAmount:5000000}],
    totalTarget:15000000, status:"Pending RH",     submittedAt:D1,  approvalLog:[] },
  { id:"ts15", repId:28, repName:"Pratap Rath",       region:"Central",  quarter:"Q1 FY26",
    clients:[{clientCompany:"BPCL",dealType:"Media Solutions",targetAmount:8000000},{clientCompany:"Indian Oil",dealType:"Linear TV",targetAmount:4200000}],
    totalTarget:12200000, status:"Approved",       submittedAt:D14, approvalLog:[{step:"Pending RH",by:"RH Central",at:D14,note:"Approved"},{step:"Pending NSH",by:"NSH",at:D7,note:"Approved"},{step:"Pending Strategy",by:"Sales Strategy",at:D3,note:"OK"},{step:"Pending CRO",by:"CRO",at:D1,note:"Approved"}] },
  { id:"ts16", repId:30, repName:"Debadatta Patra",   region:"Central",  quarter:"Q1 FY26",
    clients:[{clientCompany:"Odisha State Coop",dealType:"IPs",targetAmount:7000000},{clientCompany:"IDBI Bank",dealType:"Linear TV",targetAmount:4500000}],
    totalTarget:11500000, status:"Pending NSH",    submittedAt:D3,  approvalLog:[{step:"Pending RH",by:"RH Central",at:D3,note:"Good potential"}] },
];

const SEED_REVENUE_ENTRIES = [
  { id:"re1", repId:2, clientCompany:"Berger Paints",  dealType:"Linear TV", amount:2200000, invoiceRef:"INV-2024-001", date:D3, quarter:"Q1 FY26", notes:"6-week primetime deal PO received" },
  { id:"re2", repId:5, clientCompany:"Havells India",  dealType:"IPs", amount:5000000, invoiceRef:"INV-2024-002", date:D1, quarter:"Q1 FY26", notes:"First instalment — sponsorship confirmed" },
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
const C = { bg:"#f0f4f9", surface:"#ffffff", s2:"#e8eef7", s3:"#dde5f0", border:"#c8d3e5", accent:"#c47d00", green:"#15803d", red:"#c92828", blue:"#1d5db4", purple:"#7920e8", orange:"#c24000", text:"#18243a", dim:"#4d5e78", muted:"#8a97ae" };

const fmt = (n) => { if (!n || n===0) return "—"; if (n>=10000000) return `${(n/10000000).toFixed(1)}Cr`; if (n>=100000) return `${(n/100000).toFixed(1)}L`; return `${(n/1000).toFixed(0)}K`; };
const fmtR = (n) => n ? `\u20B9${fmt(n)}` : "—";
const daysSince = (d) => { if (!d) return 999; return Math.floor((Date.now()-new Date(d).getTime())/86400000); };
const riskColor = (d) => { if (d.outcome==="Not Interested") return C.muted; if (d.outcome==="Proposal Accepted") return C.green; const x=daysSince(d.lastContact); return x>=7?C.red:x>=3?C.orange:C.green; };
const riskLabel = (d) => { if (d.outcome==="Not Interested") return "Lost"; if (d.outcome==="Proposal Accepted") return "Won"; if (d.atRisk) return "At Risk"; const x=daysSince(d.lastContact); return x>=7?"At Risk":x>=3?"Cooling":"Active"; };
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
      onLogin({ name: payload.name || payload.email, email: payload.email, picture: payload.picture, provider:"google" });
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
    const redirectUri = window.location.origin + window.location.pathname.replace(/\/$/g, "");
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
            onLogin({ name: displayName, email: profile.email, picture: profile.picture, provider:"zoho" });
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


  const DEMO_ACCOUNTS = [
    { label:"Darpan (CRO)",        email:"darpan@odishatv.com",     role:"CRO",            color:"#065f46" },
    { label:"Sales Head (NSH)",    email:"saleshead@odishatv.com",  role:"SALES HEAD",     color:"#0891b2" },
    { label:"Sachin (Strategy)",   email:"sachin@odishatv.com",     role:"SALES STRATEGY", color:"#7c2d12" },
    { label:"Digi Ops",            email:"digiops@odishatv.com",    role:"DIGI OPS",       color:"#1e40af" },
    { label:"RH – National",       email:"rhn@odishatv.com",        role:"REGION HEAD",    color:"#7c3aed" },
    { label:"RH – North",          email:"rhnorth@odishatv.com",    role:"REGION HEAD",    color:"#7c3aed" },
    { label:"Arjun (Sales Rep)",   email:"arjun@odishatv.com",      role:"SALES REP",      color:"#2563eb" },
    { label:"Vikram (Sales Rep)",  email:"vikram@odishatv.com",     role:"SALES REP",      color:"#2563eb" },
  ];

  const handleEmail = async (e) => {
    e.preventDefault(); setErr("");
    if (!email.trim()) { setErr("Email is required"); return; }
    if (!password.trim()) { setErr("Password is required"); return; }
    if (isNew && !name.trim()) { setErr("Name is required"); return; }
    setLoading(true);
    try {
      const stored = JSON.parse(localStorage.getItem("otv_crm_users") || "[]");
      const existing = stored.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        const h = await hashPwd(password);
        if (existing.passwordHash !== h && existing.password !== password) {
          setErr("Incorrect password"); setLoading(false); return;
        }
        onLogin({ name: existing.name, email: existing.email });
      } else {
        if (!isNew) { setErr("No account found — click 'Create account'."); setLoading(false); return; }
        const newUser = { name: name.trim(), email: email.toLowerCase(), passwordHash: await hashPwd(password) };
        localStorage.setItem("otv_crm_users", JSON.stringify([...stored, newUser]));
        onLogin({ name: newUser.name, email: newUser.email });
      }
    } catch(err) {
      setErr("Login error — try again."); setLoading(false);
    }
  };

  const handleDemo = (account) => {
    setLoading(true);
    setTimeout(() => {
      onLogin({ name: account.label, email: account.email });
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#f0f4f9", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .login-input{background:#ffffff;border:1px solid #c8d3e5;border-radius:6px;padding:10px 14px;color:#18243a;font-size:13px;font-family:'DM Mono',monospace;outline:none;width:100%;transition:border-color .15s}
        .login-input:focus{border-color:#7920e8}
        .login-input::placeholder{color:#8a97ae}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* LOGO */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:10, padding:"8px 14px", fontSize:15, fontWeight:700, color:"#fff", letterSpacing:2 }}>OTV</div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:700, color:"#18243a", letterSpacing:1 }}>OTV CRM</div>
              <div style={{ fontSize:10, color:"#4d5e78", letterSpacing:2, textTransform:"uppercase" }}>Sales Intelligence Platform</div>
            </div>
          </div>
        </div>

        <div style={{ background:"#ffffff", border:"1px solid #c8d3e5", borderRadius:12, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.08)" }}>

          {/* HEADER */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #c8d3e5" }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#18243a", marginBottom:3 }}>
              {mode==="email" ? (isNew ? "Create account" : "Sign in") : "Sign in"}
            </div>
            <div style={{ fontSize:11, color:"#4d5e78" }}>Odisha Television Network · Internal use only</div>
          </div>

          <div style={{ padding:24 }}>
            {mode==="options" && (
              <>
                {/* Google */}
                <button
                  onClick={handleGoogleClick}
                  disabled={loading}
                  style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", color:"#3c4043", border:"1px solid #dadce0", borderRadius:6, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", marginBottom:10, transition:"box-shadow .15s" }}
                  onMouseOver={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,.3)"}
                  onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
                  Continue with Google
                </button>

                {/* Zoho */}
                <button
                  onClick={handleZohoClick}
                  disabled={loading}
                  style={{ display:"flex", alignItems:"center", gap:10, background:"#e42527", color:"#fff", border:"none", borderRadius:6, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", marginBottom:16, transition:"opacity .15s" }}
                  onMouseOver={e=>e.currentTarget.style.opacity=".88"}
                  onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                  <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="4" fill="#e42527"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">Z</text></svg>
                  Continue with Zoho
                </button>

                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:"#c8d3e5" }} />
                  <span style={{ fontSize:11, color:"#4d5e78" }}>or</span>
                  <div style={{ flex:1, height:1, background:"#c8d3e5" }} />
                </div>

                {/* Email */}
                <button onClick={() => setMode("email")} style={{ width:"100%", background:"transparent", border:"1px solid #c8d3e5", borderRadius:6, padding:"10px 16px", color:"#18243a", fontSize:13, cursor:"pointer", fontFamily:"'DM Mono',monospace", transition:"border-color .15s", marginBottom:10 }}
                  onMouseOver={e=>e.currentTarget.style.borderColor="#7920e8"}
                  onMouseOut={e=>e.currentTarget.style.borderColor="#c8d3e5"}>
                  Continue with Email →
                </button>

                {/* Demo access */}
                <div style={{ marginTop:20, borderTop:"1px solid #c8d3e5", paddingTop:16 }}>
                  <div style={{ fontSize:10, color:"#4d5e78", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", marginBottom:10, textAlign:"center" }}>Demo Access</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {[
                      { label:"Sales Rep",           email:"arjun@odishatv.com",      color:"#1d5db4" },
                      { label:"Region Head",          email:"rhnorth@odishatv.com",     color:"#7920e8" },
                      { label:"National Sales Head",  email:"saleshead@odishatv.com",   color:"#0369a1" },
                      { label:"Digi Ops",             email:"digiops@odishatv.com",     color:"#1e40af" },
                      { label:"Sales Strategy",       email:"sachin@odishatv.com",      color:"#15803d" },
                      { label:"CRO",                  email:"darpan@odishatv.com",      color:"#c47d00" },
                    ].map(a => (
                      <button key={a.email}
                        onClick={() => onLogin({ name:a.label, email:a.email })}
                        style={{ background:"#f0f4f9", border:`1px solid ${a.color}44`, borderRadius:6, padding:"8px 10px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                        onMouseOver={e=>{ e.currentTarget.style.borderColor=a.color; e.currentTarget.style.background="#e8eef7"; }}
                        onMouseOut={e=>{ e.currentTarget.style.borderColor=`${a.color}44`; e.currentTarget.style.background="#f0f4f9"; }}>
                        <div style={{ fontSize:11, fontWeight:700, color:a.color, fontFamily:"'DM Sans',sans-serif", marginBottom:1 }}>{a.label}</div>
                        <div style={{ fontSize:9, color:"#8a97ae", letterSpacing:".04em" }}>demo</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin quick-login — bottom, subtle */}
                <button
                  onClick={() => onLogin({ name:"Admin", email:"admin@odishatv.com", role:"admin" })}
                  style={{ width:"100%", marginTop:10, background:"transparent", border:"1px solid #c8d3e544", borderRadius:6, padding:"8px 16px", color:"#8a97ae", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:".04em" }}>
                  ⚙ Admin access
                </button>

                {err && <div style={{ marginTop:12, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}
              </>
            )}

            {mode==="email" && (
              <form onSubmit={handleEmail}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {isNew && (
                    <div>
                      <label style={{ fontSize:10, color:"#4d5e78", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Full Name</label>
                      <input className="login-input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} autoFocus />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize:10, color:"#4d5e78", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Email</label>
                    <input className="login-input" type="email" placeholder="you@odishatv.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus={!isNew} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"#4d5e78", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Password</label>
                    <input className="login-input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
                  </div>

                  {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}

                  <button type="submit" style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:6, padding:"11px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>
                    {isNew ? "Create Account" : "Sign In"}
                  </button>

                  <div style={{ textAlign:"center", fontSize:12, color:"#4d5e78" }}>
                    {isNew
                      ? <span>Already have an account? <button type="button" onClick={()=>{setIsNew(false);setErr("");}} style={{ color:"#7920e8", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Sign in</button></span>
                      : <span>No account? <button type="button" onClick={()=>{setIsNew(true);setErr("");}} style={{ color:"#7920e8", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Create one</button></span>
                    }
                  </div>

                  <button type="button" onClick={()=>{setMode("options");setErr("");}} style={{ background:"transparent", border:"none", color:"#4d5e78", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>← Back</button>
                </div>
              </form>
            )}

            {err && mode==="options" && <div style={{ marginTop:12, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:10, color:"#8a97ae" }}>
          OTV CRM · Internal platform · Odisha Television Network
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
// ── Shared server-synced state ─────────────────────────────────────────────
// Reads/writes to the server DB so all users share the same data.
// Falls back to localStorage when offline.
function usePersistedState(key, initial) {
  // 1. Initialize instantly from localStorage (no flash)
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch { return initial; }
  });

  // Track when we last wrote, to avoid polling overwriting in-progress edits
  const lastWriteRef   = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // 2. On every state change: mirror to localStorage immediately,
  //    then debounce-write to server after 1s
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(async () => {
      try {
        lastWriteRef.current = Date.now();
        await fetch(`/api/state/${key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: state }),
        });
      } catch { /* offline — localStorage still has it */ }
    }, 1000);
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, [key, state]);

  // 3. On mount: load from server (may override localStorage with newer shared data).
  //    If server has nothing, migrate localStorage/seed to server.
  // 4. Poll every 20s — only accept server value if it's newer than our last local write
  useEffect(() => {
    const load = async (isPoll = false) => {
      try {
        const res = await fetch(`/api/state/${key}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && data.value !== null) {
          // On poll: skip if we wrote more recently (within 5s grace)
          if (isPoll) {
            const serverTs = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
            if (lastWriteRef.current > serverTs - 5000) return;
          }
          setState(data.value);
          try { localStorage.setItem(key, JSON.stringify(data.value)); } catch {}
        } else if (!isPoll) {
          // Server has no data yet — push local/seed data so other users see it
          const localVal = state;
          fetch(`/api/state/${key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: localVal }),
          }).catch(() => {});
        }
      } catch { /* offline */ }
    };

    load(false); // initial load
    const interval = setInterval(() => load(true), 20000); // poll every 20s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 5. Also sync across same-browser tabs (original behaviour)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === key && e.newValue !== null) {
        try { setState(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [state, setState];
}

export default function OTVApp() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [loginUser, setLoginUser]     = useState(null);
  const [section, setSection]         = useState("home"); // "home" | "ro" | "crm"
  const [plans, setPlans]             = usePersistedState("otv_plans",    SEED_PLANS);
  const [weeklyPlans, setWeeklyPlans] = usePersistedState("otv_wplans",   SEED_WEEKLY_PLANS);
  const [meetings, setMeetings]       = usePersistedState("otv_meetings", SEED_MEETINGS);
  const [deals, setDeals]             = usePersistedState("otv_deals",    SEED_DEALS);

  const handleLogin  = (user) => { setLoginUser(user); setLoggedIn(true); setSection(user?.role === "admin" ? "crm" : "home"); if (user?.provider) setLoginProvider(user.provider); };
  const handleLogout = ()     => { setLoggedIn(false); setLoginUser(null); setSection("home"); };
  const handleSelect = (s)    => setSection(s);
  const handleBack   = ()     => setSection("home");

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
  if (section === "home") return <HomeScreen user={loginUser} onSelect={handleSelect} onLogout={handleLogout} />;

  return <CROApp
    user={loginUser} onLogout={handleLogout}
    section={section} onGoHome={handleBack}
    plans={plans} setPlans={setPlans}
    weeklyPlans={weeklyPlans} setWeeklyPlans={setWeeklyPlans}
    sharedMeetings={meetings} setSharedMeetings={setMeetings}
    sharedDeals={deals} setSharedDeals={setDeals}
  />;
}

function HomeScreen({ user, onSelect, onLogout }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || "").split(" ")[0];

  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#f0f4f9", minHeight:"100vh", display:"flex", flexDirection:"column", color:"#18243a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .home-tile{background:#ffffff;border:1px solid #c8d3e5;border-radius:14px;padding:40px 36px;cursor:pointer;transition:border-color .2s,background .2s,transform .15s,box-shadow .2s;display:flex;flex-direction:column;align-items:flex-start;gap:14px;text-align:left;box-shadow:0 2px 12px rgba(0,0,0,.06)}
        .home-tile:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,.12)}
        .home-tile-ro:hover{border-color:#7920e8;background:#faf6ff}
        .home-tile-crm:hover{border-color:#c47d00;background:#fffbf0}
      `}</style>

      {/* TOPBAR */}
      <div style={{ background:"#ffffff", borderBottom:"1px solid #c8d3e5", padding:"0 32px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:7, padding:"5px 10px", fontSize:13, fontWeight:700, letterSpacing:2, color:"#fff" }}>OTV</div>
          <span style={{ color:"#c8d3e5" }}>|</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:"#4d5e78", letterSpacing:2, textTransform:"uppercase" }}>Platform</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"#7920e820", border:"1px solid #7920e850", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#7920e8" }}>
            {(user.name||"?")[0].toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:"#4d5e78" }}>{user.name}</span>
          <button onClick={onLogout} style={{ background:"transparent", border:"1px solid #c8d3e5", borderRadius:4, padding:"3px 10px", color:"#4d5e78", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#c92828";e.currentTarget.style.color="#c92828";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#c8d3e5";e.currentTarget.style.color="#4d5e78";}}>
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>

        {/* GREETING */}
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:28, fontWeight:800, marginBottom:6, letterSpacing:-.5, color:"#18243a" }}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{ fontSize:13, color:"#4d5e78" }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })} · Odisha Television Network
          </div>
        </div>

        {/* TWO TILES */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, width:"100%", maxWidth:720 }}>

          {/* RO MANAGEMENT TILE */}
          <div className="home-tile home-tile-ro" onClick={() => onSelect("ro")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#7920e818", border:"1px solid #7920e840", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              📋
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#18243a", marginBottom:6, letterSpacing:-.3 }}>RO Management</div>
              <div style={{ fontSize:12, color:"#4d5e78", lineHeight:1.6 }}>Parse Release Orders from any agency format. Export Zoho-ready Deal + Breakup sheets. View and manage all saved ROs.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["PDF","Excel","Images","CSV"].map(f => (
                <span key={f} style={{ background:"#7920e815", color:"#7920e8", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
              {["WPP","Madison","Zenith","ENES"].map(f => (
                <span key={f} style={{ background:"#e8eef7", color:"#4d5e78", padding:"2px 8px", borderRadius:10, fontSize:10 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#7920e8", fontSize:12, fontWeight:600 }}>
              Open RO Module <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>

          {/* CRM TILE */}
          <div className="home-tile home-tile-crm" onClick={() => onSelect("crm")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#c47d0018", border:"1px solid #c47d0040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              ⬡
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#18243a", marginBottom:6, letterSpacing:-.3 }}>OTV CRM</div>
              <div style={{ fontSize:12, color:"#4d5e78", lineHeight:1.6 }}>Pipeline, targets, team scorecards, meeting logs, escalations, HR compliance and absence reports.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["War Room","Pipeline","Targets","Team","HR Reports"].map(f => (
                <span key={f} style={{ background:"#c47d0015", color:"#c47d00", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#c47d00", fontSize:12, fontWeight:600 }}>
              Open CRM <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <div style={{ marginTop:40, fontSize:11, color:"#8a97ae", textAlign:"center" }}>
          Odisha Television Network · Internal platform · Not for external distribution
        </div>
      </div>
    </div>
  );
}

// ─── VIRTUAL TOUR DATA ───────────────────────────────────────────────────────
const TOUR_DATA = {
  rep: {
    welcome:{ title:"Welcome to OTV CRM", subtitle:"Your personal sales command centre", bullets:["📅 Plan & log client meetings from My Plan","💼 Track every deal in the Revenue Tracker","✅ Manage action items in Tasks","📤 Submit proposals via Internal Requests"] },
    steps:[
      {title:"My Plan — Your Daily Home", desc:"Start every morning here. Today's planned meetings appear in the left panel with time, client name, agenda, and any deal blockers.", nav:"my-plan"},
      {title:"Planning a Meeting", desc:"Click '+ Add' next to TODAY or TOMORROW to schedule a client meeting. Set the client name, time, agenda, pitch type, and meeting type (physical / online / call).", nav:"my-plan"},
      {title:"Logging a Meeting", desc:"After the meeting, tap its entry to expand the log form. Fill in what happened, client feedback, and outcome. This instantly updates your War Room status so your RH can see you've been active.", nav:"my-plan"},
      {title:"Follow-up & Next Meeting Dates", desc:"Inside the log form, set a Follow-up Date (📞) and/or Next Meeting Date (📅). These auto-create entries in your calendar so nothing slips through the cracks.", nav:"my-plan"},
      {title:"Calendar View", desc:"Switch to the Calendar tab on My Plan for a weekly view. Each cell shows chips with time, type label, client name, and agenda — so you can spot a busy day vs a free one instantly. Click any future cell to plan a meeting.", nav:"my-plan", tip:"Chips are colour-coded: blue = follow-up call, green = scheduled meeting, orange = action item."},
      {title:"Revenue Tracker (Pipeline)", desc:"Track every deal — client, deal type (FCT / IPs / Digital / Integrated / Media Solutions), amount, quarter, and outcome. Update this after every meeting so your RH has an accurate picture.", nav:"pipeline"},
      {title:"Adding & Updating Deals", desc:"Click '+ Add Deal' to create a new pipeline entry. Fill in client, deal type, quarter, and target amount. As the deal progresses, update the outcome (Very Interested → Proposal Accepted → Committed).", nav:"pipeline", tip:"Deal types: FCT = air-time, IPs = integrated properties, Media Solutions = branded content. Ask your RH if unsure."},
      {title:"My Targets", desc:"View your quarterly revenue target and current progress. When your RH asks you to submit targets, use the '+ Submit Target' form here and it flows to them for approval.", nav:"target-submit"},
      {title:"Tasks", desc:"Action items assigned to you or self-created. Use '+ Create Task' to track anything — calls to make, proposals to send, approvals to chase. Set due dates so nothing is forgotten.", nav:"tasks"},
      {title:"Internal Requests", desc:"Need a custom rate card, a creative brief, or pricing approval from NSH? Raise an Internal Request here, tag the right department, and track its status end-to-end.", nav:"internal-requests"},
      {title:"War Room", desc:"Your personal alert centre. Clients with no contact in 14+ days show as at-risk, and overdue follow-ups surface here. Check this when you're between meetings.", nav:"warroom"},
      {title:"HR Reports", desc:"Your attendance and exception log. If you're visiting a client off-site or working from a different location, mark it here before 11:30 PM each day.", nav:"hr"},
      {title:"You're all set! 🎉", desc:"Daily rhythm: Morning → My Plan → Log meetings as you go → Update pipeline after each call → End of day → Check calendar for tomorrow. Tap '?' in the top bar anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  rh: {
    welcome:{ title:"Welcome, Region Head!", subtitle:"Your regional sales command centre", bullets:["⬡ War Room — live team activity & at-risk alerts","📋 Team's Plan — all rep meetings at a glance","✓ Approve targets, assign tasks, escalate deals","◇ Leaderboard — track rep performance weekly"] },
    steps:[
      {title:"My Plan", desc:"Plan and log your own client meetings here — just like a Sales Rep. NSH can see your activity in real time, so keep this updated.", nav:"my-plan"},
      {title:"Team's Plan", desc:"See every rep's planned and logged meetings for today and tomorrow at a glance. Perfect for your morning team stand-up — you can see instantly who is active and who has nothing planned.", nav:"rh-team-plan"},
      {title:"War Room — Your Command View", desc:"The most important screen for you. See which reps are active today, which clients haven't been contacted in 14+ days (at-risk), and who has overdue follow-ups. Red alerts need immediate action from you or the rep.", nav:"warroom"},
      {title:"Revenue Tracker", desc:"Full pipeline for your region — all reps, all deals, all stages. Filter by rep or deal type. You can update outcomes here if a rep hasn't logged the result of a meeting yet.", nav:"pipeline"},
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
      {title:"Revenue Tracker", desc:"Full national pipeline. Filter by region, rep, deal type, outcome, or quarter. The Committed and Proposal Accepted rows show your month's likely closures.", nav:"pipeline"},
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
      {title:"Revenue Tracker", desc:"Full national pipeline — sort by amount, region, outcome, or quarter. The Committed and Proposal Accepted columns show your month's likely closures.", nav:"pipeline"},
      {title:"Targets", desc:"National revenue targets and quarterly progress. Drill into any region or quarter to see where actuals are tracking against plan.", nav:"targets"},
      {title:"Target Approvals", desc:"Final-level approval queue for CRO sign-off. Review and approve or reject strategic targets submitted by NSH or Region Heads.", nav:"target-approvals"},
      {title:"All Region Heads", desc:"Scorecard view for each Region Head — pipeline value, target achievement, and team engagement. Your weekly performance review input.", nav:"nsh-rh-scorecard"},
      {title:"All Sales Reps", desc:"Individual rep analytics — deals pipeline, meeting count, target achievement, and task completion. Useful for performance conversations with NSH.", nav:"nsh-rep-scorecard"},
      {title:"You're all set! 🎉", desc:"Your rhythm: Morning → War Room (30 seconds). Weekly → Revenue Tracker + All Region Heads. Monthly → Targets review. Tap '?' anytime to replay this tour.", nav:"my-plan"},
    ]
  },
  admin: {
    welcome:{ title:"Welcome, Admin!", subtitle:"System access and configuration", bullets:["◎ Access Management — approve sign-ups & assign roles","✦ Approval Queue — review pending system requests","⬆ Import Data — bulk upload deals or meeting data","⚙ System Config — manage system-wide settings"] },
    steps:[
      {title:"Access Management", desc:"New user sign-up requests land here. Review each one, approve or reject, and assign the correct role (Sales Rep, Region Head, NSH, etc.) and region before they can log in.", nav:"admin-access"},
      {title:"Approval Queue", desc:"Internal requests that need admin-level review — escalations, role override requests, or items that fall outside normal department routing.", nav:"admin-approvals"},
      {title:"Import Data", desc:"Bulk upload deals or meeting data from a CSV or spreadsheet. Useful for onboarding new reps or migrating historical data into the system.", nav:"import"},
      {title:"You're all set! 🎉", desc:"Your focus: keep Access Management clear (no pending sign-ups unreviewed) and Approval Queue actioned promptly. Tap '?' anytime to replay this tour.", nav:"admin-access"},
    ]
  },
};

function CROApp({ user, onLogout, section, onGoHome, plans, setPlans, weeklyPlans, setWeeklyPlans, sharedMeetings, setSharedMeetings, sharedDeals, setSharedDeals }) {
  const [view, setView] = useState(section === "ro" ? "ro-parser" : (user?.email==="admin@odishatv.com" ? "admin-access" : "my-plan"));
  // Persist deals + meetings directly — no more sync bug
  const [deals, _setDeals]        = usePersistedState("otv_deals",    sharedDeals   || SEED_DEALS);
  const [meetings, _setMeetings]  = usePersistedState("otv_meetings", sharedMeetings|| SEED_MEETINGS);
  const [plans_crm]               = [plans || SEED_PLANS];
  const [att, setAtt]             = usePersistedState("otv_att",      SEED_ATT);

  // Wrap setters — propagate to parent (handles both value and functional updates)
  const setDeals = v => {
    _setDeals(v);
    if (setSharedDeals) {
      // if v is a function, resolve it against current deals before syncing
      setSharedDeals(typeof v === "function" ? prev => v(prev) : v);
    }
  };
  const setMeetings = v => {
    _setMeetings(v);
    if (setSharedMeetings) {
      setSharedMeetings(typeof v === "function" ? prev => v(prev) : v);
    }
  };

  // Countdown to 11:30 PM — shown in topbar for all users
  const [countdown, setCountdown] = useState("");
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
      "rhn@odishatv.com":        "rh_national",
      "rhnorth@odishatv.com":    "rh_north",
      "rhsouth@odishatv.com":    "rh_south",
      "rheast@odishatv.com":     "rh_east",
      "rhwest@odishatv.com":     "rh_west",
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
  const [tasks, setTasks]         = usePersistedState("otv_tasks", SEED_TASKS);
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
  const [planForm, setPlanForm]           = useState({clientAgencyName:"",contactName:"",phone:"",time:"10:00",agenda:"",pitchType:"",meetingType:"Physical",needsMeet:false,syncToCalendar:false,calPlatform:"google"});
  const [loginProvider, setLoginProvider] = useState<"google"|"zoho"|"demo">("demo");
  const planInlineState                   = useState(null); // [inlineLogPlan, setInlineLogPlan]
  const [rhRepDrill, setRhRepDrill]       = useState(null); // Region Head targets drilldown
  const [nshRHDrill,  setNshRHDrill]      = useState(null); // NSH drills into specific RH region
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
  // Auto-show welcome modal on first login per user
  useEffect(() => {
    const key = `otv_welcome_${activeUser}`;
    if (!localStorage.getItem(key)) {
      const tid = setTimeout(() => setShowWelcomeModal(true), 700);
      return () => clearTimeout(tid);
    }
  }, [activeUser]);
  // Auto-navigate when tour step changes
  useEffect(() => {
    if (!tourActive) return;
    const step = (TOUR_DATA[tourKey]?.steps || [])[tourStep];
    if (step?.nav) setView(step.nav);
  }, [tourStep, tourActive, tourKey]);
  const [rtTab, setRtTab] = useState("accounts"); // Revenue Tracker tab

  const BLANK_DEAL = { clientCompany:"", repId:"", contactName:"", designation:"", contactLevel:"", phone:"", email:"", dealType:"", outcome:"Needs Callback", amount:"", targetAmount:"", priority:"Regular", quarter:"Q1 FY26", notes:"", nextStep:"", nextStepDate:"", reqs:[], auditLog:[] };
  const BLANK_NEXT_STEP_ITEM = {action:"", neededFrom:"", remarks:"", dueDate:""};
  const BLANK_LOG = {
    repId:"",
    meetingTime:"", clientOrAgency:"Client",
    dealId:"", clientAgencyName:"",
    contactName:"", designation:"", mobile:"",
    meetingType:"Physical Meeting",
    pitchType:"", discussion:"", clientFeedback:"",
    nextSteps:"", followUpDate:"", status:"",
    nextStepItems:[{...BLANK_NEXT_STEP_ITEM}],
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
  const [adminConfig, setAdminConfig]         = usePersistedState("otv_adminConfig", {
    approvalThresholds: { RH: 5000000, NSH: 10000000, CXO: 30000000 },
    slaHours:           { RH: 24, NSH: 48, CXO: 72, default: 48 },
    inactivityDaysRisk: 7,
    inactivityDaysEscalate: 14,
    webhookUrl: "",
  });

  // ── DEAL INACTIVITY ENFORCEMENT — runs on load and when adminConfig changes ──
  useEffect(() => {
    const escalateDays = adminConfig?.inactivityDaysEscalate || 14;
    const riskDays     = adminConfig?.inactivityDaysRisk     || 7;
    setDeals(prev => prev.map(d => {
      if (d.outcome === "Proposal Accepted" || d.outcome === "Not Interested") return d;
      const idle = daysSince(d.lastContact);
      // 7+ days idle → mark at risk (if not already)
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
            note: `No contact for ${idle} days — auto-escalated (threshold: ${escalateDays}d)`,
          }],
        };
      }
      // Clear atRisk if contact was made recently
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
  const [internalReqs, setInternalReqs]               = usePersistedState("otv_internalReqs", SEED_INTERNAL_REQS);
  const [irStatusFilter, setIrStatusFilter]            = useState("all");
  const [lbTab, setLbTab]                              = useState("team");
  const [targetSubs, setTargetSubs]                    = usePersistedState("otv_targetSubs", SEED_TARGET_SUBMISSIONS);
  const [revenueEntries, setRevenueEntries]             = usePersistedState("otv_revenueEntries", SEED_REVENUE_ENTRIES);
  const [targetSubTab, setTargetSubTab]                 = useState("mine");
  const [revTab, setRevTab]                             = useState("log");
  const BLANK_IR_FORM = {type:"Send Proposal",dept:"NSH",subject:"",details:"",clientCompany:""};
  const [irFormOpen, setIrFormOpen]                     = useState(false);
  const [irForm, setIrForm]                             = useState(BLANK_IR_FORM);
  const [editIrId, setEditIrId]                         = useState<string|null>(null);
  const [pendingUsers, setPendingUsers]                 = usePersistedState("otv_pendingUsers", [
    {id:"pu1", name:"Ravi Kumar",  email:"ravi@odishatv.com",  requestedAt: "2026-03-20"},
    {id:"pu2", name:"Sonal Mehta", email:"sonal@odishatv.com", requestedAt: "2026-03-23"},
    {id:"pu3", name:"Deepak Panda",email:"deepak@odishatv.com",requestedAt: "2026-03-26"},
  ]);
  const [liveRoles, setLiveRoles]                       = usePersistedState("otv_liveRoles",
    USER_ROLES.filter(u=>u.id!=="admin").map(u=>({...u}))
  );
  const [newClients, setNewClients]                     = useState([{clientCompany:"",dealType:"Linear TV",targetAmount:""}]);
  const [addClientModalOpen, setAddClientModalOpen]     = useState(false);
  const [addClientForm, setAddClientForm]               = useState({clientCompany:"",dealType:"Linear TV",targetAmount:""});
  const [editSubId, setEditSubId]                       = useState(null);
  const [editSubClients, setEditSubClients]             = useState([]);
  const [revForm, setRevForm]                           = useState({clientCompany:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:"",notes:""});
  const [importTab, setImportTab]                       = useState("deals");

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

    const rep  = REPS.find(r => r.region === "National") || REPS[0];
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
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "OTV CRM", timestamp: new Date().toISOString(), ...event }),
    }).catch(() => {});
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
    REPS.forEach(rep => {
      const todayLogged = meetings.some(m=>m.repId===rep.id&&m.date===TODAY);
      const tmrwPlanned = (plans_crm||plans||[]).some(p=>p.repId===rep.id&&p.date===TOMORROW&&p.status==="Planned");
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
    if (dept==="CRO")            return "sales_analysis";
    return "admin"; // Finance, Legal, HR, Branding, Content → admin
  };

  // Auto-fill repId when log meeting modal opens for a Sales Rep
  useEffect(()=>{
    if (logOpen && user_role?.repId) {
      setLogForm(p => ({...p, repId: String(user_role.repId)}));
    }
    if (!logOpen) {
      setLogForm(p => ({...BLANK_LOG, repId: user_role?.repId ? String(user_role.repId) : ""}));
    }
  }, [logOpen, activeUser]);

  // Annual mode helpers — when "FY26 Annual" is selected the quarter filter spans all quarters
  const isAnnual = filterQ === "FY26 Annual";
  const qMatch   = (q: string) => isAnnual || q === filterQ;
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
    if(d.outcome==="Proposal Accepted"){
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

  const repScores = useMemo(() => REPS
    .filter(r => user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId)
    .map(rep => {
      const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
      const closed  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
      const pipe    = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
      const rm      = meetings.filter(m=>m.repId===rep.id);
      const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
      const risk    = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
      const attOk   = att[TODAY]?.[rep.id];
      const cPct    = rep.target>0?Math.round((closed/rep.target)*100):0;
      const senPct  = rm.length>0?Math.round((seniorM/rm.length)*100):0;
      return {...rep,closed,pipe,meetings:rm.length,seniorM,senPct,risk,attOk,cPct,coverage:rep.target>0?Math.round(((closed+pipe)/rep.target)*100):0};
    }).sort((a,b)=>b.cPct-a.cPct), [deals, meetings, att, filterQ, user_role]);

  // Global search results — across deals, meetings, tasks
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    deals.filter(d =>
      d.clientCompany?.toLowerCase().includes(q) ||
      d.contactName?.toLowerCase().includes(q) ||
      d.notes?.toLowerCase().includes(q)
    ).slice(0, 5).forEach(d => out.push({ type:"deal", label:d.clientCompany, sub:`${d.outcome} · ${fmtR(d.amount)}`, action:()=>{ setView("pipeline"); setGlobalSearch(""); setSearchOpen(false); } }));
    meetings.filter(m =>
      m.clientCompany?.toLowerCase().includes(q) ||
      m.discussion?.toLowerCase().includes(q) ||
      m.contactName?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(m => out.push({ type:"meeting", label:m.clientCompany, sub:`${m.date} · ${(m.discussion||"").slice(0,55)}`, action:()=>{ setView("activity"); setGlobalSearch(""); setSearchOpen(false); } }));
    tasks.filter(t =>
      t.clientCompany?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q)
    ).slice(0, 3).forEach(t => out.push({ type:"task", label:t.title, sub:t.clientCompany, action:()=>{ setView("tasks"); setGlobalSearch(""); setSearchOpen(false); } }));
    return out.slice(0, 8);
  }, [globalSearch, deals, meetings, tasks]);

  const updateOutcome = (id, outcome) => {
    const closed = outcome === "Proposal Accepted";
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
    // Revenue auto-stub — create PO Pending entry when deal is won
    if (closed) {
      const deal = deals.find(d => d.id === id);
      if (deal) {
        const stub = {
          id: `re${Date.now()}`, repId: deal.repId, clientCompany: deal.clientCompany,
          dealType: deal.dealType, amount: deal.amount, invoiceRef: "PO Pending",
          date: TODAY, quarter: deal.quarter || filterQ,
          notes: `Auto-stub: deal closed by ${user_role?.name||"manager"}. Confirm PO amount when received.`,
        };
        setRevenueEntries(p => [stub, ...p]);
        pushNotification({ event: "deal_closed", client: deal.clientCompany, amount: deal.amount, rep: deal.repName, message: `Deal won: ${deal.clientCompany} — ${fmtR(deal.amount)}` });
        showToast(`Revenue entry created for ${deal.clientCompany} — confirm PO amount in Revenue Log`);
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
    if (!REPS.find(r=>r.id===parsedRepId)){showToast("Select a valid rep","err");return;}
    const rep=REPS.find(r=>r.id===parseInt(dealForm.repId));
    setDeals(p=>[...p,{id:`d${Date.now()}`,...dealForm,repId:parseInt(dealForm.repId),repName:rep.name,region:rep.region,amount:parseCurrency(dealForm.amount||dealForm.targetAmount),targetAmount:parseCurrency(dealForm.targetAmount),lastContact:TODAY,reqs:[]}]);
    setDealForm(BLANK_DEAL);setAddDealOpen(false);showToast("Deal added ✓");
  };

  const handleLogMeeting = () => {
    if (!logForm.repId) { showToast("Select a Sales Rep", "err"); return; }
    const rep  = REPS.find(r => r.id === parseInt(logForm.repId));
    const deal = deals.find(d => d.id === logForm.dealId);
    const now  = new Date();
    const late = now.getHours() >= 23;
    const loggedAt = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const clientCompany = deal?.clientCompany || logForm.clientAgencyName || "";

    // Helper: map neededFrom dept name → assignedToUserId for that person's task list
    const getNeededFromUserId = (neededFrom: string, repId: number): string|null => {
      const north=[1,7,8,9,10], south=[2,6,11,12,13], east=[3,14,15,16,17], west=[4,18,19,20,21], national=[5,22,23,24,25], central=[26,27,28,29,30];
      const repRegion = north.includes(repId)?"North":south.includes(repId)?"South":east.includes(repId)?"East":west.includes(repId)?"West":national.includes(repId)?"National":central.includes(repId)?"Central":null;
      const rhByRegion:Record<string,string> = {North:"rh_north",South:"rh_south",East:"rh_east",West:"rh_west",National:"rh_national",Central:"rh_central"};
      if (neededFrom==="Region Head") return rhByRegion[repRegion||""]||null;
      if (neededFrom==="NSH")            return "sales_head";
      if (neededFrom==="CXO")            return "admin";
      if (neededFrom==="Sales Strategy") return "sales_strategy";
      if (neededFrom==="CRO")            return "sales_analysis";
      return null;
    };

    // Build a summary of next steps for the meeting record
    const nextStepsSummary = (logForm.nextStepItems||[])
      .filter(i=>i.action)
      .map(i=>`${i.action}${i.neededFrom?" (→ "+i.neededFrom+")":""}${i.remarks?" — "+i.remarks:""}`)
      .join("; ");

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
      nextSteps: nextStepsSummary || logForm.nextSteps,
      outcome: logForm.status === "Closed" ? "Proposal Accepted" : logForm.status || "Needs Callback",
    }, ...p]);

    // Auto-create tasks for each action item — routed to the right person's task list
    const repIdInt = parseInt(logForm.repId);
    const newTasks = (logForm.nextStepItems||[])
      .filter(i => i.action && i.neededFrom && i.neededFrom !== "Self" && i.neededFrom !== "Client")
      .map(i => ({
        id: `t${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        assignedTo: null,
        assignedToUserId: getNeededFromUserId(i.neededFrom, repIdInt),
        assignedDept: i.neededFrom,
        repId: repIdInt,
        clientCompany,
        title: i.action,
        description: `${i.remarks ? i.remarks+" — " : ""}Raised from meeting log by ${rep?.name} on ${TODAY}. Client: ${clientCompany}.`,
        priority: "High",
        status: "Open",
        dueDate: i.dueDate || TOMORROW,
        createdAt: TODAY,
        assignedBy: activeUser,
        assignedByName: user_role?.name || "Sales Rep",
        fromMeetingLog: true,
      }));

    if (newTasks.length) setTasks(p => [...newTasks, ...p]);

    // Auto-create internal requests from next step items (same as calendar path)
    const newIRsFromLog = (logForm.nextStepItems||[])
      .filter(i => i.action && i.neededFrom && !["Self","Client"].includes(i.neededFrom))
      .map(i => ({
        id: `ir${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type: ["Region Head","NSH","CXO"].includes(i.neededFrom) ? "Approval" : "Support",
        dept: i.neededFrom, subject: i.action,
        details: (i.remarks||"") + (clientCompany ? ` — Re: ${clientCompany}` : ""),
        raisedBy: activeUser, raisedByName: user_role?.name||"",
        repId: parseInt(logForm.repId)||null,
        dealId: logForm.dealId||null, clientCompany,
        status: "Pending", raisedAt: TODAY, slaHours: 48, resolvedAt: null, resolverNote: ""
      }));
    if (newIRsFromLog.length) setInternalReqs(p => [...newIRsFromLog, ...p]);

    // Update deal last contact, outcome, and next step
    const firstFollowUpItem = (logForm.nextStepItems||[]).find(i=>i.action);
    if (deal) {
      const approvalItem2 = (logForm.nextStepItems||[]).find(i =>
        i.neededFrom && ["Region Head","NSH","CXO","Branding Team","Content Team","Sales Strategy","Digital","Finance","Legal"].includes(i.neededFrom)
      );
      setDeals(p => p.map(d => d.id === logForm.dealId ? {
        ...d,
        lastContact: TODAY,
        outcome: logForm.status === "Closed" ? "Proposal Accepted" : d.outcome,
        nextStep: nextStepsSummary || firstFollowUpItem?.action || logForm.nextSteps,
        nextStepDate: firstFollowUpItem?.dueDate || logForm.followUpDate || d.nextStepDate,
        awaitingApproval: approvalItem2 ? approvalItem2.neededFrom : d.awaitingApproval,
        awaitingApprovalSince: approvalItem2 ? TODAY : d.awaitingApprovalSince,
        auditLog: [...(d.auditLog||[]), ...(approvalItem2?[{at:TODAY,by:user_role?.name||"Rep",role:user_role?.role||"",action:"Flagged",from:null,to:approvalItem2.neededFrom,note:approvalItem2.action}]:[])],
      } : d));
    } else if (clientCompany && (logForm.nextStepItems||[]).some(i=>i.action)) {
      // No deal yet — create a pipeline stub for follow-up
      const stub = {
        id: `d_stub_${Date.now()}`,
        repId: parseInt(logForm.repId),
        clientCompany,
        contactName: logForm.contactName || "",
        designation: logForm.designation || "",
        phone: logForm.mobile || "",
        dealType: logForm.pitchType ? (logForm.pitchType.includes("FCT")?"Linear TV":logForm.pitchType.includes("Digital")?"Digital":"Media Solutions") : "Linear TV",
        outcome: "Needs Callback",
        amount: 0,
        targetAmount: 0,
        region: rep?.region || "National",
        priority: "Regular",
        quarter: entryQ,
        notes: `Created from meeting log on ${TODAY}. ${logForm.discussion||""}`,
        nextStep: nextStepsSummary || "",
        nextStepDate: firstFollowUpItem?.dueDate || logForm.followUpDate || null,
        lastContact: TODAY,
        awaitingApproval: null,
        awaitingApprovalSince: null,
        reqs: [],
      };
      setDeals(p => [stub, ...p]);
      showToast("New pipeline entry created from meeting log");
    }

    // Auto-create calendar plans for each next-step item that has a due date
    const stepPlans = (logForm.nextStepItems||[]).filter(i=>i.action&&i.dueDate);
    if (stepPlans.length) {
      stepPlans.forEach((item, idx) => {
        setPlans(p => [...p, {
          id: `p_ns_${Date.now()}_${idx}`,
          repId: parseInt(logForm.repId),
          date: item.dueDate,
          time: "10:00",
          clientAgencyName: clientCompany,
          contactName: logForm.contactName || "",
          phone: "",
          agenda: `${item.action}${item.neededFrom ? ` → ${item.neededFrom}` : ""}`,
          pitchType: "",
          meetingType: "Task",
          needsMeet: false,
          status: "Planned",
          loggedMeetingId: null,
          isUnplanned: false,
          autoCreatedFrom: "next-step",
          assignedDept: item.neededFrom || "",
        }]);
      });
    }

    // Auto-create calendar plan for next meeting date
    if (logForm.nextMeetingDate) {
      setPlans(p => [...p, {
        id: `p_nxt_${Date.now()}`,
        repId: parseInt(logForm.repId),
        date: logForm.nextMeetingDate,
        time: logForm.nextMeetingTime || "10:00",
        clientAgencyName: clientCompany,
        contactName: logForm.contactName || "",
        phone: logForm.mobile || "",
        agenda: logForm.nextAgenda || `Next meeting with ${clientCompany}`,
        pitchType: logForm.pitchType || "",
        meetingType: logForm.meetingType || "Physical",
        needsMeet: false,
        status: "Planned",
        loggedMeetingId: null,
        isUnplanned: false,
        autoCreatedFrom: "next-meeting",
      }]);
    }
    // Auto-create calendar plan for follow-up date
    if (logForm.followUpDate) {
      setPlans(p => [...p, {
        id: `p_fu_${Date.now() + 1}`,
        repId: parseInt(logForm.repId),
        date: logForm.followUpDate,
        time: "10:00",
        clientAgencyName: clientCompany,
        contactName: logForm.contactName || "",
        phone: logForm.mobile || "",
        agenda: `Follow-up: ${nextStepsSummary || logForm.nextSteps || "Check in with client"}`,
        pitchType: logForm.pitchType || "",
        meetingType: "Call",
        needsMeet: false,
        status: "Planned",
        loggedMeetingId: null,
        isUnplanned: false,
        autoCreatedFrom: "follow-up",
      }]);
    }

    setAtt(p => ({ ...p, [TODAY]: { ...(p[TODAY]||{}), [parseInt(logForm.repId)]: true } }));
    setLogForm(BLANK_LOG);
    setLogOpen(false);
    const taskMsg  = newTasks.length      ? ` · ${newTasks.length} task${newTasks.length>1?"s":""} assigned` : "";
    const irMsgL   = newIRsFromLog.length ? ` · ${newIRsFromLog.length} request${newIRsFromLog.length>1?"s":""} raised` : "";
    const planMsg  = (logForm.nextMeetingDate ? 1 : 0) + (logForm.followUpDate ? 1 : 0);
    const planMsgStr = planMsg > 0 ? ` · ${planMsg} calendar entry added` : "";
    showToast((late ? "Logged — flagged late (after 11:30 PM)" : "Meeting logged ✓") + taskMsg + irMsgL + planMsgStr);
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
        "Logged via OTV CRM",
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

      const resp = await fetch("/api/claude", {
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

    // ── HARD BLOCK VALIDATION ──
    if (!logForm.discussion?.trim()) { showToast("'What you pitched' is required", "err"); return; }
    if (!logForm.clientFeedback?.trim()) { showToast("Client feedback is required", "err"); return; }
    if (!logForm.status) { showToast("Meeting status is required", "err"); return; }
    if (!logForm.followUpDate) { showToast("Follow-up date is required", "err"); return; }
    const hasValidNextStep = (logForm.nextStepItems||[]).some(i => i.action && i.neededFrom);
    if (!hasValidNextStep) { showToast("At least one next step with an owner is required", "err"); return; }
    if (logForm.seniorRequested === "Yes" && !logForm.seniorRequestedName?.trim()) { showToast("Senior's name is required when escalation is Yes", "err"); return; }

    let calResult = null;
    if (logForm.scheduleNext && logForm.nextMeetingDate) {
      calResult = await createCalendarEvent(logForm);
    }
    const updatedForm = calResult ? { ...logForm, ...calResult } : logForm;
    const rep  = REPS.find(r => r.id === parseInt(updatedForm.repId));
    const deal = deals.find(d => d.id === updatedForm.dealId);
    const now  = new Date();
    const late = now.getHours() >= 23;
    const loggedAt = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const clientCompany = deal?.clientCompany || updatedForm.clientAgencyName || "";

    const nextStepsSummary = (updatedForm.nextStepItems||[])
      .filter(i=>i.action)
      .map(i=>`${i.action}${i.neededFrom?" (→ "+i.neededFrom+")":""}${i.remarks?" — "+i.remarks:""}`)
      .join("; ");

    setMeetings(p => [{
      id: `ml${Date.now()}`,
      ...updatedForm,
      repId: parseInt(updatedForm.repId),
      repName: rep.name, region: rep.region,
      clientCompany, date: TODAY, loggedAt, late,
      nextSteps: nextStepsSummary || updatedForm.nextSteps,
      outcome: updatedForm.status === "Closed" ? "Proposal Accepted" : updatedForm.status || "Needs Callback",
    }, ...p]);

    // Auto-create tasks from next step items
    const repIdIntC = parseInt(updatedForm.repId);
    const getNeededFromUserIdC = (neededFrom: string, repId: number): string|null => {
      const north=[1,7,8,9,10], south=[2,6,11,12,13], east=[3,14,15,16,17], west=[4,18,19,20,21], national=[5,22,23,24,25], central=[26,27,28,29,30];
      const repRegion = north.includes(repId)?"North":south.includes(repId)?"South":east.includes(repId)?"East":west.includes(repId)?"West":national.includes(repId)?"National":central.includes(repId)?"Central":null;
      const rhByRegion:Record<string,string> = {North:"rh_north",South:"rh_south",East:"rh_east",West:"rh_west",National:"rh_national",Central:"rh_central"};
      if (neededFrom==="Region Head") return rhByRegion[repRegion||""]||null;
      if (neededFrom==="NSH")            return "sales_head";
      if (neededFrom==="CXO")            return "admin";
      if (neededFrom==="Sales Strategy") return "sales_strategy";
      if (neededFrom==="CRO")            return "sales_analysis";
      return null;
    };
    const newTasks = (updatedForm.nextStepItems||[])
      .filter(i => i.action && i.neededFrom && i.neededFrom !== "Self" && i.neededFrom !== "Client")
      .map(i => ({
        id: `t${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        assignedTo: null,
        assignedToUserId: getNeededFromUserIdC(i.neededFrom, repIdIntC),
        assignedDept: i.neededFrom,
        repId: repIdIntC,
        clientCompany,
        title: i.action,
        description: `${i.remarks ? i.remarks+" — " : ""}Raised from meeting log by ${rep?.name} on ${TODAY}. Client: ${clientCompany}.`,
        priority: "High",
        status: "Open",
        dueDate: i.dueDate || TOMORROW,
        createdAt: TODAY,
        assignedBy: activeUser,
        assignedByName: user_role?.name || "Sales Rep",
        fromMeetingLog: true,
      }));
    if (newTasks.length) setTasks(p => [...newTasks, ...p]);

    // Auto-create internal requests from next step items (when neededFrom is a dept, not Self/Client)
    const newIRs = (updatedForm.nextStepItems||[])
      .filter(i => i.action && i.neededFrom && !["Self","Client"].includes(i.neededFrom))
      .map(i => ({
        id: `ir${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type: ["Region Head","NSH","CXO"].includes(i.neededFrom) ? "Approval" : "Support",
        dept: i.neededFrom, subject: i.action,
        details: (i.remarks||"") + (clientCompany ? ` — ${clientCompany}` : ""),
        raisedBy: activeUser, raisedByName: user_role?.name||"",
        repId: parseInt(updatedForm.repId)||null,
        dealId: updatedForm.dealId||null, clientCompany,
        status: "Pending", raisedAt: TODAY, slaHours: 48, resolvedAt: null, resolverNote: ""
      }));
    if (newIRs.length) setInternalReqs(p => [...newIRs, ...p]);

    const firstFollowUpItem = (updatedForm.nextStepItems||[]).find(i=>i.action);
    if (deal) {
      // Determine if any next step requires internal approval
      const approvalItem = (updatedForm.nextStepItems||[]).find(i =>
        i.neededFrom && ["Region Head","NSH","CXO","Branding Team","Content Team","Sales Strategy","Digital","Finance","Legal"].includes(i.neededFrom)
      );
      const newAwaiting = approvalItem ? approvalItem.neededFrom : deal.awaitingApproval;
      const auditEntry  = approvalItem ? [{
        at: TODAY, by: user_role?.name || "Rep", role: user_role?.role || "SALES REP",
        action: "Flagged for approval", from: null, to: approvalItem.neededFrom,
        note: `${approvalItem.action} — raised via meeting log`,
      }] : [];
      setDeals(p => p.map(d => d.id === updatedForm.dealId ? {
        ...d, lastContact: TODAY,
        outcome: updatedForm.status === "Closed" ? "Proposal Accepted" : d.outcome,
        nextStep: nextStepsSummary || firstFollowUpItem?.action || updatedForm.nextSteps,
        nextStepDate: firstFollowUpItem?.dueDate || updatedForm.followUpDate || d.nextStepDate,
        awaitingApproval: newAwaiting,
        awaitingApprovalSince: approvalItem ? TODAY : d.awaitingApprovalSince,
        auditLog: [...(d.auditLog||[]), ...auditEntry],
      } : d));
    }

    // Auto-create calendar plans for each next-step item that has a due date
    const stepPlansC = (updatedForm.nextStepItems||[]).filter(i=>i.action&&i.dueDate);
    if (stepPlansC.length) {
      stepPlansC.forEach((item, idx) => {
        setPlans(p => [...p, {
          id: `p_ns_${Date.now()}_${idx}`,
          repId: parseInt(updatedForm.repId),
          date: item.dueDate,
          time: "10:00",
          clientAgencyName: clientCompany,
          contactName: updatedForm.contactName || "",
          phone: "",
          agenda: `${item.action}${item.neededFrom ? ` → ${item.neededFrom}` : ""}`,
          pitchType: "",
          meetingType: "Task",
          needsMeet: false,
          status: "Planned",
          loggedMeetingId: null,
          isUnplanned: false,
          autoCreatedFrom: "next-step",
          assignedDept: item.neededFrom || "",
        }]);
      });
    }

    // Auto-create calendar plan for next meeting date
    if (updatedForm.nextMeetingDate) {
      setPlans(p => [...p, {
        id: `p_nxt_${Date.now()}`,
        repId: parseInt(updatedForm.repId),
        date: updatedForm.nextMeetingDate,
        time: updatedForm.nextMeetingTime || "10:00",
        clientAgencyName: clientCompany,
        contactName: updatedForm.contactName || "",
        phone: updatedForm.mobile || "",
        agenda: updatedForm.nextAgenda || `Next meeting with ${clientCompany}`,
        pitchType: updatedForm.pitchType || "",
        meetingType: updatedForm.meetingType || "Physical",
        needsMeet: false,
        status: "Planned",
        loggedMeetingId: null,
        isUnplanned: false,
        autoCreatedFrom: "next-meeting",
      }]);
    }
    // Auto-create calendar plan for follow-up date
    if (updatedForm.followUpDate) {
      setPlans(p => [...p, {
        id: `p_fu_${Date.now() + 1}`,
        repId: parseInt(updatedForm.repId),
        date: updatedForm.followUpDate,
        time: "10:00",
        clientAgencyName: clientCompany,
        contactName: updatedForm.contactName || "",
        phone: updatedForm.mobile || "",
        agenda: `Follow-up: ${nextStepsSummary || updatedForm.nextSteps || "Check in with client"}`,
        pitchType: updatedForm.pitchType || "",
        meetingType: "Call",
        needsMeet: false,
        status: "Planned",
        loggedMeetingId: null,
        isUnplanned: false,
        autoCreatedFrom: "follow-up",
      }]);
    }

    setAtt(p => ({ ...p, [TODAY]: { ...(p[TODAY]||{}), [parseInt(updatedForm.repId)]: true } }));
    setLogForm(BLANK_LOG);
    setLogOpen(false);
    const taskMsg = newTasks.length ? ` · ${newTasks.length} task${newTasks.length>1?"s":""} assigned` : "";
    const irMsg   = newIRs.length   ? ` · ${newIRs.length} request${newIRs.length>1?"s":""} raised`  : "";
    const planMsg2 = (updatedForm.nextMeetingDate ? 1 : 0) + (updatedForm.followUpDate ? 1 : 0);
    const planMsgStr2 = planMsg2 > 0 ? ` · ${planMsg2} calendar entry added` : "";
    if (calResult?.meetLink) showToast(`Meeting logged + Calendar event created ✓` + taskMsg + irMsg + planMsgStr2);
    else showToast((late ? "Meeting logged — flagged late (after 11:30 PM)" : "Meeting logged ✓") + taskMsg + irMsg + planMsgStr2);
  };

  // ── ROLE CONSTANTS ──
  const isRep          = user_role?.role === "SALES REP";
  const isRH           = user_role?.role === "REGION HEAD";
  const isNSH          = user_role?.role === "SALES HEAD";
  const isCRORole      = user_role?.role === "CRO";
  const isStrategy     = user_role?.role === "SALES STRATEGY";
  const isDigiOps      = user_role?.role === "DIGI OPS";
  const isAdmin        = user_role?.role === "ADMIN";
  // NSH Dashboard is shared by NSH, CRO, and Sales Strategy
  const isNSHDashboard = ["SALES HEAD","CRO","SALES STRATEGY"].includes(user_role?.role);
  // CRO and Sales Strategy can VIEW meetings but cannot log them
  const canLogMeeting  = !["CRO","SALES STRATEGY"].includes(user_role?.role);
  // Legacy aliases
  const isCEORole = false;
  const isMDRole  = false;

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
    if (currentApprover === "NSH") return amount >= APPROVAL_THRESHOLDS.CXO ? "CXO" : null;
    if (currentApprover === "CXO") return null;
    if (currentApprover === "RH")  return "NSH";
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

  const myRepTaskBadge = isRep
    ? tasks.filter(t=>(t.assignedToUserId===activeUser||t.assignedTo===user_role?.repId)&&t.status!=="Done").length||null
    : tasks.filter(t=>t.status!=="Done").length||null;

  // ── SECTIONED NAV BUILDER ──
  const N = (id,label,icon,badge=null) => ({id,label,icon,badge});
  const getSidebarSections = () => {
    if (section === "ro") return [];

    const irBadge      = internalReqs.filter(r=>r.status!=="Done"&&r.raisedBy===activeUser).length||null;
    const irInboxDept  = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":null;
    const irInboxBadge = irInboxDept
      ? internalReqs.filter(r=>r.status!=="Done"&&r.dept===irInboxDept).length||null
      : internalReqs.filter(r=>r.status!=="Done"&&["NSH","Sales Strategy","CRO","Branding Team","Content Team","Digital","Finance","Legal"].includes(r.dept)).length||null;

    // ── SALES REP ──
    if (isRep) return [
      { label:"PLANNING",    items:[N("my-plan","My Plan","◎")] },
      { label:"MY CRM",      items:[
        N("warroom","War Room","⬡",atRisk.length+overdueNext.length||null),
        N("pipeline","Revenue Tracker","◈"),
        N("target-submit","My Targets","◎",targetSubs.filter(t=>t.repId===user_role?.repId&&t.status!=="Approved").length||null),
        N("tasks","Tasks","✓",myRepTaskBadge),
        N("internal-requests","Internal Requests","⬆",irBadge),
        N("hr","HR Reports","⊘"),
      ]},
      { label:"LEADERBOARD", items:[
        N("lb-team","My Team","◇"),
        N("lb-region","By Region","◇"),
        N("lb-all","All Sales Reps","◇"),
      ]},
    ];

    // ── REGION HEAD ──
    if (isRH) return [
      { label:"PLANNING",    items:[N("my-plan","My Plan","◎"), N("rh-team-plan","Team's Plan","◎")] },
      { label:"MY CRM",      items:[
        N("warroom","War Room","⬡",rhEscBadge),
        N("pipeline","Revenue Tracker","◈"),
        N("targets","My Targets","◎"),
        N("target-approvals","Approvals","◎",targetSubs.filter(t=>t.region===rhRegion&&t.status==="Pending RH").length||null),
        N("my-tasks","My Tasks","✓"),
        N("rh-escalations","Escalations","▲",rhEscBadge),
        N("internal-requests","Internal Requests","⬆",irBadge),
        N("hr","My HR Report","⊘"),
      ]},
      { label:"TEAM'S CRM",  items:[
        N("rh-team-targets","Team's Targets","◈"),
        N("rh-team-tasks","Team's Tasks","✓"),
        N("rh-team-hr","Team's HR Reports","⊘"),
      ]},
      { label:"LEADERBOARD", items:[
        N("lb-team","My Region","◇"),
        N("lb-region","All Regions","◇"),
        N("lb-all","All Sales Reps","◇"),
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
      { label:"APPROVALS", items:[N("admin-approvals","Approval Queue","✦",internalReqs.filter(r=>r.status==="Pending"||r.status==="Overdue").length||null)] },
      { label:"DATA",      items:[N("import","Import Data","⬆"), N("admin-config","System Config","⚙")] },
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


  return (
    <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",fontSize:13}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
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
                placeholder="Search deals, clients, meetings…"
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
          {(isRep || isRH) && <div style={{fontSize:11,fontWeight:700,color:countdown.includes("passed")?C.red:C.green,background:countdown.includes("passed")?`${C.red}12`:`${C.green}10`,border:`1px solid ${countdown.includes("passed")?C.red:C.green}33`,padding:"3px 10px",borderRadius:4,whiteSpace:"nowrap"}}>⏱ {countdown}</div>}

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
        return (
          <>
            {/* Dark backdrop — does NOT block sidebar so nav still visible */}
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:8000,pointerEvents:"none"}} />
            {/* Floating tooltip card */}
            <div style={{position:"fixed",bottom:32,right:32,zIndex:8001,width:380,background:C.surface,border:`1px solid ${C.accent}55`,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.7)",overflow:"hidden"}}>
              {/* Progress bar */}
              <div style={{height:3,background:C.s2}}>
                <div style={{height:"100%",width:`${pct}%`,background:C.accent,transition:"width .3s"}} />
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
        <div style={{flex:1,overflow:"auto",padding: isMobile ? 12 : 20}}>

          {/* ═══ MY PLAN ═══ */}
          {view==="my-plan" && (()=>{
            // ── SALES STRATEGY / CRO: monthly overview (read-only, no daily limits) ──
            if (isStrategy || isCRORole) {
              const allMeetings = meetings;
              const months = [...new Set(allMeetings.map(m=>m.date?.slice(0,7)))].sort().reverse().slice(0,6);
              return (
                <div className="fin">
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>
                    {isStrategy?"Team Meeting Overview":"CRO Meeting Overview"}
                  </div>
                  <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Monthly meeting summary across all reps and region heads. Read-only.</div>
                  {months.map(ym=>{
                    const monthMeetings = allMeetings.filter(m=>m.date?.startsWith(ym));
                    const byRep = {};
                    monthMeetings.forEach(m=>{
                      const key = m.repId;
                      if(!byRep[key]) byRep[key]={repId:m.repId,repName:m.repName||"Rep "+m.repId,count:0,clients:new Set()};
                      byRep[key].count++;
                      if(m.clientCompany) byRep[key].clients.add(m.clientCompany);
                    });
                    const repRows = Object.values(byRep).sort((a,b)=>b.count-a.count);
                    const [yr,mo] = ym.split("-");
                    const label   = new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
                    return (
                      <div key={ym} className="card" style={{padding:"14px 18px",marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div className="sans" style={{fontWeight:700,fontSize:14}}>{label}</div>
                          <div style={{display:"flex",gap:12}}>
                            <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:20,fontWeight:800,color:C.blue}}>{monthMeetings.length}</div><div style={{fontSize:9,color:C.dim}}>TOTAL MEETINGS</div></div>
                            <div style={{textAlign:"right"}}><div className="sans" style={{fontSize:20,fontWeight:800,color:C.accent}}>{Object.keys(byRep).length}</div><div style={{fontSize:9,color:C.dim}}>REPS ACTIVE</div></div>
                          </div>
                        </div>
                        {repRows.map(r=>(
                          <div key={r.repId} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",background:C.s2,borderRadius:5,marginBottom:4}}>
                            <span className="sans" style={{flex:1,fontWeight:600,fontSize:12}}>{r.repName}</span>
                            <span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{r.count} meetings</span>
                            <span style={{fontSize:10,color:C.dim}}>{r.clients.size} clients</span>
                          </div>
                        ))}
                        {repRows.length===0&&<div style={{textAlign:"center",padding:12,color:C.muted,fontSize:11}}>No meetings logged this month</div>}
                      </div>
                    );
                  })}
                  {months.length===0&&<div style={{textAlign:"center",padding:60,color:C.muted}}>No meeting history yet.</div>}
                </div>
              );
            }

            const myRepId = user_role?.repId || null;
            const allPlans = plans || [];
            const todayPlans  = allPlans.filter(p => (myRepId ? p.repId===myRepId : true) && p.date===TODAY);
            const tmrwPlans   = allPlans.filter(p => (myRepId ? p.repId===myRepId : true) && p.date===TOMORROW);
            const todayLogged = meetings.some(m=>(myRepId?m.repId===myRepId:true)&&m.date===TODAY) || todayPlans.some(p=>p.status==="Done");
            const tmrwPlanned = tmrwPlans.length > 0;

            // Weekly timer — due Saturday 11:30 PM
            const now = new Date();
            const daysUntilSat = (6 - now.getDay() + 7) % 7;
            const satDeadline = new Date(now);
            satDeadline.setDate(now.getDate() + daysUntilSat);
            satDeadline.setHours(23, 30, 0, 0);
            const weeklyDiffMs = satDeadline - now;
            const weeklyH = Math.floor(weeklyDiffMs / 3600000);
            const weeklyM = Math.floor((weeklyDiffMs % 3600000) / 60000);
            const weeklyLabel = weeklyDiffMs <= 0 ? "Past weekly deadline" : `${weeklyH}h ${weeklyM}m left`;

            // Calendar — month view
            const pf = planForm; const setPf = setPlanForm;

            const doAddPlan = (date) => {
              if (!pf.clientAgencyName.trim()) return;
              const planTime = pf.time||"10:00";
              setPlans(p=>[...p,{id:`p${Date.now()}`,repId:myRepId||(REPS[0]?.id),date,time:planTime,clientAgencyName:pf.clientAgencyName.trim(),contactName:pf.contactName.trim(),phone:pf.phone.trim(),agenda:pf.agenda.trim(),pitchType:pf.pitchType,meetingType:pf.meetingType||"Physical",needsMeet:pf.needsMeet||false,status:"Planned",loggedMeetingId:null,isUnplanned:false}]);

              // Calendar sync — open calendar in new tab
              if (pf.syncToCalendar) {
                const [hStr,mStr] = planTime.split(":");
                const h = parseInt(hStr||"10"); const m = parseInt(mStr||"0");
                const endH = String(h+1).padStart(2,"0"); const endM = String(m).padStart(2,"0");
                const startH = String(h).padStart(2,"0");
                const dateParts = date.replace(/-/g,""); // YYYYMMDD
                const title = encodeURIComponent(`[OTV] Meeting: ${pf.clientAgencyName.trim()}`);
                const details = encodeURIComponent(`Contact: ${pf.contactName.trim()}${pf.agenda?"\nAgenda: "+pf.agenda:""}`);
                if (pf.calPlatform==="google") {
                  const startDT = `${dateParts}T${startH}${endM}00`;
                  const endDT   = `${dateParts}T${endH}${endM}00`;
                  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDT}/${endDT}&details=${details}`,"_blank");
                } else if (pf.calPlatform==="zoho") {
                  window.open(`https://calendar.zoho.in/newevent?title=${title}&startdate=${date}&starttime=${startH}:${endM}&enddate=${date}&endtime=${endH}:${endM}&desc=${details}`,"_blank");
                } else if (pf.calPlatform==="outlook") {
                  const startISO = `${date}T${startH}:${endM}:00`;
                  const endISO   = `${date}T${endH}:${endM}:00`;
                  window.open(`https://outlook.office.com/calendar/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(startISO)}&enddt=${encodeURIComponent(endISO)}&body=${details}`,"_blank");
                }
              }

              setPf({clientAgencyName:"",contactName:"",phone:"",time:"10:00",agenda:"",pitchType:"",meetingType:"Physical",needsMeet:false,syncToCalendar:pf.syncToCalendar,calPlatform:pf.calPlatform});
              setAddPlanFor(null);
              showToast(pf.syncToCalendar?"Meeting planned ✓ · Calendar opening…":"Meeting planned ✓");
            };

            // Inline log state — which plan is being logged right now
            const [inlineLogPlan, setInlineLogPlan] = planInlineState;

            return (
              <div className="fin">
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY PLAN</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Click any planned meeting to log it · Add new ones via + on calendar</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {/* Daily timer */}
                    <div style={{background:countdown.includes("passed")?`${C.red}12`:`${C.green}10`,border:`1px solid ${countdown.includes("passed")?C.red:C.green}33`,borderRadius:5,padding:"4px 10px",fontSize:11,fontWeight:700,color:countdown.includes("passed")?C.red:C.green}}>
                      Daily: {countdown.includes("passed")?"Passed":countdown}
                    </div>
                    {/* Weekly timer */}
                    <div style={{background:weeklyDiffMs<=0?`${C.red}12`:`${C.blue}10`,border:`1px solid ${weeklyDiffMs<=0?C.red:C.blue}33`,borderRadius:5,padding:"4px 10px",fontSize:11,fontWeight:700,color:weeklyDiffMs<=0?C.red:C.blue}}>
                      Weekly: {weeklyLabel}
                    </div>
                  </div>
                </div>

                {/* ── Sub-tabs ── */}
                <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:0}}>
                  {([["plan","📅 Plan"],["log","📋 Meeting Log"]] as [string,string][]).map(([id,label])=>(
                    <button key={id} onClick={()=>setMyPlanTab(id as "plan"|"log")}
                      style={{background:"none",border:"none",borderBottom:`2px solid ${myPlanTab===id?C.accent:"transparent"}`,padding:"6px 14px",fontSize:12,fontWeight:myPlanTab===id?700:400,color:myPlanTab===id?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginBottom:-1,transition:"color .15s"}}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── MEETING LOG TAB ── */}
                {myPlanTab==="log" && (()=>{
                  const myMeetings = meetings
                    .filter(m=>myRepId?m.repId===myRepId:true)
                    .sort((a,b)=>b.date>a.date?1:-1);
                  const outcomeColor = (o) => o?.includes("Accepted")?C.green:o?.includes("Interested")?C.blue:o?.includes("Concern")||o?.includes("Objection")?C.orange:o?.includes("Not")||o?.includes("Lost")?C.red:C.dim;
                  if (!myMeetings.length) return (
                    <div style={{textAlign:"center",padding:60,color:C.muted,fontSize:12}}>No meetings logged yet. Use the Plan tab to log your first meeting.</div>
                  );
                  return (
                    <div>
                      <div style={{marginBottom:10,fontSize:11,color:C.dim}}>{myMeetings.length} meetings logged</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr>
                              {["Date","Client","Contact","Outcome","Discussion / Notes","Next Step"].map(h=>(
                                <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:".06em",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {myMeetings.map(m=>(
                              <tr key={m.id}
                                style={{borderBottom:`1px solid ${C.s2}`,cursor:"pointer"}}
                                onClick={()=>setViewMeetingId(m.id)}
                                onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                  <div style={{fontSize:12,fontWeight:600,color:m.date===TODAY?C.accent:C.text}}>{m.date===TODAY?"Today":m.date}</div>
                                  {m.loggedAt&&<div style={{fontSize:10,color:C.dim}}>logged {m.loggedAt}</div>}
                                  {m.late&&<div style={{fontSize:9,color:C.orange,fontWeight:700}}>LATE</div>}
                                </td>
                                <td style={{padding:"10px 14px"}}>
                                  <div style={{fontWeight:600,fontSize:12}}>{m.clientCompany||"—"}</div>
                                </td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>
                                  <div>{m.contactName||"—"}</div>
                                  {m.contactLevel&&<div style={{fontSize:9,color:C.muted}}>{m.contactLevel}</div>}
                                </td>
                                <td style={{padding:"10px 14px"}}>
                                  <span style={{background:`${outcomeColor(m.outcome)}18`,color:outcomeColor(m.outcome),padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{m.outcome||"—"}</span>
                                </td>
                                <td style={{padding:"10px 14px",maxWidth:260,fontSize:11,color:C.dim,lineHeight:1.4}}>
                                  {(m.discussion||"").slice(0,100)}{m.discussion?.length>100?"…":""}
                                </td>
                                <td style={{padding:"10px 14px",fontSize:11,color:C.text,maxWidth:200,lineHeight:1.4}}>
                                  {m.nextStep||"—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* ── PLAN TAB content ── */}
                {myPlanTab==="plan" && <>

                {/* Compliance strip */}
                <div style={{background:todayLogged&&tmrwPlanned?`${C.green}08`:`${C.red}06`,border:`1px solid ${todayLogged&&tmrwPlanned?C.green:C.red}44`,borderRadius:7,padding:"8px 14px",marginBottom:16,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:todayLogged?C.green:C.red,fontWeight:700}}>{todayLogged?"✓":"✗"} Today logged</span>
                  <span style={{fontSize:12,color:tmrwPlanned?C.green:C.red,fontWeight:700}}>{tmrwPlanned?"✓":"✗"} Tomorrow planned</span>
                  <span style={{fontSize:11,color:C.dim,marginLeft:"auto"}}>{todayLogged&&tmrwPlanned?"All done ✓":"Complete both before 11:30 PM"}</span>
                </div>

                {/* After 6 PM nudge banner */}
                {(()=>{
                  const unlogged = todayPlans.filter(p=>p.status==="Planned").length;
                  if (new Date().getHours() >= 18 && unlogged > 0) {
                    return (
                      <div style={{background:`${C.orange}12`,border:`1px solid ${C.orange}44`,borderRadius:7,padding:"10px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16}}>⚠</span>
                        <span style={{fontSize:13,color:C.orange,fontWeight:700}}>{unlogged} meeting{unlogged!==1?"s":""} not logged yet — deadline is 11:30 PM tonight</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* DUE DATE ALERTS */}
                {(()=>{
                  const repTasks = tasks.filter(t =>
                    (t.repId===myRepId||t.assignedTo===myRepId||t.assignedToUserId===activeUser) && t.status!=="Done"
                  );
                  const autoDuePlans = (plans||[]).filter(p =>
                    p.repId===myRepId &&
                    (p.autoCreatedFrom==="next-step" || p.autoCreatedFrom==="follow-up" || p.autoCreatedFrom==="next-meeting") &&
                    p.status!=="Done" && p.status!=="Cancelled"
                  );
                  const overdue   = [...repTasks.filter(t=>t.dueDate&&t.dueDate<TODAY), ...autoDuePlans.filter(p=>p.date<TODAY)];
                  const dueToday  = [...repTasks.filter(t=>t.dueDate===TODAY), ...autoDuePlans.filter(p=>p.date===TODAY)];
                  const dueTmrw   = [...repTasks.filter(t=>t.dueDate===TOMORROW), ...autoDuePlans.filter(p=>p.date===TOMORROW)];
                  if (!overdue.length && !dueToday.length && !dueTmrw.length) return null;
                  const markItemDone = (item) => {
                    if (repTasks.find(t=>t.id===item.id)) {
                      setTasks(q=>q.map(t=>t.id===item.id?{...t,status:"Done"}:t));
                    } else {
                      setPlans(q=>q.map(p=>p.id===item.id?{...p,status:"Done"}:p));
                    }
                  };
                  const renderItem = (item, urgency) => {
                    const title   = item.title || item.agenda || "—";
                    const dept    = item.assignedDept || item.dept || item.neededFrom || "";
                    const client  = item.clientCompany || item.clientAgencyName || "";
                    const clr     = urgency==="overdue"?C.red:urgency==="today"?C.orange:C.blue;
                    return (
                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",background:C.s2,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${clr}`}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text}}>{title}</div>
                          {(client||dept)&&<div style={{fontSize:10,color:C.dim}}>{client}{client&&dept?" · ":""}{dept&&`→ ${dept}`}</div>}
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:clr,whiteSpace:"nowrap"}}>
                          {urgency==="overdue"?"⚠ OVERDUE":urgency==="today"?"Due TODAY":"Due TOMORROW"}
                        </span>
                        <button onClick={()=>markItemDone(item)} style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,borderRadius:4,padding:"3px 10px",color:C.green,fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>✓ Done</button>
                      </div>
                    );
                  };
                  return (
                    <div style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:8,padding:"12px 16px",marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.orange,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>
                        ⏰ Action Item Due Dates ({overdue.length+dueToday.length+dueTmrw.length})
                      </div>
                      {overdue.map(i=>renderItem(i,"overdue"))}
                      {dueToday.map(i=>renderItem(i,"today"))}
                      {dueTmrw.map(i=>renderItem(i,"tomorrow"))}
                    </div>
                  );
                })()}

                {/* TODAY + TOMORROW cards */}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  {[{label:"TODAY",date:TODAY,planList:todayPlans,done:todayLogged},{label:"TOMORROW",date:TOMORROW,planList:tmrwPlans,done:tmrwPlanned}].map(({label,date,planList,done})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{background:C.s2,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                        <div>
                          <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{label}</span>
                          <span style={{fontSize:10,color:C.dim}}> · {planList.length} meeting{planList.length!==1?"s":""}</span>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:12,color:done?C.green:C.red,fontWeight:700}}>{done?"✓":"✗"}</span>
                          <button onClick={()=>setAddPlanFor(date)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 8px",color:C.dim,fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>+ Add</button>
                        </div>
                      </div>
                      <div style={{padding:"10px 14px",minHeight:60}}>
                        {planList.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"12px 0"}}>Nothing planned yet</div>}
                        {planList.map(p=>{
                          const isOpen = inlineLogPlan===p.id;
                          const isFuture = p.date > TODAY && p.status !== "Done";
                          // Find linked deal for this plan — shows blocking info
                          const linkedDeal = deals.find(d=>d.repId===myRepId&&(d.clientCompany||"").toLowerCase()===(p.clientAgencyName||"").toLowerCase());
                          const blocked = linkedDeal?.awaitingApproval && p.status!=="Done";
                          const dealNextStep = linkedDeal?.nextStep && linkedDeal.nextStep !== p.agenda ? linkedDeal.nextStep : null;
                          return (
                            <div key={p.id} style={{marginBottom:8}}>
                              {/* Meeting chip — click to expand */}
                              <div onClick={()=>{
                                  if (p.status==="Done") {
                                    const m = meetings.find(m=>m.id===p.loggedMeetingId) || meetings.find(m=>m.repId===myRepId && (m.clientCompany||"").toLowerCase()===(p.clientAgencyName||"").toLowerCase() && m.date===p.date);
                                    if (m) setViewMeetingId(m.id);
                                  } else if (isFuture) {
                                    showToast(`This meeting is on ${p.date}. Come back on the day to log it.`);
                                  } else { setInlineLogPlan(isOpen?null:p.id); }
                                }}
                                style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:p.status==="Done"?`${C.green}08`:blocked?`${C.orange}06`:isFuture?C.s2:isOpen?`${C.accent}10`:C.s2,borderRadius:6,border:`1px solid ${p.status==="Done"?C.green+"33":blocked?C.orange+"44":isFuture?C.border:isOpen?C.accent+"55":C.border}`,cursor:isFuture?"default":"pointer",transition:"all .1s",opacity:isFuture?0.8:1}}>
                                <span style={{fontSize:10,color:C.dim,whiteSpace:"nowrap",marginTop:1}}>🕐 {p.time}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>{p.clientAgencyName}</div>
                                  {p.agenda&&<div style={{fontSize:10,color:C.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.agenda}</div>}
                                  {/* Blocker — what you need from whom */}
                                  {blocked&&<div style={{fontSize:10,color:C.orange,fontWeight:600,marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                                    <span>⏳</span>
                                    <span>Waiting on <strong>{linkedDeal.awaitingApproval}</strong>{dealNextStep?` · ${dealNextStep}`:""}</span>
                                  </div>}
                                  {/* Show deal nextStep even if not blocked — so rep knows what to do */}
                                  {!blocked&&dealNextStep&&p.status!=="Done"&&<div style={{fontSize:10,color:C.blue,marginTop:2}}>
                                    → {dealNextStep}
                                  </div>}
                                </div>
                                <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",flexShrink:0}}>
                                  {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.pitchType}</span>}
                                  {p.autoCreatedFrom==="follow-up"&&<span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>📞 Follow-up</span>}
                                  {p.autoCreatedFrom==="next-meeting"&&<span style={{background:`${C.green}22`,color:C.green,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>📅 Next Mtg</span>}
                                  <span style={{background:p.status==="Done"?`${C.green}22`:p.status==="Cancelled"?`${C.red}22`:blocked?`${C.orange}22`:isFuture?`${C.blue}18`:C.s3,color:p.status==="Done"?C.green:p.status==="Cancelled"?C.red:blocked?C.orange:isFuture?C.blue:C.dim,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>
                                    {p.status==="Done"?"Done":p.status==="Cancelled"?"Cancelled":blocked?"⏳ Blocked":isFuture?"📅 Upcoming":"Tap to log"}
                                  </span>
                                  {p.status!=="Done"&&!isFuture&&<span style={{fontSize:10,color:isOpen?C.accent:C.dim}}>{isOpen?"▲":"▼"}</span>}
                                </div>
                              </div>

                              {/* Info note for future meetings */}
                              {isFuture&&isOpen&&(
                                <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:5,padding:"8px 12px",marginTop:4,fontSize:11,color:C.blue}}>
                                  📅 Meeting is scheduled for <strong>{p.date}</strong>. You can log the outcome after the meeting happens.
                                </div>
                              )}

                              {/* Inline log form */}
                              {!isFuture&&isOpen&&(()=>{
                                // Auto-detect if deal is closed
                                const matchDealInline=deals.find(d=>d.repId===myRepId&&(d.clientCompany||"").toLowerCase()===p.clientAgencyName.toLowerCase())||deals.find(d=>d.repId===myRepId&&(d.clientCompany||"").toLowerCase().includes(p.clientAgencyName.toLowerCase().slice(0,5)));
                                const isClosed = matchDealInline?.outcome==="Proposal Accepted";
                                return (
                                <div style={{background:`${C.accent}06`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"14px 14px",marginTop:4}}>
                                  <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>Log This Meeting</div>

                                  {/* Autofilled from plan — shown read-only */}
                                  <div style={{background:C.s2,borderRadius:5,padding:"8px 10px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:C.dim}}>
                                    <span>🧑 {p.contactName||"—"}</span>
                                    {p.phone&&<span>📱 {p.phone}</span>}
                                    <span>{p.meetingType==="Online"?"💻":p.meetingType==="Phone Call"?"📞":"🤝"} {p.meetingType||"Physical"}</span>
                                    {p.needsMeet&&<span style={{color:"#4285F4",fontWeight:600}}>Google Meet scheduled</span>}
                                  </div>

                                  {/* What happened — mandatory */}
                                  <div style={{marginBottom:8}}>
                                    <label>What happened? * <span style={{color:C.red,fontWeight:400}}>(required)</span></label>
                                    <textarea rows={2} placeholder="What was discussed, how the client reacted..." id={`disc_${p.id}`} style={{fontSize:11,resize:"none"}} />
                                  </div>

                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                                    <div><label>Client Feedback</label><textarea rows={2} placeholder="Positive, hesitant, needs approval..." id={`fb_${p.id}`} style={{fontSize:11,resize:"none"}} /></div>
                                    <div>
                                      <label>Meeting Status *</label>
                                      <select id={`status_${p.id}`} style={{fontSize:11}}>
                                        {MEETING_STATUS.map(s=><option key={s}>{s}</option>)}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Next Steps — always mandatory */}
                                  <div style={{marginBottom:8}}>
                                    <label>Next Steps * <span style={{color:C.red,fontWeight:400}}>(required)</span></label>
                                    <input placeholder="What is the clear next action from this meeting?" id={`ns_${p.id}`} style={{fontSize:11}} />
                                  </div>

                                  {/* Follow-up + next meeting — hidden if deal is closed */}
                                  {!isClosed && (
                                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                                      <div><label>Follow-up Date</label><input type="date" id={`fu_${p.id}`} style={{fontSize:11}} /></div>
                                      <div><label>Next Meeting Date</label><input type="date" id={`nm_${p.id}`} style={{fontSize:11}} /></div>
                                    </div>
                                  )}

                                  {/* What do you need section */}
                                  {!isClosed && (
                                    <div style={{background:C.s2,borderRadius:6,padding:"10px 12px",marginBottom:10}}>
                                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8}}>What do you need?</div>
                                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
                                        <div>
                                          <label>Action needed</label>
                                          <select id={`action_${p.id}`} style={{fontSize:11}}>
                                            <option value="">Select…</option>
                                            <option>Send Proposal</option><option>Send FCT Grid</option><option>Get Rate Approval</option>
                                            <option>Get Budget Approval</option><option>Arrange Senior Meeting</option>
                                            <option>Share Digital Plan</option><option>Content Required</option>
                                            <option>Legal / Contract Review</option><option>Follow Up with Client</option><option>Other</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label>Who do you need it from?</label>
                                          <select id={`from_${p.id}`} style={{fontSize:11}}>
                                            <option value="">Needed from…</option>
                                            {APPROVAL_TARGETS.map(t=><option key={t}>{t}</option>)}
                                            <option value="Self">Myself</option><option value="Client">Client</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                        <div><label>By when do you need it?</label><input type="date" id={`bywhen_${p.id}`} style={{fontSize:11}} /></div>
                                        <div><label>Remarks</label><input placeholder="Any context..." id={`rmk_${p.id}`} style={{fontSize:11}} /></div>
                                      </div>
                                    </div>
                                  )}

                                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                                    <button onClick={()=>setInlineLogPlan(null)} className="btn btn-ghost" style={{fontSize:11}}>Cancel</button>
                                    <button className="btn btn-primary" style={{fontSize:11}} onClick={()=>{
                                      const disc = document.getElementById(`disc_${p.id}`)?.value||"";
                                      const fb   = document.getElementById(`fb_${p.id}`)?.value||"";
                                      const st   = document.getElementById(`status_${p.id}`)?.value||"Meeting Done";
                                      const ns   = document.getElementById(`ns_${p.id}`)?.value||"";
                                      const fu   = document.getElementById(`fu_${p.id}`)?.value||"";
                                      const nm   = document.getElementById(`nm_${p.id}`)?.value||"";
                                      const act  = document.getElementById(`action_${p.id}`)?.value||"";
                                      const frm  = document.getElementById(`from_${p.id}`)?.value||"";
                                      const bywhen = document.getElementById(`bywhen_${p.id}`)?.value||"";
                                      const rmk  = document.getElementById(`rmk_${p.id}`)?.value||"";
                                      if (!disc.trim()) { alert("Please fill in what happened"); return; }
                                      if (!ns.trim())  { alert("Next steps are required"); return; }
                                      const loggedAt = `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
                                      const newMeetId = `ml${Date.now()}`;
                                      setPlans(q=>q.map(pl=>pl.id===p.id?{...pl,status:"Done",loggedMeetingId:newMeetId}:pl));
                                      setMeetings(q=>[{id:newMeetId,repId:myRepId||(REPS[0]?.id),repName:REPS.find(r=>r.id===myRepId)?.name||"",region:REPS.find(r=>r.id===myRepId)?.region||"",clientCompany:p.clientAgencyName,contactName:p.contactName||"",phone:p.phone||"",date:TODAY,loggedAt,late:new Date().getHours()>=23,pitchType:p.pitchType||"",discussion:disc,clientFeedback:fb,status:st,nextSteps:ns,followUpDate:fu,nextMeetingDate:nm,meetingType:p.meetingType||"Physical",outcome:st==="Closed"?"Proposal Accepted":"Needs Callback",isUnplanned:false},...q]);
                                      if (act && frm && frm!=="Self"&&frm!=="Client") {
                                        const md=deals.find(d=>d.repId===myRepId&&(d.clientCompany||"").toLowerCase()===p.clientAgencyName.toLowerCase())||deals.find(d=>d.repId===myRepId&&(d.clientCompany||"").toLowerCase().includes(p.clientAgencyName.toLowerCase().slice(0,5)));
                                        setTasks(q=>[{id:`t${Date.now()}`,title:act,description:rmk,clientCompany:p.clientAgencyName,dealId:md?.id||null,assignedTo:null,repId:myRepId,dept:frm,priority:"High",status:"Open",dueDate:bywhen||fu||TOMORROW,createdAt:TODAY,assignedBy:myRepId,assignedByName:REPS.find(r=>r.id===myRepId)?.name||""},...q]);
                                        if(md) {
                                          // Route approval based on deal amount thresholds
                                          const amt = md.amount || 0;
                                          const routedTo = (frm === "NSH" || frm === "CXO")
                                            ? getRequiredApprover(amt)
                                            : frm;
                                          setDeals(q=>q.map(d=>d.id===md.id?{...d,
                                            awaitingApproval:routedTo,
                                            awaitingApprovalSince:TODAY,
                                            nextStep:ns,nextStepDate:bywhen||fu||TOMORROW,
                                            atRisk: daysSince(d.lastContact)>=7,
                                            auditLog:[...(d.auditLog||[]),{at:TODAY,by:"Rep",role:"SALES REP",action:"Flagged",from:null,to:routedTo,note:act}]
                                          }:d));
                                        }
                                      }
                                      // Auto-create calendar plans from follow-up / next-meeting / action due date
                                      const repIdForPlan = myRepId || (REPS[0]?.id);
                                      const ts = Date.now();
                                      const newAutoPlans: any[] = [];
                                      if (act && bywhen) {
                                        newAutoPlans.push({id:`p_ns_${ts}`,repId:repIdForPlan,date:bywhen,time:"10:00",clientAgencyName:p.clientAgencyName,contactName:p.contactName||"",phone:"",agenda:`${act}${frm?" → "+frm:""}`,pitchType:"",meetingType:"Task",needsMeet:false,status:"Planned",loggedMeetingId:null,isUnplanned:false,autoCreatedFrom:"next-step",assignedDept:frm||""});
                                      }
                                      if (nm) {
                                        newAutoPlans.push({id:`p_nxt_${ts+1}`,repId:repIdForPlan,date:nm,time:"10:00",clientAgencyName:p.clientAgencyName,contactName:p.contactName||"",phone:"",agenda:`Next meeting with ${p.clientAgencyName}`,pitchType:p.pitchType||"",meetingType:p.meetingType||"Physical",needsMeet:false,status:"Planned",loggedMeetingId:null,isUnplanned:false,autoCreatedFrom:"next-meeting"});
                                      }
                                      if (fu) {
                                        newAutoPlans.push({id:`p_fu_${ts+2}`,repId:repIdForPlan,date:fu,time:"10:00",clientAgencyName:p.clientAgencyName,contactName:p.contactName||"",phone:"",agenda:`Follow-up: ${ns||"Check in with client"}`,pitchType:p.pitchType||"",meetingType:"Call",needsMeet:false,status:"Planned",loggedMeetingId:null,isUnplanned:false,autoCreatedFrom:"follow-up"});
                                      }
                                      if (newAutoPlans.length > 0) setPlans(q=>[...q,...newAutoPlans]);
                                      setAtt(q=>({...q,[TODAY]:{...(q[TODAY]||{}),[(myRepId||REPS[0]?.id)]:true}}));
                                      setInlineLogPlan(null);
                                      const planCount = (act&&bywhen?1:0)+(nm?1:0)+(fu?1:0);
                                      showToast((act&&frm?"Meeting logged + task created ✓":"Meeting logged ✓")+(planCount>0?` · ${planCount} calendar entry added`:""));
                                    }}>Log Meeting ✓</button>
                                  </div>
                                </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* MONTHLY CALENDAR — full month, 3 meeting chips per day */}
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div>
                      <div className="sans" style={{fontSize:14,fontWeight:700}}>
                        {new Date(Date.now() + calWeekOffset * 28 * 86400000).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}
                      </div>
                      <div style={{fontSize:10,color:weeklyDiffMs<=0?C.red:C.blue,fontWeight:600,marginTop:2}}>Weekly plan: {weeklyLabel}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <button onClick={()=>setCalWeekOffset(p=>p-1)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:C.dim,cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace"}}>←</button>
                      <button onClick={()=>setCalWeekOffset(0)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:calWeekOffset===0?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>Today</button>
                      <button onClick={()=>setCalWeekOffset(p=>p+1)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 10px",color:C.dim,cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace"}}>→</button>
                    </div>
                  </div>

                  {/* Build month grid */}
                  {(() => {
                    // Find the month to show based on calWeekOffset (in units of 4 weeks)
                    const ref = new Date(Date.now() + calWeekOffset * 28 * 86400000);
                    const monthYear = new Date(ref.getFullYear(), ref.getMonth(), 1);
                    const daysInMonth = new Date(ref.getFullYear(), ref.getMonth()+1, 0).getDate();

                    // Monday-first grid: pad start
                    const firstDow = (monthYear.getDay() + 6) % 7; // 0=Mon
                    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
                    const cells = Array.from({length: totalCells}, (_, i) => {
                      const dayNum = i - firstDow + 1;
                      if (dayNum < 1 || dayNum > daysInMonth) return null;
                      const y = ref.getFullYear();
                      const m = String(ref.getMonth() + 1).padStart(2, "0");
                      const dd = String(dayNum).padStart(2, "0");
                      return `${y}-${m}-${dd}`;
                    });
                    const weeks = [];
                    for (let w = 0; w < cells.length / 7; w++) weeks.push(cells.slice(w*7, w*7+7));
                    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

                    return (
                      <div>
                        {/* Day headers */}
                        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                          {dayNames.map(d=>(
                            <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",padding:"3px 0"}}>{d}</div>
                          ))}
                        </div>
                        {/* Week rows */}
                        {weeks.map((week, wi) => (
                          <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                            {week.map((date, di) => {
                              if (!date) return <div key={di} style={{background:C.s2,borderRadius:6,opacity:.3,minHeight:120}} />;
                              const dayPlans = allPlans.filter(p=>(myRepId?p.repId===myRepId:true)&&p.date===date);
                              const isToday = date===TODAY;
                              const isTmrw  = date===TOMORROW;
                              const isPast  = date<TODAY;
                              return (
                                <div key={date} onClick={()=>setCalDayView(date)}
                                  style={{background:isToday?`${C.accent}08`:C.surface,border:`1px solid ${isToday?C.accent:isTmrw?C.blue:C.border}`,borderRadius:6,minHeight:140,display:"flex",flexDirection:"column",cursor:"pointer",transition:"border-color .1s"}}
                                  onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;}}
                                  onMouseOut={e=>{e.currentTarget.style.borderColor=isToday?C.accent:isTmrw?C.blue:C.border;}}>
                                  {/* Day number row */}
                                  <div style={{padding:"3px 6px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${isToday?C.accent+"33":C.s2}`}}>
                                    <span style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?C.accent:isPast?C.muted:C.text}}>{new Date(date).getDate()}</span>
                                    {!isPast&&dayPlans.length===0&&<span style={{fontSize:10,color:C.muted,lineHeight:1}}>+</span>}
                                    {dayPlans.length>0&&<span style={{fontSize:8,color:C.dim}}>{dayPlans.length}</span>}
                                  </div>
                                  {/* Up to 3 meeting chips */}
                                  <div style={{flex:1,padding:"3px 4px",overflow:"hidden"}}>
                                    {dayPlans.slice(0,4).map(p=>{
                                      const chipColor = p.status==="Done"?C.green:p.status==="Cancelled"?C.red:p.autoCreatedFrom==="follow-up"?C.blue:p.autoCreatedFrom==="next-meeting"?C.green:p.autoCreatedFrom==="next-step"?C.orange:C.accent;
                                      const typeLabel = p.autoCreatedFrom==="follow-up"?"Call":p.autoCreatedFrom==="next-meeting"?"Mtg":p.autoCreatedFrom==="next-step"?"Action":p.meetingType==="Phone Call"?"Call":p.meetingType==="Online"?"Online":"Visit";
                                      return (
                                      <div key={p.id}
                                        onClick={e=>{e.stopPropagation();if(p.status!=="Done"){planInlineState[1](p.id);}}}
                                        style={{background:p.status==="Done"?`${C.green}18`:p.status==="Cancelled"?`${C.red}10`:`${chipColor}14`,borderRadius:3,padding:"2px 4px",marginBottom:2,cursor:"pointer"}}
                                        title={`${p.time} · ${p.clientAgencyName}${p.agenda?" · "+p.agenda:""}`}>
                                        {/* Time + type */}
                                        <div style={{fontSize:7,color:C.dim,lineHeight:1,display:"flex",gap:2,alignItems:"center"}}>
                                          {p.time}
                                          {p.autoCreatedFrom==="follow-up"&&<span style={{color:C.blue,fontWeight:700}}>📞</span>}
                                          {p.autoCreatedFrom==="next-meeting"&&<span style={{color:C.green,fontWeight:700}}>📅</span>}
                                          {p.autoCreatedFrom==="next-step"&&<span style={{color:C.orange,fontWeight:700}}>⚡</span>}
                                          <span style={{color:chipColor,opacity:.8}}>{typeLabel}</span>
                                        </div>
                                        {/* Client name */}
                                        <div style={{fontSize:8,color:chipColor,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2}}>
                                          {p.clientAgencyName}
                                        </div>
                                        {/* Agenda — the key context line */}
                                        {p.agenda&&<div style={{fontSize:7,color:C.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2,marginTop:1}}>
                                          {p.agenda}
                                        </div>}
                                      </div>
                                      );
                                    })}
                                    {dayPlans.length>4&&<div style={{fontSize:7,color:C.dim,textAlign:"center"}}>+{dayPlans.length-4} more</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* DAY VIEW MODAL */}
                {calDayView&&(()=>{
                  const dvDate = calDayView;
                  const dvPlans = allPlans.filter(p=>(myRepId?p.repId===myRepId:true)&&p.date===dvDate).sort((a,b)=>a.time.localeCompare(b.time));
                  const dvIsPast = dvDate < TODAY;
                  const dvLabel = new Date(dvDate+"T12:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
                  const hours = Array.from({length:24},(_,i)=>i);
                  const planAtHour = (h) => dvPlans.filter(p=>{const ph=parseInt((p.time||"00:00").split(":")[0]);return ph===h;});
                  const usedHours = new Set(dvPlans.map(p=>parseInt((p.time||"00:00").split(":")[0])));
                  return (
                    <div className="overlay" onClick={()=>setCalDayView(null)}>
                      <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:580,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexShrink:0}}>
                          <div>
                            <div className="sans" style={{fontSize:16,fontWeight:700,color:C.text}}>{dvLabel}</div>
                            <div style={{fontSize:11,color:C.dim,marginTop:2}}>
                              {dvPlans.length===0?"No meetings — day is open":dvPlans.length===1?"1 meeting planned":`${dvPlans.length} meetings planned`}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            {!dvIsPast&&<button className="btn btn-primary" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>{setCalDayView(null);setAddPlanFor(dvDate);}}>+ Add Meeting</button>}
                            <button onClick={()=>setCalDayView(null)} style={{background:"transparent",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
                          </div>
                        </div>

                        {/* Time slot grid */}
                        <div style={{overflowY:"auto",flex:1}}>
                          {hours.map(h=>{
                            const slotPlans = planAtHour(h);
                            const isOccupied = usedHours.has(h);
                            const timeLabel = `${String(h).padStart(2,"0")}:00`;
                            return (
                              <div key={h} style={{display:"flex",gap:0,minHeight:48,borderBottom:`1px solid ${C.s2}`}}>
                                {/* Hour label */}
                                <div style={{width:48,flexShrink:0,padding:"6px 8px 0",fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{timeLabel}</div>
                                {/* Slot content */}
                                <div style={{flex:1,padding:"4px 8px",background:isOccupied?`${C.accent}05`:"transparent",cursor:!dvIsPast?"pointer":"default",transition:"background .1s"}}
                                  onMouseEnter={e=>{if(!dvIsPast)(e.currentTarget as HTMLDivElement).style.background=`${C.accent}0a`;}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=isOccupied?`${C.accent}05`:"transparent";}}
                                  onClick={()=>{
                                    if(!dvIsPast){
                                      const preTime=`${String(h).padStart(2,"0")}:00`;
                                      setPf(p=>({...p,time:preTime}));
                                      setCalDayView(null);
                                      setAddPlanFor(dvDate);
                                    }
                                  }}>
                                  {slotPlans.length===0&&!dvIsPast&&(
                                    <div style={{fontSize:10,color:C.s3,lineHeight:"38px",paddingLeft:4,userSelect:"none"}}>+ click to add</div>
                                  )}
                                  {slotPlans.map(p=>{
                                    const statusClr = p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent;
                                    const typeTag = p.autoCreatedFrom==="follow-up"?"📞 Follow-up":p.autoCreatedFrom==="next-meeting"?"📅 Next Mtg":p.autoCreatedFrom==="next-step"?"⚡ Action":null;
                                    return (
                                      <div key={p.id}
                                        onClick={e=>{
                                          e.stopPropagation();
                                          if(p.status==="Done"){
                                            const m=meetings.find(m=>m.id===p.loggedMeetingId)||meetings.find(m=>m.repId===myRepId&&(m.clientCompany||"").toLowerCase()===(p.clientAgencyName||"").toLowerCase()&&m.date===p.date);
                                            if(m){setCalDayView(null);setViewMeetingId(m.id);}
                                          } else {
                                            setCalDayView(null);setInlineLogPlan(p.id);
                                          }
                                        }}
                                        style={{background:p.status==="Done"?`${C.green}14`:`${C.accent}14`,border:`1px solid ${statusClr}44`,borderLeft:`3px solid ${statusClr}`,borderRadius:4,padding:"5px 10px",marginBottom:4,cursor:"pointer"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                                          <div style={{flex:1,minWidth:0}}>
                                            <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.clientAgencyName}</div>
                                            {p.agenda&&<div style={{fontSize:10,color:C.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.agenda}</div>}
                                          </div>
                                          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                                            {typeTag&&<span style={{fontSize:9,color:statusClr,fontWeight:700}}>{typeTag}</span>}
                                            {p.pitchType&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600}}>{p.pitchType}</span>}
                                            <span style={{background:`${statusClr}22`,color:statusClr,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700}}>
                                              {p.status==="Done"?"Done":p.status==="Cancelled"?"Cancelled":(p.date>TODAY?"📅 Upcoming":"Tap to log")}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {!dvIsPast&&(
                          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,flexShrink:0,textAlign:"center"}}>
                            <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>{setCalDayView(null);setAddPlanFor(dvDate);}}>+ Add a meeting for this day</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Plan modal */}
                {addPlanFor&&(
                  <div className="overlay" onClick={()=>setAddPlanFor(null)}>
                    <div className="modal fin" onClick={e=>e.stopPropagation()} style={{width:460}}>
                      <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:14}}>
                        Plan meeting · {new Date(addPlanFor).toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>

                        {/* Client / Agency — dropdown from existing deals + free text */}
                        <div>
                          <label>Client / Agency *</label>
                          <div style={{display:"flex",gap:6}}>
                            <select value={pf.clientAgencyName} onChange={e=>setPf(p=>({...p,clientAgencyName:e.target.value}))} style={{flex:1}}>
                              <option value="">Select from your pipeline…</option>
                              {[...new Set(deals.filter(d=>d.repId===myRepId).map(d=>d.clientCompany))].sort().map(c=>(
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <input placeholder="Or type new client" value={pf.clientAgencyName} onChange={e=>setPf(p=>({...p,clientAgencyName:e.target.value}))} style={{flex:1}} />
                          </div>
                        </div>

                        {/* Contact person */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <div><label>Contact Person Name *</label><input placeholder="Who are you meeting?" value={pf.contactName} onChange={e=>setPf(p=>({...p,contactName:e.target.value}))} autoFocus /></div>
                          <div><label>Phone Number</label><input placeholder="Mobile number" value={pf.phone} onChange={e=>setPf(p=>({...p,phone:e.target.value}))} /></div>
                        </div>

                        {/* Time */}
                        <div><label>Meeting Time</label><input type="time" value={pf.time} onChange={e=>setPf(p=>({...p,time:e.target.value}))} /></div>

                        {/* Meeting type toggle */}
                        <div>
                          <label>Meeting Type</label>
                          <div style={{display:"flex",gap:6,marginTop:4}}>
                            {[{id:"Physical",icon:"🤝"},{id:"Online",icon:"💻"},{id:"Phone Call",icon:"📞"}].map(mt=>(
                              <button key={mt.id} onClick={()=>setPf(p=>({...p,meetingType:mt.id,needsMeet:mt.id!=="Online"?false:p.needsMeet}))}
                                style={{flex:1,padding:"7px 6px",fontSize:11,borderRadius:5,border:`1px solid ${pf.meetingType===mt.id?C.accent:C.border}`,background:pf.meetingType===mt.id?`${C.accent}18`:"transparent",color:pf.meetingType===mt.id?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",textAlign:"center"}}>
                                {mt.icon} {mt.id}
                              </button>
                            ))}
                          </div>
                          {/* Google Meet option — only for Online */}
                          {pf.meetingType==="Online" && (
                            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"8px 10px",background:"#4285F418",border:"1px solid #4285F444",borderRadius:5}}>
                              <button onClick={()=>setPf(p=>({...p,needsMeet:!p.needsMeet}))}
                                style={{width:16,height:16,borderRadius:3,border:`1px solid ${pf.needsMeet?"#4285F4":C.border}`,background:pf.needsMeet?"#4285F4":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,flexShrink:0,fontFamily:"'DM Mono',monospace"}}>
                                {pf.needsMeet?"✓":""}
                              </button>
                              <span style={{fontSize:12,color:"#4285F4",fontWeight:600}}>Schedule Google Meet link</span>
                              <span style={{fontSize:10,color:C.dim}}>(will be set up when deployed)</span>
                            </div>
                          )}
                        </div>

                        {/* Agenda */}
                        <div><label>Agenda — what are you going in for?</label><input placeholder="e.g. Present Q2 FCT grid" value={pf.agenda} onChange={e=>setPf(p=>({...p,agenda:e.target.value}))} /></div>

                        {/* Pitch Type */}
                        <div>
                          <label>Pitch Type</label>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
                            {PITCH_TYPES.map(pt=>(
                              <button key={pt} onClick={()=>setPf(p=>({...p,pitchType:pt}))} style={{padding:"3px 9px",fontSize:10,borderRadius:4,border:`1px solid ${pf.pitchType===pt?C.accent:C.border}`,background:pf.pitchType===pt?`${C.accent}18`:"transparent",color:pf.pitchType===pt?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{pt}</button>
                            ))}
                          </div>
                        </div>

                        {/* Calendar sync */}
                        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:2}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <button onClick={()=>setPf(p=>({...p,syncToCalendar:!p.syncToCalendar,calPlatform:p.calPlatform||(loginProvider==="zoho"?"zoho":loginProvider==="google"?"google":"google")}))}
                              style={{width:16,height:16,borderRadius:3,border:`1px solid ${pf.syncToCalendar?"#4285F4":C.border}`,background:pf.syncToCalendar?"#4285F4":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,flexShrink:0}}>
                              {pf.syncToCalendar?"✓":""}
                            </button>
                            <span style={{fontSize:12,color:pf.syncToCalendar?C.text:C.dim,fontWeight:600}}>Also add to my calendar</span>
                            {loginProvider==="google"&&!pf.syncToCalendar&&<span style={{fontSize:10,color:C.dim}}>(Google Calendar recommended)</span>}
                            {loginProvider==="zoho"&&!pf.syncToCalendar&&<span style={{fontSize:10,color:C.dim}}>(Zoho Calendar recommended)</span>}
                          </div>
                          {pf.syncToCalendar&&(
                            <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
                              {[
                                {id:"google",  label:"Google Calendar", icon:"📅", color:"#4285F4"},
                                {id:"zoho",    label:"Zoho Calendar",   icon:"📆", color:"#e42527"},
                                {id:"outlook", label:"Outlook",          icon:"📧", color:"#0078D4"},
                              ].map(cp=>(
                                <button key={cp.id}
                                  onClick={()=>setPf(p=>({...p,calPlatform:cp.id}))}
                                  style={{padding:"5px 12px",fontSize:11,borderRadius:5,border:`1px solid ${pf.calPlatform===cp.id?cp.color:C.border}`,background:pf.calPlatform===cp.id?`${cp.color}18`:"transparent",color:pf.calPlatform===cp.id?cp.color:C.dim,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                                  {cp.icon} {cp.label}
                                </button>
                              ))}
                              <span style={{fontSize:10,color:C.muted,lineHeight:"28px",paddingLeft:4}}>Opens in new tab</span>
                            </div>
                          )}
                        </div>

                      </div>
                      <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
                        <button className="btn btn-ghost" onClick={()=>setAddPlanFor(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={()=>doAddPlan(addPlanFor)} disabled={!pf.clientAgencyName.trim()||!pf.contactName.trim()}>Plan This Meeting</button>
                      </div>
                    </div>
                  </div>
                )}
                </>}
              </div>
            );
          })()}

          {/* ═══ RH WAR ROOM (Region Head) ═══ */}
          {view==="warroom" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = REPS.filter(r => r.region === rhRegion);
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
            const rhC  = rhDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const rhP  = rhDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct= rhT>0?Math.round((rhC/rhT)*100):0;
            const rhAtRisk = rhDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
            const rhOverdue = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted");
            const totalActions = myApprovals.length + myTasks_rh.length;

            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WAR ROOM</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short"})}</div>
                  </div>
                </div>

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
                    const rep = REPS.find(r=>r.id===d.repId);
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
                    const rep = REPS.find(r=>r.id===t.repId);
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
                  const staleDeals   = rhDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                  const overdueSteps = rhDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted");
                  const highRiskBig  = rhDeals.filter(d=>d.amount>=5000000&&!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=5);
                  const repPcts      = myReps.map(r=>{
                    const rd=rhDeals.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
                        const rC  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
                        const rP  = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                        const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const rPct= rT>0?Math.round((rC/rT)*100):0;
                        const rRisk = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                        const rOverdue = rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted");
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

                {/* Team at-risk deals */}
                {rhAtRisk.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>NO CONTACT 7+ DAYS — TEAM AT RISK</div>
                    {rhAtRisk.slice(0,4).map(d=>{
                      const rep=REPS.find(r=>r.id===d.repId);
                      return (
                        <div key={d.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:6,padding:"9px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{flex:1}}><strong>{d.clientCompany}</strong><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span></span>
                          <span style={{color:C.red,fontSize:11}}>{daysSince(d.lastContact)}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                        </div>
                      );
                    })}
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
                        const rep=REPS.find(r=>r.id===d.repId);
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
                    const rep=REPS.find(r=>r.id===p.repId);
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
            const rhC = rhDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const rhP = rhDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const rhPct = rhT>0?Math.round((rhC/rhT)*100):0;
            const sc = rhPct>=80?C.green:rhPct>=50?C.accent:C.red;

            // All clients sorted by gap (biggest gap = least achieved vs target = top of list)
            const clientRows = rhDeals
              .filter(d=>d.outcome!=="Not Interested")
              .map(d=>{
                const ach = d.outcome==="Proposal Accepted"?d.amount:0;
                const gap = Math.max(0,(d.targetAmount||0)-ach);
                const pct = d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                const rep = REPS.find(r=>r.id===d.repId);
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

          {/* ═══ RH ESCALATIONS (Region Head — escalations directed to RH/NSH) ═══ */}
          {view==="rh-escalations" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myRepIds = REPS.filter(r=>r.region===rhRegion).map(r=>r.id);

            // Deals awaiting NSH/RH approval from this region
            const pendingApprovals = visibleDeals.filter(d=>
              d.awaitingApproval === "NSH" &&
              d.awaitingApprovalSince &&
              myRepIds.includes(d.repId)
            );
            // Tasks assigned with dept=NSH from this region's reps
            const pendingTasks = tasks.filter(t=>
              t.dept==="NSH" && t.status!=="Done" && myRepIds.includes(t.repId)
            );
            // Overdue next steps in region
            const overdueInRegion = visibleDeals.filter(d=>
              d.nextStepDate && d.nextStepDate<TODAY && d.outcome!=="Proposal Accepted" && myRepIds.includes(d.repId)
            );
            // Internal Requests directed to this RH from their reps
            const rhIncomingIRs = internalReqs.filter(r=>
              r.dept==="Region Head" &&
              r.status!=="Done" && r.status!=="Withdrawn" &&
              USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion
            );

            const total = pendingApprovals.length + pendingTasks.length + rhIncomingIRs.length;

            return (
              <div className="fin">
                <div style={{marginBottom:16}}>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · Items directed to you that need a decision</div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
                  {[
                    {label:"REQUESTS TO YOU",   value:rhIncomingIRs.length,    color:C.accent},
                    {label:"PENDING APPROVALS",  value:pendingApprovals.length, color:C.orange},
                    {label:"TASKS FOR YOU",       value:pendingTasks.length,    color:C.blue},
                    {label:"OVERDUE IN REGION",   value:overdueInRegion.length, color:C.red},
                  ].map(k=>(
                    <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                      <div className="sans" style={{fontSize:26,fontWeight:700,color:k.color}}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {total===0&&overdueInRegion.length===0&&(
                  <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:8}}>✓</div>
                    <div className="sans" style={{fontWeight:700,color:C.green,marginBottom:4}}>No escalations</div>
                    <div style={{fontSize:11,color:C.dim}}>All items in {rhRegion} are on track.</div>
                  </div>
                )}

                {/* Incoming requests from reps directed to this RH */}
                {rhIncomingIRs.length>0&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📥 Requests to You from Your Team</div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Rep","Type","Subject","Client","Raised","Status","Action"].map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}</tr></thead>
                        <tbody>
                          {rhIncomingIRs.map(r=>(
                            <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}}>
                              <td style={{padding:"10px 14px",fontWeight:600,fontSize:12}}>{r.raisedByName}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.type}</span></td>
                              <td style={{padding:"10px 14px",maxWidth:200,fontSize:12}}>{r.subject}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{r.clientCompany||"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{r.raisedAt}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${r.status==="Pending"?C.orange:r.status==="Overdue"?C.red:C.blue}18`,color:r.status==="Pending"?C.orange:r.status==="Overdue"?C.red:C.blue,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.status}</span></td>
                              <td style={{padding:"10px 14px",whiteSpace:"nowrap",display:"flex",gap:4}}>
                                <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"In Progress",resolverNote:"Acknowledged by "+user_role?.name}:x))}
                                  style={{background:`${C.blue}18`,color:C.blue,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Accept</button>
                                <button onClick={()=>setInternalReqs(p=>p.map(x=>x.id===r.id?{...x,status:"Done",resolvedAt:TODAY,resolverNote:"Resolved by "+user_role?.name}:x))}
                                  style={{background:`${C.green}18`,color:C.green,border:"none",borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600}}>Done</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pending approvals */}
                {pendingApprovals.length>0&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⏳ Awaiting Your Approval</div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Client","Rep","Amount","Waiting","Days","Stage","Action"].map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}</tr></thead>
                        <tbody>
                          {pendingApprovals.map(d=>{
                            const rep=REPS.find(r=>r.id===d.repId);
                            const dw=daysSince(d.awaitingApprovalSince);
                            return (
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:dw>=APPROVAL_SLA_DAYS?`${C.red}04`:`${C.orange}04`}}
                                onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                onMouseOut={e=>e.currentTarget.style.background=dw>=APPROVAL_SLA_DAYS?`${C.red}04`:`${C.orange}04`}>
                                <td style={{padding:"10px 14px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>NSH</span></td>
                                <td style={{padding:"10px 14px",color:dw>=APPROVAL_SLA_DAYS?C.red:C.orange,fontWeight:700}}>{dw}d</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                  <button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()}
                                    style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginRight:4}}>Approve</button>
                                  <button onClick={()=>setView("pipeline")}
                                    style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>View</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tasks for RH */}
                {pendingTasks.length>0&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 Tasks Requiring Your Action</div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Task","From Rep","Client","Priority","Due","Update"].map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}</tr></thead>
                        <tbody>
                          {pendingTasks.map(t=>{
                            const rep=REPS.find(r=>r.id===t.repId);
                            const overdue=t.dueDate<TODAY;
                            return (
                              <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}}
                                onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}>
                                <td style={{padding:"10px 14px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                                <td style={{padding:"10px 14px"}}><span style={{background:t.priority==="High"?`${C.red}18`:`${C.orange}18`,color:t.priority==="High"?C.red:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.priority}</span></td>
                                <td style={{padding:"10px 14px",color:overdue?C.red:C.dim,fontSize:11}}>{t.dueDate}</td>
                                <td style={{padding:"10px 14px"}}>
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

                {/* Overdue next steps in region */}
                {overdueInRegion.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⚠ Overdue Next Steps in Region</div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Client","Rep","Next Step","Was Due","Amount"].map(h=>(
                          <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}</tr></thead>
                        <tbody>
                          {overdueInRegion.map(d=>{
                            const rep=REPS.find(r=>r.id===d.repId);
                            return (
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                                onMouseOver={e=>e.currentTarget.style.background=C.s2}
                                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:180,whiteSpace:"normal"}}>{d.nextStep||"—"}</td>
                                <td style={{padding:"10px 14px",color:C.red,fontWeight:600}}>{d.nextStepDate}</td>
                                <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
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

          {/* ═══ NSH WAR ROOM ═══ */}
          {view==="warroom" && isNSHDashboard && (()=>{
            const allD = deals.filter(d=>qMatch(d.quarter));
            const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC = allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const totP = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
            const totW = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
            const forecast = totC + totW;
            const gap = Math.max(0, totT - forecast);
            const closePct  = totT>0?Math.round((totC/totT)*100):0;
            const fcastPct  = totT>0?Math.round((forecast/totT)*100):0;
            const fsc = fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red;

            // Region-wise breakdown
            const regions = ["National","North","South","East","West"];
            const regionStats = regions.map(r=>{
              const rd = allD.filter(d=>d.region===r);
              const rT = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rC = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
              const rPct = rT>0?Math.round((rC/rT)*100):0;
              const rRisk = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
              return {region:r, rT, rC, rPct, rRisk};
            });

            // High-risk deals — highest target, lowest achievement %
            const highRisk = allD
              .filter(d=>d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested")
              .map(d=>{
                const pct = d.targetAmount>0?Math.round(((d.outcome==="Proposal Accepted"?d.amount:0)/d.targetAmount)*100):0;
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
                      const totC = allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                      const totT = allD.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const blocked = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted");
                      const atRiskD = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7);
                      const nonCompliant = REPS.filter(r=>!att[TODAY]?.[r.id]);
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
                        ...atRiskD.slice(0,5).map(d=>{const r=REPS.find(x=>x.id===d.repId);return`  • ${d.clientCompany} — ${r?.name||""} (${daysSince(d.lastContact)}d idle)`;}),
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
                        const pipeline  = allD.filter(d=>d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
                        const projection = achieved + pipeline;
                        return [["Linear TV","Linear TV"],["IPs","IPs"],["Digital","Digital"],["Media Solutions","Media Solutions"],["Integrated Packages","Integrated Packages"]].map(([label,type])=>{
                          const td = allD.filter(d=>d.dealType===type);
                          const t  = td.reduce((s,d)=>s+(d.targetAmount||0),0);
                          const a  = revenueEntries.filter(e=>e.dealType===type&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
                          const p  = td.filter(d=>d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested").reduce((s,d)=>s+(d.amount||0)*(STAGE_PROB[d.outcome]||0)/100,0);
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
                          const reps = REPS;
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
                        {label:"Sales Executives",  depts:REPS.map(r=>String(r.id))},
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
                    {label:"Deals Awaiting NSH", val:deals.filter(d=>d.awaitingApproval==="NSH"&&d.outcome!=="Proposal Accepted").length, color:C.purple},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"12px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                      <div className="sans" style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* ── DYNAMIC ANALYSIS ── */}
                {(()=>{
                  const activeD  = allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome));
                  const closedD  = allD.filter(d=>d.outcome==="Proposal Accepted");

                  // National-level signals
                  const staleNational  = activeD.filter(d=>daysSince(d.lastContact)>=7);
                  const bigStale       = staleNational.filter(d=>d.targetAmount>=5000000);
                  const overdueNational= allD.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted");
                  const closingSoon    = activeD.filter(d=>["Very Interested","Interested – Needs Revision"].includes(d.outcome)&&d.nextStepDate&&d.nextStepDate<=TOMORROW);
                  const pendingNSH     = targetSubs.filter(t=>t.status==="Pending NSH");
                  const blockedDeals   = allD.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted");

                  // Region-level analysis
                  const GEOS = ["North","South","East","West","Odisha"];
                  const regionAnalysis = GEOS.map(reg=>{
                    const rd  = allD.filter(d=>d.region===reg);
                    const rT  = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const rC  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                    const rPct= rT>0?Math.round((rC/rT)*100):null;
                    const hasDigital = rd.some(d=>d.dealType==="Digital"&&d.outcome!=="Not Interested");
                    return {reg, rT, rC, rPct, hasDigital, count:rd.length};
                  });
                  const laggingRegions  = regionAnalysis.filter(r=>r.rPct!==null&&r.rPct<40);
                  const noDigitalRegions= regionAnalysis.filter(r=>r.count>0&&!r.hasDigital);

                  // Rep-level signals
                  const repPcts = REPS.map(r=>{
                    const rd=allD.filter(d=>d.repId===r.id);
                    const t=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                    const c=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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

              {/* REP ACTION ITEMS — only for sales reps */}
              {isRep && (()=>{
                const myRepId = user_role?.repId;
                const myDeals = visibleDeals.filter(d=>d.repId===myRepId);
                const myOverdue = myDeals.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted");
                const myAtRisk  = myDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&(d.atRisk||daysSince(d.lastContact)>=7));
                const myBlocked = myDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted");
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

              {/* KPIs — 4 clean cards for management, 3 for reps */}
              <div style={{display:"grid",gridTemplateColumns:isRep?"repeat(3,1fr)":"repeat(5,1fr)",gap:10,marginBottom:16}}>
                {(isRep ? [
                  {label:"MY CLOSED QTD",   value:fmtR(visibleDeals.filter(d=>d.repId===user_role?.repId&&d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0)), color:C.green},
                  {label:"MY PIPELINE",     value:fmtR(visibleDeals.filter(d=>d.repId===user_role?.repId&&!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0)), color:C.accent},
                  {label:"MY OPEN ACTIONS", value:tasks.filter(t=>t.assignedTo===user_role?.repId&&t.status!=="Done").length, color:C.blue},
                ] : [
                  {label:"CLOSED QTD",    value:fmtR(totalClosed),     sub:`${closePct}% of target`, color:C.green,  bar:closePct},
                  {label:"FORECAST",      value:fmtR(forecast),         sub:`${fcastPct}% likely`,    color:fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red, bar:fcastPct},
                  {label:"GAP TO TARGET", value:fmtR(gap),             sub:gap===0?"on track":"uncovered", color:gap===0?C.green:C.red},
                  {label:"AT RISK",       value:atRisk.length,          sub:`${fmtR(atRisk.reduce((s,d)=>s+d.amount,0))} at stake`, color:atRisk.length>0?C.red:C.green},
                  {label:"OVERDUE",       value:overdueNext.length,     sub:"next steps past due",    color:overdueNext.length>0?C.orange:C.green},
                ]).map(k=>(
                  <div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
                    <div className="sans" style={{fontSize:21,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    {k.sub&&<div style={{fontSize:10,color:C.dim,marginTop:4}}>{k.sub}</div>}
                    {k.bar!=null&&<div className="pbar" style={{marginTop:7}}><div className="pfill" style={{width:`${Math.min(k.bar,100)}%`,background:k.color}} /></div>}
                  </div>
                ))}
              </div>

              {/* MANAGEMENT SECTIONS — hidden from reps */}
              {!isRep && (
                <div>
                  {/* At risk */}
                  {atRisk.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>NO CONTACT 7+ DAYS</div>
                      {atRisk.map(d=>{const rep=REPS.find(r=>r.id===d.repId);return(
                        <div key={d.id} style={{background:`${C.red}06`,border:`1px solid ${C.red}22`,borderRadius:5,padding:"9px 14px",marginBottom:5,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{flex:1}}><span className="sans" style={{fontWeight:700}}>{d.clientCompany}</span><span style={{color:C.dim,fontSize:11}}> · {rep?.name}</span><span className="pill" style={{background:`${oColor(d.outcome)}22`,color:oColor(d.outcome),marginLeft:8,fontSize:10}}>{d.outcome}</span></div>
                          <span style={{color:C.red,fontSize:11,whiteSpace:"nowrap"}}>{daysSince(d.lastContact)}d idle</span>
                          <span style={{color:C.accent,fontWeight:700}}>{fmtR(d.amount)}</span>
                          <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                            {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                          </select>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* Overdue next steps */}
                  {overdueNext.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",marginBottom:7}}>OVERDUE NEXT STEPS</div>
                      {overdueNext.map(d=>{const rep=REPS.find(r=>r.id===d.repId);return(
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
                      {visibleDeals.filter(d=>["Very Interested","Proposal Accepted"].includes(d.outcome)).sort((a,b)=>b.amount-a.amount).slice(0,4).map(d=>{
                        const rep=REPS.find(r=>r.id===d.repId);
                        return(
                          <div key={d.id} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.s2}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                              <span className="sans" style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</span>
                              <span style={{color:C.green,fontWeight:700,fontSize:12}}>{fmtR(d.amount)}</span>
                            </div>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:10,color:C.dim}}>{rep?.name}</span>
                              <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{fontSize:10,padding:"1px 5px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:3,color:C.text,marginLeft:"auto"}}>
                                {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="card" style={{padding:14}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:9}}>COMPLIANCE — TODAY · 11:30 PM</div>
                      {REPS.filter(r=>user_role.canView==="all"?true:user_role.canView==="region"?r.region===user_role.region:r.id===user_role.repId).map(r=>{
                        const tL=meetings.some(m=>m.repId===r.id&&m.date===TODAY)||(plans_crm||plans||[]).some(p=>p.repId===r.id&&p.date===TODAY&&p.status==="Done");
                        const tP=(plans_crm||plans||[]).some(p=>p.repId===r.id&&p.date===TOMORROW&&p.status==="Planned");
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
                    {id:"accounts",    label:"Accounts",            sub:"All clients"},
                    {id:"linear-tv",   label:"Linear TV",           sub:"TV deals"},
                    {id:"properties",  label:"IPs",                 sub:"IP inventory"},
                    {id:"digital",     label:"Digital",             sub:"Online deals"},
                    {id:"brand",       label:"Media Solutions",     sub:"Custom packages"},
                    {id:"integrated",  label:"Integrated Packages", sub:"Multi-platform"},
                  ]).map(t=>(
                    <button key={t.id} onClick={()=>setRtTab(t.id)}
                      style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:rtTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",color:rtTab===t.id?C.accent:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:rtTab===t.id?700:400,textAlign:"left",whiteSpace:"nowrap"}}>
                      <div>{t.label}</div>
                      <div style={{fontSize:9,color:C.muted,marginTop:1}}>{t.sub}</div>
                    </button>
                  ))}
                </div>

                {/* ── ACCOUNTS TAB ── */}
                {rtTab==="accounts" && (
                  <div>
                    {rtClients.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>No accounts yet. Add a deal to get started.</div>}
                    {rtClients.map(c=>{
                      const rep = REPS.find(r=>r.id===c.repId);
                      const idle = daysSince(c.lastContact);
                      const idleColor = idle>=7?C.red:idle>=3?C.orange:C.green;
                      const pct = c.target>0?Math.round((c.total/c.target)*100):0;
                      const openDeals = c.deals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome));
                      const blocked = c.deals.filter(d=>d.awaitingApproval);
                      return (
                        <div key={c.clientCompany} className="card" style={{marginBottom:10,padding:"14px 18px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                <span className="sans" style={{fontSize:15,fontWeight:700}}>{c.clientCompany}</span>
                                {idle>=7&&<span style={{background:`${C.red}22`,color:C.red,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>COLD {idle}d</span>}
                                {blocked.length>0&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700}}>BLOCKED</span>}
                              </div>
                              <div style={{fontSize:11,color:C.dim}}>{rep?.name} · {c.deals[0]?.region} · Last contact: <span style={{color:idleColor,fontWeight:600}}>{c.lastContact?(idle===0?"today":`${idle}d ago`):"never"}</span></div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmtR(c.total)}</div>
                              <div style={{fontSize:10,color:C.dim}}>signed · target {fmtR(c.target)}</div>
                              {c.target>0&&<div style={{marginTop:4,height:3,width:120,background:C.s3,borderRadius:2}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:pct>=80?C.green:pct>=40?C.accent:C.red,borderRadius:2}}/></div>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                            {c.fct>0&&<span style={{background:`${C.purple}18`,color:C.purple,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:600}}>Linear TV {fmtR(c.fct)}</span>}
                            {c.digital>0&&<span style={{background:`${C.blue}18`,color:C.blue,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:600}}>Digital {fmtR(c.digital)}</span>}
                            {c.integrated>0&&<span style={{background:`${C.green}18`,color:C.green,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:600}}>Integrated Packages {fmtR(c.integrated)}</span>}
                            {c.sponsorship>0&&<span style={{background:`${C.accent}18`,color:C.accent,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:600}}>IPs {fmtR(c.sponsorship)}</span>}
                            {c.branded>0&&<span style={{background:`${C.orange}18`,color:C.orange,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:600}}>Media Solutions {fmtR(c.branded)}</span>}
                            {c.fct>0&&c.digital===0&&<span style={{background:`${C.red}10`,color:C.red,padding:"2px 9px",borderRadius:10,fontSize:10,border:`1px dashed ${C.red}44`}}>No digital yet</span>}
                            {c.total===0&&openDeals.length>0&&<span style={{background:`${C.orange}10`,color:C.orange,padding:"2px 9px",borderRadius:10,fontSize:10}}>In discussion</span>}
                          </div>
                          {openDeals.length>0&&(
                            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                              {openDeals.map(d=>(
                                <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                                  <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)}
                                    style={{padding:"2px 6px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                    {OUTCOMES.map(o=><option key={o} style={{background:"#0d1117",color:"#e6edf3"}}>{o}</option>)}
                                  </select>
                                  <span style={{fontSize:11,color:C.dim,flex:1}}>{d.nextStep||"No next step set"}</span>
                                  {d.awaitingApproval&&<span style={{background:`${C.orange}22`,color:C.orange,fontSize:10,padding:"1px 7px",borderRadius:6}}>⏳ {d.awaitingApproval}</span>}
                                  <button onClick={()=>{setLogForm(p=>({...BLANK_LOG,repId:String(d.repId),dealId:d.id,clientAgencyName:d.clientCompany,contactName:d.contactName||""}));setLogOpen(true);}}
                                    style={{background:`${C.accent}18`,border:"none",color:C.accent,borderRadius:4,padding:"2px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Log Meeting</button>
                                  <button onClick={()=>openAddDeal(d.dealType)}
                                    style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"2px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>+ Deal</button>
                                  <button onClick={()=>{showToast("Note feature coming soon","ok");}}
                                    style={{background:C.s3,border:"none",color:C.dim,borderRadius:4,padding:"2px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Note</button>
                                  <button onClick={()=>{const ir={id:`ir${Date.now()}`,type:"Support",dept:"Sales Strategy",subject:`Deck needed for ${d.clientCompany}`,details:"Please prepare a customised pitch deck.",raisedBy:activeUser,raisedByName:user_role?.name||"",repId:d.repId,dealId:d.id,clientCompany:d.clientCompany,status:"Pending",raisedAt:TODAY,slaHours:48,resolvedAt:null,resolverNote:""};setInternalReqs(p=>[ir,...p]);showToast("Request raised → Sales Strategy ✓");}}
                                    style={{background:`${C.purple}18`,border:"none",color:C.purple,borderRadius:4,padding:"2px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Request Deck</button>
                                </div>
                                                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── LINEAR TV TAB ── */}
                {(()=>{
                  const dtDeals = visibleDeals.filter(d=>d.dealType==="Linear TV");
                  const dT=dtDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const dC=dtDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                  const dP=dtDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
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
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No Linear TV deals for {filterQ}.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Target","Achieved","Shortfall","Stage","Next Step"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>Math.max(0,(b.targetAmount||0)-(b.outcome==="Proposal Accepted"?b.amount:0))-Math.max(0,(a.targetAmount||0)-(a.outcome==="Proposal Accepted"?a.amount:0))).map(d=>{
                                const rep=REPS.find(r=>r.id===d.repId);
                                const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                                const sf=Math.max(0,(d.targetAmount||0)-ach);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{padding:"2px 6px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                        {OUTCOMES.map(o=><option key={o} style={{background:"#0d1117",color:"#e6edf3"}}>{o}</option>)}
                                      </select>
                                    </td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11,maxWidth:180}}>{d.nextStep||<span style={{color:C.muted,fontStyle:"italic"}}>Not set</span>}</td>
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
                  const visibleIPs = IP_CATALOG.filter(ip=>qMatch(ip.quarter));
                  const canApprove  = isStrategy || isNSH || isCRORole || isAdmin;
                  const stColor = s => s==="Committed"?C.green:s==="In Discussion"?C.orange:C.muted;
                  // Closed-at visible to: RH/NSH/CRO/Strategy/Admin, or the rep who owns the proposal/elem
                  const canSeeCA = (ownRepId) =>
                    isRH || isNSH || isCRORole || isStrategy || isAdmin ||
                    (isRep && ownRepId === user_role?.repId);

                  // Helper: get live proposals for one element
                  const getEP = (ipId, elemId) => ipProposals.filter(p=>p.ipId===ipId&&p.elemId===elemId);

                  // Submit a new proposal
                  const submitProposal = (ip, elem) => {
                    if (!ipPropClient.trim()) { showToast("Enter client name","err"); return; }
                    const myRep = REPS.find(r=>r.id===user_role?.repId);
                    const prop = {
                      id: `ipr${Date.now()}`,
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
                    setIpPropClient(""); setIpPropNote(""); setIpPropValue(""); setIpPropOpen(null);
                    showToast(`Proposal submitted for ${elem.label} → awaiting Sales Strategy ✓`);
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
                                    const effRepName = approved.length>0 ? approved.map(p=>p.repName).join(", ") : (elem.repId?REPS.find(r=>r.id===elem.repId)?.name:null);
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
                                                        const pRep = REPS.find(r=>r.id===prop.repId);
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
                      <button className="btn btn-primary" onClick={()=>{
                        const client = "New Client";  // use inline deal form
                        const pkg = "Custom Package";
                        const val = "1000000";
                        // TODO: replace with Add Deal modal
                        const newDeal = {...BLANK_DEAL,clientCompany:client,dealType:"Media Solutions",outcome:"Needs Callback",amount:parseCurrency(val||"0"),targetAmount:parseCurrency(val||"0"),quarter:entryQ,repId:user_role?.repId||"",lastContact:TODAY,notes:pkg};
                        setDeals(p=>[{id:`d${Date.now()}`,...newDeal,repId:parseInt(newDeal.repId)||5,region:user_role?.region||"National",reqs:[]},...p]);
                        showToast("Brand Solutions deal created ✓");
                      }}>+ New Package</button>
                    </div>

                    {/* Brand Solutions deals */}
                    {(()=>{
                      const bsDeals = visibleDeals.filter(d=>d.dealType==="Media Solutions"||d.dealType==="Integrated Packages");
                      if(!bsDeals.length) return (
                        <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                          <div style={{fontSize:32,marginBottom:12}}>🎯</div>
                          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>No Brand Solutions packages yet</div>
                          <div style={{fontSize:12,color:C.dim}}>Create a custom package combining TV + Digital + On-ground + Content</div>
                        </div>
                      );
                      return bsDeals.map(d=>{
                        const rep = REPS.find(r=>r.id===d.repId);
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
                                style={{background:`${C.accent}18`,border:"none",color:C.accent,borderRadius:4,padding:"3px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Log Meeting</button>
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
                  const dC=dtDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No Digital deals for {filterQ}.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Target","Achieved","Shortfall","Stage","Next Step"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>Math.max(0,(b.targetAmount||0)-(b.outcome==="Proposal Accepted"?b.amount:0))-Math.max(0,(a.targetAmount||0)-(a.outcome==="Proposal Accepted"?a.amount:0))).map(d=>{
                                const rep=REPS.find(r=>r.id===d.repId);
                                const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                                const sf=Math.max(0,(d.targetAmount||0)-ach);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{padding:"2px 6px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                        {OUTCOMES.map(o=><option key={o} style={{background:"#0d1117",color:"#e6edf3"}}>{o}</option>)}
                                      </select>
                                    </td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11,maxWidth:180}}>{d.nextStep||<span style={{color:C.muted,fontStyle:"italic"}}>Not set</span>}</td>
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
                  const dC=dtDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
                      {dtDeals.length===0?<div style={{textAlign:"center",padding:40,color:C.muted}}>No Integrated Package deals for {filterQ}.</div>:(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Target","Achieved","Shortfall","Stage","Next Step"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {dtDeals.sort((a,b)=>Math.max(0,(b.targetAmount||0)-(b.outcome==="Proposal Accepted"?b.amount:0))-Math.max(0,(a.targetAmount||0)-(a.outcome==="Proposal Accepted"?a.amount:0))).map(d=>{
                                const rep=REPS.find(r=>r.id===d.repId);
                                const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                                const sf=Math.max(0,(d.targetAmount||0)-ach);
                                const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                return (
                                  <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                    <td style={{padding:"9px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div>{d.priority==="Top 5"&&<span style={{background:`${C.accent}22`,color:C.accent,padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:700}}>TOP 5</span>}</td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{rep?.name||"—"}</td>
                                    <td style={{padding:"9px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td>
                                    <td style={{padding:"9px 14px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}{ach>0&&<div style={{fontSize:9,color:C.dim}}>{pct}%</div>}</td>
                                    <td style={{padding:"9px 14px",color:sf===0?C.green:C.red,fontWeight:700}}>{sf===0?"✓":fmtR(sf)}</td>
                                    <td style={{padding:"9px 14px"}}>
                                      <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)} style={{padding:"2px 6px",background:`${oColor(d.outcome)}18`,border:`1px solid ${oColor(d.outcome)}44`,borderRadius:5,color:oColor(d.outcome),fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                        {OUTCOMES.map(o=><option key={o} style={{background:"#0d1117",color:"#e6edf3"}}>{o}</option>)}
                                      </select>
                                    </td>
                                    <td style={{padding:"9px 14px",color:C.dim,fontSize:11,maxWidth:180}}>{d.nextStep||<span style={{color:C.muted,fontStyle:"italic"}}>Not set</span>}</td>
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
                      const blocked = visibleDeals.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested");
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
                                  const rep=REPS.find(r=>r.id===d.repId);
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
                                        <select value={d.outcome} onChange={e=>updateOutcome(d.id,e.target.value)}
                                          onClick={e=>e.stopPropagation()}
                                          style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                          {OUTCOMES.map(o=><option key={o}>{o}</option>)}
                                        </select>
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
          )}

          {/* ═══ LEADERBOARD ═══ */}
          {(view==="leaderboard"||view==="lb-team"||view==="lb-region"||view==="lb-all") && (()=>{
            const medals = ["🥇","🥈","🥉"];
            const myRegion = user_role?.region;
            // For Sales Rep, tab is driven by sidebar view; for others, by lbTab state
            const effectiveLbTab = view==="lb-team"?"team":view==="lb-region"?"region":view==="lb-all"?"all":lbTab;
            const showTabBar = view==="leaderboard"; // only non-rep roles use the internal tab switcher

            // ── Always rank ALL reps for the leaderboard (activity + target% only, no revenue amounts) ──
            const lbAllReps = REPS.map(rep => {
              const rd      = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const closed  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
              const rm      = meetings.filter(m=>m.repId===rep.id);
              const seniorM = rm.filter(m=>["C-Suite / Owner","VP / GM","Marketing Head","Brand Manager"].includes(m.contactLevel)).length;
              const risk    = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
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
            const myInboxDept = isNSH?"NSH":isStrategy?"Sales Strategy":isCRORole?"CRO":isRH?"Region Head":null;
            // Requests ADDRESSED TO the current user's department
            const inboxReqs = myInboxDept ? internalReqs.filter(r=>r.dept===myInboxDept) : [];
            const myReqs  = isRep
              ? internalReqs.filter(r=>r.raisedBy===activeUser)
              : isRH
                ? internalReqs.filter(r=>r.raisedBy===activeUser || (r.dept==="Region Head" && USER_ROLES.find(u=>u.id===r.raisedBy)?.region===rhRegion))
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
                          {[...new Set(deals.filter(d=>myRepId?d.repId===myRepId:true).map(d=>d.clientCompany))].sort().map(c=><option key={c} value={c}>{c}</option>)}
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
                    {label:"In Progress",        count:inprog.length,  color:C.blue},
                    {label:"Done",               count:done.length,    color:C.green},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:8,padding:"10px 16px",minWidth:120}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>{s.label}</div>
                      <div className="sans" style={{fontSize:22,fontWeight:800,color:s.color,marginTop:2}}>{s.count}</div>
                    </div>
                  ))}
                </div>

                {/* Status filter */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {["all","Pending","Overdue","In Progress","Done","Withdrawn"].map(s=>(
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
                          {req.details&&<div style={{fontSize:11,color:C.dim,marginBottom:8,lineHeight:1.5}}>{req.details}</div>}
                          {req.resolverNote&&<div style={{fontSize:11,color:C.green,background:`${C.green}08`,padding:"6px 10px",borderRadius:5,marginBottom:8}}>✓ {req.resolverNote}</div>}
                          {req.status!=="Done" && (
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                              {req.status!=="In Progress"&&(
                                <button onClick={()=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"In Progress"}:r))}
                                  style={{background:`${C.blue}18`,border:"none",color:C.blue,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Mark In Progress</button>
                              )}
                              <button onClick={()=>openNoteModal("Resolution Note","Resolved",note=>setInternalReqs(p=>p.map(r=>r.id===req.id?{...r,status:"Done",resolvedAt:TODAY,resolverNote:note}:r)))}
                                style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"3px 11px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Mark Done</button>
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
                        {/* Escalate: visible to rep/RH when the request is overdue */}
                        {overdue && (isRep||isRH) && req.status!=="Done" && req.type!=="Escalation" && (
                          <button onClick={()=>{
                            const escalated = {
                              id:`ir${Date.now()}`,
                              type:"Escalation",
                              dept: req.dept==="NSH"?"CXO":req.dept==="Sales Strategy"?"NSH":"NSH",
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

          {/* ═══ ADMIN ═══ */}
          {(view==="admin-access"||view==="admin-approvals") && isAdmin && (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>
                  {view==="admin-access"?"ACCESS MANAGEMENT":"APPROVAL QUEUE"}
                </div>

                {/* ── ACCESS MANAGEMENT ── */}
                {view==="admin-access" && (
                  <div>
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
                            </div>
                            {/* Role + Region selectors inline */}
                            <select id={`role-${pu.id}`} defaultValue="SALES REP"
                              style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                              {ALL_ROLES.filter(r=>r!=="ADMIN").map(r=><option key={r}>{r}</option>)}
                            </select>
                            <select id={`region-${pu.id}`} defaultValue="North"
                              style={{padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                              {REGIONS.map(r=><option key={r}>{r}</option>)}
                            </select>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>{
                                const roleEl   = document.getElementById(`role-${pu.id}`);
                                const regionEl = document.getElementById(`region-${pu.id}`);
                                const role     = roleEl?.value || "SALES REP";
                                const region   = regionEl?.value || "North";
                                const newUser  = {id:`u_${pu.id}`,name:pu.name,role,canView:role==="SALES REP"?"self":role==="REGION HEAD"?"region":"all",region};
                                setLiveRoles(p=>[...p, newUser]);
                                setPendingUsers(p=>p.filter(u=>u.id!==pu.id));
                                showToast(`${pu.name} approved as ${role} ✓`);
                              }} style={{background:`${C.green}18`,border:"none",color:C.green,borderRadius:4,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                                ✓ Approve
                              </button>
                              <button onClick={()=>{
                                setPendingUsers(p=>p.filter(u=>u.id!==pu.id));
                                showToast(`${pu.name} rejected`,"err");
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
                          <select value={u.role} onChange={e=>{
                            const newRole = e.target.value;
                            setLiveRoles(p=>p.map(r=>r.id===u.id?{...r,role:newRole,canView:newRole==="SALES REP"?"self":newRole==="REGION HEAD"?"region":"all"}:r));
                            showToast(`${u.name} role updated to ${newRole}`);
                          }} style={{padding:"4px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                            {ALL_ROLES.map(r=><option key={r}>{r}</option>)}
                          </select>
                          <button onClick={()=>{
                            if(!window.confirm(`Revoke access for ${u.name}?`)) return;
                            setLiveRoles(p=>p.filter(r=>r.id!==u.id));
                            showToast(`${u.name}'s access revoked`,"err");
                          }} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"4px 11px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Revoke</button>
                        </div>
                      ))}
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
                const mC=myDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                const mP=myDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const mG=Math.max(0,mT-mC);
                const mPct=mT>0?Math.round((mC/mT)*100):0;
                const sc=mPct>=100?C.green:mPct>=50?C.accent:C.red;
                return (
                  <div>
                    <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:12,textTransform:"uppercase"}}>My Targets · {filterQ}</div>
                      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(mT),C.text],["CLOSED",fmtR(mC),C.green],["PIPELINE",fmtR(mP),C.accent],["SHORTFALL",fmtR(mG),mG===0?C.green:C.red]].map(([l,v,c])=>(
                          <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2,letterSpacing:".06em"}}>{l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:c}}>{v}</div></div>
                        ))}
                        <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:48,fontWeight:800,color:sc,lineHeight:1}}>{mPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                      </div>
                      <div style={{marginTop:12,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(mPct,100)}%`,background:sc,borderRadius:3}} /></div>
                    </div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {myDeals.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>No deals for {filterQ} yet.</td></tr>}
                          {myDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                            const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                            const pip=!["Proposal Accepted","Not Interested"].includes(d.outcome)?d.amount:0;
                            const sf=Math.max(0,(d.targetAmount||0)-ach);
                            const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                            return (
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
              })() : isRH ? (()=>{
                // ── REGION HEAD TARGETS: rep-wise tiles → click → client list ──
                const myRegion = user_role?.region;
                const myReps   = REPS.filter(r=>r.region===myRegion);
                if (rhRepDrill) {
                  // Client detail for selected rep
                  const repObj = REPS.find(r=>r.id===rhRepDrill);
                  const repDeals = visibleDeals.filter(d=>d.repId===rhRepDrill);
                  const rT=repDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rC=repDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                  const rP=repDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
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
                          {[["TARGET",fmtR(rT),C.text],["CLOSED",fmtR(rC),C.green],["PIPELINE",fmtR(rP),C.accent],["SHORTFALL",fmtR(Math.max(0,rT-rC)),rT-rC<=0?C.green:C.red]].map(([l,v,c])=>(
                            <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                          ))}
                          <div style={{marginLeft:"auto"}}><div className="sans" style={{fontSize:40,fontWeight:800,color:sc,lineHeight:1}}>{rPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                        </div>
                        <div style={{marginTop:10,height:5,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,background:sc}} /></div>
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Type","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {repDeals.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No deals for {filterQ}.</td></tr>}
                            {repDeals.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                              const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                              const pip=!["Proposal Accepted","Not Interested"].includes(d.outcome)?d.amount:0;
                              const sf=Math.max(0,(d.targetAmount||0)-ach);
                              const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                const regionC=visibleDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                const regionPct=regionT>0?Math.round((regionC/regionT)*100):0;
                const rsc=regionPct>=100?C.green:regionPct>=60?C.accent:C.red;
                return (
                  <div>
                    {/* Region summary tile */}
                    <div style={{background:C.surface,border:`2px solid ${rsc}`,borderRadius:10,padding:"16px 20px",marginBottom:18}}>
                      <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>{myRegion} Region · {filterQ}</div>
                      <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-end"}}>
                        {[["TARGET",fmtR(regionT),C.text],["CLOSED",fmtR(regionC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),C.accent],["GAP",fmtR(Math.max(0,regionT-regionC)),regionT-regionC<=0?C.green:C.red]].map(([l,v,c])=>(
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
                        const rC2=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                        const rP2=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const rPct2=rT2>0?Math.round((rC2/rT2)*100):0;
                        const sc2=rPct2>=80?C.green:rPct2>=50?C.accent:C.red;
                        const rAtRisk=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
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
                const mC=allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                const mP=allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                const mW=allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
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
                        const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);
                        const tC=td.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                        const tP=td.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                        const tW=td.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
                        const tF=tC+tW; const tG=Math.max(0,tT-tF);
                        const tCP=tT>0?Math.round((tC/tT)*100):0; const tFP=tT>0?Math.round((tF/tT)*100):0;
                        const tc=tFP>=100?C.green:tFP>=75?C.accent:tFP>=50?tile.color:C.red;
                        const risk=td.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
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
                      const repObj  = REPS.find(r=>r.id===nshRepDrill);
                      const rd      = getTileDeals(targetDrilldown.key).filter(d=>d.repId===nshRepDrill);
                      const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                      const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
                                {rd.sort((a,b)=>Math.max(0,(b.targetAmount||0)-(b.outcome==="Proposal Accepted"?b.amount:0))-Math.max(0,(a.targetAmount||0)-(a.outcome==="Proposal Accepted"?a.amount:0))).map(d=>{
                                  const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                                  const sf=Math.max(0,(d.targetAmount||0)-ach);
                                  const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                  return (
                                    <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                      const tC=td.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                      const tG=Math.max(0,tT-tC);
                      const tPct=tT>0?Math.round((tC/tT)*100):0;
                      const tsc=tPct>=80?C.green:tPct>=50?C.accent:C.red;
                      // Geographic regions: drill to rep tiles; deal-type tiles: flat list
                      const isGeoTile = ["North","South","West","East","Odisha"].includes(targetDrilldown.key);
                      const regionReps = isGeoTile ? REPS.filter(r=>r.region===targetDrilldown.key) : [];
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
                                  {td.length===0&&<tr><td colSpan={colSpan} style={{padding:24,textAlign:"center",color:C.muted}}>No deals.</td></tr>}
                                  {td.sort((a,b)=>b.targetAmount-a.targetAmount).map(d=>{
                                    const rep=REPS.find(r=>r.id===d.repId);
                                    const ach=d.outcome==="Proposal Accepted"?d.amount:0;
                                    const sf=Math.max(0,(d.targetAmount||0)-ach);
                                    const pct=d.targetAmount>0?Math.round((ach/d.targetAmount)*100):0;
                                    return (
                                      <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>Approvals waiting on you · Stuck requests from your team · Overdue tasks in your region</div>
              </div>
              {(()=>{
                const myRegion = user_role?.region;
                // 1. Deals in region awaiting RH's approval specifically
                const rhApproval = visibleDeals.filter(d=>
                  (d.awaitingApproval==="NSH" || d.awaitingApproval===myRegion) &&
                  d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  d.outcome !== "Proposal Accepted" && d.outcome !== "Not Interested"
                );
                // 2. Any deal in region where rep is blocked (all awaiting approvals)
                const regionBlocked = visibleDeals.filter(d=>
                  d.awaitingApproval &&
                  d.awaitingApprovalSince &&
                  daysSince(d.awaitingApprovalSince) >= APPROVAL_SLA_DAYS &&
                  !["Proposal Accepted","Not Interested"].includes(d.outcome)
                );
                // 3. Overdue tasks assigned to reps in this region
                const myRepIds = REPS.filter(r=>r.region===myRegion).map(r=>r.id);
                const overdueRepTasks = tasks.filter(t=>
                  myRepIds.includes(t.repId||t.assignedTo) &&
                  t.dueDate < TODAY && t.status !== "Done"
                );
                // 4. Tasks assigned directly to RH
                const rhTasks = tasks.filter(t=>
                  t.dept === myRegion || t.dept === "NSH" || t.assignedByName?.includes("Region")
                ).filter(t => t.status !== "Done" && t.dueDate < TODAY);
                const total = rhApproval.length + regionBlocked.length + overdueRepTasks.length;
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                      {[
                        {label:"APPROVALS WAITING ON YOU", value:rhApproval.length,      color:C.red,    desc:"Deals where your sign-off is needed"},
                        {label:"REGION DEALS BLOCKED",     value:regionBlocked.length,   color:C.orange, desc:"Any approval pending past SLA in region"},
                        {label:"REP TASKS OVERDUE",        value:overdueRepTasks.length, color:C.blue,   desc:"Tasks assigned to your reps, past due"},
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
                      <div style={{fontSize:11,color:C.dim}}>Your region is on track.</div>
                    </div>}

                    {rhApproval.length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.red,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>⏳ Waiting on Your Approval</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Requested By","Days Waiting","Stage","Action"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{rhApproval.map(d=>{
                              const rep=REPS.find(r=>r.id===d.repId);
                              const dw=daysSince(d.awaitingApprovalSince);
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:`${C.red}04`}} onMouseOver={e=>e.currentTarget.style.background=`${C.red}08`} onMouseOut={e=>e.currentTarget.style.background=`${C.red}04`}>
                                  <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.red}22`,color:C.red,padding:"2px 9px",borderRadius:5,fontSize:11,fontWeight:700}}>{d.awaitingApproval}</span></td>
                                  <td style={{padding:"10px 14px",color:C.red,fontWeight:700}}>{dw}d</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td>
                                  <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                                    <button onClick={()=>{
                                      if(!canApprove(d)){showToast("Only the designated approver can approve","err");return;}
                                      openNoteModal("Approval Note","Approved",note=>approveDeal(d.id,note));
                                    }} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginRight:4}}>Approve →</button>
                                    <button onClick={()=>setView("pipeline")} style={{background:C.s2,border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>View Deal</button>
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {regionBlocked.filter(d=>!rhApproval.find(r=>r.id===d.id)).length>0&&(
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:10,color:C.orange,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>🔧 Other Blocked Deals in Your Region</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Client","Rep","Amount","Waiting For","Days","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{regionBlocked.filter(d=>!rhApproval.find(r=>r.id===d.id)).map(d=>{
                              const rep=REPS.find(r=>r.id===d.repId);
                              const dw=daysSince(d.awaitingApprovalSince);
                              return (
                                <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{padding:"10px 14px"}}><div className="sans" style={{fontWeight:700}}>{d.clientCompany}</div></td>
                                  <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td>
                                  <td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td>
                                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:600}}>{d.awaitingApproval}</span></td>
                                  <td style={{padding:"10px 14px",color:C.orange,fontWeight:600}}>{dw}d</td>
                                  <td style={{padding:"10px 14px"}}>
                                    <select value={d.awaitingApproval||""} onChange={e=>setDeals(p=>p.map(x=>x.id===d.id?{...x,awaitingApproval:e.target.value||null,awaitingApprovalSince:e.target.value?TODAY:null}:x))} style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>
                                      <option value="">— Resolved —</option>
                                      {APPROVAL_TARGETS.map(t=><option key={t}>{t}</option>)}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {overdueRepTasks.length>0&&(
                      <div>
                        <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 Rep Tasks Overdue in Your Region</div>
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Task","Assigned To","Client","Priority","Due","Days Over","Update"].map(h=>(
                              <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}</tr></thead>
                            <tbody>{overdueRepTasks.map(t=>{
                              const rep=REPS.find(r=>r.id===(t.repId||t.assignedTo));
                              return (
                                <tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ TEAM ═══ — Region Head sees their region team only */}
          {view==="team" && isRH && (()=>{
            const rhRegion = user_role?.region;
            const myReps   = REPS.filter(r => r.region === rhRegion);
            const rhDeals  = visibleDeals;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM — {rhRegion}</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Revenue, pipeline, contact quality and compliance — your reps only</div>

                {myReps.map((rep,rank)=>{
                  const rd   = rhDeals.filter(d=>d.repId===rep.id);
                  const rC   = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
                  const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP   = rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct = rT>0?Math.round((rC/rT)*100):0;
                  const rRisk= rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver= rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted").length;
                  const rTasks = tasks.filter(t=>t.repId===rep.id&&t.status!=="Done").length;
                  const rBlocked= rd.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted").length;
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
                {canLogMeeting && <button className="btn btn-primary" onClick={()=>setLogOpen(true)}>+ Log Meeting</button>}
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
                  (user_role.canView==="all" ? true : user_role.canView==="region" ? REPS.find(r=>r.id===p.repId)?.region===user_role.region : p.repId===user_role.repId)
                ).sort((a,b)=>a.date>b.date?1:-1).slice(0,10);
                if (!fuPlans.length) return null;
                return (
                  <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}22`,borderRadius:8,padding:"12px 16px",marginBottom:18}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>📞 Follow-ups & Next Meetings ({fuPlans.length})</div>
                    {fuPlans.map(p=>{
                      const rep = REPS.find(r=>r.id===p.repId);
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
                const visReps = (user_role.canView==="all" ? REPS : user_role.canView==="region" ? REPS.filter(r=>r.region===user_role.region) : REPS.filter(r=>r.id===user_role.repId)).map(r=>r.id);
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
                      const rep = REPS.find(r=>r.id===(item.repId||item.assignedTo));
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
                              {m.meetingType&&<span style={{background:m.meetingType==="Physical Meeting"?`${C.green}18`:m.meetingType==="Online Meeting"?"#4285F418":`${C.blue}18`,color:m.meetingType==="Physical Meeting"?C.green:m.meetingType==="Online Meeting"?"#4285F4":C.blue,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{m.meetingType==="Physical Meeting"?"🤝":m.meetingType==="Online Meeting"?"💻":"📞"} {m.meetingType}</span>}
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
                  d.outcome !== "Proposal Accepted" &&
                  d.outcome !== "Not Interested" &&
                  (user_role.canView!=="self" || d.repId===myRepId)
                );

                // 2. Internal department requests overdue
                const reqEsc = deals.flatMap((d,_) =>
                  (d.reqs||[])
                    .map((r,i) => ({...r, dealId:d.id, reqIdx:i, clientCompany:d.clientCompany, repId:d.repId, amount:d.amount}))
                    .filter(r => r.status==="Overdue" && (user_role.canView!=="self" || d.repId===myRepId))
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
                        {label:"APPROVALS OVERDUE",  value:approvalEsc.length, color:C.red,    desc:`Pending >${APPROVAL_SLA_DAYS}d without response`},
                        {label:"REQUESTS STUCK",      value:reqEsc.length,      color:C.orange, desc:"Internal requests past SLA"},
                        {label:"TASKS OVERDUE",       value:taskEsc.length,     color:C.blue,   desc:"Tasks past due date"},
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
                                const rep=REPS.find(r=>r.id===d.repId);
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
                                const rep=REPS.find(r=>r.id===t.assignedTo);
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

          {/* ═══ HR REPORTS ═══ */}
          {view==="hr" && (
            <div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>HR ABSENCE REPORTS</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:2}}>Auto-generated 23:30 · Sent to <span style={{color:C.accent}}>{HR_EMAIL}</span></div>
                </div>
                {canGrantException&&<button className="btn btn-primary" onClick={runEODCheck}>▶ Simulate EOD Run</button>}
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

              {/* ── PERSONAL: Own absence records (all non-admin roles) ── */}
              {!isAdmin && (()=>{
                const myRepId  = user_role?.repId ?? null;
                const visReports = myRepId != null
                  ? absenceReports.filter(r=>r.repId===myRepId)
                  : [];
                return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
                      {[
                        {label:"MY ABSENCES", value:visReports.filter(r=>r.markedAs==="Absent").length,      color:C.red},
                        {label:"EXCEPTIONS",  value:visReports.filter(r=>r.exception==="Overridden").length, color:C.green},
                      ].map(k=>(
                        <div key={k.label} className="card" style={{padding:12,borderTop:`2px solid ${k.color}`}}>
                          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:4,textTransform:"uppercase"}}>{k.label}</div>
                          <div className="sans" style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                    {visReports.length===0
                      ? <div style={{textAlign:"center",padding:40,color:C.muted,border:`1px dashed ${C.border}`,borderRadius:8,fontSize:12}}>No absence records on file.</div>
                      : (
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                          <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",padding:"8px 14px",background:C.s2,borderBottom:`1px solid ${C.border}`}}>MY ABSENCE LOG</div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr>{["Date","Generated","Status","Exception"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                            <tbody>{visReports.map(r=>(
                              <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                                <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.generatedAt}</td>
                                <td style={{padding:"9px 14px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                                <td style={{padding:"9px 14px"}}>{r.exception?<div><span style={{background:`${C.green}22`,color:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>Overridden by {r.exceptionBy}</span><div style={{fontSize:10,color:C.dim,marginTop:2}}>{r.exceptionReason}</div></div>:<span style={{color:C.muted,fontSize:11}}>—</span>}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                  </div>
                );
              })()}

              {/* ── ADMIN absence log table (full org view) ── */}
              {isAdmin && (()=>{
                const visReports = absenceReports;
                if (!visReports.length) return <div style={{textAlign:"center",padding:40,color:C.muted}}>No absence records.</div>;
                return (
                  <div>
                    <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:8,textTransform:"uppercase"}}>All Absence Reports — Admin View</div>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr>
                          {["Rep","Region","Date","Generated","Status","Exception","Action"].map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {visReports.map(r=>(
                            <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={e=>e.currentTarget.style.background=C.s2}
                              onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"9px 14px"}}><div style={{fontWeight:600}}>{r.repName}</div></td>
                              <td style={{padding:"9px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.region}</span></td>
                              <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.date}</td>
                              <td style={{padding:"9px 14px",color:C.dim,fontSize:11}}>{r.generatedAt}</td>
                              <td style={{padding:"9px 14px"}}><span style={{background:r.markedAs==="Absent"?`${C.red}22`:`${C.green}22`,color:r.markedAs==="Absent"?C.red:C.green,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>{r.markedAs}</span></td>
                              <td style={{padding:"9px 14px"}}>
                                {r.exception
                                  ?<div><span style={{background:`${C.green}22`,color:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>by {r.exceptionBy}</span><div style={{fontSize:10,color:C.dim,marginTop:2,maxWidth:180,whiteSpace:"normal"}}>{r.exceptionReason}</div></div>
                                  :<span style={{color:C.muted,fontSize:11}}>—</span>}
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
                          const assignee=task.assignedToUserId?USER_ROLES.find(u=>u.id===task.assignedToUserId):REPS.find(r=>r.id===task.assignedTo);
                          const rep=assignee||(task.assignedTo?REPS.find(r=>r.id===task.assignedTo):null);
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
                                {task.status!=="Done"&&(
                                  <select value={task.status} onChange={e=>setTasks(p=>p.map(t=>t.id===task.id?{...t,status:e.target.value}:t))}
                                    style={{fontSize:10,padding:"3px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,marginRight:6}}>
                                    {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
                                  </select>
                                )}
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
            // Target = only what CRO has approved (locked in)
            const totalTarget   = approvedSubs.reduce((s,sub)=>s+sub.totalTarget,0);
            // Achievement = revenue booked against approved clients
            const totalAchieved = approvedSubs.flatMap(sub=>sub.clients).reduce((sum,cl)=>{
              return sum + revenueEntries.filter(e=>e.repId===myRepId&&e.clientCompany===cl.clientCompany&&qMatch(e.quarter)).reduce((s,e)=>s+(e.amount||0),0);
            },0);
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

                {/* Approval chain indicator */}
                <div style={{display:"flex",alignItems:"center",gap:0,marginTop:14,marginBottom:16,flexWrap:"wrap"}}>
                  {["You","Region Head","NSH","Sales Strategy","CRO → Approved"].map((s,i)=>(
                    <div key={s} style={{display:"flex",alignItems:"center"}}>
                      <div style={{background:`${C.accent}18`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"4px 10px",fontSize:10,color:C.accent,fontWeight:600,whiteSpace:"nowrap"}}>{s}</div>
                      {i<4&&<div style={{width:16,height:1,background:C.border}}/>}
                    </div>
                  ))}
                </div>

                {/* Summary stats row */}
                {activeSub && (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                    {(()=>{
                      const shortfall = Math.max(0, totalTarget - totalAchieved);
                      const sfColor   = shortfall===0 ? C.green : C.red;
                      return [
                        {label:"TOTAL TARGET", value:fmtR(totalTarget),   color:C.accent},
                        {label:"ACHIEVED",      value:fmtR(totalAchieved), color:pctColor},
                        {label:"SHORTFALL",     value:fmtR(shortfall),     color:sfColor},
                        {label:"% COMPLETE",    value:`${pct}%`,           color:pctColor},
                      ];
                    })().map(s=>(
                      <div key={s.label} className="card" style={{padding:"12px 16px"}}>
                        <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:4}}>{s.label}</div>
                        <div className="sans" style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Client Modal */}
                {addClientModalOpen && (
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>{if(e.target===e.currentTarget)setAddClientModalOpen(false);}}>
                    <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:12,padding:"28px 28px 24px",width:480,maxWidth:"95vw",boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                        <div className="sans" style={{fontWeight:700,fontSize:15}}>Add Client Target — {filterQ}</div>
                        <button onClick={()=>setAddClientModalOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        <div>
                          <div style={{fontSize:10,color:C.dim,marginBottom:4,letterSpacing:".05em"}}>CLIENT NAME</div>
                          <input value={addClientForm.clientCompany} placeholder="e.g. Havells India"
                            onChange={e=>setAddClientForm(p=>({...p,clientCompany:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'DM Mono',monospace"}}/>
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
                          const {clientCompany,dealType,targetAmount} = addClientForm;
                          if(!clientCompany.trim()||!targetAmount){showToast("Fill in client name and target amount","err");return;}
                          const amt = parseCurrency(targetAmount);
                          const newEntry = {clientCompany:clientCompany.trim(),dealType,targetAmount:amt};
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
                        }} style={{padding:"9px 22px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:6,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                          Submit for Approval →
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
                  // Flatten clients, tagging each with their parent sub's status
                  const allClients = activeSubs.flatMap(sub=>
                    sub.clients.map(cl=>({...cl, subStatus:sub.status, approvalLog:sub.approvalLog||[]}))
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
                                  <td style={{padding:"10px 14px",fontWeight:700}}>{cl.clientCompany}</td>
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
                              const updated = editSubClients.map(c=>({...c,targetAmount:parseCurrency(String(c.targetAmount))}));
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
                        {(sub.approvalLog||[]).filter(l=>l.action==="Rejected"||l.note==="Rejected").map((l,i)=>(
                          <span key={i} style={{fontSize:11,color:C.red}}>✗ {l.by}: {l.note} ({l.at})</span>
                        ))}
                        {(sub.approvalLog||[]).filter(l=>l.action!=="Rejected"&&l.note!=="Rejected").map((l,i)=>(
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
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TARGET APPROVALS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>
                  {isRH?"Review and approve target submissions from your region's sales reps.":
                   isNSH?"Approve targets cleared by Region Heads.":
                   isStrategy?"Review NSH-approved targets for strategic alignment.":
                   "Final CRO sign-off on targets cleared by Sales Strategy."}
                </div>

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

                {/* Pending approvals */}
                {myPending.length===0 ? (
                  <div style={{textAlign:"center",padding:50,color:C.muted}}>
                    <div style={{fontSize:28,marginBottom:8}}>✓</div>
                    <div style={{fontWeight:700,color:C.green}}>No pending approvals at your level</div>
                  </div>
                ) : myPending.map(sub=>{
                  const approvedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                  const rejectedClients = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Rejected");
                  const pendingClients  = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Pending");
                  const canForward = approvedClients.length > 0;
                  const approvedTotal = approvedClients.reduce((s,c)=>s+(c.targetAmount||0),0);

                  // helper: update a single client's status inside this submission
                  const setClientStatus = (clientIdx, newStatus) => {
                    setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,clients:t.clients.map((cl,i)=>i===clientIdx?{...cl,clientStatus:newStatus}:cl)}:t));
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
                            setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,status:"Rejected",approvalLog:[...t.approvalLog,{step:pendingStep,by:user_role?.name||"",at:TODAY,note:"Submission rejected"}]}:t));
                            showToast("Submission rejected");
                          }} style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:4,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Reject All</button>
                          <button
                            disabled={!canForward||pendingClients.length>0}
                            onClick={()=>{
                              const approvedOnly = sub.clients.filter(cl=>(cl.clientStatus||"Pending")==="Approved");
                              const newTotal = approvedOnly.reduce((s,c)=>s+(c.targetAmount||0),0);
                              setTargetSubs(p=>p.map(t=>t.id===sub.id?{...t,
                                clients: approvedOnly,
                                totalTarget: newTotal,
                                status: nextStep,
                                approvalLog:[...t.approvalLog,{step:pendingStep,by:user_role?.name||"",at:TODAY,note:`Approved ${approvedOnly.length} client${approvedOnly.length!==1?"s":""}`}]
                              }:t));
                              if(nextStep==="Approved"){
                                approvedOnly.forEach(cl=>{
                                  const existing = deals.find(d=>d.repId===sub.repId&&d.clientCompany===cl.clientCompany&&d.quarter===sub.quarter);
                                  if(existing) setDeals(p=>p.map(d=>d.id===existing.id?{...d,targetAmount:cl.targetAmount}:d));
                                });
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
                    const myDeals = isRep ? deals.filter(d=>d.repId===myRepId&&qMatch(d.quarter)) : deals.filter(d=>qMatch(d.quarter));
                    return (
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:C.dim,marginBottom:3}}>CLIENT / ADVERTISER</div>
                            <select value={rf.clientCompany} onChange={e=>setRf(p=>({...p,clientCompany:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                              <option value="">Select client…</option>
                              {[...new Set(myDeals.map(d=>d.clientCompany))].map(cl=><option key={cl}>{cl}</option>)}
                              <option value="__new__">+ Enter manually</option>
                            </select>
                            {rf.clientCompany==="__new__"&&(
                              <input placeholder="Client name" value={rf._manual||""} onChange={e=>setRf(p=>({...p,_manual:e.target.value}))}
                                style={{marginTop:6,width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                            )}
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
                            <input type="date" value={rf.date} onChange={e=>setRf(p=>({...p,date:e.target.value}))}
                              style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                          </div>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:C.dim,marginBottom:3}}>NOTES</div>
                          <input value={rf.notes} placeholder="Optional notes" onChange={e=>setRf(p=>({...p,notes:e.target.value}))}
                            style={{width:"100%",padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                        <button onClick={()=>{
                          const client = rf.clientCompany==="__new__" ? (rf._manual||"").trim() : rf.clientCompany;
                          if(!client||!rf.amount){showToast("Client and amount are required","err");return;}
                          const amt = parseCurrency(rf.amount);
                          if(!amt){showToast("Invalid amount","err");return;}
                          const entry = {id:`re${Date.now()}`,repId:isRep?myRepId:null,clientCompany:client,dealType:rf.dealType,amount:amt,invoiceRef:rf.invoiceRef,date:rf.date||TODAY,quarter:entryQ,notes:rf.notes};
                          setRevenueEntries(p=>[entry,...p]);
                          // Update matching deal's achieved amount
                          const matchDeal = deals.find(d=>(isRep?d.repId===myRepId:true)&&d.clientCompany===client&&qMatch(d.quarter));
                          if(matchDeal){
                            const allForDeal = [...revenueEntries.filter(e=>e.clientCompany===client&&qMatch(e.quarter)),entry];
                            const total = allForDeal.reduce((s,e)=>s+(e.amount||0),0);
                            setDeals(p=>p.map(d=>d.id===matchDeal.id?{...d,amount:total,outcome:total>=matchDeal.targetAmount?"Proposal Accepted":d.outcome}:d));
                          }
                          setRf({clientCompany:"",dealType:"Linear TV",amount:"",invoiceRef:"",date:TODAY,notes:""});
                          showToast(`₹${(amt/100000).toFixed(1)}L logged for ${client} ✓`);
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
                          {["Client","Deal Type","Amount","Invoice Ref","Date","Notes"].map(h=>(
                            <th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {myEntries.filter(e=>qMatch(e.quarter)).sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                            <tr key={e.id} style={{borderBottom:`1px solid ${C.s2}`}}
                              onMouseOver={ev=>ev.currentTarget.style.background=C.s2}
                              onMouseOut={ev=>ev.currentTarget.style.background="transparent"}>
                              <td style={{padding:"10px 14px",fontWeight:700}}>{e.clientCompany}</td>
                              <td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 7px",borderRadius:5,fontSize:10}}>{e.dealType}</span></td>
                              <td style={{padding:"10px 14px",fontWeight:700,color:C.green}}>{fmtR(e.amount)}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.invoiceRef||"—"}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{e.date}</td>
                              <td style={{padding:"10px 14px",color:C.dim,fontSize:11,maxWidth:160}}>{e.notes||"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ IMPORT DATA ═══ */}
          {/* ═══ ADMIN CONFIG ═══ */}
          {view==="admin-config" && isAdmin && (
            <div className="fin">
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>SYSTEM CONFIGURATION</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Approval thresholds, SLA hours, inactivity rules — no code deploy needed.</div>

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
                    fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:"OTV CRM",event:"test",message:"Webhook test from OTV CRM System Config",timestamp:new Date().toISOString()})})
                      .then(()=>showToast("Test ping sent ✓"))
                      .catch(()=>showToast("Webhook call failed — check URL","err"));
                  }} style={{padding:"7px 14px",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,borderRadius:5,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>
                    Send Test Ping
                  </button>
                </div>
                <div style={{marginTop:10,fontSize:10,color:C.muted}}>
                  Triggers: EOD absence reports · Deal won · Approval breaches SLA
                </div>
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
              <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>IMPORT DATA</div>
              <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Upload your data via CSV or Excel. Download a template, fill it in, upload it back.</div>

              {/* ── DATA TYPE TABS ── */}
              {(()=>{
                const tabs = [
                  {id:"deals",      label:"Deals",          icon:"◈", desc:"Client deals, pipeline, targets"},
                  {id:"reps",       label:"Sales Reps",     icon:"◇", desc:"Rep names, regions, roles"},
                  {id:"clients",    label:"Clients",        icon:"◎", desc:"Client master list"},
                  {id:"targets",    label:"Targets",        icon:"✦", desc:"Client-wise targets per rep"},
                  {id:"revenue",    label:"Revenue Entries",icon:"₹", desc:"Actual revenue logged"},
                  {id:"properties", label:"Properties/IPs", icon:"⬡", desc:"Sponsorship inventory"},
                ];
                const [impTab, setImpTab] = [importTab, setImportTab];

                const TEMPLATES = {
                  deals:      ["Client Company","Contact Name","Designation","Phone","Email","Rep Name","Region","Deal Type","Stage","Target Amount","Expected Amount","Quarter","Priority","Notes","Next Step","Next Step Date"],
                  reps:       ["Rep Name","Email","Region","Role","Target Amount"],
                  clients:    ["Client Company","Industry","Primary Contact","Designation","Phone","Email","Assigned Rep","Region"],
                  targets:    ["Rep Name","Region","Client Company","Deal Type","Target Amount","Quarter"],
                  revenue:    ["Rep Name","Client Company","Deal Type","Amount","Invoice Ref","Date","Quarter","Notes"],
                  properties: ["Property Name","Type","Channel","Quarter","Total Value","Slot Label","Slot Value","Status","Client Company"],
                };

                const downloadTemplate = (type) => {
                  const headers = TEMPLATES[type] || [];
                  const sampleRow = {
                    deals:      ["Havells India","Deepa Menon","VP Marketing","9823401234","deepa@havells.com","Vikram Sen","National","IPs","Very Interested","15000000","12000000","Q1 FY26","Top 5","Budget confirmed","Send deck","2026-04-15"],
                    reps:       ["Arjun Mishra","arjun@odishatv.com","North","SALES REP","10000000"],
                    clients:    ["Havells India","FMCG","Deepa Menon","VP Marketing","9823401234","deepa@havells.com","Vikram Sen","National"],
                    targets:    ["Vikram Sen","National","Havells India","IPs","15000000","Q1 FY26"],
                    revenue:    ["Vikram Sen","Havells India","IPs","5000000","INV-2024-001","2026-04-10","Q1 FY26","First instalment"],
                    properties: ["Odia Idol S3","Reality Show","OTV","Q1 FY26","12000000","Title Sponsor","5000000","Available",""],
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

                  if (type==="deals") {
                    const newDeals = rows.map((row,i)=>{
                      const repName = row["Rep Name"]||"";
                      const rep = REPS.find(r=>r.name.toLowerCase().includes(repName.toLowerCase().slice(0,5))) || REPS[0];
                      return {id:`imp_${Date.now()}_${i}`,repId:rep.id,clientCompany:row["Client Company"]||"Unknown",contactName:row["Contact Name"]||"",designation:row["Designation"]||"",phone:row["Phone"]||"",email:row["Email"]||"",dealType:row["Deal Type"]||"Linear TV",outcome:row["Stage"]||"Needs Callback",amount:parseCur(row["Expected Amount"]),targetAmount:parseCur(row["Target Amount"]),region:row["Region"]||rep.region||"North",priority:row["Priority"]||"Regular",quarter:row["Quarter"]||"Q1 FY26",notes:row["Notes"]||"",nextStep:row["Next Step"]||"",nextStepDate:row["Next Step Date"]||null,lastContact:null,reqs:[]};
                    });
                    setDeals(p=>[...p,...newDeals]);
                    showToast(`✓ ${newDeals.length} deals imported`);
                  } else if (type==="revenue") {
                    const repLookup = r => REPS.find(rep=>rep.name.toLowerCase().includes((r||"").toLowerCase().slice(0,5)));
                    const entries = rows.map((row,i)=>{
                      const rep = repLookup(row["Rep Name"]);
                      return {id:`re_imp_${Date.now()}_${i}`,repId:rep?.id||null,clientCompany:row["Client Company"]||"",dealType:row["Deal Type"]||"Linear TV",amount:parseCur(row["Amount"]),invoiceRef:row["Invoice Ref"]||"",date:row["Date"]||TODAY,quarter:row["Quarter"]||"Q1 FY26",notes:row["Notes"]||""};
                    });
                    setRevenueEntries(p=>[...p,...entries]);
                    showToast(`✓ ${entries.length} revenue entries imported`);
                  } else if (type==="targets") {
                    const newSubs = rows.map((row,i)=>{
                      const rep = REPS.find(r=>r.name.toLowerCase().includes((row["Rep Name"]||"").toLowerCase().slice(0,5)));
                      return {id:`ts_imp_${Date.now()}_${i}`,repId:rep?.id||null,repName:row["Rep Name"]||"",region:row["Region"]||"",quarter:row["Quarter"]||"Q1 FY26",clients:[{clientCompany:row["Client Company"]||"",dealType:row["Deal Type"]||"Linear TV",targetAmount:parseCur(row["Target Amount"])}],totalTarget:parseCur(row["Target Amount"]),status:"Pending RH",submittedAt:TODAY,approvalLog:[]};
                    });
                    setTargetSubs(p=>[...p,...newSubs]);
                    showToast(`✓ ${newSubs.length} target rows imported → pending RH approval`);
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
            const totC=allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const totW=allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+((d.amount||0)*(STAGE_PROB[d.outcome]||0)/100),0);
            const forecast=totC+totW; const fcastPct=totT>0?Math.round((forecast/totT)*100):0; const closePct=totT>0?Math.round((totC/totT)*100):0;
            const fsc=fcastPct>=80?C.green:fcastPct>=60?C.accent:C.red;
            const top5=allD.filter(d=>d.priority==="Top 5").sort((a,b)=>b.amount-a.amount);
            const regions=["National","North","South","East","West"];
            const regionStats=regions.map(r=>{const rd=allD.filter(d=>d.region===r);const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);const rPct=rT>0?Math.round((rC/rT)*100):0;return{r,rT,rC,rPct};});
            const compliantReps=REPS.filter(r=>att[TODAY]?.[r.id]).length;
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
                  {[["Reps Compliant",`${compliantReps} / ${REPS.length}`,compliantReps===REPS.length?C.green:C.orange],["Open Escalations",openEsc,openEsc===0?C.green:C.red],["At-Risk Deals",atRisk.length,atRisk.length===0?C.green:C.red],["Overdue Next Steps",overdueNext.length,overdueNext.length===0?C.green:C.orange]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.s2}`}}><span style={{fontSize:12,color:C.dim}}>{l}</span><span className="sans" style={{fontSize:16,fontWeight:700,color:c}}>{v}</span></div>))}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:12}}>Top 5 Deals</div>
                  {top5.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"20px 0"}}>No Top 5 deals tagged</div>}
                  {top5.slice(0,5).map(d=>{const rep=REPS.find(r=>r.id===d.repId);return(<div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.s2}`}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:12}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{rep?.name}</div></div><div style={{textAlign:"right"}}><div className="sans" style={{fontSize:13,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{d.outcome}</span></div></div>);})}
                </div>
              </div>
            </div>);
          })()}

          {view==="ceo-risks" && isCEORole && (()=>{
            const highRisk=deals.filter(d=>qMatch(d.quarter)&&d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested").map(d=>({...d,idle:daysSince(d.lastContact)})).sort((a,b)=>(b.targetAmount-a.targetAmount)||(b.idle-a.idle));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TOP RISKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Highest-value open deals · sorted by target size and idle time</div></div>
              {highRisk.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green}}>✓ No open risks.</div>}
              {highRisk.map((d,i)=>{const rep=REPS.find(r=>r.id===d.repId);const riskColor=d.idle>=14?C.red:d.idle>=7?C.orange:C.blue;const riskLabel=d.idle>=14?"HIGH":d.idle>=7?"MEDIUM":"WATCH";return(
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
              {seniorReqs.map(m=>{const rep=REPS.find(r=>r.id===m.repId);const deal=deals.find(d=>d.repId===m.repId&&(d.clientCompany||"").toLowerCase().includes((m.clientCompany||"").toLowerCase().slice(0,5)));return(
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
            const pending=deals.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>APPROVALS QUEUE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All deals awaiting sign-off</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{label:"TOTAL PENDING",value:pending.length,color:C.orange},{label:"OVERDUE (>2D)",value:pending.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=2).length,color:C.red},{label:"TOTAL VALUE",value:fmtR(pending.reduce((s,d)=>s+(d.amount||0),0)),color:C.accent}].map(k=>(<div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.color}}>{k.value}</div></div>))}
              </div>
              {pending.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No pending approvals</div>}
              {pending.length>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Amount","Waiting For","Days","Stage","Action"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{pending.map(d=>{const rep=REPS.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:dw>=2?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=dw>=2?`${C.red}04`:"transparent"}><td style={{padding:"10px 14px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div><div style={{fontSize:10,color:C.dim}}>{d.dealType}</div></td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.amount)}</td><td style={{padding:"10px 14px"}}><span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{d.awaitingApproval}</span></td><td style={{padding:"10px 14px",color:dw>=2?C.red:C.dim,fontWeight:dw>=2?700:400}}>{dw}d</td><td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td><td style={{padding:"10px 14px",whiteSpace:"nowrap"}}><button onClick={()=>(()=>{ if(!canApprove(d)){showToast("Only the designated approver can approve this deal","err");return;} openNoteModal("Approval Note", "Approved", note => approveDeal(d.id, note)); })()} style={{background:canApprove(d)?`${C.green}22`:C.s3,border:"none",color:canApprove(d)?C.green:C.dim,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{canApprove(d)?"Approve →":"🔒 Locked"}</button></td></tr>);})}</tbody></table></div>}
            </div>);
          })()}

          {/* ══════════════ MD VIEWS ══════════════ */}
          {view==="md-accounts" && isMDRole && (()=>{
            const allD=deals.filter(d=>qMatch(d.quarter)&&d.priority==="Top 5");
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0); const totC=allD.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const totPct=totT>0?Math.round((totC/totT)*100):0; const sc=totPct>=80?C.green:totPct>=50?C.accent:C.red;
            const seniorReqs=meetings.filter(m=>m.seniorRequested==="Yes");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>KEY ACCOUNTS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Top 5 priority deals + senior meeting requests</div></div>
              <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"16px 22px",marginBottom:20,display:"flex",alignItems:"flex-end",gap:24,flexWrap:"wrap"}}>
                {[["KEY ACCOUNT TARGET",fmtR(totT),C.text],["CLOSED",fmtR(totC),C.green],["PENDING",fmtR(Math.max(0,totT-totC)),C.accent]].map(([l,v,c])=>(<div key={l}><div style={{fontSize:9,color:C.dim,letterSpacing:".08em",marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>))}
                <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:sc,lineHeight:1}}>{totPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
              </div>
              {allD.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=REPS.find(r=>r.id===d.repId);const senReq=seniorReqs.find(m=>m.repId===d.repId&&(m.clientCompany||"").toLowerCase().includes(d.clientCompany.toLowerCase().slice(0,5)));return(
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
            const mdEsc=deals.filter(d=>d.awaitingApproval&&["CXO","Legal","Finance"].includes(d.awaitingApproval)&&d.outcome!=="Proposal Accepted").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Items needing MD attention</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{label:"PENDING",value:mdEsc.length,color:C.orange},{label:"OVERDUE",value:mdEsc.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=APPROVAL_SLA_DAYS).length,color:C.red},{label:"VALUE",value:fmtR(mdEsc.reduce((s,d)=>s+(d.amount||0),0)),color:C.accent}].map(k=>(<div key={k.label} className="card" style={{padding:13,borderTop:`2px solid ${k.color}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.label}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.color}}>{k.value}</div></div>))}
              </div>
              {mdEsc.length===0&&<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ No escalations pending for MD</div>}
              {mdEsc.map(d=>{const rep=REPS.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(
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
            const closed=allD.filter(d=>d.outcome==="Proposal Accepted");
            const open=allD.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome));
            const totT=allD.reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=closed.reduce((s,d)=>s+(d.amount||0),0);
            const totP=open.reduce((s,d)=>s+(d.amount||0),0);
            const dealTypes=[...new Set(allD.map(d=>d.dealType).filter(Boolean))];
            const typeStats=dealTypes.map(t=>{const td=allD.filter(d=>d.dealType===t);const tClosed=td.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);const tPipe=td.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);const tT=td.reduce((s,d)=>s+(d.targetAmount||0),0);const pct=tT>0?Math.round((tClosed/tT)*100):0;return{t,count:td.length,tClosed,tPipe,tT,pct};}).sort((a,b)=>b.tT-a.tT);
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
            const highValueStalled=allD.filter(d=>d.targetAmount>=5000000&&daysSince(d.lastContact)>=14&&d.outcome!=="Proposal Accepted");
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>WHITESPACE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>High-value accounts with no recent activity</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[{l:"NO CONTACT 30D+",v:allD.filter(d=>daysSince(d.lastContact)>=30&&d.outcome!=="Proposal Accepted").length,c:C.red},{l:"HIGH-VALUE STALLED",v:highValueStalled.length,c:C.orange},{l:"VALUE AT RISK",v:fmtR(highValueStalled.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Target","Last Contact","Days Idle","Stage"].map(h=><th key={h} style={{padding:"8px 14px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{[...highValueStalled].sort((a,b)=>daysSince(b.lastContact)-daysSince(a.lastContact)).map(d=>{const rep=REPS.find(r=>r.id===d.repId);const idle=daysSince(d.lastContact);return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}><td style={{padding:"10px 14px",fontWeight:700}}>{d.clientCompany}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"10px 14px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"10px 14px",fontWeight:600}}>{fmtR(d.targetAmount)}</td><td style={{padding:"10px 14px",color:C.dim,fontSize:11}}>{d.lastContact||"Never"}</td><td style={{padding:"10px 14px",color:idle>=30?C.red:idle>=14?C.orange:C.dim,fontWeight:700}}>{idle}d</td><td style={{padding:"10px 14px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td></tr>);})} {highValueStalled.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No stalled high-value accounts!</td></tr>}</tbody></table></div>
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
                  const rep = REPS.find(r=>r.id===d.repId);
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
                {[{l:"TOTAL DIGITAL",v:fmtR(digiDeals.reduce((s,d)=>s+(d.amount||0),0)),c:C.blue},{l:"CLOSED",v:fmtR(digiDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0)),c:C.green},{l:"OPEN PIPELINE",v:fmtR(digiDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0)),c:C.accent},{l:"WAITING ON YOU",v:blocked.length,c:blocked.length>0?C.orange:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}
              </div>
              {digiTasks.length>0&&(<div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>📋 {digiTasks.length} Task{digiTasks.length!==1?"s":""} Assigned to Digital</div>{digiTasks.slice(0,4).map(t=>{const rep=REPS.find(r=>r.id===t.repId);return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.s2,borderRadius:5,marginBottom:5}}><div style={{flex:1}}><div style={{fontWeight:600,fontSize:12}}>{t.title}</div><div style={{fontSize:10,color:C.dim}}>{t.clientCompany&&`${t.clientCompany} · `}{rep&&`from ${rep.name} · `}Due {t.dueDate}</div></div><span style={{background:t.dueDate<TODAY?`${C.red}22`:`${C.orange}18`,color:t.dueDate<TODAY?C.red:C.orange,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{t.dueDate<TODAY?"OVERDUE":t.priority}</span><button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:"Done"}:x))} style={{background:`${C.green}22`,border:"none",color:C.green,borderRadius:4,padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Done</button></div>);})}{digiTasks.length>4&&<div style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:5}}>+{digiTasks.length-4} more · see My Tasks</div>}</div>)}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Client","Rep","Region","Type","Amount","Needs from Digital","Stage","Idle"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{digiDeals.length===0&&<tr><td colSpan={8} style={{padding:24,textAlign:"center",color:C.muted}}>No digital deals for {filterQ} yet</td></tr>}{digiDeals.map(d=>{const rep=REPS.find(r=>r.id===d.repId);const idle=daysSince(d.lastContact);const digiReqs=(d.reqs||[]).filter(r=>r.dept==="Digital");const waitingOnUs=d.awaitingApproval==="Digital";return(<tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`,background:waitingOnUs?`${C.blue}06`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=waitingOnUs?`${C.blue}06`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:700}}>{d.clientCompany}</div>{waitingOnUs&&<span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700}}>Needs your action</span>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name}</td><td style={{padding:"9px 12px"}}><span style={{background:`${C.blue}18`,color:C.blue,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{d.region}</span></td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{d.dealType}</td><td style={{padding:"9px 12px",fontWeight:600}}>{fmtR(d.amount)}</td><td style={{padding:"9px 12px"}}>{digiReqs.length>0?<div>{digiReqs.map((r,i)=><div key={i} style={{fontSize:10,color:C.blue}}>{r.desc}</div>)}</div>:waitingOnUs?<span style={{color:C.blue,fontSize:11}}>Approval needed</span>:<span style={{color:C.muted}}>—</span>}</td><td style={{padding:"9px 12px"}}><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span></td><td style={{padding:"9px 12px",color:idle>=7?C.red:idle>=3?C.orange:C.green,fontSize:11}}>{idle===0?"Today":`${idle}d`}</td></tr>);})}</tbody></table></div>
            </div>);
          })()}

          {view==="digi-tasks" && isDigiOps && (()=>{
            const myTasks=tasks.filter(t=>t.dept==="Digital").sort((a,b)=>a.dueDate>b.dueDate?1:-1);
            const overdueCount=myTasks.filter(t=>t.dueDate<TODAY&&t.status!=="Done").length;
            return(<div className="fin">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>MY TASKS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Tasks assigned to Digital · {myTasks.length} total · {overdueCount} overdue</div></div><button className="btn btn-primary" onClick={()=>setTaskModal(true)}>+ Create Task</button></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>{[{l:"OPEN",v:myTasks.filter(t=>t.status==="Open").length,c:C.blue},{l:"IN PROGRESS",v:myTasks.filter(t=>t.status==="In Progress").length,c:C.accent},{l:"OVERDUE",v:overdueCount,c:C.red},{l:"DONE",v:myTasks.filter(t=>t.status==="Done").length,c:C.green}].map(k=>(<div key={k.l} className="card" style={{padding:12,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {myTasks.length===0?<div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:32,textAlign:"center",color:C.dim}}>No tasks assigned to Digital yet.</div>:<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Task","Client","Raised By","Priority","Status","Due","Update"].map(h=><th key={h} style={{padding:"8px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{myTasks.map(t=>{const rep=REPS.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;return(<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`,background:overdue?`${C.red}04`:"transparent"}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=overdue?`${C.red}04`:"transparent"}><td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td><td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?.name||t.assignedByName||"—"}</td><td style={{padding:"9px 12px"}}><span style={{background:t.priority==="High"?`${C.red}18`:t.priority==="Medium"?`${C.orange}18`:`${C.green}18`,color:t.priority==="High"?C.red:t.priority==="Medium"?C.orange:C.green,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{t.priority}</span></td><td style={{padding:"9px 12px"}}><span style={{background:`${sc}18`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{overdue?"OVERDUE":t.status}</span></td><td style={{padding:"9px 12px",color:overdue?C.red:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{t.dueDate}</td><td style={{padding:"9px 12px"}}>{t.status!=="Done"&&<select value={t.status} onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,status:e.target.value}:x))} style={{fontSize:10,padding:"2px 6px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text}}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select>}</td></tr>);})}  </tbody></table></div>}
            </div>);
          })()}

          {view==="digi-escalations" && isDigiOps && (()=>{
            const digiBlocked=deals.filter(d=>d.awaitingApproval==="Digital"&&d.outcome!=="Proposal Accepted"&&d.outcome!=="Not Interested").sort((a,b)=>daysSince(b.awaitingApprovalSince||TODAY)-daysSince(a.awaitingApprovalSince||TODAY));
            return(<div className="fin">
              <div style={{marginBottom:16}}><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>ESCALATIONS</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>Deals waiting on Digital team</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>{[{l:"PENDING",v:digiBlocked.length,c:C.orange},{l:"OVERDUE (>2D)",v:digiBlocked.filter(d=>daysSince(d.awaitingApprovalSince||TODAY)>=2).length,c:C.red},{l:"VALUE",v:fmtR(digiBlocked.reduce((s,d)=>s+(d.amount||0),0)),c:C.accent}].map(k=>(<div key={k.l} className="card" style={{padding:13,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{k.l}</div><div className="sans" style={{fontSize:24,fontWeight:700,color:k.c}}>{k.v}</div></div>))}</div>
              {digiBlocked.length===0?<div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:8,padding:32,textAlign:"center",color:C.green,fontSize:12}}>✓ Nothing waiting on Digital right now</div>:digiBlocked.map(d=>{const rep=REPS.find(r=>r.id===d.repId);const dw=daysSince(d.awaitingApprovalSince||TODAY);return(<div key={d.id} style={{background:C.surface,border:`1px solid ${dw>=2?C.red+"44":C.border}`,borderLeft:`3px solid ${dw>=2?C.red:C.orange}`,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}><span className="sans" style={{fontSize:14,fontWeight:700}}>{d.clientCompany}</span><span style={{background:`${dw>=2?C.red:C.orange}22`,color:dw>=2?C.red:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{dw}d waiting</span></div><div style={{fontSize:11,color:C.dim,marginBottom:4}}>{rep?.name} · {d.region}</div>{d.nextStep&&<div style={{fontSize:11,color:C.text}}>Context: {d.nextStep}</div>}</div><div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}><div className="sans" style={{fontSize:15,fontWeight:700,color:C.accent}}>{fmtR(d.amount)}</div><span style={{background:`${oColor(d.outcome)}18`,color:oColor(d.outcome),padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{d.outcome}</span><button onClick={()=>{
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


          {/* ═══ RH TEAM PLAN ═══ */}
          {view==="rh-team-plan" && isRH && (()=>{
            const myReps  = REPS.filter(r=>r.region===rhRegion);
            const myRepIds= myReps.map(r=>r.id);
            const tPlans  = (plans||[]).filter(p=>myRepIds.includes(p.repId));
            const todayTP = tPlans.filter(p=>p.date===TODAY);
            const tmrwTP  = tPlans.filter(p=>p.date===TOMORROW);
            const weekPlan= tPlans.filter(p=>p.date>=TODAY);
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM'S PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · All reps' scheduled meetings</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  {[{label:"TODAY",date:TODAY,plans:todayTP},{label:"TOMORROW",date:TOMORROW,plans:tmrwTP}].map(({label,date,plans:dp})=>(
                    <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                      <div style={{background:C.s2,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{label} · {dp.length} meeting{dp.length!==1?"s":""}</span>
                      </div>
                      <div style={{padding:"10px 14px",minHeight:60}}>
                        {dp.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:12}}>Nothing planned</div>}
                        {dp.map(p=>{
                          const rep=REPS.find(r=>r.id===p.repId);
                          return (
                            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"7px 10px",background:C.s2,borderRadius:5}}>
                              <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{(rep?.name||"?")[0]}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:12,fontWeight:600}}>{p.clientAgencyName}</div>
                                <div style={{fontSize:10,color:C.dim}}>{rep?.name} · {p.time}</div>
                                {p.agenda&&<div style={{fontSize:10,color:C.muted}}>{p.agenda}</div>}
                              </div>
                              <span style={{background:`${p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent}18`,color:p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{p.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <div style={{background:C.s2,padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>UPCOMING WEEK · {weekPlan.length} meetings</span>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Rep","Client","Date","Time","Pitch Type","Status"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {weekPlan.length===0&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.muted}}>No meetings planned this week</td></tr>}
                      {weekPlan.sort((a,b)=>a.date>b.date?1:a.time>b.time?1:-1).map(p=>{
                        const rep=REPS.find(r=>r.id===p.repId);
                        const isToday=p.date===TODAY;
                        return (
                          <tr key={p.id} style={{borderBottom:`1px solid ${C.s2}`,background:isToday?`${C.accent}06`:"transparent"}}
                            onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background=isToday?`${C.accent}06`:"transparent"}>
                            <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{rep?.name}</div><div style={{fontSize:10,color:C.dim}}>{rep?.region}</div></td>
                            <td style={{padding:"9px 12px",fontWeight:600}}>{p.clientAgencyName}</td>
                            <td style={{padding:"9px 12px",color:isToday?C.accent:C.dim,fontWeight:isToday?700:400}}>{isToday?"Today":p.date}</td>
                            <td style={{padding:"9px 12px",color:C.dim}}>{p.time}</td>
                            <td style={{padding:"9px 12px"}}>{p.pitchType?<span style={{background:`${C.accent}18`,color:C.accent,padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{p.pitchType}</span>:<span style={{color:C.muted}}>—</span>}</td>
                            <td style={{padding:"9px 12px"}}><span style={{background:p.status==="Done"?`${C.green}22`:p.status==="Cancelled"?`${C.red}22`:`${C.accent}18`,color:p.status==="Done"?C.green:p.status==="Cancelled"?C.red:C.accent,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>{p.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══ MY TASKS (Region Head / NSH) ═══ */}
          {view==="my-tasks" && (isRH||isNSH) && (()=>{
            const myRepIds = isRH ? REPS.filter(r=>r.region===rhRegion).map(r=>r.id) : REPS.map(r=>r.id);
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
                  <button className="btn btn-primary" onClick={openSelfTask}>+ Create Task</button>
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
                        const assigner = t.assignedBy ? USER_ROLES.find(u=>u.id===t.assignedBy)||REPS.find(r=>r.id===t.assignedBy) : null;
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
            const myReps=REPS.filter(r=>r.region===rhRegion);
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>TEAM PIPELINE</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>{rhRegion} Region · All rep deals</div></div>
                </div>
                {myReps.map(rep=>{
                  const rd=visibleDeals.filter(d=>d.repId===rep.id&&d.outcome!=="Not Interested");
                  if(!rd.length) return null;
                  const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
                  const rP=rd.filter(d=>d.outcome!=="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
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
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}}
                                onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const myReps=REPS.filter(r=>r.region===rhRegion);
            const rhT=visibleDeals.reduce((s,d)=>s+(d.targetAmount||0),0);
            const rhC=visibleDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
            const rhPct=rhT>0?Math.round((rhC/rhT)*100):0;
            const sc=rhPct>=80?C.green:rhPct>=50?C.accent:C.red;
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>TEAM TARGETS</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>{rhRegion} Region · {filterQ}</div>
                <div style={{background:C.surface,border:`2px solid ${sc}`,borderRadius:10,padding:"16px 22px",marginBottom:16}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>Region Total</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
                    {[["TARGET",fmtR(rhT),C.text],["CLOSED",fmtR(rhC),C.green],["PIPELINE",fmtR(visibleDeals.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0)),C.accent],["GAP",fmtR(Math.max(0,rhT-rhC)),rhC>=rhT?C.green:C.red]].map(([l,v,c])=>(
                      <div key={l}><div style={{fontSize:9,color:C.dim,marginBottom:2}}>{l}</div><div className="sans" style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
                    ))}
                    <div style={{marginLeft:"auto",textAlign:"right"}}><div className="sans" style={{fontSize:44,fontWeight:800,color:sc,lineHeight:1}}>{rhPct}%</div><div style={{fontSize:10,color:C.dim}}>achieved</div></div>
                  </div>
                  <div style={{marginTop:10,height:6,background:C.s3,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rhPct,100)}%`,background:sc,borderRadius:3}} /></div>
                </div>
                {rhRepDrill ? (()=>{
                  const rep=REPS.find(r=>r.id===rhRepDrill);
                  const rd=visibleDeals.filter(d=>d.repId===rhRepDrill);
                  return (
                    <div>
                      <button onClick={()=>setRhRepDrill(null)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 12px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginBottom:12}}>← Back to Reps</button>
                      <div className="sans" style={{fontSize:15,fontWeight:700,marginBottom:10}}>{rep?.name} · Client List</div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Target","Achieved","Pipeline","Shortfall","Stage"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>{rd.map(d=>{const ach=d.outcome==="Proposal Accepted"?d.amount:0;const sf=Math.max(0,(d.targetAmount||0)-ach);return(
                            <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"9px 12px",fontWeight:700}}>{d.clientCompany}</td>
                              <td style={{padding:"9px 12px"}}>{fmtR(d.targetAmount)}</td>
                              <td style={{padding:"9px 12px",color:ach>0?C.green:C.muted,fontWeight:ach>0?700:400}}>{ach>0?fmtR(ach):"—"}</td>
                              <td style={{padding:"9px 12px",color:C.accent}}>{fmtR(!["Proposal Accepted","Not Interested"].includes(d.outcome)?d.amount:0)}</td>
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
                      const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
            const myRepIds=REPS.filter(r=>r.region===rhRegion).map(r=>r.id);
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
                        const rep=REPS.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
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
            const myRepIds=REPS.filter(r=>r.region===rhRegion).map(r=>r.id);
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
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                          <span style={{background:m.outcome==="Proposal Accepted"?`${C.green}22`:`${C.blue}18`,color:m.outcome==="Proposal Accepted"?C.green:C.blue,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{m.outcome||m.status}</span>
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
            const regions = ["National","North","South","East","West"];
            return (
              <div className="fin">
                <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>REGION HEADS' PLAN</div>
                <div style={{fontSize:11,color:C.dim,marginBottom:16}}>Today and tomorrow — region by region</div>

                {/* Two-column: today left, tomorrow right */}
                {regions.map(region=>{
                  const rReps   = REPS.filter(r=>r.region===region).map(r=>r.id);
                  const todayP  = (plans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TODAY);
                  const tmrwP   = (plans||[]).filter(p=>rReps.includes(p.repId)&&p.date===TOMORROW);
                  if (!todayP.length && !tmrwP.length) return null;
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      {/* Region label */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{REPS.filter(r=>r.region===region).length} reps</span>
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
                                const rep=REPS.find(r=>r.id===p.repId);
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
            const regions = ["National","North","South","East","West"];
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
                  const rReps = REPS.filter(r=>r.region===region);
                  const rRepIds = rReps.map(r=>r.id);
                  // Get today's deals with plans logged
                  const regionDeals = deals.filter(d=>d.region===region&&qMatch(d.quarter)&&d.outcome!=="Not Interested");
                  const todayMtgs   = meetings.filter(m=>REPS.find(r=>r.id===m.repId&&r.region===region)&&m.date===TODAY);
                  const todayPlanned= (plans||[]).filter(p=>rRepIds.includes(p.repId)&&p.date===TODAY);
                  const tmrwPlanned = (plans||[]).filter(p=>rRepIds.includes(p.repId)&&p.date===TOMORROW);
                  return (
                    <div key={region} style={{marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 14px",background:C.s2,borderRadius:7,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:10,color:C.dim}}>{rReps.length} reps · {todayPlanned.length} today · {tmrwPlanned.length} tomorrow</span>
                        <span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:600}}>
                          {fmtR(regionDeals.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0))} closed
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
                              const rep  = REPS.find(r=>r.id===d.repId);
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
                              const rep=REPS.find(r=>r.id===p.repId);
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
                  const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                  const rOver=rd.filter(d=>d.nextStepDate&&d.nextStepDate<TODAY&&d.outcome!=="Proposal Accepted").length;
                  const rBlocked=rd.filter(d=>d.awaitingApproval&&d.outcome!=="Proposal Accepted").length;
                  const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                  const rankColor=rank===0?C.accent:rank===1?C.blue:C.dim;
                  return (
                    <div key={rhu.id} className="card" style={{padding:16,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:`${rankColor}22`,border:`1px solid ${rankColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:rankColor,flexShrink:0}}>#{rank+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                            <span className="sans" style={{fontSize:15,fontWeight:700}}>{rhu.region} Region</span>
                            <span style={{fontSize:11,color:C.dim}}>{REPS.filter(r=>r.region===rhu.region).length} reps · {rd.length} deals</span>
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
            const regions=["National","North","South","East","West"];
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
                  return (
                    <div key={region} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s2,borderRadius:6,borderLeft:`3px solid ${C.accent}`}}>
                        <span className="sans" style={{fontWeight:700,fontSize:13}}>{region}</span>
                        <span style={{fontSize:11,color:C.dim}}>{rd.length} deals</span>
                        <span style={{color:C.green,fontWeight:600,fontSize:11,marginLeft:"auto"}}>{fmtR(rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0))} closed</span>
                        <span style={{color:C.accent,fontSize:11}}>{fmtR(rd.filter(d=>d.outcome!=="Proposal Accepted").reduce((s,d)=>s+d.amount,0))} pipeline</span>
                        {blocked.length>0&&<span style={{background:`${C.orange}22`,color:C.orange,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{blocked.length} blocked</span>}
                      </div>
                      <div className="card" style={{overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr>{["Client","Rep","Amount","Stage","Next Step","Awaiting"].map(h=><th key={h} style={{padding:"7px 12px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {rd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=REPS.find(r=>r.id===d.repId);return(
                              <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const regions=["National","North","South","East","West"];
            const totT=deals.filter(d=>qMatch(d.quarter)).reduce((s,d)=>s+(d.targetAmount||0),0);
            const totC=deals.filter(d=>qMatch(d.quarter)&&d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
                      const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                      const rP=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rPct=rT>0?Math.round((rC/rT)*100):0;
                      const rRisk=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
                      const nReps=REPS.filter(r=>r.region===region).length;
                      const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return(<tr key={region} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
                        const rep=REPS.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"9px 12px"}}><div style={{fontWeight:600}}>{t.title}</div>{t.description&&<div style={{fontSize:10,color:C.dim,marginTop:1,maxWidth:200,whiteSpace:"normal"}}>{t.description}</div>}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{t.clientCompany||"—"}</td>
                          <td style={{padding:"9px 12px",color:C.dim,fontSize:11}}>{rep?REPS.find(r=>r.id===rep.id)?.region:"—"}</td>
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
                    const reps = REPS.filter(r=>r.region===reg);
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
                  const reps = REPS.filter(r=>r.region===reg);
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
                            <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const regions=["all","National","North","South","East","West"];
            const filterDeals=nshRegion==="all"?deals.filter(d=>qMatch(d.quarter)):deals.filter(d=>d.region===nshRegion&&qMatch(d.quarter));
            return (
              <div className="fin">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1}}>REP SCORECARD</div><div style={{fontSize:11,color:C.dim,marginTop:2}}>All reps · {filterQ}</div></div>
                  <div style={{display:"flex",gap:6}}>
                    {regions.map(r=><button key={r} onClick={()=>setNshRegion(r)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${nshRegion===r?C.accent:C.border}`,background:nshRegion===r?`${C.accent}18`:"transparent",color:nshRegion===r?C.accent:C.dim,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",textTransform:"capitalize"}}>{r==="all"?"All":r}</button>)}
                  </div>
                </div>
                {REPS.filter(r=>nshRegion==="all"||r.region===nshRegion).map((rep,rank)=>{
                  const rd=filterDeals.filter(d=>d.repId===rep.id);
                  const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+d.amount,0);
                  const rT=rd.reduce((s,d)=>s+(d.targetAmount||0),0);
                  const rP=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+d.amount,0);
                  const rPct=rT>0?Math.round((rC/rT)*100):0;
                  const rRisk=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)&&daysSince(d.lastContact)>=7).length;
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
            const regions=["all","National","North","South","East","West"];
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
                      {fd.sort((a,b)=>b.amount-a.amount).map(d=>{const rep=REPS.find(r=>r.id===d.repId);return(
                        <tr key={d.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const regions=["all","National","North","South","East","West"];
            const fReps=nshRegion==="all"?REPS:REPS.filter(r=>r.region===nshRegion);
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
                      const rC=rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
                      const rP=rd.filter(d=>!["Proposal Accepted","Not Interested"].includes(d.outcome)).reduce((s,d)=>s+(d.amount||0),0);
                      const rG=Math.max(0,rT-rC);const rPct=rT>0?Math.round((rC/rT)*100):0;const sc=rPct>=80?C.green:rPct>=50?C.accent:C.red;
                      return (<tr key={rep.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const regions=["all","National","North","South","East","West"];
            const fReps=nshRegion==="all"?REPS.map(r=>r.id):REPS.filter(r=>r.region===nshRegion).map(r=>r.id);
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
                        const rep=REPS.find(r=>r.id===t.repId);const overdue=t.dueDate<TODAY&&t.status!=="Done";const sc=t.status==="Done"?C.green:overdue?C.red:t.status==="In Progress"?C.blue:C.accent;
                        return (<tr key={t.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
            const regions=["all","National","North","South","East","West"];
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
                        <tr key={r.id} style={{borderBottom:`1px solid ${C.s2}`}} onMouseOver={e=>e.currentTarget.style.background=C.s2} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
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
              const rC  = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
            const allReps  = REPS.map(rep=>{
              const rd   = deals.filter(d=>d.repId===rep.id&&qMatch(d.quarter));
              const rT   = rd.reduce((s,d)=>s+(d.targetAmount||0),0);
              const rC   = rd.filter(d=>d.outcome==="Proposal Accepted").reduce((s,d)=>s+(d.amount||0),0);
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
            const teammates = REPS.filter(r => r.region === myRegion)
              .map(rep => {
                const rd  = deals.filter(d => d.repId === rep.id && d.quarter === filterQ);
                const rT  = rd.reduce((s,d) => s + (d.targetAmount||0), 0);
                const rC  = rd.filter(d => d.outcome === "Proposal Accepted").reduce((s,d) => s + d.amount, 0);
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
        // Auto-fill self for reps (when not in selfTaskMode) so they default to themselves in the picker
        if (!selfTaskMode && isRep && user_role?.id && !taskForm.assignedToUserId) {
          setTimeout(()=>setTaskForm(p=>p.assignedToUserId?p:{...p,assignedToUserId:user_role.id}),0);
        }
        const modalTitle = selfTaskMode ? "Create Task for Myself" : isRep ? "Create Task" : "Assign Task";
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
                <div><label>{isRep ? "Assign to (defaults to yourself)" : "Assign to *"}</label>
                  <select value={taskForm.assignedToUserId} onChange={e=>setTaskForm(p=>({...p,assignedToUserId:e.target.value}))}>
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
                <div><label>Due Date</label><input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(p=>({...p,dueDate:e.target.value}))} /></div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={closeTaskModal}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>{
                const assignedUserId = taskForm.assignedToUserId || (isRep&&user_role?.id?user_role.id:"");
                if(!assignedUserId||!taskForm.title){showToast("Task title and assignee required","err");return;}
                const assignedUser = USER_ROLES.find(u=>u.id===assignedUserId);
                const repId = assignedUser?.repId||null;
                setTasks(p=>[{id:`t${Date.now()}`,...taskForm,assignedToUserId:assignedUserId,assignedToName:assignedUser?.name||"",assignedTo:repId,repId:repId,assignedBy:activeUser,assignedByName:user_role?.name||user.name,status:"Open",createdAt:TODAY},...p]);
                closeTaskModal();
                showToast(assignedUserId===activeUser?"✓ Task created for yourself":"Task assigned to "+(assignedUser?.name||""));
              }}>{selfTaskMode?"Create Task":isRep?"Create Task":"Assign Task"}</button>
            </div>
          </div>
        </div>
        );
      })()}

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
                {label:"Target Amount (Rs) * — what you're going after",key:"targetAmount",type:"number",ph:"e.g. 5000000"},
                {label:"Expected (Rs) — likely close amount (leave blank = same as target)",key:"amount",type:"number",ph:"auto-filled from target"},
                {label:"Next Step",key:"nextStep",type:"text",ph:"Action item"},
                {label:"Next Step Date",key:"nextStepDate",type:"date",ph:""},
              ].map(f=>(
                <div key={f.key}><label>{f.label}</label><input type={f.type} placeholder={f.ph} value={dealForm[f.key]||""} onChange={e=>setDealForm(p=>({...p,[f.key]:e.target.value}))} /></div>
              ))}
              <div><label>Assign Rep *</label>{isRep?(<input readOnly value={REPS.find(r=>r.id===parseInt(dealForm.repId))?.name||""} style={{color:C.text,background:C.s2,cursor:"default"}} />):(<select value={dealForm.repId} onChange={e=>setDealForm(p=>({...p,repId:e.target.value}))}><option value="">Select</option>{REPS.map(r=><option key={r.id} value={r.id}>{r.name} ({r.region})</option>)}</select>)}</div>
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
            </div>
            <div style={{height:1,background:C.border,margin:"12px 0"}} />

            {/* SECTION 1 — Who */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Who</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label>Sales Rep *</label>
                {isRep ? (
                  // Rep sees their own name — no dropdown
                  <input readOnly value={REPS.find(r=>r.id===parseInt(logForm.repId))?.name||""} style={{color:C.text,background:C.s2,cursor:"default"}} />
                ) : (
                  <select value={logForm.repId} onChange={e=>setLogForm(p=>({...p,repId:e.target.value}))}>
                    <option value="">Select rep</option>
                    {REPS.map(r=><option key={r.id} value={r.id}>{r.name} · {r.region}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label>Region</label>
                <input readOnly value={REPS.find(r=>r.id===parseInt(logForm.repId))?.region||""} style={{color:C.dim,background:C.s2,cursor:"default"}} />
              </div>
              <div>
                <label>Meeting Time</label>
                <input type="time" value={logForm.meetingTime||""} onChange={e=>setLogForm(p=>({...p,meetingTime:e.target.value}))} />
              </div>
              <div>
                <label>Meeting Type</label>
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  {MEETING_TYPES.map(mt=>(
                    <button key={mt} onClick={()=>setLogForm(p=>({...p,meetingType:mt}))}
                      style={{flex:1,padding:"7px 6px",fontSize:11,borderRadius:5,border:`1px solid ${logForm.meetingType===mt?(mt==="Physical Meeting"?C.green:mt==="Online Meeting"?"#4285F4":C.accent):C.border}`,background:logForm.meetingType===mt?(mt==="Physical Meeting"?`${C.green}18`:mt==="Online Meeting"?"#4285F418":`${C.accent}18`):"transparent",color:logForm.meetingType===mt?(mt==="Physical Meeting"?C.green:mt==="Online Meeting"?"#4285F4":C.accent):C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all .1s",textAlign:"center"}}>
                      {mt==="Physical Meeting"?"🤝":mt==="Online Meeting"?"💻":"📞"} {mt}
                    </button>
                  ))}
                </div>
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

            {/* SECTION 5 — Next Steps */}
            <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Next Steps</div>

            {/* Structured action items — one row per action */}
            <div style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:10}}>
              <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>
                Action Items — each row auto-creates a task for the dept + follow-up in your pipeline
              </div>

              {/* Column headers */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 120px 28px",gap:6,marginBottom:6}}>
                {["Action / What needs to happen","Who do you need it from","Remarks","Due Date",""].map((h,i)=>(
                  <div key={i} style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",padding:"0 2px"}}>{h}</div>
                ))}
              </div>

              {(logForm.nextStepItems||[{...BLANK_NEXT_STEP_ITEM}]).map((item,idx)=>(
                <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 120px 28px",gap:6,marginBottom:6,alignItems:"center"}}>
                  {/* Action type dropdown */}
                  <select value={item.action} onChange={e=>{const arr=[...(logForm.nextStepItems||[])];arr[idx]={...arr[idx],action:e.target.value};setLogForm(p=>({...p,nextStepItems:arr}));}}>
                    <option value="">Select action…</option>
                    <option value="Send Proposal">Send Proposal</option>
                    <option value="Send FCT Grid">Send FCT Grid</option>
                    <option value="Send Revised Rate Card">Send Revised Rate Card</option>
                    <option value="Send Sponsorship Deck">Send Sponsorship Deck</option>
                    <option value="Get Budget Approval">Get Budget Approval</option>
                    <option value="Arrange Senior Meeting">Arrange Senior Meeting</option>
                    <option value="Get Rate Approval">Get Rate Approval</option>
                    <option value="Follow Up with Client">Follow Up with Client</option>
                    <option value="Share Digital Plan">Share Digital Plan</option>
                    <option value="Content / Script Needed">Content / Script Needed</option>
                    <option value="Legal / Contract Review">Legal / Contract Review</option>
                    <option value="Get PO / Release">Get PO / Release</option>
                    <option value="Other">Other</option>
                  </select>

                  {/* Who do you need it from */}
                  <select value={item.neededFrom} onChange={e=>{const arr=[...(logForm.nextStepItems||[])];arr[idx]={...arr[idx],neededFrom:e.target.value};setLogForm(p=>({...p,nextStepItems:arr}));}}>
                    <option value="">Needed from…</option>
                    <optgroup label="Internal Departments">
                      {APPROVAL_TARGETS.map(t=><option key={t} value={t}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Self">
                      <option value="Self">Myself</option>
                    </optgroup>
                    <optgroup label="Client">
                      <option value="Client">Client</option>
                    </optgroup>
                  </select>

                  {/* Remarks */}
                  <input placeholder="Any notes…" value={item.remarks} onChange={e=>{const arr=[...(logForm.nextStepItems||[])];arr[idx]={...arr[idx],remarks:e.target.value};setLogForm(p=>({...p,nextStepItems:arr}));}} />

                  {/* Due date */}
                  <input type="date" value={item.dueDate} onChange={e=>{const arr=[...(logForm.nextStepItems||[])];arr[idx]={...arr[idx],dueDate:e.target.value};setLogForm(p=>({...p,nextStepItems:arr}));}} />

                  {/* Remove row */}
                  <button onClick={()=>{const arr=(logForm.nextStepItems||[]).filter((_,i)=>i!==idx);setLogForm(p=>({...p,nextStepItems:arr.length?arr:[{...BLANK_NEXT_STEP_ITEM}]}));}}
                    style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:0,lineHeight:1,textAlign:"center"}}>
                    ✕
                  </button>
                </div>
              ))}

              <button onClick={()=>setLogForm(p=>({...p,nextStepItems:[...(p.nextStepItems||[]),{...BLANK_NEXT_STEP_ITEM}]}))}
                style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:5,padding:"5px 14px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginTop:4,width:"100%"}}>
                + Add another action item
              </button>
            </div>

            {/* Follow-up date + meeting status side by side */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
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
                    {logForm.calendarPlatform && logForm.calendarPlatform !== "none" && (
                      <div style={{marginTop:6,padding:"6px 10px",background:`${C.blue}10`,border:`1px solid ${C.blue}33`,borderRadius:5,fontSize:11,color:C.blue}}>
                        📅 Calendar event will be created when running on Replit deployment (requires Google OAuth). Meeting is still logged to CRM now.
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
                      ? <input type="date" value={ef.date||""} onChange={e=>setEf({date:e.target.value})} style={{fontSize:11,background:C.s3,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 6px",color:C.dim}} />
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

              {/* Next steps */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Next Steps {meetingEditMode&&<span style={{color:C.red,fontWeight:400}}>*</span>}</div>
                {meetingEditMode
                  ? <input value={ef.nextSteps||""} onChange={e=>setEf({nextSteps:e.target.value})} placeholder="What is the clear next action?" style={{width:"100%",fontSize:12}} />
                  : vm.nextSteps
                      ? <div style={{fontSize:12,color:C.text,lineHeight:1.6,background:`${C.orange}11`,border:`1px solid ${C.orange}33`,borderRadius:6,padding:"10px 12px"}}>{vm.nextSteps}</div>
                      : <div style={{fontSize:11,color:C.muted}}>—</div>
                }
              </div>

              {/* Follow-up & next meeting */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div>
                  <div style={{fontSize:10,color:C.blue,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>📞 Follow-up Date</div>
                  {meetingEditMode
                    ? <input type="date" value={ef.followUpDate||""} onChange={e=>setEf({followUpDate:e.target.value})} style={{width:"100%",fontSize:12}} />
                    : vm.followUpDate
                        ? <div style={{fontSize:13,fontWeight:600,color:C.text,background:`${C.blue}11`,border:`1px solid ${C.blue}33`,borderRadius:6,padding:"8px 12px"}}>{vm.followUpDate}</div>
                        : <div style={{fontSize:11,color:C.muted}}>Not set</div>
                  }
                </div>
                <div>
                  <div style={{fontSize:10,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>📅 Next Meeting Date</div>
                  {meetingEditMode
                    ? <input type="date" value={ef.nextMeetingDate||""} onChange={e=>setEf({nextMeetingDate:e.target.value})} style={{width:"100%",fontSize:12}} />
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
