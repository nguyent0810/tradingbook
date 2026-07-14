/** Persisted in SetupWatchItem.healthFlags JSON (string array). */
export type SetupHealthFlag =
  | "AGING_SETUP"
  | "EXTENDED"
  | "TOO_EXTENDED"
  | "CHASE"
  | "VOLUME_FADE"
  | "FAILED_TO_PULLBACK"
  | "REVERSAL_RISK"
  | "DEAD_SETUP";

/**
 * NO_DATA is dashboard/computation-only (not a Prisma `SetupHealthLevel` enum
 * value — that DB enum still has only HEALTHY/WARNING/AT_RISK/DEAD). It means
 * "we could not evaluate this bar" and must never be treated as HEALTHY/100 —
 * see `evaluateWatchHealth`'s `!evalBar` branch. When persisting to the DB
 * column (`persistWatchHealth`), NO_DATA is mapped to AT_RISK as the closest
 * safe existing value; a proper NO_DATA DB enum member is a follow-up migration.
 */
export type SetupHealthLevelValue = "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD" | "NO_DATA";

export type OhlcvBar = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type EvaluateWatchHealthInput = {
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  firstSeenBarDate: Date;
  evalBarDate: Date;
  barsAscThroughEval: OhlcvBar[];
};

export type WatchHealthMeta = {
  sessionsAfterFirstSeen: number;
  sessionsSinceBreakout: number | null;
  extendedPct: number | null;
  distanceToZonePct: number;
  median20Volume: number | null;
  /**
   * Provenance for the extension thresholds used this evaluation — "atr" when
   * volatility-normalized (14-bar ATR%) thresholds were used, "flat_pct_fallback"
   * when there weren't enough bars for a stable ATR and the fixed EXTENDED_PCT/
   * TOO_EXTENDED_PCT/CHASE_PCT constants were used instead. Never silently
   * presented as a real volatility read when it's the fallback.
   */
  extensionThresholdSource: "atr" | "flat_pct_fallback";
};

export type WatchHealthResult = {
  flags: SetupHealthFlag[];
  score: number;
  level: SetupHealthLevelValue;
  meta: WatchHealthMeta;
};
