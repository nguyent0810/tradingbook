import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardMarketStatusBar } from "./dashboard-market-status-bar";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";

const baseFreshness: MarketFreshnessDto = {
  benchmarkDate: "2026-06-03",
  equityMaxDate: "2026-06-03",
  scanRunAt: "2026-06-03T08:00:00.000Z",
  delayedBackdrop: false,
  staleFlags: [],
  scanSessionCoverage: null,
  dataTimingMode: "eod",
};

describe("DashboardMarketStatusBar — data timing mode chip", () => {
  it("shows the EOD chip on the aligned (ok) branch", () => {
    const html = renderToStaticMarkup(<DashboardMarketStatusBar freshness={baseFreshness} />);
    expect(html).toContain('data-testid="dashboard-freshness-ok"');
    expect(html).toContain('data-testid="dashboard-data-timing-mode"');
    expect(html).toContain("Data: EOD");
  });

  it("shows the EOD chip on the stale branch", () => {
    const staleFreshness: MarketFreshnessDto = {
      ...baseFreshness,
      delayedBackdrop: true,
      staleFlags: [
        { code: "benchmark_behind_equity", severity: "warning", message: "Benchmark lags equity." },
      ],
    };
    const html = renderToStaticMarkup(<DashboardMarketStatusBar freshness={staleFreshness} />);
    expect(html).toContain('data-testid="dashboard-freshness-stale"');
    expect(html).toContain('data-testid="dashboard-data-timing-mode"');
    expect(html).toContain("Data: EOD");
  });
});
