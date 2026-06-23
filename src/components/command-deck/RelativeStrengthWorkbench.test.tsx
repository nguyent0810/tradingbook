import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RelativeStrengthRow } from "./types";
import { RelativeStrengthWorkbench } from "./RelativeStrengthWorkbench";
import { WorkbenchRowQuickActions } from "./WorkbenchRowQuickActions";

const ROW_WITH_EARLY: RelativeStrengthRow = {
  symbol: "ACB",
  rs20: 3.2,
  rs50: 1.1,
  rsStrength: "Strong RS",
  setupState: "Qualified",
  reason: "Needs fresh breakout",
  status: "watch",
  rsStrengthScore: null,
  setupReadinessScore: null,
  terminalCode: "other",
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
    expect(html).toContain("Pilot Research");
    expect(html).toContain("Main Setup");
    expect(html).toContain("Early Research");
    expect(html).toContain("Early Score");
    expect(html).toContain("2.04:1");
    expect(html).toContain("Safety details");
  });

  it("shows practical filter counts on chips", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY, ROW_WITHOUT_EARLY]} />
    );
    expect(html).toContain('data-testid="rs-filter-all"');
    expect(html).toContain("All 2");
    expect(html).toContain("Pilot Research 1");
    expect(html).toContain("Bank 2");
    expect(html).toContain('data-testid="rs-filter-watch_trigger"');
  });

  it("renders priority-based action and separate setup lanes", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY]} />
    );
    expect(html).toContain("Paper watch only");
    expect(html).toContain("<th>Main Setup</th>");
    expect(html).toContain("Early Research");
    expect(html).not.toContain("RS Strength");
  });

  it("hides early columns when no row has earlyEntry", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[{ ...ROW_WITHOUT_EARLY, earlyEntry: null }]} />
    );
    expect(html).not.toContain("Early Entry Research · research-only");
    expect(html).not.toContain("Early Research");
    expect(html).not.toContain("Pilot Research");
  });

  it("renders workbench as primary table with formatted columns", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthWorkbench rows={[ROW_WITH_EARLY]} />
    );
    expect(html).toContain('data-testid="command-deck-rs-workbench"');
    expect(html).toContain("MA20 Dist");
    expect(html).toContain("+3.2%");
  });
});

describe("WorkbenchRowQuickActions", () => {
  it("shows allowed quick actions and no trade execution buttons", () => {
    const html = renderToStaticMarkup(<WorkbenchRowQuickActions symbol="ACB" />);
    expect(html).toContain("View chart");
    expect(html).toContain("Add to watchlist");
    expect(html).toContain("Create alert");
    expect(html).toContain("Paper log");
    expect(html).not.toMatch(/>(Buy|Execute|Place order)</);
  });
});
