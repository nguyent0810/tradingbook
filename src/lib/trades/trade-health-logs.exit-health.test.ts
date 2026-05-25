import { describe, expect, it, vi } from "vitest";
import { SetupHealthLevel, type PrismaClient } from "@/generated/prisma/client";
import {
  endOfLocalCalendarDay,
  resolveHealthLevelAtExitForTrade,
} from "@/lib/trades/trade-health-logs";

function mockDb(
  findFirstResult: { healthLevel: SetupHealthLevel } | null
): PrismaClient {
  const findFirst = vi.fn().mockResolvedValue(findFirstResult);
  return {
    tradeHealthLog: { findFirst },
  } as unknown as PrismaClient;
}

describe("endOfLocalCalendarDay", () => {
  it("returns 23:59:59.999 on the same local calendar day", () => {
    const d = new Date(2026, 4, 20, 14, 30, 0);
    const end = endOfLocalCalendarDay(d);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(4);
    expect(end.getDate()).toBe(20);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });
});

describe("resolveHealthLevelAtExitForTrade", () => {
  const tradeId = "trade-1";

  it("returns latest qualifying health level when checkpoint is on/before exit EOD", async () => {
    const exitDate = new Date(2026, 4, 20, 10, 0, 0);
    const db = mockDb({ healthLevel: SetupHealthLevel.WARNING });
    const result = await resolveHealthLevelAtExitForTrade(db, {
      tradeId,
      exitDate,
    });
    expect(result).toBe(SetupHealthLevel.WARNING);
    expect(db.tradeHealthLog.findFirst).toHaveBeenCalledWith({
      where: {
        tradeId,
        checkedAt: { lte: endOfLocalCalendarDay(exitDate) },
      },
      orderBy: { checkedAt: "desc" },
      select: { healthLevel: true },
    });
  });

  it("returns null when only checkpoints exist after exit EOD (no qualifying row)", async () => {
    const db = mockDb(null);
    const result = await resolveHealthLevelAtExitForTrade(db, {
      tradeId,
      exitDate: new Date(2026, 4, 20, 10, 0, 0),
    });
    expect(result).toBeNull();
  });

  it("returns null when trade has no checkpoints", async () => {
    const db = mockDb(null);
    const result = await resolveHealthLevelAtExitForTrade(db, {
      tradeId,
      exitDate: new Date(2026, 4, 20),
    });
    expect(result).toBeNull();
  });

  it("uses global latest checkpoint when exitDate is null", async () => {
    const db = mockDb({ healthLevel: SetupHealthLevel.AT_RISK });
    const result = await resolveHealthLevelAtExitForTrade(db, {
      tradeId,
      exitDate: null,
    });
    expect(result).toBe(SetupHealthLevel.AT_RISK);
    expect(db.tradeHealthLog.findFirst).toHaveBeenCalledWith({
      where: { tradeId },
      orderBy: { checkedAt: "desc" },
      select: { healthLevel: true },
    });
  });

  it("does not accept or use healthLevelAtEntry (null when no log)", async () => {
    const db = mockDb(null);
    const result = await resolveHealthLevelAtExitForTrade(db, {
      tradeId,
      exitDate: null,
    });
    expect(result).toBeNull();
    expect(db.tradeHealthLog.findFirst).toHaveBeenCalledTimes(1);
  });
});
