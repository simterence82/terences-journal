import type { Timestamp } from "firebase-admin/firestore";

export function toIso(value: Timestamp): string {
  return value.toDate().toISOString();
}

export function toIsoOrNull(value: Timestamp | null | undefined): string | null {
  return value ? value.toDate().toISOString() : null;
}

// Mirrors SQLite's default ASC ordering, where NULL sorts before any value.
export function compareNullableAsc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}
