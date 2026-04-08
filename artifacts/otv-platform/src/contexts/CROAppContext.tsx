import React, { createContext, useContext } from "react";

// ── Minimal entity shapes ─────────────────────────────────────────────────────
// Full field modeling is deferred to 12B when the provider is wired.

export type Deal           = Record<string, any> & { id: string; repId: number };
export type Meeting        = Record<string, any> & { id: string; repId: number };
export type Task_          = Record<string, any> & { id: string };
export type TargetSub      = Record<string, any> & { id: string; repId: number };
export type RevenueEntry   = Record<string, any> & { id: string; repId: number };
export type ClientAccount  = Record<string, any> & { id: string; repId: number };
export type Touchpoint     = Record<string, any> & { id: string; repId: number };
export type InternalReq    = Record<string, any> & { id: string };
export type Rep            = Record<string, any> & { id: number; name: string };
export type UserRole       = Record<string, any> & { id: string; name: string; role: string };

// ── Context interface — Tier 2 state only ─────────────────────────────────────
// Tier 1 (view, filterRegion, filterQ, activeUser, isMobile) stays in CROApp as props.
// Tier 3 (view-local form fields, drilldowns, tab state) lives in each extracted view.
// Tier 4 (weeklyPlans, att, absence) is in context but has no DB table yet.

export interface CROAppContextValue {
  // Auth
  user: any;

  // API-backed entity state
  deals: Deal[];                    setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
  meetings: Meeting[];              setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  tasks: Task_[];                   setTasks: React.Dispatch<React.SetStateAction<Task_[]>>;
  targetSubs: TargetSub[];         setTargetSubs: React.Dispatch<React.SetStateAction<TargetSub[]>>;
  revenueEntries: RevenueEntry[];  setRevenueEntries: React.Dispatch<React.SetStateAction<RevenueEntry[]>>;
  clientAccounts: ClientAccount[]; setClientAccounts: React.Dispatch<React.SetStateAction<ClientAccount[]>>;
  touchpoints: Touchpoint[];       setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>>;
  internalReqs: InternalReq[];     setInternalReqs: React.Dispatch<React.SetStateAction<InternalReq[]>>;

  // Persisted blob state
  reps: Rep[];                     setReps: React.Dispatch<React.SetStateAction<Rep[]>>;
  masterClients: string[];         setMasterClients: React.Dispatch<React.SetStateAction<string[]>>;
  clientMasterList: string[];      setClientMasterList: React.Dispatch<React.SetStateAction<string[]>>;
  adminConfig: Record<string, any>; setAdminConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  savedROs: any[];                 setSavedROs: React.Dispatch<React.SetStateAction<any[]>>;

  // Deferred blob state (no DB table yet)
  att: Record<string, any>;        setAtt: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  absenceReports: any[];           setAbsenceReports: React.Dispatch<React.SetStateAction<any[]>>;
  weeklyPlans: any[];              setWeeklyPlans: React.Dispatch<React.SetStateAction<any[]>>;
  properties: any[];               setProperties: React.Dispatch<React.SetStateAction<any[]>>;
  ipProposals: any[];              setIpProposals: React.Dispatch<React.SetStateAction<any[]>>;

  // Attendance hook
  attDbRecords: any[];
  attExcRequests: any[];
  attDbLoading: boolean;
  fetchAttendanceData: () => void;

  // Derived role constants
  user_role: UserRole;
  isRep: boolean;
  isRH: boolean;
  isNSH: boolean;
  isCRORole: boolean;
  isStrategy: boolean;
  isDigiOps: boolean;
  isAdmin: boolean;
  isNSHDashboard: boolean;
  canLogMeeting: boolean;
  canGrantException: boolean;
  rhRegion: string | null;
  activeUser: string;
  setActiveUser: React.Dispatch<React.SetStateAction<string>>;

  // Global filters shared across views
  filterQ: string;
  setFilterQ: React.Dispatch<React.SetStateAction<string>>;
  filterRegion: string;
  setFilterRegion: React.Dispatch<React.SetStateAction<string>>;
  entryQ: string;

