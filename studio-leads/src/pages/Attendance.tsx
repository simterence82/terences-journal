import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, ClipboardList, Download, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceList, useLeaveCalendarList, useMarkAttendance, useSetLeaveApproval } from "../hooks/useAttendance";
import { useDesignersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { summarizeAttendance, type DesignerAttendanceSummary } from "../lib/attendanceSummary";
import { buildMonthGrid, monthLabel } from "../lib/calendarUtil";
import { KPI_PERIOD_LABELS, type KpiPeriod } from "../lib/kpi";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Tabs } from "../components/Tabs";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { LeaveCalendar } from "../components/LeaveCalendar";
import {
  ATTENDANCE_REASONS,
  ATTENDANCE_REASON_LABELS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  LEAVE_APPROVAL_LABELS,
  LEAVE_REASONS,
  isAdminRole,
  type AttendanceReason,
  type AttendanceRecord,
  type AttendanceStatus,
  type LeaveApprovalStatus,
} from "../lib/types";

const STATUS_VARIANT: Record<AttendanceStatus, "ok" | "warn" | "outline" | "accent" | "bad"> = {
  present: "ok",
  late: "warn",
  half_day: "outline",
  leave: "accent",
  absent: "bad",
};

const APPROVAL_VARIANT: Record<LeaveApprovalStatus, "ok" | "warn" | "bad"> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
};

const STATUS_DOT_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-ok",
  late: "bg-warn",
  half_day: "bg-faint-ink",
  leave: "bg-accent",
  absent: "bg-bad",
};

const LOW_ATTENDANCE_THRESHOLD = 70;

