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

export type RsDiagnosticUi = {
  summary: string;
  lines: string[];
  disclaimer: string;
  /** RS20 spread (pp) for rank-term preview — diagnostic only. */
  rs20SpreadPct: number | null;
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

  if (d.stockLeadingMa50 === true) {
    lines.push("Stock above MA50 while VNINDEX is not — relative leadership vs benchmark.");
  } else if (d.dualUptrendMa50 === true) {
    lines.push("Both stock and VNINDEX above MA50 — broad risk-on backdrop.");
  }

  return {
    summary: formatRelativeStrengthSummary(d),
    lines,
    disclaimer: RS_DIAGNOSTIC_DISCLAIMER,
    rs20SpreadPct: r20?.rsSpreadPct ?? null,
  };
}
