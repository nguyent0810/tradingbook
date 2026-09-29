import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  buildTradeSuggestion,
  type TradeSuggestion,
  type TradeSuggestionInput,
  type TradeSuggestionResult,
} from "./trade-suggestion";

/**
 * Fixture: 70 quiet daily bars (index 0..69), each open = close = 20.00,
 * high 20.20, low 19.20 — so every true range is exactly 1.00 kVND and ATR14
 * is 1.00. One spike bar at index 39 (30 sessions before the setup bar) has a
 * high of 23.00: it is a pivot high and the 60-session high, i.e. the only
 * resistance above the entry zone. The flat 20.20 highs are the 20-session high
 * but sit at the entry top, not above it.
 *
 * The setup bar is index 69, close 20.00. On HOSE that close is the next
 * session's reference: floor 20 × 0.93 = 18.60, ceiling 20 × 1.07 = 21.40, and
 * the tick at 10.000–49.950 đ is 50 đ = 0.05 kVND.
 */
const SETUP_IDX = 69;

function day(i: number): Date {
  return new Date(Date.UTC(2026, 5, 1) + i * 86_400_000);
}

type Level = { close: number; high: number; low: number; spike: number };
const TWENTY: Level = { close: 20, high: 20.2, low: 19.2, spike: 23 };

function bars(count = SETUP_IDX + 1, lvl: Level = TWENTY): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  for (let i = 0; i < count; i++) {
    const high = i === SETUP_IDX - 30 ? lvl.spike : lvl.high;
    out.push({ date: day(i), open: lvl.close, high, low: lvl.low, close: lvl.close, volume: 1_000_000 });
  }
  return out;
}

function input(over: Partial<TradeSuggestionInput> = {}, setupOver: Partial<TradeSuggestionInput["setup"]> = {}): TradeSuggestionInput {
  return {
    setup: {
      pullbackZoneLow: 19.6,
      pullbackZoneHigh: 20.2,
      stopLevel: 18.9,
      barDate: day(SETUP_IDX),
      ...setupOver,
    },
    bars: bars(),
    exchange: "HOSE",
    prospectiveN: 7,
    ...over,
  };
}

function ok(result: TradeSuggestionResult): TradeSuggestion {
  if (!result.ok) throw new Error(`expected a suggestion, got ${result.reason}: ${result.detail}`);
  return result.suggestion;
}

describe("buildTradeSuggestion — worked HOSE example", () => {
  const s = ok(buildTradeSuggestion(input()));

  it("keeps an on-tick entry zone that sits inside the band as-is", () => {
    expect(s.entryZone).toEqual({ low: 19.6, high: 20.2 });
  });

  it("bounds the stop zone by the structural stop and the minimum feasible stop", () => {
    // Min feasible stop is measured from the LOWEST fill (19.60), so every fill
    // in the zone clears it. Floors as a fraction of 19.60:
    //   tick 2 × 0.05 / 19.60 = 0.0051, fee 0.004, volatility 1.00 / 19.60 = 0.0510
    // → volatility binds: 19.60 − 1.00 = 18.60 (already on tick).
    // Structural 18.90 is TIGHTER than that, so the zone is 18.60–18.90.
    expect(s.stopZone).toEqual({ structural: 18.9, minFeasible: 18.6, low: 18.6, high: 18.9 });
  });

  it("measures R from the worst fill to the lowest stop, gross and net of costs", () => {
    // gross = 20.20 − 18.60 = 1.60
    // net adds 0.15% brokerage on the buy (20.20 × 0.0015 = 0.0303) and
    // 0.15% brokerage + 0.1% tax on the sell (18.60 × 0.0025 = 0.0465):
    //   1.60 + 0.0303 + 0.0465 = 1.6768
    expect(s.r.perShareGross).toBeCloseTo(1.6, 9);
    expect(s.r.perShareNet).toBeCloseTo(1.6768, 9);
  });

  it("places 1R/2R/3R where the NET gain is k × net R, rounded up to the tick", () => {
    // Net gain at P = P × (1 − 0.0025) − 20.20 × 1.0015 = 0.9975 P − 20.2303.
    // Set equal to k × 1.6768:
    //   1R: (20.2303 + 1.6768) / 0.9975 = 21.9071 / 0.9975 = 21.9620 → 22.00
    //   2R: (20.2303 + 3.3536) / 0.9975 = 23.5839 / 0.9975 = 23.6430 → 23.65
    //   3R: (20.2303 + 5.0304) / 0.9975 = 25.2607 / 0.9975 = 25.3240 → 25.35
    expect(s.targets.map((t) => [t.r, t.price])).toEqual([
      [1, 22],
      [2, 23.65],
      [3, 25.35],
    ]);
  });

  it("notes the nearest resistance and flags targets that sit above it", () => {
    // Only resistance above the entry top is the 23.00 spike: above 1R (22.00),
    // below 2R (23.65) and 3R (25.35).
    expect(s.targets.map((t) => [t.r, t.nearestResistance, t.resistanceBelow])).toEqual([
      [1, 23, false],
      [2, 23, true],
      [3, 23, true],
    ]);
  });

  it("stamps the as-of session, the exchange and the evidence status", () => {
    expect(s.asOfSession).toBe("2026-08-09"); // 2026-06-01 + 69 days
    expect(s.setupSession).toBe("2026-08-09");
    expect(s.sessionsSinceSetup).toBe(0);
    expect(s.exchange).toBe("HOSE");
    expect(s.exchangeAssumed).toBe(false);
    expect(s.evidence).toEqual({ status: "UNVALIDATED", prospectiveN: 7, checkpointN: 100 });
  });
});

