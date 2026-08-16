import React, { useMemo, useState } from "react";
import { Info, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useLeadsList } from "../hooks/useLeads";
import { useAttendanceList } from "../hooks/useAttendance";
import { useDesignersList } from "../hooks/useUsers";
import { useSalesTargetsList, useSetSalesTarget } from "../hooks/useSalesTargets";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { formatSGD } from "../lib/formatCurrency";
import { computeDesignerKpi, gradeForScore, KPI_PERIOD_LABELS, KPI_WEIGHTS, SLA_RESPONSE_HOURS, type KpiPeriod, type DesignerKpi } from "../lib/kpi";
import { isAdminRole, type Lead } from "../lib/types";
import { Tabs } from "../components/Tabs";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Every "YYYY-MM" month key touched by a from/to date range, inclusive. */
function monthKeysBetween(fromDate: string, toDate: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  cursor.setDate(1);
  const end = new Date(`${toDate}T00:00:00`);
  while (cursor <= end) {
    keys.push(monthKeyOf(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

function yearBounds(year: string): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** How many days of `monthKey` fall inside [from, to] -- 0 if none. Used to
    prorate that month's target down to a strict custom-range window. */
function overlapDays(monthKey: string, from: string, to: string): number {
  const bounds = monthBounds(monthKey);
  const start = bounds.from > from ? bounds.from : from;
  const end = bounds.to < to ? bounds.to : to;
  if (start > end) return 0;
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
}

/** Sum of contractAmount (the real signed value, before GST) for signed
    leads closed within [from, to] -- optionally scoped to one designer. */
function signedSum(leads: Lead[], from: string, to: string, designerId?: string): number {
  return leads
    .filter((l) => {
      if (l.status !== "signed" || !l.closedAt) return false;
      const closedDate = l.closedAt.slice(0, 10);
      if (closedDate < from || closedDate > to) return false;
      return !designerId || l.assignedTo === designerId;
    })
    .reduce((sum, l) => sum + (l.contractAmount ?? l.quotationAmount ?? 0), 0);
}

export const KpiPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const attendanceQuery = useAttendanceList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();

  const [period, setPeriod] = useState<KpiPeriod>("this_month");

  const isLoading = leadsQuery.isLoading || attendanceQuery.isLoading || (isAdmin && designersQuery.isLoading);
  const leads = leadsQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];

  const kpis: DesignerKpi[] = useMemo(() => {
    if (isAdmin) {
      const designers = designersQuery.data ?? [];
      return designers.map((d) =>
        computeDesignerKpi(
          d.id,
          d.displayName,
          leads.filter((l) => l.assignedTo === d.id),
          attendance.filter((a) => a.designerId === d.id),
          period
        )
      );
    }
    if (!currentUser) return [];
    return [computeDesignerKpi(currentUser.id, currentUser.displayName, leads, attendance, period)];
  }, [isAdmin, designersQuery.data, leads, attendance, period, currentUser]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">KPI &amp; Grading</h1>
          <p className="mt-1 text-[0.9375rem] text-faint-ink">
            {isAdmin ? "How promptly and consistently each designer is following up" : "Your own performance snapshot"}
          </p>
        </div>

        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as KpiPeriod)}
          options={(Object.keys(KPI_PERIOD_LABELS) as KpiPeriod[]).map((p) => ({ value: p, label: KPI_PERIOD_LABELS[p] }))}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} style={{ height: 220 }} />
            ))}
          </div>
        ) : kpis.length === 0 ? (
          <EmptyState icon={<Trophy size={28} />} message="No designers to grade yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {kpis.map((k) => (
              <KpiCard key={k.designerId} kpi={k} />
            ))}
          </div>
        )}

        <div className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-[0.8125rem] text-faint-ink">
          <Info size={18} className="mt-0.5 shrink-0 text-brand" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-ink">How the Commitment Score works</p>
            <p>
              A weighted average of four signals — Response Time ({KPI_WEIGHTS.response}%, first contact within {SLA_RESPONSE_HOURS}h of assignment),
              Follow-up Compliance ({KPI_WEIGHTS.followUp}%, share of open leads not overdue for their next follow-up), Conversion
              ({KPI_WEIGHTS.conversion}%, signed vs. rejected among leads closed in the period), and Attendance ({KPI_WEIGHTS.attendance}%, present/late
              days vs. days tracked, leave and MC excluded). Any signal with no data yet (e.g. no closed leads this period) is left out and the remaining
              weights are rescaled — a new designer isn't unfairly marked down for having no track record. These weights are a starting point in{" "}
              <code className="rounded bg-faint px-1 py-0.5 font-mono text-xs">src/lib/kpi.ts</code> — tune them to match how your studio actually wants
              to grade commitment.
            </p>
          </div>
        </div>
      </div>

      {isAdmin && <SalesTargetSidebar leads={leads} designers={designersQuery.data ?? []} />}
    </div>
  );
};

