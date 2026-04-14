export const REGIONS = ["North", "South", "East", "West", "National"];
export const DEAL_TYPES = ["Linear TV", "Digital", "Sponsorship", "Branded Content", "Integrated Package"];
export const CONTACT_LEVELS = ["C-Suite / Owner", "VP / GM", "Marketing Head", "Brand Manager", "Agency Lead", "Junior/Exec"];
export const OUTCOMES = ["Proposal Accepted", "Very Interested", "Interested – Needs Revision", "Price Concern", "Needs Callback", "Not Interested"];
export const DEPARTMENTS = ["Sales Strategy", "Digital", "Production", "National Head", "Finance", "Legal"];
export const REQ_STATUS = ["Pending", "In Progress", "Done", "Overdue"];
export const SLA: Record<string, number> = { "Sales Strategy": 24, "Digital": 24, "Production": 48, "National Head": 12, "Finance": 48, "Legal": 72 };
export const QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26"];
export const STAGE_PROB: Record<string, number> = { "Proposal Accepted": 100, "Very Interested": 70, "Interested – Needs Revision": 50, "Price Concern": 30, "Needs Callback": 20, "Not Interested": 0 };

export const TODAY  = new Date().toISOString().split("T")[0];
export const D1     = new Date(Date.now() - 86400000).toISOString().split("T")[0];
export const D3     = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
export const D7     = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
export const D14    = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

export const DEADLINE = "12:00";
export const HR_EMAIL = "hr@odishatv.com";

