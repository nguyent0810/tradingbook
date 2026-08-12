import { describe, expect, it } from "vitest";
import {
  computeAtr,
  computeMinStopFrac,
  MIN_STOP_ATR_MULTIPLE,
  ROUND_TRIP_FEE_FRAC,
  tickSizeVnd,
} from "./stop-feasibility";

describe("tickSizeVnd", () => {
  it("applies the HOSE band table", () => {
    expect(tickSizeVnd(9_990)).toBe(10);
    expect(tickSizeVnd(10_000)).toBe(50);
    expect(tickSizeVnd(49_950)).toBe(50);
    expect(tickSizeVnd(50_000)).toBe(100);
  });

  it("quotes HNX and UPCOM flat at 100", () => {
    expect(tickSizeVnd(9_990, "HNX")).toBe(100);
    expect(tickSizeVnd(9_990, "UPCOM")).toBe(100);
  });

  it("defaults to the finest board, so an unknown exchange never over-rejects", () => {
    // `exchange` is NULL for almost every symbol in this database. Defaulting to
    // HOSE yields the smallest tick, hence the most permissive floor.
    expect(tickSizeVnd(9_990)).toBeLessThan(tickSizeVnd(9_990, "HNX"));
  });
});

describe("computeAtr", () => {
  it("returns null rather than 0 when history is too short", () => {
    // 0 would read as "no volatility constraint" and silently remove the floor
    // that usually binds.
    expect(computeAtr([{ high: 2, low: 1, close: 1.5 }], 14)).toBeNull();
  });

  it("includes the gap from the prior close, not just the intraday range", () => {
    const bars = [
      { high: 10, low: 10, close: 10 },
      // Intraday range is 0.5, but price gapped 5 from the prior close.
      { high: 15.5, low: 15, close: 15 },
    ];
    expect(computeAtr(bars, 1)).toBeCloseTo(5.5, 6);
  });

  it("averages true range over the requested period", () => {
    const bars = [
      { high: 10, low: 9, close: 10 },
      { high: 11, low: 10, close: 11 },
      { high: 12, low: 11, close: 12 },
    ];
    expect(computeAtr(bars, 2)).toBeCloseTo(1, 6);
  });
});

describe("computeMinStopFrac", () => {
  it("reports which floor binds, not just the number", () => {
    // A rejected setup is only actionable if you know why it was rejected.
    const r = computeMinStopFrac({ entryPrice: 21.87, atr: 0.8 });
    expect(r.binding).toBe("volatility");
    expect(r.components.volatility).toBeCloseTo((1.0 * 0.8) / 21.87, 6);
  });

  it("drops to the next floor when volatility is unavailable, never to zero", () => {
    // At 21.87 kVND the tick floor is 2×50/21870 = 0.457%, already above the fee
    // floor — so on a mid-priced share microstructure binds before cost does.
    const mid = computeMinStopFrac({ entryPrice: 21.87, atr: null });
    expect(mid.components.volatility).toBeNull();
    expect(mid.binding).toBe("tick");
    expect(mid.minStopFrac).toBeCloseTo(0.1 / 21.87, 6);

    // On an expensive share the tick is proportionally smaller, so cost binds.
    const dear = computeMinStopFrac({ entryPrice: 60, atr: null });
    expect(dear.binding).toBe("fee");
    expect(dear.minStopFrac).toBe(ROUND_TRIP_FEE_FRAC);
  });

  it("lets the tick floor bind on a cheap stock with tiny volatility", () => {
    // 2 ticks of 100 VND on a 9,000 VND HNX share is 2.22%, above both the fee
    // floor and a very low ATR.
    const r = computeMinStopFrac({ entryPrice: 9, atr: 0.05, board: "HNX" });
    expect(r.binding).toBe("tick");
    expect(r.minStopFrac).toBeCloseTo(0.2 / 9, 6);
  });

  it("always exceeds the current 0.3% floor for a realistic VN candidate", () => {
    // The defect being fixed: 0.3% permits ~1.3 ticks at the median entry price.
    const r = computeMinStopFrac({ entryPrice: 21.87, atr: 0.55 });
    expect(r.minStopFrac).toBeGreaterThan(0.003);
  });

  it("is monotonic in ATR", () => {
    const lo = computeMinStopFrac({ entryPrice: 30, atr: 0.5 }).minStopFrac;
    const hi = computeMinStopFrac({ entryPrice: 30, atr: 1.5 }).minStopFrac;
    expect(hi).toBeGreaterThan(lo);
  });

  it("rejects a non-positive entry price instead of returning a nonsense floor", () => {
    expect(() => computeMinStopFrac({ entryPrice: 0, atr: 1 })).toThrow(/entryPrice/);
  });

  it("keeps the ATR multiple at the weakest defensible value", () => {
    // Guards against the multiple being quietly raised to improve a backtest:
    // anything above 1.0 is a strategy claim needing its own evidence.
    expect(MIN_STOP_ATR_MULTIPLE).toBe(1.0);
  });
});