const KpiCard: React.FC<{ kpi: DesignerKpi }> = ({ kpi }) => {
  const grade = gradeForScore(kpi.commitmentScore);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-[8rem] flex-1">
          <h3 className="font-display text-lg font-semibold text-ink">{kpi.designerName}</h3>
          <p className="text-xs text-faint-ink">{kpi.leadsAssigned} leads assigned this period</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <div className="text-right">
            <div className="font-display text-2xl font-semibold leading-none text-ink tabular-nums">
              {kpi.commitmentScore !== null ? Math.round(kpi.commitmentScore) : "—"}
            </div>
            <div className="text-[0.6875rem] text-faint-ink">/ 100</div>
          </div>
          {grade && (
            <Badge variant={grade.tone} className="whitespace-nowrap text-xs">
              {grade.letter} · {grade.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
        <Stat label="Response" value={pct(kpi.responseRate)} sub={`${kpi.responseSampleSize} judged`} />
        <Stat label="Follow-up" value={pct(kpi.followUpComplianceRate)} sub={`${kpi.overdueOpenLeads}/${kpi.openLeadsTracked} overdue`} />
        <Stat label="Conversion" value={pct(kpi.conversionRate)} sub={`${kpi.signedCount}W / ${kpi.rejectedCount}L`} />
        <Stat label="Attendance" value={pct(kpi.attendanceRate)} sub={`${kpi.attendanceDaysTracked} days`} />
      </div>

      {kpi.signedValue > 0 && (
        <p className="text-xs text-faint-ink">Signed value this period: <span className="font-medium text-ink">{formatSGD(kpi.signedValue)}</span></p>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[0.6875rem] uppercase tracking-wide text-faint-ink">{label}</span>
    <span className="font-display text-lg font-semibold text-ink tabular-nums">{value}</span>
    <span className="text-[0.6875rem] text-faint-ink">{sub}</span>
  </div>
);

type TimelineMode = "month" | "year" | "range";

/**
 * Admin/super admin only -- each designer's signed sales vs. the target set
 * for them, viewable by month, year, or a custom date range. Targets are
 * only ever stored per calendar month (see useSalesTargets.ts); viewing by
 * year or range just sums whichever monthly targets fall in that window,
 * so editing only makes sense (and is only offered) in Month view.
 */
const SalesTargetSidebar: React.FC<{ leads: Lead[]; designers: { id: string; displayName: string }[] }> = ({ leads, designers }) => {
  const targetsQuery = useSalesTargetsList();
  const targets = targetsQuery.data ?? [];

  const [mode, setMode] = useState<TimelineMode>("month");
  const [monthValue, setMonthValue] = useState(() => monthKeyOf(new Date()));
  const [yearValue, setYearValue] = useState(() => String(new Date().getFullYear()));
  const [rangeFrom, setRangeFrom] = useState(todayDateString());
  const [rangeTo, setRangeTo] = useState(todayDateString());

  const { from, to } = mode === "month" ? monthBounds(monthValue) : mode === "year" ? yearBounds(yearValue) : { from: rangeFrom, to: rangeTo };
  const relevantMonthKeys = mode === "month" ? [monthValue] : monthKeysBetween(from, to);
  const editable = mode === "month";

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
    <div className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm lg:sticky lg:top-6 lg:w-80">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-brand" />
        <h2 className="font-display text-lg font-semibold text-ink">Sales Target</h2>
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

          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <div className="flex items-center justify-between text-[0.8125rem] font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{formatSGD(totalActual)}{totalTarget > 0 ? ` / ${formatSGD(totalTarget)}` : ""}</span>
            </div>
            <ProgressBar actual={totalActual} target={totalTarget} />
          </div>
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
