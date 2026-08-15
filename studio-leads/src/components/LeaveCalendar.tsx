import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogHeader, DialogTitle } from "./Dialog";
import { buildMonthGrid, monthLabel } from "../lib/calendarUtil";
import { todayDateString } from "../lib/firestoreUtil";
import { ATTENDANCE_REASON_LABELS, type AttendanceRecord } from "../lib/types";

interface LeaveCalendarProps {
  /** Any status is fine to pass in -- this component filters to "leave" itself. */
  records: AttendanceRecord[];
  /** Show each person's leave reason in the day dialog. Off by default,
      since reasons (MC, etc.) can be sensitive and this component is also
      used for the company-wide "who's on leave" board. */
  showReasons?: boolean;
  emptyHint?: string;
}

export const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ records, showReasons = false, emptyHint }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const today = todayDateString();

  const leaveByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      if (r.status !== "leave") continue;
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  }, [records]);

  const weeks = useMemo(() => buildMonthGrid(month.getFullYear(), month.getMonth()), [month]);
  const dialogRecords = dialogDate ? leaveByDate.get(dialogDate) ?? [] : [];
  const hasAnyLeave = leaveByDate.size > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[0.9375rem] font-semibold text-ink">{monthLabel(month)}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonth(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })}
          >
            Today
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-4 shadow-sm">
        <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="pb-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
              {d}
            </div>
          ))}
          {weeks.flatMap((week, wi) =>
            week.map((dateStr, di) => {
              if (!dateStr) return <div key={`${wi}-${di}`} />;
              const onLeave = leaveByDate.get(dateStr) ?? [];
              const dayNum = Number(dateStr.slice(-2));
              const isToday = dateStr === today;
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={onLeave.length === 0}
                  onClick={() => setDialogDate(dateStr)}
                  className={`flex h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors ${
                    onLeave.length > 0 ? "cursor-pointer hover:bg-faint" : "cursor-default"
                  } ${isToday ? "border-brand" : "border-line"}`}
                >
                  <span className={`text-xs ${isToday ? "font-semibold text-brand" : "text-faint-ink"}`}>{dayNum}</span>
                  {onLeave.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      <span className="truncate text-[0.6875rem] text-ink">
                        {onLeave.length === 1 ? onLeave[0].designerName.split(" ")[0] : `${onLeave.length} on leave`}
                      </span>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {!hasAnyLeave && emptyHint && <p className="text-[0.8125rem] text-faint-ink">{emptyHint}</p>}

      <Dialog open={dialogDate !== null} onOpenChange={(open) => !open && setDialogDate(null)}>
        <DialogHeader>
          <DialogTitle>
            On Leave
            {dialogDate && ` — ${new Date(`${dialogDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}`}
          </DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {dialogRecords.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[0.8125rem]">
              <span className="font-medium text-ink">{r.designerName}</span>
              {showReasons && <span className="text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</span>}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
};
