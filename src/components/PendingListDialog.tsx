import React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";
import { formatSGD } from "../lib/formatCurrency";

export interface PendingRow {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
}

interface PendingListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  rows: PendingRow[];
  /** When false only the entries and their count are shown, never any dollar figure. */
  showAmounts: boolean;
}

export const PendingListDialog: React.FC<PendingListDialogProps> = ({ open, onOpenChange, title, rows, showAmounts }) => {
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted-foreground">{showAmounts ? "Total outstanding" : "Entries outstanding"}</div>
        <div className="font-display text-2xl font-semibold tabular-nums text-foreground">{showAmounts ? formatSGD(total) : rows.length}</div>
        {showAmounts && (
          <div className="text-xs text-muted-foreground">
            across {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing outstanding.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{r.title}</span>
                <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
              </div>
              {showAmounts && <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatSGD(r.amount)}</span>}
            </li>
          ))}
        </ul>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
