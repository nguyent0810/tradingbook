import type { RelativeStrengthDiagnostic } from "./relative-strength";
import { RS_LOOKBACK_20, RS_LOOKBACK_50 } from "./relative-strength";

/**
 * D2 — capped RS rank term (diagnostic / opt-in only).
 *
 * Formula: rsTerm = clamp(RS20_pp × MULTIPLIER, -CAP, +CAP)
 * - RS20_pp = stock 20-session return minus VNINDEX (percentage points).
 * - Positive RS20 → bonus; negative → penalty; zero / missing → 0.
 *
 * Scale: typical production rankScore for a strong Tier A is ~2,000–3,500
 * (volume term dominates). CAP=250 is ~7–12% of that — RS can nudge order
 * but cannot overwhelm volume/extension/MA/depth terms.
 *
 * RS50 is context-only in UI (Batch D1); not used in v1 rsTerm.
 */
export const GATE2_RS_RANK_TERM_MULTIPLIER = 25;
export const GATE2_RS_RANK_TERM_CAP = 250;

export type Gate2RankWithRsPreview = {
  rankScoreBase: number;
  rsTerm: number;
  rankScoreWithRs: number;
  rs20SpreadPct: number | null;
};

export type Gate2RankOrderingEntry = {
  symbol: string;
  rankScoreBase: number;
  rsTerm: number;
  rankScoreWithRs: number;
  rs20SpreadPct: number | null;
  baseRank: number;
  rsAdjustedRank: number;
};

export type Gate2RankOrderingComparison = {
  entries: Gate2RankOrderingEntry[];
  promoted: Array<{ symbol: string; baseRank: number; rsAdjustedRank: number; delta: number }>;
  demoted: Array<{ symbol: string; baseRank: number; rsAdjustedRank: number; delta: number }>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Production-off unless `GATE2_RS_RANK_TERM_ENABLED` is `true` or `1`. */
export function isGate2RsRankTermEnabled(): boolean {
  const v = process.env.GATE2_RS_RANK_TERM_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Pure RS rank contribution from RS20 spread (percentage points).
 * Does not affect Gate 2 pass/fail or tier.
 */
export function computeRelativeStrengthRankTerm(
  rs20SpreadPct: number | null | undefined
): number {
  if (rs20SpreadPct == null || !Number.isFinite(rs20SpreadPct) || rs20SpreadPct === 0) {
    return 0;
  }
  const raw = rs20SpreadPct * GATE2_RS_RANK_TERM_MULTIPLIER;
  return clamp(raw, -GATE2_RS_RANK_TERM_CAP, GATE2_RS_RANK_TERM_CAP);
}

export function extractRs20SpreadPct(
  rs: RelativeStrengthDiagnostic | null | undefined
): number | null {
  const row = rs?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_20);
  if (row == null || !Number.isFinite(row.rsSpreadPct)) return null;
  return row.rsSpreadPct;
}

export function extractRs50SpreadPct(
  rs: RelativeStrengthDiagnostic | null | undefined
): number | null {
  const row = rs?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_50);
  if (row == null || !Number.isFinite(row.rsSpreadPct)) return null;
  return row.rsSpreadPct;
}

export function buildGate2RankWithRsPreview(
  rankScoreBase: number,
  rs20SpreadPct: number | null | undefined
): Gate2RankWithRsPreview {
  const rsTerm = computeRelativeStrengthRankTerm(rs20SpreadPct);
  return {
    rankScoreBase,
    rsTerm,
    rankScoreWithRs: rankScoreBase + rsTerm,
    rs20SpreadPct: rs20SpreadPct ?? null,
  };
}

/**
 * Effective rank score for ordering when RS term is enabled via env flag.
 * Default path returns `rankScoreBase` unchanged.
 */
export function effectiveGate2RankScore(
  rankScoreBase: number,
  rs20SpreadPct: number | null | undefined,
  options?: { forceIncludeRsTerm?: boolean }
): number {
  const include =
    options?.forceIncludeRsTerm === true || isGate2RsRankTermEnabled();
  if (!include) return rankScoreBase;
  return buildGate2RankWithRsPreview(rankScoreBase, rs20SpreadPct).rankScoreWithRs;
}

export const RS_RANK_PREVIEW_DISCLAIMER =
  "Preview only — RS rank term is not active in production ordering unless GATE2_RS_RANK_TERM_ENABLED is set.";

