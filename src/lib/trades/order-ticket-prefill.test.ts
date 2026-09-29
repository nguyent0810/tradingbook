import { describe, expect, it } from "vitest";
import { buildScreenTradeSuggestions, type TradeSuggestionMarketFacts } from "./screen-trade-suggestions";
import { SIZING_UNAVAILABLE_COPY } from "@/lib/terminal/trade-suggestion-display";
import {
  buildOrderTicketPrefill,
  ticketShareCeiling,
  type OrderTicketPrefillInput,
} from "./order-ticket-prefill";
import { logTradeShareCeiling } from "./reference-size";
import { ticketWorstCaseLossVnd } from "./worst-case-risk";
import {
  WORKED_ADV_VND,
  WORKED_CANDIDATE as CANDIDATE,
  workedBars as bars,
  workedMarket as market,
} from "./trade-suggestion.fixture";

/**
 * The worked HOSE example (see trade-suggestion.fixture.ts), built through the
 * same per-candidate loop the screen loader runs for F1/F2/F7:
 *   entry zone 19.60–20.20, stop zone 18.60–18.90,
 *   1R 22.00 · 2R 23.65 · 3R 25.35,
 *   worst case per share 2.9788 kVND → 10,000,000 / 2,978.8 → 3,300 cp,
 *   worst-case loss 3,300 × 2,978.8 = 9,830,040 đ.
 */
function suggestionFor(over: Partial<TradeSuggestionMarketFacts> = {}, candidate = CANDIDATE) {
  return buildScreenTradeSuggestions({
    candidates: [candidate],
    barsBySymbolId: new Map([["sym-1", bars()]]),
    exchangeBySymbolId: new Map([["sym-1", "HOSE"]]),
    prospectiveN: 7,
    market: market(over),
  }).get(candidate.id)!;
}

/** The prefill's input as the preview action builds it from the loader and the verdict. */
function prefillInput(
  marketOver: Partial<TradeSuggestionMarketFacts> = {},
  over: Partial<OrderTicketPrefillInput> = {}
): OrderTicketPrefillInput {
  const m = market(marketOver);
  return {
    result: suggestionFor(marketOver),
    sizingUnavailable: null,
    sizing: m.sizing,
    advVnd: WORKED_ADV_VND,
    tier: "A",
    verdictBlockedReason: null,
    ...over,
  };
}

