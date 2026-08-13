// node:sqlite stores booleans as 0/1 integers and timestamps as integer
// milliseconds -- these convert between that and the JSON shapes the API
// returns (booleans, ISO date strings).

export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return new Date(Number(value)).toISOString();
}

export function nowMs(): number {
  return Date.now();
}
