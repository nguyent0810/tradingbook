import { describe, expect, it } from "vitest";
import { kVndToPerShareVnd } from "@/lib/position-sizing";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import {
  applyLiquidityCap,
  applySlippageGapBuffer,
  buildRecommendedPositionSizing,
  computeAdvVnd,
  DEFAULT_BASE_RISK_PER_TRADE_PCT,
  DEFAULT_MAX_PER_TRADE_EXPOSURE_PCT,
  floorToBoardLot,
  LIQUIDITY_CAP_PCT_OF_ADV,
  SLIPPAGE_GAP_BUFFER_PCT,
  VN_BOARD_LOT_SHARES,
  type PositionSizingCandidateInput,
} from "./position-sizing-panel";

const baseParams = {
  confidenceBand: "high" as const,
  accountEquityVnd: 1_000_000_000,
  currentPortfolioExposureVnd: 0,
  maxPortfolioExposurePct: 0.7,
};

function candidate(
  overrides: Partial<PositionSizingCandidateInput> = {}
): PositionSizingCandidateInput {
  return {
    symbolKey: "HPG",
    quality: "A",
    ladderStage: "tier_a",
    closeKVnd: 100,
    stopKVnd: 97,
    ...overrides,
  };
}

describe("VN board-lot rounding", () => {
  it("floors a raw share count to the nearest lot of 100", () => {
    expect(floorToBoardLot(250)).toBe(200);
    expect(floorToBoardLot(199)).toBe(100);
    expect(floorToBoardLot(100)).toBe(100);
    expect(floorToBoardLot(99)).toBe(0);
  });

  it("never rounds up and never goes negative", () => {
    expect(floorToBoardLot(0)).toBe(0);
    expect(floorToBoardLot(-5)).toBe(0);
    expect(VN_BOARD_LOT_SHARES).toBe(100);
  });
});

describe("liquidity cap", () => {
  it("caps quantity when ADV data implies a smaller max than the risk-based size", () => {
    const r = applyLiquidityCap({
      qtyShares: 10_000,
      entryVndPerShare: 100_000,
      advVnd: 10_000_000_000, // 10B VND ADV -> 10% = 1B VND cap -> 10,000 shares cap... use smaller ADV
    });
    // With a huge ADV the cap shouldn't bind; use a tighter ADV instead below.
    expect(r.capApplied).toBe(false);

    const tight = applyLiquidityCap({
      qtyShares: 10_000,
      entryVndPerShare: 100_000,
      advVnd: 1_000_000_000, // 10% of 1B = 100M VND -> 1,000 shares cap
    });
    expect(tight.capApplied).toBe(true);
    expect(tight.qtyShares).toBe(1_000);
  });

  it("applies no cap and is not marked as applied when ADV is missing", () => {
    const r = applyLiquidityCap({ qtyShares: 5_000, entryVndPerShare: 50_000, advVnd: null });
    expect(r.capApplied).toBe(false);
    expect(r.qtyShares).toBe(5_000);
  });

  it("computeAdvVnd multiplies 20D avg volume by entry price in VND, null when volume missing", () => {
    expect(computeAdvVnd(100_000, 28.5)).toBe(100_000 * kVndToPerShareVnd(28.5));
    expect(computeAdvVnd(null, 28.5)).toBeNull();
    expect(computeAdvVnd(0, 28.5)).toBeNull();
  });

  it("LIQUIDITY_CAP_PCT_OF_ADV documents 10% of one day's ADV", () => {
    expect(LIQUIDITY_CAP_PCT_OF_ADV).toBe(0.1);
  });

  it("respects a custom liquidityCapPctOfAdv override instead of the 10% default", () => {
    // 5% of 1B ADV = 50M VND cap -> 500 shares at 100k/share (tighter than the 10% default's 1,000).
    const custom = applyLiquidityCap({
      qtyShares: 10_000,
      entryVndPerShare: 100_000,
      advVnd: 1_000_000_000,
      liquidityCapPctOfAdv: 0.05,
    });
    expect(custom.capApplied).toBe(true);
    expect(custom.qtyShares).toBe(500);
  });
});

describe("slippage / gap buffer", () => {
  it("widens the effective stop away from entry (more room = larger perceived risk)", () => {
    const buffered = applySlippageGapBuffer(100, 97);
    expect(buffered).toBeLessThan(97);
    expect(buffered).toBeCloseTo(97 - 100 * SLIPPAGE_GAP_BUFFER_PCT);
  });

  it("wires into the recommendation: effective per-share risk is larger than the naive (unbuffered) stop distance, so qty is smaller or equal", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;

    const rawPerShareRiskVnd = kVndToPerShareVnd(100) - kVndToPerShareVnd(97);
    // Buffer widens the effective stop distance, so real sizing risk > naive risk.
    expect(dto.perShareRiskVnd).toBeGreaterThan(rawPerShareRiskVnd);
    expect(dto.effectiveStopVndPerShare).toBeLessThan(dto.rawStopVndPerShare);

    // A naive (unbuffered) qty from the same risk budget would be risk / rawPerShareRisk;
    // the buffered qty must never exceed that naive figure.
    const riskBudgetVnd = baseParams.accountEquityVnd * DEFAULT_BASE_RISK_PER_TRADE_PCT;
    const naiveQty = Math.floor(riskBudgetVnd / rawPerShareRiskVnd);
    expect(dto.qtyBeforeAdjustmentsShares).toBeLessThanOrEqual(naiveQty);
  });
});

