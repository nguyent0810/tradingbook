import type { GateFunnelSnapshot } from "@/lib/dashboard/gate-funnel-copy";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  RsNearMissWatchlistEntryDto,
  RsNearMissWatchlistPanelDto,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import { rejectionBucketTraderGuide } from "@/lib/scanner/setups-trader-copy";
import type {
  V3RsStateTone,
  V3RsWatchlistCard,
  V3RsWatchlistMetric,
  V3RsWatchlistPanel,
} from "./dashboard-v3-view-model";

const INTERNAL_PHRASE_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/Relative strength diagnostic only[^.]*\.?/gi, "Relative strength is for context only — it does not change the setup score."],
  [/not used in current Gate 2 pass\/fail[^.]*\.?/gi, ""],
  [/not part of rankScore yet\.?/gi, ""],
  [/Not a Gate 2 SetupCandidate\.?/gi, "Watchlist-only signal — not a qualified setup."],
  [/Not used in current trading decision\.?/gi, ""],
  [/Diagnostic only\.?/gi, "Context only — not a trade signal."],
  [/Gate 2 SetupCandidate/gi, "qualified setup"],
  [/rankScore/gi, "setup score"],
  [/Gate 2/gi, "setup filter"],
  [/Gate 1/gi, "market regime filter"],
];

const FAILED_GATE2_RE = /^Failed Gate 2 because:\s*(.+?)(?:\s*\(([a-z0-9_]+)\))?\.?$/i;
const RS_SUMMARY_RE = /RS20\s*([+-]?\d+(?:\.\d+)?)\s*pp(?:\s*·\s*RS50\s*([+-]?\d+(?:\.\d+)?)\s*pp)?/i;
const TREND_OK_RE = /^Trend OK for long-bias pullback:\s*(.+)$/i;

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+·\s+/g, " · ").trim();
}

function extractCategoryKey(text: string): string | null {
  const paren = text.match(/\(([a-z0-9_]+)\)\s*$/);
  if (paren) return paren[1]!;
  if (/^[a-z0-9_]+$/.test(text.trim())) return text.trim();
  return null;
}

export function formatGateFailureForUser(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(FAILED_GATE2_RE);
  if (match) {
    const body = match[1]!.trim();
    const code = match[2] ?? extractCategoryKey(body);
    if (code === "breakout_recency") {
      return "Not ready — no fresh breakout confirmed.";
    }
    if (code) {
      const label = rejectionBucketTraderGuide(code).meaning;
      const sentence = label.endsWith(".") ? label.slice(0, -1) : label;
      return `Not ready — ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}.`;
    }
    return `Not ready — ${body.replace(/\s*\([^)]+\)\s*$/, "")}.`;
  }

  const category = extractCategoryKey(trimmed);
  if (category?.includes("_")) {
    const guide = rejectionBucketTraderGuide(category);
    return `Not ready — ${guide.meaning}`;
  }

  return formatScannerReasonForUser(trimmed);
}

export function formatRelativeStrengthSummaryForUser(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(RS_SUMMARY_RE);
  if (!match) {
    return formatScannerReasonForUser(trimmed);
  }
  const rs20 = Number.parseFloat(match[1]!);
  const rs50 = match[2] != null ? Number.parseFloat(match[2]) : null;
  const parts: string[] = [];
  if (Number.isFinite(rs20)) {
    parts.push(
      rs20 > 0
        ? `Outperforming the index over 20 sessions (${rs20 >= 0 ? "+" : ""}${rs20.toFixed(1)} pp).`
        : rs20 < 0
          ? `Lagging the index over 20 sessions (${rs20.toFixed(1)} pp).`
          : "In line with the index over 20 sessions."
    );
  }
  if (rs50 != null && Number.isFinite(rs50)) {
    parts.push(
      rs50 > 0
        ? `Longer-term RS also positive (${rs50 >= 0 ? "+" : ""}${rs50.toFixed(1)} pp vs index).`
        : rs50 < 0
          ? `Longer-term RS is negative (${rs50.toFixed(1)} pp vs index).`
          : "Longer-term RS is neutral vs the index."
    );
  }
  return parts.join(" ");
}