describe("buildTradeSuggestion — tick snapping per exchange", () => {
  it("snaps the entry zone to the nearest tick of the exchange", () => {
    // HOSE 50 đ: 19.62 → 19.60, 20.23 → 20.25. HNX 100 đ: 19.62 → 19.60, 20.23 → 20.20.
    const zone = { pullbackZoneLow: 19.62, pullbackZoneHigh: 20.23 };
    expect(ok(buildTradeSuggestion(input({}, zone))).entryZone).toEqual({ low: 19.6, high: 20.25 });
    expect(ok(buildTradeSuggestion(input({ exchange: "HNX" }, zone))).entryZone).toEqual({
      low: 19.6,
      high: 20.2,
    });
  });

  it("snaps the structural stop DOWN, so rounding never tightens it", () => {
    // 18.97 → HOSE 18.95 (nearest would also be 18.95), HNX 18.90 (nearest would be 19.00).
    expect(ok(buildTradeSuggestion(input({}, { stopLevel: 18.97 }))).stopZone.structural).toBe(18.95);
    expect(
      ok(buildTradeSuggestion(input({ exchange: "HNX" }, { stopLevel: 18.97 }))).stopZone.structural
    ).toBe(18.9);
  });
});

describe("buildTradeSuggestion — tick brackets through the entry point", () => {
  it("HOSE below 10.000 đ quotes in 10 đ", () => {
    // Close 8.00 (TR 0.40, zone width 0.24 → no tightening; band 7.44–8.56).
    // 7.834 → 7.83, 8.076 → 8.08; stop 7.555 → down to 7.55.
    const s = ok(
      buildTradeSuggestion(
        input(
          { bars: bars(SETUP_IDX + 1, { close: 8, high: 8.08, low: 7.68, spike: 9.2 }) },
          { pullbackZoneLow: 7.834, pullbackZoneHigh: 8.076, stopLevel: 7.555 }
        )
      )
    );
    expect(s.entryZone).toEqual({ low: 7.83, high: 8.08 });
    expect(s.stopZone.structural).toBe(7.55);
  });

  it("HOSE at 50.000 đ and above quotes in 100 đ", () => {
    // Close 60.00 (TR 3.00, zone width 1.72 → no tightening; band 55.80–64.20).
    // 58.74 → 58.70, 60.46 → 60.50; stop 56.97 → down to 56.90.
    const s = ok(
      buildTradeSuggestion(
        input(
          { bars: bars(SETUP_IDX + 1, { close: 60, high: 60.6, low: 57.6, spike: 69 }) },
          { pullbackZoneLow: 58.74, pullbackZoneHigh: 60.46, stopLevel: 56.97 }
        )
      )
    );
    expect(s.entryZone).toEqual({ low: 58.7, high: 60.5 });
    expect(s.stopZone.structural).toBe(56.9);
  });

  it("UPCOM quotes in 100 đ at any price and has a ±15% band", () => {
    // 19.62 → 19.60, 20.23 → 20.20; stop 18.97 → down to 18.90.
    const s = ok(
      buildTradeSuggestion(
        input({ exchange: "UPCOM" }, { pullbackZoneLow: 19.62, pullbackZoneHigh: 20.23, stopLevel: 18.97 })
      )
    );
    expect(s.entryZone).toEqual({ low: 19.6, high: 20.2 });
    expect(s.stopZone.structural).toBe(18.9);
    // Ceiling 20 × 1.15 = 23.00: 21.50–22.90 stands as-is on UPCOM, while on
    // HOSE (ceiling 21.40) the same zone is outside the band.
    const wide = { pullbackZoneLow: 21.5, pullbackZoneHigh: 22.9 };
    expect(ok(buildTradeSuggestion(input({ exchange: "UPCOM" }, wide))).entryZone).toEqual({
      low: 21.5,
      high: 22.9,
    });
    const hose = buildTradeSuggestion(input({}, wide));
    expect(hose.ok ? "ok" : hose.reason).toBe("ZONE_OUTSIDE_BAND");
  });
});

