import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  buildScreenTradeSuggestions,
  SIZING_UNAVAILABLE_COPY,
  type SuggestionCandidate,
  type TradeSuggestionMarketFacts,
} from "./screen-trade-suggestions";
import { buildOrderTicketPrefill } from "./order-ticket-prefill";
import { ticketWorstCaseLossVnd } from "./worst-case-risk";

/**
 * The worked HOSE example (trade-suggestion.test.ts), built through the same
 * per-candidate loop the screen loader runs for F1/F2/F7:
 *   entry zone 19.60–20.20, stop zone 18.60–18.90,
 *   1R 22.00 · 2R 23.65 · 3R 25.35,
 *   worst case per share 2.9788 kVND → 10,000,000 / 2,978.8 → 3,300 cp,
 *   worst-case loss 3,300 × 2,978.8 = 9,830,040 đ.
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

const CANDIDATE: SuggestionCandidate = {
  id: "setup-1",
  symbolId: "sym-1",
  pullbackZoneLow: 19.6,
  pullbackZoneHigh: 20.2,
  stopLevel: 18.9,
  barDate: day(SETUP_IDX),
  quality: "A",
  reasons: [],
};

function market(over: Partial<TradeSuggestionMarketFacts> = {}): TradeSuggestionMarketFacts {
  return {
    latestSession: day(SETUP_IDX),
    expectedSession: day(SETUP_IDX),
    gate1Level: "PASS",
    advBySymbolId: new Map([["sym-1", 50_000_000_000]]),
    sizing: {
      equityVnd: 1_000_000_000,
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

function suggestionFor(over: Partial<TradeSuggestionMarketFacts> = {}, candidate = CANDIDATE) {
  return buildScreenTradeSuggestions({
    candidates: [candidate],
    barsBySymbolId: new Map([["sym-1", bars()]]),
    exchangeBySymbolId: new Map([["sym-1", "HOSE"]]),
    prospectiveN: 7,
    market: market(over),
  }).get(candidate.id)!;
}

describe("buildOrderTicketPrefill — the ticket shows the suggestion's numbers (#17)", () => {
  const result = suggestionFor();
  if (!result.ok || !result.suggestion.size) throw new Error("fixture must build a sized suggestion");
  const s = result.suggestion;
  const prefill = buildOrderTicketPrefill(result, null);
  if (!prefill.ok) throw new Error(prefill.message);
  const t = prefill.ticket;

  it("entry = the top of the entry zone (the worst fill R is measured from), zone shown", () => {
    expect(t.entryKvnd).toBe(s.entryZone.high);
    expect(t.entryKvnd).toBe(20.2);
    expect(t.entryZone).toEqual(s.entryZone);
  });

  it("stop = the bottom of the stop zone", () => {
    expect(t.stopKvnd).toBe(s.stopZone.low);
    expect(t.stopKvnd).toBe(18.6);
    expect(t.stopZone).toEqual({ low: s.stopZone.low, high: s.stopZone.high });
  });

  it("targets are the suggestion's 1R/2R/3R, 2R by default", () => {
    expect(t.targets).toEqual(s.targets.map((x) => ({ r: x.r, priceKvnd: x.price })));
    expect(t.targets.map((x) => x.priceKvnd)).toEqual([22, 23.65, 25.35]);
    expect(t.defaultTargetR).toBe(2);
  });

  it("size = the suggestion's shares, and the risk readout = its worst-case loss", () => {
    expect(t.shares).toBe(s.size!.shares);
    expect(t.shares).toBe(3300);
    expect(t.worstCaseLossVnd).toBe(s.size!.worstCaseLossVnd);
    expect(
      ticketWorstCaseLossVnd({ entryKvnd: t.entryKvnd, stopKvnd: t.stopKvnd, exchange: t.exchange, shares: t.shares! })
    ).toBe(9_830_040);
  });

  it("carries the session and the evidence status", () => {
    expect(t.asOfSession).toBe(s.asOfSession);
    expect(t.evidence).toEqual({ prospectiveN: 7, checkpointN: 100 });
  });
});

describe("ticketWorstCaseLossVnd — the readout follows the user's edits on the same basis", () => {
  it("entry edited to 19.60: 3,300 × 2,377.9 = 7,847,070 đ", () => {
    // net 1.00 + 19.60 × 0.0015 + 18.60 × 0.0025 = 1.0759; + 18.60 × 7% = 1.302 → 2.3779 kVND.
    expect(ticketWorstCaseLossVnd({ entryKvnd: 19.6, stopKvnd: 18.6, exchange: "HOSE", shares: 3300 })).toBe(
      7_847_070
    );
  });

  it("no readout for a stop at or above entry, or no shares", () => {
    expect(ticketWorstCaseLossVnd({ entryKvnd: 18.6, stopKvnd: 18.6, exchange: "HOSE", shares: 100 })).toBeNull();
    expect(ticketWorstCaseLossVnd({ entryKvnd: 20.2, stopKvnd: 18.6, exchange: "HOSE", shares: Number.NaN })).toBeNull();
  });
});

describe("buildOrderTicketPrefill — when the suggestion has no size or no numbers", () => {
  it("no sizing inputs: prices still pre-filled, size empty with the page's reason", () => {
    const prefill = buildOrderTicketPrefill(suggestionFor({ sizing: null }), "NO_EQUITY");
    if (!prefill.ok) throw new Error(prefill.message);
    expect(prefill.ticket.entryKvnd).toBe(20.2);
    expect(prefill.ticket.shares).toBeNull();
    expect(prefill.ticket.worstCaseLossVnd).toBeNull();
    expect(prefill.ticket.sizeNote).toBe(SIZING_UNAVAILABLE_COPY.NO_EQUITY);
  });

  it("a 0-share suggestion pre-fills 0 and says why", () => {
    const result = suggestionFor({ sizing: { ...market().sizing!, verdictLevel: "NO_TRADE" } });
    const prefill = buildOrderTicketPrefill(result, null);
    if (!prefill.ok || !result.ok) throw new Error("expected a ticket");
    expect(prefill.ticket.shares).toBe(0);
    expect(prefill.ticket.sizeNote).toBe(result.suggestion.size!.zeroShareReason);
  });

  it("cannot compute: the ticket says 'không đủ dữ liệu' with the builder's reason", () => {
    const prefill = buildOrderTicketPrefill(suggestionFor({}, { ...CANDIDATE, stopLevel: 20.5 }), null);
    expect(prefill.ok).toBe(false);
    if (prefill.ok) throw new Error("unreachable");
    expect(prefill.message).toMatch(/^Không đủ dữ liệu — mức vô hiệu 20,5 không nằm dưới vùng vào/);
  });

  it("no result at all (the lookup failed)", () => {
    expect(buildOrderTicketPrefill(undefined, null)).toMatchObject({ ok: false });
  });
});
