import { describe, expect, it } from "vitest";
import type { V3RsWatchlistCard } from "./dashboard-v3-view-model";
import {
  filterRsWatchlistCards,
  sortRsWatchlistCards,
} from "./early-entry-ui";

function card(
  symbol: string,
  early: V3RsWatchlistCard["earlyEntry"]
): V3RsWatchlistCard {
  return {
    symbol,
    rs20SpreadPct: 2,
    rs50SpreadPct: 1,
    stateBadge: "Watch",
    stateTone: "awaiting",
    setupState: "Watch",
    setupReason: "test",
    strengthLabel: null,
    primaryInsight: "test",
    metrics: [],
    blockerLabel: "",
    nextCondition: "test",
    technicalEvidence: [],
    rsStrengthScore: null,
    setupReadinessScore: null,
    rsConfidence: null,
    terminalCode: null,
    earlyEntry: early,
  };
}

describe("early-entry-ui", () => {
  const pilot = card("ACB", {
    earlyReversalScore: 60,
    proposedTradeState: "Pilot Candidate",
    entryType: "Early Reclaim",
    reasonCodes: ["RR_ACCEPTABLE"],
    transitionReasonCodes: [],
    invalidLevel: 19,
    invalidLevelReason: "swing",
    stopDistancePct: 4,
    targetPrice: 22,
    targetReason: "high",
    estimatedRewardPct: 10,
    estimatedRiskReward: 2.5,
    suggestedPilotSizePct: 25,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: null,
  });

  const extended = card("VCB", {
    earlyReversalScore: 40,
    proposedTradeState: "Extended — Do Not Chase",
    entryType: "Extended",
    reasonCodes: ["EXTENDED_FROM_MA20", "CHASE_RISK"],
    transitionReasonCodes: [],
    invalidLevel: 18,
    invalidLevelReason: "swing",
    stopDistancePct: 8,
    targetPrice: 20,
    targetReason: "high",
    estimatedRewardPct: 5,
    estimatedRiskReward: 0.8,
    suggestedPilotSizePct: null,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: null,
  });

  it("filters pilot candidates only", () => {
    const out = filterRsWatchlistCards([pilot, extended], "pilot_candidate");
    expect(out).toHaveLength(1);
    expect(out[0]!.symbol).toBe("ACB");
  });

  it("filters extended do not chase", () => {
    const out = filterRsWatchlistCards([pilot, extended], "extended");
    expect(out).toHaveLength(1);
    expect(out[0]!.symbol).toBe("VCB");
  });

  it("sorts by score descending", () => {
    const out = sortRsWatchlistCards([extended, pilot], "score_desc");
    expect(out[0]!.symbol).toBe("ACB");
  });
});
