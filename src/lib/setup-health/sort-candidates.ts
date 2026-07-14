import type { SetupHealthLevelValue } from "./types";
import { distanceToZonePct } from "./evaluate-watch-health";

export type CandidateWithHealth = {
  symbolKey: string;
  symbolId: string;
  close: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  lifecycleLabel: "NEW" | "WATCHING" | "READY";
  healthLevel: SetupHealthLevelValue | null;
  healthScore: number | null;
};

const LEVEL_RANK: Record<SetupHealthLevelValue, number> = {
  HEALTHY: 0,
  WARNING: 1,
  AT_RISK: 2,
  DEAD: 3,
  /** Worse than DEAD — an unevaluable setup must never sort above a known-bad one. */
  NO_DATA: 4,
};

const LIFECYCLE_RANK = { READY: 0, WATCHING: 1, NEW: 2 } as const;

export function sortCandidatesWithHealth(rows: CandidateWithHealth[]): CandidateWithHealth[] {
  return [...rows].sort((a, b) => {
    const lr = LIFECYCLE_RANK[a.lifecycleLabel] - LIFECYCLE_RANK[b.lifecycleLabel];
    if (lr !== 0) return lr;

    const da = distanceToZonePct(a.close, a.pullbackZoneLow, a.pullbackZoneHigh);
    const db = distanceToZonePct(b.close, b.pullbackZoneLow, b.pullbackZoneHigh);
    if (da !== db) return da - db;

    const ha = a.healthLevel ? LEVEL_RANK[a.healthLevel] : 0;
    const hb = b.healthLevel ? LEVEL_RANK[b.healthLevel] : 0;
    if (ha !== hb) return ha - hb;

    const sa = a.healthScore ?? 0;
    const sb = b.healthScore ?? 0;
    if (sa !== sb) return sb - sa;

    return a.symbolKey.localeCompare(b.symbolKey);
  });
}
