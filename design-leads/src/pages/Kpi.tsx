import React, { useMemo, useState } from "react";
import { Info, Trophy } from "lucide-react";
import { useLeadsList } from "../hooks/useLeads";
import { useAttendanceList } from "../hooks/useAttendance";
import { useDesignersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { formatSGD } from "../lib/formatCurrency";
import { computeDesignerKpi, gradeForScore, KPI_PERIOD_LABELS, KPI_WEIGHTS, SLA_RESPONSE_HOURS, type KpiPeriod, type DesignerKpi } from "../lib/kpi";
import { Tabs } from "../components/Tabs";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export const KpiPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = currentUser?.role === "admin";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">KPI &amp; Grading</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
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

      <div className="flex gap-3 rounded-lg border border-border bg-surface p-4 text-[0.8125rem] text-muted-foreground">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">How the Commitment Score works</p>
          <p>
            A weighted average of four signals — Response Time ({KPI_WEIGHTS.response}%, first contact within {SLA_RESPONSE_HOURS}h of assignment),
            Follow-up Compliance ({KPI_WEIGHTS.followUp}%, share of open leads not overdue for their next follow-up), Conversion
            ({KPI_WEIGHTS.conversion}%, signed vs. rejected among leads closed in the period), and Attendance ({KPI_WEIGHTS.attendance}%, present/late
            days vs. days tracked, leave excluded). Any signal with no data yet (e.g. no closed leads this period) is left out and the remaining weights
            are rescaled — a new designer isn't unfairly marked down for having no track record. These weights are a starting point in{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">src/lib/kpi.ts</code> — tune them to match how your studio actually wants
            to grade commitment.
          </p>
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ kpi: DesignerKpi }> = ({ kpi }) => {
  const grade = gradeForScore(kpi.commitmentScore);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">{kpi.designerName}</h3>
          <p className="text-xs text-muted-foreground">{kpi.leadsAssigned} leads assigned this period</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-3xl font-semibold leading-none text-foreground tabular-nums">
              {kpi.commitmentScore !== null ? Math.round(kpi.commitmentScore) : "—"}
            </div>
            <div className="text-[0.6875rem] text-muted-foreground">/ 100</div>
          </div>
          {grade && (
            <Badge variant={grade.tone} className="text-sm">
              {grade.letter} · {grade.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <Stat label="Response" value={pct(kpi.responseRate)} sub={`${kpi.responseSampleSize} judged`} />
        <Stat label="Follow-up" value={pct(kpi.followUpComplianceRate)} sub={`${kpi.overdueOpenLeads}/${kpi.openLeadsTracked} overdue`} />
        <Stat label="Conversion" value={pct(kpi.conversionRate)} sub={`${kpi.signedCount}W / ${kpi.rejectedCount}L`} />
        <Stat label="Attendance" value={pct(kpi.attendanceRate)} sub={`${kpi.attendanceDaysTracked} days`} />
      </div>

      {kpi.signedValue > 0 && (
        <p className="text-xs text-muted-foreground">Signed value this period: <span className="font-medium text-foreground">{formatSGD(kpi.signedValue)}</span></p>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="font-display text-lg font-semibold text-foreground tabular-nums">{value}</span>
    <span className="text-[0.6875rem] text-muted-foreground">{sub}</span>
  </div>
);
