import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardTradeGatePanel } from "./dashboard-trade-gate-panel";
import type { V3TradeGate } from "@/lib/dashboard/dashboard-v3-view-model";

const baseGate: V3TradeGate = {
  subtitle: "Entry closed — no new swing entries under today's stance.",
  budgetStatus: "unavailable",
  budgetProvenance: "gap",
  rows: [
    {
      id: "gate1",
      rule: "Market regime (Gate 1)",
      status: "blocked",
      statusLabel: "Blocked",
      severity: "High",
      action: "Wait for regime to clear.",
      provenance: "derived",
    },
    {
      id: "confidence",
      rule: "Data confidence",
      status: "waiting",
      statusLabel: "Waiting",
      severity: "Med",
      action: "No new entries until confidence improves.",
      provenance: "derived",
    },
  ],
};

describe("DashboardTradeGatePanel", () => {
  it("renders the subtitle and every gate row with its status and action", () => {
    const html = renderToStaticMarkup(<DashboardTradeGatePanel tradeGate={baseGate} />);
    expect(html).toContain('data-testid="dashboard-trade-gate-panel"');
    expect(html).toContain("Entry closed");
    expect(html).toContain('data-testid="dashboard-trade-gate-row-gate1"');
    expect(html).toContain('data-testid="dashboard-trade-gate-row-confidence"');
    expect(html).toContain("Market regime (Gate 1)");
    expect(html).toContain("Wait for regime to clear.");
    expect(html).toContain("No new entries until confidence improves.");
  });

  it("renders a row per gate even when all rows are ready", () => {
    const readyGate: V3TradeGate = {
      ...baseGate,
      rows: [
        {
          id: "gate1",
          rule: "Market regime (Gate 1)",
          status: "ready",
          statusLabel: "Ready",
          severity: "Low",
          action: "Clear.",
          provenance: "derived",
        },
      ],
    };
    const html = renderToStaticMarkup(<DashboardTradeGatePanel tradeGate={readyGate} />);
    expect(html).toContain('data-testid="dashboard-trade-gate-row-gate1"');
    expect(html).toContain("Ready");
  });
});