export const SEED_ABSENCE_REPORTS = [
  { id:"ab1", repId:3, repName:"Rohit Nanda", region:"East", role:"Sales Executive", date:TODAY, generatedAt:"23:59", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent", exception:null as string|null, exceptionBy:null as string|null, exceptionReason:null as string|null, generatedBy:"System (Auto)" },
  { id:"ab2", repId:3, repName:"Rohit Nanda", region:"East", role:"Sales Executive", date:D1,    generatedAt:"23:59", status:"Sent to HR", sentTo:HR_EMAIL, markedAs:"Absent", exception:null as string|null, exceptionBy:null as string|null, exceptionReason:null as string|null, generatedBy:"System (Auto)" },
  { id:"ab3", repId:1, repName:"Arjun Mishra",region:"North",role:"Sales Executive", date:D3,    generatedAt:"23:59", status:"Exception Granted", sentTo:HR_EMAIL, markedAs:"Present", exception:"Overridden" as string|null, exceptionBy:"Litisha (CXO)" as string|null, exceptionReason:"Client emergency — Reliance site visit, phone network down." as string|null, generatedBy:"System (Auto)" },
];

export const REPS = [
  { id: 1, name: "Arjun Mishra",  region: "North",    role: "Sales Executive",          target: 18000000 },
  { id: 2, name: "Priya Dash",    region: "South",    role: "Senior Sales",             target: 22000000 },
  { id: 3, name: "Rohit Nanda",   region: "East",     role: "Sales Executive",          target: 12000000 },
  { id: 4, name: "Sneha Patel",   region: "West",     role: "Senior Sales",             target: 16000000 },
  { id: 5, name: "Vikram Sen",    region: "National", role: "National Account Manager", target: 45000000 },
  { id: 6, name: "Meera Rao",     region: "South",    role: "Sales Executive",          target: 14000000 },
];

export const USER_ROLES = [
  { id: "admin",          name: "Admin",                  role: "ADMIN",          canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "litisha",        name: "Litisha (CXO)",          role: "CXO",            canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "jaggi",          name: "Jaggi (CXO)",            role: "CXO",            canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "sales_head",     name: "Sales Head",             role: "SALES HEAD",     canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "sales_strategy", name: "Sachin (Sales Strategy)",role: "SALES STRATEGY", canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "sales_analysis", name: "Darpan (Sales Analysis)",role: "SALES ANALYSIS", canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "digital",        name: "Digital Team",           role: "DIGITAL",        canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "rh_north",       name: "Region Head – North",   role: "REGION HEAD",    canView: "region", region: "North",    repId: undefined as number|undefined },
  { id: "rh_south",       name: "Region Head – South",   role: "REGION HEAD",    canView: "region", region: "South",    repId: undefined as number|undefined },
  { id: "rh_east",        name: "Region Head – East",    role: "REGION HEAD",    canView: "region", region: "East",     repId: undefined as number|undefined },
  { id: "rh_west",        name: "Region Head – West",    role: "REGION HEAD",    canView: "region", region: "West",     repId: undefined as number|undefined },
  { id: "rh_national",    name: "Region Head – National",role: "REGION HEAD",    canView: "region", region: "National", repId: undefined as number|undefined },
  { id: "rh_central",     name: "Region Head – Central", role: "REGION HEAD",    canView: "region", region: "Central",  repId: undefined as number|undefined },
  { id: "digi_ops",       name: "Digi Ops Team",         role: "DIGI OPS",       canView: "all",    region: null as string|null, repId: undefined as number|undefined },
  { id: "rep_arjun",      name: "Arjun Mishra",          role: "SALES REP",      canView: "self",   region: "North",    repId: 1 },
  { id: "rep_priya",      name: "Priya Dash",            role: "SALES REP",      canView: "self",   region: "South",    repId: 2 },
  { id: "rep_rohit",      name: "Rohit Nanda",           role: "SALES REP",      canView: "self",   region: "East",     repId: 3 },
  { id: "rep_sneha",      name: "Sneha Patel",           role: "SALES REP",      canView: "self",   region: "West",     repId: 4 },
  { id: "rep_vikram",     name: "Vikram Sen",            role: "SALES REP",      canView: "self",   region: "National", repId: 5 },
  { id: "rep_meera",      name: "Meera Rao",             role: "SALES REP",      canView: "self",   region: "South",    repId: 6 },
  { id: "rep_rahul",      name: "Rahul Sharma",          role: "SALES REP",      canView: "self",   region: "North",    repId: 7 },
  { id: "rep_kavya",      name: "Kavya Singh",           role: "SALES REP",      canView: "self",   region: "North",    repId: 8 },
  { id: "rep_manish",     name: "Manish Tiwari",         role: "SALES REP",      canView: "self",   region: "North",    repId: 9 },
  { id: "rep_pooja",      name: "Pooja Agarwal",         role: "SALES REP",      canView: "self",   region: "North",    repId: 10 },
];

export type Req = { dept: string; desc: string; status: string; raisedAt: string };

export type Deal = {
  id: string; repId: number; clientCompany: string; contactName: string;
  designation: string; contactLevel: string; phone: string; email: string;
  dealType: string; outcome: string; amount: number; targetAmount: number;
  region: string; lastContact: string; nextStep: string; nextStepDate: string|null;
  reqs: Req[]; notes: string; priority: string; quarter: string;
  roLinked?: string;
};

export const SEED_DEALS: Deal[] = [
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

export type Meeting = {
  id: string; repId: number; repName: string; region: string; dealId: string;
  clientCompany: string; contactName: string; contactLevel: string;
  outcome: string; discussion: string; nextStep: string;
  date: string; loggedAt: string; late: boolean;
};

export const SEED_MEETINGS: Meeting[] = [
  { id:"ml1", repId:5, repName:"Vikram Sen",  region:"National", dealId:"d1", clientCompany:"Havells India",    contactName:"Deepa Menon",   contactLevel:"VP / GM",       outcome:"Very Interested",            discussion:"Flagship show sponsorship for H2. Budget confirmed.", nextStep:"Send sponsorship deck EOD",  date:TODAY, loggedAt:"09:15", late:false },
  { id:"ml2", repId:2, repName:"Priya Dash",  region:"South",    dealId:"d4", clientCompany:"Berger Paints",    contactName:"Rajesh Kumar",  contactLevel:"Brand Manager", outcome:"Proposal Accepted",          discussion:"Closed 6-week primetime deal. PO by Friday.",         nextStep:"PO follow-up",              date:TODAY, loggedAt:"11:20", late:false },
  { id:"ml3", repId:3, repName:"Rohit Nanda", region:"East",     dealId:"d9", clientCompany:"Bikaji Foods",     contactName:"Ankit Shah",    contactLevel:"Junior/Exec",   outcome:"Needs Callback",             discussion:"Junior exec meeting. No authority.",                  nextStep:"Escalate to BM",            date:TODAY, loggedAt:"13:10", late:true  },
  { id:"ml4", repId:1, repName:"Arjun Mishra",region:"North",    dealId:"d7", clientCompany:"Reliance Retail",  contactName:"Sameer Joshi",  contactLevel:"Marketing Head",outcome:"Interested – Needs Revision", discussion:"Wants digital add-on to existing grid.",              nextStep:"Revised grid with OTT",     date:TODAY, loggedAt:"10:45", late:false },
  { id:"ml5", repId:6, repName:"Meera Rao",   region:"South",    dealId:"d5", clientCompany:"Apollo Hospitals", contactName:"Ravi Krishnan", contactLevel:"VP / GM",       outcome:"Very Interested",            discussion:"Full digital takeover proposal well received.",        nextStep:"Send digital media plan",   date:D1,    loggedAt:"10:30", late:false },
  { id:"ml6", repId:4, repName:"Sneha Patel", region:"West",     dealId:"d6", clientCompany:"Zydus Wellness",   contactName:"Karishma Shah", contactLevel:"Marketing Head",outcome:"Price Concern",               discussion:"20% gap. Competitor Zee also pitching.",             nextStep:"Counter-proposal",          date:D1,    loggedAt:"11:00", late:false },
];

export type AttRecord = Record<string, Record<number, boolean>>;
export const SEED_ATT: AttRecord = {
  [TODAY]: {1:true,2:true,3:false,4:true,5:true,6:true},
  [D1]:    {1:true,2:true,3:true, 4:true,5:true,6:true}
};
