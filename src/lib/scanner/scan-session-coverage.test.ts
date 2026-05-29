import { describe, expect, it } from "vitest";
import { TRADABILITY_REASON } from "@/lib/scanner/tradability-constants";
import {
  computeScanSessionCoverage,
  SCAN_SESSION_COVERAGE_WEAK_STALE_FRAC,
  symbolIdsEligibleForGate2,
} from "./scan-session-coverage";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("computeScanSessionCoverage", () => {
  const session = utc(2026, 5, 25);

  it("marks weak coverage when stale fraction exceeds threshold", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      result: {
        passed: false,
        reasons:
          i < 4
            ? [TRADABILITY_REASON.STALE_DATA]
            : [TRADABILITY_REASON.VOLUME_20D],
      },
    }));
    const cov = computeScanSessionCoverage({
      expectedLatestSession: session,
      universeScanned: 10,
      tradabilityItems: items,
      weakStaleFracThreshold: 0.35,
    });
    expect(cov.staleSessionCount).toBe(4);
    expect(cov.staleSessionFrac).toBe(0.4);
    expect(cov.weakCoverage).toBe(true);
    expect(cov.operatorWarning).toMatch(/weak for the expected session/i);
    expect(cov.operatorWarning).toMatch(/incomplete/i);
  });

  it("does not mark weak coverage when stale fraction is below threshold", () => {
    const items = [
      { result: { passed: true, reasons: [] as string[] } },
      { result: { passed: false, reasons: [TRADABILITY_REASON.STALE_DATA] } },
      { result: { passed: true, reasons: [] as string[] } },
      { result: { passed: true, reasons: [] as string[] } },
    ];
    const cov = computeScanSessionCoverage({
      expectedLatestSession: session,
      universeScanned: 4,
      tradabilityItems: items,
      weakStaleFracThreshold: 0.35,
    });
    expect(cov.staleSessionFrac).toBe(0.25);
    expect(cov.weakCoverage).toBe(false);
    expect(cov.operatorWarning).toBeNull();
  });

  it("skips weak heuristic for tiny universes", () => {
    const items = [
      { result: { passed: false, reasons: [TRADABILITY_REASON.STALE_DATA] } },
      { result: { passed: false, reasons: [TRADABILITY_REASON.STALE_DATA] } },
    ];
    const cov = computeScanSessionCoverage({
      expectedLatestSession: session,
      universeScanned: 2,
      tradabilityItems: items,
      minUniverseForWeak: 5,
    });
    expect(cov.staleSessionFrac).toBe(1);
    expect(cov.weakCoverage).toBe(false);
  });

  it("exports default weak threshold at 35%", () => {
    expect(SCAN_SESSION_COVERAGE_WEAK_STALE_FRAC).toBe(0.35);
  });
});

describe("symbolIdsEligibleForGate2", () => {
  it("excludes stale symbols so they never reach Gate 2", () => {
    const ids = symbolIdsEligibleForGate2([
      { symbolId: "a", result: { passed: true, reasons: [] } },
      {
        symbolId: "b",
        result: { passed: false, reasons: [TRADABILITY_REASON.STALE_DATA] },
      },
      { symbolId: "c", result: { passed: true, reasons: [] } },
    ]);
    expect(ids).toEqual(["a", "c"]);
  });
});
