export interface AuditLogEntry {
  at: string;
  by: string;
  role: string;
  action: string;
  from: string | null | undefined;
  to: string | null;
  note?: string;
}

export interface ActionRequired {
  what: string;
  from: string;
  description: string;
  byWhen: string;
}

export interface NextStepItem {
  action: string;
  actionType: string;
  details: string;
  neededFrom: string;
  remarks: string;
  dueDate: string;
}

export interface Deal {
  id: string;
  clientCompany: string;
  zohoAccountId?: string;
  repId?: string;
  repName?: string;
  clientAccountId?: string;
  stage?: string;
  outcome?: string;
  amount?: number;
  targetAmount?: number;
  pipelineAmount?: number;
  pitchType?: string;
  dealType?: string;
  contactLevel?: string;
  region?: string;
  quarter?: string;
  lastContact?: string;
  lastDealMeetingDate?: string;
  nextStep?: string;
  nextStepDate?: string;
  atRisk?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  clientOrAgency?: string;
  brand?: string;
  contactName?: string;
  designation?: string;
  phone?: string;
  email?: string;
  priority?: string;
  channel?: string;
  agencyName?: string;
  zohoAgencyId?: string;
  lossReason?: string;
  actionRequired?: ActionRequired[];
  nextStepItems?: NextStepItem[];
  awaitingApproval?: string | null;
  awaitingApprovalSince?: string | null;
  auditLog?: AuditLogEntry[];
  reqs?: any[];
  _fromRO?: boolean;
  _filename?: string;
}

export interface RevenueEntry {
  id: string;
  repId: string;
  clientCompany: string;
  zohoAccountId?: string;
  amount: number;
  invoiceRef?: string;
  date: string;
  quarter?: string;
  fiscalYear?: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt?: string;
}

export interface Meeting {
  id: string;
  repId?: string | null;
  date: string;
  meetingTime?: string;
  clientCompany?: string;
  clientAgencyName?: string;
  contactPerson?: string;
  contactName?: string;
  designation?: string;
  contactLevel?: string;
  status?: string;
  type?: string;
  meetingType?: string;
  agenda?: string;
  notes?: string;
  outcome?: string;
  nextSteps?: string;
  discussion?: string;
  clientFeedback?: string;
  actionItems?: any[];
  dealId?: string;
  loggedAt?: string;
  loggedLate?: boolean;
  loggedByUserId?: string;
  createdAt?: string;
}

export interface Touchpoint {
  id: string;
  repId?: string;
  clientCompany?: string;
  clientAccountId?: string;
  zohoAccountId?: string;
  dealId?: string;
  date: string;
  time?: string;
  type?: string;
  meetingType?: string;
  touchpointType?: string;
  contactName?: string;
  contactDesignation?: string;
  contactLevel?: string;
  whatHappened?: string;
  clientFeedback?: string;
  stageUpdate?: string;
  actionItems?: any[];
  loggedAt?: string;
  loggedLate?: boolean;
  loggedByUserId?: string;
  notes?: string;
  outcome?: string;
  createdAt?: string;
}

export interface Task {
  id: string;
  title: string;
  assignedTo?: string | null;
  assignedToUserId?: string;
  assignedToName?: string;
  assignedBy?: string;
  assignedByName?: string;
  clientCompany?: string;
  details?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  dept?: string | null;
  repId?: string | null;
  escAt?: string;
  escLevel?: number;
  createdAt?: string;
}

export interface InternalReq {
  id: string;
  repId?: string;
  type?: string;
  dept?: string;
  subject?: string;
  details?: string;
  clientCompany?: string;
  dealId?: string;
  status?: string;
  approvalTarget?: string;
  notes?: string;
  raisedBy?: string;
  escalationAt?: string;
  escLevel?: number;
  escDept?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TargetSub {
  id: string;
  repId: string;
  region?: string;
  quarter: string;
  totalTarget: number;
  status?: string;
  submittedAt?: string;
  submittedByName?: string;
  submittedByRole?: string;
  approvalLog?: any[];
  clients?: TargetSubClient[];
  createdAt?: string;
}

export interface TargetSubClient {
  clientCompany: string;
  amount: number;
}

export interface ClientAccount {
  id: string;
  repId?: string;
  clientName?: string;
  clientCompany: string;
  zohoAccountId?: string;
  industry?: string;
  region?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  currentStage?: string;
  annualTarget?: number;
  priority?: string;
  contactName?: string;
  designation?: string;
  phone?: string;
  email?: string;
  lastContactDate?: string;
  lastDealMeetingDate?: string;
  fiscalYear?: string;
}

export interface UserRole {
  id: string;
  name: string;
  role: string;
  canView: string;
  region?: string | null;
  repId?: string | null;
}

export interface Rep {
  id: string;
  name: string;
  region?: string;
  userId?: string;
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
  auditLog: AuditLogEntry[];
  _fromRO?: any;
}

export interface IrForm {
  type: string;
  dept: string;
  subject: string;
  details: string;
  clientCompany?: string;
  dealId?: string;
  approvalTarget?: string;
}

export interface NoteModalConfig {
  title: string;
  placeholder: string;
  initial?: string;
  onSubmit: (val: string) => void;
}

export interface SavedRO {
  id: string;
  savedAt: string;
  client_name: string;
  brand_name: string;
  agency_name: string;
  channel: string;
  ro_number: string;
  ro_date: string;
  gross_amount: number;
  total_payable: number;
  filename: string;
  data: any;
  status: string;
}

export interface AbsenceReport {
  id: string;
  repId: string;
  date: string;
  reason?: string;
  status?: string;
  markedAs?: string;
  excType?: string;
  reportId?: string;
  escalationAt?: string;
  escLevel?: number;
  escDept?: string;
}

export interface WeeklyPlan {
  id: string;
  repId: string;
  weekStart: string;
  days: Record<string, any>;
  createdAt?: string;
}
