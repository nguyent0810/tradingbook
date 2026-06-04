import { describe, expect, it } from "vitest";
import {
  buildMarketContextCockpitChips,
  buildSymbolContextEvidenceLines,
} from "@/lib/market/build-market-context-evidence";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";

const prodLikeContext: MarketContextUiDto = {
  sessionDate: "2026-06-03",
  available: true,
  market: {
    foreignNetValue1d: -458_371_893_440,
    foreignNetValue5d: null,
    foreignNetValue10d: null,
    foreignSymbolsOk: 159,
    foreignSymbolsTotal: 206,
    foreignCoveragePct: 77.18,
    gate1Level: "PASS",
    vnindexVolRatioMa20: 1.1,
  },
  bySymbol: {},
};

describe("buildMarketContextCockpitChips", () => {
  it("shows Foreign 1D and coverage for prod-like snapshot", () => {
    const chips = buildMarketContextCockpitChips(prodLikeContext);
    expect(chips.map((c) => c.id)).toEqual([
      "market_foreign_1d",
      "market_foreign_coverage",
    ]);
    expect(chips[0]?.display).toBe("−458.37B ₫ net");
    expect(chips[0]?.hint).toContain("5D/10D");
    expect(chips[1]?.display).toBe("159/206 OK (77%)");
  });

  it("omits 5D/10D chips while rollups are null", () => {
    const chips = buildMarketContextCockpitChips(prodLikeContext);
    expect(chips.some((c) => c.id === "market_foreign_5d")).toBe(false);
    expect(chips.some((c) => c.id === "market_foreign_10d")).toBe(false);
  });

  it("includes 5D/10D chips when rollups exist", () => {
    const chips = buildMarketContextCockpitChips({
      ...prodLikeContext,
      market: {
        ...prodLikeContext.market!,
        foreignNetValue5d: -100_000_000_000,
        foreignNetValue10d: 50_000_000_000,
      },
    });
    expect(chips.map((c) => c.id)).toContain("market_foreign_5d");
    expect(chips.map((c) => c.id)).toContain("market_foreign_10d");
    expect(chips.find((c) => c.id === "market_foreign_1d")?.hint).toBeUndefined();
  });

  it("returns empty when context unavailable", () => {
    expect(buildMarketContextCockpitChips(null)).toEqual([]);
    expect(
      buildMarketContextCockpitChips({ ...prodLikeContext, available: false, market: null })
    ).toEqual([]);
  });
});

describe("buildSymbolContextEvidenceLines", () => {
  it("shows Foreign 1D and vol context for OK symbol", () => {
    const lines = buildSymbolContextEvidenceLines({
      foreignNetValue1d: -12_400_000_000,
      foreignNetValue5d: null,
      foreignNetValue10d: null,
      foreignDataQuality: "OK",
      volRatioMa20: 1.35,
    });
    expect(lines).toEqual(["Foreign 1D: −12.40B ₫ net", "Vol 1.4× MA20 (context)"]);
  });

  it("shows ALL_ZERO label without numeric foreign lines", () => {
    expect(
      buildSymbolContextEvidenceLines({
        foreignNetValue1d: 0,
        foreignNetValue5d: null,
        foreignNetValue10d: null,
        foreignDataQuality: "ALL_ZERO",
        volRatioMa20: null,
      })
    ).toEqual(["Foreign: all zero"]);
  });

  it("shows PARTIAL label and omits numeric foreign when not OK", () => {
    expect(
      buildSymbolContextEvidenceLines({
        foreignNetValue1d: null,
        foreignNetValue5d: null,
        foreignNetValue10d: null,
        foreignDataQuality: "PARTIAL",
        volRatioMa20: 0.9,
      })
    ).toEqual(["Foreign: partial data", "Vol 0.9× MA20 (context)"]);
  });

  it("omits missing/null fields", () => {
    expect(buildSymbolContextEvidenceLines(null)).toEqual([]);
    expect(
      buildSymbolContextEvidenceLines({
        foreignNetValue1d: null,
        foreignNetValue5d: null,
        foreignNetValue10d: null,
        foreignDataQuality: "OK",
        volRatioMa20: null,
      })
    ).toEqual([]);
  });
});
