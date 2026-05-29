import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { TRADABILITY_REASON } from "./tradability-constants";
import {
  aggregateTradabilityResults,
  countWeekdaysExclusive,
  evaluateTradability,
} from "./tradability";
import { symbolIdsEligibleForGate2 } from "./scan-session-coverage";
import type { TradabilityBarInput } from "./tradability-types";
import { getExpectedLatestSessionFromIndexBars } from "./expected-session";

/** UTC calendar day. */
function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Emit `count` weekday-only bars starting from first weekday on or after `start`. */
function generateWeekdayBars(
  count: number,
  start: Date,
  close: number,
  volume: number
): TradabilityBarInput[] {
  const out: TradabilityBarInput[] = [];
  const cursor = new Date(start.getTime());
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({
        date: new Date(cursor.getTime()),
        close,
        volume,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

describe("evaluateTradability", () => {
  /**
   * Liquid equity-style bars: close in **thousand VND** (VCI), 130 weekdays so last 120 has no >21d gap.
   */
  const passDefaults = () => {
    const bars = generateWeekdayBars(130, utc(2025, 1, 6), 55, 250_000);
    const expected = bars[bars.length - 1]!.date;
    return { bars, expected };
  };

  it("passes when all checks succeed", () => {
    const { bars, expected } = passDefaults();
    const r = evaluateTradability(bars, expected);
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("passes min price with VCI thousand-VND quote (e.g. 74.7 → 74,700 VND)", () => {
    const bars = generateWeekdayBars(130, utc(2025, 1, 6), 74.7, 250_000);
    const expected = bars[bars.length - 1]!.date;
    const r = evaluateTradability(bars, expected);
    expect(r.reasons).not.toContain(TRADABILITY_REASON.PRICE);
    expect(r.passed).toBe(true);
  });

  it("fails when insufficient history (<120 bars)", () => {
    const bars = generateWeekdayBars(50, utc(2025, 1, 6), 55, 250_000);
    const r = evaluateTradability(bars, bars[bars.length - 1]!.date);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.INSUFFICIENT_HISTORY);
  });

  it("fails when 20D average volume is below floor", () => {
    const { bars, expected } = passDefaults();
    const lowVolBars = bars.map((b, i) =>
      i >= bars.length - 20 ? { ...b, volume: 1000 } : b
    );
    const r = evaluateTradability(lowVolBars, expected);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.VOLUME_20D);
  });

  it("fails when 20D average traded value is below floor (uses ×1000)", () => {
    const { bars, expected } = passDefaults();
    const pennyBars = bars.map((b, i) =>
      i >= bars.length - 20 ? { ...b, close: 2, volume: 500 } : b
    );
    const r = evaluateTradability(pennyBars, expected);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.VALUE_20D);
  });

  it("fails when latest nominal close below 10,000 VND (e.g. 4.5 thousand VND)", () => {
    const { bars, expected } = passDefaults();
    const last = bars[bars.length - 1]!;
    const badLast = bars.slice(0, -1).concat([{ ...last, close: 4.5 }]);
    const r = evaluateTradability(badLast, expected);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.PRICE);
  });

  it("fails when latest bar date does not match expected session (stale)", () => {
    const { bars } = passDefaults();
    const staleExpected = utc(2024, 12, 1);
    const r = evaluateTradability(bars, staleExpected);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.STALE_DATA);
  });

  it("excludes stale symbols from Gate 2 eligibility (passed tradability only)", () => {
    const { bars, expected } = passDefaults();
    const pass = evaluateTradability(bars, expected);
    const staleExpected = utc(2024, 12, 1);
    const stale = evaluateTradability(bars, staleExpected);
    const eligible = symbolIdsEligibleForGate2([
      { symbolId: "ok", result: pass },
      { symbolId: "stale", result: stale },
    ]);
    expect(eligible).toEqual(["ok"]);
    expect(stale.passed).toBe(false);
  });

  it("fails when consecutive bar calendar gap exceeds 21 days (suspension)", () => {
    const head = generateWeekdayBars(60, utc(2025, 1, 6), 55, 250_000);
    const tail = generateWeekdayBars(61, utc(2025, 9, 1), 55, 250_000);
    const merged = [...head, ...tail];
    const expected = merged[merged.length - 1]!.date;
    const r = evaluateTradability(merged, expected);
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(TRADABILITY_REASON.GAP_CALENDAR);
  });

  it("passes normal Fri–Mon gaps (≤21 calendar days)", () => {
    const { bars, expected } = passDefaults();
    const r = evaluateTradability(bars, expected);
    expect(r.reasons).not.toContain(TRADABILITY_REASON.GAP_CALENDAR);
    expect(r.passed).toBe(true);
  });

  it("passes when a mid-series calendar gap is ≤21 days (e.g. extended holiday)", () => {
    const base = generateWeekdayBars(130, utc(2025, 1, 6), 55, 250_000);
    const prev59 = base[59]!.date;
    const new60 = new Date(base[60]!.date);
    const delta =
      prev59.getTime() +
      14 * 86_400_000 -
      new60.getTime();
    const shifted = base.map((b, i) =>
      i >= 60
        ? { ...b, date: new Date(b.date.getTime() + delta) }
        : b
    );
    const expected = shifted[shifted.length - 1]!.date;
    const r = evaluateTradability(shifted, expected);
    expect(r.reasons).not.toContain(TRADABILITY_REASON.GAP_CALENDAR);
    expect(r.passed).toBe(true);
  });

  it("fails when a consecutive calendar gap exceeds 21 days (single jump)", () => {
    const base = generateWeekdayBars(130, utc(2025, 1, 6), 55, 250_000);
    const prev59 = base[59]!.date;
    const delta =
      prev59.getTime() +
      22 * 86_400_000 -
      base[60]!.date.getTime();
    const shifted = base.map((b, i) =>
      i >= 60
        ? { ...b, date: new Date(b.date.getTime() + delta) }
        : b
    );
    const expected = shifted[shifted.length - 1]!.date;
    const r = evaluateTradability(shifted, expected);
    expect(r.reasons).toContain(TRADABILITY_REASON.GAP_CALENDAR);
    expect(r.passed).toBe(false);
  });

  it("aggregate breakdown counts multiple reasons across symbols", () => {
    const { bars: bPass, expected: ePass } = passDefaults();
    const pass = evaluateTradability(bPass, ePass);

    const short = generateWeekdayBars(50, utc(2025, 1, 6), 55, 250_000);
    const failHist = evaluateTradability(short, short[short.length - 1]!.date);

    const { bars: bVol, expected: eVol } = passDefaults();
    const lowVol = bVol.map((b, i) =>
      i >= bVol.length - 20 ? { ...b, volume: 1000 } : b
    );
    const failVol = evaluateTradability(lowVol, eVol);

    const agg = aggregateTradabilityResults([
      { symbolKey: "AAA", result: pass },
      { symbolKey: "BBB", result: failHist },
      { symbolKey: "CCC", result: failVol },
    ]);

    expect(agg.totalSymbols).toBe(3);
    expect(agg.passedTradability).toBe(1);
    expect(agg.filteredOut).toBe(2);
    expect(agg.breakdownByReason[TRADABILITY_REASON.INSUFFICIENT_HISTORY]).toBe(1);
    expect(agg.breakdownByReason[TRADABILITY_REASON.VOLUME_20D]).toBe(1);
  });
});

