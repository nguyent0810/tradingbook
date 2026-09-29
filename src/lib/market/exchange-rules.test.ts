import { describe, expect, it } from "vitest";
import {
  clipToBand,
  resolveExchange,
  roundDownToLot,
  sessionBand,
  snapToTick,
  tickSize,
} from "./exchange-rules";

// Prices in kVND. Ticks: HOSE 10đ below 10.000đ, 50đ to 49.950đ, 100đ from
// 50.000đ; HNX and UPCoM a flat 100đ.
describe("tickSize", () => {
  it.each([
    // exchange, price (kVND), tick (kVND) — including both HOSE bracket edges
    ["HOSE", 9.99, 0.01],
    ["HOSE", 10, 0.05],
    ["HOSE", 49.95, 0.05],
    ["HOSE", 50, 0.1],
    ["HOSE", 120, 0.1],
    ["HNX", 9.5, 0.1],
    ["HNX", 60, 0.1],
    ["UPCOM", 5.5, 0.1],
  ] as const)("%s %d -> tick %d", (exchange, price, tick) => {
    expect(tickSize(price, exchange)).toBe(tick);
  });
});

describe("snapToTick", () => {
  it.each([
    // exchange, price, nearest, down, up
    ["HOSE", 9.987, 9.99, 9.98, 9.99],
    ["HOSE", 23.47, 23.45, 23.45, 23.5],
    ["HOSE", 64.37, 64.4, 64.3, 64.4],
    ["HNX", 23.47, 23.5, 23.4, 23.5],
    ["UPCOM", 8.04, 8.0, 8.0, 8.1],
  ] as const)("%s %d -> nearest %d, down %d, up %d", (exchange, price, nearest, down, up) => {
    expect(snapToTick(price, exchange, "nearest")).toBe(nearest);
    expect(snapToTick(price, exchange, "down")).toBe(down);
    expect(snapToTick(price, exchange, "up")).toBe(up);
  });

  it.each([
    ["HOSE", 9.99],
    ["HOSE", 10],
    ["HOSE", 23.45],
    ["HOSE", 50],
    ["HOSE", 64.4],
    ["HNX", 23.5],
    ["UPCOM", 8.1],
  ] as const)("leaves on-tick %s %d unchanged in every direction", (exchange, price) => {
    for (const direction of ["nearest", "down", "up"] as const) {
      expect(snapToTick(price, exchange, direction)).toBe(price);
    }
  });

  it("leaves a price already on the tick unchanged, even with float noise", () => {
    const onTick = 23.4 + 0.05; // 23.450000000000003 in IEEE-754
    expect(snapToTick(onTick, "HOSE", "down")).toBe(23.45);
    expect(snapToTick(onTick, "HOSE", "up")).toBe(23.45);
  });

  it("never snaps below the smallest quotable price (one tick)", () => {
    expect(snapToTick(0.009, "HOSE", "down")).toBe(0.01);
    expect(snapToTick(0.04, "HNX", "down")).toBe(0.1);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects a price of %d", (price) => {
    expect(() => snapToTick(price, "HOSE", "nearest")).toThrow(RangeError);
  });

  it("uses the tick of the bracket the price lands in when crossing 50.000đ", () => {
    expect(snapToTick(49.99, "HOSE", "up")).toBe(50);
    expect(snapToTick(50.03, "HOSE", "down")).toBe(50);
  });
});

describe("resolveExchange", () => {
  it.each([
    ["HOSE", "HOSE"],
    ["hnx", "HNX"],
    ["UpCoM", "UPCOM"],
  ] as const)("recognises %j as %s", (raw, exchange) => {
    expect(resolveExchange(raw)).toEqual({ exchange, assumed: false });
  });

  // Padded values are not trimmed: F7 returned no band for them before this
  // module existed, and the stored exchange codes are never padded.
  it.each([null, "", "XYZ", " HNX "])("falls back to HOSE rules and says so for %j", (raw) => {
    expect(resolveExchange(raw)).toEqual({ exchange: "HOSE", assumed: true });
  });
});

// Next-session band from the reference price: ±7% HOSE, ±10% HNX, ±15% UPCoM.
// The ceiling rounds DOWN and the floor rounds UP to the tick, so both are
// quotable prices inside the band. Worked by hand:
//   HOSE 23.45: 25.0915 -> 25.05, 21.8085 -> 21.85
//   HNX 23.4:   25.74   -> 25.7,  21.06   -> 21.1
//   UPCOM 8.0:  9.2,              6.8
//   HOSE 9.5:   10.165  -> 10.15 (tick 50 above 10.000đ), 8.835 -> 8.84 (tick 10)
describe("sessionBand", () => {
  it.each([
    ["HOSE", 23.45, 7, 21.85, 25.05],
    ["HNX", 23.4, 10, 21.1, 25.7],
    ["UPCOM", 8.0, 15, 6.8, 9.2],
    ["HOSE", 9.5, 7, 8.84, 10.15],
  ] as const)("%s ref %d -> ±%d%%, floor %d, ceiling %d", (exchange, ref, bandPct, floor, ceiling) => {
    expect(sessionBand(ref, exchange)).toEqual({ bandPct, floor, ceiling });
  });

  // HOSE trading rules: when a rounded limit equals the reference price, it
  // moves one tick away from it. Only very low prices hit this:
  //   HOSE 100đ:  107đ -> 100đ = ref -> 110đ;  93đ -> 100đ = ref -> 90đ
  //   UPCOM 200đ: 230đ -> 200đ = ref -> 300đ; 170đ -> 200đ = ref -> 100đ
  it.each([
    ["HOSE", 0.1, 0.09, 0.11],
    ["UPCOM", 0.2, 0.1, 0.3],
  ] as const)("moves a limit that rounds onto the reference one tick away (%s %d)", (exchange, ref, floor, ceiling) => {
    expect(sessionBand(ref, exchange)).toMatchObject({ floor, ceiling });
  });

  it("treats an off-tick reference (e.g. a stored adjusted close) as its nearest tick", () => {
    expect(sessionBand(23.47, "HOSE")).toEqual(sessionBand(23.45, "HOSE"));
  });

  // A reference of one tick has no lower quotable price, so it has no floor.
  it.each([
    [0, "HOSE"],
    [-5, "HOSE"],
    [Number.NaN, "HOSE"],
    [0.01, "HOSE"],
    [0.001, "HOSE"],
    [0.1, "HNX"],
  ] as const)("rejects a reference price of %d on %s", (ref, exchange) => {
    expect(() => sessionBand(ref, exchange)).toThrow(RangeError);
  });
});


describe("clipToBand", () => {
  const band = { bandPct: 7, floor: 21.85, ceiling: 25.05 };

  it.each([
    [26, 25.05],
    [20, 21.85],
    [23.5, 23.5],
    [25.05, 25.05],
  ])("clips %d to %d", (price, expected) => {
    expect(clipToBand(price, band)).toBe(expected);
  });
});

describe("roundDownToLot", () => {
  it.each([
    [1999, 1900],
    [250.7, 200],
    [100, 100],
    [99, 0],
    [0, 0],
    [-300, 0],
    [Number.NaN, 0],
  ])("rounds %d shares down to %d", (shares, expected) => {
    expect(roundDownToLot(shares)).toBe(expected);
  });
});
