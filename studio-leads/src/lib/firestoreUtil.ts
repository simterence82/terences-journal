import type { Timestamp } from "firebase/firestore";

export function toIso(value: Timestamp | null | undefined): string | null {
  return value ? value.toDate().toISOString() : null;
}

/** yyyy-mm-dd for "today", in the browser's local timezone. */
export function todayDateString(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}
