import type { EvidenceChipDto } from "@/lib/dashboard/decision-cockpit-dto";
import type { MarketContextUiDto, SymbolContextUiDto } from "@/lib/market/market-context-ui-dto";
import {
  formatForeignFlowNetLabel,
  formatForeignFlowVnd,
} from "@/lib/market/format-foreign-flow-vnd";

const FOREIGN_ROLLUP_HINT =
  "5D/10D rollups appear after 5–10 forward sessions.";

function formatCoverageDisplay(ok: number, total: number, pct: number | null): string {
  const pctLabel =
    pct != null && Number.isFinite(pct) ? ` (${Math.round(pct)}%)` : "";
  return `${ok}/${total} OK${pctLabel}`;
}

function formatVolRatioMa20Context(ratio: number): string {
  return `Vol ${ratio.toFixed(1)}× MA20 (context)`;
}

/** Dashboard evidence chips — omits 5D/10D while null. */
export function buildMarketContextCockpitChips(
  context: MarketContextUiDto | null | undefined
): EvidenceChipDto[] {
  if (!context?.available || !context.market) return [];

  const chips: EvidenceChipDto[] = [];
  const { market } = context;

  const foreign1d = formatForeignFlowNetLabel(market.foreignNetValue1d);
  if (foreign1d != null) {
    const hasRollups =
      market.foreignNetValue5d != null || market.foreignNetValue10d != null;
    chips.push({
      id: "market_foreign_1d",
      label: "Foreign 1D",
      display: foreign1d,
      provenance: "real",
      hint: hasRollups ? undefined : FOREIGN_ROLLUP_HINT,
    });
  }

  if (market.foreignSymbolsTotal > 0) {
    chips.push({
      id: "market_foreign_coverage",
      label: "Foreign cov.",
      display: formatCoverageDisplay(
        market.foreignSymbolsOk,
        market.foreignSymbolsTotal,
        market.foreignCoveragePct
      ),
      provenance: "derived",
    });
  }

  const foreign5d = formatForeignFlowNetLabel(market.foreignNetValue5d);
  if (foreign5d != null) {
    chips.push({
      id: "market_foreign_5d",
      label: "Foreign 5D",
      display: foreign5d,
      provenance: "real",
    });
  }

  const foreign10d = formatForeignFlowNetLabel(market.foreignNetValue10d);
  if (foreign10d != null) {
    chips.push({
      id: "market_foreign_10d",
      label: "Foreign 10D",
      display: foreign10d,
      provenance: "real",
    });
  }

  return chips;
}

/** Neutral per-candidate context lines for Setups evidence (not Gate 2 reasons). */
export function buildSymbolContextEvidenceLines(
  symbolContext: SymbolContextUiDto | null | undefined
): string[] {
  if (!symbolContext) return [];

  const lines: string[] = [];
  const { foreignDataQuality } = symbolContext;

  if (foreignDataQuality === "ALL_ZERO") {
    lines.push("Foreign: all zero");
    return lines;
  }

  if (foreignDataQuality === "PARTIAL") {
    lines.push("Foreign: partial data");
  }

  if (foreignDataQuality === "OK") {
    const foreign1d = formatForeignFlowVnd(symbolContext.foreignNetValue1d, { compact: true });
    if (foreign1d != null) {
      lines.push(`Foreign 1D: ${foreign1d} net`);
    }

    const foreign5d = formatForeignFlowVnd(symbolContext.foreignNetValue5d, { compact: true });
    if (foreign5d != null) {
      lines.push(`Foreign 5D: ${foreign5d} net`);
    }

    const foreign10d = formatForeignFlowVnd(symbolContext.foreignNetValue10d, { compact: true });
    if (foreign10d != null) {
      lines.push(`Foreign 10D: ${foreign10d} net`);
    }
  }

  if (
    symbolContext.volRatioMa20 != null &&
    Number.isFinite(symbolContext.volRatioMa20)
  ) {
    lines.push(formatVolRatioMa20Context(symbolContext.volRatioMa20));
  }

  return lines;
}
