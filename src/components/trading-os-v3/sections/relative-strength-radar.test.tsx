import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3EarlyEntryDisplay, V3RsWatchlistPanel } from "@/lib/dashboard/dashboard-v3-view-model";
import { RelativeStrengthRadar } from "./relative-strength-radar";

const EARLY_ENTRY: V3EarlyEntryDisplay = {
  earlyReversalScore: 62,
  proposedTradeState: "Pilot Candidate",
  entryType: "Early Reclaim",
  reasonCodes: ["RECLAIM_MA20", "RR_ACCEPTABLE"],
  transitionReasonCodes: [],
  invalidLevel: 19.2,
  invalidLevelReason: "Recent swing low",
  stopDistancePct: 5.2,
  targetPrice: 22.5,
  targetReason: "60-day high",
  estimatedRewardPct: 12.4,
  estimatedRiskReward: 2.1,
  suggestedPilotSizePct: 25,
  sizingNote: "Display-only research: pilot candidate ~25% — not validated for live trading",
  whyNotPilotYet: null,
  rrRejectionReason: null,
};

function panelWithEarlyEntry(includeEarly: boolean): V3RsWatchlistPanel {
  return {
    title: "Relative Strength Radar",
    subtitle: "Leaders vs VNINDEX",
    contextNote: "Context only",
    emptyReason: null,
    cards: [
      {
        symbol: "ACB",
        rs20SpreadPct: 3.2,
        rs50SpreadPct: 1.1,
        stateBadge: "Watch: breakout",
        stateTone: "awaiting",
        setupState: "Watch: breakout",
        setupReason: "Needs fresh breakout",
        strengthLabel: "Strong RS",
        primaryInsight: "Outperforming index",
        metrics: [{ label: "RS20", value: "+3.2pp", tone: "strong" }],
        blockerLabel: "Needs fresh breakout",
        nextCondition: "Needs fresh breakout",
        technicalEvidence: [],
        rsStrengthScore: null,
        setupReadinessScore: null,
        rsConfidence: null,
        earlyEntry: includeEarly ? EARLY_ENTRY : null,
      },
    ],
  };
}

describe("RelativeStrengthRadar early-entry UI", () => {
  it("renders early-entry panel when metadata present", () => {
    const html = renderToStaticMarkup(<RelativeStrengthRadar panel={panelWithEarlyEntry(true)} />);
    expect(html).toContain('data-testid="dashboard-v3-rs-early-entry"');
    expect(html).toContain('data-testid="dashboard-v3-rs-early-research-warning"');
    expect(html).toContain("Pilot Candidate");
    expect(html).toContain("Research signal only");
    expect(html).toContain("2.10:1");
    expect(html).toContain("60-day high");
    expect(html).toContain("Recent swing low");
    expect(html).toContain("RECLAIM MA20");
  });

  it("does not render early-entry panel when metadata absent", () => {
    const html = renderToStaticMarkup(<RelativeStrengthRadar panel={panelWithEarlyEntry(false)} />);
    expect(html).not.toContain('data-testid="dashboard-v3-rs-early-entry"');
    expect(html).not.toContain("Early state");
    expect(html).not.toContain("Pilot Candidate");
  });
});

describe("mapRsWatchlistEntryToV3Card flag behavior", () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.EARLY_ENTRY_V1_ENABLED;
  });

  afterEach(() => {
    if (prev !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prev;
    else delete process.env.EARLY_ENTRY_V1_ENABLED;
  });

  it("maps earlyEntry when metadata provided on row", async () => {
    const { mapRsWatchlistEntryToV3Card } = await import("@/lib/dashboard/v3-user-copy");
    const card = mapRsWatchlistEntryToV3Card({
      symbol: "ACB",
      sessionDate: "2026-05-14",
      rs20SpreadPct: 2,
      rs50SpreadPct: null,
      terminalCode: "breakout_recency",
      failedGate2Because: "Failed Gate 2 because: No recent breakout",
      topRejectionReason: "",
      stageRank: 1,
      distanceToPullbackZoneFrac: null,
      actionHint: "",
      disclaimerLines: [],
      earlyEntry: {
        earlyReversalScore: 59,
        proposedTradeState: "PILOT_BUY",
        entryType: "Compression Breakout",
        reasonCodes: ["RR_ACCEPTABLE"],
        transitionReasonCodes: [],
        invalidLevel: 19,
        invalidLevelReason: "swing_low",
        stopDistancePct: 4,
        targetPrice: 22,
        targetReason: "prior_60d_high",
        estimatedRewardPct: 10,
        estimatedRiskReward: 2.04,
        suggestedPilotSizePct: 25,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
      },
    });
    expect(card.earlyEntry?.proposedTradeState).toBe("Pilot Candidate");
    expect(card.earlyEntry?.estimatedRiskReward).toBe(2.04);
  });
});
