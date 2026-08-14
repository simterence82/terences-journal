import React, { useMemo, useState } from "react";
import { CalendarCheck, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceList, useMarkAttendance } from "../hooks/useAttendance";
import { useDesignersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { summarizeAttendance } from "../lib/attendanceSummary";
import { KPI_PERIOD_LABELS, type KpiPeriod } from "../lib/kpi";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Badge } from "../components/Badge";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  ATTENDANCE_REASONS,
  ATTENDANCE_REASON_LABELS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  isAdminRole,
  type AttendanceReason,
  type AttendanceStatus,
} from "../lib/types";

const STATUS_VARIANT: Record<AttendanceStatus, "ok" | "warn" | "outline" | "accent" | "bad"> = {
  present: "ok",
  late: "warn",
  half_day: "outline",
  leave: "accent",
  absent: "bad",
};

type Tab = "mark" | "history" | "summary";

export const AttendancePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const attendanceQuery = useAttendanceList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();
  const markMutation = useMarkAttendance();

  const [tab, setTab] = useState<Tab>(isAdmin ? "mark" : "history");
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
      { designerId, designerName, date: selectedDate, status, reason, notes },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attendance") }
    );
  };

  const tabOptions = isAdmin
    ? [
        { value: "mark", label: "Mark Today" },
        { value: "history", label: "History" },
        { value: "summary", label: "Summary" },
      ]
    : [
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
                    {(isAdmin ? ["Date", "Designer", "Status", "Reason", "Notes"] : ["Date", "Status", "Reason", "Notes"]).map((h) => (
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
          <Tabs
            value={summaryPeriod}
            onValueChange={(v) => setSummaryPeriod(v as KpiPeriod)}
            options={(Object.keys(KPI_PERIOD_LABELS) as KpiPeriod[]).map((p) => ({ value: p, label: KPI_PERIOD_LABELS[p] }))}
          />
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
                  {summaries.map((s) => (
                    <tr key={s.designerId} className="hover:bg-surface">
                      <td className="border-b border-line px-4 py-3 font-medium text-ink">{s.designerName}</td>
                      <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.presentDays}</td>
                      <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.lateDays}</td>
                      <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.halfDays}</td>
                      <td className="border-b border-line px-4 py-3 text-ink tabular-nums">{s.leaveDays}</td>
                      <td className="border-b border-line px-4 py-3 text-ink tabular-nums">
                        <span className={s.absentDays > 0 ? "font-semibold text-bad" : ""}>{s.absentDays}</span>
                      </td>
                      <td className="border-b border-line px-4 py-3 font-medium text-ink tabular-nums">
                        {s.attendanceRate === null ? "—" : `${Math.round(s.attendanceRate)}%`}
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
                  ))}
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
