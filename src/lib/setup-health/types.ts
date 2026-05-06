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

export type SetupHealthLevelValue = "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD";

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
};

export type WatchHealthResult = {
  flags: SetupHealthFlag[];
  score: number;
  level: SetupHealthLevelValue;
  meta: WatchHealthMeta;
};
