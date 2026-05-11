/**
 * User-facing labels for scanner/trading enums. Internal enum strings stay unchanged.
 */

import type { ClosestExecutionStatus } from "@/lib/scanner/closest-execution-metrics";

const SCAN_SETUP_TYPE_LABELS: Record<string, string> = {
  BREAKOUT_PULLBACK: "Breakout pullback",
};

const MOMENTUM_LABELS: Record<string, string> = {
  FRESH_BREAKOUT: "Fresh breakout",
  MOMENTUM_IGNITION: "Momentum ignition",
  RECLAIM_THRUST: "Reclaim thrust",
  EXTENDED_NO_PULLBACK: "Extended no pullback",
  FAILED_BREAKOUT_RISK: "Failed breakout risk",
};

const MOMENTUM_RISK_LABELS: Record<string, string> = {
  STOP_FAR: "Stop too far",
  EXTENDED: "Extended",
  LOW_LIQUIDITY: "Low liquidity",
  BELOW_MA50: "Below MA50",
  NO_PULLBACK: "No pullback",
  STALE_DATA: "Stale data",
};

const MOMENTUM_GROUP_LABELS: Record<string, string> = {
  ACTIONABLE_WATCH: "Actionable watch",
  EXTENDED_WATCH_ONLY: "Extended watch only",
  AVOID_RISK: "Avoid risk",
  COVERAGE_TRADABILITY_BLOCKED: "Tradability blocked",
};

const SETUP_LIFECYCLE_LABELS: Record<string, string> = {
  NEW: "New",
  WATCHING: "Watching pullback",
  READY: "At entry zone",
  TRIGGERED: "Triggered",
  EXPIRED: "Expired",
  INVALID: "Invalid",
};

function titleCaseWords(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** Playbook / persisted scan setup type keys (e.g. BREAKOUT_PULLBACK). */
export function displayScanSetupTypeKey(raw: string): string {
  return SCAN_SETUP_TYPE_LABELS[raw] ?? titleCaseWords(raw);
}

/** Gate 2 proximity execution status (READY / WAIT / INVALID). */
export function displayClosestExecutionStatus(status: ClosestExecutionStatus): string {
  switch (status) {
    case "READY":
      return "At entry zone";
    case "WAIT":
      return "Waiting for pullback";
    case "INVALID":
      return "Structure invalid";
    default:
      return titleCaseWords(String(status));
  }
}

/** Surfaced candidate lifecycle strip (READY | WATCHING from health view). */
export function displayCandidateLifecycleSortLabel(label: "READY" | "WATCHING"): string {
  return label === "READY" ? "At entry zone" : "Waiting for pullback";
}

/** Momentum audit row labels (e.g. FRESH_BREAKOUT). */
export function displayMomentumLabel(raw: string): string {
  return MOMENTUM_LABELS[raw] ?? titleCaseWords(raw);
}

/** Momentum audit risk annotations (e.g. STOP_FAR). */
export function displayMomentumRiskAnnotation(raw: string): string {
  return MOMENTUM_RISK_LABELS[raw] ?? titleCaseWords(raw);
}

/** Momentum audit grouping (e.g. ACTIONABLE_WATCH). */
export function displayMomentumAuditGroup(raw: string): string {
  return MOMENTUM_GROUP_LABELS[raw] ?? titleCaseWords(raw);
}

/** Watchlist / DB lifecycle status. */
export function displaySetupLifecycleStatus(raw: string): string {
  return SETUP_LIFECYCLE_LABELS[raw] ?? titleCaseWords(raw);
}

export function displayScanQualityTier(quality: string): string {
  if (quality === "A") return "Tier A";
  if (quality === "B") return "Tier B";
  return quality;
}

/** Scan run row status (DailyScanRun.status). */
export function displayDailyScanRunStatus(raw: string): string {
  switch (raw) {
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    default:
      return titleCaseWords(raw);
  }
}

/** Gate 1 market / scan regime level (PASS / WARNING / FAIL). */
export function displayGate1ScanLevel(raw: string): string {
  switch (raw) {
    case "PASS":
      return "Favorable";
    case "WARNING":
      return "Caution";
    case "FAIL":
      return "Hostile";
    default:
      return titleCaseWords(raw);
  }
}

const UNIVERSE_SOURCE_LABELS: Record<string, string> = {
  CORE: "Primary universe",
  TACTICAL: "Tactical watch",
  BOTH: "Primary + tactical",
};

export function displayUniverseSource(raw: string): string {
  return UNIVERSE_SOURCE_LABELS[raw] ?? titleCaseWords(raw);
}

export function displayTradeStatus(raw: string): string {
  switch (raw) {
    case "OPEN":
      return "Active";
    case "CLOSED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "PLANNED":
      return "Planned";
    default:
      return titleCaseWords(raw);
  }
}

export function displayTradeDirection(raw: string): string {
  switch (raw) {
    case "LONG":
      return "Long bias";
    case "SHORT":
      return "Short bias";
    default:
      return titleCaseWords(raw);
  }
}

const SETUP_HEALTH_LEVEL_LABELS: Record<string, string> = {
  HEALTHY: "Healthy",
  WARNING: "Watch",
  AT_RISK: "At risk",
  DEAD: "Broken",
};

/** Setup watch health level (scanner watch items). */
export function displaySetupHealthLevel(raw: string): string {
  return SETUP_HEALTH_LEVEL_LABELS[raw] ?? titleCaseWords(raw);
}

/** Tradability breakdown keys from persisted scan JSON (internal ids → readable line). */
export function displayTradabilityBreakdownKey(raw: string): string {
  const spaced = raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return raw;
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
