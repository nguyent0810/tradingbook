import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPipelineStages } from "./pipeline-stages";
import { PipelineMetrics } from "./PipelineMetrics";
import { RadarSweepEmpty } from "./RadarSweepEmpty";
import { TerminalFilterLog } from "./TerminalFilterLog";

function mockScan(overrides: Partial<{
  symbolCountTotal: number;
  symbolCountScanned: number;
  symbolCountAfterTradability: number;
  candidateCountSurfaced: number;
  gate1Level: string;
}> = {}) {
  return {
    id: "scan-test-001",
    runAt: new Date("2026-06-12T10:00:00Z"),
    gate1Level: overrides.gate1Level ?? "PASS",
    symbolCountTotal: overrides.symbolCountTotal ?? 120,
    symbolCountScanned: overrides.symbolCountScanned ?? 95,
    symbolCountAfterTradability: overrides.symbolCountAfterTradability ?? 42,
    candidateCountSurfaced: overrides.candidateCountSurfaced ?? 3,
    candidateCountA: 2,
    candidateCountB: 1,
    tradabilityBreakdown: null,
    candidates: [],
  } as Parameters<typeof buildPipelineStages>[0];
}

describe("buildPipelineStages", () => {
  it("maps universe through surfaced counts", () => {
    const stages = buildPipelineStages(mockScan(), 0, "Favorable");
    expect(stages.map((s) => s.id)).toEqual(["universe", "regime", "tradability", "surfaced"]);
    expect(stages[0]?.value).toBe(120);
    expect(stages[3]?.value).toBe(3);
  });

  it("appends near-miss stage when count > 0", () => {
    const stages = buildPipelineStages(mockScan(), 7, "Caution");
    expect(stages.at(-1)).toMatchObject({ id: "near-miss", value: 7, tone: "warning" });
  });

  it("flags caution regime tone", () => {
    const stages = buildPipelineStages(mockScan(), 0, "Caution");
    expect(stages.find((s) => s.id === "regime")?.tone).toBe("warning");
  });
});

describe("PipelineMetrics", () => {
  it("renders pipeline metrics test id when scan exists", () => {
    const html = renderToStaticMarkup(
      <PipelineMetrics latestScan={mockScan()} nearMissCount={2} gate1Label="Favorable" />
    );
    expect(html).toContain('data-testid="setups-pipeline-metrics"');
    expect(html).toContain("Near-miss");
  });

  it("renders empty state when no scan", () => {
    const html = renderToStaticMarkup(
      <PipelineMetrics latestScan={null} nearMissCount={0} />
    );
    expect(html).toContain('data-testid="setups-pipeline-summary-empty"');
  });
});

describe("RadarSweepEmpty", () => {
  it("renders without throw", () => {
    const html = renderToStaticMarkup(<RadarSweepEmpty />);
    expect(html).toContain('data-testid="setups-radar-sweep"');
  });
});

describe("TerminalFilterLog", () => {
  it("renders active and inactive pill states", () => {
    const html = renderToStaticMarkup(
      <TerminalFilterLog breakdown={{ low_volume: 5, halted: 0 }} defaultOpen />
    );
    expect(html).toContain("5×");
    expect(html).toContain("0×");
    expect(html).toContain('data-testid="setups-terminal-filter-log"');
  });
});
