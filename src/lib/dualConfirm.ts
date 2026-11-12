import { toast } from "sonner";
import type { UserRole } from "./types";

// Some boxes (a task's Done, a purchase's Claimed) only count once BOTH the
// Admin and the Super Admin have ticked them, so a single accidental click
// can't move an item out of sight. Each side keeps its own flag; the original
// combined field (done / reimbursed) is kept up to date as "both ticked" so
// queries, tabs and the dashboard keep working off it.

export type Party = "admin" | "superadmin";
export interface DualState {
  admin: boolean;
  superadmin: boolean;
}

export const PARTY_LABEL: Record<Party, string> = { admin: "Admin", superadmin: "Super Admin" };

export interface DualKeys {
  combined: string;
  admin: string;
  superadmin: string;
}

export const DONE_KEYS: DualKeys = { combined: "done", admin: "doneAdmin", superadmin: "doneSuper" };
export const CLAIMED_KEYS: DualKeys = { combined: "reimbursed", admin: "reimbursedAdmin", superadmin: "reimbursedSuper" };

/** Whoever isn't the Super Admin acts as the Admin side. */
export function partyFor(role: UserRole | undefined): Party {
  return role === "superadmin" ? "superadmin" : "admin";
}

/** Records saved before this rule only have the combined flag -- treat it as both sides having ticked. */
export function readDual(data: Record<string, any>, keys: DualKeys): DualState {
  const legacy = !!data[keys.combined];
  return { admin: data[keys.admin] ?? legacy, superadmin: data[keys.superadmin] ?? legacy };
}

export const isBoth = (s: DualState) => s.admin && s.superadmin;

/** The Firestore fields to write when one side ticks or unticks. */
export function dualUpdate(keys: DualKeys, current: DualState, party: Party, checked: boolean): Record<string, boolean> {
  const next = { ...current, [party]: checked };
  return { [keys.admin]: next.admin, [keys.superadmin]: next.superadmin, [keys.combined]: isBoth(next) };
}

/** Tells whoever just clicked where things stand -- loudest when the Admin ticks before the Super Admin has. */
export function announceDualToggle(what: string, party: Party, checked: boolean, current: DualState) {
  if (!checked) return;
  const other = party === "admin" ? current.superadmin : current.admin;
  if (other) {
    toast.success(`${what} confirmed by both of you`);
  } else if (party === "admin") {
    toast.warning(`${what} ticked on your side only`, {
      description: "The Super Admin hasn't ticked it yet, so it stays where it is. Remind them to carry out the task and tick it too.",
      duration: 12000,
    });
  } else {
    toast.info(`${what} ticked -- waiting for the Admin to tick it too`);
  }
}
