import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Moon,
  ListChecks,
  AlertTriangle,
  Lightbulb,
  Package,
  Cloud,
  Newspaper,
  CloudRain,
  Sun,
  CloudSun,
  CalendarClock,
} from "lucide-react";
import { useTasksList } from "../hooks/useTasks";
import { useIssuesList } from "../hooks/useIssues";
import { useLightingList } from "../hooks/useLighting";
import { useBlumList } from "../hooks/useBlum";
import { useScheduleList } from "../hooks/useSchedule";
import { useAuth } from "../lib/AuthContext";
import { getChineseLunarDateLabel } from "../lib/lunarCalendar";
import { todayISODate } from "../lib/date";
import { SAMPLE_WEATHER, SAMPLE_HEADLINES } from "../lib/sampleWeatherNews";
import { SummaryCard } from "../components/SummaryCard";
import { PriorityBadge } from "../components/PriorityBadge";
import { Skeleton } from "../components/Skeleton";
import type { TaskPriority } from "../lib/types";

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

const CONDITION_ICON: Record<string, React.ReactNode> = {
  Sunny: <Sun size={20} />,
  "Partly Cloudy": <CloudSun size={20} />,
  Showers: <CloudRain size={20} />,
  Thunderstorms: <CloudRain size={20} />,
};

export const DashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const tasksQuery = useTasksList();
  const issuesQuery = useIssuesList();
  const lightingQuery = useLightingList();
  const blumQuery = useBlumList();
  const scheduleQuery = useScheduleList();

  const gregorianLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-SG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Singapore",
      }).format(new Date()),
    []
  );
  const lunarLabel = useMemo(() => getChineseLunarDateLabel(), []);
  const today = useMemo(() => todayISODate(), []);

  const openTasks = (tasksQuery.data ?? []).filter((t) => !t.done);
  const unresolvedIssues = (issuesQuery.data ?? []).filter((i) => !i.resolved);
  const outstandingLightingOrders = (lightingQuery.data ?? []).filter((e) => !e.reimbursed);
  const outstandingBlumClaims = (blumQuery.data ?? []).filter((e) => !e.reimbursed);
  const todaysSchedule = (scheduleQuery.data ?? []).filter((s) => s.date === today);

  const topTasks = [...openTasks]
    .sort((a, b) => {
      const priorityCmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityCmp !== 0) return priorityCmp;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Your daily overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card px-6 py-4 shadow">
          <div className="mb-2 flex items-center justify-between text-[0.8125rem] font-medium text-muted-foreground">
            <span>Gregorian Calendar</span>
            <CalendarDays size={18} />
          </div>
          <div className="font-display text-xl font-semibold text-foreground">{gregorianLabel}</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-6 py-4 shadow">
          <div className="mb-2 flex items-center justify-between text-[0.8125rem] font-medium text-muted-foreground">
            <span>Chinese Lunar Calendar</span>
            <Moon size={18} />
          </div>
          <div className="font-display text-xl font-semibold text-foreground">{lunarLabel}</div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Today's Schedule</h2>
          <Link to="/schedule" className="text-sm font-medium text-primary hover:underline">
            View all &rarr;
          </Link>
        </div>
        {scheduleQuery.isLoading ? (
          <Skeleton style={{ height: 40 }} />
        ) : todaysSchedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedule entries for today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todaysSchedule.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 rounded border border-border bg-surface p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-tint)] text-primary">
                  <CalendarClock size={15} />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">{entry.title}</span>
                  {(entry.startTime || entry.location) && (
                    <span className="text-xs text-muted-foreground">
                      {entry.startTime && `${entry.startTime}${entry.endTime ? ` - ${entry.endTime}` : ""}`}
                      {entry.startTime && entry.location && " - "}
                      {entry.location}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Link to="/tasks" className="block">
          <SummaryCard
            label="Open Tasks"
            value={tasksQuery.isLoading ? <Skeleton style={{ width: 40, height: 32 }} /> : openTasks.length}
            sublabel={`${(tasksQuery.data ?? []).length} total`}
            icon={<ListChecks size={18} />}
            tone="primary"
          />
        </Link>
        <Link to="/issues" className="block">
          <SummaryCard
            label="Unresolved Issues"
            value={issuesQuery.isLoading ? <Skeleton style={{ width: 40, height: 32 }} /> : unresolvedIssues.length}
            sublabel={`${(issuesQuery.data ?? []).length} total`}
            icon={<AlertTriangle size={18} />}
            tone="destructive"
          />
        </Link>
        {isAdmin && (
          <Link to="/lighting" className="block">
            <SummaryCard
              label="Smart Lighting Outstanding Claims"
              value={lightingQuery.isLoading ? <Skeleton style={{ width: 40, height: 32 }} /> : outstandingLightingOrders.length}
              sublabel={`${(lightingQuery.data ?? []).length} total`}
              icon={<Lightbulb size={18} />}
              tone="warning"
            />
          </Link>
        )}
        <Link to="/blum" className="block">
          <SummaryCard
            label="Blum Outstanding Claims"
            value={blumQuery.isLoading ? <Skeleton style={{ width: 40, height: 32 }} /> : outstandingBlumClaims.length}
            sublabel={`${(blumQuery.data ?? []).length} orders`}
            icon={<Package size={18} />}
            tone="secondary"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-lg border border-border bg-card p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Daily Task Summary</h2>
            <Link to="/tasks" className="text-sm font-medium text-primary hover:underline">
              View all &rarr;
            </Link>
          </div>
          {tasksQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 52 }} />
              ))}
            </div>
          ) : topTasks.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No outstanding tasks. Nicely done.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/tasks"
                    className="flex items-center justify-between gap-3 rounded border border-border bg-surface p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(task.dueDate).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Singapore Weather</h2>
            <Cloud size={18} className="text-muted-foreground" />
          </div>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="font-display text-3xl font-semibold text-foreground">{SAMPLE_WEATHER.temperature}&deg;C</span>
            <span className="text-[0.9375rem] text-muted-foreground">{SAMPLE_WEATHER.condition}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
            {SAMPLE_WEATHER.forecast.map((day) => (
              <div key={day.day} className="flex flex-col items-center gap-1 text-center">
                <span className="text-[0.6875rem] text-muted-foreground">{day.day}</span>
                <span className="text-primary">{CONDITION_ICON[day.condition] ?? <Cloud size={18} />}</span>
                <span className="text-xs tabular-nums text-foreground">
                  {day.high}&deg; / {day.low}&deg;
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[0.6875rem] italic text-muted-foreground">Sample data - connect a live weather API in production.</p>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Latest World News</h2>
          <Newspaper size={18} className="text-muted-foreground" />
        </div>
        <ul className="flex flex-col gap-3">
          {SAMPLE_HEADLINES.map((item) => (
            <li key={item.headline} className="flex items-baseline gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
              <span className="min-w-[5rem] shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-primary">
                {item.source}
              </span>
              <span className="text-sm text-foreground">{item.headline}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.6875rem] italic text-muted-foreground">Sample data - connect an RSS/news API in production.</p>
      </section>
    </div>
  );
};
