import { describe, expect, it } from "vitest";
import {
  computeOpenPhase2Metrics,
  computeDisplayHoldingDaysUtc,
  equityBarStaleVsBenchmark,
  utcCalendarDayMs,
} from "./position-health";

describe("utcCalendarDayMs", () => {
  it("normalizes to UTC midnight anchor", () => {
    const d = new Date("2024-06-15T22:00:00.000Z");
    expect(utcCalendarDayMs(d)).toBe(Date.UTC(2024, 5, 15));
  });
});

describe("equityBarStaleVsBenchmark", () => {
  it("returns unknown when benchmark missing", () => {
    expect(
      equityBarStaleVsBenchmark(new Date("2024-01-02T00:00:00.000Z"), null)
    ).toBe("unknown");
  });

  it("returns true when equity bar date is before index session", () => {
    const idx = new Date("2024-01-05T00:00:00.000Z");
    const bar = new Date("2024-01-04T12:00:00.000Z");
    expect(equityBarStaleVsBenchmark(bar, idx)).toBe(true);
  });

  it("returns false when same UTC calendar day as index", () => {
    const idx = new Date("2024-01-05T00:00:00.000Z");
    const bar = new Date("2024-01-05T23:59:59.000Z");
    expect(equityBarStaleVsBenchmark(bar, idx)).toBe(false);
  });
});

describe("computeDisplayHoldingDaysUtc", () => {
  it("OPEN uses entry through today", () => {
    const entry = new Date("2024-01-01T10:00:00.000Z");
    const now = new Date("2024-01-03T10:00:00.000Z");
    expect(
      computeDisplayHoldingDaysUtc({
        status: "OPEN",
        entryDate: entry,
        exitDate: null,
        now,
      })
    ).toBe(2);
  });

  it("CLOSED uses exitDate when present", () => {
    const entry = new Date("2024-01-01T10:00:00.000Z");
    const exit = new Date("2024-01-02T15:00:00.000Z");
    const now = new Date("2025-01-01T10:00:00.000Z");
    expect(
      computeDisplayHoldingDaysUtc({
        status: "CLOSED",
        entryDate: entry,
        exitDate: exit,
        now,
      })
    ).toBe(1);
  });

  it("CLOSED without exit returns null", () => {
    expect(
      computeDisplayHoldingDaysUtc({
        status: "CLOSED",
        entryDate: new Date("2024-01-01T00:00:00.000Z"),
        exitDate: null,
        now: new Date("2024-01-05T00:00:00.000Z"),
      })
    ).toBeNull();
  });
});

describe("computeOpenPhase2Metrics", () => {
  it("computes LONG metrics with valid stop and TP", () => {
    const got = computeOpenPhase2Metrics({
      direction: "LONG",
      entryPrice: 100,
      latestClose: 110,
      stopLoss: 90,
      takeProfit: 120,
    });
    expect(got.stopValidity).toBe("valid");
    expect(got.rMultiple).toBeCloseTo(1);
    expect(got.distanceToStop).toBeCloseTo(20);
    expect(got.distanceToTakeProfit).toBeCloseTo(10);
  });

  it("computes SHORT metrics with valid stop and TP", () => {
    const got = computeOpenPhase2Metrics({
      direction: "SHORT",
      entryPrice: 100,
      latestClose: 92,
      stopLoss: 110,
      takeProfit: 85,
    });
    expect(got.stopValidity).toBe("valid");
    expect(got.rMultiple).toBeCloseTo(0.8);
    expect(got.distanceToStop).toBeCloseTo(18);
    expect(got.distanceToTakeProfit).toBeCloseTo(7);
  });

  it("returns null R and stop-distance when stop is missing", () => {
    const got = computeOpenPhase2Metrics({
      direction: "LONG",
      entryPrice: 100,
      latestClose: 103,
      stopLoss: null,
      takeProfit: 110,
    });
    expect(got.stopValidity).toBe("missing");
    expect(got.rMultiple).toBeNull();
    expect(got.distanceToStop).toBeNull();
    expect(got.distanceToTakeProfit).toBeCloseTo(7);
  });

  it("marks invalid stop and keeps phase-2 stop metrics null", () => {
    const got = computeOpenPhase2Metrics({
      direction: "LONG",
      entryPrice: 100,
      latestClose: 103,
      stopLoss: 101,
      takeProfit: 110,
    });
    expect(got.stopValidity).toBe("invalid");
    expect(got.rMultiple).toBeNull();
    expect(got.distanceToStop).toBeNull();
  });

  it("returns all derived null when latest close missing", () => {
    const got = computeOpenPhase2Metrics({
      direction: "SHORT",
      entryPrice: 100,
      latestClose: null,
      stopLoss: 105,
      takeProfit: 90,
    });
    expect(got.stopValidity).toBe("valid");
    expect(got.rMultiple).toBeNull();
    expect(got.distanceToStop).toBeNull();
    expect(got.distanceToTakeProfit).toBeNull();
  });
});
