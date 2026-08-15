import type { AttendanceReason, AttendanceRecord } from "./types";
import type { KpiPeriod } from "./kpi";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function isDateStringWithinPeriod(dateStr: string, period: KpiPeriod, now: Date): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  if (period === "all_time") return true;
  if (period === "last_30_days") return d.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return monthKey(d) === monthKey(now);
}

export interface DesignerAttendanceSummary {
  designerId: string;
  designerName: string;
  period: KpiPeriod;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  mcDays: number;
  absentDays: number;
  totalMarkedDays: number;
  /** Same formula as kpi.ts's attendance signal: present=1, late/half=0.5, absent=0, leave excluded. */
  attendanceRate: number | null;
  reasonBreakdown: Partial<Record<AttendanceReason, number>>;
}

/** `records` must already be scoped to this one designer. */
export function summarizeAttendance(
  designerId: string,
  designerName: string,
  records: AttendanceRecord[],
  period: KpiPeriod,
  now: Date = new Date()
): DesignerAttendanceSummary {
  const inPeriod = records.filter((r) => isDateStringWithinPeriod(r.date, period, now));

  const presentDays = inPeriod.filter((r) => r.status === "present").length;
  const lateDays = inPeriod.filter((r) => r.status === "late").length;
  const halfDays = inPeriod.filter((r) => r.status === "half_day").length;
  const leaveDays = inPeriod.filter((r) => r.status === "leave").length;
  const mcDays = inPeriod.filter((r) => r.status === "mc").length;
  const absentDays = inPeriod.filter((r) => r.status === "absent").length;

  const scored = inPeriod.filter((r) => r.status !== "leave" && r.status !== "mc");
  const scoreSum = scored.reduce((sum, r) => {
    if (r.status === "present") return sum + 1;
    if (r.status === "late" || r.status === "half_day") return sum + 0.5;
    return sum; // absent
  }, 0);
  const attendanceRate = scored.length > 0 ? (scoreSum / scored.length) * 100 : null;

  const reasonBreakdown: Partial<Record<AttendanceReason, number>> = {};
  for (const r of inPeriod) {
    if (r.reason) reasonBreakdown[r.reason] = (reasonBreakdown[r.reason] ?? 0) + 1;
  }

  return {
    designerId,
    designerName,
    period,
    presentDays,
    lateDays,
    halfDays,
    leaveDays,
    mcDays,
    absentDays,
    totalMarkedDays: inPeriod.length,
    attendanceRate,
    reasonBreakdown,
  };
}
