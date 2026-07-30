import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  collectGate2SetupCandidatesWithStats,
  deriveGate1SurfacingRule,
  filterCandidatesByGate1Level,
} from "./collect-candidates";
import type { SetupCandidate } from "./types";

const sample = (q: "A" | "B"): SetupCandidate => ({
  symbolId: "x",
  quality: q,
  close: 101,
  rankScore: 1,
  breakoutLevel: 100,
  pullbackZoneLow: 98,
  pullbackZoneHigh: 100,
  stopLevel: 95,
  reasons: [],
  barDate: new Date(Date.UTC(2024, 0, 1)),
});

describe("filterCandidatesByGate1Level", () => {
  it("FAIL removes all candidates", () => {
    expect(filterCandidatesByGate1Level("FAIL", [sample("A"), sample("B")])).toEqual([]);
  });

  it("WARNING keeps A only", () => {
    const r = filterCandidatesByGate1Level("WARNING", [sample("A"), sample("B")]);
    expect(r).toHaveLength(1);
    expect(r[0]!.quality).toBe("A");
  });

  it("PASS keeps A and B", () => {
    const r = filterCandidatesByGate1Level("PASS", [sample("A"), sample("B")]);
    expect(r).toHaveLength(2);
  });
});

describe("deriveGate1SurfacingRule", () => {
  it("maps FAIL/WARNING/PASS to none/tier-a-only/all", () => {
    expect(deriveGate1SurfacingRule("FAIL")).toBe("none");
    expect(deriveGate1SurfacingRule("WARNING")).toBe("tier-a-only");
    expect(deriveGate1SurfacingRule("PASS")).toBe("all");
  });
});

describe("collectGate2SetupCandidatesWithStats — zero-candidate universe", () => {
  const SESSION = new Date(Date.UTC(2026, 6, 17));

  /**
   * Mirrors the batched shape `fetchStockBarsGroupedAscThroughDate` issues:
   * one `findMany` for all symbol ids, each row carrying its own `symbolId`.
   */
  function fakePrismaWithBars(
    barsBySymbol: Record<string, Array<Record<string, unknown>>>
  ): PrismaClient {
    return {
      stockDailyBar: {
        findMany: async ({
          where,
        }: {
          where: { symbolId: { in: string[] } };
        }) =>
          where.symbolId.in.flatMap((id) =>
            (barsBySymbol[id] ?? []).map((bar) => ({ ...bar, symbolId: id }))
          ),
      },
    } as unknown as PrismaClient;
  }

  it("returns zero counts and no throw for an empty tradable-symbol list", async () => {
    const prisma = fakePrismaWithBars({});
    const stats = await collectGate2SetupCandidatesWithStats(prisma, [], "PASS", SESSION);
    expect(stats.candidateCountA).toBe(0);
    expect(stats.candidateCountB).toBe(0);
    expect(stats.surfaced).toEqual([]);
  });

  it("returns zero counts when every tradable symbol has too few bars to evaluate (real-world incident shape)", async () => {
    // Mirrors the production case audited: symbols pass tradability but every
    // one evaluates INVALID at Gate 2, so nothing surfaces despite a non-empty universe.
    const tooFewBars = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(SESSION.getTime() - (9 - i) * 86_400_000),
      open: 20,
      high: 20.5,
      low: 19.5,
      close: 20,
      volume: 1_000_000,
    }));
    const symbolIds = ["sym-1", "sym-2", "sym-3"];
    const prisma = fakePrismaWithBars(Object.fromEntries(symbolIds.map((id) => [id, tooFewBars])));

    const stats = await collectGate2SetupCandidatesWithStats(prisma, symbolIds, "PASS", SESSION);
    expect(stats.candidateCountA).toBe(0);
    expect(stats.candidateCountB).toBe(0);
    expect(stats.surfaced).toEqual([]);
  });
});
