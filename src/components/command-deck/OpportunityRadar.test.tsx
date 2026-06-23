import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRadarNodesFromWorkbenchRows } from "@/lib/dashboard/rs-radar-from-workbench";
import type { RadarNode, RelativeStrengthRow } from "./types";
import { OpportunityRadar } from "./OpportunityRadar";

const SAMPLE_NODES: RadarNode[] = [
  {
    symbol: "ACB",
    readiness: 72,
    risk: 35,
    classification: "watch",
    tier: "Near miss",
    reason: "Needs breakout",
    sparkline: [1, 2, 3, 4, 5],
  },
];

const WORKBENCH_ROW: RelativeStrengthRow = {
  symbol: "BVB",
  rs20: 13.7,
  rs50: 2.1,
  rsStrength: "Strong RS",
  setupState: "Blocked: zone",
  reason: "Not in zone",
  status: "blocked",
  rsStrengthScore: null,
  setupReadinessScore: null,
  terminalCode: "pullback_zone_interaction",
  sectorLabel: "Bank",
  actionLabel: "Wait",
  earlyEntry: {
    earlyReversalScore: 28,
    proposedTradeState: "Extended — Do Not Chase",
    entryType: "pilot",
    reasonCodes: ["EXTENDED_FROM_MA20"],
    transitionReasonCodes: [],
    invalidLevel: 11,
    invalidLevelReason: null,
    stopDistancePct: 4,
    targetPrice: 14,
    targetReason: null,
    estimatedRewardPct: 2,
    estimatedRiskReward: 0.3,
    suggestedPilotSizePct: 0,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: 7.2,
  },
};

describe("OpportunityRadar layout", () => {
  it("uses square aspect-ratio plot container", () => {
    const html = renderToStaticMarkup(<OpportunityRadar nodes={SAMPLE_NODES} variant="mini" />);
    expect(html).toContain('data-testid="command-deck-radar-plot"');
    expect(html).toContain("cd-radar-plot");
    expect(html).toContain("aspect-square");
    expect(html).toContain("cd-radar-plot--mini");
    expect(html).toContain('data-testid="radar-mini-summary"');
  });

  it("renders circular backdrop circles not ellipses", () => {
    const html = renderToStaticMarkup(<OpportunityRadar nodes={SAMPLE_NODES} />);
    expect(html).toContain("<circle");
    expect(html).not.toContain("<ellipse");
  });

  it("shows workbench-based mini summary labels and real best RS symbols", () => {
    const nodes = buildRadarNodesFromWorkbenchRows([WORKBENCH_ROW]);
    const html = renderToStaticMarkup(
      <OpportunityRadar
        nodes={nodes}
        workbenchRows={[WORKBENCH_ROW]}
        variant="mini"
      />
    );
    expect(html).toContain("Pilot Research: 0");
    expect(html).toContain("Too Extended: 1");
    expect(html).toContain("Best RS: BVB");
    expect(html).not.toContain("Blocked sample");
    expect(html).not.toContain("Leaders:");
  });
});
