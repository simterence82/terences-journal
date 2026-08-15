import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Handshake,
  CalendarCheck,
  Trophy,
  Megaphone,
  Store,
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
import { USER_ROLE_LABELS, type UserRole } from "../lib/types";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, adminOnly: false },
  { to: "/leads", label: "Leads", icon: Handshake, end: false, adminOnly: false },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, end: false, adminOnly: false },
  { to: "/kpi", label: "KPI & Grading", icon: Trophy, end: false, adminOnly: true },
  { to: "/notice-board", label: "Notice Board", icon: Megaphone, end: false, adminOnly: false },
  { to: "/showroom", label: "Showroom", icon: Store, end: false, adminOnly: false },
  { to: "/users", label: "Users", icon: UsersIcon, end: false, adminOnly: true },
] as const;

const ROLE_BADGE_VARIANT: Record<UserRole, "brand" | "ok" | "accent"> = {
  super_admin: "brand",
  admin: "ok",
  designer: "accent",
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
    isActive ? "bg-[var(--brand-wash)] text-brand" : "text-faint-ink hover:bg-faint hover:text-ink"
  }`;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = authState.type === "authenticated" ? authState.user : null;

  const initials = user
    ? user.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin" || user?.role === "super_admin");

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-line bg-panel lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60">
        <div className="flex flex-col items-start gap-0.5 px-5 py-5">
          <img src="/logo.png" alt="Form & Space" className="h-8 w-8 object-contain dark:invert" />
          <span className="whitespace-nowrap font-display text-[0.65rem] font-bold uppercase leading-none tracking-[0.1em] text-ink">
            Form &amp; Space
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-3 border-t border-line px-3 py-4">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-faint-ink transition-colors hover:bg-faint hover:text-ink"
          >
            {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </button>
          {user && (
            <div className="flex items-center gap-2 px-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-wash)] text-xs font-semibold text-brand">
                {initials}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[0.8125rem] font-semibold leading-none text-ink">{user.displayName}</span>
                <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="w-fit">
                  {USER_ROLE_LABELS[user.role]}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint-ink hover:bg-faint hover:text-bad"
                aria-label="Log out"
              >
                <LogOut size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-[200] flex items-center justify-between border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Form & Space" className="h-7 w-7 object-contain dark:invert" />
          <span className="whitespace-nowrap font-display text-[0.6rem] font-bold uppercase leading-none tracking-[0.1em] text-ink">
            Form &amp; Space
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint-ink hover:bg-faint"
            aria-label="Toggle theme"
          >
            {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint-ink hover:bg-faint"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-b border-line bg-panel px-4 py-3 lg:hidden">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={navLinkClass}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
          {user && (
            <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-wash)] text-xs font-semibold text-brand">
                {initials}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.8125rem] font-semibold leading-none text-ink">{user.displayName}</span>
                <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="w-fit">
                  {USER_ROLE_LABELS[user.role]}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-bad hover:bg-faint"
              >
                <LogOut size={18} /> Log out
              </button>
            </div>
          )}
        </nav>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
};
