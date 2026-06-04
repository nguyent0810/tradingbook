/** UTC calendar day helpers aligned with bar import scripts. */

export function isoDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD as UTC midnight (matches import-bars.ts / import-stock-bars.ts). */
export function parseSessionDateUtc(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) {
    throw new Error(`Invalid session date "${day}" — expected YYYY-MM-DD`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d));
}

export function sessionDatesEqual(a: Date, b: Date): boolean {
  return isoDayUtc(a) === isoDayUtc(b);
}
