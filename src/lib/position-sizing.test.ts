import { describe, expect, it } from "vitest";
import {
  POSITION_SIZING_DEFAULTS,
  computePositionSizing,
  kVndToPerShareVnd,
  qualityRiskMultiplier,
} from "./position-sizing";

describe("qualityRiskMultiplier", () => {
  it("B is half of A", () => {
    expect(qualityRiskMultiplier("A")).toBe(1);
    expect(qualityRiskMultiplier("B")).toBe(0.5);
  });
});

describe("kVndToPerShareVnd", () => {
  it("multiplies by 1000", () => {
    expect(kVndToPerShareVnd(28.5)).toBe(28500);
  });
});

describe("computePositionSizing", () => {
  const base = {
    accountEquityVnd: 1_000_000_000,
    maxPortfolioExposurePct: 1,
    currentPortfolioExposureVnd: 0,
    maxPerTradeExposurePct: 1,
    baseRiskPerTradePct: 0.01,
    quality: "A" as const,
    entryKVnd: 100,
    stopKVnd: 97,
  };

  it("computes Q_raw from risk / per-share risk", () => {
    const r = computePositionSizing(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.perShareRiskVnd).toBe(3000);
    expect(r.value.riskBudgetVnd).toBe(10_000_000);
    expect(r.value.qRaw).toBeCloseTo(10_000_000 / 3000);
    expect(r.value.qFinalShares).toBe(Math.floor(r.value.qRaw));
  });

  it("Tier B halves risk budget vs A", () => {
    const a = computePositionSizing(base);
    const b = computePositionSizing({ ...base, quality: "B" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.value.riskBudgetVnd).toBeCloseTo(a.value.riskBudgetVnd * 0.5);
  });

  it("caps by remaining portfolio exposure", () => {
    const r = computePositionSizing({
      ...base,
      maxPortfolioExposurePct: 0.5,
      currentPortfolioExposureVnd: 450_000_000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ceiling = 500_000_000;
    const remaining = ceiling - 450_000_000;
    const capShares = remaining / kVndToPerShareVnd(100);
    expect(r.value.qFinalShares).toBe(Math.floor(Math.min(r.value.qRaw, capShares)));
  });

  it("caps by max per-trade exposure", () => {
    const r = computePositionSizing({
      ...base,
      maxPerTradeExposurePct: 0.05,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const capShares = (base.accountEquityVnd * 0.05) / kVndToPerShareVnd(100);
    expect(r.value.qFinalShares).toBe(Math.floor(Math.min(r.value.qRaw, capShares)));
  });

  it("reports exposure after trade and remaining bucket", () => {
    const r = computePositionSizing({
      ...base,
      maxPortfolioExposurePct: 0.7,
      currentPortfolioExposureVnd: 100_000_000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.exposureAfterTradeVnd).toBeCloseTo(
      100_000_000 + r.value.notionalVnd,
      -3
    );
    expect(r.value.remainingExposureAfterTradeVnd).toBeCloseTo(
      base.accountEquityVnd * 0.7 - r.value.exposureAfterTradeVnd,
      -3
    );
  });

  it("does not constrain sizing when liquidityCapPct is unset", () => {
    const withoutCap = computePositionSizing(base);
    const withNullCap = computePositionSizing({ ...base, liquidityCapPct: null, symbolAvgDailyValueVnd: null });
    expect(withoutCap.ok && withNullCap.ok).toBe(true);
    if (!withoutCap.ok || !withNullCap.ok) return;
    expect(withNullCap.value.qFinalShares).toBe(withoutCap.value.qFinalShares);
    expect(withNullCap.value.liquidityCapBinding).toBe(false);
  });

  it("caps by liquidity (% of ADV) when it is the tightest constraint", () => {
    // ADV small enough that 10% of it is far below the risk/exposure-based caps.
    const r = computePositionSizing({
      ...base,
      liquidityCapPct: 0.1,
      symbolAvgDailyValueVnd: 50_000_000, // 10% => 5,000,000 VND notional cap
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const expectedShares = Math.floor(5_000_000 / kVndToPerShareVnd(100));
    expect(r.value.qFinalShares).toBe(expectedShares);
    expect(r.value.liquidityCapBinding).toBe(true);
  });

  it("rejects a non-finite liquidityCapPct instead of silently poisoning the result with NaN", () => {
    const nan = computePositionSizing({ ...base, liquidityCapPct: Number.NaN, symbolAvgDailyValueVnd: 50_000_000 });
    expect(nan.ok).toBe(false);
    if (nan.ok) return;
    expect(nan.code).toBe("INVALID_INPUT");

    const inf = computePositionSizing({ ...base, liquidityCapPct: Number.POSITIVE_INFINITY, symbolAvgDailyValueVnd: 50_000_000 });
    expect(inf.ok).toBe(false);
    if (inf.ok) return;
    expect(inf.code).toBe("INVALID_INPUT");
  });

  describe("per-share risk override (#15: R plus gap buffer)", () => {
    it("sizes the risk budget against the override instead of entry − stop", () => {
      // Budget 1e9 × 1% = 10,000,000 đ. Override 5,000 đ/cp (entry − stop is 3,000):
      //   10,000,000 / 5,000 = 2,000 shares, and the planned loss is 2,000 × 5,000.
      const r = computePositionSizing({ ...base, perShareRiskVnd: 5000 });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.perShareRiskVnd).toBe(5000);
      expect(r.value.qRaw).toBe(2000);
      expect(r.value.qFinalShares).toBe(2000);
      expect(r.value.riskAtStopVnd).toBe(10_000_000);
    });

    it("rejects a non-positive or non-finite override", () => {
      for (const bad of [0, -1, Number.NaN]) {
        const r = computePositionSizing({ ...base, perShareRiskVnd: bad });
        expect(r.ok, String(bad)).toBe(false);
      }
    });
  });

  describe("bindingCap names the constraint that set the size", () => {
    it("is null when the risk budget binds", () => {
      const r = computePositionSizing(base);
      expect(r.ok && r.value.bindingCap).toBeNull();
    });

    it("per-trade cap: 5% of 1 tỷ = 50,000,000 đ / 100,000 đ = 500 shares < 3,333", () => {
      const r = computePositionSizing({ ...base, maxPerTradeExposurePct: 0.05 });
      expect(r.ok && r.value.bindingCap).toBe("per_trade_exposure");
    });

    it("portfolio cap: 50% of 1 tỷ − 450,000,000 đ open = 50,000,000 đ → 500 shares", () => {
      const r = computePositionSizing({
        ...base,
        maxPortfolioExposurePct: 0.5,
        currentPortfolioExposureVnd: 450_000_000,
      });
      expect(r.ok && r.value.bindingCap).toBe("portfolio_exposure");
    });

    it("liquidity cap: 10% of 50,000,000 đ ADV = 5,000,000 đ → 50 shares", () => {
      const r = computePositionSizing({ ...base, liquidityCapPct: 0.1, symbolAvgDailyValueVnd: 50_000_000 });
      expect(r.ok && r.value.bindingCap).toBe("liquidity");
    });
  });

  it("rejects entry at or below stop", () => {
    const r = computePositionSizing({ ...base, entryKVnd: 95, stopKVnd: 97 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("ENTRY_NOT_ABOVE_STOP");
  });
});

describe("mặc định định cỡ dùng chung", () => {
  it("màn hình và server phải đọc CÙNG một bộ hằng", () => {
    // Chốt giá trị để một lần sửa nhầm không lặng lẽ làm hai phía tính khác nhau.
    expect(POSITION_SIZING_DEFAULTS).toEqual({
      maxPortfolioExposurePct: 0.7,
      maxPerTradeExposurePct: 0.2,
      baseRiskPerTradePct: 0.01,
      liquidityCapPct: 0.1,
    });
  });
});