describe("buildTradeSuggestion — next-session band", () => {
  const above = { pullbackZoneLow: 21.0, pullbackZoneHigh: 21.8 };

  it("clips the entry zone to the HOSE ceiling (20 × 1.07 = 21.40)", () => {
    const s = ok(buildTradeSuggestion(input({}, above)));
    expect(s.entryZone).toEqual({ low: 21.0, high: 21.4 });
    // R is measured from the CLIPPED top: the structural 18.90 is looser than
    // the min feasible 21.00 − ATR 1.00 = 20.00, so R = 21.40 − 18.90 = 2.50.
    expect(s.stopZone).toEqual({ structural: 18.9, minFeasible: 20, low: 18.9, high: 20 });
    expect(s.r.perShareGross).toBeCloseTo(2.5, 9);
  });

  it("uses the exchange's own band: HNX ±10% leaves 21.00–21.80 alone (ceiling 22.00)", () => {
    const s = ok(buildTradeSuggestion(input({ exchange: "HNX" }, above)));
    expect(s.entryZone).toEqual({ low: 21.0, high: 21.8 });
    expect(s.r.perShareGross).toBeCloseTo(2.9, 9); // 21.80 − 18.90
  });

  it("clips the entry zone to the HOSE floor (20 × 0.93 = 18.60)", () => {
    const s = ok(buildTradeSuggestion(input({}, { pullbackZoneLow: 18.4, pullbackZoneHigh: 19.0, stopLevel: 18.0 })));
    expect(s.entryZone).toEqual({ low: 18.6, high: 19.0 });
  });

  it("builds the band from the LATEST session's close when the setup is older", () => {
    // One more session after the setup closes at 21.00. HOSE band from 21.00:
    //   floor 21 × 0.93 = 19.53 → up to the 50 đ tick = 19.55
    //   ceiling 21 × 1.07 = 22.47 → down to the tick = 22.45
    // so 21.00–21.80 is no longer clipped at the setup-session ceiling 21.40.
    // Structure (stop, ATR, resistance) still comes from bars through the setup:
    // min feasible 21.00 − ATR 1.00 = 20.00, R = 21.80 − 18.90 = 2.90.
    const later = [
      ...bars(),
      { date: day(SETUP_IDX + 1), open: 20.5, high: 21.2, low: 20.4, close: 21, volume: 1 },
    ];
    const s = ok(buildTradeSuggestion(input({ bars: later }, above)));
    expect(s.entryZone).toEqual({ low: 21.0, high: 21.8 });
    expect(s.stopZone).toEqual({ structural: 18.9, minFeasible: 20, low: 18.9, high: 20 });
    expect(s.r.perShareGross).toBeCloseTo(2.9, 9);
    expect(s.asOfSession).toBe("2026-08-10");
    expect(s.setupSession).toBe("2026-08-09");
    expect(s.sessionsSinceSetup).toBe(1);
  });

  it("uses the latest band for the outside-band check too", () => {
    // Latest close 21.00: floor 19.55, so a 18.40–19.00 zone is outside it,
    // though it overlapped the setup-session band (floor 18.60).
    const later = [
      ...bars(),
      { date: day(SETUP_IDX + 1), open: 20.5, high: 21.2, low: 20.4, close: 21, volume: 1 },
    ];
    const r = buildTradeSuggestion(
      input({ bars: later }, { pullbackZoneLow: 18.4, pullbackZoneHigh: 19.0, stopLevel: 18.0 })
    );
    expect(r.ok ? "ok" : r.reason).toBe("ZONE_OUTSIDE_BAND");
  });
});

