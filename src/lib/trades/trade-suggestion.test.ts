import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import {
  ADV_ADJUSTED_PRICE_CAVEAT,
  BANNED_IMPERATIVE_PATTERNS,
  RISK_COPY,
  SETTLEMENT_BREACH_COPY,
  SETUP_REASON_COPY,
  SIZE_BINDING_CAP_COPY,
  SIZE_ZERO_CAUSE_COPY,
  SIZE_VERDICT_ZERO_COPY,
  SIZE_ZERO_COPY,
  UNMAPPED_REASON_COPY,
  UNMAPPED_REASON_GENERIC_COPY,
} from "./trade-suggestion-copy";
import {
  buildTradeSuggestion,
  type OpenTradeRisk,
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
      tier: "A",
      reasons: [],
      ...setupOver,
    },
    bars: bars(),
    exchange: "HOSE",
    prospectiveN: 7,
    // Quiet defaults: every market fact is benign, so each risk test flips one.
    gate1Level: "PASS",
    expectedSession: day(SETUP_IDX),
    advVnd: 50_000_000_000,
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

  it("leaves size to #15", () => {
    expect(ok(buildTradeSuggestion(input())).size).toBeNull();
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

/**
 * A path the frozen Gate 2 classifier qualifies (same shape as its own test):
 * 70 bars around 200.00, breakout at index 59, a hold and a last bar that
 * trades back into the zone. Last-bar volume decides the tier: 2.0× the
 * median is A, 1.2× is B.
 */
function classifierPath(volLast: number): Gate2BarInput[] {
  const BASE = 200;
  const out: Gate2BarInput[] = [];
  const at = (i: number, open: number, high: number, low: number, close: number, volume: number) =>
    out.push({ date: day(i), open, high, low, close, volume });
  for (let i = 0; i <= 69; i++) {
    if (i < 59) at(i, BASE, BASE, BASE - 1, BASE - 1, 1_000_000);
    else if (i === 59) at(i, BASE, BASE + 2, BASE, BASE + 1, 1_000_000);
    else if (i === 60) at(i, BASE + 1, BASE + 1, BASE - 3, BASE + 0.5, 1_000_000);
    else if (i < 68) at(i, BASE, BASE + 0.6, BASE - 0.2, BASE, 1_000_000);
    else if (i === 68) at(i, BASE, BASE + 0.6, BASE - 0.2, BASE + 0.5, 1_000_000);
    else at(i, BASE + 5, BASE + 7, BASE - 1, BASE + 6, volLast);
  }
  return out;
}

/**
 * Same path, but no low after the breakout goes under the breakout level
 * (200.00): the digestion dip only reaches 200.00, under the breakout-day close
 * 201.00, and the last bar's low touches the zone ceiling at exactly 200.00.
 * Depth is then 0, and the classifier writes its "no material dip" line.
 */
function classifierPathNoDip(volLast: number): Gate2BarInput[] {
  const BASE = 200;
  return classifierPath(volLast).map((b, i) => (i >= 60 ? { ...b, low: BASE } : b));
}

function scannerReasons(volLast: number, path = classifierPath(volLast)): string[] {
  const ev = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
  if (ev.quality === "INVALID") throw new Error(`fixture no longer qualifies: ${ev.reasons.at(-1)}`);
  return ev.reasons;
}

describe("buildTradeSuggestion — reasons in plain Vietnamese", () => {
  it.each([
    ["tier A", 2_000_000],
    ["tier B", 1_200_000],
  ])("every line the classifier emits for a %s setup has copy", (_tier, vol) => {
    // If the scanner starts emitting a line no reason code recognises, it shows
    // up as "unmapped" here and this test fails until copy is written for it.
    const lines = scannerReasons(vol);
    const s = ok(buildTradeSuggestion(input({}, { reasons: lines })));
    expect(s.reasons).toHaveLength(lines.length);
    expect(s.reasons.filter((r) => r.code === "unmapped")).toEqual([]);
    for (const r of s.reasons) {
      expect(r.text, r.code).not.toMatch(/[{}]|NaN|undefined/);
      // Copy is Vietnamese, not the classifier's English.
      expect(r.text, r.code).not.toMatch(/\b(the|breakout level|median|session)\b/i);
    }
  });

  it("the no-dip variant from the real classifier has copy too", () => {
    const lines = scannerReasons(2_000_000, classifierPathNoDip(2_000_000));
    const s = ok(buildTradeSuggestion(input({}, { reasons: lines })));
    expect(s.reasons.map((r) => r.code)).toContain("no_material_dip");
    expect(s.reasons.filter((r) => r.code === "unmapped")).toEqual([]);
  });

  it("keeps the classifier's order and fills in its numbers in vi-VN format", () => {
    const s = ok(
      buildTradeSuggestion(
        input(
          {},
          {
            reasons: [
              "Trend OK for long-bias pullback: close above MA50 and MA20 ≥ MA50.",
              "Fresh breakout: cleared prior resistance 200.00 at session offset 59 (10 bars ago).",
              "Price is interacting with the pullback zone floor–ceiling (194.00–200.00).",
              "Liquidity check passed—volume 2.00× the 20-day median.",
            ],
          }
        )
      )
    );
    expect(s.reasons).toEqual([
      { code: "trend_ok", text: "Xu hướng thuận: giá đóng cửa trên MA50 và MA20 nằm trên MA50." },
      { code: "fresh_breakout", text: "Breakout mới: giá vượt kháng cự 200,00 cách đây 10 phiên." },
      { code: "in_pullback_zone", text: "Giá đang nằm trong vùng pullback 194,00–200,00." },
      { code: "volume_confirmed", text: "Khối lượng phiên quét gấp 2,00 lần trung vị 20 phiên." },
    ]);
  });

  it("maps both depth lines by their exact wording", () => {
    const s = ok(
      buildTradeSuggestion(
        input(
          {},
          {
            reasons: [
              "Pullback depth under the breakout level: 1.50% (within 8%).",
              "No dip materially below the breakout level—depth OK.",
            ],
          }
        )
      )
    );
    expect(s.reasons.map((r) => r.code)).toEqual(["pullback_depth_ok", "no_material_dip"]);
    expect(s.reasons[0]!.text).toBe("Nhịp pullback sâu 1,50% dưới mức breakout, trong giới hạn 8%.");
  });

  it("an unrecognised line (e.g. from an older scanner) is kept, marked unmapped", () => {
    const s = ok(buildTradeSuggestion(input({}, { reasons: ["Some legacy line."] })));
    expect(s.reasons).toEqual([
      { code: "unmapped", text: "Lý do từ bộ quét, chưa có bản tiếng Việt: Some legacy line." },
    ]);
  });

  it("an unrecognised line with banned wording is not echoed: a generic line replaces it", () => {
    const s = ok(
      buildTradeSuggestion(input({}, { reasons: ["Strong trend — buy the dip.", "MUA NGAY"] }))
    );
    expect(s.reasons).toEqual([
      { code: "unmapped", text: UNMAPPED_REASON_GENERIC_COPY },
      { code: "unmapped", text: UNMAPPED_REASON_GENERIC_COPY },
    ]);
  });
});

describe("copy tables — descriptive, never imperative (ADR 0003)", () => {
  const copy = [
    ...Object.entries(SETUP_REASON_COPY),
    ...Object.entries(RISK_COPY),
    ["unmapped", UNMAPPED_REASON_COPY],
    ["unmapped generic", UNMAPPED_REASON_GENERIC_COPY],
    ["settlement breach", SETTLEMENT_BREACH_COPY],
    ["adv caveat", ADV_ADJUSTED_PRICE_CAVEAT],
    ...Object.entries(SIZE_ZERO_CAUSE_COPY),
    ...Object.entries(SIZE_BINDING_CAP_COPY),
    ["size zero", SIZE_ZERO_COPY],
    ["size verdict zero", SIZE_VERDICT_ZERO_COPY],
  ];

  it("the banned list catches the wording audit F08 flagged", () => {
    for (const bad of ["MUA", "VÀO NGAY", "Mua ngay khi giá về vùng", "Hãy đặt stop", "Nên chốt lời", "BÁN"]) {
      expect(BANNED_IMPERATIVE_PATTERNS.some((p) => p.test(bad)), bad).toBe(true);
    }
    // Descriptive uses of the same roots are allowed.
    for (const fine of ["cổ phiếu khớp hôm nay", "trước khi bán được", "bối cảnh bất lợi cho setup mua"]) {
      expect(BANNED_IMPERATIVE_PATTERNS.some((p) => p.test(fine)), fine).toBe(false);
    }
  });

  it.each(copy)("%s contains no banned word", (_code, text) => {
    for (const p of BANNED_IMPERATIVE_PATTERNS) expect(text).not.toMatch(p);
  });
});

describe("buildTradeSuggestion — risks", () => {
  const codes = (s: TradeSuggestion) => s.risks.map((r) => r.code);
  const risk = (s: TradeSuggestion, code: string) => s.risks.find((r) => r.code === code);
  const base = ok(buildTradeSuggestion(input()));
  /**
   * A wide structural stop, 15.00 on HOSE: no floor path in three sessions
   * reaches it (see the limit-down run case), and it is looser than the
   * minimum feasible 18.60, so it is not "too tight" either.
   */
  const wide = ok(buildTradeSuggestion(input({}, { stopLevel: 15 })));

  it("the worked HOSE example carries exactly these risks", () => {
    // Everything else in the default input is benign (PASS, tier A, fresh data,
    // 50 tỷ ADV, exchange on record).
    expect(codes(base)).toEqual([
      "limit_down_run",
      "stop_too_tight",
      "resistance_below_2r",
      "settlement_lockup",
    ]);
  });

  describe("market regime (Gate 1)", () => {
    it("FAIL is high, WARNING is warn, unknown is warn", () => {
      const at = (gate1Level: "FAIL" | "WARNING" | null) =>
        ok(buildTradeSuggestion(input({ gate1Level }))).risks[0];
      expect(at("FAIL")).toMatchObject({ code: "regime_fail", severity: "high" });
      expect(at("WARNING")).toMatchObject({ code: "regime_warning", severity: "warn" });
      expect(at(null)).toMatchObject({ code: "regime_unknown", severity: "warn" });
    });

    it("PASS raises nothing", () => {
      expect(codes(base).filter((c) => c.startsWith("regime_"))).toEqual([]);
    });
  });

  describe("tier B", () => {
    it("fires as info for a tier B setup", () => {
      const s = ok(buildTradeSuggestion(input({}, { tier: "B" })));
      expect(risk(s, "tier_b")?.severity).toBe("info");
    });
    it("does not fire for tier A", () => {
      expect(risk(base, "tier_b")).toBeUndefined();
    });
    it("an unknown tier (a quality that is neither A nor B) is not read as B", () => {
      expect(risk(ok(buildTradeSuggestion(input({}, { tier: null }))), "tier_b")).toBeUndefined();
    });
  });

  describe("gap through the stop", () => {
    it("fires, high, when one limit-down open from the worst fill lands below the stop", () => {
      // HNX ±10%: zone 19.60–20.20, stop zone 18.60–18.90 (min feasible 19.60 − ATR 1.00).
      // Floor from 20.20: 20.20 × 0.90 = 18.18 → up to the 100 đ tick = 18.20 < 18.60.
      // Loss 20.20 − 18.20 = 2.00/cp; R = 20.20 − 18.60 = 1.60 → 2.00 / 1.60 = 1.25R.
      const s = ok(buildTradeSuggestion(input({ exchange: "HNX" })));
      expect(risk(s, "gap_through_stop")).toEqual({
        code: "gap_through_stop",
        severity: "high",
        text: "Gap xuyên stop: một phiên mở giảm sàn (10%) từ 20,20 về 18,20, dưới đáy vùng SL 18,60. Lỗ khi đó 2,00/cp, bằng 1,25R.",
      });
    });

    it("does not fire when the floor stays above the stop (HOSE: 20.20 × 0.93 = 18.786 → 18.80 ≥ 18.60)", () => {
      expect(risk(base, "gap_through_stop")).toBeUndefined();
    });
  });

  describe("limit-down run (N = 3 floor sessions)", () => {
    it("fires with the loss after three HOSE floors from the worst fill", () => {
      // 20.20 → 18.786 → 18.80 → 17.484 → 17.50 → 16.275 → 16.30 (each up to the 50 đ tick).
      // Loss 20.20 − 16.30 = 3.90/cp; 3.90 / 1.60 = 2.4375 → 2,44R.
      expect(risk(base, "limit_down_run")).toEqual({
        code: "limit_down_run",
        severity: "warn",
        text: "Kịch bản sàn liên tiếp: 3 phiên giảm sàn liền từ 20,20 đưa giá về 16,30, dưới vùng SL. Lỗ khi không thoát được 3,90/cp, bằng 2,44R.",
      });
    });

    it("does not fire when three floors (16.30) stay above a 15.00 stop", () => {
      expect(risk(wide, "limit_down_run")).toBeUndefined();
    });
  });

  describe("T+2.5 lockup", () => {
    const lockup =
      "T+2,5: cổ phiếu khớp hôm nay khoảng 2,5 phiên sau mới về tài khoản và mới bán được; trong khoảng đó stop chưa bảo vệ được vị thế.";

    it("is always shown, as info, when the floor path stays above the stop within the lockup", () => {
      // Wide 15.00 stop: two floors from 20.20 are 18.80 → 17.50, both above it.
      expect(risk(wide, "settlement_lockup")).toEqual({
        code: "settlement_lockup",
        severity: "info",
        text: lockup,
      });
    });

    it("rises to warn, with the breach figure, when two floors (17.50) are below the stop (18.60)", () => {
      expect(risk(base, "settlement_lockup")).toEqual({
        code: "settlement_lockup",
        severity: "warn",
        text:
          lockup +
          " Hai phiên giảm sàn từ 20,20 là 17,50, đã dưới vùng SL: giá có thể xuyên stop trước khi bán được.",
      });
    });

    it("the breach sentence does not appear when the floor path stays above the stop", () => {
      expect(risk(wide, "settlement_lockup")?.text).not.toContain("Hai phiên giảm sàn");
    });
  });

  describe("liquidity vs the 20-session average traded value", () => {
    it("fires below 10 tỷ, sized per 100-share lot, with the adjusted-price caveat", () => {
      // 1% of 4.2 tỷ = 42,000,000 đ; one lot at 20.20 = 20.20 × 1000 × 100 = 2,020,000 đ
      // → 42,000,000 / 2,020,000 = 20.79 → 20 lots.
      const s = ok(buildTradeSuggestion(input({ advVnd: 4_200_000_000 })));
      expect(risk(s, "liquidity_thin")).toEqual({
        code: "liquidity_thin",
        severity: "warn",
        text:
          "Giá trị giao dịch bình quân 20 phiên khoảng 4,20 tỷ ₫, dưới mốc 10,00 tỷ ₫: 1% con số đó chỉ bằng khoảng 20 lô 100 cp ở 20,20, thoát vị thế lớn có thể khó, nhất là phiên giảm sàn. " +
          ADV_ADJUSTED_PRICE_CAVEAT,
      });
    });

    it("says 'chưa tới 1 lô' when 1% of the average is less than one lot", () => {
      // 1% of 150 tr = 1,500,000 đ < one lot at 20.20 (2,020,000 đ).
      const s = ok(buildTradeSuggestion(input({ advVnd: 150_000_000 })));
      expect(risk(s, "liquidity_thin")?.text).toContain(
        "khoảng 150,0 tr ₫, dưới mốc 10,00 tỷ ₫: 1% con số đó chỉ bằng chưa tới 1 lô 100 cp ở 20,20"
      );
    });

    it("an unknown average is its own warning, never read as liquid", () => {
      const s = ok(buildTradeSuggestion(input({ advVnd: null })));
      expect(risk(s, "liquidity_unknown")?.severity).toBe("warn");
      expect(risk(s, "liquidity_thin")).toBeUndefined();
    });

    it("does not fire at or above 10 tỷ", () => {
      const s = ok(buildTradeSuggestion(input({ advVnd: 10_000_000_000 })));
      expect(codes(s).filter((c) => c.startsWith("liquidity"))).toEqual([]);
    });
  });

  describe("stale data", () => {
    it("fires when the latest bar is older than the expected session", () => {
      const s = ok(buildTradeSuggestion(input({ expectedSession: day(SETUP_IDX + 1) })));
      expect(risk(s, "stale_data")).toEqual({
        code: "stale_data",
        severity: "warn",
        text: "Nến mới nhất của mã là phiên 09/08/2026, cũ hơn phiên thị trường 10/08/2026: vùng giá và biên độ có thể đã lệch.",
      });
    });

    it("does not fire when the latest bar is the expected session, or none is known", () => {
      expect(risk(base, "stale_data")).toBeUndefined();
      expect(risk(ok(buildTradeSuggestion(input({ expectedSession: null }))), "stale_data")).toBeUndefined();
    });
  });

  describe("stale setup", () => {
    it("fires when bars run past the setup session", () => {
      const later = [
        ...bars(),
        { date: day(SETUP_IDX + 1), open: 20, high: 20.2, low: 19.8, close: 20, volume: 1 },
      ];
      const s = ok(buildTradeSuggestion(input({ bars: later, expectedSession: day(SETUP_IDX + 1) })));
      expect(risk(s, "stale_setup")).toEqual({
        code: "stale_setup",
        severity: "warn",
        text: "Thiết lập từ phiên 09/08/2026, dữ liệu đã có thêm 1 phiên sau đó: cấu trúc chưa được quét lại.",
      });
    });

    it("does not fire when the setup is the latest session", () => {
      expect(risk(base, "stale_setup")).toBeUndefined();
    });
  });

  describe("exchange assumed", () => {
    it("fires when the symbol has no exchange on record", () => {
      expect(risk(ok(buildTradeSuggestion(input({ exchange: null }))), "exchange_assumed")?.severity).toBe("warn");
    });
    it("does not fire when the exchange is on record", () => {
      expect(risk(base, "exchange_assumed")).toBeUndefined();
    });
  });

  describe("stop too tight", () => {
    it("fires when the structural stop (18.90) is tighter than the minimum feasible (18.60)", () => {
      expect(risk(base, "stop_too_tight")).toEqual({
        code: "stop_too_tight",
        severity: "warn",
        text: "Mức vô hiệu theo cấu trúc 18,90 sát hơn mức stop tối thiểu 18,60: nhiễu một phiên có thể chạm tới nó. Vùng SL vì thế kéo xuống 18,60.",
      });
    });
    it("does not fire when the structural stop is the looser one", () => {
      expect(risk(ok(buildTradeSuggestion(input({}, { stopLevel: 18 }))), "stop_too_tight")).toBeUndefined();
    });
  });

  describe("resistance below 2R", () => {
    it("fires when resistance (23.00) sits below the 2R mark (23.65)", () => {
      expect(risk(base, "resistance_below_2r")).toEqual({
        code: "resistance_below_2r",
        severity: "warn",
        text: "Kháng cự 23,00 nằm dưới mốc 2R 23,65: giá có thể gặp cản trước mốc.",
      });
    });
    it("does not fire when the only resistance (a 30.00 spike) is above 2R", () => {
      const s = ok(
        buildTradeSuggestion(input({ bars: bars(SETUP_IDX + 1, { ...TWENTY, spike: 30 }) }))
      );
      expect(risk(s, "resistance_below_2r")).toBeUndefined();
    });
  });

  it("orders risks by severity: high, then warn, then info", () => {
    const s = ok(
      buildTradeSuggestion(input({ gate1Level: "FAIL", exchange: null, advVnd: null }, { tier: "B" }))
    );
    expect(s.risks.map((r) => [r.severity, r.code])).toEqual([
      ["high", "regime_fail"],
      ["warn", "limit_down_run"],
      ["warn", "stop_too_tight"],
      ["warn", "resistance_below_2r"],
      ["warn", "liquidity_unknown"],
      ["warn", "exchange_assumed"],
      ["warn", "settlement_lockup"],
      ["info", "tier_b"],
    ]);
  });
});

/**
 * Size tham khảo (#15). The worked HOSE example above gives entry top 20.20,
 * stop-zone low 18.60 and net R 1.6768 kVND/cp. The Đệm gap is one full band of
 * the exchange below the stop-zone low:
 *   HOSE 18.60 × 7%  = 1.302 → worst case 1.6768 + 1.302 = 2.9788 kVND = 2,978.8 đ/cp
 *   HNX  18.60 × 10% = 1.860 → 3.5368 kVND/cp
 *   UPCOM 18.60 × 15% = 2.790 → 4.4668 kVND/cp
 * With 1 tỷ equity and 1% risk, tier A: budget 10,000,000 đ.
 *   10,000,000 / 2,978.8 = 3,357.05 → 3,357 cp → 3,300 cp on the 100-share lot.
 *   Worst-case loss 3,300 × 2,978.8 = 9,830,040 đ = 0.983004% of equity.
 */
const SIZING: NonNullable<TradeSuggestionInput["sizing"]> = {
  equityVnd: 1_000_000_000,
  riskPerTradePct: 0.01,
  maxPerTradeExposurePct: 1,
  maxPortfolioExposurePct: 1,
  liquidityCapPct: 0.1,
  currentExposureVnd: 0,
  openTrades: [],
  verdictLevel: null,
};

function sized(
  sizing: Partial<NonNullable<TradeSuggestionInput["sizing"]>> = {},
  over: Partial<TradeSuggestionInput> = {},
  setupOver: Partial<TradeSuggestionInput["setup"]> = {}
) {
  const s = ok(buildTradeSuggestion(input({ sizing: { ...SIZING, ...sizing }, ...over }, setupOver)));
  if (!s.size) throw new Error("expected a size");
  return { s, size: s.size };
}

describe("buildTradeSuggestion — size with gap buffer (#15)", () => {
  it("has no size when no sizing inputs were given", () => {
    expect(ok(buildTradeSuggestion(input())).size).toBeNull();
  });

  it("worked HOSE example: 3,300 cp, worst-case loss 9,830,040 đ, 0.983% of equity", () => {
    const { size } = sized();
    expect(size.gapBufferKvnd).toBeCloseTo(1.302, 9);
    expect(size.worstCasePerShareKvnd).toBeCloseTo(2.9788, 9);
    expect(size.shares).toBe(3300);
    expect(size.bindingCap).toBeNull();
    expect(size.worstCaseLossVnd).toBe(9_830_040);
    expect(size.tradeRiskPct).toBeCloseTo(0.983004, 9);
    expect(size.zeroShareReason).toBeNull();
  });

  it("gap buffer per exchange: HNX one 10% band, UPCOM one 15% band", () => {
    // HNX: 10,000,000 / 3,536.8 = 2,827.4 → 2,800 cp. UPCOM: / 4,466.8 = 2,238.7 → 2,200 cp.
    const hnx = sized({}, { exchange: "HNX" }).size;
    expect(hnx.gapBufferKvnd).toBeCloseTo(1.86, 9);
    expect(hnx.shares).toBe(2800);
    const upcom = sized({}, { exchange: "UPCOM" }).size;
    expect(upcom.gapBufferKvnd).toBeCloseTo(2.79, 9);
    expect(upcom.shares).toBe(2200);
  });

  it("tier B sizes at half risk: 5,000,000 / 2,978.8 = 1,678.5 → 1,600 cp", () => {
    const { size } = sized({}, {}, { tier: "B" });
    expect(size.shares).toBe(1600);
    // The effective risk is what the size was built on: 1% × 0.5 = 0.5% → 5,000,000 đ.
    expect(size.riskPerTradePct).toBeCloseTo(0.005, 12);
    expect(size.riskBudgetVnd).toBe(5_000_000);
  });

  it("tier A carries the full setting: 1% → 10,000,000 đ", () => {
    const { size } = sized();
    expect(size.riskPerTradePct).toBeCloseTo(0.01, 12);
    expect(size.riskBudgetVnd).toBe(10_000_000);
  });

  it("a setup with no A/B tier is sized like tier B, never at full risk", () => {
    expect(sized({}, {}, { tier: null }).size.shares).toBe(1600);
  });

  it("rounds down to the lot, never up: 1% of 1,010,000,000 đ = 10,100,000 / 2,978.8 = 3,390.6 → 3,300", () => {
    expect(sized({ equityVnd: 1_010_000_000 }).size.shares).toBe(3300);
  });

  describe("names the binding cap", () => {
    it("per-trade: 5% of 1 tỷ = 50,000,000 / 20,200 = 2,475 → 2,400 cp", () => {
      const { size } = sized({ maxPerTradeExposurePct: 0.05 });
      expect(size.shares).toBe(2400);
      expect(size.bindingCap).toBe("per_trade_exposure");
      // 2,400 × 2,978.8 = 7,149,120 đ
      expect(size.worstCaseLossVnd).toBe(7_149_120);
    });

    it("portfolio: 70% of 1 tỷ − 670,000,000 open = 30,000,000 / 20,200 = 1,485 → 1,400 cp", () => {
      const { size } = sized({ maxPortfolioExposurePct: 0.7, currentExposureVnd: 670_000_000 });
      expect(size.shares).toBe(1400);
      expect(size.bindingCap).toBe("portfolio_exposure");
    });

    it("liquidity: 10% of 500,000,000 ADV = 50,000,000 / 20,200 = 2,475 → 2,400 cp", () => {
      const { size } = sized({}, { advVnd: 500_000_000 });
      expect(size.shares).toBe(2400);
      expect(size.bindingCap).toBe("liquidity");
    });
  });

  describe("a zero-share result is explained, not hidden", () => {
    it("below one lot on the risk budget: 1% of 20,000,000 = 200,000 / 2,978.8 = 67 cp", () => {
      const { size } = sized({ equityVnd: 20_000_000 });
      expect(size.shares).toBe(0);
      expect(size.worstCaseLossVnd).toBe(0);
      expect(size.tradeRiskPct).toBe(0);
      expect(size.zeroShareReason).toBe(
        "Khối lượng tính được 67 cp, chưa tới 1 lô 100 cp: ngân sách rủi ro 200.000 ₫ chia cho 2.979 ₫/cp (R sau phí cộng đệm gap). Size tham khảo vì thế là 0 cp."
      );
    });

    it("no room left under the portfolio cap", () => {
      const { size } = sized({ maxPortfolioExposurePct: 0.7, currentExposureVnd: 700_000_000 });
      expect(size.shares).toBe(0);
      expect(size.bindingCap).toBe("portfolio_exposure");
      expect(size.zeroShareReason).toBe(
        "Khối lượng tính được 0 cp, chưa tới 1 lô 100 cp: exposure danh mục còn lại 0 ₫ dưới trần 70% vốn. Size tham khảo vì thế là 0 cp."
      );
    });

    it("per-trade and liquidity caps each name themselves", () => {
      // 0.1% of 1 tỷ = 1,000,000 / 20,200 = 49 cp. 10% of 10,000,000 ADV = 1,000,000 → 49 cp.
      expect(sized({ maxPerTradeExposurePct: 0.001 }).size.zeroShareReason).toContain(
        "trần giá trị mỗi lệnh 0,1% vốn là 1,0 tr ₫"
      );
      expect(sized({}, { advVnd: 10_000_000 }).size.zeroShareReason).toContain(
        "trần thanh khoản 10% của giá trị giao dịch bình quân 20 phiên 10,0 tr ₫"
      );
    });
  });
});

describe("buildTradeSuggestion — Tổng rủi ro mở (#15)", () => {
  const risk = (s: TradeSuggestion, code: string) => s.risks.find((r) => r.code === code);
  /*
   * Tổng rủi ro mở is the sum of Rủi ro lệnh, and Rủi ro lệnh includes the Đệm
   * gap, so each open trade counts (entry − stop + one band × stop) × quantity.
   * This suggestion's worst case is 9,830,040 đ; the 3% line on 1 tỷ is 30,000,000 đ,
   * leaving 20,169,960 đ for the open trades to sit exactly on it.
   *   A (HOSE): 30 − 28 = 2 + 28 × 7% = 1.96 → 3.96 kVND × 1000 × 5,000 = 19,800,000 đ
   *   B (HOSE): 21.683 − 20 = 1.683 + 20 × 7% = 1.40 → 3.083 kVND × 1000 × 120 = 369,960 đ
   *   19,800,000 + 369,960 = 20,169,960 đ
   */
  const tradeA: OpenTradeRisk = { entryKvnd: 30, stopKvnd: 28, quantity: 5_000, exchange: "HOSE" };
  const tradeB: OpenTradeRisk = { entryKvnd: 21.683, stopKvnd: 20, quantity: 120, exchange: "HOSE" };
  const atLimit = [tradeA, tradeB];

  it("sums gap-buffered risk of open trades plus this worst case", () => {
    const { size } = sized({ openTrades: atLimit });
    expect(size.openRisk).toEqual({
      openTradesRiskVnd: 20_169_960,
      tradesWithoutStop: 0,
      totalVnd: 30_000_000,
      totalPct: 3,
      limitPct: 3,
      aboveLimit: false,
    });
  });

  it("buffers each open trade by its own exchange's band; no exchange on record assumes HOSE", () => {
    // entry = stop = 20, 1,000 cp: HOSE 20 × 7% = 1.4 → 1,400,000 đ; HNX 10% → 2,000,000 đ;
    // UPCOM 15% → 3,000,000 đ; unknown → HOSE 1,400,000 đ. Sum 7,800,000 đ.
    const flat = (exchange: string | null): OpenTradeRisk => ({ entryKvnd: 20, stopKvnd: 20, quantity: 1000, exchange });
    const { size } = sized({ openTrades: [flat("HOSE"), flat("HNX"), flat("UPCOM"), flat(null)] });
    expect(size.openRisk.openTradesRiskVnd).toBe(7_800_000);
  });

  it("at exactly 3% there is no warning", () => {
    expect(risk(sized({ openTrades: atLimit }).s, "open_risk_high")).toBeUndefined();
  });

  it("below 3% there is no warning: (1 + 24 × 7%) = 2.68 × 1000 × 3,000 = 8,040,000 + 9,830,040 = 1.79%", () => {
    const { s, size } = sized({
      openTrades: [{ entryKvnd: 25, stopKvnd: 24, quantity: 3_000, exchange: "HOSE" }],
    });
    expect(size.openRisk.totalVnd).toBe(17_870_040);
    expect(size.openRisk.aboveLimit).toBe(false);
    expect(risk(s, "open_risk_high")).toBeUndefined();
  });

  it("above 3% warns, and only warns: B at 121 cp = 373,043 đ → 30,003,083 đ", () => {
    const { s, size } = sized({ openTrades: [tradeA, { ...tradeB, quantity: 121 }] });
    expect(size.openRisk.totalVnd).toBe(30_003_083);
    expect(size.openRisk.aboveLimit).toBe(true);
    expect(size.shares).toBe(3300); // the warning never cuts the size
    expect(risk(s, "open_risk_high")).toEqual({
      code: "open_risk_high",
      severity: "warn",
      text: "Tổng rủi ro mở 30,0 tr ₫ bằng 3,00% vốn, trên mốc 3%: 20,2 tr ₫ từ các lệnh đang mở cộng 9,8 tr ₫ lỗ xấu nhất của gợi ý này.",
    });
  });

  it("a trade with no stop is unknown risk, never zero", () => {
    const { s, size } = sized({
      openTrades: [...atLimit, { entryKvnd: 50, stopKvnd: null, quantity: 1000, exchange: "HOSE" }],
    });
    expect(size.openRisk.tradesWithoutStop).toBe(1);
    expect(size.openRisk.openTradesRiskVnd).toBe(20_169_960);
    expect(risk(s, "open_risk_unknown")).toEqual({
      code: "open_risk_unknown",
      severity: "warn",
      text: "1 lệnh đang mở chưa có stop, vì thế rủi ro của chúng chưa biết: tổng rủi ro mở 30,0 tr ₫ (3,00% vốn) chỉ là phần đã biết, con số thật có thể cao hơn.",
    });
  });

  it("a stop above entry still carries gap risk until the gap stays above entry, never negative", () => {
    // 20 − 21 × 0.93 = 20 − 19.53 = 0.47 kVND × 1000 × 1,000 = 470,000 đ.
    // 20 − 22 × 0.93 = 20 − 20.46 < 0 → 0, never offsetting the others.
    const { size } = sized({
      openTrades: [
        ...atLimit,
        { entryKvnd: 20, stopKvnd: 21, quantity: 1000, exchange: "HOSE" },
        { entryKvnd: 20, stopKvnd: 22, quantity: 5000, exchange: "HOSE" },
      ],
    });
    expect(size.openRisk.openTradesRiskVnd).toBe(20_169_960 + 470_000);
  });

  it("a zero-share suggestion adds nothing to open risk", () => {
    // (1 + 24 × 7%) = 2.68 kVND × 1000 × 100 = 268,000 đ = 1.34% of 20,000,000.
    const { size } = sized({
      equityVnd: 20_000_000,
      openTrades: [{ entryKvnd: 25, stopKvnd: 24, quantity: 100, exchange: "HOSE" }],
    });
    expect(size.openRisk.totalVnd).toBe(268_000);
    expect(size.openRisk.totalPct).toBeCloseTo(1.34, 9);
  });
});

describe("buildTradeSuggestion — size under the session verdict (#15)", () => {
  const risk = (s: TradeSuggestion, code: string) => s.risks.find((r) => r.code === code);

  it("PROBE: 30% of 3,300 = 990 → 900 cp, and every figure uses the 900", () => {
    // Loss 900 × 2,978.8 = 2,680,920 đ = 0.268092%; position 900 × 20,200 = 18,180,000 đ.
    const { size } = sized({ verdictLevel: "PROBE" });
    expect(size.sharesBeforeVerdict).toBe(3300);
    expect(size.shares).toBe(900);
    expect(size.worstCaseLossVnd).toBe(2_680_920);
    expect(size.tradeRiskPct).toBeCloseTo(0.268092, 9);
    expect(size.positionValueVnd).toBe(18_180_000);
    expect(size.openRisk.totalVnd).toBe(2_680_920);
  });

  it("the 3% warning is judged on the reduced size", () => {
    // Open 20,173,043 + 3,300 cp (9,830,040) = 30,003,083 is above the line; with PROBE's
    // 900 cp (2,680,920) the total is 20,173,043 + 2,680,920 = 22,853,963 đ, below it.
    const tradeA: OpenTradeRisk = { entryKvnd: 30, stopKvnd: 28, quantity: 5_000, exchange: "HOSE" };
    const tradeB: OpenTradeRisk = { entryKvnd: 21.683, stopKvnd: 20, quantity: 121, exchange: "HOSE" };
    const full = sized({ openTrades: [tradeA, tradeB] });
    expect(risk(full.s, "open_risk_high")).toBeDefined();
    const probe = sized({ openTrades: [tradeA, tradeB], verdictLevel: "PROBE" });
    expect(probe.size.openRisk.totalVnd).toBe(20_173_043 + 2_680_920);
    expect(risk(probe.s, "open_risk_high")).toBeUndefined();
  });

  it("the liquidity risk is judged on the reduced size: 900 × 20,200 / 4,2 tỷ = 0.43%", () => {
    expect(risk(sized({ verdictLevel: "PROBE" }, { advVnd: 4_200_000_000 }).s, "liquidity_position")).toBeUndefined();
  });

  it("NO_TRADE takes the size to 0 cp and says why", () => {
    const { size } = sized({ verdictLevel: "NO_TRADE" });
    expect(size.sharesBeforeVerdict).toBe(3300);
    expect(size.shares).toBe(0);
    expect(size.worstCaseLossVnd).toBe(0);
    expect(size.zeroShareReason).toBe("Phán quyết phiên NO-TRADE đưa size tham khảo từ 3.300 cp về 0 cp.");
  });

  it("TRADE keeps the full size", () => {
    expect(sized({ verdictLevel: "TRADE" }).size.shares).toBe(3300);
  });
});

describe("buildTradeSuggestion — liquidity once a size exists (#15)", () => {
  const risk = (s: TradeSuggestion, code: string) => s.risks.find((r) => r.code === code);

  it("compares the position value with the 20-session average, with the adjusted-price caveat", () => {
    // 3,300 cp × 20,200 đ = 66,660,000 đ; / 4,200,000,000 = 1.587% > 1%.
    const { s } = sized({}, { advVnd: 4_200_000_000 });
    expect(risk(s, "liquidity_thin")).toBeUndefined();
    expect(risk(s, "liquidity_position")).toEqual({
      code: "liquidity_position",
      severity: "warn",
      text:
        "Giá trị vị thế tham khảo 66,7 tr ₫ bằng 1,59% giá trị giao dịch bình quân 20 phiên (4,20 tỷ ₫), trên mốc 1%: thoát vị thế có thể khó, nhất là phiên giảm sàn. " +
        ADV_ADJUSTED_PRICE_CAVEAT,
    });
  });

  it("does not fire at or under 1% of the average: 66,660,000 / 10 tỷ = 0.67%", () => {
    const { s } = sized({}, { advVnd: 10_000_000_000 });
    expect(s.risks.filter((r) => r.code.startsWith("liquidity"))).toEqual([]);
  });

  it("with no position to compare (0 cp), keeps the average-only check", () => {
    const { s } = sized({ equityVnd: 20_000_000 }, { advVnd: 4_200_000_000 });
    expect(risk(s, "liquidity_position")).toBeUndefined();
    expect(risk(s, "liquidity_thin")).toBeDefined();
  });
});
