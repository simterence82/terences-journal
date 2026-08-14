import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarClock,
  Lightbulb,
  Package,
  ListChecks,
  AlertTriangle,
  FolderArchive,
  Users as UsersIcon,
  Trash2,
  LogOut,
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useThemeMode } from "../lib/useThemeMode";
import { Badge } from "./Badge";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, adminOnly: false },
  { to: "/schedule", label: "Terence Schedule", icon: CalendarClock, end: false, adminOnly: false },
  { to: "/lighting", label: "Smart Lighting", icon: Lightbulb, end: false, adminOnly: false },
  { to: "/blum", label: "Blum Purchases", icon: Package, end: false, adminOnly: false },
  { to: "/tasks", label: "Outstanding Tasks", icon: ListChecks, end: false, adminOnly: false },
  { to: "/issues", label: "Outstanding Issues", icon: AlertTriangle, end: false, adminOnly: false },
  { to: "/files-archive", label: "Files Archive", icon: FolderArchive, end: false, adminOnly: false },
  { to: "/users", label: "Users", icon: UsersIcon, end: false, adminOnly: true },
  { to: "/trash", label: "Trash Bin", icon: Trash2, end: false, adminOnly: true },
] as const;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [navOpen, setNavOpen] = useState(false);
  const user = authState.type === "authenticated" ? authState.user : null;

  const initials = user
    ? user.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <div className="flex min-h-screen bg-background">
      {navOpen && (
        <div className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.5)] lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[310] flex w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2 text-primary">
          <div className="flex items-center gap-2">
            <BookOpen size={22} />
            <span className="font-display text-lg font-semibold text-foreground">Terence's Journal</span>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6 lg:justify-end lg:px-8 lg:py-4">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user && (
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  {initials}
                </div>
                <div className="hidden flex-col gap-0.5 sm:flex">
                  <span className="text-[0.8125rem] font-semibold leading-none text-foreground">{user.displayName}</span>
                  <Badge variant={user.role === "admin" ? "primary" : "secondary"} className="w-fit">
                    {user.role}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-error"
                  aria-label="Log out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
