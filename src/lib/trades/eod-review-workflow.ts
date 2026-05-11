/**
 * Explainable EOD review guidance — daily bars only, no forecasts or trade signals.
 */

/** Mirrors `StopPriceBand` in open-position-intelligence (duplicated to avoid import cycles). */
type WorkflowStopBand = "breached" | "tight" | "comfortable" | "unknown";

/** Meaningful move vs prior close (~relative noise gate). */
const SESSION_DELTA_EPS_RATIO = 0.00025;

export type OpenPortfolioReviewStrip = {
  activeOpenCount: number;
  underPressureCount: number;
  /** OPEN trades without a health checkpoint logged today (calendar day in trades queries). */
  reviewsPendingTodayCount: number;
  staleMarketOpenCount: number;
  stopViolationsCount: number;
  /** Sum of planned capital at risk where computable; null when none computable. */
  plannedCapitalAtRiskTotal: number | null;
  positionsPartialRiskFigures: boolean;
};

export function buildReviewFocusHints(params: {
  direction: "LONG" | "SHORT";
  stopBand: WorkflowStopBand;
  /** Same keys as `StructureHint` from setup geometry — passed as strings to avoid import cycles. */
  structureHints: readonly string[];
  staleVsBenchmark: boolean | "unknown" | null;
  healthLogStress: boolean;
  hasSetupLevels: boolean;
}): string[] {
  const {
    direction,
    stopBand,
    structureHints,
    staleVsBenchmark,
    healthLogStress,
    hasSetupLevels,
  } = params;

  const hints: string[] = [];

  if (staleVsBenchmark === true) {
    hints.push("Latest market data is stale — verify freshness before relying on levels.");
  }

  if (stopBand === "breached") {
    hints.push(
      "Daily close is through the planned stop — reconcile your invalidation rule on paper."
    );
  } else if (stopBand === "tight") {
    hints.push(
      direction === "LONG"
        ? "Price is within easy reach of the stop — reassess where invalidation really sits."
        : "Price is within easy reach of the stop — reassess where invalidation really sits."
    );
  }

  if (direction === "LONG" && hasSetupLevels) {
    if (structureHints.includes("failed_breakout_hold")) {
      hints.push("Review whether price is still holding the breakout idea versus the anchor.");
    }
    if (structureHints.includes("extended_move")) {
      hints.push("Extended above the breakout zone — adding size aggressively rarely ages well.");
    }
    if (structureHints.includes("below_pullback_zone")) {
      hints.push("Structure weakening after pullback — confirm trend versus trade premise.");
    }
  }

  if (direction === "SHORT" && stopBand !== "breached" && stopBand !== "unknown") {
    if (structureHints.length === 0 && hints.length < 4 && stopBand === "tight") {
      hints.push("Short sleeve tight vs planned stop — restate what invalidates the thesis.");
    }
  }

  if (healthLogStress && hints.length < 5) {
    hints.push("Last logged health flagged stress — align today's notes with live geometry.");
  }

  const seen = new Set<string>();
  return hints.filter((h) => {
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  }).slice(0, 4);
}

export function describeSessionCloseDelta(params: {
  direction: "LONG" | "SHORT";
  latestClose: number | null;
  priorClose: number | null;
}): string | null {
  const { direction, latestClose, priorClose } = params;
  if (
    latestClose == null ||
    priorClose == null ||
    !Number.isFinite(latestClose) ||
    !Number.isFinite(priorClose) ||
    priorClose <= 0
  ) {
    return null;
  }

  const rawDelta = latestClose - priorClose;
  const rel = Math.abs(rawDelta / priorClose);
  if (rel < SESSION_DELTA_EPS_RATIO) {
    return "Versus prior session close: roughly unchanged.";
  }

  const up = rawDelta > 0;
  if (direction === "LONG") {
    if (up) return "Versus prior session close: higher — drift favors this long on paper.";
    return "Versus prior session close: lower — softer tape for this long.";
  }
  if (up) return "Versus prior session close: higher — headwind for this short vs prior bar.";
  return "Versus prior session close: lower — drift favors this short on paper.";
}

export function describeDeltaSinceReview(params: {
  direction: "LONG" | "SHORT";
  latestClose: number | null;
  baselineClose: number | null;
  stopBand: WorkflowStopBand;
}): string | null {
  const { direction, latestClose, baselineClose, stopBand } = params;
  if (
    latestClose == null ||
    baselineClose == null ||
    !Number.isFinite(latestClose) ||
    !Number.isFinite(baselineClose) ||
    baselineClose <= 0
  ) {
    return null;
  }

  const rawDelta = latestClose - baselineClose;
  const rel = Math.abs(rawDelta / baselineClose);
  const unchanged = rel < SESSION_DELTA_EPS_RATIO;

  if (unchanged) {
    return stopBand === "tight"
      ? "Since last logged review: close little changed — still bundled near the stop."
      : "Since last logged review: close little changed vs the bar through that review.";
  }

  const up = rawDelta > 0;

  if (direction === "LONG") {
    if (stopBand === "breached") {
      return up
        ? "Since last logged review: price reclaimed ground but daily close still violates the stop context."
        : "Since last logged review: softer close vs that checkpoint.";
    }
    if (stopBand === "tight" && !up) {
      return "Closed weaker vs last review while near stop — sanity-check the exit script.";
    }
    if (up) {
      if (latestClose >= baselineClose * 1.001) {
        return "Since last logged review: recovered ground vs the bar through that review.";
      }
      return "Since last logged review: modestly higher vs that checkpoint.";
    }
    return "Since last logged review: lost momentum vs that checkpoint.";
  }

  if (stopBand === "breached") {
    return "Since last logged review: tape moved — reconcile vs planned stop on daily data.";
  }
  if (stopBand === "tight" && up) {
    return "Since last logged review: squeeze toward stop — revisit invalidation.";
  }
  if (!up) {
    return "Since last logged review: lower vs that checkpoint — favors this short on paper.";
  }
  return "Since last logged review: higher vs that checkpoint — pressure on this short.";
}

export function aggregateOpenPortfolioReviewStrip(
  rows: readonly {
    reviewedToday: boolean;
    stopViolated: boolean;
    underPressure: boolean;
    staleMarket: boolean;
    plannedCapitalAtRisk: number | null;
  }[]
): OpenPortfolioReviewStrip {
  let plannedCapitalAtRiskTotal = 0;
  let anyRisk = false;
  let partialRiskFigures = false;

  for (const r of rows) {
    if (r.plannedCapitalAtRisk != null && Number.isFinite(r.plannedCapitalAtRisk)) {
      anyRisk = true;
      plannedCapitalAtRiskTotal += r.plannedCapitalAtRisk;
    } else {
      partialRiskFigures = true;
    }
  }

  return {
    activeOpenCount: rows.length,
    underPressureCount: rows.filter((r) => r.underPressure).length,
    reviewsPendingTodayCount: rows.filter((r) => !r.reviewedToday).length,
    staleMarketOpenCount: rows.filter((r) => r.staleMarket).length,
    stopViolationsCount: rows.filter((r) => r.stopViolated).length,
    plannedCapitalAtRiskTotal: anyRisk ? plannedCapitalAtRiskTotal : null,
    positionsPartialRiskFigures: partialRiskFigures && rows.length > 0,
  };
}