describe("buildTradeSuggestion — exchange and evidence", () => {
  it("assumes HOSE when the symbol has no exchange on record, and says so", () => {
    const s = ok(buildTradeSuggestion(input({ exchange: null })));
    expect(s.exchange).toBe("HOSE");
    expect(s.exchangeAssumed).toBe(true);
  });

  it("carries an unknown prospective count as null, never 0", () => {
    const s = ok(buildTradeSuggestion(input({ prospectiveN: null })));
    expect(s.evidence).toEqual({ status: "UNVALIDATED", prospectiveN: null, checkpointN: 100 });
  });

  it("leaves reasons, risks and size to later slices", () => {
    const s = ok(buildTradeSuggestion(input()));
    expect(s.reasons).toEqual([]);
    expect(s.risks).toEqual([]);
    expect(s.size).toBeNull();
  });
});

describe("buildTradeSuggestion — cannot compute", () => {
  function failure(result: TradeSuggestionResult) {
    if (result.ok) throw new Error("expected a cannot-compute result");
    expect(result.detail).not.toMatch(/NaN|undefined/);
    expect(result.detail.length).toBeGreaterThan(0);
    return result.reason;
  }

  it("too few bars: 64 sessions through the setup, 65 needed", () => {
    expect(failure(buildTradeSuggestion(input({ bars: bars(64) }, { barDate: day(63) })))).toBe(
      "TOO_FEW_BARS"
    );
  });

  it("no bar for the setup session", () => {
    expect(failure(buildTradeSuggestion(input({}, { barDate: day(SETUP_IDX + 5) })))).toBe(
      "NO_SESSION_BAR"
    );
  });

  it("degenerate zone: low above high, or not a price", () => {
    expect(
      failure(buildTradeSuggestion(input({}, { pullbackZoneLow: 20.2, pullbackZoneHigh: 19.6 })))
    ).toBe("DEGENERATE_ZONE");
    expect(failure(buildTradeSuggestion(input({}, { pullbackZoneLow: Number.NaN })))).toBe(
      "DEGENERATE_ZONE"
    );
    expect(failure(buildTradeSuggestion(input({}, { pullbackZoneHigh: 0 })))).toBe(
      "DEGENERATE_ZONE"
    );
  });

  it("zone entirely outside the next-session band (HOSE 18.60–21.40)", () => {
    expect(
      failure(buildTradeSuggestion(input({}, { pullbackZoneLow: 21.5, pullbackZoneHigh: 22.0 })))
    ).toBe("ZONE_OUTSIDE_BAND");
    expect(
      failure(
        buildTradeSuggestion(
          input({}, { pullbackZoneLow: 17.0, pullbackZoneHigh: 18.4, stopLevel: 16.0 })
        )
      )
    ).toBe("ZONE_OUTSIDE_BAND");
  });

  it("stop at or above the entry zone", () => {
    expect(failure(buildTradeSuggestion(input({}, { stopLevel: 19.6 })))).toBe(
      "STOP_NOT_BELOW_ENTRY"
    );
    expect(failure(buildTradeSuggestion(input({}, { stopLevel: 20.5 })))).toBe(
      "STOP_NOT_BELOW_ENTRY"
    );
    expect(failure(buildTradeSuggestion(input({}, { stopLevel: 0 })))).toBe(
      "STOP_NOT_BELOW_ENTRY"
    );
  });

  it("a last close with no quotable band (HOSE 10 đ is a single tick) or not a price", () => {
    for (const close of [0.01, 0]) {
      const b = bars();
      b[SETUP_IDX] = { ...b[SETUP_IDX]!, close };
      expect(failure(buildTradeSuggestion(input({ bars: b })))).toBe("NO_REFERENCE_PRICE");
    }
  });
});
