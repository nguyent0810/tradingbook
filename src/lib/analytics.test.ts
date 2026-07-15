import { describe, expect, it } from "vitest";
import type { Trade } from "@/generated/prisma/client";
import { computeOutcomeBreakdown } from "./analytics";

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    setupId: null,
    symbol: "HPG",
    direction: "LONG",
    status: "CLOSED",
    entryDate: new Date("2026-05-01T00:00:00.000Z"),
    exitDate: new Date("2026-05-10T00:00:00.000Z"),
    entryPrice: 28,
    exitPrice: 30,
    quantity: 1000,
    fees: 0,
    realizedPnl: 2000,
    rMultiple: null,
    outcome: null,
    playbook: "BREAKOUT_PULLBACK",
    entryReason: null,
    entryLocationVsZone: null,
    healthLevelAtEntry: null,
    healthScoreAtEntry: null,
    stopLoss: null,
    takeProfit: null,
    positionSize: null,
    setupSnapshot: null,
    exitReason: null,
    exitDiscipline: null,
    entryNote: null,
    exitNote: null,
    notes: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    ...overrides,
  } as Trade;
}

describe("computeOutcomeBreakdown", () => {
  it("returns an empty array with no closed trades", () => {
    expect(computeOutcomeBreakdown([])).toEqual([]);
    expect(computeOutcomeBreakdown([trade({ status: "OPEN", realizedPnl: null })])).toEqual([]);
  });

  it("splits WIN/LOSS/BREAKEVEN by realizedPnl sign, not the outcome field", () => {
    const trades = [
      trade({ id: "t1", realizedPnl: 2000, outcome: null }),
      trade({ id: "t2", realizedPnl: -500, outcome: null }),
      trade({ id: "t3", realizedPnl: 0, outcome: null }),
      trade({ id: "t4", realizedPnl: 1000, outcome: "LOSS" }), // outcome field intentionally ignored
    ];
    const result = computeOutcomeBreakdown(trades);
    const win = result.find((r) => r.outcome === "WIN")!;
    const loss = result.find((r) => r.outcome === "LOSS")!;
    const breakeven = result.find((r) => r.outcome === "BREAKEVEN")!;

    expect(win.count).toBe(2);
    expect(win.totalPnl).toBe(3000);
    expect(loss.count).toBe(1);
    expect(loss.totalPnl).toBe(-500);
    expect(breakeven.count).toBe(1);
  });

  it("omits a category entirely when it has zero trades", () => {
    const result = computeOutcomeBreakdown([trade({ realizedPnl: 1000 })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.outcome).toBe("WIN");
  });

  it("percentages sum to ~100 across present categories", () => {
    const trades = [
      trade({ id: "t1", realizedPnl: 1000 }),
      trade({ id: "t2", realizedPnl: 500 }),
      trade({ id: "t3", realizedPnl: -200 }),
    ];
    const result = computeOutcomeBreakdown(trades);
    const totalPct = result.reduce((sum, r) => sum + r.pct, 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });

  it("excludes OPEN/PLANNED trades and null-realizedPnl rows", () => {
    const trades = [
      trade({ id: "t1", status: "OPEN", realizedPnl: null }),
      trade({ id: "t2", status: "PLANNED", realizedPnl: null }),
      trade({ id: "t3", status: "CLOSED", realizedPnl: 500 }),
    ];
    const result = computeOutcomeBreakdown(trades);
    expect(result).toEqual([
      { outcome: "WIN", label: "Win", count: 1, totalPnl: 500, pct: 100 },
    ]);
  });
});