  // Computed data
  visibleDeals: Deal[];
  atRisk: any[];
  overdueNext: any[];
  closedRevenue: number;
  repScores: any[];
  qMatch: (q?: string) => boolean;

  // Utility functions
  parseCurrency: (v: any) => number;
  fmt: (n: any) => string;
  fmtR: (n: any) => string;
  daysSince: (d: any) => number;
  uid: () => string;
  dealStage: (d: any) => string;
  oColor: (o: string) => string;
  riskColor: (d: any) => string;
  riskLabel: (d: any) => string;
  lColor: (l: string) => string;
  mapLegacyOutcome: (o: string) => string;
  deptToUserId: (dept: string) => string;
  getAchieved: (repId?: number, fy?: string) => number;
  getCommitted: (repId?: number) => number;
  getInPlay: (repId?: number) => number;
  getShortfall: (target: number, repId?: number) => number;
  getAnnualTarget: (repId?: number) => { amount: number };
  stackedBar: (...args: any[]) => React.ReactNode;

  // Shared handlers
  showToast: (msg: string, type?: string) => void;
  openNoteModal: (title: string, placeholder: string, onSubmit: (val: string) => void) => void;
  pushNotification: (event: Record<string, any>) => void;
  updateOutcome: (id: string, outcome: string) => void;
  approveDeal: (dealId: string, note?: string) => void;
  rejectDeal: (dealId: string, note?: string) => void;
  updateReq: (dealId: string, reqIdx: number, status: string) => void;
  openAddDeal: (prefillDealType?: string) => void;
  handleAddDeal: () => void;
  openSelfTask: () => void;
  grantException: () => void;
  revokeException: (reportId: string) => void;
  fireAbsenceReport: (rep: Rep, date: string) => void;
  runEODCheck: () => void;
  roPushToPipeline: (roResult: any) => void;

  // Global modal state (overlays rendered inside CROApp, triggered from any view)
  addDealOpen: boolean;    setAddDealOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dealForm: any;           setDealForm: React.Dispatch<React.SetStateAction<any>>;
  logOpen: boolean;        setLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  logForm: any;            setLogForm: React.Dispatch<React.SetStateAction<any>>;
  viewMeetingId: string | null;    setViewMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  meetingEditMode: boolean;        setMeetingEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  meetingEditForm: any;            setMeetingEditForm: React.Dispatch<React.SetStateAction<any>>;
  taskModal: boolean;              setTaskModal: React.Dispatch<React.SetStateAction<boolean>>;
  selfTaskMode: boolean;           setSelfTaskMode: React.Dispatch<React.SetStateAction<boolean>>;
  taskForm: any;                   setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  noteModal: any;                  setNoteModal: React.Dispatch<React.SetStateAction<any>>;
  noteModalVal: string;            setNoteModalVal: React.Dispatch<React.SetStateAction<string>>;
  expanded: any;                   setExpanded: React.Dispatch<React.SetStateAction<any>>;
  toast: any;                      setToast: React.Dispatch<React.SetStateAction<any>>;
  profileOpen: boolean;            setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accountThreadOpen: boolean;      setAccountThreadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accountThreadClient: string | null; setAccountThreadClient: React.Dispatch<React.SetStateAction<string | null>>;
  threadAIForm: any;               setThreadAIForm: React.Dispatch<React.SetStateAction<any>>;

  // Lookup constants (views import from context, not from CROApp internals)
  DEAL_STAGES: string[];
  STAGE_PROB: Record<string, number>;
  DEAL_TYPES: string[];
  REGIONS: string[];
  ALL_ROLES: string[];
  QUARTERS: string[];
  C: Record<string, string>;
  TODAY: string;
  TOMORROW: string;
  CURRENT_FY: string;
}

// ── Context + Provider ────────────────────────────────────────────────────────

const CROAppContext = createContext<CROAppContextValue | undefined>(undefined);

export function CROAppProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CROAppContextValue;
}) {
  return <CROAppContext.Provider value={value}>{children}</CROAppContext.Provider>;
}

export function useCROAppContext(): CROAppContextValue {
  const ctx = useContext(CROAppContext);
  if (!ctx) throw new Error("useCROAppContext must be called inside CROAppProvider");
  return ctx;
}

export default CROAppContext;
