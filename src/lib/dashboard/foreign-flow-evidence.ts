/**
 * Absolute emergency threshold (VND) — always triggers "danger" regardless of
 * recent history. Kept alongside the rolling percentile below specifically so
 * a prolonged net-selling period can't desensitize the relative measure: if
 * every recent session has been a heavy outflow, the rolling 10th percentile
 * itself drifts very negative, making an equally bad new day look "normal"
 * relative to that window. This fixed floor still catches it.
 */
export const FOREIGN_FLOW_DANGER_VND = -200_000_000_000;

/** Trailing window (sessions) used for the rolling relative threshold. */
export const FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS = 60;
/** Percentile (ascending, of the trailing window) used as the relative danger cutoff. */
export const FOREIGN_FLOW_DANGER_PERCENTILE = 0.1;
/** Minimum history required before trusting a rolling percentile at all. */
export const FOREIGN_FLOW_MIN_HISTORY_SESSIONS = 20;

/**
 * Rolling relative danger threshold — the Nth percentile (default 10th) of
 * the trailing window of daily market foreign net values. Returns null when
 * there isn't enough history yet, so callers fall back to only the absolute
 * floor rather than trusting a percentile computed from too few sessions.
 */
export function computeRollingForeignFlowDangerVnd(
  recentNetValuesAsc: readonly number[]
): number | null {
  if (recentNetValuesAsc.length < FOREIGN_FLOW_MIN_HISTORY_SESSIONS) return null;
  const window = recentNetValuesAsc.slice(-FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS);
  const sorted = [...window].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * FOREIGN_FLOW_DANGER_PERCENTILE)
  );
  return sorted[idx] ?? null;
}

/**
 * Evidence-only classification — feeds an evidence chip's color, nothing else.
 * Verified (dashboard audit): this state is NEVER read by computeDailyTradingDecision,
 * resolveDecision, canShowGo, or applyStanceOverrides — it cannot block or
 * downgrade a trade. Gating Gate 1 on foreign flow is a documented, separate
 * open recommendation (docs/audits/trading-algorithm-audit.md F06) that needs
 * its own validation pass before being wired into the trade gate.
 */
export function foreignFlowEvidenceState(
  netVnd: number | null | undefined,
  rollingDangerThresholdVnd?: number | null
): "ok" | "warn" | "danger" {
  if (netVnd == null || !Number.isFinite(netVnd)) return "ok";
  if (netVnd <= FOREIGN_FLOW_DANGER_VND) return "danger";
  if (rollingDangerThresholdVnd != null && netVnd <= rollingDangerThresholdVnd) return "danger";
  if (netVnd < 0) return "warn";
  return "ok";
}
