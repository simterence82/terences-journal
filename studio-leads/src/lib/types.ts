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

// A lead with assignedTo == null is "open to designers" -- unclaimed,
// visible to every designer, and any one of them can claim it (assigns it
// to themselves). Used as the sentinel value in the "Assign To" dropdown;
// the actual stored value is assignedTo: null, assignedToName: this label.
export const OPEN_TO_DESIGNERS = "__open_to_designers__";
export const OPEN_TO_DESIGNERS_LABEL = "Open to Designers";

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
  // Only meaningful once status is "signed" -- the actual contracted
  // value (before GST), which can differ from the quotation. Required to
  // save a lead as signed; the quotation amount is frozen (read-only)
  // once signed.
  contractAmount: number | null;
  // Whether GST applies to contractAmount. null = not yet indicated.
  gstApplicable: boolean | null;
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
  "holiday",
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
  holiday: "Holiday",
  mc: "MC (Medical Certificate)",
  childcare_leave: "Childcare Leave",
  compassionate_leave: "Compassionate Leave",
  unpaid_leave: "Unpaid Leave",
  off_in_lieu: "Off In Lieu",
  unauthorized: "Unauthorized / No Notice",
  other: "Other",
};

// Reasons a designer can self-select when applying for leave -- excludes
// "unauthorized" (only makes sense as something an admin assigns after
// the fact, for a no-show) and "off_in_lieu" (not something a designer
// applies for in advance).
export const LEAVE_REASONS: AttendanceReason[] = ATTENDANCE_REASONS.filter((r) => r !== "unauthorized" && r !== "off_in_lieu");

// A designer's self-applied leave starts "pending" and only shows up in
// the away calendars once an admin approves it; leave an admin marks
// directly (Mark Today / Calendar tab) is auto-"approved" since they
// already have the authority. null for non-"leave" statuses, where
// approval doesn't apply.
export const LEAVE_APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveApprovalStatus = (typeof LEAVE_APPROVAL_STATUSES)[number];

export const LEAVE_APPROVAL_LABELS: Record<LeaveApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Not Approved",
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
  leaveApproval: LeaveApprovalStatus | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// Showroom tracking (admin/super admin only): stock, equipment, and
// issues in the physical showroom -- drinks/pantry running low, aircon
// servicing due, something reported faulty, new materials that came in.
export const SHOWROOM_CATEGORIES = [
  "pantry_drinks",
  "pantry_supplies",
  "aircon_servicing",
  "faulty_report",
  "new_materials",
  "other",
] as const;
export type ShowroomCategory = (typeof SHOWROOM_CATEGORIES)[number];

export const SHOWROOM_CATEGORY_LABELS: Record<ShowroomCategory, string> = {
  pantry_drinks: "Drinks",
  pantry_supplies: "Pantry Supplies",
  aircon_servicing: "Aircon & Servicing",
  faulty_report: "Faulty / Report Issue",
  new_materials: "Materials and Samples",
  other: "Other",
};

// Physical areas an Aircon & Servicing item can be tagged against -- a
// service call can cover more than one, hence a checklist rather than a
// single select. Only meaningful for category "aircon_servicing".
export const SERVICE_AREAS = ["Showroom Entrance", "Dining Area", "Designer Room", "My Office"] as const;
export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const SHOWROOM_STATUSES = ["ok", "low_stock", "needs_attention", "faulty", "servicing_needed", "servicing_scheduled", "resolved"] as const;
export type ShowroomStatus = (typeof SHOWROOM_STATUSES)[number];

export const SHOWROOM_STATUS_LABELS: Record<ShowroomStatus, string> = {
  ok: "OK",
  low_stock: "Low Stock",
  needs_attention: "Needs Attention",
  faulty: "Faulty",
  servicing_needed: "Servicing Needed",
  servicing_scheduled: "Servicing Scheduled",
  resolved: "Resolved",
};

// Statuses that mean "this still needs someone to do something about it".
export const OPEN_SHOWROOM_STATUSES: ShowroomStatus[] = ["low_stock", "needs_attention", "faulty", "servicing_needed", "servicing_scheduled"];
export const CLOSED_SHOWROOM_STATUSES: ShowroomStatus[] = ["ok", "resolved"];

// The subset of statuses offered when first adding an Aircon & Servicing
// item -- deliberately excludes "resolved"/"ok" (nothing's been done yet)
// and the other categories' statuses. Admin flips it to "Resolved" via the
// full status list in the edit dialog once the servicing/repair is done.
export const AIRCON_ADD_STATUSES: ShowroomStatus[] = ["servicing_needed", "servicing_scheduled", "faulty", "needs_attention"];

export interface ShowroomItem {
  id: string;
  category: ShowroomCategory;
  title: string;
  description: string | null;
  status: ShowroomStatus;
  notes: string | null;
  reportedBy: string | null;
  reportedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
  // Local datetime string (from a <input type="datetime-local">), e.g.
  // "2026-03-14T14:30". Only ever set for category == "aircon_servicing"
  // with status == "servicing_scheduled" -- drives the servicing calendar
  // on that category's page. Null otherwise.
  scheduledAt: string | null;
  // Areas a servicing call covers. Only meaningful for category ==
  // "aircon_servicing"; empty for every other category.
  areas: ServiceArea[];
}
