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

describe("horizon — which bar the time exit lands on", () => {
  it("exits on the 20th session after entry, with distinguishable prices", () => {
    // Every bar priced differently, so an off-by-one changes the exit price
    // rather than hiding behind identical closes. Entry is futureBars[0]; the
    // 20th session held is futureBars[20].
    const bars: TradeBar[] = Array.from({ length: 30 }, (_, i) =>
      bar(new Date(Date.parse("2024-07-01") + i * 86_400_000).toISOString().slice(0, 10),
        100 + i, 100 + i + 0.5, 99 + i, 100 + i)
    );
    const r = simulateTrade({ futureBars: bars, stopPrice: 50 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trade.entryPrice).toBe(100);
    expect(r.trade.exitPrice).toBe(120);
    expect(r.trade.sessionsHeld).toBe(20);
  });

  it("needs the entry bar plus a full horizon before it will score", () => {
    const short = Array.from({ length: 20 }, (_, i) =>
      bar(new Date(Date.parse("2024-07-01") + i * 86_400_000).toISOString().slice(0, 10), 100, 101, 99, 100)
    );
    expect(simulateTrade({ futureBars: short, stopPrice: 50 }).ok).toBe(false);
  });
});

describe("the entry session can stop the trade out", () => {
  it("stops on the entry bar when it trades through the stop", () => {
    // The position is live from the entry open, so the entry session is the one
    // most likely to gap through the stop. Scanning from the next bar hid that.
    const bars = [bar("2024-07-01", 100, 101, 88, 90), ...flat("2024-07-01", 25, 120)];
    const r = simulateTrade({ futureBars: bars, stopPrice: 90 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trade.exitReason).toBe("STOP_HIT");
    expect(r.trade.exitDate).toBe("2024-07-01");
    expect(r.trade.sessionsToStop).toBe(0);
    expect(r.trade.sessionsHeld).toBe(0);
  });

  it("counts the entry session's excursion", () => {
    const bars = [bar("2024-07-01", 100, 108, 96, 104), ...flat("2024-07-01", 25, 100)];
    const r = simulateTrade({ futureBars: bars, stopPrice: 90 });
    expect(r.ok === true && r.trade.mfePct).toBeCloseTo(8, 6);
    expect(r.ok === true && r.trade.maePct).toBeCloseTo(-4, 6);
  });
});

describe("minRiskFrac — the floor must hold at the entry price, not the signal close", () => {
  /** Entry bar at `open`, then enough flat sessions above it to fill the horizon. */
  const path = (open: number): TradeBar[] => [
    bar("2020-07-27", open, open + 0.5, open - 0.005, open + 0.1),
    ...flat("2020-07-27", 25, open + 1),
  ];

  it("declines an entry whose gap collapsed the stop distance", () => {
    // The REE 2020-07-24 case: 3.11% of room at the signal close, then a gap
    // down to 14.58 left 0.049% — which is what produced the 286R artefact.
    const r = simulateTrade({ futureBars: path(14.58), stopPrice: 14.5728, minRiskFrac: 0.01 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("stop_not_executable_at_entry");
  });

  it("takes the same setup when the gap left enough room", () => {
    const r = simulateTrade({ futureBars: path(15.5), stopPrice: 14.5728, minRiskFrac: 0.01 });
    expect(r.ok).toBe(true);
  });

  it("scores every entry when no floor is supplied, so v1 is unaffected", () => {
    const r = simulateTrade({ futureBars: path(14.58), stopPrice: 14.5728 });
    expect(r.ok).toBe(true);
    expect(r.ok === true && r.trade.riskPct).toBeLessThan(0.1);
  });
});

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
