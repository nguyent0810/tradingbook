import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildScreenTradeSuggestions } from "@/lib/trades/screen-trade-suggestions";
import type { TradeSuggestionResult } from "@/lib/trades/trade-suggestion";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import { ticketShareCeiling } from "@/lib/trades/order-ticket-prefill";
import {
  WORKED_ADV_VND,
  WORKED_CANDIDATE,
  WORKED_EQUITY_VND,
  workedBars,
  workedMarket,
} from "@/lib/trades/trade-suggestion.fixture";

/**
 * The order-ticket preview and the log-trade action (#17), at their seams: the
 * DB, session, verdict, ADV and settings are mocked; the suggestion is the REAL
 * one the screens build (the worked HOSE example — entry zone 19.60–20.20,
 * stop zone 18.60–18.90, 2R 23.65, 3,300 cp at 1 tỷ / 1% / tier A).
 */

const getSession = vi.hoisted(() => vi.fn());
const setupFindUnique = vi.hoisted(() => vi.fn());
const tradeFindFirst = vi.hoisted(() => vi.fn());
const tradeFindMany = vi.hoisted(() => vi.fn());
const tradeCreate = vi.hoisted(() => vi.fn());
const loadSymbolAdvVnd = vi.hoisted(() => vi.fn());
const loadTerminalVerdict = vi.hoisted(() => vi.fn());
const getTradingAccountEquityVnd = vi.hoisted(() => vi.fn());
const getPositionSizingConfig = vi.hoisted(() => vi.fn());
const loadSetupTradeSuggestion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setupCandidate: { findUnique: setupFindUnique },
    trade: { findFirst: tradeFindFirst, findMany: tradeFindMany, create: tradeCreate },
  },
}));
vi.mock("@/lib/trades/symbol-adv", () => ({ loadSymbolAdvVnd }));
vi.mock("@/lib/terminal/load-terminal-verdict", () => ({ loadTerminalVerdict }));
vi.mock("@/lib/trading-account-risk-config", () => ({
  getTradingAccountEquityVnd,
  getPositionSizingConfig,
}));
vi.mock("@/lib/trades/load-screen-trade-suggestions", () => ({ loadSetupTradeSuggestion }));

const { previewTradeLevelsForSetup, createTradeFromSetup } = await import("./trades");

function workedSuggestion(verdictLevel: VerdictUxLevel | null = "TRADE"): TradeSuggestionResult {
  return buildScreenTradeSuggestions({
    candidates: [WORKED_CANDIDATE],
    barsBySymbolId: new Map([[WORKED_CANDIDATE.symbolId, workedBars()]]),
    exchangeBySymbolId: new Map([[WORKED_CANDIDATE.symbolId, "HOSE"]]),
    prospectiveN: 7,
    market: workedMarket({ sizing: { ...workedMarket().sizing!, verdictLevel } }),
  }).get(WORKED_CANDIDATE.id)!;
}

