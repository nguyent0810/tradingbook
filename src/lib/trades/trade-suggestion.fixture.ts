/**
 * Test fixture: the worked HOSE example of trade-suggestion.test.ts, shaped
 * for the screen loader's per-candidate loop. Imported by tests only.
 *
 * 70 quiet bars at 20.00 (high 20.20, low 19.20, ATR 1.00), one spike to 23.00
 * 30 sessions before the setup. HOSE, next-session band 18.60–21.40, tick 0.05.
 *   Entry zone 19.60–20.20; stop zone 18.60–18.90.
 *   Net R 1.6768, 1R 22.00 · 2R 23.65 · 3R 25.35.
 *   Worst case per share 1.6768 + 18.60 × 7% = 2.9788 kVND.
 *   1 tỷ equity, 1% risk, tier A: 10,000,000 / 2,978.8 = 3,357 → 3,300 cp;
 *   worst-case loss 3,300 × 2,978.8 = 9,830,040 đ.
 */
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { SuggestionCandidate, TradeSuggestionMarketFacts } from "./screen-trade-suggestions";

export const WORKED_SETUP_IDX = 69;

export function workedDay(i: number): Date {
  return new Date(Date.UTC(2026, 5, 1) + i * 86_400_000);
}

export function workedBars(): Gate2BarInput[] {
  return Array.from({ length: WORKED_SETUP_IDX + 1 }, (_, i) => ({
    date: workedDay(i),
    open: 20,
    high: i === WORKED_SETUP_IDX - 30 ? 23 : 20.2,
    low: 19.2,
    close: 20,
    volume: 1_000_000,
  }));
}

export const WORKED_CANDIDATE: SuggestionCandidate = {
  id: "setup-1",
  symbolId: "sym-1",
  pullbackZoneLow: 19.6,
  pullbackZoneHigh: 20.2,
  stopLevel: 18.9,
  barDate: workedDay(WORKED_SETUP_IDX),
  quality: "A",
  reasons: [],
};

export const WORKED_EQUITY_VND = 1_000_000_000;
export const WORKED_ADV_VND = 50_000_000_000;

export function workedMarket(over: Partial<TradeSuggestionMarketFacts> = {}): TradeSuggestionMarketFacts {
  return {
    latestSession: workedDay(WORKED_SETUP_IDX),
    expectedSession: workedDay(WORKED_SETUP_IDX),
    gate1Level: "PASS",
    advBySymbolId: new Map([[WORKED_CANDIDATE.symbolId, WORKED_ADV_VND]]),
    sizing: {
      equityVnd: WORKED_EQUITY_VND,
      riskPerTradePct: 0.01,
      maxPerTradeExposurePct: 1,
      maxPortfolioExposurePct: 1,
      liquidityCapPct: 0.1,
      currentExposureVnd: 0,
      openTrades: [],
      verdictLevel: "TRADE",
    },
    ...over,
  };
}
