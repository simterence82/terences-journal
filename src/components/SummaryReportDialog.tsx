import React, { useMemo, useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";

export const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
  </div>
);

interface SummaryReportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entries: T[];
  getDate: (entry: T) => string;
  renderStats: (filtered: T[]) => React.ReactNode;
}

export function SummaryReportDialog<T>({
  open,
  onOpenChange,
  title,
  entries,
  getDate,
  renderStats,
}: SummaryReportDialogProps<T>) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!from && !to) return entries;
    return entries.filter((entry) => {
      const date = getDate(entry).slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [entries, getDate, from, to]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {(from || to) && " in range"}
          </span>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="font-medium text-primary hover:underline"
            >
              Clear date range
            </button>
          )}
        </div>

        {renderStats(filtered)}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