export function formatScannerReasonForUser(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.trim();
  if (!text) return "";

  const failed = text.match(FAILED_GATE2_RE);
  if (failed) return formatGateFailureForUser(text);

  if (RS_SUMMARY_RE.test(text) && text.length < 80) {
    return formatRelativeStrengthSummaryForUser(text);
  }

  const trendOk = text.match(TREND_OK_RE);
  if (trendOk) {
    return "Trend is supportive: price is above the 50-day average and short-term momentum is aligned.";
  }

  for (const [pattern, replacement] of INTERNAL_PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\s*\([a-z0-9_]+\)\s*/gi, " ");
  text = cleanWhitespace(text);

  if (/^Not in zone$/i.test(text)) {
    return "Price is not in the pullback entry zone yet.";
  }

  return text;
}

export function formatRadarReason(raw: string): string {
  return formatScannerReasonForUser(raw);
}

export function formatBreadthSummary(
  latestScan: LatestScanWithCandidates | null,
  gateFunnel: GateFunnelSnapshot | null
): string | null {
  if (gateFunnel) {
    const { qualifiedCountA, qualifiedCountB, surfacedTotal, suppressedTotal } = gateFunnel;
    if (qualifiedCountA === 0 && qualifiedCountB === 0 && surfacedTotal === 0) {
      return null;
    }
    const strong = qualifiedCountA;
    const secondary = qualifiedCountB;
    const surfaced = surfacedTotal;
    let line = `${strong} strong setup${strong === 1 ? "" : "s"}`;
    if (secondary > 0) {
      line += ` · ${secondary} watchlist candidate${secondary === 1 ? "" : "s"}`;
    }
    line += ` · ${surfaced} surfaced after regime filter`;
    if (suppressedTotal > 0) {
      line += ` · ${suppressedTotal} held back by regime`;
    }
    return line;
  }
  if (!latestScan) return null;
  const { candidateCountA, candidateCountB, candidateCountSurfaced } = latestScan;
  if (candidateCountA === 0 && candidateCountB === 0 && candidateCountSurfaced === 0) {
    return null;
  }
  return `${candidateCountA} strong setup${candidateCountA === 1 ? "" : "s"} · ${candidateCountB} watchlist candidate${candidateCountB === 1 ? "" : "s"} · ${candidateCountSurfaced} surfaced`;
}

export function formatSetupDiagnosticCopy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const formatted = formatScannerReasonForUser(raw);
  return formatted || null;
}

/** Trader-facing action hints — strips internal URLs and setup IDs. */
export function formatActionHintForUser(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/Log trade → \/trades\/new/i.test(trimmed)) return "Log trade when entry confirms.";
  if (/Wait for entry zone/i.test(trimmed)) return "Wait for pullback entry zone.";
  if (/Review on Setups/i.test(trimmed)) return "Review full setup on Setups.";
  return formatScannerReasonForUser(trimmed) || null;
}

