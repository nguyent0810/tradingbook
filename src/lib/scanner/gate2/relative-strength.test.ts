import { describe, expect, it } from "vitest";
import {
  computeRelativeReturnAtSession,
  computeRelativeStrengthDiagnostic,
  RS_LOOKBACK_20,
} from "./relative-strength";
import type { Gate2BarInput } from "./types";

function bar(day: string, close: number): Gate2BarInput {
  const [y, m, d] = day.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000_000,
  };
}

function series(
  startDay: string,
  count: number,
  closeFn: (i: number) => number
): Gate2BarInput[] {
  const [y, m, d] = startDay.split("-").map(Number);
  const out: Gate2BarInput[] = [];
  let t = Date.UTC(y!, m! - 1, d!);
  for (let i = 0; i < count; i++) {
    const dt = new Date(t);
    const c = closeFn(i);
    out.push({
      date: dt,
      open: c,
      high: c,
      low: c,
      close: c,
      volume: 1_000_000,
    });
    t += 86400000;
  }
  return out;
}

describe("computeRelativeReturnAtSession", () => {
  it("computes spread when stock outperforms index over 20 sessions", () => {
    const stock = series("2026-01-01", 60, (i) => 100 + i * 2);
    const index = series("2026-01-01", 60, (i) => 1000 + i * 0.5);
    const session = stock[stock.length - 1]!.date;
    const r = computeRelativeReturnAtSession(stock, index, session, RS_LOOKBACK_20);
    expect(r).not.toBeNull();
    expect(r!.rsSpreadPct).toBeGreaterThan(0);
    expect(r!.stockReturnPct).toBeGreaterThan(r!.indexReturnPct);
  });

  it("returns null when index missing anchor date", () => {
    const stock = series("2026-01-01", 60, (i) => 100 + i);
    const index = [bar("2026-03-01", 1000), bar("2026-03-02", 1001)];
    const session = stock[stock.length - 1]!.date;
    expect(computeRelativeReturnAtSession(stock, index, session, RS_LOOKBACK_20)).toBeNull();
  });
});

describe("computeRelativeStrengthDiagnostic", () => {
  it("flags dual MA50 uptrend when both series trend up", () => {
    const stock = series("2025-01-01", 80, (i) => 50 + i * 0.8);
    const index = series("2025-01-01", 80, (i) => 1200 + i * 2);
    const session = stock[stock.length - 1]!.date;
    const d = computeRelativeStrengthDiagnostic(stock, index, session);
    expect(d).not.toBeNull();
    expect(d!.stockAboveMa50).toBe(true);
    expect(d!.indexAboveMa50).toBe(true);
    expect(d!.dualUptrendMa50).toBe(true);
    expect(d!.returns.length).toBeGreaterThanOrEqual(1);
  });

  it("handles flat index with rising stock (positive RS spread)", () => {
    const stock = series("2025-01-01", 80, (i) => 40 + i);
    const index = series("2025-01-01", 80, () => 1000);
    const session = stock[stock.length - 1]!.date;
    const d = computeRelativeStrengthDiagnostic(stock, index, session);
    const r20 = d?.returns.find((r) => r.lookbackSessions === 20);
    expect(r20?.rsSpreadPct).toBeGreaterThan(0);
  });
});
