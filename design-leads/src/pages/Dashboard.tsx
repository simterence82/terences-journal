import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Handshake, TrendingUp } from "lucide-react";
import { useLeadsList } from "../hooks/useLeads";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { CLOSED_LEAD_STATUSES } from "../lib/types";
import { SummaryCard } from "../components/SummaryCard";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

export const DashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = currentUser?.role === "admin";

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const leads = leadsQuery.data ?? [];
  const today = todayDateString();

  const activeLeads = leads.filter((l) => !CLOSED_LEAD_STATUSES.includes(l.status));
  const overdue = activeLeads.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate < today);
  const dueToday = activeLeads.filter((l) => l.nextFollowUpDate === today);
  const signedThisMonth = leads.filter((l) => {
    if (l.status !== "signed" || !l.closedAt) return false;
    const d = new Date(l.closedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const attention = useMemo(
    () =>
      [...overdue, ...dueToday]
        .sort((a, b) => (a.nextFollowUpDate! < b.nextFollowUpDate! ? -1 : 1))
        .slice(0, 8),
    [overdue, dueToday]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {isAdmin ? "Studio Overview" : `Welcome, ${currentUser?.displayName ?? ""}`}
        </h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {isAdmin ? "Every lead currently in play across the team" : "Your leads and what needs attention today"}
        </p>
      </div>

      {leadsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 96 }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Active Leads" value={activeLeads.length} icon={<Handshake size={16} />} tone="primary" />
          <SummaryCard label="Overdue Follow-ups" value={overdue.length} icon={<AlertTriangle size={16} />} tone={overdue.length > 0 ? "destructive" : "success"} />
          <SummaryCard label="Due Today" value={dueToday.length} icon={<CalendarClock size={16} />} tone="warning" />
          <SummaryCard label="Signed This Month" value={signedThisMonth.length} icon={<TrendingUp size={16} />} tone="success" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Needs Attention</h2>
          <Link to="/leads" className="text-[0.8125rem] text-primary hover:underline">
            View all leads
          </Link>
        </div>
        {leadsQuery.isLoading ? (
          <Skeleton style={{ height: 160 }} />
        ) : attention.length === 0 ? (
          <EmptyState icon={<Handshake size={26} />} message="Nothing overdue or due today. Nice work." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
            <table className="w-full text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Client", "Assigned To", "Status", "Follow-up Due"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attention.map((l) => {
                  const isOverdue = l.nextFollowUpDate! < today;
                  return (
                    <tr key={l.id} className="hover:bg-surface">
                      <td className="border-b border-border px-4 py-3 text-foreground">{l.clientName}</td>
                      <td className="border-b border-border px-4 py-3 text-muted-foreground">{l.assignedToName ?? "—"}</td>
                      <td className="border-b border-border px-4 py-3">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className={`border-b border-border px-4 py-3 font-medium ${isOverdue ? "text-error" : "text-foreground"}`}>
                        {new Date(`${l.nextFollowUpDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                        {isOverdue ? " (overdue)" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
