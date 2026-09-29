import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ADV_ROW_MAX_AGE_DAYS, loadSymbolAdvVnd, loadSymbolAdvVndBatch } from "./symbol-adv";

type Row = { symbolId: string; sessionDate: Date; close: number; volMa20: number };
type Where = {
  symbolId?: string | { in: string[] };
  sessionDate?: { lte?: Date; gte?: Date };
};

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** A table that honours the `where` it is given, and records it. */
function fakePrisma(rows: Row[]) {
  const seen: Where[] = [];
  const match = (where: Where) => (r: Row) => {
    const sym = where.symbolId;
    if (typeof sym === "string" && r.symbolId !== sym) return false;
    if (sym && typeof sym === "object" && !sym.in.includes(r.symbolId)) return false;
    if (where.sessionDate?.lte && r.sessionDate > where.sessionDate.lte) return false;
    if (where.sessionDate?.gte && r.sessionDate < where.sessionDate.gte) return false;
    return true;
  };
  const desc = (a: Row, b: Row) => b.sessionDate.getTime() - a.sessionDate.getTime();
  const prisma = {
    symbolMarketContextDaily: {
      findMany: async ({ where }: { where: Where }) => {
        seen.push(where);
        return rows.filter(match(where)).sort(desc);
      },
      findFirst: async ({ where }: { where: Where }) => {
        seen.push(where);
        return rows.filter(match(where)).sort(desc)[0] ?? null;
      },
    },
  } as unknown as PrismaClient;
  return { prisma, seen };
}

describe("ADV lookups are bounded below", () => {
  // Target session 29/09/2026. 30 calendar days earlier is 30/08/2026.
  const target = d("2026-09-29");

  it("the window is 30 calendar days", () => {
    expect(ADV_ROW_MAX_AGE_DAYS).toBe(30);
  });

  it("batch: a row older than the window is not used, and the query carries the bound", async () => {
    // 2 × 1000 × 1,000,000 = 2 tỷ, but dated 01/08, 59 days before the target.
    const { prisma, seen } = fakePrisma([
      { symbolId: "a", sessionDate: d("2026-08-01"), close: 2, volMa20: 1_000_000 },
      { symbolId: "b", sessionDate: d("2026-09-26"), close: 3, volMa20: 1_000_000 },
    ]);
    const res = await loadSymbolAdvVndBatch(prisma, [
      { symbolId: "a", sessionDate: target },
      { symbolId: "b", sessionDate: target },
    ]);
    expect(res.ok && [...res.map]).toEqual([
      ["a", null],
      ["b", 3_000_000_000],
    ]);
    expect(seen[0]!.sessionDate).toEqual({ lte: target, gte: d("2026-08-30") });
  });

  it("batch: the bound follows the EARLIEST target, and each target keeps its own window", async () => {
    // Targets 29/09 and 10/09. Query from 11/08 (30 days before 10/09).
    // A row on 20/08 is inside 10/09's window but outside 29/09's (from 30/08).
    const { prisma, seen } = fakePrisma([
      { symbolId: "a", sessionDate: d("2026-08-20"), close: 1, volMa20: 1_000_000 },
      { symbolId: "b", sessionDate: d("2026-08-20"), close: 1, volMa20: 1_000_000 },
    ]);
    const res = await loadSymbolAdvVndBatch(prisma, [
      { symbolId: "a", sessionDate: target },
      { symbolId: "b", sessionDate: d("2026-09-10") },
    ]);
    expect(seen[0]!.sessionDate?.gte).toEqual(d("2026-08-11"));
    expect(res.ok && [...res.map]).toEqual([
      ["a", null],
      ["b", 1_000_000_000],
    ]);
  });

  it("single lookup applies the same window, so screen and server agree", async () => {
    const { prisma } = fakePrisma([
      { symbolId: "a", sessionDate: d("2026-08-01"), close: 2, volMa20: 1_000_000 },
    ]);
    expect(await loadSymbolAdvVnd(prisma, "a", target)).toEqual({ ok: true, value: null });
    expect(await loadSymbolAdvVnd(prisma, "a", d("2026-08-20"))).toEqual({
      ok: true,
      value: 2_000_000_000,
    });
  });
});
