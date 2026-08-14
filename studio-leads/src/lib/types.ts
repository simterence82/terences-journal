// Three tiers: a designer only ever sees their own leads/attendance/KPI;
// an admin runs day-to-day operations (leads, attendance, approving new
// designers); a super admin does everything an admin does, plus is the
// only one who can create/edit/remove other admins (or super admins) --
// see firestore.rules and Users.tsx.
export const USER_ROLES = ["super_admin", "admin", "designer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  designer: "Designer",
};

/** "admin" and "super_admin" both get the full (unscoped) view of leads/attendance/etc. */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/** The shape hooks need to decide how much data to fetch/show. */
export interface Viewer {
  id: string;
  role: UserRole;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string | null;
}

export interface PendingUser {
  id: string;
  email: string;
  displayName: string;
  requestedAt: string | null;
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quotation_sent",
  "follow_up",
  "on_hold",
  "signed",
  "rejected",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quotation_sent: "Quotation Sent",
  follow_up: "Following Up",
  on_hold: "On Hold",
  signed: "Signed (Won)",
  rejected: "Rejected (Lost)",
};

// A lead is "closed" once it reaches one of these -- no more follow-up is
// expected, and it's excluded from overdue/SLA tracking.
export const CLOSED_LEAD_STATUSES: LeadStatus[] = ["signed", "rejected"];

export const LEAD_SOURCES = [
  "Walk-in",
  "Referral",
  "Website",
  "Instagram",
  "Facebook",
  "Showroom",
  "Phone Enquiry",
  "Other",
] as const;

export const PROJECT_TYPES = ["Residential", "Commercial", "Renovation", "New Build", "Other"] as const;

export interface Lead {
  id: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string;
  projectType: string;
  address: string | null;
  budget: number | null;
  notes: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  status: LeadStatus;
  quotationAmount: number | null;
  nextFollowUpDate: string | null;
  firstContactedAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  assignedAt: string | null;
}

export const FOLLOW_UP_METHODS = ["Call", "WhatsApp", "Email", "Meeting", "Site Visit", "Other"] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];

export interface FollowUp {
  id: string;
  leadId: string;
  method: FollowUpMethod;
  outcome: string;
  nextFollowUpDate: string | null;
  loggedBy: string | null;
  loggedByName: string;
  loggedAt: string;
}

export const ATTENDANCE_STATUSES = ["present", "late", "half_day", "leave", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  half_day: "Half Day",
  leave: "On Leave",
  absent: "Absent",
};

// Why someone isn't (fully) in office -- set whenever status isn't
// "present". Singapore-workplace-flavoured but easy to extend.
export const ATTENDANCE_REASONS = [
  "annual_leave",
  "mc",
  "childcare_leave",
  "compassionate_leave",
  "unpaid_leave",
  "off_in_lieu",
  "unauthorized",
  "other",
] as const;
export type AttendanceReason = (typeof ATTENDANCE_REASONS)[number];

export const ATTENDANCE_REASON_LABELS: Record<AttendanceReason, string> = {
  annual_leave: "Annual Leave",
  mc: "MC (Medical Certificate)",
  childcare_leave: "Childcare Leave",
  compassionate_leave: "Compassionate Leave",
  unpaid_leave: "Unpaid Leave",
  off_in_lieu: "Off In Lieu",
  unauthorized: "Unauthorized / No Notice",
  other: "Other",
};

export interface AttendanceRecord {
  id: string;
  designerId: string;
  designerName: string;
  date: string;
  status: AttendanceStatus;
  reason: AttendanceReason | null;
  notes: string | null;
  markedBy: string | null;
  markedAt: string | null;
}
