import { describe, expect, it } from "vitest";
import {
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
