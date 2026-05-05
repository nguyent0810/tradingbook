import { describe, expect, it } from "vitest";
import {
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

  it("rejects entry at or below stop", () => {
    const r = computePositionSizing({ ...base, entryKVnd: 95, stopKVnd: 97 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("ENTRY_NOT_ABOVE_STOP");
  });
});
