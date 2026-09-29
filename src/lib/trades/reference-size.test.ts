import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { buildTradeSuggestion, type TradeSuggestionInput } from "./trade-suggestion";
import { checkConfirmedQuantity, logTradeShareCeiling, type LogTradeCeilingInput } from "./reference-size";

/**
 * The worked HOSE example of trade-suggestion.test.ts: 70 quiet bars at 20.00
 * (high 20.20, low 19.20), one spike to 23.00. Entry zone 19.60–20.20, stop
 * zone 18.60–18.90. Worst case per share at 20.20 / 18.60:
 *   net R 1.6768 + gap 18.60 × 7% = 1.302 → 2.9788 kVND = 2,978.8 đ.
 * With 1 tỷ equity and 1% risk, tier A: 10,000,000 / 2,978.8 = 3,357 → 3,300 cp.
 */
const SETUP_IDX = 69;
const day = (i: number) => new Date(Date.UTC(2026, 5, 1) + i * 86_400_000);

function bars(): Gate2BarInput[] {
  return Array.from({ length: SETUP_IDX + 1 }, (_, i) => ({
    date: day(i),
    open: 20,
    high: i === SETUP_IDX - 30 ? 23 : 20.2,
    low: 19.2,
    close: 20,
    volume: 1_000_000,
  }));
}

const SIZING = {
  equityVnd: 1_000_000_000,
  riskPerTradePct: 0.01,
  maxPerTradeExposurePct: 1,
  maxPortfolioExposurePct: 1,
  liquidityCapPct: 0.1,
  currentExposureVnd: 0,
};

function suggestionInput(over: Partial<TradeSuggestionInput> = {}): TradeSuggestionInput {
  return {
    setup: {
      pullbackZoneLow: 19.6,
      pullbackZoneHigh: 20.2,
      stopLevel: 18.9,
      barDate: day(SETUP_IDX),
      tier: "A",
      reasons: [],
    },
    bars: bars(),
    exchange: "HOSE",
    prospectiveN: 7,
    gate1Level: "PASS",
    expectedSession: day(SETUP_IDX),
    advVnd: 50_000_000_000,
    sizing: { ...SIZING, openTrades: [], verdictLevel: "TRADE" },
    ...over,
  };
}

function ceilingInput(over: Partial<LogTradeCeilingInput> = {}): LogTradeCeilingInput {
  return {
    ...SIZING,
    tier: "A",
    exchange: "HOSE",
    entryKvnd: 20.2,
    stopKvnd: 18.6,
    advVnd: 50_000_000_000,
    verdictLevel: "TRADE",
    verdictBlockedReason: null,
    ...over,
  };
}

function suggestedShares(over: Partial<TradeSuggestionInput> = {}): number {
  const r = buildTradeSuggestion(suggestionInput(over));
  if (!r.ok || !r.suggestion.size) throw new Error("expected a sized suggestion");
  return r.suggestion.size.shares;
}

describe("logTradeShareCeiling — the server's own cap at log time", () => {
  it("equals the suggestion's size for the same setup and inputs, so a suggestion-sized order is accepted", () => {
    // Both: 10,000,000 / 2,978.8 = 3,357.05 → 3,357 → 3,300 cp on the lot; TRADE keeps 100%.
    const shares = suggestedShares();
    expect(shares).toBe(3300);
    const ceiling = logTradeShareCeiling(ceilingInput());
    expect(ceiling).toMatchObject({ ok: true, shares: 3300 });
    if (!ceiling.ok) throw new Error("unreachable");
    expect(checkConfirmedQuantity(ceiling, shares)).toEqual({ ok: true, quantity: 3300 });
  });

  it("stays equal under PROBE: 30% of 3,300 = 990 → 900 cp on both sides", () => {
    const shares = suggestedShares({
      sizing: { ...SIZING, openTrades: [], verdictLevel: "PROBE" },
    });
    expect(shares).toBe(900);
    const ceiling = logTradeShareCeiling(ceilingInput({ verdictLevel: "PROBE" }));
    expect(ceiling).toMatchObject({ ok: true, shares: 900, sharesBeforeVerdict: 3300 });
    if (!ceiling.ok) throw new Error("unreachable");
    expect(checkConfirmedQuantity(ceiling, 900).ok).toBe(true);
    expect(checkConfirmedQuantity(ceiling, 1000).ok).toBe(false);
  });

  it("stays equal when a cap binds: per-trade 5% of 1 tỷ = 50,000,000 / 20,200 = 2,475 → 2,400 cp", () => {
    const shares = suggestedShares({
      sizing: { ...SIZING, maxPerTradeExposurePct: 0.05, openTrades: [], verdictLevel: "TRADE" },
    });
    expect(shares).toBe(2400);
    expect(logTradeShareCeiling(ceilingInput({ maxPerTradeExposurePct: 0.05 }))).toMatchObject({
      ok: true,
      shares: 2400,
    });
  });

  it("measures on the worst-case basis, not the bare stop distance", () => {
    // Bare stop distance would allow 10,000,000 / 1,600 = 6,250 → 6,200 cp. The
    // gap-buffered basis allows 3,300, so 6,200 is refused and the cap is named.
    const ceiling = logTradeShareCeiling(ceilingInput());
    if (!ceiling.ok) throw new Error("expected a ceiling");
    const check = checkConfirmedQuantity(ceiling, 6200);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.message).toContain("3.300");
  });

  it("a better fill raises the ceiling: entry 19.60 → 2,377.9 đ worst case → 4,205 → 4,200 cp", () => {
    // net 1.00 + 19.60 × 0.0015 + 18.60 × 0.0025 = 1.0759; + 1.302 gap = 2.3779 kVND.
    // 10,000,000 / 2,377.9 = 4,205.4 → 4,200 cp.
    expect(logTradeShareCeiling(ceilingInput({ entryKvnd: 19.6 }))).toMatchObject({ ok: true, shares: 4200 });
  });

  it("a user-kept quantity is rounded down to the lot and never raised", () => {
    const ceiling = logTradeShareCeiling(ceilingInput());
    if (!ceiling.ok) throw new Error("expected a ceiling");
    expect(checkConfirmedQuantity(ceiling, 2250)).toEqual({ ok: true, quantity: 2200 });
    expect(checkConfirmedQuantity(ceiling, 99).ok).toBe(false);
    expect(checkConfirmedQuantity(ceiling, null)).toEqual({ ok: true, quantity: 3300 });
  });

  describe("refuses, with a reason", () => {
    it("no equity on record", () => {
      expect(logTradeShareCeiling(ceilingInput({ equityVnd: null }))).toMatchObject({ ok: false });
    });
    it("no session verdict", () => {
      const r = logTradeShareCeiling(ceilingInput({ verdictLevel: null, verdictBlockedReason: "thiếu Gate 1" }));
      expect(r).toMatchObject({ ok: false });
      if (r.ok) throw new Error("unreachable");
      expect(r.message).toContain("thiếu Gate 1");
    });
    it("NO-TRADE", () => {
      expect(logTradeShareCeiling(ceilingInput({ verdictLevel: "NO_TRADE" }))).toMatchObject({ ok: false });
    });
    it("stop at or above entry", () => {
      expect(logTradeShareCeiling(ceilingInput({ stopKvnd: 20.2 }))).toMatchObject({ ok: false });
    });
    it("under one lot: 1% of 20,000,000 đ = 200,000 / 2,978.8 = 67 cp", () => {
      expect(logTradeShareCeiling(ceilingInput({ equityVnd: 20_000_000 }))).toMatchObject({ ok: false });
    });
  });
});
