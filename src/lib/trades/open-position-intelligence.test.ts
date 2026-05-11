import { describe, expect, it } from "vitest";
import {
  classifyStopPriceBand,
  computePlannedCapitalAtRisk,
  evaluateSetupStructureHints,
  NEAR_STOP_CUSHION_PCT,
  resolveEodReviewSurface,
} from "./open-position-intelligence";

describe("computePlannedCapitalAtRisk", () => {
  it("computes LONG risk as abs(entry-stop)*qty", () => {
    expect(
      computePlannedCapitalAtRisk({
        direction: "LONG",
        entryPrice: 100,
        stopLoss: 94,
        quantity: 10,
        stopValidity: "valid",
      })
    ).toBe(60);
  });

  it("computes SHORT risk as abs(stop-entry)*qty", () => {
    expect(
      computePlannedCapitalAtRisk({
        direction: "SHORT",
        entryPrice: 100,
        stopLoss: 106,
        quantity: 5,
        stopValidity: "valid",
      })
    ).toBe(30);
  });

  it("returns null when stop invalid or missing", () => {
    expect(
      computePlannedCapitalAtRisk({
        direction: "LONG",
        entryPrice: 100,
        stopLoss: 110,
        quantity: 10,
        stopValidity: "invalid",
      })
    ).toBeNull();
    expect(
      computePlannedCapitalAtRisk({
        direction: "LONG",
        entryPrice: 100,
        stopLoss: null,
        quantity: 10,
        stopValidity: "missing",
      })
    ).toBeNull();
  });
});

describe("classifyStopPriceBand", () => {
  it("LONG breached when distanceToStop negative", () => {
    expect(
      classifyStopPriceBand({
        direction: "LONG",
        entryPrice: 100,
        distanceToStop: -2,
        stopValidity: "valid",
      }).band
    ).toBe("breached");
  });

  it("LONG tight when cushion pct below threshold", () => {
    const r = classifyStopPriceBand({
      direction: "LONG",
      entryPrice: 100,
      distanceToStop: 1,
      stopValidity: "valid",
    });
    expect(r.band).toBe("tight");
    expect(r.cushionPctOfEntry).toBeLessThan(NEAR_STOP_CUSHION_PCT);
  });

  it("LONG comfortable when cushion sufficiently wide", () => {
    expect(
      classifyStopPriceBand({
        direction: "LONG",
        entryPrice: 100,
        distanceToStop: 5,
        stopValidity: "valid",
      }).band
    ).toBe("comfortable");
  });
});

describe("evaluateSetupStructureHints", () => {
  const setup = {
    breakoutLevel: 100,
    pullbackZoneLow: 96,
    pullbackZoneHigh: 99,
  };

  it("flags failed breakout when close under anchor", () => {
    const hints = evaluateSetupStructureHints({
      direction: "LONG",
      close: 97,
      setup,
    });
    expect(hints).toContain("failed_breakout_hold");
  });

  it("returns empty for SHORT (geometry not applied)", () => {
    expect(
      evaluateSetupStructureHints({
        direction: "SHORT",
        close: 110,
        setup,
      })
    ).toEqual([]);
  });
});

describe("resolveEodReviewSurface", () => {
  it("prioritizes stop breach over review logging", () => {
    expect(
      resolveEodReviewSurface({
        stopBand: "breached",
        staleVsBenchmark: false,
        structureHints: [],
        healthLogStress: false,
        reviewedToday: true,
      })
    ).toBe("stop_violated");
  });

  it("flags stale bar before generic review needed", () => {
    expect(
      resolveEodReviewSurface({
        stopBand: "comfortable",
        staleVsBenchmark: true,
        structureHints: [],
        healthLogStress: false,
        reviewedToday: true,
      })
    ).toBe("stale_bar_review");
  });

  it("needs review when not logged today and otherwise calm", () => {
    expect(
      resolveEodReviewSurface({
        stopBand: "comfortable",
        staleVsBenchmark: false,
        structureHints: [],
        healthLogStress: false,
        reviewedToday: false,
      })
    ).toBe("review_needed");
  });
});
