import type { V3DecisionMode, V3EvidenceItem } from "./dashboard-v3-view-model";

const FALLBACK_SUMMARY =
  "Why no trade today: scanner blockers and market evidence support standing down.";

function summarizeEvidenceItem(item: V3EvidenceItem): string | null {
  const label = item.label.toLowerCase();
  const value = item.value.toLowerCase();

  if (label.includes("foreign") && (value.includes("−") || value.includes("-"))) {
    return "foreign flow negative";
  }
  if (label.includes("blocker")) {
    const first = item.value.split("·")[0]?.trim();
    if (!first) return "market blockers active";
    return first.length > 48 ? `${first.slice(0, 45).trim()}…` : first.toLowerCase();
  }
  if (label.includes("technical") && item.state !== "ok") {
    return "technical setup not confirmed";
  }
  if (label.includes("rejected")) {
    return "top rejection themes elevated";
  }
  if (label.includes("freshness") && item.state !== "ok") {
    return "data freshness caution";
  }
  if (item.state === "danger") {
    return `${item.label.toLowerCase()} flagged`;
  }
  return null;
}

/**
 * Compact NO TRADE evidence summary for the default-open evidence panel.
 * Presentation-only — does not affect stance or trade gate logic.
 */
export function buildEvidenceSummaryLine(
  mode: V3DecisionMode,
  evidence: V3EvidenceItem[]
): string | null {
  if (mode !== "PROTECT CAPITAL") return null;

  const snippets: string[] = [];
  for (const item of evidence) {
    if (item.state === "ok") continue;
    const snippet = summarizeEvidenceItem(item);
    if (snippet && !snippets.includes(snippet)) {
      snippets.push(snippet);
    }
  }

  if (snippets.length === 0) return FALLBACK_SUMMARY;
  return `Why no trade today: ${snippets.slice(0, 3).join(", ")}.`;
}
