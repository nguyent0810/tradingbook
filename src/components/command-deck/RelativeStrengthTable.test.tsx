import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RelativeStrengthRow } from "./types";
import { RelativeStrengthTable } from "./RelativeStrengthTable";

const ROW_WITH_EARLY: RelativeStrengthRow = {
  symbol: "ACB",
  rs20: 3.2,
  rs50: 1.1,
  rsStrength: "Strong RS",
  setupState: "Watch: breakout",
  reason: "Needs fresh breakout",
  status: "watch",
  rsStrengthScore: null,
  setupReadinessScore: null,
  earlyEntry: {
    earlyReversalScore: 59,
    proposedTradeState: "Pilot Candidate",
    entryType: "Compression Breakout",
    reasonCodes: ["RR_ACCEPTABLE"],
    transitionReasonCodes: [],
    invalidLevel: 19,
    invalidLevelReason: "Recent swing low",
    stopDistancePct: 4,
    targetPrice: 22,
    targetReason: "60-day high",
    estimatedRewardPct: 10,
    estimatedRiskReward: 2.04,
    suggestedPilotSizePct: 25,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
  },
};

const ROW_WITHOUT_EARLY: RelativeStrengthRow = {
  ...ROW_WITH_EARLY,
  symbol: "VCB",
  earlyEntry: null,
};

describe("RelativeStrengthTable early-entry UI", () => {
  it("shows early columns and research warning when any row has earlyEntry", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthTable rows={[ROW_WITH_EARLY, ROW_WITHOUT_EARLY]} />
    );
    expect(html).toContain('data-testid="command-deck-rs-early-research-warning"');
    expect(html).toContain('data-testid="command-deck-rs-early-research-section"');
    expect(html).toContain('data-testid="command-deck-rs-daily-checklist"');
    expect(html).toContain('data-testid="command-deck-rs-paper-commands"');
    expect(html).toContain("Early state");
    expect(html).toContain("Pilot Candidate");
    expect(html).toContain("2.04:1");
    expect(html).toContain("research-only signal");
    expect(html).toContain("Compression Breakout");
    expect(html).toContain("22.00");
  });

  it("hides early columns when no row has earlyEntry", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthTable rows={[{ ...ROW_WITHOUT_EARLY, earlyEntry: null }]} />
    );
    expect(html).not.toContain('data-testid="command-deck-rs-early-research-warning"');
    expect(html).not.toContain("Early state");
    expect(html).not.toContain("Pilot Candidate");
  });
});