/** What the loader returns for the worked setup, with the verdict the caller passed. */
function loaded(verdictLevel: VerdictUxLevel | null = "TRADE") {
  return {
    result: workedSuggestion(verdictLevel),
    sizingUnavailable: null,
    sizingInput: { ...workedMarket().sizing!, verdictLevel },
    advVnd: WORKED_ADV_VND,
    errors: [],
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("setupId", WORKED_CANDIDATE.id);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  getSession.mockResolvedValue({ userId: "u1", email: "a@b.c" });
  setupFindUnique.mockResolvedValue({
    ...WORKED_CANDIDATE,
    close: 20,
    breakoutLevel: 20.2,
    rankScore: 1,
    symbol: { symbol: "AAA", exchange: "HOSE" },
  });
  tradeFindFirst.mockResolvedValue(null);
  tradeFindMany.mockResolvedValue([]);
  tradeCreate.mockImplementation(async ({ data }) => ({ id: "t1", ...data }));
  loadSymbolAdvVnd.mockResolvedValue({ ok: true, value: WORKED_ADV_VND });
  loadTerminalVerdict.mockResolvedValue({ level: "TRADE", blockedReason: null });
  getTradingAccountEquityVnd.mockResolvedValue(WORKED_EQUITY_VND);
  // 1% risk; per-trade cap 100% so the risk budget binds, as in the fixture.
  getPositionSizingConfig.mockResolvedValue({ riskPerTradePct: 0.01, maxPositionPct: 1, liquidityCapPct: 0.1 });
  loadSetupTradeSuggestion.mockImplementation(async ({ verdictLevel }) => loaded(verdictLevel));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("previewTradeLevelsForSetup — returns the suggestion's own numbers", () => {
  it("equals the suggestion F2 shows for the same setup", async () => {
    const r = workedSuggestion();
    if (!r.ok || !r.suggestion.size) throw new Error("fixture must build a sized suggestion");
    const s = r.suggestion;
    const size = r.suggestion.size;

    const preview = await previewTradeLevelsForSetup(WORKED_CANDIDATE.id);

    if (!preview.ok) throw new Error(preview.message);
    expect(preview.ticket.entryKvnd).toBe(s.entryZone.high); // 20.20
    expect(preview.ticket.entryZone).toEqual(s.entryZone); // 19.60–20.20
    expect(preview.ticket.stopKvnd).toBe(s.stopZone.low); // 18.60
    expect(preview.ticket.targets).toEqual(s.targets.map((t) => ({ r: t.r, priceKvnd: t.price })));
    expect(preview.ticket.shares).toBe(size.shares); // 3,300
    expect(preview.ticket.worstCaseLossVnd).toBe(size.worstCaseLossVnd); // 9,830,040
  });

  it("builds it with the server's own session verdict", async () => {
    loadTerminalVerdict.mockResolvedValue({ level: "PROBE", blockedReason: null });
    await previewTradeLevelsForSetup(WORKED_CANDIDATE.id);
    expect(loadSetupTradeSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", verdictLevel: "PROBE" })
    );
  });

  it("a suggestion that cannot be computed reads 'Không đủ dữ liệu' with the reason", async () => {
    loadSetupTradeSuggestion.mockResolvedValue({
      result: { ok: false, reason: "TOO_FEW_BARS", detail: "mới có 30 phiên giá, cần ít nhất 65" },
      sizingUnavailable: null,
      sizingInput: null,
      advVnd: null,
      errors: [],
    });
    expect(await previewTradeLevelsForSetup(WORKED_CANDIDATE.id)).toEqual({
      ok: false,
      message: "Không đủ dữ liệu — mới có 30 phiên giá, cần ít nhất 65",
    });
  });
});

describe("createTradeFromSetup — logs what the ticket showed, checked by the server", () => {
  const suggested = {
    confirmedEntryPrice: "20.2",
    confirmedStopLoss: "18.6",
    confirmedTakeProfit: "23.65",
    confirmedQuantity: "3300",
  };

  it("accepts the suggestion-sized order and records its numbers", async () => {
    const state = await createTradeFromSetup(undefined, form(suggested));

    expect(state).toMatchObject({ success: true });
    const data = tradeCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      entryPrice: 20.2,
      stopLoss: 18.6,
      takeProfit: 23.65,
      quantity: 3300,
      // 3,300 × 20.20 kVND × 1000
      positionSize: 66_660_000,
    });
  });

  it("saves the suggestion as it stood, time-stamped, next to the setup snapshot", async () => {
    const before = Date.now();
    await createTradeFromSetup(undefined, form(suggested));
    const data = tradeCreate.mock.calls[0]![0].data;
    const r = workedSuggestion();
    if (!r.ok) throw new Error("fixture");

    expect(data.suggestionSnapshot).toEqual({ schemaVersion: 1, targetR: 2, suggestion: r.suggestion });
    expect(data.suggestionSnapshotAt).toBeInstanceOf(Date);
    expect(data.suggestionSnapshotAt.getTime()).toBeGreaterThanOrEqual(before);
    // The setup snapshot keeps the fields the nightly health check reads.
    expect(data.setupSnapshot).toMatchObject({ breakoutLevel: 20.2, pullbackZoneLow: 19.6, pullbackZoneHigh: 20.2 });
  });

  it("blank fields fall back to the suggestion: stop 18.60, 2R 23.65, 3,300 cp", async () => {
    await createTradeFromSetup(undefined, form({ confirmedEntryPrice: "20.2" }));
    expect(tradeCreate.mock.calls[0]![0].data).toMatchObject({ stopLoss: 18.6, takeProfit: 23.65, quantity: 3300 });
  });

  it("keeps the user's edits: a custom target is recorded with no R label", async () => {
    await createTradeFromSetup(
      undefined,
      form({ ...suggested, confirmedStopLoss: "18.7", confirmedTakeProfit: "24", confirmedQuantity: "2000" })
    );
    const data = tradeCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ stopLoss: 18.7, takeProfit: 24, quantity: 2000 });
    expect(data.suggestionSnapshot.targetR).toBeNull();
  });

  it("refuses more than its own worst-case ceiling (the bare stop distance would allow 6,200)", async () => {
    const state = await createTradeFromSetup(undefined, form({ ...suggested, confirmedQuantity: "6200" }));
    expect(state?.errors?.confirmedQuantity?.[0]).toContain("3.300");
    expect(tradeCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the 20-session average cannot be read", async () => {
    loadSymbolAdvVnd.mockResolvedValue({ ok: false, error: "timeout" });
    const state = await createTradeFromSetup(undefined, form(suggested));
    expect(state?.message).toContain("timeout");
    expect(tradeCreate).not.toHaveBeenCalled();
  });

  it("refuses a stop at or above the entry, and a target at or below it", async () => {
    const stop = await createTradeFromSetup(undefined, form({ ...suggested, confirmedStopLoss: "20.2" }));
    expect(stop?.errors?.confirmedStopLoss).toBeTruthy();
    const target = await createTradeFromSetup(undefined, form({ ...suggested, confirmedTakeProfit: "20.2" }));
    expect(target?.errors?.confirmedTakeProfit).toBeTruthy();
    expect(tradeCreate).not.toHaveBeenCalled();
  });

  it("refuses when the suggestion cannot be computed", async () => {
    loadSetupTradeSuggestion.mockResolvedValue({
      result: { ok: false, reason: "TOO_FEW_BARS", detail: "mới có 30 phiên giá, cần ít nhất 65" },
      sizingUnavailable: null,
      sizingInput: null,
      advVnd: null,
      errors: [],
    });
    const state = await createTradeFromSetup(undefined, form(suggested));
    expect(state?.message).toContain("mới có 30 phiên giá");
    expect(tradeCreate).not.toHaveBeenCalled();
  });
});

