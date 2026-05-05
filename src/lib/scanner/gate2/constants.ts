/** Prior N sessions before breakout bar (exclusive of breakout day). */
export const GATE2_RANGE_DAYS = 20;

/**
 * Breakout must occur within this many bars before evaluation (scan j ∈ [t−k, t−1], j ≥ 20).
 */
export const GATE2_BREAKOUT_RECENCY_BARS = 10;

/** Max extension above breakout level at entry close (chase limit). */
export const GATE2_MAX_BREAKOUT_EXTENSION_FRAC = 0.05;

/** Max retracement depth below breakout level (structural low vs level). */
export const GATE2_MAX_PULLBACK_DEPTH_FRAC = 0.04;

/** Minimum (entry − stop) / entry for an actionable swing risk definition. */
export const GATE2_MIN_RISK_TO_STOP_FRAC = 0.003;

/** Pullback zone: δ below range high. */
export const GATE2_DELTA_PULLBACK = 0.02;

/** Volume vs median prior 20 (evaluation bar excluded from median). */
export const GATE2_VOL_RATIO_A = 1.5;
export const GATE2_VOL_RATIO_B = 1.2;

/** rankScore caps (deterministic). */
export const GATE2_RANK_VOL_CAP = 3;
export const GATE2_RANK_EXT_CAP = 50;
export const GATE2_RANK_MA_CAP = 50;
export const GATE2_RANK_DEPTH_CAP = 1;

/** Stop buffer below structural low (deterministic). */
export const GATE2_STOP_BUFFER_FRAC = 0.01;