describe("risk defaults", () => {
  it("documents the fail-closed base risk and max-per-trade defaults", () => {
    expect(DEFAULT_BASE_RISK_PER_TRADE_PCT).toBe(0.01);
    expect(DEFAULT_MAX_PER_TRADE_EXPOSURE_PCT).toBe(0.2);
  });
});

describe("buildRecommendedPositionSizing", () => {
  it("recommends the best eligible Tier A candidate when equity + confidence are OK", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    expect(dto.symbol).toBe("HPG");
    expect(dto.qtyShares % VN_BOARD_LOT_SHARES).toBe(0);
  });

  it("honors a user-configured baseRiskPerTradePct override (smaller risk budget -> smaller or equal qty)", () => {
    const withDefault = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
    });
    const withOverride = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
      baseRiskPerTradePct: 0.0075, // 0.75% vs the 1% default
    });
    expect(withDefault).not.toBeNull();
    expect(withOverride).not.toBeNull();
    if (!withDefault || !withOverride) return;
    expect(withOverride.baseRiskPerTradePct).toBe(0.0075);
    expect(withOverride.qtyShares).toBeLessThanOrEqual(withDefault.qtyShares);
  });

  it("prefers tier_a over tier_b when both are present", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [
        candidate({ symbolKey: "SSI", ladderStage: "tier_b", quality: "B" }),
        candidate({ symbolKey: "HPG", ladderStage: "tier_a", quality: "A" }),
      ],
    });
    expect(dto?.symbol).toBe("HPG");
  });

  it("falls back to best tier_b when no tier_a candidate exists", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate({ symbolKey: "SSI", ladderStage: "tier_b", quality: "B" })],
    });
    expect(dto?.symbol).toBe("SSI");
  });

  it("gates: no recommendation when confidence band is low", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      confidenceBand: "low",
      candidates: [candidate()],
    });
    expect(dto).toBeNull();
  });

  it("gates: no recommendation when equity is not configured", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      accountEquityVnd: null,
      candidates: [candidate()],
    });
    expect(dto).toBeNull();
  });

  it("gates: no recommendation when the book cap could not be resolved", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      maxPortfolioExposurePct: null,
      candidates: [candidate()],
    });
    expect(dto).toBeNull();
  });

  it("gates: no recommendation when no eligible (tier_a/tier_b) candidate exists", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate({ ladderStage: "watch" }), candidate({ ladderStage: "avoid" })],
    });
    expect(dto).toBeNull();
  });

  it("surfaces a gap and applies no liquidity cap when volMa20 is unavailable", () => {
    const marketContext: MarketContextUiDto = {
      sessionDate: "2026-07-14",
      available: true,
      market: null,
      bySymbol: {},
    };
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
      marketContext,
    });
    expect(dto?.liquidityDataAvailable).toBe(false);
    expect(dto?.liquidityCapApplied).toBe(false);
    expect(dto?.gaps.length).toBeGreaterThan(0);
  });

  it("caps the recommended size when volMa20 implies a tighter liquidity ceiling", () => {
    const marketContext: MarketContextUiDto = {
      sessionDate: "2026-07-14",
      available: true,
      market: null,
      bySymbol: {
        HPG: {
          foreignNetValue1d: null,
          foreignNetValue5d: null,
          foreignNetValue10d: null,
          foreignDataQuality: null,
          volRatioMa20: null,
          volMa20: 50, // tiny ADV -> tight cap
        },
      },
    };
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate()],
      marketContext,
    });
    expect(dto?.liquidityDataAvailable).toBe(true);
    expect(dto?.liquidityCapApplied).toBe(true);
    expect(dto?.qtyShares).toBeLessThan(dto?.qtyBeforeAdjustmentsShares ?? Infinity);
  });

  it("gates: no recommendation when the eligible candidate's stop is above entry (broken stop)", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate({ closeKVnd: 100, stopKVnd: 105 })],
    });
    expect(dto).toBeNull();
  });

  it("gates: no recommendation at the exact boundary where the BUFFERED stop lands exactly on entry (perShareRisk === 0, using the buffered value)", () => {
    // applySlippageGapBuffer(100, 100.5) = 100.5 - 100*0.005 = 100 -> effective stop === entry,
    // i.e. perShareRisk === 0. This confirms the <= 0 rejection is evaluated against the
    // buffered stop that actually flows into computePositionSizing, not some other value.
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      candidates: [candidate({ closeKVnd: 100, stopKVnd: 100.5 })],
    });
    expect(dto).toBeNull();
  });

  it("bounds positionPctOfAccount at/under maxPerTradeExposurePct even when the stop is extremely close to entry (tiny perShareRisk -> huge qRaw)", () => {
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      // Stop only 0.1% below close -> tiny perShareRisk -> qRaw would be enormous absent caps.
      candidates: [candidate({ closeKVnd: 100, stopKVnd: 99.9 })],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    // Allow a small tolerance for board-lot floor rounding (at most one lot's worth of pct).
    const oneLotPct = (VN_BOARD_LOT_SHARES * dto.entryVndPerShare * 100) / baseParams.accountEquityVnd;
    expect(dto.positionPctOfAccount).toBeLessThanOrEqual(
      DEFAULT_MAX_PER_TRADE_EXPOSURE_PCT * 100 + oneLotPct
    );
  });

  it("qtyShares can floor to zero (less than one board lot) and the DTO clearly surfaces this via `gaps`, distinct from a null (no-recommendation) result", () => {
    // Tiny equity + wide-ish stop -> risk budget supports only a handful of shares, well under
    // one board lot of 100, so floorToBoardLot rounds the final recommendation down to 0.
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      accountEquityVnd: 2_000_000, // small equity
      candidates: [candidate({ closeKVnd: 100, stopKVnd: 90 })],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    expect(dto.qtyShares).toBe(0);
    expect(
      dto.gaps.some((g) => g.toLowerCase().includes("less than one board lot"))
    ).toBe(true);
  });

  it("liquidity cap is applied BEFORE board-lot flooring (more conservative order) — final qty differs from the wrong (floor-then-cap) order", () => {
    // Sized to produce qFinalShares = 250 before adjustments (see comment math below):
    // riskBudget = 1e9 * 0.01 = 10,000,000; perShareRisk = 40,000 VND/share -> qRaw = 250.
    // capFromPerTrade = (1e9*0.2)/100,000 = 2000; capFromRemaining = (7e8)/100,000 = 7000.
    // So computePositionSizing yields qFinalShares = 250.
    const marketContext: MarketContextUiDto = {
      sessionDate: "2026-07-14",
      available: true,
      market: null,
      bySymbol: {
        HPG: {
          foreignNetValue1d: null,
          foreignNetValue5d: null,
          foreignNetValue10d: null,
          foreignDataQuality: null,
          volRatioMa20: null,
          // advVnd = 1305 * kVndToPerShareVnd(100) = 130,500,000
          // capNotionalVnd = 10% of that = 13,050,000 -> capQtyShares = floor(13,050,000/100,000) = 130
          volMa20: 1305,
        },
      },
    };
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      // closeKVnd=100, stopKVnd chosen so the buffered effective stop is exactly 60 (perShareRisk 40,000).
      candidates: [candidate({ closeKVnd: 100, stopKVnd: 60.5 })],
      marketContext,
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    expect(dto.qtyBeforeAdjustmentsShares).toBe(250);
    expect(dto.liquidityCapApplied).toBe(true);
    // Correct order: cap 250 -> 130, THEN floor to board lot -> 100.
    // Wrong order (floor-then-cap) would give: floor 250 -> 200, THEN cap to 130 -> 130 (not a board-lot multiple).
    expect(dto.qtyShares).toBe(100);
    expect(dto.qtyShares % VN_BOARD_LOT_SHARES).toBe(0);
  });

  it("shrinks the recommended qty to at/near zero when currentPortfolioExposureVnd already sits near the book ceiling", () => {
    // Ceiling = accountEquityVnd * maxPortfolioExposurePct = 1e9 * 0.7 = 700,000,000.
    // Put current exposure within one lot's notional of that ceiling.
    const closeKVnd = 100;
    const entryVndPerShare = kVndToPerShareVnd(closeKVnd);
    const ceilingVnd = baseParams.accountEquityVnd * baseParams.maxPortfolioExposurePct;
    const currentPortfolioExposureVnd = ceilingVnd - entryVndPerShare * 50; // headroom for only 50 shares (< 1 lot)
    const dto = buildRecommendedPositionSizing({
      ...baseParams,
      currentPortfolioExposureVnd,
      candidates: [candidate({ closeKVnd, stopKVnd: 97 })],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    // Remaining book headroom (50 shares) binds qty before liquidity/board-lot adjustments even
    // touch it — confirms `currentPortfolioExposureVnd` is wired through to the remaining-exposure cap.
    expect(dto.qtyBeforeAdjustmentsShares).toBe(50);
    expect(dto.qtyShares).toBe(0); // then floored below one board lot
    const remainingHeadroomVnd = ceilingVnd - currentPortfolioExposureVnd;
    expect(dto.notionalVnd).toBeLessThanOrEqual(remainingHeadroomVnd);
  });
});
