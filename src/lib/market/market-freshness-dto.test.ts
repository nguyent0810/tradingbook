import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";

describe("buildMarketFreshnessDto", () => {
  it("returns aligned dates and no stale flags when snapshot is consistent", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 10, 8, 0, 0)),
      },
    });
    expect(dto.benchmarkDate).toBe("2026-05-10");
    expect(dto.equityMaxDate).toBe("2026-05-10");
    expect(dto.scanRunAt).toBe(new Date(Date.UTC(2026, 4, 10, 8, 0, 0)).toISOString());
    expect(dto.delayedBackdrop).toBe(false);
    expect(dto.staleFlags).toHaveLength(0);
  });

  it("flags missing benchmark and sets delayedBackdrop when equity exists", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: null,
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestScanRunAt: null,
      },
    });
    expect(dto.benchmarkDate).toBeNull();
    expect(dto.staleFlags.some((f) => f.code === "benchmark_missing")).toBe(true);
    expect(dto.staleFlags.find((f) => f.code === "benchmark_missing")?.severity).toBe(
      "error"
    );
  });

  it("sets delayedBackdrop when benchmark lags equity", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 6)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 11)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 11, 12, 0, 0)),
      },
    });
    expect(dto.delayedBackdrop).toBe(true);
    expect(dto.staleFlags.map((f) => f.code)).toContain("benchmark_behind_equity");
  });

  it("OR-combines delayedBackdropFromScanNotes with alignment", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 10, 8, 0, 0)),
      },
      delayedBackdropFromScanNotes: true,
    });
    expect(dto.delayedBackdrop).toBe(true);
  });

  it("adds weak session coverage warning flag from scan notes", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 8, 0, 0)),
      },
      scanSessionCoverage: {
        expectedSessionDate: "2026-05-25",
        universeScanned: 100,
        tradabilityEvaluated: 100,
        tradabilityPassed: 20,
        staleSessionCount: 50,
        staleSessionFrac: 0.5,
        sessionAlignedCount: 50,
        sessionAlignedFrac: 0.5,
        weakCoverage: true,
        headline: "Weak session coverage",
        operatorWarning:
          "Data coverage is weak for the expected session. Scanner result may be incomplete because many symbols are stale.",
      },
    });
    expect(dto.scanSessionCoverage?.weakCoverage).toBe(true);
    expect(dto.staleFlags.some((f) => f.code === "scan_weak_session_coverage")).toBe(
      true
    );
    expect(dto.staleFlags.find((f) => f.code === "scan_weak_session_coverage")?.severity).toBe(
      "warning"
    );
  });

  it("handles missing scan run with null scanRunAt", () => {
    const dto = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 10)),
        latestScanRunAt: null,
      },
    });
    expect(dto.scanRunAt).toBeNull();
    expect(dto.scanSessionCoverage).toBeNull();
  });
});