export function truncateForChip(text: string, max = 48): string {
  const cleaned = text.trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

const NEXT_CONDITION_BY_CODE: Record<string, string> = {
  breakout_recency: "Needs fresh breakout",
  pullback_zone_interaction: "Needs pullback-zone interaction",
  volume_ratio: "Needs volume confirmation",
  trend_below_ma50: "Needs trend recovery above 50-day average",
  trend_ma20_below_ma50: "Needs short-term momentum alignment",
  breakout_not_holding: "Needs breakout to hold",
  digestion: "Needs post-breakout digestion",
};

const STATE_BADGE_BY_CODE: Record<string, { badge: string; tone: V3RsStateTone }> = {
  breakout_recency: { badge: "Awaiting breakout", tone: "awaiting" },
  pullback_zone_interaction: { badge: "Not ready", tone: "not-ready" },
  volume_ratio: { badge: "Needs volume", tone: "watch" },
  trend_below_ma50: { badge: "Trend weak", tone: "not-ready" },
  trend_ma20_below_ma50: { badge: "Momentum lagging", tone: "watch" },
};

function rsStrengthLabel(rs20: number): string | null {
  if (rs20 >= 15) return "Strong RS";
  if (rs20 >= 5) return "Positive RS";
  if (rs20 > 0) return "Mild RS";
  if (rs20 < 0) return "Weak RS";
  return null;
}

function formatRsSpreadChip(label: string, spread: number): V3RsWatchlistMetric {
  const sign = spread >= 0 ? "+" : "";
  return {
    label,
    value: `${sign}${spread.toFixed(1)}pp`,
    tone: spread > 0 ? "strong" : spread < 0 ? "blocker" : "context",
  };
}

function humanizeDiagnosticLine(line: string): string {
  const text = line.trim();
  const rsLine = text.match(/^RS(20|50):\s*([+-]?\d+(?:\.\d+)?)\s*pp vs VNINDEX/i);
  if (rsLine) {
    const spread = Number.parseFloat(rsLine[2]!);
    const sessions = rsLine[1] === "50" ? 50 : 20;
    const dir =
      spread > 0 ? "Outperforming index" : spread < 0 ? "Underperforming index" : "In line with index";
    return `${sessions}-session RS: ${dir} (${spread >= 0 ? "+" : ""}${spread.toFixed(1)} pp).`;
  }
  if (/Stock above MA50:\s*yes/i.test(text)) return "Trend: above 50-day average.";
  if (/Stock above MA50:\s*no/i.test(text)) return "Trend: below 50-day average.";
  if (/VNINDEX above MA50:\s*yes/i.test(text)) return "Market backdrop: supportive.";
  if (/VNINDEX above MA50:\s*no/i.test(text)) return "Market backdrop: cautious.";
  return formatScannerReasonForUser(text);
}

function metricsFromDiagnostic(row: RsNearMissWatchlistEntryDto): V3RsWatchlistMetric[] {
  const metrics: V3RsWatchlistMetric[] = [
    formatRsSpreadChip("RS20", row.rs20SpreadPct),
  ];
  if (row.rs50SpreadPct != null && Number.isFinite(row.rs50SpreadPct)) {
    metrics.push(formatRsSpreadChip("RS50", row.rs50SpreadPct));
  }

  let trendSet = false;

  for (const line of row.rsDiagnostic?.lines ?? []) {
    if (/Stock above MA50:\s*yes/i.test(line)) {
      metrics.push({ label: "Trend", value: "above MA50", tone: "strong" });
      trendSet = true;
    } else if (/Stock above MA50:\s*no/i.test(line)) {
      metrics.push({ label: "Trend", value: "below MA50", tone: "blocker" });
      trendSet = true;
    }
    if (/VNINDEX above MA50:\s*yes/i.test(line)) {
      metrics.push({ label: "Market", value: "supportive", tone: "context" });
    } else if (/VNINDEX above MA50:\s*no/i.test(line)) {
      metrics.push({ label: "Market", value: "cautious", tone: "watch" });
    }
  }

  metrics.push({ label: "Trigger", value: "not confirmed", tone: "watch" });

  if (!trendSet && row.rs20SpreadPct > 0) {
    metrics.push({ label: "Trend", value: "RS positive", tone: "context" });
  }

  return metrics.slice(0, 5);
}

function buildPrimaryInsight(row: RsNearMissWatchlistEntryDto): string {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because);
  const rsPositive = row.rs20SpreadPct > 0;

  if (code === "breakout_recency" && rsPositive) {
    return "Strong relative strength, but no fresh breakout yet.";
  }
  if (code === "pullback_zone_interaction" && rsPositive) {
    return "Outperforming VNINDEX, waiting for a clean entry trigger.";
  }
  if (code === "volume_ratio" && rsPositive) {
    return "Relative strength is building, but participation is still thin.";
  }
  if (code === "trend_below_ma50" && rsPositive) {
    return "RS is positive, but price is still below the long-term trend filter.";
  }
  if (rsPositive) {
    return "Outperforming VNINDEX — setup filters have not cleared yet.";
  }
  if (code) {
    const guide = rejectionBucketTraderGuide(code);
    const meaning = guide.meaning.endsWith(".") ? guide.meaning.slice(0, -1) : guide.meaning;
    return meaning.charAt(0).toUpperCase() + meaning.slice(1) + ".";
  }
  return formatGateFailureForUser(row.failedGate2Because);
}

