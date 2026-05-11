/**
 * Compact daily operating summary for OPEN portfolio — derived counts only.
 */

import { formatVND } from "@/lib/formatters";

export type SessionBriefingInput = {
  activeOpenCount: number;
  urgentCount: number;
  underPressureCount: number;
  staleMarketOpenCount: number;
  /** OPEN trades that logged a checkpoint today (local calendar window). */
  reviewsLoggedTodayCount: number;
  plannedCapitalAtRiskTotal: number | null;
  partialRiskFigures: boolean;
  /** Symbol with largest planned capital at risk among OPEN rows with a figure. */
  largestRiskPosition: { symbol: string; amount: number } | null;
};

export type SessionBriefingModel = {
  lines: string[];
  partialRiskFigures: boolean;
};

export function buildSessionBriefing(
  input: SessionBriefingInput
): SessionBriefingModel | null {
  if (input.activeOpenCount <= 0) return null;

  const lines: string[] = [];

  lines.push(
    input.activeOpenCount === 1
      ? "1 active open position."
      : `${input.activeOpenCount} active open positions.`
  );

  if (input.urgentCount > 0) {
    lines.push(
      input.urgentCount === 1
        ? "1 urgent position needs review first."
        : `${input.urgentCount} urgent positions need review first.`
    );
  }

  if (input.underPressureCount > 0) {
    lines.push(
      input.underPressureCount === 1
        ? "1 position under pressure."
        : `${input.underPressureCount} positions under pressure.`
    );
  }

  if (input.staleMarketOpenCount > 0) {
    lines.push(
      input.staleMarketOpenCount === 1
        ? "Market data stale for 1 open position."
        : `Market data stale for ${input.staleMarketOpenCount} open positions.`
    );
  }

  if (input.reviewsLoggedTodayCount > 0) {
    lines.push(
      input.reviewsLoggedTodayCount === 1
        ? "1 position reviewed today."
        : `${input.reviewsLoggedTodayCount} positions reviewed today.`
    );
  }

  if (input.plannedCapitalAtRiskTotal != null) {
    lines.push(
      `Planned capital at risk (sum): ${formatVND(input.plannedCapitalAtRiskTotal, false)}.`
    );
  }

  if (
    input.largestRiskPosition != null &&
    input.activeOpenCount >= 2 &&
    input.plannedCapitalAtRiskTotal != null &&
    input.plannedCapitalAtRiskTotal > 0
  ) {
    const { symbol, amount } = input.largestRiskPosition;
    const pct = (amount / input.plannedCapitalAtRiskTotal) * 100;
    if (pct >= 35 && Number.isFinite(pct)) {
      lines.push(
        `Largest sleeve: ${symbol} (~${pct.toFixed(0)}% of planned risk sum).`
      );
    }
  }

  return {
    lines,
    partialRiskFigures: input.partialRiskFigures,
  };
}
