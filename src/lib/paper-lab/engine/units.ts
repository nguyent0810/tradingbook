import { kVndToPerShareVnd } from "@/lib/position-sizing";

export function kvndToVnd(priceKVnd: number): number {
  return kVndToPerShareVnd(priceKVnd);
}

export function computeNotionalVnd(priceKVnd: number, quantity: number): number {
  return Math.round(kvndToVnd(priceKVnd) * quantity);
}

export function computeRiskAtStopVnd(
  entryKVnd: number,
  stopKVnd: number,
  quantity: number
): number {
  const perShareRisk = Math.max(0, kvndToVnd(entryKVnd) - kvndToVnd(stopKVnd));
  return Math.round(perShareRisk * quantity);
}

export function computeRMultipleLong(
  entryKVnd: number,
  exitKVnd: number,
  stopKVnd: number
): number | null {
  const risk = entryKVnd - stopKVnd;
  if (!(risk > 0)) return null;
  return (exitKVnd - entryKVnd) / risk;
}

export function isWithinLimitBand(
  priceKVnd: number,
  prevCloseKVnd: number,
  bandPct: number
): boolean {
  if (!(prevCloseKVnd > 0)) return true;
  const change = Math.abs(priceKVnd / prevCloseKVnd - 1);
  return change <= bandPct;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calendarDaysBetween(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((e - s) / 86_400_000));
}
