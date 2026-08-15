import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Handshake, Megaphone, TrendingUp } from "lucide-react";
import { useLeadsList } from "../hooks/useLeads";
import { useAnnouncementsList } from "../hooks/useAnnouncements";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { CLOSED_LEAD_STATUSES, isAdminRole } from "../lib/types";
import { SummaryCard } from "../components/SummaryCard";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

export const DashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const announcementsQuery = useAnnouncementsList();
  const leads = leadsQuery.data ?? [];
  const announcements = (announcementsQuery.data ?? []).slice(0, 3);
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
        <h1 className="font-display text-3xl font-semibold text-ink">
          {isAdmin ? "Studio Overview" : `Welcome, ${currentUser?.displayName ?? ""}`}
        </h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">
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
          <SummaryCard label="Active Leads" value={activeLeads.length} icon={<Handshake size={16} />} tone="brand" />
          <SummaryCard label="Overdue Follow-ups" value={overdue.length} icon={<AlertTriangle size={16} />} tone={overdue.length > 0 ? "bad" : "ok"} />
          <SummaryCard label="Due Today" value={dueToday.length} icon={<CalendarClock size={16} />} tone="warn" />
          <SummaryCard label="Signed This Month" value={signedThisMonth.length} icon={<TrendingUp size={16} />} tone="ok" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Needs Attention</h2>
          <Link to="/leads" className="text-[0.8125rem] text-brand hover:underline">
            View all leads
          </Link>
        </div>
        {leadsQuery.isLoading ? (
          <Skeleton style={{ height: 160 }} />
        ) : attention.length === 0 ? (
          <EmptyState icon={<Handshake size={26} />} message="Nothing overdue or due today. Nice work." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
            <table className="w-full text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Client", "Assigned To", "Status", "Follow-up Due"].map((h) => (
                    <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
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
                      <td className="border-b border-line px-4 py-3 text-ink">{l.clientName}</td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{l.assignedToName ?? "—"}</td>
                      <td className="border-b border-line px-4 py-3">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className={`border-b border-line px-4 py-3 font-medium ${isOverdue ? "text-bad" : "text-ink"}`}>
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Notice Board</h2>
          <Link to="/notice-board" className="text-[0.8125rem] text-brand hover:underline">
            View all
          </Link>
        </div>
        {announcementsQuery.isLoading ? (
          <Skeleton style={{ height: 100 }} />
        ) : announcements.length === 0 ? (
          <EmptyState icon={<Megaphone size={24} />} message="No announcements yet." className="py-8" />
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-xl border border-line bg-panel p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  {a.pinned && <Badge variant="brand">Pinned</Badge>}
                  <h3 className="font-display text-[0.9375rem] font-semibold text-ink">{a.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] text-faint-ink">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