/** Lines for Setups expanded detail / CLI. */
export function formatRsRankPreviewLines(preview: Gate2RankWithRsPreview): string[] {
  const rsLabel =
    preview.rs20SpreadPct == null
      ? "RS20 unavailable"
      : `RS20 ${preview.rs20SpreadPct >= 0 ? "+" : ""}${preview.rs20SpreadPct.toFixed(2)} pp`;
  return [
    `${RS_RANK_PREVIEW_DISCLAIMER}`,
    `Base rankScore: ${preview.rankScoreBase.toFixed(2)}`,
    `RS rank term: ${preview.rsTerm >= 0 ? "+" : ""}${preview.rsTerm.toFixed(2)} (${rsLabel} × ${GATE2_RS_RANK_TERM_MULTIPLIER}, cap ±${GATE2_RS_RANK_TERM_CAP})`,
    `Hypothetical rankScore with RS: ${preview.rankScoreWithRs.toFixed(2)}`,
  ];
}

function assignDenseRanks(
  entries: Gate2RankOrderingEntry[],
  scoreKey: "rankScoreBase" | "rankScoreWithRs",
  rankKey: "baseRank" | "rsAdjustedRank"
): void {
  const sorted = [...entries].sort((a, b) => {
    const diff = b[scoreKey] - a[scoreKey];
    if (diff !== 0) return diff;
    return a.symbol.localeCompare(b.symbol);
  });
  sorted.forEach((e, i) => {
    const target = entries.find((x) => x.symbol === e.symbol)!;
    target[rankKey] = i + 1;
  });
}

export function compareGate2RankOrdering(
  items: Array<{
    symbol: string;
    rankScoreBase: number;
    rs20SpreadPct: number | null | undefined;
  }>
): Gate2RankOrderingComparison {
  const entries: Gate2RankOrderingEntry[] = items.map((item) => {
    const preview = buildGate2RankWithRsPreview(item.rankScoreBase, item.rs20SpreadPct);
    return {
      symbol: item.symbol,
      rankScoreBase: preview.rankScoreBase,
      rsTerm: preview.rsTerm,
      rankScoreWithRs: preview.rankScoreWithRs,
      rs20SpreadPct: preview.rs20SpreadPct,
      baseRank: 0,
      rsAdjustedRank: 0,
    };
  });

  assignDenseRanks(entries, "rankScoreBase", "baseRank");
  assignDenseRanks(entries, "rankScoreWithRs", "rsAdjustedRank");

  const promoted: Gate2RankOrderingComparison["promoted"] = [];
  const demoted: Gate2RankOrderingComparison["demoted"] = [];

  for (const e of entries) {
    const delta = e.baseRank - e.rsAdjustedRank;
    if (delta > 0) {
      promoted.push({
        symbol: e.symbol,
        baseRank: e.baseRank,
        rsAdjustedRank: e.rsAdjustedRank,
        delta,
      });
    } else if (delta < 0) {
      demoted.push({
        symbol: e.symbol,
        baseRank: e.baseRank,
        rsAdjustedRank: e.rsAdjustedRank,
        delta,
      });
    }
  }

  promoted.sort((a, b) => b.delta - a.delta);
  demoted.sort((a, b) => a.delta - b.delta);

  return { entries, promoted, demoted };
}

export function formatRankOrderingComparisonTable(
  comparison: Gate2RankOrderingComparison
): string {
  const lines: string[] = [];
  lines.push(
    "symbol".padEnd(12) +
      "base".padStart(8) +
      "rsTerm".padStart(8) +
      "withRs".padStart(8) +
      "R#".padStart(5) +
      "R#+RS".padStart(7)
  );
  lines.push("-".repeat(48));
  const sorted = [...comparison.entries].sort((a, b) => a.baseRank - b.baseRank);
  for (const e of sorted) {
    lines.push(
      e.symbol.slice(0, 11).padEnd(12) +
        e.rankScoreBase.toFixed(0).padStart(8) +
        (e.rsTerm >= 0 ? "+" : "") +
        e.rsTerm.toFixed(0).padStart(e.rsTerm >= 0 ? 7 : 8) +
        e.rankScoreWithRs.toFixed(0).padStart(8) +
        String(e.baseRank).padStart(5) +
        String(e.rsAdjustedRank).padStart(7)
    );
  }
  if (comparison.promoted.length > 0) {
    lines.push("");
    lines.push("Promoted (RS-adjusted rank better):");
    for (const p of comparison.promoted.slice(0, 20)) {
      lines.push(
        `  ${p.symbol}: ${p.baseRank} → ${p.rsAdjustedRank} (+${p.delta} positions)`
      );
    }
  }
  if (comparison.demoted.length > 0) {
    lines.push("");
    lines.push("Demoted:");
    for (const d of comparison.demoted.slice(0, 20)) {
      lines.push(
        `  ${d.symbol}: ${d.baseRank} → ${d.rsAdjustedRank} (${d.delta} positions)`
      );
    }
  }
  return lines.join("\n");
}
