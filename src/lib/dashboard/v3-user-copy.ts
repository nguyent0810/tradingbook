import type { GateFunnelSnapshot } from "@/lib/dashboard/gate-funnel-copy";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { rejectionBucketTraderGuide } from "@/lib/scanner/setups-trader-copy";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";

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
      return "Setup is not ready yet — no fresh breakout confirmed.";
    }
    if (code) {
      const label = rejectionBucketTraderGuide(code).meaning;
      const sentence = label.endsWith(".") ? label.slice(0, -1) : label;
      return `Setup is not ready yet — ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}.`;
    }
    return `Setup is not ready yet — ${body.replace(/\s*\([^)]+\)\s*$/, "")}.`;
  }

  const category = extractCategoryKey(trimmed);
  if (category?.includes("_")) {
    const guide = rejectionBucketTraderGuide(category);
    return `Setup is not ready yet — ${guide.meaning}`;
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
