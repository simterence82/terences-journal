import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, ClipboardList, Download, Paperclip, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceList, useMarkAttendance, useSetLeaveApproval } from "../hooks/useAttendance";
import { useUploadAttendanceFile } from "../hooks/useFiles";
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
  mc: "accent",
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
  mc: "bg-accent",
  absent: "bg-bad",
};

const LOW_ATTENDANCE_THRESHOLD = 70;

type Tab = "mark" | "calendar" | "leave" | "pendingLeave" | "history" | "summary";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function summariesToCsv(summaries: DesignerAttendanceSummary[]): string {
  const header = ["Designer", "Present", "Late", "Half Day", "Leave", "MC", "Absent", "Attendance Rate", "Reasons"];
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
      String(s.mcDays),
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

/** "From"/"to" (inclusive) -> every YYYY-MM-DD date string in between. */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export const AttendancePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const attendanceQuery = useAttendanceList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();
  const markMutation = useMarkAttendance();
  const approvalMutation = useSetLeaveApproval();

  const [tab, setTab] = useState<Tab>(isAdmin ? "mark" : "leave");
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [summaryPeriod, setSummaryPeriod] = useState<KpiPeriod>("this_month");

  const records = attendanceQuery.data ?? [];
  const designers = designersQuery.data ?? [];
  const pendingLeaveRecords = useMemo(
    () => records.filter((r) => r.status === "leave" && r.leaveApproval === "pending").sort((a, b) => (a.date < b.date ? -1 : 1)),
    [records]
  );

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

  const handleMark = (
    designerId: string,
    designerName: string,
    status: AttendanceStatus,
    reason: AttendanceReason | null,
    notes: string | null,
    mcFileId: string | null = null
  ) => {
    markMutation.mutate(
      { designerId, designerName, date: selectedDate, status, reason, notes, leaveApproval: status === "leave" ? "approved" : null, mcFileId },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attendance") }
    );
  };

  // One click instead of setting each designer's status individually --
  // only touches designers who don't already have a record for the
  // selected date, so it never clobbers an existing mark.
  const unmarkedDesigners = useMemo(() => designers.filter((d) => !recordForDate.get(d.id)), [designers, recordForDate]);
  const handleMarkAllPresent = async () => {
    const results = await Promise.allSettled(
      unmarkedDesigners.map((d) =>
        markMutation.mutateAsync({ designerId: d.id, designerName: d.displayName, date: selectedDate, status: "present", reason: null, notes: null, leaveApproval: null })
      )
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0) toast.success(`Marked ${succeeded} designer${succeeded > 1 ? "s" : ""} present`);
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

  const handleApplyMc = async (dates: string[], notes: string | null, mcFileId: string) => {
    if (!currentUser) return;
    const results = await Promise.allSettled(
      dates.map((date) =>
        markMutation.mutateAsync({ designerId: currentUser.id, designerName: currentUser.displayName, date, status: "mc", reason: null, notes, leaveApproval: null, mcFileId })
      )
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded > 0) toast.success(`MC submitted for ${succeeded} day${succeeded > 1 ? "s" : ""}`);
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
        { value: "pendingLeave", label: "Pending Leave Applications", count: pendingLeaveRecords.length },
        { value: "history", label: "History" },
        { value: "summary", label: "Summary" },
      ]
    : [
        { value: "leave", label: "Apply for Leave / MC" },
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-[0.8125rem] font-medium text-ink">Date</label>
              <Input type="date" className="w-44" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            {designers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllPresent}
                disabled={unmarkedDesigners.length === 0 || markMutation.isPending}
              >
                <Check size={14} />
                {unmarkedDesigners.length === 0 ? "Everyone marked" : `Mark All Present (${unmarkedDesigners.length})`}
              </Button>
            )}
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
                        designerId={d.id}
                        designerName={d.displayName}
                        date={selectedDate}
                        status={existing?.status ?? null}
                        reason={existing?.reason ?? null}
                        notes={existing?.notes ?? ""}
                        initialMcFileId={existing?.mcFileId ?? null}
                        onSave={(status, reason, notes, mcFileId) => handleMark(d.id, d.displayName, status, reason, notes, mcFileId)}
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
                          className={`flex h-16 w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-lg border p-1.5 text-left transition-colors hover:bg-faint ${
                            isToday ? "border-brand" : "border-line"
                          }`}
                        >
                          <span className={`text-xs ${isToday ? "font-semibold text-brand" : "text-faint-ink"}`}>{dayNum}</span>
                          {record && (
                            <span className="flex w-full min-w-0 items-center gap-1">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[record.status]}`} />
                              <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-ink">{ATTENDANCE_STATUS_LABELS[record.status]}</span>
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
                designerId={calendarDesigner.id}
                date={calendarDialogDate}
                initialStatus={dialogRecord?.status ?? null}
                initialReason={dialogRecord?.reason ?? null}
                initialNotes={dialogRecord?.notes ?? ""}
                initialMcFileId={dialogRecord?.mcFileId ?? null}
                isSaving={markMutation.isPending}
                onSave={(status, reason, notes, mcFileId) => {
                  markMutation.mutate(
                    { designerId: calendarDesigner.id, designerName: calendarDesigner.displayName, date: calendarDialogDate, status, reason, notes, leaveApproval: status === "leave" ? "approved" : null, mcFileId },
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
          <LeaveOrMcForm isSaving={markMutation.isPending} onApplyLeave={handleApplyLeave} onApplyMc={handleApplyMc} />
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-ink">Your Leave &amp; MC</h3>
            {records.filter((r) => r.status === "leave" || r.status === "mc").length === 0 ? (
              <EmptyState icon={<CalendarCheck size={24} />} message="No leave or MC applied yet." className="py-6" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
                <table className="w-full text-[0.8125rem]">
                  <thead className="bg-surface">
                    <tr>
                      {["Date", "Type", "Reason", "Approval", "Notes"].map((h) => (
                        <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter((r) => r.status === "leave" || r.status === "mc")
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-surface">
                          <td className="border-b border-line px-4 py-3 text-ink">
                            {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="border-b border-line px-4 py-3">
                            <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
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
              <h3 className="font-display text-base font-semibold text-ink">Your Leave Calendar</h3>
              <p className="text-[0.8125rem] text-faint-ink">
                Your own applied and approved leave, at a glance. See everyone else's on the{" "}
                <Link to="/" className="text-brand hover:underline">
                  Dashboard's Away Calendar
                </Link>
                .
              </p>
            </div>
            <LeaveCalendar records={records.filter((r) => r.status === "leave")} showReasons emptyHint="You have no leave applied this month." />
          </div>
        </div>
      )}

      {tab === "pendingLeave" && isAdmin && (
        <div className="flex flex-col gap-3">
          {attendanceQuery.isLoading ? (
            <Skeleton style={{ height: 160 }} />
          ) : pendingLeaveRecords.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={26} />} message="No pending leave applications." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
              <table className="w-full text-[0.8125rem]">
                <thead className="bg-surface">
                  <tr>
                    {["Designer", "Date", "Reason", "Notes", "Decision"].map((h) => (
                      <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaveRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-surface">
                      <td className="border-b border-line px-4 py-3 text-ink">{r.designerName}</td>
                      <td className="border-b border-line px-4 py-3 text-ink">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.notes ?? "—"}</td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="soft" size="sm" onClick={() => handleApprove(r, "approved")}>
                            <Check size={14} /> Approve
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleApprove(r, "rejected")}>
                            <XIcon size={14} /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="flex flex-col gap-3">
          {attendanceQuery.isLoading ? (
            <Skeleton style={{ height: 160 }} />
          ) : records.filter((r) => !(r.status === "leave" && r.leaveApproval === "pending")).length === 0 ? (
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
                  {records
                    .filter((r) => !(r.status === "leave" && r.leaveApproval === "pending"))
                    .map((r) => (
                    <tr key={r.id} className="hover:bg-surface">
                      <td className="border-b border-line px-4 py-3 text-ink">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      {isAdmin && <td className="border-b border-line px-4 py-3 text-ink">{r.designerName}</td>}
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
                          {r.status === "mc" && r.mcFileId && (
                            <Paperclip size={12} className="text-faint-ink" aria-label="MC document attached -- see Files Archive" />
                          )}
                        </div>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {r.leaveApproval ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={APPROVAL_VARIANT[r.leaveApproval]}>{LEAVE_APPROVAL_LABELS[r.leaveApproval]}</Badge>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Approve leave"
                                  disabled={r.leaveApproval === "approved"}
                                  onClick={() => handleApprove(r, "approved")}
                                >
                                  <Check size={14} className="text-ok" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Reject leave"
                                  disabled={r.leaveApproval === "rejected"}
                                  onClick={() => handleApprove(r, "rejected")}
                                >
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
                    {["Designer", "Present", "Late", "Half Day", "Leave", "MC", "Absent", "Attendance Rate", "Reasons"].map((h) => (
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
                        <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.mcDays}</td>
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

/** File input for an MC document -- PDF/JPEG/PNG, with `capture` hinting
    mobile browsers to offer the camera directly. Shared by every place an
    MC gets attached (the row popup, the calendar day form, and the
    designer's own Apply for Leave / MC panel). */
const McFileField: React.FC<{ file: File | null; onFileChange: (file: File | null) => void; keepLabel?: string }> = ({
  file,
  onFileChange,
  keepLabel,
}) => (
  <div className="flex flex-col gap-2">
    <label className="text-[0.8125rem] font-medium text-ink">MC Document {!keepLabel && "*"}</label>
    <input
      type="file"
      accept="application/pdf,image/jpeg,image/jpg,image/png"
      capture="environment"
      onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      className="block w-full cursor-pointer text-[0.8125rem] text-ink file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--brand-wash)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
    />
    {file ? (
      <p className="text-xs text-faint-ink">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>
    ) : keepLabel ? (
      <p className="text-xs text-faint-ink">{keepLabel} Choose a file to replace it.</p>
    ) : null}
    <p className="text-xs text-faint-ink">PDF, JPEG or PNG -- on a phone this can open your camera directly.</p>
  </div>
);

/** Popup used from the compact Mark Today table row -- there's no room
    inline in a table cell, so selecting "MC" opens this instead. */
const McUploadDialog: React.FC<{
  open: boolean;
  designerName: string;
  isUploading: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}> = ({ open, designerName, isUploading, onCancel, onConfirm }) => {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogHeader>
        <DialogTitle>Attach MC for {designerName}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <McFileField file={file} onFileChange={setFile} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" disabled={!file || isUploading} onClick={() => file && onConfirm(file)}>
            {isUploading ? "Uploading..." : "Save"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
};

const AttendanceRow: React.FC<{
  designerId: string;
  designerName: string;
  date: string;
  status: AttendanceStatus | null;
  reason: AttendanceReason | null;
  notes: string;
  initialMcFileId: string | null;
  onSave: (status: AttendanceStatus, reason: AttendanceReason | null, notes: string | null, mcFileId: string | null) => void;
}> = ({ designerId, designerName, date, status: initialStatus, reason: initialReason, notes: initialNotes, initialMcFileId, onSave }) => {
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(initialReason);
  const [notes, setNotes] = useState(initialNotes);
  const [mcFileId, setMcFileId] = useState(initialMcFileId);
  const [mcDialogOpen, setMcDialogOpen] = useState(false);
  const uploadMutation = useUploadAttendanceFile();

  const needsReason = status && status !== "present" && status !== "mc";

  const handleConfirmMc = async (file: File) => {
    try {
      const fileId = await uploadMutation.mutateAsync({ file, category: "medical_certificate", relatedAttendanceId: `${designerId}_${date}` });
      setStatus("mc");
      setReason(null);
      setMcFileId(fileId);
      setMcDialogOpen(false);
      onSave("mc", null, notes || null, fileId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload MC");
    }
  };

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
            if (nextStatus === "mc") {
              setMcDialogOpen(true);
              return;
            }
            const nextReason = nextStatus === "present" ? null : reason;
            setStatus(nextStatus);
            setReason(nextReason);
            onSave(nextStatus, nextReason, notes || null, mcFileId);
          }}
          options={[
            { value: "", label: "Not marked" },
            ...ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] })),
          ]}
        />
        <McUploadDialog
          open={mcDialogOpen}
          designerName={designerName}
          isUploading={uploadMutation.isPending}
          onCancel={() => setMcDialogOpen(false)}
          onConfirm={handleConfirmMc}
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
              onSave(status!, nextReason, notes || null, mcFileId);
            }}
            options={[
              { value: "", label: "Select reason..." },
              ...ATTENDANCE_REASONS.map((r) => ({ value: r, label: ATTENDANCE_REASON_LABELS[r] })),
            ]}
          />
        ) : status === "mc" ? (
          <span className="flex items-center gap-1 text-faint-ink"><Paperclip size={12} /> MC attached</span>
        ) : (
          <span className="text-faint-ink">—</span>
        )}
      </td>
      <td className="border-b border-line px-3 py-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => status && onSave(status, reason, notes || null, mcFileId)}
          placeholder="Optional note"
        />
      </td>
    </tr>
  );
};

/** Explicit-save form used inside the Calendar tab's day-editing dialog. */
const CalendarMarkForm: React.FC<{
  designerId: string;
  date: string;
  initialStatus: AttendanceStatus | null;
  initialReason: AttendanceReason | null;
  initialNotes: string;
  initialMcFileId: string | null;
  isSaving: boolean;
  onSave: (status: AttendanceStatus, reason: AttendanceReason | null, notes: string | null, mcFileId: string | null) => void;
}> = ({ designerId, date, initialStatus, initialReason, initialNotes, initialMcFileId, isSaving, onSave }) => {
  const [status, setStatus] = useState(initialStatus ?? "present");
  const [reason, setReason] = useState(initialReason);
  const [notes, setNotes] = useState(initialNotes);
  const [mcFile, setMcFile] = useState<File | null>(null);
  const uploadMutation = useUploadAttendanceFile();

  const needsReason = status !== "present" && status !== "mc";
  const needsMcUpload = status === "mc";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsMcUpload && !mcFile && !initialMcFileId) {
      toast.error("Attach the MC document before saving");
      return;
    }
    let mcFileId = initialMcFileId;
    if (needsMcUpload && mcFile) {
      try {
        mcFileId = await uploadMutation.mutateAsync({ file: mcFile, category: "medical_certificate", relatedAttendanceId: `${designerId}_${date}` });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload MC");
        return;
      }
    }
    onSave(status, needsReason ? reason : null, notes || null, needsMcUpload ? mcFileId : null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Status</label>
        <Select
          value={status}
          onValueChange={(v) => {
            const next = v as AttendanceStatus;
            setStatus(next);
            if (next === "present" || next === "mc") setReason(null);
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
      {needsMcUpload && (
        <McFileField file={mcFile} onFileChange={setMcFile} keepLabel={initialMcFileId ? "Keeping the existing MC document." : undefined} />
      )}
      <div className="flex flex-col gap-2">
        <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSaving || uploadMutation.isPending}>
          {isSaving || uploadMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
};

/** Designers' only write path on this page -- either a date-range leave
    request, or an MC submission (date range + a mandatory document). */
const LeaveOrMcForm: React.FC<{
  isSaving: boolean;
  onApplyLeave: (dates: string[], reason: AttendanceReason, notes: string | null) => void;
  onApplyMc: (dates: string[], notes: string | null, mcFileId: string) => void;
}> = ({ isSaving, onApplyLeave, onApplyMc }) => {
  const today = todayDateString();
  const [mode, setMode] = useState<"leave" | "mc">("leave");
  const uploadMutation = useUploadAttendanceFile();

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState<AttendanceReason>(LEAVE_REASONS[0]);
  const [notes, setNotes] = useState("");

  const [mcFromDate, setMcFromDate] = useState(today);
  const [mcToDate, setMcToDate] = useState(today);
  const [mcNotes, setMcNotes] = useState("");
  const [mcFile, setMcFile] = useState<File | null>(null);

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toDate < fromDate) {
      toast.error("End date can't be before the start date");
      return;
    }
    onApplyLeave(dateRange(fromDate, toDate), reason, notes || null);
  };

  const handleMcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mcToDate < mcFromDate) {
      toast.error("End date can't be before the start date");
      return;
    }
    if (!mcFile) {
      toast.error("Attach your MC document");
      return;
    }
    try {
      const fileId = await uploadMutation.mutateAsync({ file: mcFile, category: "medical_certificate", relatedAttendanceId: null });
      onApplyMc(dateRange(mcFromDate, mcToDate), mcNotes || null, fileId);
      setMcFile(null);
      setMcNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload MC");
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} options={[{ value: "leave", label: "Leave" }, { value: "mc", label: "MC" }]} />

      {mode === "leave" ? (
        <form onSubmit={handleLeaveSubmit} className="flex flex-col gap-4">
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
      ) : (
        <form onSubmit={handleMcSubmit} className="flex flex-col gap-4">
          <p className="text-[0.8125rem] text-faint-ink">Covers you for one or more days with a doctor's certificate -- no approval needed, it's on record right away.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">From</label>
              <Input type="date" value={mcFromDate} onChange={(e) => setMcFromDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">To</label>
              <Input type="date" value={mcToDate} min={mcFromDate} onChange={(e) => setMcToDate(e.target.value)} />
            </div>
          </div>
          <McFileField file={mcFile} onFileChange={setMcFile} />
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
            <Input value={mcNotes} onChange={(e) => setMcNotes(e.target.value)} placeholder="Optional note for your admin" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || uploadMutation.isPending}>
              {isSaving || uploadMutation.isPending ? "Submitting..." : "Submit MC"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
