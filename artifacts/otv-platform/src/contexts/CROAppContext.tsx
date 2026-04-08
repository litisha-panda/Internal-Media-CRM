import React, { createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CROAppContext — shared state distribution layer for extracted CROApp views
//
// ARCHITECTURE (from task-12a-inventory.md):
//   Tier 1 (CROApp-owned): view, activeUser, filterRegion, filterQ — passed as props
//   Tier 2 (context-shared): everything below — all views call useCROAppContext()
//   Tier 3 (view-local): form fields, drilldowns, tab state — declared in each view
//   Tier 4 (deferred): weeklyPlans, att, absence — no DB table yet, in context as blobs
//
// USAGE IN EXTRACTED VIEWS:
//   const { deals, showToast, isRep, user_role } = useCROAppContext();
//
// TASK 12B will fill in the provider with real values from CROApp's state.
// For now this is a typed scaffold only — provider returns an empty stub.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared entity types (lightweight — full types live in service files) ──────

export interface Deal {
  id: string;
  clientCompany: string;
  zohoAccountId?: string;
  repId: number;
  repName?: string;
  region?: string;
  clientAccountId?: string;
  contactName?: string;
  designation?: string;
  contactLevel?: string;
  phone?: string;
  email?: string;
  dealType?: string;
  outcome?: string;
  stage?: string;
  amount?: number;
  pipelineAmount?: number;
  targetAmount?: number;
  lossReason?: string;
  priority?: string;
  quarter?: string;
  notes?: string;
  nextStep?: string;
  nextStepDate?: string;
  agencyName?: string;
  zohoAgencyId?: string;
  lastContact?: string;
  lastDealMeetingDate?: string;
  atRisk?: boolean;
  awaitingApproval?: string | null;
  awaitingApprovalSince?: string | null;
  auditLog?: any[];
  reqs?: any[];
}

export interface Meeting {
  id: string;
  repId: number;
  date: string;
  time?: string;
  clientCompany?: string;
  clientAgencyName?: string;
  contactName?: string;
  status?: string;
  mode?: string;
  region?: string;
  discussion?: string;
  meetingType?: string;
  meetingKind?: string;
  dealId?: string;
  [key: string]: any;
}

export interface Task {
  id: string;
  title: string;
  assignedTo?: number;
  assignedToUserId?: string;
  assignedBy?: string;
  clientCompany?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  escLevel?: number;
  escAt?: string;
  escDept?: string;
  [key: string]: any;
}

export interface TargetSub {
  id: string;
  repId: number;
  repName?: string;
  region?: string;
  quarter?: string;
  clients?: any[];
  totalTarget?: number;
  frozenTarget?: number;
  status?: string;
  submittedAt?: string;
  submittedByName?: string;
  submittedByRole?: string;
  approvalLog?: any[];
}

export interface RevenueEntry {
  id: string;
  repId: number;
  clientCompany?: string;
  zohoAccountId?: string;
  dealType?: string;
  amount?: number;
  invoiceRef?: string;
  date?: string;
  quarter?: string;
  fiscalYear?: string;
  notes?: string;
}

export interface ClientAccount {
  id: string;
  clientName: string;
  repId: number;
  zohoAccountId?: string;
  region?: string;
  fiscalYear?: string;
  annualTarget?: number;
  currentStage?: string;
  lastContactDate?: string;
  lastDealMeetingDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Touchpoint {
  id: string;
  clientAccountId?: string;
  dealId?: string;
  repId: number;
  date?: string;
  time?: string;
  meetingType?: string;
  touchpointType?: string;
  contactName?: string;
  [key: string]: any;
}

export interface InternalReq {
  id: string;
  type?: string;
  dept?: string;
  subject?: string;
  details?: string;
  clientCompany?: string;
  status?: string;
  raisedBy?: string;
  assignedToUserId?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface Rep {
  id: number;
  repId?: number;
  name: string;
  region?: string;
  role?: string;
  target?: number;
  active?: boolean;
  reportingManager?: string;
}

export interface UserRole {
  id: string;
  name: string;
  role: string;
  canView: "self" | "region" | "all";
  region: string | null;
  repId?: number;
}

export interface AdminConfig {
  approvalThresholds?: { RH: number; NSH: number; CXO: number };
  slaHours?: Record<string, number>;
  inactivityDaysRisk?: number;
  inactivityDaysEscalate?: number;
  webhookUrl?: string;
  platformLive?: boolean;
  launchDate?: string;
}

// ── Blank form shapes (used by global modals) ─────────────────────────────────

export interface DealForm {
  clientCompany: string;
  zohoAccountId: string;
  repId: string;
  clientAccountId: string;
  contactName: string;
  designation: string;
  contactLevel: string;
  phone: string;
  email: string;
  dealType: string;
  outcome: string;
  stage: string;
  amount: string;
  pipelineAmount: string;
  targetAmount: string;
  lossReason: string;
  priority: string;
  quarter: string;
  notes: string;
  nextStep: string;
  nextStepDate: string;
  agencyName: string;
  zohoAgencyId: string;
  reqs: any[];
  auditLog: any[];
  [key: string]: any;
}

export interface LogForm {
  repId: string;
  planId: string;
  meetingDbId: string;
  meetingTime: string;
  clientOrAgency: string;
  dealId: string;
  clientAgencyName: string;
  agency: string;
  client: string;
  brand: string;
  dealAmount: string;
  contactName: string;
  designation: string;
  mobile: string;
  meetingType: string;
  meetingKind: string;
  touchpointType: string;
  contactLevel: string;
  discussion: string;
  clientFeedback: string;
  stageUpdate: string;
  lossReason: string;
  pitchType: string;
  nextSteps: string;
  followUpDate: string;
  status: string;
  actionRequired: any[];
  scheduleNext: boolean;
  nextMeetingDate: string;
  nextMeetingTime: string;
  nextAgenda: string;
  [key: string]: any;
}

export interface TaskForm {
  title: string;
  assignedTo: string;
  assignedToUserId: string;
  clientCompany: string;
  description: string;
  priority: string;
  dueDate: string;
}

// ── Main context interface ────────────────────────────────────────────────────

export interface CROAppContextValue {
  // ── Auth user ──
  user: any;

  // ── API-backed entity state ──
  deals: Deal[];
  setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  targetSubs: TargetSub[];
  setTargetSubs: React.Dispatch<React.SetStateAction<TargetSub[]>>;
  revenueEntries: RevenueEntry[];
  setRevenueEntries: React.Dispatch<React.SetStateAction<RevenueEntry[]>>;
  clientAccounts: ClientAccount[];
  setClientAccounts: React.Dispatch<React.SetStateAction<ClientAccount[]>>;
  touchpoints: Touchpoint[];
  setTouchpoints: React.Dispatch<React.SetStateAction<Touchpoint[]>>;
  internalReqs: InternalReq[];
  setInternalReqs: React.Dispatch<React.SetStateAction<InternalReq[]>>;

  // ── Persisted blob state (deferred DB migration) ──
  reps: Rep[];
  setReps: React.Dispatch<React.SetStateAction<Rep[]>>;
  masterClients: string[];
  setMasterClients: React.Dispatch<React.SetStateAction<string[]>>;
  adminConfig: AdminConfig;
  setAdminConfig: React.Dispatch<React.SetStateAction<AdminConfig>>;
  att: Record<string, Record<string | number, boolean>>;
  setAtt: React.Dispatch<React.SetStateAction<Record<string, Record<string | number, boolean>>>>;
  absenceReports: any[];
  setAbsenceReports: React.Dispatch<React.SetStateAction<any[]>>;
  weeklyPlans: any[];
  setWeeklyPlans: React.Dispatch<React.SetStateAction<any[]>>;
  savedROs: any[];
  setSavedROs: React.Dispatch<React.SetStateAction<any[]>>;
  properties: any[];
  setProperties: React.Dispatch<React.SetStateAction<any[]>>;
  ipProposals: any[];
  setIpProposals: React.Dispatch<React.SetStateAction<any[]>>;
  clientMasterList: string[];
  setClientMasterList: React.Dispatch<React.SetStateAction<string[]>>;

  // ── Attendance hook output ──
  attDbRecords: any[];
  attExcRequests: any[];
  attDbLoading: boolean;
  fetchAttendanceData: () => void;

  // ── Admin user management ──
  pendingUsers: any[];
  setPendingUsers: React.Dispatch<React.SetStateAction<any[]>>;
  liveRoles: any[];
  setLiveRoles: React.Dispatch<React.SetStateAction<any[]>>;
  adminUsersLoading: boolean;
  adminUsersError: string | null;
  refreshAdminUsers: () => Promise<void>;

  // ── Derived role constants ──
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

  // ── Global filters (shared across views) ──
  filterQ: string;
  setFilterQ: React.Dispatch<React.SetStateAction<string>>;
  filterRegion: string;
  setFilterRegion: React.Dispatch<React.SetStateAction<string>>;
  entryQ: string;

  // ── Computed data ──
  visibleDeals: Deal[];
  atRisk: ClientAccount[];
  overdueNext: Deal[];
  closedRevenue: number;
  repScores: any[];
  getAchieved: (repId?: number, fy?: string) => number;
  getCommitted: (repId?: number) => number;
  getInPlay: (repId?: number) => number;
  getShortfall: (target: number, repId?: number) => number;
  getAnnualTarget: (repId?: number) => { amount: number };
  stackedBar: (target: number, ach: number, comm: number, inpl: number, sf: number, mt?: number) => React.ReactNode;
  qMatch: (q?: string) => boolean;

  // ── Shared utility functions ──
  parseCurrency: (v: any) => number;
  fmt: (n: any) => string;
  fmtR: (n: any) => string;
  daysSince: (d: any) => number;
  uid: () => string;
  dealStage: (d: Deal) => string;
  oColor: (o: string) => string;
  riskColor: (d: Deal) => string;
  riskLabel: (d: Deal) => string;
  lColor: (l: string) => string;
  mapLegacyOutcome: (o: string) => string;
  deptToUserId: (dept: string) => string;

  // ── Shared handlers ──
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

  // ── Global modal state ──
  addDealOpen: boolean;
  setAddDealOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dealForm: DealForm;
  setDealForm: React.Dispatch<React.SetStateAction<DealForm>>;
  logOpen: boolean;
  setLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  logForm: LogForm;
  setLogForm: React.Dispatch<React.SetStateAction<LogForm>>;
  viewMeetingId: string | null;
  setViewMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  meetingEditMode: boolean;
  setMeetingEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  meetingEditForm: any;
  setMeetingEditForm: React.Dispatch<React.SetStateAction<any>>;
  taskModal: boolean;
  setTaskModal: React.Dispatch<React.SetStateAction<boolean>>;
  selfTaskMode: boolean;
  setSelfTaskMode: React.Dispatch<React.SetStateAction<boolean>>;
  taskForm: TaskForm;
  setTaskForm: React.Dispatch<React.SetStateAction<TaskForm>>;
  noteModal: { title: string; placeholder: string; onSubmit: (val: string) => void } | null;
  setNoteModal: React.Dispatch<React.SetStateAction<any>>;
  noteModalVal: string;
  setNoteModalVal: React.Dispatch<React.SetStateAction<string>>;
  expanded: any;
  setExpanded: React.Dispatch<React.SetStateAction<any>>;
  toast: { msg: string; type: string } | null;
  setToast: React.Dispatch<React.SetStateAction<any>>;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accountThreadOpen: boolean;
  setAccountThreadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accountThreadClient: string | null;
  setAccountThreadClient: React.Dispatch<React.SetStateAction<string | null>>;
  threadAIForm: any;
  setThreadAIForm: React.Dispatch<React.SetStateAction<any>>;

  // ── Lookup constants (passed through so views don't import from CROApp) ──
  DEAL_STAGES: string[];
  STAGE_PROB: Record<string, number>;
  DEAL_TYPES: string[];
  REGIONS: string[];
  ALL_ROLES: string[];
  CONTACT_LEVELS: string[];
  MEETING_TYPES: string[];
  TASK_PRIORITIES: string[];
  TASK_STATUSES: string[];
  DEPARTMENTS: string[];
  REQ_STATUS: string[];
  PITCH_TYPES: string[];
  QUARTERS: string[];
  TARGET_APPROVAL_CHAIN: string[];
  C: Record<string, string>;
  TODAY: string;
  TOMORROW: string;
  CURRENT_FY: string;
}

// ── Context object ────────────────────────────────────────────────────────────

const CROAppContext = createContext<CROAppContextValue | undefined>(undefined);

// ── Provider stub — Task 12B will replace this with the real implementation ───

/**
 * CROAppProvider
 *
 * Task 12A: This is a STUB only. The value prop is not yet populated.
 * Task 12B will integrate this provider into CROApp.tsx, passing all
 * Tier 2 state from CROApp's component scope into this provider's value.
 */
export function CROAppProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CROAppContextValue;
}) {
  return (
    <CROAppContext.Provider value={value}>
      {children}
    </CROAppContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useCROAppContext(): CROAppContextValue {
  const ctx = useContext(CROAppContext);
  if (!ctx) {
    throw new Error(
      "useCROAppContext must be used inside a CROAppProvider. " +
      "Ensure the extracted view is rendered within CROApp's provider tree."
    );
  }
  return ctx;
}

export default CROAppContext;
