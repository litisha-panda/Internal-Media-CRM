/**
 * Shared domain constants for OTV CRM.
 * Import in both the API server and the frontend — single source of truth.
 *
 * RULES:
 *  - Never use string literals for these values — always reference these exports.
 *  - Keep in sync with DB check constraints (applied in schema via notNull + default).
 */

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = [
  "SALES REP",
  "REGION HEAD",
  "SALES HEAD",
  "SALES STRATEGY",
  "CRO",
  "DIGI OPS",
  "ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const ELEVATED_ALL  = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY", "REGION HEAD"] as const;
export const ELEVATED_MGMT = ["ADMIN", "SALES HEAD", "CRO", "SALES STRATEGY"] as const;

// ─── Regions ─────────────────────────────────────────────────────────────────
export const REGIONS = [
  "Bhubaneswar",
  "Cuttack",
  "Rourkela",
  "Berhampur",
  "Sambalpur",
  "Delhi",
  "Mumbai",
  "Kolkata",
  "Hyderabad",
  "Bangalore",
] as const;
export type Region = (typeof REGIONS)[number];

// ─── Deal stages & probabilities ─────────────────────────────────────────────
export const DEAL_STAGES = [
  "Quotation",
  "Rate Card",
  "Negotiation",
  "Some Other Solution",
  "Meeting with Senior",
  "Follow Up",
  "Proposal",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const STAGE_PROB: Record<string, number> = {
  "Quotation":             10,
  "Rate Card":             25,
  "Negotiation":           65,
  "Some Other Solution":   30,
  "Meeting with Senior":   50,
  "Follow Up":             35,
  "Proposal":              40,
  // Legacy labels — kept for backward compat with existing DB rows
  "In Discussion":         40,
  "Mail Confirmed":        90,
};

// Stages that score 0 pipeline weight. These are completed or dead deals — not in the active funnel.
// Existing DB rows with these legacy values will be excluded from pipeline totals.
export const CLOSED_STAGES = new Set<string>([
  "RO Received",
  "Won",
  "Lost",
  "Cancelled",
  "Archived",
  "On Hold",
]);

// ─── Deal types ───────────────────────────────────────────────────────────────
export const DEAL_TYPES = [
  "Sponsorship",
  "Spot",
  "Property",
  "Package",
  "Digital",
  "Event",
  "Other",
] as const;
export type DealType = (typeof DEAL_TYPES)[number];

// ─── Priority levels ──────────────────────────────────────────────────────────
export const PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// ─── Task statuses ────────────────────────────────────────────────────────────
export const TASK_STATUSES = ["Open", "In Progress", "Done", "Overdue", "Cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// ─── Internal Request departments ────────────────────────────────────────────
export const IR_DEPTS = [
  "Sales Strategy",
  "NSH",
  "CRO",
  "Region Head",
  "Digital",
  "Finance",
  "Marketing",
  "Legal",
  "Admin",
  "Other",
] as const;
export type IRDept = (typeof IR_DEPTS)[number];

/** Maps IR dept label → canonical receiving role */
export const DEPT_TO_ROLE: Record<string, string> = {
  "NSH":              "SALES HEAD",
  "Sales Strategy":   "SALES STRATEGY",
  "CRO":              "CRO",
  "Region Head":      "REGION HEAD",
  "Digital":          "DIGI OPS",
  "Finance":          "ADMIN",
  "Marketing":        "ADMIN",
  "Legal":            "ADMIN",
  "Admin":            "ADMIN",
  "Other":            "ADMIN",
};

/** SLA hours per dept (how long before escalation kicks in) */
export const DEPT_SLA_HOURS: Record<string, number> = {
  "Sales Strategy": 48,
  "NSH":            48,
  "CRO":            72,
  "Region Head":    24,
  "Digital":        48,
  "Finance":        96,
  "Marketing":      72,
  "Legal":         120,
  "Admin":          48,
  "Other":          48,
};

// ─── IR subtypes ──────────────────────────────────────────────────────────────
export const IR_SUBTYPES = [
  "Support Request",
  "Deal Escalation",
  "Override Request",
  "Attendance Exception",
  "Other",
] as const;
export type IRSubtype = (typeof IR_SUBTYPES)[number];

// ─── IR statuses ──────────────────────────────────────────────────────────────
export const IR_STATUSES = [
  "Pending",
  "Accepted",
  "In Progress",
  "Done",
  "Rejected",
  "Withdrawn",
  "Overdue",
] as const;
export type IRStatus = (typeof IR_STATUSES)[number];

// ─── Target approval chain ────────────────────────────────────────────────────
// 4-level chain: Region Head → National Sales Head → Sales Strategy → CRO
export const TARGET_APPROVAL_CHAIN: Record<string, string> = {
  "Pending RH":       "REGION HEAD",
  "Pending NSH":      "SALES HEAD",
  "Pending Strategy": "SALES STRATEGY",
  "Pending CRO":      "CRO",
};

export const TARGET_NEXT_STATUS: Record<string, string> = {
  "Pending RH":       "Pending NSH",
  "Pending NSH":      "Pending Strategy",
  "Pending Strategy": "Pending CRO",
  "Pending CRO":      "Approved",
};

// ─── Fiscal quarters ─────────────────────────────────────────────────────────
export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type Quarter = (typeof QUARTERS)[number];

// ─── Governance constants ─────────────────────────────────────────────────────
export const STALL_DAYS       = 7;    // days without contact → deal at-risk
export const APPROVAL_SLA_DAYS = 2;   // days awaiting approval → flag deal
export const ESC_HOP_HOURS    = 12;   // hours between escalation hops
export const ESC_CHAIN        = ["Region Head", "NSH", "Sales Strategy", "CRO"] as const;
export const TASK_REMINDER_HOURS = 24; // hours before due → send reminder notification

// ─── Target client allocation structure ──────────────────────────────────────
/**
 * One line item in a target submission.
 * The `clients` array in targetSubmissions must conform to this shape.
 */
export interface ClientAllocation {
  clientName:      string;
  zohoAccountId?:  string | null;
  allocatedAmount: number;
  channel?:        string | null;    // e.g. "TV Spot", "Sponsorship", "Digital"
  dealType?:       string | null;    // from DEAL_TYPES
  notes?:          string | null;
}

// ─── Touchpoint types ─────────────────────────────────────────────────────────
export const TOUCHPOINT_TYPES = [
  "Deal Meeting",
  "Relationship",
  "Proposal Walkthrough",
  "Negotiation Call",
  "Follow Up",
  "Site Visit",
  "Other",
] as const;
export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];
