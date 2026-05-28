import type { V3RadarMapDot, V3RadarMapStatus } from "@/lib/dashboard/dashboard-v3-view-model";

export function radarPosition(item: Pick<V3RadarMapDot, "readiness" | "risk">): {
  left: string;
  top: string;
} {
  const x = Math.max(10, Math.min(90, item.readiness));
  const y = Math.max(10, Math.min(90, item.risk));
  return { left: `${x}%`, top: `${y}%` };
}

export function radarDotSize(item: Pick<V3RadarMapDot, "status" | "tier">): number {
  if (item.status === "near-miss") return 48;
  if (item.tier === "A+" || item.tier.startsWith("A")) return 60;
  if (item.tier === "B") return 52;
  return 50;
}

export function radarActionLabel(item: Pick<V3RadarMapDot, "status" | "tier">): string {
  if (item.status === "near-miss") return "WATCH";
  if (item.tier === "A+" || item.tier === "A") return item.tier === "A+" ? "EXECUTE" : "ARM";
  return "ARM";
}

export function radarStatusClass(status: V3RadarMapStatus): string {
  if (status === "qualified") return "tosv3-radar__cell--qualified";
  return "tosv3-radar__cell--near";
}

export function decisionModeClass(mode: string): string {
  const key = mode.replace(/\s+/g, "-").toLowerCase();
  return `tosv3-hero--${key}`;
}

/** Fixed positions for blocked samples — not data-driven coordinates. */
export const AVOID_PLACEHOLDER_POSITIONS = [
  { left: "18%", top: "78%" },
  { left: "28%", top: "85%" },
  { left: "12%", top: "68%" },
] as const;
