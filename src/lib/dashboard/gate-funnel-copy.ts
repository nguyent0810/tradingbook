import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { DailyTradingDecisionLevel } from "@/lib/scanner/trading-decision";

/** Scan row counts used for Gate 2 qualified vs Gate 1 surfaced breakdown. */
export type GateFunnelScanCounts = {
  candidateCountA: number;
  candidateCountB: number;
  candidateCountSurfaced: number;
};

/**
 * Gate 2 qualified (pre–Gate 1) vs surfaced (post–Gate 1) by tier.
 * Surfaced tier split follows surfacing rules in `filterCandidatesByGate1Level`.
 */
export type GateFunnelSnapshot = {
  gate1Level: Gate1Level;
  qualifiedCountA: number;
  qualifiedCountB: number;
  qualifiedTotal: number;
  surfacedCountA: number;
  surfacedCountB: number;
  surfacedTotal: number;
  suppressedCountA: number;
  suppressedCountB: number;
  suppressedTotal: number;
};

export function computeGateFunnelSnapshot(
  scan: GateFunnelScanCounts,
  gate1Level: Gate1Level
): GateFunnelSnapshot {
  const qualifiedCountA = scan.candidateCountA;
  const qualifiedCountB = scan.candidateCountB;
  const qualifiedTotal = qualifiedCountA + qualifiedCountB;

  let surfacedCountA = 0;
  let surfacedCountB = 0;

  if (gate1Level === "FAIL") {
    surfacedCountA = 0;
    surfacedCountB = 0;
  } else if (gate1Level === "WARNING") {
    surfacedCountA = Math.min(qualifiedCountA, scan.candidateCountSurfaced);
    surfacedCountB = 0;
  } else {
    surfacedCountA = Math.min(qualifiedCountA, scan.candidateCountSurfaced);
    const remainder = Math.max(0, scan.candidateCountSurfaced - surfacedCountA);
    surfacedCountB = Math.min(qualifiedCountB, remainder);
  }

  const surfacedTotal = surfacedCountA + surfacedCountB;
  const suppressedCountA = Math.max(0, qualifiedCountA - surfacedCountA);
  const suppressedCountB = Math.max(0, qualifiedCountB - surfacedCountB);

  return {
    gate1Level,
    qualifiedCountA,
    qualifiedCountB,
    qualifiedTotal,
    surfacedCountA,
    surfacedCountB,
    surfacedTotal,
    suppressedCountA,
    suppressedCountB,
    suppressedTotal: suppressedCountA + suppressedCountB,
  };
}

export function formatGateFunnelSummaryLine(funnel: GateFunnelSnapshot): string {
  const parts = [
    `Gate 2 qualified (pre-regime): A ${funnel.qualifiedCountA} · B ${funnel.qualifiedCountB}`,
    `Surfaced after Gate 1: ${funnel.surfacedTotal}`,
  ];
  if (funnel.suppressedTotal > 0) {
    parts.push(
      `Suppressed by Gate 1: ${funnel.suppressedTotal}` +
        (funnel.suppressedCountB > 0
          ? ` (incl. ${funnel.suppressedCountB} Tier B)`
          : funnel.suppressedCountA > 0
            ? ` (incl. ${funnel.suppressedCountA} Tier A)`
            : "")
    );
  }
  return parts.join(" · ");
}

export type VerdictUxCopy = {
  headline: string;
  subtitle: string;
  persistedLevelNote: string;
};

/** UX labels for persisted stance vs dashboard action mode (Batch F). */
export function buildVerdictUxCopy(params: {
  uxLevel: "NO_TRADE" | "PROBE" | "TRADE";
  persistedLevel: DailyTradingDecisionLevel;
  gate1: Gate1Level;
  funnel: GateFunnelSnapshot;
}): VerdictUxCopy {
  const { uxLevel, persistedLevel, gate1, funnel } = params;

  const persistedLevelNote =
    persistedLevel === "NORMAL"
      ? "Persisted stance: NORMAL (normal book-risk mode)"
      : persistedLevel === "PROBE"
        ? "Persisted stance: PROBE (reduced book-risk mode)"
        : "Persisted stance: NO_TRADE (0% book cap)";

  if (uxLevel === "TRADE") {
    return {
      headline: "TRADE MODE",
      subtitle:
        "Normal risk mode — Gate 2 setups passed and market regime allows sizing. This is not an automatic instruction to enter every name.",
      persistedLevelNote,
    };
  }

  if (uxLevel === "PROBE") {
    const bHidden =
      funnel.suppressedCountB > 0
        ? ` Tier B (${funnel.suppressedCountB}) qualified Gate 2 but is hidden while Gate 1 is ${gate1}.`
        : "";
    return {
      headline: "WATCH",
      subtitle:
        `Reduced book-risk mode — only Tier A setups surface when Gate 1 is cautious.${bHidden} Not a full-risk day.`,
      persistedLevelNote,
    };
  }

  const suppressedNote =
    funnel.suppressedTotal > 0
      ? ` ${funnel.suppressedTotal} Gate 2-qualified setup(s) were suppressed by Gate 1 (${gate1}).`
      : "";
  return {
    headline: "NO TRADE",
    subtitle: `Preserve capital — no new swing entries under current stance.${suppressedNote}`,
    persistedLevelNote,
  };
}
