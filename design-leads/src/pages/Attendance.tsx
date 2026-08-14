import React, { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useAttendanceList, useMarkAttendance } from "../hooks/useAttendance";
import { useDesignersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from "../lib/types";

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "warning" | "outline" | "secondary" | "destructive"> = {
  present: "success",
  late: "warning",
  half_day: "outline",
  leave: "secondary",
  absent: "destructive",
};

export const AttendancePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = currentUser?.role === "admin";

  const attendanceQuery = useAttendanceList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();
  const markMutation = useMarkAttendance();

  const [selectedDate, setSelectedDate] = useState(todayDateString());

  const records = attendanceQuery.data ?? [];
  const designers = designersQuery.data ?? [];

  const recordForDate = useMemo(() => {
    const map = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      if (r.date === selectedDate) map.set(r.designerId, r);
    }
    return map;
  }, [records, selectedDate]);

  const handleMark = (designerId: string, designerName: string, status: AttendanceStatus, notes: string | null) => {
    markMutation.mutate(
      { designerId, designerName, date: selectedDate, status, notes },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attendance") }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Attendance</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {isAdmin ? "Mark and review the team's daily attendance" : "Your attendance history"}
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow">
          <div className="flex items-center gap-3">
            <label className="text-[0.8125rem] font-medium text-foreground">Date</label>
            <Input type="date" className="w-44" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          {designers.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={26} />} message="No designers yet — add one in Users." className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr>
                    {["Designer", "Status", "Notes"].map((h) => (
                      <th key={h} className="border-b border-border px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
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
                        status={existing?.status ?? null}
                        notes={existing?.notes ?? ""}
                        onSave={(status, notes) => handleMark(d.id, d.displayName, status, notes)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">History</h2>
        {attendanceQuery.isLoading ? (
          <Skeleton style={{ height: 160 }} />
        ) : records.length === 0 ? (
          <EmptyState icon={<CalendarCheck size={26} />} message="No attendance recorded yet." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
            <table className="w-full text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {(isAdmin ? ["Date", "Designer", "Status", "Notes"] : ["Date", "Status", "Notes"]).map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-surface">
                    <td className="border-b border-border px-4 py-3 text-foreground">
                      {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    {isAdmin && <td className="border-b border-border px-4 py-3 text-foreground">{r.designerName}</td>}
                    <td className="border-b border-border px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="border-b border-border px-4 py-3 text-muted-foreground">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const AttendanceRow: React.FC<{
  designerId: string;
  designerName: string;
  status: AttendanceStatus | null;
  notes: string;
  onSave: (status: AttendanceStatus, notes: string | null) => void;
}> = ({ designerName, status, notes: initialNotes, onSave }) => {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <tr>
      <td className="border-b border-border px-3 py-2 text-foreground">{designerName}</td>
      <td className="border-b border-border px-3 py-2">
        <Select
          className="w-40"
          value={status ?? ""}
          onValueChange={(v) => v && onSave(v as AttendanceStatus, notes || null)}
          options={[
            { value: "", label: "Not marked" },
            ...ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] })),
          ]}
        />
      </td>
      <td className="border-b border-border px-3 py-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => status && onSave(status, notes || null)}
          placeholder="Optional note"
        />
      </td>
    </tr>
  );
};
