import type { RelativeStrengthDiagnostic } from "./relative-strength";
import {
  formatRelativeStrengthSummary,
  RS_LOOKBACK_20,
  RS_LOOKBACK_50,
} from "./relative-strength";

/**
 * Shown on every RS panel. RS is a context signal for prioritization — it does not
 * drive setup approval or ranking on its own (Batch D1). User-facing copy is kept
 * free of internal scoring jargon.
 */
export const RS_DIAGNOSTIC_DISCLAIMER =
  "Relative strength is a context signal — it helps prioritize, but doesn't approve or rank a setup on its own.";

export type RsTrendLabel = "leading" | "dual-uptrend" | "lagging" | "neutral";

export type RsDiagnosticUi = {
  summary: string;
  lines: string[];
  disclaimer: string;
  /** RS20 spread (pp) for rank-term preview — diagnostic only. */
  rs20SpreadPct: number | null;
  /** RS50 spread (pp) — diagnostic only. */
  rs50SpreadPct: number | null;
  stockAboveMa50: boolean | null;
  indexAboveMa50: boolean | null;
  /**
   * Single-word trend read for a status chip: "leading" (stock > MA50, index
   * isn't), "dual-uptrend" (both above MA50), "lagging" (stock below MA50
   * while index isn't), "neutral" (anything else / insufficient data).
   */
  trendLabel: RsTrendLabel;
};

export function interpretRs20Spread(rsSpreadPct: number): string {
  if (rsSpreadPct > 0) {
    return "Outperforming VNINDEX over 20 sessions.";
  }
  if (rsSpreadPct < 0) {
    return "Underperforming VNINDEX over 20 sessions.";
  }
  return "In line with VNINDEX over 20 sessions.";
}

export function interpretRs50Spread(rsSpreadPct: number): string {
  if (rsSpreadPct > 0) {
    return "Outperforming VNINDEX over 50 sessions.";
  }
  if (rsSpreadPct < 0) {
    return "Underperforming VNINDEX over 50 sessions.";
  }
  return "In line with VNINDEX over 50 sessions.";
}

function formatSpreadLine(
  label: string,
  spreadPct: number,
  interpret: (n: number) => string
): string {
  const sign = spreadPct >= 0 ? "+" : "";
  return `${label}: ${sign}${spreadPct.toFixed(2)} pp vs VNINDEX — ${interpret(spreadPct)}`;
}

function formatMa50Flag(value: boolean | null, label: string): string | null {
  if (value === null) return null;
  return `${label}: ${value ? "yes" : "no"}`;
}

/**
 * Consistent RS copy for CLI (`rs-gate2-diagnostic`) and UI (Setups / dashboard).
 */
export function formatRelativeStrengthDiagnosticForUi(
  d: RelativeStrengthDiagnostic
): RsDiagnosticUi {
  const lines: string[] = [];
  const r20 = d.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_20);
  const r50 = d.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_50);

  if (r20) {
    lines.push(formatSpreadLine("RS20", r20.rsSpreadPct, interpretRs20Spread));
  }
  if (r50) {
    lines.push(formatSpreadLine("RS50", r50.rsSpreadPct, interpretRs50Spread));
  }

  const stockMa = formatMa50Flag(d.stockAboveMa50, "Stock above MA50");
  const indexMa = formatMa50Flag(d.indexAboveMa50, "VNINDEX above MA50");
  if (stockMa) lines.push(stockMa);
  if (indexMa) lines.push(indexMa);

  let trendLabel: RsTrendLabel = "neutral";
  if (d.stockLeadingMa50 === true) {
    lines.push("Stock above MA50 while VNINDEX is not — relative leadership vs benchmark.");
    trendLabel = "leading";
  } else if (d.dualUptrendMa50 === true) {
    lines.push("Both stock and VNINDEX above MA50 — broad risk-on backdrop.");
    trendLabel = "dual-uptrend";
  } else if (d.stockAboveMa50 === false && d.indexAboveMa50 !== false) {
    trendLabel = "lagging";
  }

  return {
    summary: formatRelativeStrengthSummary(d),
    lines,
    disclaimer: RS_DIAGNOSTIC_DISCLAIMER,
    rs20SpreadPct: r20?.rsSpreadPct ?? null,
    rs50SpreadPct: r50?.rsSpreadPct ?? null,
    stockAboveMa50: d.stockAboveMa50,
    indexAboveMa50: d.indexAboveMa50,
    trendLabel,
  };
}
