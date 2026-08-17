import type { Lead } from "./types";

// Shared by the KPI page's admin Sales Target panel and a designer's own
// read-only Personal Sales Figure page (see components/SalesTargetPanel.tsx)
// -- the date-window math and the split-aware "how much of this lead counts
// toward this designer" calculation live here once so both stay consistent.

export type TimelineMode = "month" | "year" | "range";

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Every "YYYY-MM" month key touched by a from/to date range, inclusive. */
export function monthKeysBetween(fromDate: string, toDate: string): string[] {
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

export function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

export function yearBounds(year: string): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** How many days of `monthKey` fall inside [from, to] -- 0 if none. Used to
    prorate that month's target down to a strict custom-range window. */
export function overlapDays(monthKey: string, from: string, to: string): number {
  const bounds = monthBounds(monthKey);
  const start = bounds.from > from ? bounds.from : from;
  const end = bounds.to < to ? bounds.to : to;
  if (start > end) return 0;
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * What fraction (0-1) of `lead`'s contract value counts toward
 * `designerId`'s own figures. A solo lead (isShared falsy) counts 100% for
 * its assignee and 0% for anyone else. A shared lead splits by the
 * percentages in sharedWith -- a named designer gets their exact cut, and
 * the assignee gets whatever's left over (100% minus the sum of the
 * others), never a second explicitly-set number for themselves.
 */
export function designerShareFraction(lead: Lead, designerId: string): number {
  if (!lead.isShared) {
    return lead.assignedTo === designerId ? 1 : 0;
  }
  const shareEntry = lead.sharedWith.find((s) => s.designerId === designerId);
  if (shareEntry) return shareEntry.percentage / 100;
  if (lead.assignedTo === designerId) {
    const othersPct = lead.sharedWith.reduce((sum, s) => sum + s.percentage, 0);
    return Math.max(0, 100 - othersPct) / 100;
  }
  return 0;
}

/**
 * Sum of contractAmount (the real signed value, before GST -- GST never
 * changes this stored figure regardless of gstApplicable) for signed leads
 * closed within [from, to]. With no designerId, every lead counts in full
 * (the studio-wide total is unaffected by how it's internally split).
 * Scoped to one designer, each lead counts only that designer's share --
 * their own leads in full unless shared, plus their cut of anyone else's
 * shared leads.
 */
export function signedSum(leads: Lead[], from: string, to: string, designerId?: string): number {
  return leads
    .filter((l) => {
      if (l.status !== "signed" || !l.closedAt) return false;
      const closedDate = l.closedAt.slice(0, 10);
      return closedDate >= from && closedDate <= to;
    })
    .reduce((sum, l) => {
      const amount = l.contractAmount ?? l.quotationAmount ?? 0;
      if (!designerId) return sum + amount;
      return sum + amount * designerShareFraction(l, designerId);
    }, 0);
}