describe("buildOrderTicketPrefill — the ticket shows the suggestion's numbers (#17)", () => {
  const result = suggestionFor();
  if (!result.ok || !result.suggestion.size) throw new Error("fixture must build a sized suggestion");
  const s = result.suggestion;
  const prefill = buildOrderTicketPrefill(prefillInput());
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
    expect(t.sharesBeforeVerdict).toBe(s.size!.sharesBeforeVerdict);
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

describe("ticketShareCeiling — the server's cap, live on the ticket as the user edits", () => {
  const prefill = buildOrderTicketPrefill(prefillInput());
  if (!prefill.ok || !prefill.ticket.ceiling) throw new Error("expected a ticket with a ceiling");
  const ticket = prefill.ticket;
  const ctx = ticket.ceiling!;

  /** What `createTradeFromSetup` computes from its own reads for the same numbers. */
  const server = (entryKvnd: number, stopKvnd: number) =>
    logTradeShareCeiling({
      equityVnd: 1_000_000_000,
      riskPerTradePct: 0.01,
      maxPerTradeExposurePct: 1,
      maxPortfolioExposurePct: 1,
      liquidityCapPct: 0.1,
      currentExposureVnd: 0,
      tier: "A",
      exchange: "HOSE",
      entryKvnd,
      stopKvnd,
      advVnd: WORKED_ADV_VND,
      verdictLevel: "TRADE",
      verdictBlockedReason: null,
    });

  it("at the pre-filled numbers it equals the pre-filled size: 3,300 cp", () => {
    expect(ticketShareCeiling(ctx, ticket.entryKvnd, ticket.stopKvnd)).toMatchObject({ ok: true, shares: 3300 });
  });

  it("entry raised to 20.50: 1.90 + 0.03075 + 0.0465 + 1.302 = 3.27925 → 10,000,000 / 3,279.25 = 3,049 → 3,000 cp", () => {
    const ticketCeiling = ticketShareCeiling(ctx, 20.5, 18.6);
    expect(ticketCeiling).toMatchObject({ ok: true, shares: 3000 });
    expect(ticketCeiling).toEqual(server(20.5, 18.6));
  });

  it("stop lowered to 18.00: 2.20 + 0.0303 + 0.045 + 18 × 7% = 3.5353 → 10,000,000 / 3,535.3 = 2,828 → 2,800 cp", () => {
    const ticketCeiling = ticketShareCeiling(ctx, 20.2, 18);
    expect(ticketCeiling).toMatchObject({ ok: true, shares: 2800 });
    expect(ticketCeiling).toEqual(server(20.2, 18));
  });

  it("a stop at or above entry is refused, as the server refuses it", () => {
    expect(ticketShareCeiling(ctx, 20.2, 20.2)).toMatchObject({ ok: false });
  });
});

describe("buildOrderTicketPrefill — when the suggestion has no size or no numbers", () => {
  it("no sizing inputs: prices still pre-filled, size empty with the page's reason, no ceiling", () => {
    const prefill = buildOrderTicketPrefill(
      prefillInput({ sizing: null }, { sizing: null, sizingUnavailable: "NO_EQUITY" })
    );
    if (!prefill.ok) throw new Error(prefill.message);
    expect(prefill.ticket.entryKvnd).toBe(20.2);
    expect(prefill.ticket.shares).toBeNull();
    expect(prefill.ticket.worstCaseLossVnd).toBeNull();
    expect(prefill.ticket.ceiling).toBeNull();
    expect(prefill.ticket.sizeNote).toBe(SIZING_UNAVAILABLE_COPY.NO_EQUITY);
  });

  it("no session verdict: fails closed like the server — no size, the server's reason", () => {
    // The suggestion itself sizes without a verdict (3,300 cp); the server refuses to log.
    const sizing = { ...market().sizing!, verdictLevel: null };
    const input = prefillInput({ sizing }, { sizing, verdictBlockedReason: "chưa đo được Cổng 1" });
    const r = input.result;
    if (!r?.ok) throw new Error("fixture");
    expect(r.suggestion.size!.shares).toBe(3300);

    const prefill = buildOrderTicketPrefill(input);
    if (!prefill.ok) throw new Error(prefill.message);
    expect(prefill.ticket.shares).toBeNull();
    expect(prefill.ticket.worstCaseLossVnd).toBeNull();
    expect(prefill.ticket.sizeNote).toBe(
      "Chưa dựng được phán quyết phiên nên không ghi lệnh mới. chưa đo được Cổng 1"
    );
  });

  it("NO-TRADE: no size, with the server's reason", () => {
    const sizing = { ...market().sizing!, verdictLevel: "NO_TRADE" as const };
    const prefill = buildOrderTicketPrefill(prefillInput({ sizing }, { sizing }));
    if (!prefill.ok) throw new Error(prefill.message);
    expect(prefill.ticket.shares).toBeNull();
    expect(prefill.ticket.sizeNote).toMatch(/^Phán quyết phiên là NO-TRADE/);
  });

  it("cannot compute: the ticket says 'không đủ dữ liệu' with the builder's reason", () => {
    const prefill = buildOrderTicketPrefill(
      prefillInput({}, { result: suggestionFor({}, { ...CANDIDATE, stopLevel: 20.5 }) })
    );
    expect(prefill.ok).toBe(false);
    if (prefill.ok) throw new Error("unreachable");
    expect(prefill.message).toMatch(/^Không đủ dữ liệu — mức vô hiệu 20,5 không nằm dưới vùng vào/);
  });

  it("no result at all (the lookup failed)", () => {
    expect(buildOrderTicketPrefill(prefillInput({}, { result: undefined }))).toMatchObject({ ok: false });
  });
});