type Tab = "mark" | "calendar" | "leave" | "history" | "summary";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function summariesToCsv(summaries: DesignerAttendanceSummary[]): string {
  const header = ["Designer", "Present", "Late", "Half Day", "Leave", "Absent", "Attendance Rate", "Reasons"];
  const rows = summaries.map((s) => {
    const reasons = Object.entries(s.reasonBreakdown)
      .map(([reason, count]) => `${ATTENDANCE_REASON_LABELS[reason as AttendanceReason]}: ${count}`)
      .join("; ");
    return [
      s.designerName,
      String(s.presentDays),
      String(s.lateDays),
      String(s.halfDays),
      String(s.leaveDays),
      String(s.absentDays),
      s.attendanceRate === null ? "" : `${Math.round(s.attendanceRate)}%`,
      reasons,
    ];
  });
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const AttendancePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const attendanceQuery = useAttendanceList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();
  const markMutation = useMarkAttendance();
  const approvalMutation = useSetLeaveApproval();
  const leaveCalendarQuery = useLeaveCalendarList();

  const [tab, setTab] = useState<Tab>(isAdmin ? "mark" : "leave");
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [summaryPeriod, setSummaryPeriod] = useState<KpiPeriod>("this_month");

  const records = attendanceQuery.data ?? [];
  const designers = designersQuery.data ?? [];

  const recordForDate = useMemo(() => {
    const map = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      if (r.date === selectedDate) map.set(r.designerId, r);
    }
    return map;
  }, [records, selectedDate]);

  const summaries = useMemo(() => {
    if (isAdmin) {
      return designers.map((d) =>
        summarizeAttendance(d.id, d.displayName, records.filter((r) => r.designerId === d.id), summaryPeriod)
      );
    }
    if (!currentUser) return [];
    return [summarizeAttendance(currentUser.id, currentUser.displayName, records, summaryPeriod)];
  }, [isAdmin, designers, records, summaryPeriod, currentUser]);

  const handleMark = (designerId: string, designerName: string, status: AttendanceStatus, reason: AttendanceReason | null, notes: string | null) => {
    markMutation.mutate(
      { designerId, designerName, date: selectedDate, status, reason, notes, leaveApproval: status === "leave" ? "approved" : null },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attendance") }
    );
  };

  const handleApprove = (record: AttendanceRecord, approval: "approved" | "rejected") => {
    approvalMutation.mutate(
      { id: record.id, approval },
      {
        onSuccess: () => toast.success(approval === "approved" ? "Leave approved" : "Leave marked not approved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update approval"),
      }
    );
  };

  const handleApplyLeave = async (dates: string[], reason: AttendanceReason, notes: string | null) => {
    if (!currentUser) return;
    const results = await Promise.allSettled(
      dates.map((date) =>
        markMutation.mutateAsync({ designerId: currentUser.id, designerName: currentUser.displayName, date, status: "leave", reason, notes, leaveApproval: "pending" })
      )
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded > 0) toast.success(`Applied for leave on ${succeeded} day${succeeded > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} day${failed > 1 ? "s" : ""} already had an attendance record and ${failed > 1 ? "were" : "was"} skipped`);
  };

  // -- Calendar tab state --
  const [calendarDesignerId, setCalendarDesignerId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarDialogDate, setCalendarDialogDate] = useState<string | null>(null);

  useEffect(() => {
    if (!calendarDesignerId && designers.length > 0) setCalendarDesignerId(designers[0].id);
  }, [calendarDesignerId, designers]);

  const calendarDesigner = designers.find((d) => d.id === calendarDesignerId) ?? null;
  const calendarRecordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) {
      if (r.designerId === calendarDesignerId) map.set(r.date, r);
    }
    return map;
  }, [records, calendarDesignerId]);
  const calendarWeeks = useMemo(
    () => buildMonthGrid(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth]
  );
  const today = todayDateString();
  const dialogRecord = calendarDialogDate ? calendarRecordsByDate.get(calendarDialogDate) ?? null : null;

  const tabOptions = isAdmin
    ? [
        { value: "mark", label: "Mark Today" },
        { value: "calendar", label: "Calendar" },
        { value: "history", label: "History" },
        { value: "summary", label: "Summary" },
      ]
    : [
        { value: "leave", label: "Apply for Leave" },
        { value: "history", label: "History" },
        { value: "summary", label: "Summary" },
      ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Attendance</h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">
          {isAdmin ? "Mark and review the team's daily attendance" : "Your attendance history"}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} options={tabOptions} />

      {tab === "mark" && isAdmin && (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-[0.8125rem] font-medium text-ink">Date</label>
            <Input type="date" className="w-44" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          {designers.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={26} />} message="No designers yet — add one in Users." className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr>
                    {["Designer", "Status", "Reason", "Notes"].map((h) => (
                      <th key={h} className="border-b border-line px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {designers.map((d) => {
                    const existing = recordForDate.get(d.id);
                    return (
                      <AttendanceRow
                        key={d.id}
                        designerName={d.displayName}
                        status={existing?.status ?? null}
                        reason={existing?.reason ?? null}
                        notes={existing?.notes ?? ""}
                        onSave={(status, reason, notes) => handleMark(d.id, d.displayName, status, reason, notes)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "calendar" && isAdmin && (
        <div className="flex flex-col gap-4">
          {designers.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={26} />} message="No designers yet — add one in Users." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Select
                  className="w-56"
                  value={calendarDesignerId}
                  onValueChange={setCalendarDesignerId}
                  options={designers.map((d) => ({ value: d.id, label: d.displayName }))}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous month"
                    onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="w-40 text-center font-display text-[0.9375rem] font-semibold text-ink">
                    {monthLabel(calendarMonth)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next month"
                    onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalendarMonth(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })}
                  >
                    Today
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-line bg-panel p-4 shadow-sm">
                <div className="grid min-w-[640px] grid-cols-7 gap-1.5">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="pb-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                      {d}
                    </div>
                  ))}
                  {calendarWeeks.flatMap((week, wi) =>
                    week.map((dateStr, di) => {
                      if (!dateStr) return <div key={`${wi}-${di}`} />;
                      const record = calendarRecordsByDate.get(dateStr);
                      const dayNum = Number(dateStr.slice(-2));
                      const isToday = dateStr === today;
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => setCalendarDialogDate(dateStr)}
                          className={`flex h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors hover:bg-faint ${
                            isToday ? "border-brand" : "border-line"
                          }`}
                        >
                          <span className={`text-xs ${isToday ? "font-semibold text-brand" : "text-faint-ink"}`}>{dayNum}</span>
                          {record && (
                            <span className="flex items-center gap-1">
                              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[record.status]}`} />
                              <span className="truncate text-[0.6875rem] text-ink">{ATTENDANCE_STATUS_LABELS[record.status]}</span>
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-faint-ink">
                {ATTENDANCE_STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[s]}`} /> {ATTENDANCE_STATUS_LABELS[s]}
                  </span>
                ))}
              </div>
            </>
          )}

          <Dialog open={calendarDialogDate !== null} onOpenChange={(open) => !open && setCalendarDialogDate(null)}>
            <DialogHeader>
              <DialogTitle>
                {calendarDesigner?.displayName}
                {calendarDialogDate && ` — ${new Date(`${calendarDialogDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}`}
              </DialogTitle>
            </DialogHeader>
            {calendarDialogDate && calendarDesigner && (
              <CalendarMarkForm
                key={calendarDialogDate}
                initialStatus={dialogRecord?.status ?? null}
                initialReason={dialogRecord?.reason ?? null}
                initialNotes={dialogRecord?.notes ?? ""}
                isSaving={markMutation.isPending}
                onSave={(status, reason, notes) => {
                  markMutation.mutate(
                    { designerId: calendarDesigner.id, designerName: calendarDesigner.displayName, date: calendarDialogDate, status, reason, notes, leaveApproval: status === "leave" ? "approved" : null },
                    {
                      onSuccess: () => {
                        toast.success("Attendance saved");
                        setCalendarDialogDate(null);
                      },
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attendance"),
                    }
                  );
                }}
              />
            )}
          </Dialog>
        </div>
      )}

      {tab === "leave" && !isAdmin && currentUser && (
        <div className="flex flex-col gap-6">
          <ApplyLeaveForm isSaving={markMutation.isPending} onApply={handleApplyLeave} />
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-ink">Your Leave</h3>
            {records.filter((r) => r.status === "leave").length === 0 ? (
              <EmptyState icon={<CalendarCheck size={24} />} message="No leave applied yet." className="py-6" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
                <table className="w-full text-[0.8125rem]">
                  <thead className="bg-surface">
                    <tr>
                      {["Date", "Reason", "Approval", "Notes"].map((h) => (
                        <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter((r) => r.status === "leave")
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-surface">
                          <td className="border-b border-line px-4 py-3 text-ink">
                            {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="border-b border-line px-4 py-3 text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</td>
                          <td className="border-b border-line px-4 py-3">
                            <Badge variant={r.leaveApproval ? APPROVAL_VARIANT[r.leaveApproval] : "outline"}>
                              {r.leaveApproval ? LEAVE_APPROVAL_LABELS[r.leaveApproval] : "—"}
                            </Badge>
                          </td>
                          <td className="border-b border-line px-4 py-3 text-faint-ink">{r.notes ?? "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-ink">Team Away Calendar</h3>
              <p className="text-[0.8125rem] text-faint-ink">Who's out, at a glance -- once their leave is approved.</p>
            </div>
            {leaveCalendarQuery.isLoading ? (
              <Skeleton style={{ height: 220 }} />
            ) : (
              <LeaveCalendar records={leaveCalendarQuery.data ?? []} emptyHint="No one on the team is on leave this month." />
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="flex flex-col gap-3">
          {attendanceQuery.isLoading ? (
            <Skeleton style={{ height: 160 }} />
          ) : records.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={26} />} message="No attendance recorded yet." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
              <table className="w-full text-[0.8125rem]">
                <thead className="bg-surface">
                  <tr>
                    {(isAdmin ? ["Date", "Designer", "Status", "Reason", "Approval", "Notes"] : ["Date", "Status", "Reason", "Approval", "Notes"]).map((h) => (
                      <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-surface">
                      <td className="border-b border-line px-4 py-3 text-ink">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      {isAdmin && <td className="border-b border-line px-4 py-3 text-ink">{r.designerName}</td>}
                      <td className="border-b border-line px-4 py-3">
                        <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {r.leaveApproval ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={APPROVAL_VARIANT[r.leaveApproval]}>{LEAVE_APPROVAL_LABELS[r.leaveApproval]}</Badge>
                            {isAdmin && r.leaveApproval === "pending" && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" aria-label="Approve leave" onClick={() => handleApprove(r, "approved")}>
                                  <Check size={14} className="text-ok" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Reject leave" onClick={() => handleApprove(r, "rejected")}>
                                  <XIcon size={14} className="text-bad" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-faint-ink">—</span>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "summary" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={summaryPeriod}
              onValueChange={(v) => setSummaryPeriod(v as KpiPeriod)}
              options={(Object.keys(KPI_PERIOD_LABELS) as KpiPeriod[]).map((p) => ({ value: p, label: KPI_PERIOD_LABELS[p] }))}
            />
            {summaries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(`attendance-summary-${summaryPeriod}.csv`, summariesToCsv(summaries))}
              >
                <Download size={14} /> Export CSV
              </Button>
            )}
          </div>
          {attendanceQuery.isLoading ? (
            <Skeleton style={{ height: 200 }} />
          ) : summaries.length === 0 ? (
            <EmptyState icon={<ClipboardList size={26} />} message="No designers to summarize yet." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
              <table className="w-full text-[0.8125rem]">
                <thead className="bg-surface">
                  <tr>
                    {["Designer", "Present", "Late", "Half Day", "Leave", "Absent", "Attendance Rate", "Reasons"].map((h) => (
                      <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const isLow = s.attendanceRate !== null && s.attendanceRate < LOW_ATTENDANCE_THRESHOLD;
                    return (
                      <tr key={s.designerId} className={isLow ? "bg-[var(--bad-wash)] hover:bg-[var(--bad-wash)]" : "hover:bg-surface"}>
                        <td className="border-b border-line px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink">{s.designerName}</span>
                            {isLow && <Badge variant="bad">Low</Badge>}
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.presentDays}</td>
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.lateDays}</td>
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.halfDays}</td>
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.leaveDays}</td>
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">
                          <span className={s.absentDays > 0 ? "font-semibold text-bad" : ""}>{s.absentDays}</span>
                        </td>
                        <td className="border-b border-line px-4 py-3 font-medium tabular-nums">
                          <span className={isLow ? "text-bad" : "text-ink"}>{s.attendanceRate === null ? "—" : `${Math.round(s.attendanceRate)}%`}</span>
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          {Object.keys(s.reasonBreakdown).length === 0 ? (
                            <span className="text-faint-ink">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ATTENDANCE_REASONS.filter((r) => s.reasonBreakdown[r]).map((r) => (
                                <Badge key={r} variant="outline" className="whitespace-nowrap">
                                  {ATTENDANCE_REASON_LABELS[r]} ×{s.reasonBreakdown[r]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AttendanceRow: React.FC<{
  designerName: string;
  status: AttendanceStatus | null;
  reason: AttendanceReason | null;
  notes: string;
  onSave: (status: AttendanceStatus, reason: AttendanceReason | null, notes: string | null) => void;
}> = ({ designerName, status: initialStatus, reason: initialReason, notes: initialNotes, onSave }) => {
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(initialReason);
  const [notes, setNotes] = useState(initialNotes);

  const needsReason = status && status !== "present";

  return (
    <tr>
      <td className="border-b border-line px-3 py-2 text-ink">{designerName}</td>
      <td className="border-b border-line px-3 py-2">
        <Select
          className="w-36"
          value={status ?? ""}
          onValueChange={(v) => {
            if (!v) return;
            const nextStatus = v as AttendanceStatus;
            const nextReason = nextStatus === "present" ? null : reason;
            setStatus(nextStatus);
            setReason(nextReason);
            onSave(nextStatus, nextReason, notes || null);
          }}
          options={[
            { value: "", label: "Not marked" },
            ...ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] })),
          ]}
        />
      </td>
      <td className="border-b border-line px-3 py-2">
        {needsReason ? (
          <Select
            className="w-48"
            value={reason ?? ""}
            onValueChange={(v) => {
              const nextReason = (v || null) as AttendanceReason | null;
              setReason(nextReason);
              onSave(status!, nextReason, notes || null);
            }}
            options={[
              { value: "", label: "Select reason..." },
              ...ATTENDANCE_REASONS.map((r) => ({ value: r, label: ATTENDANCE_REASON_LABELS[r] })),
            ]}
          />
        ) : (
          <span className="text-faint-ink">—</span>
        )}
      </td>
      <td className="border-b border-line px-3 py-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => status && onSave(status, reason, notes || null)}
          placeholder="Optional note"
        />
      </td>
    </tr>
  );
};

/** Explicit-save form used inside the Calendar tab's day-editing dialog. */
const CalendarMarkForm: React.FC<{
  initialStatus: AttendanceStatus | null;
  initialReason: AttendanceReason | null;
  initialNotes: string;
  isSaving: boolean;
  onSave: (status: AttendanceStatus, reason: AttendanceReason | null, notes: string | null) => void;
}> = ({ initialStatus, initialReason, initialNotes, isSaving, onSave }) => {
  const [status, setStatus] = useState(initialStatus ?? "present");
  const [reason, setReason] = useState(initialReason);
  const [notes, setNotes] = useState(initialNotes);

  const needsReason = status !== "present";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(status, needsReason ? reason : null, notes || null);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Status</label>
        <Select
          value={status}
          onValueChange={(v) => {
            const next = v as AttendanceStatus;
            setStatus(next);
            if (next === "present") setReason(null);
          }}
          options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] }))}
        />
      </div>
      {needsReason && (
        <div className="flex flex-col gap-2">
          <label className="text-[0.8125rem] font-medium text-ink">Reason</label>
          <Select
            value={reason ?? ""}
            onValueChange={(v) => setReason((v || null) as AttendanceReason | null)}
            options={[{ value: "", label: "Select reason..." }, ...ATTENDANCE_REASONS.map((r) => ({ value: r, label: ATTENDANCE_REASON_LABELS[r] }))]}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
};

/** Designers' only write path on this page -- a date-range leave request. */
const ApplyLeaveForm: React.FC<{
  isSaving: boolean;
  onApply: (dates: string[], reason: AttendanceReason, notes: string | null) => void;
}> = ({ isSaving, onApply }) => {
  const today = todayDateString();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState<AttendanceReason>(LEAVE_REASONS[0]);
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toDate < fromDate) {
      toast.error("End date can't be before the start date");
      return;
    }
    const dates: string[] = [];
    const cursor = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    onApply(dates, reason, notes || null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-[0.8125rem] font-medium text-ink">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[0.8125rem] font-medium text-ink">To</label>
          <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Reason</label>
        <Select
          value={reason}
          onValueChange={(v) => setReason(v as AttendanceReason)}
          options={LEAVE_REASONS.map((r) => ({ value: r, label: ATTENDANCE_REASON_LABELS[r] }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note for your admin" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Submitting..." : "Apply for Leave"}
        </Button>
      </div>
    </form>
  );
};
