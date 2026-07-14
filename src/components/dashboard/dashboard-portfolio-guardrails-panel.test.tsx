import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPortfolioGuardrailsPanel } from "./dashboard-portfolio-guardrails-panel";
import { computePortfolioGuardrails } from "@/lib/dashboard/portfolio-guardrails";

describe("DashboardPortfolioGuardrailsPanel", () => {
  it("renders open-position count, portfolio heat, and status copy", () => {
    const guardrails = computePortfolioGuardrails({
      trades: [
        { status: "OPEN", symbol: "HPG", entryPrice: 100, quantity: 1000, stopLoss: 95 },
      ],
      accountEquityVnd: 100_000,
    });

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );

    expect(html).toContain('data-testid="dashboard-portfolio-guardrails-panel"');
    expect(html).toContain('data-testid="dashboard-guardrail-max-positions"');
    expect(html).toContain("1 / 8");
    expect(html).toContain('data-testid="dashboard-guardrail-portfolio-heat"');
    expect(html).toContain("all have a valid stop loss below entry");
  });

  it("shows the at-cap badge when the position count reaches the default limit", () => {
    const guardrails = computePortfolioGuardrails({
      trades: Array.from({ length: 8 }, (_, i) => ({
        status: "OPEN" as const,
        symbol: `S${i}`,
        entryPrice: 100,
        quantity: 100,
        stopLoss: 95,
      })),
      accountEquityVnd: null,
    });

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );
    expect(html).toContain("At cap");
  });

  it("shows duplicate-symbol exposure when a symbol has both a planned and open row", () => {
    const guardrails = computePortfolioGuardrails({
      trades: [
        { status: "PLANNED", symbol: "HPG", entryPrice: 20, quantity: 1000, stopLoss: null },
        { status: "OPEN", symbol: "HPG", entryPrice: 21, quantity: 500, stopLoss: 19 },
      ],
      accountEquityVnd: null,
    });

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );
    expect(html).toContain('data-testid="dashboard-guardrail-duplicate-exposure"');
    expect(html).toContain("HPG");
  });

  it("omits the duplicate-exposure block when nothing is flagged", () => {
    const guardrails = computePortfolioGuardrails({
      trades: [
        { status: "OPEN", symbol: "HPG", entryPrice: 100, quantity: 1000, stopLoss: 95 },
      ],
      accountEquityVnd: null,
    });

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );
    expect(html).not.toContain('data-testid="dashboard-guardrail-duplicate-exposure"');
  });

  it("shows a prominent 'mostly unknown risk' badge (not just the footnote) when most open trades have no stop, even though the tracked heat figure is small", () => {
    // Same fail-closed scenario as portfolio-guardrails.test.ts: 4/5 open trades have
    // no stop loss, so the tracked heat number is small and not "isElevated" — this
    // must not render as a plain, reassuring-looking low number.
    const guardrails = computePortfolioGuardrails({
      trades: [
        { status: "OPEN", symbol: "A", entryPrice: 100, quantity: 1000, stopLoss: null },
        { status: "OPEN", symbol: "B", entryPrice: 100, quantity: 1000, stopLoss: null },
        { status: "OPEN", symbol: "C", entryPrice: 100, quantity: 1000, stopLoss: null },
        { status: "OPEN", symbol: "D", entryPrice: 100, quantity: 1000, stopLoss: null },
        { status: "OPEN", symbol: "E", entryPrice: 1000, quantity: 1000, stopLoss: 900 },
      ],
      accountEquityVnd: 500_000_000,
    });

    expect(guardrails.portfolioHeat.isElevated).toBe(false);
    expect(guardrails.portfolioHeat.dataQuality).toBe("mostly_unknown");

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );
    expect(html).toContain("Mostly unknown risk");
    expect(html).toContain("do not read the figure above as low total risk");
  });

  it("does not show the 'mostly unknown risk' badge when stop-loss data is reliable", () => {
    const guardrails = computePortfolioGuardrails({
      trades: [
        { status: "OPEN", symbol: "HPG", entryPrice: 100, quantity: 1000, stopLoss: 95 },
      ],
      accountEquityVnd: null,
    });

    const html = renderToStaticMarkup(
      <DashboardPortfolioGuardrailsPanel guardrails={guardrails} />
    );
    expect(html).not.toContain("Mostly unknown risk");
  });
});
