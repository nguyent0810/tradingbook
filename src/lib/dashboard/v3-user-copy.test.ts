import { describe, expect, it } from "vitest";
import {
  formatGateFailureForUser,
  mapRsWatchlistEntryToV3Card,
  mapRsWatchlistToV3Panel,
} from "./v3-user-copy";

const RAW_ROW = {
  symbol: "CDC",
  sessionDate: "2026-05-28",
  rs20SpreadPct: 18.16,
  rs50SpreadPct: 24.91,
  terminalCode: "breakout_recency",
  failedGate2Because: "Failed Gate 2 because: No recent breakout (breakout_recency)",
  topRejectionReason: "Not a Gate 2 SetupCandidate.",
  stageRank: 58,
  distanceToPullbackZoneFrac: 0.04,
  actionHint: "Diagnostic only",
  disclaimerLines: ["Not part of rankScore yet."],
  rsDiagnostic: {
    summary: "RS20 +18.16 pp · RS50 +24.91 pp",
    disclaimer:
      "Relative strength diagnostic only — not used in current Gate 2 pass/fail and not part of rankScore yet.",
    lines: [
      "RS20: +18.16 pp vs VNINDEX — Outperforming VNINDEX over 20 sessions.",
      "Stock above MA50: yes",
      "VNINDEX above MA50: yes",
    ],
    rs20SpreadPct: 18.16,
  },
};

const FORBIDDEN = [
  "Failed Gate 2 because",
  "SetupCandidate",
  "rankScore",
  "diagnostic only",
  "not used in current",
  "breakout_recency",
];

function expectNoForbidden(text: string) {
  for (const phrase of FORBIDDEN) {
    expect(text).not.toMatch(new RegExp(phrase, "i"));
  }
}

describe("mapRsWatchlistEntryToV3Card", () => {
  it("builds compact card without raw diagnostic strings in default fields", () => {
    const card = mapRsWatchlistEntryToV3Card(RAW_ROW);
    const serialized = JSON.stringify(card);

    expect(card.symbol).toBe("CDC");
    expect(card.stateBadge).toBe("Awaiting breakout");
    expect(card.strengthLabel).toBe("Strong RS");
    expect(card.primaryInsight).toMatch(/fresh breakout/i);
    expect(card.nextCondition).toBe("Needs fresh breakout");
    expect(card.metrics.some((m) => m.label === "RS20")).toBe(true);
    expectNoForbidden(serialized);
    expect(serialized).not.toMatch(/RS20 \+/);
  });

  it("humanizes technical evidence lines when expanded", () => {
    const card = mapRsWatchlistEntryToV3Card(RAW_ROW);
    expect(card.technicalEvidence.join(" ")).toMatch(/50-day average/i);
    expect(card.technicalEvidence.join(" ")).toMatch(/Market backdrop: supportive/i);
    for (const line of card.technicalEvidence) {
      expectNoForbidden(line);
    }
  });
});

describe("mapRsWatchlistToV3Panel", () => {
  it("uses V3 product naming and card grid payload", () => {
    const panel = mapRsWatchlistToV3Panel({
      title: "Relative-strength watchlist",
      subtitle: "Diagnostic only",
      disclaimerLines: ["Not a Gate 2 SetupCandidate."],
      actionHint: "Not used in current trading decision.",
      emptyReason: null,
      rows: [RAW_ROW],
    });

    expect(panel.title).toBe("Relative Strength Radar");
    expect(panel.cards).toHaveLength(1);
    expectNoForbidden(JSON.stringify(panel));
  });
});

describe("formatGateFailureForUser", () => {
  it("rewrites breakout_recency failures", () => {
    const copy = formatGateFailureForUser(
      "Failed Gate 2 because: No recent breakout (breakout_recency)"
    );
    expect(copy).toMatch(/not ready yet/i);
    expect(copy).not.toMatch(/breakout_recency/);
  });
});
