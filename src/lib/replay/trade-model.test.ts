import { describe, expect, it } from "vitest";
import { simulateTrade, type TradeBar } from "./trade-model";

function bar(iso: string, o: number, h: number, l: number, c: number): TradeBar {
  return { date: new Date(`${iso}T00:00:00.000Z`), open: o, high: h, low: l, close: c, volume: 1_000 };
}

/** `count` flat sessions starting the day after `startIso`, at `price`. */
function flat(startIso: string, count: number, price: number): TradeBar[] {
  const out: TradeBar[] = [];
  let t = Date.parse(`${startIso}T00:00:00.000Z`);
  for (let i = 0; i < count; i++) {
    t += 86_400_000;
    out.push(bar(new Date(t).toISOString().slice(0, 10), price, price, price, price));
  }
  return out;
}

describe("simulateTrade — entry", () => {
  it("enters at the NEXT session's open, never the signal close", () => {
    // The decision consumed the signal bar's close, so that close was not
    // purchasable. Entering there would book a fill nobody could have got.
    const future = [bar("2024-07-01", 100, 101, 99, 100), ...flat("2024-07-01", 20, 100)];
    const r = simulateTrade({ futureBars: future, stopPrice: 95 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trade.entryPrice).toBe(100);
      expect(r.trade.entryDate).toBe("2024-07-01");
    }
  });

  it("refuses when there is no bar to enter on", () => {
    expect(simulateTrade({ futureBars: [], stopPrice: 95 })).toMatchObject({ reason: "no_entry_bar" });
  });

  it("refuses when the holding horizon does not fit — no partial scoring", () => {
    const future = [bar("2024-07-01", 100, 101, 99, 100), ...flat("2024-07-01", 5, 100)];
    expect(simulateTrade({ futureBars: future, stopPrice: 95 })).toMatchObject({
      reason: "insufficient_forward_bars",
    });
  });

  it("refuses a signal whose stop is not below entry", () => {
    const future = [bar("2024-07-01", 100, 101, 99, 100), ...flat("2024-07-01", 20, 100)];
    expect(simulateTrade({ futureBars: future, stopPrice: 100 })).toMatchObject({
      reason: "non_positive_risk",
    });
  });
});

describe("simulateTrade — exits", () => {
  it("time-exits at the 20th session close when the stop is never touched", () => {
    const future = [bar("2024-07-01", 100, 100, 100, 100), ...flat("2024-07-01", 20, 110)];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trade.exitReason).toBe("TIME_EXIT");
      expect(r.trade.sessionsHeld).toBe(20);
      expect(r.trade.exitPrice).toBe(110);
      expect(r.trade.rMultiple).toBeCloseTo(1, 6); // +10 gain on 10 risk
    }
  });

  it("stops out on the first session that trades through the stop", () => {
    const future = [
      bar("2024-07-01", 100, 100, 100, 100),
      bar("2024-07-02", 99, 100, 98, 99),
      bar("2024-07-03", 98, 99, 89, 90), // pierces 90
      ...flat("2024-07-03", 20, 95),
    ];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trade.exitReason).toBe("STOP_HIT");
      expect(r.trade.sessionsToStop).toBe(2);
      expect(r.trade.rMultiple).toBeCloseTo(-1, 6);
    }
  });

  it("fills a gap-down below the stop at the open, not at the stop", () => {
    // Assuming the stop price on a gap would understate the loss.
    const future = [
      bar("2024-07-01", 100, 100, 100, 100),
      bar("2024-07-02", 80, 82, 79, 81), // gaps straight through 90
      ...flat("2024-07-02", 20, 81),
    ];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trade.exitPrice).toBe(80);
      expect(r.trade.rMultiple).toBeCloseTo(-2, 6);
    }
  });

  it("does not let a later recovery undo a stop that already triggered", () => {
    const future = [
      bar("2024-07-01", 100, 100, 100, 100),
      bar("2024-07-02", 99, 100, 85, 86),
      ...flat("2024-07-02", 20, 200),
    ];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trade.exitReason).toBe("STOP_HIT");
  });
});

describe("simulateTrade — excursions", () => {
  it("measures MFE and MAE against the entry fill", () => {
    const future = [
      bar("2024-07-01", 100, 100, 100, 100),
      bar("2024-07-02", 100, 120, 95, 110),
      ...flat("2024-07-02", 20, 105),
    ];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.trade.mfePct).toBeCloseTo(20, 6);
      expect(r.trade.maePct).toBeCloseTo(-5, 6);
    }
  });

  it("stops measuring excursions once the trade has exited", () => {
    // A 300% run after the stop is not the trade's MFE.
    const future = [
      bar("2024-07-01", 100, 100, 100, 100),
      bar("2024-07-02", 99, 101, 85, 86),
      ...flat("2024-07-02", 20, 400),
    ];
    const r = simulateTrade({ futureBars: future, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trade.mfePct).toBeLessThan(5);
  });
});
