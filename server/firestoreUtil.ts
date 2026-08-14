import type { Timestamp } from "firebase-admin/firestore";

export function toIso(value: Timestamp): string {
  return value.toDate().toISOString();
}

export function toIsoOrNull(value: Timestamp | null | undefined): string | null {
  return value ? value.toDate().toISOString() : null;
}
