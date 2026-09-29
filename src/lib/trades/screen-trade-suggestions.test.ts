import { describe, expect, it, vi } from "vitest";

// The builder throws for one setup only, as an unexpected bug would.
vi.mock("@/lib/trades/trade-suggestion", () => ({
  buildTradeSuggestion: vi.fn((input: { setup: { stopLevel: number } }) => {
    if (input.setup.stopLevel === 666) throw new Error("boom");
    return { ok: false, reason: "TOO_FEW_BARS", detail: "mới có 0 phiên giá, cần ít nhất 65" };
  }),
}));

import { buildScreenTradeSuggestions, type SuggestionCandidate } from "./screen-trade-suggestions";

function candidate(id: string, stopLevel: number): SuggestionCandidate {
  return {
    id,
    symbolId: `sym_${id}`,
    pullbackZoneLow: 26.9,
    pullbackZoneHigh: 27.4,
    stopLevel,
    barDate: new Date(Date.UTC(2026, 7, 25)),
    quality: "A",
    reasons: [],
  };
}

describe("buildScreenTradeSuggestions", () => {
  it("one throwing build becomes that row's BUILD_FAILED; the other rows are still built", () => {
    const bySetupId = buildScreenTradeSuggestions({
      candidates: [candidate("a", 25.8), candidate("bad", 666), candidate("c", 25.8)],
      barsBySymbolId: new Map(),
      exchangeBySymbolId: new Map(),
      prospectiveN: 12,
      market: {
        latestSession: null,
        expectedSession: null,
        gate1Level: "PASS",
        advBySymbolId: new Map(),
        sizing: null,
      },
    });

    expect(bySetupId.size).toBe(3);
    expect(bySetupId.get("bad")).toEqual({
      ok: false,
      reason: "BUILD_FAILED",
      detail: "lỗi khi dựng gợi ý lệnh: boom",
    });
    expect(bySetupId.get("a")).toMatchObject({ ok: false, reason: "TOO_FEW_BARS" });
    expect(bySetupId.get("c")).toMatchObject({ ok: false, reason: "TOO_FEW_BARS" });
  });
});
