export type UserRole = "admin" | "designer";

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

export interface AttendanceRecord {
  id: string;
  designerId: string;
  designerName: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  markedBy: string | null;
  markedAt: string | null;
}
