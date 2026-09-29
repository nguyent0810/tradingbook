import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import {
  ADV_ADJUSTED_PRICE_CAVEAT,
  BANNED_IMPERATIVE_PATTERNS,
  RISK_COPY,
  SETUP_REASON_COPY,
  UNMAPPED_REASON_COPY,
} from "./trade-suggestion-copy";
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

function scannerReasons(volLast: number): string[] {
  const path = classifierPath(volLast);
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

  it("covers both depth lines: a measured dip and no material dip", () => {
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
});

describe("copy tables — descriptive, never imperative (ADR 0003)", () => {
  const copy = [
    ...Object.entries(SETUP_REASON_COPY),
    ...Object.entries(RISK_COPY),
    ["unmapped", UNMAPPED_REASON_COPY],
    ["adv caveat", ADV_ADJUSTED_PRICE_CAVEAT],
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
    it("fires when two floors from the worst fill (17.50) are below the stop (18.60)", () => {
      expect(risk(base, "settlement_lockup")).toEqual({
        code: "settlement_lockup",
        severity: "info",
        text: "T+2,5: cổ phiếu khớp hôm nay khoảng 2,5 phiên sau mới về tài khoản. Hai phiên giảm sàn từ 20,20 là 17,50, đã dưới vùng SL: giá có thể xuyên stop trước khi bán được.",
      });
    });

    it("does not fire when two floors stay above the stop", () => {
      expect(risk(wide, "settlement_lockup")).toBeUndefined();
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
          "Giá trị giao dịch bình quân 20 phiên khoảng 4,2 tỷ ₫, dưới mốc 10 tỷ ₫: 1% con số đó chỉ bằng khoảng 20 lô 100 cp ở 20,20, thoát vị thế lớn có thể khó, nhất là phiên giảm sàn. " +
          ADV_ADJUSTED_PRICE_CAVEAT,
      });
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
      ["info", "settlement_lockup"],
      ["info", "tier_b"],
    ]);
  });
});
