import { describe, expect, it } from "vitest";
import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import { computeRelativeStrengthDiagnostic } from "./relative-strength";
import type { Gate2BarInput } from "./types";

function series(startDay: string, count: number, closeFn: (i: number) => number): Gate2BarInput[] {
  const [y, m, d] = startDay.split("-").map(Number);
  const out: Gate2BarInput[] = [];
  let t = Date.UTC(y!, m! - 1, d!);
  for (let i = 0; i < count; i++) {
    const c = closeFn(i);
    out.push({
      date: new Date(t),
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

describe("RS diagnostics vs Gate 2 (D1 — no behavior change)", () => {
  it("computing RS does not alter Gate 2 rankScore or quality", () => {
    const stock = series("2025-01-01", 80, (i) => 50 + i * 0.5);
    const index = series("2025-01-01", 80, (i) => 1200 + i * 1);
    const session = stock[stock.length - 1]!.date;

    const before = evaluateBreakoutPullbackCandidate(stock, session);
    const rs = computeRelativeStrengthDiagnostic(stock, index, session);
    const after = evaluateBreakoutPullbackCandidate(stock, session);

    expect(after.quality).toBe(before.quality);
    expect(after.rankScore).toBe(before.rankScore);
    expect(rs).not.toBeNull();
  });
});
