import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogHeader, DialogTitle } from "./Dialog";
import { buildMonthGrid, monthLabel } from "../lib/calendarUtil";
import { todayDateString } from "../lib/firestoreUtil";

export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** Optional display time, e.g. "2:30 PM". */
  time?: string | null;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  emptyHint?: string;
}

/** Generic month-grid calendar for showing dated events -- e.g. scheduled
    aircon servicing. Same grid mechanics as LeaveCalendar, but for
    arbitrary titled events instead of attendance records. */
export const EventCalendar: React.FC<EventCalendarProps> = ({ events, emptyHint }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const today = todayDateString();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => buildMonthGrid(month.getFullYear(), month.getMonth()), [month]);
  const dialogEvents = dialogDate ? eventsByDate.get(dialogDate) ?? [] : [];
  const hasAnyEvents = eventsByDate.size > 0;

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
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const dayNum = Number(dateStr.slice(-2));
              const isToday = dateStr === today;
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={dayEvents.length === 0}
                  onClick={() => setDialogDate(dateStr)}
                  className={`flex h-16 w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-lg border p-1.5 text-left transition-colors ${
                    dayEvents.length > 0 ? "cursor-pointer hover:bg-faint" : "cursor-default"
                  } ${isToday ? "border-brand" : "border-line"}`}
                >
                  <span className={`text-xs ${isToday ? "font-semibold text-brand" : "text-faint-ink"}`}>{dayNum}</span>
                  {dayEvents.length > 0 && (
                    <span className="flex w-full min-w-0 items-center gap-1">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-ink">
                        {dayEvents.length === 1 ? dayEvents[0].title : `${dayEvents.length} scheduled`}
                      </span>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {!hasAnyEvents && emptyHint && <p className="text-[0.8125rem] text-faint-ink">{emptyHint}</p>}

      <Dialog open={dialogDate !== null} onOpenChange={(open) => !open && setDialogDate(null)}>
        <DialogHeader>
          <DialogTitle>
            Scheduled
            {dialogDate && ` — ${new Date(`${dialogDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}`}
          </DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {dialogEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[0.8125rem]">
              <span className="font-medium text-ink">{e.title}</span>
              {e.time && <span className="text-faint-ink">{e.time}</span>}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
};
