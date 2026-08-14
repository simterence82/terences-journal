import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Handshake,
  CalendarCheck,
  Trophy,
  Users as UsersIcon,
  LogOut,
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
  { to: "/leads", label: "Leads", icon: Handshake, end: false, adminOnly: false },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, end: false, adminOnly: false },
  { to: "/kpi", label: "KPI & Grading", icon: Trophy, end: false, adminOnly: false },
  { to: "/users", label: "Users", icon: UsersIcon, end: false, adminOnly: true },
] as const;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = authState.type === "authenticated" ? authState.user : null;

  const initials = user
    ? user.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-[200] border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-sm">
              <Handshake size={18} />
            </span>
            <span className="font-display text-lg font-semibold leading-tight text-ink">Studio Leads</span>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {visibleItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    isActive ? "bg-[var(--brand-wash)] text-brand" : "text-faint-ink hover:bg-faint hover:text-ink"
                  }`
                }
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint-ink hover:bg-faint"
              aria-label="Toggle theme"
            >
              {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {user && (
              <div className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-wash)] text-xs font-semibold text-brand">
                  {initials}
                </div>
                <div className="hidden flex-col gap-0.5 md:flex">
                  <span className="text-[0.8125rem] font-semibold leading-none text-ink">{user.displayName}</span>
                  <Badge variant={user.role === "admin" ? "brand" : "accent"} className="w-fit">
                    {user.role}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-faint-ink hover:bg-faint hover:text-bad"
                  aria-label="Log out"
                >
                  <LogOut size={17} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint-ink hover:bg-faint lg:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 lg:hidden">
            {visibleItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    isActive ? "bg-[var(--brand-wash)] text-brand" : "text-faint-ink hover:bg-faint hover:text-ink"
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
            {user && (
              <button
                type="button"
                onClick={() => logout()}
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-bad hover:bg-faint"
              >
                <LogOut size={18} />
                Log out
              </button>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
};