function buildNextCondition(row: RsNearMissWatchlistEntryDto): string {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because);
  if (code && NEXT_CONDITION_BY_CODE[code]) {
    return NEXT_CONDITION_BY_CODE[code]!;
  }
  if (code) {
    const guide = rejectionBucketTraderGuide(code);
    const wait = guide.waitFor;
    if (wait.length <= 72) return wait.endsWith(".") ? wait.slice(0, -1) : wait;
    return "Watch for structure to improve before acting.";
  }
  return "Watch only — not a qualified setup.";
}

function buildTechnicalEvidence(row: RsNearMissWatchlistEntryDto): string[] {
  const lines: string[] = [];
  if (row.rsDiagnostic?.lines.length) {
    for (const line of row.rsDiagnostic.lines) {
      lines.push(humanizeDiagnosticLine(line));
    }
  }
  if (row.failedGate2Because) {
    lines.push(formatGateFailureForUser(row.failedGate2Because));
  }
  if (
    row.distanceToPullbackZoneFrac != null &&
    Number.isFinite(row.distanceToPullbackZoneFrac)
  ) {
    lines.push(
      `Pullback zone distance: ${(100 * row.distanceToPullbackZoneFrac).toFixed(1)}% (context only).`
    );
  }
  if (row.rsDiagnostic?.disclaimer) {
    lines.push(
      "Relative strength is context only. It does not currently qualify the setup."
    );
  }
  return [...new Set(lines.filter(Boolean))];
}

export function mapRsWatchlistEntryToV3Card(row: RsNearMissWatchlistEntryDto): V3RsWatchlistCard {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because) ?? "";
  const state =
    STATE_BADGE_BY_CODE[code] ?? ({ badge: "Watchlist only", tone: "watch" } as const);

  return {
    symbol: row.symbol,
    stateBadge: state.badge,
    stateTone: state.tone,
    strengthLabel: rsStrengthLabel(row.rs20SpreadPct),
    primaryInsight: buildPrimaryInsight(row),
    metrics: metricsFromDiagnostic(row),
    blockerLabel: "Watch only — not a qualified setup",
    nextCondition: buildNextCondition(row),
    technicalEvidence: buildTechnicalEvidence(row),
  };
}

export function mapRsWatchlistToV3Panel(
  panel: RsNearMissWatchlistPanelDto
): V3RsWatchlistPanel {
  return {
    title: "Relative Strength Radar",
    subtitle: "Leaders vs VNINDEX that have not cleared setup filters yet.",
    contextNote:
      "Context only — does not count as a qualified setup or change today’s trade decision.",
    cards: panel.rows.map(mapRsWatchlistEntryToV3Card),
    emptyReason: panel.emptyReason
      ? formatScannerReasonForUser(panel.emptyReason)
      : null,
  };
}

/** @deprecated Use mapRsWatchlistToV3Panel — kept for transitional imports. */
export function humanizeRsNearMissWatchlistPanel(
  panel: RsNearMissWatchlistPanelDto
): RsNearMissWatchlistPanelDto {
  return {
    title: "Relative strength watchlist",
    subtitle:
      "Leaders vs the index that failed setup filters — context only, not trade signals.",
    disclaimerLines: [
      "For monitoring only — does not count as a qualified setup.",
      "Does not change today’s trade decision.",
    ],
    actionHint: "Review for context; wait for setup filters to clear before acting.",
    emptyReason: panel.emptyReason
      ? formatScannerReasonForUser(panel.emptyReason)
      : null,
    rows: panel.rows.map((row) => ({
      ...row,
      failedGate2Because: formatGateFailureForUser(row.failedGate2Because),
      topRejectionReason: row.topRejectionReason
        ? formatScannerReasonForUser(row.topRejectionReason)
        : "",
      actionHint: "Watchlist context only — not a qualified setup.",
      disclaimerLines: [
        "Context only — not a trade signal.",
        "Does not affect the setup score.",
      ],
      rsDiagnostic: row.rsDiagnostic
        ? {
            ...row.rsDiagnostic,
            summary: formatRelativeStrengthSummaryForUser(row.rsDiagnostic.summary),
            disclaimer:
              "Relative strength is shown for context only. It does not drive the setup score.",
            lines: row.rsDiagnostic.lines.map((line) => formatScannerReasonForUser(line)),
          }
        : null,
    })),
  };
}
