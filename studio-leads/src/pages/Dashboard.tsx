import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, CalendarClock, Check, Handshake, Megaphone, TrendingUp, X as XIcon } from "lucide-react";
import { useLeadsList } from "../hooks/useLeads";
import { useAnnouncementsList } from "../hooks/useAnnouncements";
import { useAttendanceList, useLeaveCalendarList, useSetLeaveApproval } from "../hooks/useAttendance";
import { useShowroomItemsList } from "../hooks/useShowroom";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { ATTENDANCE_REASON_LABELS, CLOSED_LEAD_STATUSES, SHOWROOM_STATUS_LABELS, isAdminRole, type AttendanceRecord } from "../lib/types";
import { SummaryCard } from "../components/SummaryCard";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { LeaveCalendar } from "../components/LeaveCalendar";
import { EventCalendar } from "../components/EventCalendar";

export const DashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const announcementsQuery = useAnnouncementsList();
  const leaveCalendarQuery = useLeaveCalendarList();
  const showroomQuery = useShowroomItemsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  // Only fetched for admins -- this is how they'd otherwise miss a
  // designer's leave application, since it used to live only inside
  // Attendance's own Pending Leave Applications tab.
  const attendanceQuery = useAttendanceList(isAdmin && currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const approvalMutation = useSetLeaveApproval();
  const leads = leadsQuery.data ?? [];
  const allAnnouncements = announcementsQuery.data ?? [];
  const announcements = allAnnouncements.slice(0, 3);
  const showroomItems = showroomQuery.data ?? [];
  const today = todayDateString();

  const pendingLeaveRecords = useMemo(
    () =>
      (attendanceQuery.data ?? [])
        .filter((r) => r.status === "leave" && r.leaveApproval === "pending")
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [attendanceQuery.data]
  );

  const handleApprove = (record: AttendanceRecord, approval: "approved" | "rejected") => {
    approvalMutation.mutate(
      { id: record.id, approval },
      {
        onSuccess: () => toast.success(approval === "approved" ? "Leave approved" : "Leave marked not approved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update approval"),
      }
    );
  };

  // Every announcement with an upcoming event date, plus every Aircon &
  // Servicing item (scheduled or still open) -- same event shape the
  // Showroom page's own calendar uses, so what shows there also shows here
  // for everyone. An announcement whose event date has passed drops off
  // the calendar -- it's archived under Notice Board's Past Events instead.
  const dashboardEvents = useMemo(
    () => [
      ...allAnnouncements
        .filter((a) => a.eventDate && a.eventDate >= today)
        .map((a) => ({ id: a.id, date: a.eventDate!, title: a.title, time: a.eventTime })),
      ...showroomItems
        .filter((i) => i.category === "aircon_servicing")
        .map((i) => ({
          id: i.id,
          date: (i.scheduledAt ?? i.createdAt).slice(0, 10),
          title: `${i.title} — ${SHOWROOM_STATUS_LABELS[i.status]}`,
          time: i.scheduledAt ? new Date(i.scheduledAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false }) : null,
        })),
    ],
    [allAnnouncements, showroomItems]
  );

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
          {isAdmin ? "Leads Overview" : `Welcome, ${currentUser?.displayName ?? ""}`}
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
          <SummaryCard label="Active Leads" value={activeLeads.length} icon={<Handshake size={16} />} tone="brand" to="/leads" />
          <SummaryCard label="Overdue Follow-ups" value={overdue.length} icon={<AlertTriangle size={16} />} tone={overdue.length > 0 ? "bad" : "ok"} to="/leads" />
          <SummaryCard label="Due Today" value={dueToday.length} icon={<CalendarClock size={16} />} tone="warn" to="/leads" />
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
          <h2 className="font-display text-lg font-semibold text-ink">Away Calendar</h2>
          <Link to="/attendance" className="text-[0.8125rem] text-brand hover:underline">
            {isAdmin ? "Go to Attendance" : "Apply for leave"}
          </Link>
        </div>
        {leaveCalendarQuery.isLoading ? (
          <Skeleton style={{ height: 220 }} />
        ) : (
          <LeaveCalendar
            records={leaveCalendarQuery.data ?? []}
            showReasons
            emptyHint="No one on the team has leave scheduled this month."
          />
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Pending Leave Applications</h2>
              {pendingLeaveRecords.length > 0 && <Badge variant="warn">{pendingLeaveRecords.length}</Badge>}
            </div>
            <Link to="/attendance" className="text-[0.8125rem] text-brand hover:underline">
              Go to Attendance
            </Link>
          </div>
          {attendanceQuery.isLoading ? (
            <Skeleton style={{ height: 120 }} />
          ) : pendingLeaveRecords.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={24} />} message="No pending leave applications." className="py-6" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
              <table className="w-full text-[0.8125rem]">
                <thead className="bg-surface">
                  <tr>
                    {["Designer", "Date", "Reason", "Decision"].map((h) => (
                      <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaveRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-surface">
                      <td className="border-b border-line px-4 py-3 text-ink">{r.designerName}</td>
                      <td className="border-b border-line px-4 py-3 text-ink">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-faint-ink">{r.reason ? ATTENDANCE_REASON_LABELS[r.reason] : "—"}</td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="soft" size="sm" onClick={() => handleApprove(r, "approved")}>
                            <Check size={14} /> Approve
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleApprove(r, "rejected")}>
                            <XIcon size={14} /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Upcoming Events</h2>
          <Link to="/notice-board" className="text-[0.8125rem] text-brand hover:underline">
            Go to Notice Board
          </Link>
        </div>
        {announcementsQuery.isLoading || showroomQuery.isLoading ? (
          <Skeleton style={{ height: 220 }} />
        ) : (
          <EventCalendar events={dashboardEvents} emptyHint="Nothing scheduled this month." />
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
