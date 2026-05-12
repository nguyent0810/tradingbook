import { describe, expect, it } from "vitest";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import {
  buildMarketDataFreshnessReport,
  isBenchmarkStaleVsEquity,
} from "@/lib/market/market-data-freshness-report";

describe("isBenchmarkStaleVsEquity", () => {
  it("is false when equity is same day as benchmark", () => {
    const b = new Date(Date.UTC(2026, 4, 6));
    const e = new Date(Date.UTC(2026, 4, 6));
    expect(isBenchmarkStaleVsEquity(b, e)).toBe(false);
  });

  it("is true when equity is strictly after benchmark", () => {
    const b = new Date(Date.UTC(2026, 4, 6));
    const e = new Date(Date.UTC(2026, 4, 11));
    expect(isBenchmarkStaleVsEquity(b, e)).toBe(true);
  });

  it("is false when either date is missing", () => {
    expect(isBenchmarkStaleVsEquity(null, new Date())).toBe(false);
    expect(isBenchmarkStaleVsEquity(new Date(), null)).toBe(false);
  });
});

describe("analyzeMarketDataAlignment", () => {
  it("shows banner when benchmark lags equity bars", () => {
    const a = analyzeMarketDataAlignment({
      benchmarkSessionDate: new Date(Date.UTC(2026, 4, 6)),
      latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 10)),
      latestScanRunAt: new Date(Date.UTC(2026, 4, 6, 8, 0, 0)),
    });
    expect(a.showBanner).toBe(true);
    expect(a.issues).toContain("benchmark_behind_equity");
  });
});

describe("buildMarketDataFreshnessReport", () => {
  it("includes stale wording and refresh action when benchmark lags equity", () => {
    const snapshot = {
      benchmarkSessionDate: new Date(Date.UTC(2026, 4, 6)),
      latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 11)),
      latestScanRunAt: new Date(Date.UTC(2026, 4, 11, 12, 0, 0)),
    };
    const alignment = analyzeMarketDataAlignment(snapshot);
    const { lines, recommendedActions } = buildMarketDataFreshnessReport(snapshot, alignment);
    expect(lines.some((l) => l.includes("Benchmark stale vs equity max: yes"))).toBe(true);
    expect(
      recommendedActions.some((a) => a.includes("Refresh VNINDEX") || a.includes("vnindex"))
    ).toBe(true);
  });
});
