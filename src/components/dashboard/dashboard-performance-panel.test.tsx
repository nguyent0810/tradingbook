import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Trade } from "@/generated/prisma/client";
import { DashboardPerformancePanel } from "./dashboard-performance-panel";

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    setupId: null,
    symbol: "HPG",
    direction: "LONG",
    status: "CLOSED",
    entryDate: new Date("2026-05-01T00:00:00.000Z"),
    exitDate: new Date("2026-05-10T00:00:00.000Z"),
    entryPrice: 28,
    exitPrice: 30,
    quantity: 1000,
    fees: 0,
    realizedPnl: 2000,
    rMultiple: null,
    outcome: null,
    playbook: "BREAKOUT_PULLBACK",
    entryReason: null,
    entryLocationVsZone: null,
    healthLevelAtEntry: null,
    healthScoreAtEntry: null,
    stopLoss: null,
    takeProfit: null,
    positionSize: null,
    setupSnapshot: null,
    exitReason: null,
    exitDiscipline: null,
    entryNote: null,
    exitNote: null,
    notes: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    ...overrides,
  } as Trade;
}

describe("DashboardPerformancePanel", () => {
  it("renders the empty state when there are no closed trades", () => {
    const html = renderToStaticMarkup(
      <DashboardPerformancePanel trades={[trade({ status: "OPEN", exitDate: null, realizedPnl: null })]} />
    );

    expect(html).toContain('data-testid="dashboard-performance-panel"');
    expect(html).toContain('data-testid="dashboard-performance-empty"');
    expect(html).not.toContain('data-testid="dashboard-equity-sparkline"');
  });

  it("renders stats for closed trades (success state)", () => {
    const html = renderToStaticMarkup(
      <DashboardPerformancePanel trades={[trade({ id: "t1", realizedPnl: 2000 })]} />
    );

    expect(html).toContain('data-testid="dashboard-performance-panel"');
    expect(html).not.toContain('data-testid="dashboard-performance-empty"');
    expect(html).toContain("Closed");
    expect(html).toContain("Win rate");
  });

  it("only renders the sparkline once more than one equity point exists", () => {
    const single = renderToStaticMarkup(
      <DashboardPerformancePanel trades={[trade({ id: "t1", realizedPnl: 2000 })]} />
    );
    expect(single).not.toContain('data-testid="dashboard-equity-sparkline"');

    const multiple = renderToStaticMarkup(
      <DashboardPerformancePanel
        trades={[
          trade({ id: "t1", realizedPnl: 2000, exitDate: new Date("2026-05-05T00:00:00.000Z") }),
          trade({ id: "t2", realizedPnl: -500, exitDate: new Date("2026-05-06T00:00:00.000Z") }),
        ]}
      />
    );
    expect(multiple).toContain('data-testid="dashboard-equity-sparkline"');
  });

  it("renders the win/loss/breakeven donut with closed trades", () => {
    const html = renderToStaticMarkup(
      <DashboardPerformancePanel
        trades={[
          trade({ id: "t1", realizedPnl: 2000 }),
          trade({ id: "t2", realizedPnl: -500 }),
        ]}
      />
    );
    expect(html).toContain('data-testid="dashboard-outcome-donut"');
    expect(html).toContain("Win / Loss / Breakeven");
    expect(html).toContain("Win 50%");
    expect(html).toContain("Loss 50%");
  });

  it("omits the donut when there are no closed trades", () => {
    const html = renderToStaticMarkup(
      <DashboardPerformancePanel trades={[trade({ status: "OPEN", exitDate: null, realizedPnl: null })]} />
    );
    expect(html).not.toContain('data-testid="dashboard-outcome-donut"');
  });
});
