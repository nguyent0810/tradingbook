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
    foreignCoveragePct: 159 / 206,
    foreignFlowRollingDangerVnd: null,
    foreignFlowRolling5dDangerVnd: null,
    foreignFlowRolling10dDangerVnd: null,
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

  it("formats DB fraction foreignCoveragePct as integer percent", () => {
    const chips = buildMarketContextCockpitChips({
      ...prodLikeContext,
      market: {
        ...prodLikeContext.market!,
        foreignSymbolsOk: 159,
        foreignSymbolsTotal: 206,
        foreignCoveragePct: 0.7718,
      },
    });
    expect(chips.find((c) => c.id === "market_foreign_coverage")?.display).toBe(
      "159/206 OK (77%)"
    );
  });
  // NOTE: chip `label`/`display` text ("Foreign 1D", "Foreign cov.", "OK (%)") is
  // intentionally left in English — it cascades into
  // src/lib/dashboard/map-dashboard-v3-view-model.test.ts via exact-match
  // assertions on the mapped V3 evidence, which is out of scope for this pass.

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
      volMa20: null,
    });
    expect(lines).toEqual(["Khối ngoại 1D: −12.40B ₫ ròng", "KL 1.4× MA20 (tham khảo)"]);
  });

  it("shows ALL_ZERO label without numeric foreign lines", () => {
    expect(
      buildSymbolContextEvidenceLines({
        foreignNetValue1d: 0,
        foreignNetValue5d: null,
        foreignNetValue10d: null,
        foreignDataQuality: "ALL_ZERO",
        volRatioMa20: null,
        volMa20: null,
      })
    ).toEqual(["Khối ngoại: toàn bộ bằng 0"]);
  });

  it("shows PARTIAL label and omits numeric foreign when not OK", () => {
    expect(
      buildSymbolContextEvidenceLines({
        foreignNetValue1d: null,
        foreignNetValue5d: null,
        foreignNetValue10d: null,
        foreignDataQuality: "PARTIAL",
        volRatioMa20: 0.9,
        volMa20: null,
      })
    ).toEqual(["Khối ngoại: dữ liệu một phần", "KL 0.9× MA20 (tham khảo)"]);
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
        volMa20: null,
      })
    ).toEqual([]);
  });
});
