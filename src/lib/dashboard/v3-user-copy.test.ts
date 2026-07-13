import { describe, expect, it } from "vitest";
import {
  formatActionHintForUser,
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
    // terminalCode is an internal data field (consumed by scoring + the workbench
    // mapper), never rendered. Assert the user-facing COPY carries readable labels.
    const serialized = JSON.stringify({ ...card, terminalCode: undefined });

    expect(card.symbol).toBe("CDC");
    expect(card.stateBadge).toBe("Watch: breakout");
    expect(card.setupState).toBe("Watch: breakout");
    expect(card.setupReason).toBe("Needs fresh breakout");
    expect(card.rs20SpreadPct).toBe(18.16);
    expect(card.strengthLabel).toBe("Strong RS");
    expect(card.primaryInsight).toMatch(/fresh breakout/i);
    expect(card.nextCondition).toBe("Needs fresh breakout");
    expect(card.blockerLabel).toBe("Needs fresh breakout");
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
    const copyOnly = { ...panel, cards: panel.cards.map((c) => ({ ...c, terminalCode: undefined })) };
    expectNoForbidden(JSON.stringify(copyOnly));
  });
});

describe("formatActionHintForUser", () => {
  it("formats the confirmed-entry action hint sentinel", () => {
    expect(
      formatActionHintForUser("Log trade — entry confirmed")
    ).toBe("Log trade when entry confirms.");
  });
});

describe("mapRsWatchlistEntryToV3Card — setup reasons", () => {
  it("maps positive RS + below MA50 to blocked MA50 with reason", () => {
    const card = mapRsWatchlistEntryToV3Card({
      symbol: "DCL",
      sessionDate: "2026-05-28",
      rs20SpreadPct: 2.8,
      rs50SpreadPct: -42.5,
      terminalCode: "trend_below_ma50",
      failedGate2Because: "Failed Gate 2 because: Below long-term trend (trend_below_ma50)",
      topRejectionReason: "Trend not supportive",
      stageRank: 15,
      distanceToPullbackZoneFrac: null,
      actionHint: "",
      disclaimerLines: [],
      rsDiagnostic: null,
    });
    expect(card.setupState).toBe("Blocked: MA50");
    expect(card.setupReason).toBe("Below 50-day average");
    expect(card.strengthLabel).toBe("Mild RS");
  });
});

describe("formatGateFailureForUser", () => {
  it("rewrites breakout_recency failures", () => {
    const copy = formatGateFailureForUser(
      "Failed Gate 2 because: No recent breakout (breakout_recency)"
    );
    expect(copy).toMatch(/Not ready/i);
    expect(copy).not.toMatch(/breakout_recency/);
  });
});
