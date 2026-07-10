import { describe, expect, it } from "vitest";
import { computeTrailingUpdate, type TrailingInput } from "@/lib/paper-lab/engine/trailing";

const base: TrailingInput = {
  avgEntryKvnd: 20,
  stopLossKvnd: 18, // R = 2
  initialRiskPerShareKvnd: 2,
  highWaterMarkKvnd: 20,
  trailingStopKvnd: 18,
  maxFavorableExcursionKvnd: 0,
  maxAdverseExcursionKvnd: 0,
  bar: { low: 19.5, high: 20.5, close: 20 },
  trailingEnabled: true,
  breakevenAtR: 1,
};

describe("computeTrailingUpdate", () => {
  it("updates the high-water mark from the bar high", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 19, high: 22, close: 21 } });
    expect(u.highWaterMarkKvnd).toBe(22);
  });

  it("accumulates MFE/MAE from the bar high/low (kVND per share)", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 19, high: 23, close: 21 } });
    expect(u.maxFavorableExcursionKvnd).toBe(3); // 23 - 20
    expect(u.maxAdverseExcursionKvnd).toBe(1); // 20 - 19
  });

  it("raises to breakeven once breakevenAtR is reached", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 20, high: 22, close: 21.5 } }); // (22-20)/2 = 1 >= 1
    expect(u.raisedToBreakeven).toBe(true);
    expect(u.trailingStopKvnd).toBe(20); // max(breakeven 20, hwm-R = 22-2 = 20)
    expect(u.effectiveStopKvnd).toBe(20);
  });

  it("trails 1R below the high-water mark on strong runs", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 24, high: 25, close: 24.5 } }); // hwm 25 → giveback 23
    expect(u.trailingStopKvnd).toBe(23);
  });

  it("never lowers the trailing stop", () => {
    const alreadyRaised = { ...base, trailingStopKvnd: 23, highWaterMarkKvnd: 25 };
    const u = computeTrailingUpdate({ ...alreadyRaised, bar: { low: 21, high: 21.5, close: 21 } });
    expect(u.trailingStopKvnd).toBe(23); // stays; does not drop
  });

  it("does not raise before breakeven is reached", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 20, high: 20.5, close: 20.2 } }); // (20.5-20)/2 = 0.25 < 1
    expect(u.raisedToBreakeven).toBe(false);
    expect(u.trailingStopKvnd).toBe(18);
    expect(u.effectiveStopKvnd).toBe(18);
  });

  it("is deterministic and uses only the provided bar", () => {
    const a = computeTrailingUpdate({ ...base, bar: { low: 19, high: 24, close: 23 } });
    const b = computeTrailingUpdate({ ...base, bar: { low: 19, high: 24, close: 23 } });
    expect(a).toEqual(b);
  });

  it("falls back safely when highWaterMark/trailing/initialRisk are null", () => {
    const u = computeTrailingUpdate({
      ...base,
      initialRiskPerShareKvnd: null,
      highWaterMarkKvnd: null,
      trailingStopKvnd: null,
      bar: { low: 19, high: 22, close: 21 },
    });
    expect(u.highWaterMarkKvnd).toBe(22);
    expect(u.effectiveStopKvnd).toBeGreaterThanOrEqual(18);
  });
});