describe("countWeekdaysExclusive", () => {
  it("returns 0 for adjacent weekdays", () => {
    expect(countWeekdaysExclusive(utc(2025, 6, 2), utc(2025, 6, 3))).toBe(0);
  });

  it("counts weekdays between Mon and Fri same week exclusive", () => {
    expect(countWeekdaysExclusive(utc(2025, 6, 2), utc(2025, 6, 6))).toBe(3);
  });
});

describe("getExpectedLatestSessionFromIndexBars", () => {
  it("returns null when no index bars exist", async () => {
    const prisma = {
      indexDailyBar: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;
    await expect(
      getExpectedLatestSessionFromIndexBars(prisma, "VNINDEX")
    ).resolves.toBeNull();
  });

  it("returns latest VNINDEX bar date", async () => {
    const session = utc(2026, 5, 4);
    const prisma = {
      indexDailyBar: {
        findFirst: vi.fn().mockResolvedValue({ date: session }),
      },
    } as unknown as PrismaClient;
    const got = await getExpectedLatestSessionFromIndexBars(prisma);
    expect(got?.getTime()).toBe(session.getTime());
    expect(prisma.indexDailyBar.findFirst).toHaveBeenCalledWith({
      where: { symbol: "VNINDEX" },
      orderBy: { date: "desc" },
      select: { date: true },
    });
  });

  it("honors custom symbol", async () => {
    const prisma = {
      indexDailyBar: {
        findFirst: vi.fn().mockResolvedValue({ date: utc(2025, 1, 1) }),
      },
    } as unknown as PrismaClient;
    await getExpectedLatestSessionFromIndexBars(prisma, "OTHER");
    expect(prisma.indexDailyBar.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { symbol: "OTHER" },
      })
    );
  });
});
