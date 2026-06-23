import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RadarNode } from "./types";
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

describe("OpportunityRadar layout", () => {
  it("uses square aspect-ratio plot container", () => {
    const html = renderToStaticMarkup(<OpportunityRadar nodes={SAMPLE_NODES} />);
    expect(html).toContain('data-testid="command-deck-radar-plot"');
    expect(html).toContain("cd-radar-plot");
    expect(html).toContain("aspect-square");
    expect(html).not.toContain("cd-radar-wrap");
    expect(html).not.toContain("flex-1 relative min-h-[300px]");
  });

  it("renders circular backdrop circles not ellipses", () => {
    const html = renderToStaticMarkup(<OpportunityRadar nodes={SAMPLE_NODES} />);
    expect(html).toContain("<circle");
    expect(html).not.toContain("<ellipse");
  });
});
