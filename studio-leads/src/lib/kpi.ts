import { CLOSED_LEAD_STATUSES, type AttendanceRecord, type Lead } from "./types";

/**
 * The whole grading model in one place, deliberately simple and tunable:
 * four ingredients, each independently meaningful, combined into one
 * "Commitment Score" out of 100. Adjust SLA_RESPONSE_HOURS or WEIGHTS below
 * to match how your studio actually wants to grade follow-up discipline.
 */

// How long a designer has to make first contact after a lead lands with
// them before it counts as a late response. 24h is a common sales-team
// default for a walk-in/referral lead -- tune to taste.
export const SLA_RESPONSE_HOURS = 24;

export const KPI_WEIGHTS = {
  response: 30, // did they contact the customer promptly?
  followUp: 25, // are they keeping up with ongoing follow-ups (nothing overdue)?
  conversion: 25, // of the leads they closed, how many did they win?
  attendance: 20, // are they actually showing up?
} as const;

export type KpiPeriod = "this_month" | "last_30_days" | "all_time";

export const KPI_PERIOD_LABELS: Record<KpiPeriod, string> = {
  this_month: "This Month",
  last_30_days: "Last 30 Days",
  all_time: "All Time",
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function isIsoWithinPeriod(iso: string | null, period: KpiPeriod, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (period === "all_time") return true;
  if (period === "last_30_days") return d.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return monthKey(d) === monthKey(now);
}

function isDateStringWithinPeriod(dateStr: string, period: KpiPeriod, now: Date): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  if (period === "all_time") return true;
  if (period === "last_30_days") return d.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return monthKey(d) === monthKey(now);
}

export interface DesignerKpi {
  designerId: string;
  designerName: string;
  period: KpiPeriod;
  leadsAssigned: number;
  responseRate: number | null;
  responseSampleSize: number;
  followUpComplianceRate: number | null;
  overdueOpenLeads: number;
  openLeadsTracked: number;
  conversionRate: number | null;
  signedCount: number;
  rejectedCount: number;
  signedValue: number;
  attendanceRate: number | null;
  attendanceDaysTracked: number;
  commitmentScore: number | null;
}

export interface Grade {
  letter: string;
  label: string;
  tone: "ok" | "brand" | "warn" | "bad";
}

export function gradeForScore(score: number | null): Grade | null {
  if (score === null) return null;
  if (score >= 90) return { letter: "A+", label: "Outstanding", tone: "ok" };
  if (score >= 80) return { letter: "A", label: "Excellent", tone: "ok" };
  if (score >= 65) return { letter: "B", label: "Solid", tone: "brand" };
  if (score >= 50) return { letter: "C", label: "Needs Improvement", tone: "warn" };
  return { letter: "D", label: "At Risk", tone: "bad" };
}

/**
 * `leads` and `attendance` must already be scoped to this one designer
 * (assignedTo / designerId == designerId) -- the caller does that filtering
 * once per designer.
 */
export function computeDesignerKpi(
  designerId: string,
  designerName: string,
  leads: Lead[],
  attendance: AttendanceRecord[],
  period: KpiPeriod,
  now: Date = new Date()
): DesignerKpi {
  const leadsAssigned = leads.filter((l) => isIsoWithinPeriod(l.assignedAt ?? l.createdAt, period, now)).length;

  // Response promptness: only judge leads whose SLA window has actually
  // elapsed (assignedAt + SLA hours in the past) and were assigned within
  // the period -- a lead handed over 2 hours ago isn't "late" yet.
  const slaMs = SLA_RESPONSE_HOURS * 60 * 60 * 1000;
  const decided = leads.filter((l) => {
    const assignedAt = l.assignedAt ?? l.createdAt;
    if (!isIsoWithinPeriod(assignedAt, period, now)) return false;
    return now.getTime() - new Date(assignedAt).getTime() >= slaMs;
  });
  const onTime = decided.filter((l) => {
    if (!l.firstContactedAt) return false;
    const assignedAt = new Date(l.assignedAt ?? l.createdAt).getTime();
    return new Date(l.firstContactedAt).getTime() - assignedAt <= slaMs;
  });
  const responseSampleSize = decided.length;
  const responseRate = responseSampleSize > 0 ? (onTime.length / responseSampleSize) * 100 : null;

  // Follow-up compliance is a snapshot of the current backlog, not scoped
  // to the period -- "am I on top of my open leads right now?"
  const openLeads = leads.filter((l) => !CLOSED_LEAD_STATUSES.includes(l.status) && l.nextFollowUpDate);
  const today = now.toISOString().slice(0, 10);
  const overdueOpenLeads = openLeads.filter((l) => l.nextFollowUpDate! < today).length;
  const followUpComplianceRate = openLeads.length > 0 ? ((openLeads.length - overdueOpenLeads) / openLeads.length) * 100 : null;

  // Conversion: of the leads this designer actually closed in the period,
  // how many did they win?
  const closedInPeriod = leads.filter((l) => isIsoWithinPeriod(l.closedAt, period, now));
  const signed = closedInPeriod.filter((l) => l.status === "signed");
  const rejected = closedInPeriod.filter((l) => l.status === "rejected");
  const conversionRate = signed.length + rejected.length > 0 ? (signed.length / (signed.length + rejected.length)) * 100 : null;
  const signedValue = signed.reduce((sum, l) => sum + (l.quotationAmount ?? 0), 0);

  // Attendance: present/late/half-day count toward showing up; leave is
  // excluded (approved absence shouldn't count against commitment);
  // unexplained absence drags the score down.
  const attendanceInPeriod = attendance.filter((a) => isDateStringWithinPeriod(a.date, period, now) && a.status !== "leave");
  const attendanceScoreSum = attendanceInPeriod.reduce((sum, a) => {
    if (a.status === "present") return sum + 1;
    if (a.status === "late" || a.status === "half_day") return sum + 0.5;
    return sum; // absent
  }, 0);
  const attendanceRate = attendanceInPeriod.length > 0 ? (attendanceScoreSum / attendanceInPeriod.length) * 100 : null;

  const parts: Array<{ value: number | null; weight: number }> = [
    { value: responseRate, weight: KPI_WEIGHTS.response },
    { value: followUpComplianceRate, weight: KPI_WEIGHTS.followUp },
    { value: conversionRate, weight: KPI_WEIGHTS.conversion },
    { value: attendanceRate, weight: KPI_WEIGHTS.attendance },
  ];
  const totalWeight = parts.reduce((sum, p) => (p.value !== null ? sum + p.weight : sum), 0);
  const commitmentScore =
    totalWeight > 0 ? parts.reduce((sum, p) => (p.value !== null ? sum + p.value * p.weight : sum), 0) / totalWeight : null;

  return {
    designerId,
    designerName,
    period,
    leadsAssigned,
    responseRate,
    responseSampleSize,
    followUpComplianceRate,
    overdueOpenLeads,
    openLeadsTracked: openLeads.length,
    conversionRate,
    signedCount: signed.length,
    rejectedCount: rejected.length,
    signedValue,
    attendanceRate,
    attendanceDaysTracked: attendanceInPeriod.length,
    commitmentScore,
  };
}
