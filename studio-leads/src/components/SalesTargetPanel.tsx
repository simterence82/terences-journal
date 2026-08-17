import React, { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { useSalesTargetsList, useSetSalesTarget } from "../hooks/useSalesTargets";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { formatSGD } from "../lib/formatCurrency";
import {
  daysInMonth,
  monthBounds,
  monthKeyOf,
  monthKeysBetween,
  overlapDays,
  signedSum,
  yearBounds,
  type TimelineMode,
} from "../lib/salesTarget";
import { isAdminRole, type Lead } from "../lib/types";
import { Tabs } from "./Tabs";
import { Input } from "./Input";
import { Select } from "./Select";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

/**
 * Each designer's signed sales vs. the target set for them, viewable by
 * month, year, or a custom date range. Targets are only ever stored per
 * calendar month (see useSalesTargets.ts); viewing by year or range just
 * sums whichever monthly targets fall in that window, so editing only
 * makes sense (and is only offered) in Month view.
 *
 * Reused in two places: the KPI page's admin sidebar (every designer,
 * editable) and a designer's own read-only Personal Sales Figure page
 * (just themselves, `designers` is a one-item array, never editable --
 * editability is gated on role internally, not by a prop, so a designer
 * can never reach it regardless of what a caller passes in).
 */
export const SalesTargetPanel: React.FC<{
  leads: Lead[];
  designers: { id: string; displayName: string }[];
  title?: string;
  sticky?: boolean;
}> = ({ leads, designers, title = "Sales Target", sticky = false }) => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const targetsQuery = useSalesTargetsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const targets = targetsQuery.data ?? [];

  const [mode, setMode] = useState<TimelineMode>("month");
  const [monthValue, setMonthValue] = useState(() => monthKeyOf(new Date()));
  const [yearValue, setYearValue] = useState(() => String(new Date().getFullYear()));
  const [rangeFrom, setRangeFrom] = useState(todayDateString());
  const [rangeTo, setRangeTo] = useState(todayDateString());

  const { from, to } = mode === "month" ? monthBounds(monthValue) : mode === "year" ? yearBounds(yearValue) : { from: rangeFrom, to: rangeTo };
  const relevantMonthKeys = mode === "month" ? [monthValue] : monthKeysBetween(from, to);
  const editable = isAdmin && mode === "month";

  const targetsByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of targets) map.set(`${t.designerId}_${t.monthKey}`, t.targetAmount);
    return map;
  }, [targets]);

  // Month and Year both select whole calendar months, so their target is
  // just the sum of those months' numbers. Range can start/end mid-month,
  // so it prorates each touched month's target by how many of its days
  // actually fall inside [from, to] -- a 3-day range only ever counts
  // 3/31st of that month's target, never the whole thing.
  const rows = useMemo(
    () =>
      designers.map((d) => {
        const actual = signedSum(leads, from, to, d.id);
        const target = relevantMonthKeys.reduce((sum, mk) => {
          const monthlyTarget = targetsByKey.get(`${d.id}_${mk}`) ?? 0;
          if (mode !== "range") return sum + monthlyTarget;
          return sum + monthlyTarget * (overlapDays(mk, from, to) / daysInMonth(mk));
        }, 0);
        return { designer: d, actual, target };
      }),
    [designers, leads, from, to, relevantMonthKeys, targetsByKey, mode]
  );

  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  return (
    <div className={`flex w-full shrink-0 flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm ${sticky ? "lg:sticky lg:top-6 lg:w-80" : ""}`}>
      <div className="flex items-center gap-2">
        <Target size={18} className="text-brand" />
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as TimelineMode)}
        options={[
          { value: "month", label: "Month" },
          { value: "year", label: "Year" },
          { value: "range", label: "Range" },
        ]}
      />

      {mode === "month" && <Input type="month" value={monthValue} onChange={(e) => e.target.value && setMonthValue(e.target.value)} />}
      {mode === "year" && <Select value={yearValue} onValueChange={setYearValue} options={yearOptions.map((y) => ({ value: y, label: y }))} />}
      {mode === "range" && (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
          <Input type="date" value={rangeTo} min={rangeFrom} onChange={(e) => setRangeTo(e.target.value)} />
        </div>
      )}

      {targetsQuery.isLoading ? (
        <Skeleton style={{ height: 160 }} />
      ) : designers.length === 0 ? (
        <EmptyState icon={<Target size={22} />} message="No designers yet." className="py-4" />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <SalesTargetRow
              key={r.designer.id}
              designerId={r.designer.id}
              designerName={r.designer.displayName}
              actual={r.actual}
              target={r.target}
              editable={editable}
              monthKey={monthValue}
            />
          ))}

          {rows.length > 1 && (
            <div className="flex flex-col gap-1.5 border-t border-line pt-3">
              <div className="flex items-center justify-between text-[0.8125rem] font-semibold text-ink">
                <span>Total</span>
                <span className="tabular-nums">{formatSGD(totalActual)}{totalTarget > 0 ? ` / ${formatSGD(totalTarget)}` : ""}</span>
              </div>
              <ProgressBar actual={totalActual} target={totalTarget} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProgressBar: React.FC<{ actual: number; target: number }> = ({ actual, target }) => {
  if (target <= 0) return null;
  const ratio = actual / target;
  const widthPct = Math.min(100, Math.max(0, ratio * 100));
  const tone = ratio >= 1 ? "bg-ok" : ratio >= 0.6 ? "bg-warn" : "bg-bad";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-faint">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[0.6875rem] tabular-nums text-faint-ink">{Math.round(ratio * 100)}%</span>
    </div>
  );
};

const SalesTargetRow: React.FC<{
  designerId: string;
  designerName: string;
  actual: number;
  target: number;
  editable: boolean;
  monthKey: string;
}> = ({ designerId, designerName, actual, target, editable, monthKey }) => {
  const setTargetMutation = useSetSalesTarget();
  const [value, setValue] = useState(target > 0 ? String(target) : "");

  // Re-sync the input when the underlying month/target changes (switching
  // months, or another admin's edit coming back through the query).
  React.useEffect(() => {
    setValue(target > 0 ? String(target) : "");
  }, [target, monthKey]);

  const handleBlur = () => {
    if (!editable) return;
    const amount = Number(value) || 0;
    if (amount === target) return;
    setTargetMutation.mutate(
      { designerId, designerName, monthKey, targetAmount: amount },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save target") }
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.8125rem] font-medium text-ink">{designerName}</span>
        <span className="shrink-0 text-[0.8125rem] tabular-nums text-faint-ink">{formatSGD(actual)}</span>
      </div>
      {editable ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint-ink">Target S$</span>
          <Input
            type="number"
            min="0"
            className="h-7 flex-1 text-xs"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            placeholder="0"
          />
        </div>
      ) : (
        <span className="text-xs text-faint-ink">{target > 0 ? `Target: ${formatSGD(target)}` : "No target set"}</span>
      )}
      <ProgressBar actual={actual} target={target} />
    </div>
  );
};
