/**
 * Today's date as YYYY-MM-DD in the browser's local timezone.
 * `new Date().toISOString().slice(0, 10)` looks equivalent but isn't --
 * toISOString() converts to UTC first, so it returns yesterday's date for
 * anyone west of UTC in the early hours (e.g. before 8am in Singapore, UTC+8).
 */
export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