describe("the ticket's live ceiling and the server agree (#17 follow-up)", () => {
  async function ticket() {
    const preview = await previewTradeLevelsForSetup(WORKED_CANDIDATE.id);
    if (!preview.ok || !preview.ticket.ceiling) throw new Error("expected a ticket with a ceiling");
    return preview.ticket;
  }

  it("entry raised to 20.50: the ticket shows 3,000 cp; the server accepts 3,000 and refuses 3,100", async () => {
    // 1.90 + 20.50 × 0.0015 + 18.60 × 0.0025 + 18.60 × 7% = 3.27925 kVND
    // → 10,000,000 / 3,279.25 = 3,049.5 → 3,000 cp.
    const t = await ticket();
    const ceiling = ticketShareCeiling(t.ceiling!, 20.5, 18.6);
    expect(ceiling).toMatchObject({ ok: true, shares: 3000 });

    const edited = { confirmedEntryPrice: "20.5", confirmedStopLoss: "18.6", confirmedTakeProfit: "23.65" };
    const over = await createTradeFromSetup(undefined, form({ ...edited, confirmedQuantity: "3100" }));
    expect(over?.errors?.confirmedQuantity?.[0]).toContain("3.000");
    const at = await createTradeFromSetup(undefined, form({ ...edited, confirmedQuantity: "3000" }));
    expect(at).toMatchObject({ success: true });
  });

  it("stop lowered to 18.00: the ticket shows 2,800 cp; the server accepts 2,800 and refuses 2,900", async () => {
    // 2.20 + 0.0303 + 0.045 + 18.00 × 7% = 3.5353 kVND → 10,000,000 / 3,535.3 = 2,828.6 → 2,800 cp.
    const t = await ticket();
    expect(ticketShareCeiling(t.ceiling!, 20.2, 18)).toMatchObject({ ok: true, shares: 2800 });

    const edited = { confirmedEntryPrice: "20.2", confirmedStopLoss: "18", confirmedTakeProfit: "23.65" };
    const over = await createTradeFromSetup(undefined, form({ ...edited, confirmedQuantity: "2900" }));
    expect(over?.errors?.confirmedQuantity).toBeTruthy();
    const at = await createTradeFromSetup(undefined, form({ ...edited, confirmedQuantity: "2800" }));
    expect(at).toMatchObject({ success: true });
  });
});

describe("no session verdict: the ticket and the server both fail closed", () => {
  const REASON = "Chưa dựng được phán quyết phiên nên không ghi lệnh mới. chưa đo được Cổng 1";

  beforeEach(() => {
    loadTerminalVerdict.mockResolvedValue({ level: null, blockedReason: "chưa đo được Cổng 1" });
  });

  it("the preview pre-fills no size and gives the server's reason", async () => {
    const preview = await previewTradeLevelsForSetup(WORKED_CANDIDATE.id);
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.ticket.shares).toBeNull();
    expect(preview.ticket.sizeNote).toBe(REASON);
  });

  it("the server refuses with the same reason", async () => {
    const state = await createTradeFromSetup(
      undefined,
      form({ confirmedEntryPrice: "20.2", confirmedStopLoss: "18.6", confirmedQuantity: "3300" })
    );
    expect(state?.message).toBe(REASON);
    expect(tradeCreate).not.toHaveBeenCalled();
  });
});
