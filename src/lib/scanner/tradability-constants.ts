/** Minimum number of daily bars (history depth). */
export const TRADABILITY_MIN_BARS = 120;

/** 20-trading-day average share volume floor. */
export const TRADABILITY_MIN_AVG_VOLUME_20 = 100_000;

/**
 * 20-trading-day average traded value in VND.
 * Uses `tradedValueVnd(close, volume)` — VCI equity close is thousand VND × volume (shares).
 */
export const TRADABILITY_MIN_AVG_VALUE_VND_20 = 2_000_000_000;

/** Latest session close floor (nominal VND per share); compare via `equityPriceToVnd(close)`. */
export const TRADABILITY_MIN_CLOSE_VND = 10_000;

/** Window for rolling averages (trading days). */
export const TRADABILITY_ROLLING_DAYS = 20;

/**
 * Fail if any consecutive pair of bar dates (after sort/dedupe) is separated by more
 * than this many **calendar** days — long suspension / bad series. No weekday-aggregate rule.
 */
export const TRADABILITY_MAX_CALENDAR_GAP_DAYS = 21;

/** Reason codes / messages for aggregation (stable keys). */
export const TRADABILITY_REASON = {
  INSUFFICIENT_HISTORY: "Insufficient history: need >= 120 daily bars",
  VOLUME_20D: "20D average volume below 100,000 shares",
  VALUE_20D: "20D average traded value below 2,000,000,000 VND",
  PRICE: "Latest close below 10,000 VND",
  STALE_DATA: "Latest bar date does not match expected last session",
  GAP_CALENDAR:
    "Gap between consecutive bars exceeds 21 calendar days",
} as const;
