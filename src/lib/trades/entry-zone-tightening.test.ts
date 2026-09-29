import { describe, expect, it } from "vitest";
import { tightenEntryZone } from "./entry-zone-tightening";

/**
 * The midpoint levels this file used to test were retired in #17; the order
 * ticket reads the trade suggestion (see order-ticket-prefill.test.ts). Only the
 * zone tightening the suggestion builder reuses remains.
 */
describe("tightenEntryZone", () => {
  it("tightens a zone much wider than the last session's true range around the nearer boundary", () => {
    // True range 100.5 − 99.5 = 1.0; width 10 > 1.5 × 1.0, so it tightens.
    // Close 100 sits on the high boundary: ±0.5 × 1.0 around 100 → [99.5, 100.5],
    // kept inside the original zone → [99.5, 100].
    expect(tightenEntryZone({ low: 90, high: 100 }, { high: 100.5, low: 99.5, close: 100 })).toEqual({
      low: 99.5,
      high: 100,
    });
  });

  it("tightens around the low boundary when the close is nearer it", () => {
    // Close 91 is 1 from 90 and 9 from 100 → around 90: [89.5, 90.5] ∩ [90, 100] = [90, 90.5].
    expect(tightenEntryZone({ low: 90, high: 100 }, { high: 91.5, low: 90.5, close: 91 })).toEqual({
      low: 90,
      high: 90.5,
    });
  });

  it("keeps a zone that is already narrow relative to the true range (width 1 ≤ 1.5)", () => {
    expect(tightenEntryZone({ low: 99, high: 100 }, { high: 100.5, low: 99.5, close: 100 })).toEqual({
      low: 99,
      high: 100,
    });
  });

  it("keeps the zone when the last session had no range", () => {
    expect(tightenEntryZone({ low: 90, high: 100 }, { high: 100, low: 100, close: 100 })).toEqual({
      low: 90,
      high: 100,
    });
  });
});
