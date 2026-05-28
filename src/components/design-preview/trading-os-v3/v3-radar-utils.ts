import type { RadarItem } from "./types";

/** Map readiness (0–100) to horizontal position; risk (0–100) to vertical (low risk = top). */
export function radarPosition(item: RadarItem): { left: string; top: string } {
  const x = Math.max(10, Math.min(90, item.readiness));
  const y = Math.max(10, Math.min(90, item.risk));
  return { left: `${x}%`, top: `${y}%` };
}

/** Dot diameter in px: larger = higher priority (signal + tier). */
export function radarDotSize(item: RadarItem): number {
  if (item.status === "rejected") return 40;
  if (item.status === "near-miss") return 48;
  if (item.tier === "A+") return 64;
  if (item.tier === "A") return 56;
  return 50;
}

export function radarActionLabel(item: RadarItem): string {
  if (item.status === "rejected") return "AVOID";
  if (item.status === "near-miss") return "WATCH";
  if (item.tier === "A+") return "EXECUTE";
  return "ARM";
}

export function radarStatusClass(status: RadarItem["status"]): string {
  if (status === "qualified") return "tosv3-radar__cell--qualified";
  if (status === "near-miss") return "tosv3-radar__cell--near";
  return "tosv3-radar__cell--rejected";
}

export function decisionModeClass(mode: string): string {
  const key = mode.replace(/\s+/g, "-").toLowerCase();
  return `tosv3-hero--${key}`;
}
