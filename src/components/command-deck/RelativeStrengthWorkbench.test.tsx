import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RelativeStrengthRow } from "./types";
import { RelativeStrengthWorkbench } from "./RelativeStrengthWorkbench";

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
  terminalCode: "breakout_recency",
  sectorLabel: "Bank",
  actionLabel: "Wait for breakout",
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
    distFromMa20Pct: 3.2,
  },
};

const ROW_WITHOUT_EARLY: RelativeStrengthRow = {
  ...ROW_WITH_EARLY,
  symbol: "VCB",
  earlyEntry: null,
};

describe("RelativeStrengthWorkbench", () => {
  it("shows compact early line and collapsible help panel with full disclaimer", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY, ROW_WITHOUT_EARLY]} />
    );
    expect(html).toContain("Early Entry Research · research-only · not a buy signal · paper validation enabled");
    expect(html).toContain('data-testid="early-entry-help"');
    expect(html).toContain('data-testid="command-deck-rs-early-research-warning"');
    expect(html).toContain('data-testid="command-deck-rs-daily-checklist"');
    expect(html).toContain("Pilot Research");
    expect(html).toContain("Wait Breakout");
    expect(html).toContain("2.04:1");
    expect(html).toContain("research-only signal");
    expect(html).toContain("Safety details");
  });

  it("shows filter counts on chips", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY, ROW_WITHOUT_EARLY]} />
    );
    expect(html).toContain('data-testid="rs-filter-all"');
    expect(html).toContain("All 2");
    expect(html).toContain("Pilot Research 1");
    expect(html).toContain("Bank 2");
  });

  it("renders action-oriented column before RS metrics", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY]} />
    );
    expect(html).toContain("Paper watch only");
    expect(html).toContain("<th>Action</th>");
    expect(html).not.toContain("RS Strength");
  });

  it("hides early columns when no row has earlyEntry", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[{ ...ROW_WITHOUT_EARLY, earlyEntry: null }]} />
    );
    expect(html).not.toContain("Early Entry Research · research-only");
    expect(html).not.toContain("Early State");
    expect(html).not.toContain("Pilot Research");
  });

  it("renders workbench as primary table", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY]} />
    );
    expect(html).toContain('data-testid="command-deck-rs-workbench"');
    expect(html).toContain("Relative Strength Workbench");
    expect(html).toContain("MA20 Dist");
  });
});
