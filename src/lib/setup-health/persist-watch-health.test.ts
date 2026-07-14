import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { evaluateAndPersistHealthForActiveWatchItems } from "./persist-watch-health";
import { sortCandidatesWithHealth, type CandidateWithHealth } from "./sort-candidates";
import { healthLevelActionHint } from "./health-ui-copy";
import { healthLevelToBadgeVariant } from "@/components/command-deck/signal-badge";
import {
  resolveSetupLadderStage,
  type DecisionCockpitCandidateSnapshot,
} from "@/lib/dashboard/decision-cockpit-dto";

/**
 * Round-trip audit: `evaluateWatchHealth` can compute `NO_DATA` (no bars to evaluate),
 * which has no matching Prisma `SetupHealthLevel` enum member. `persist-watch-health.ts`
 * downgrades it to `AT_RISK` before writing to the DB. This suite proves that downgrade
 * never comes back around as something MORE positive than `AT_RISK` once the row is
 * re-read — not here (persistence), and not in any of the downstream consumers that
 * branch on a persisted `healthLevel` (ladder stage, sort rank, action hint, badge tone).
 */
function mockDb(params: {
  watches: Array<{
    id: string;
    symbolId: string;
    breakoutLevel: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    firstSeenBarDate: Date;
  }>;
  barsBySymbolId: Record<string, unknown[]>;
}): PrismaClient {
  const update = vi.fn().mockResolvedValue({});
  const findManyWatch = vi.fn().mockResolvedValue(params.watches);
  const findManyBars = vi
    .fn()
    .mockImplementation(({ where }: { where: { symbolId: string } }) =>
      Promise.resolve(params.barsBySymbolId[where.symbolId] ?? [])
    );

  return {
    setupWatchItem: { findMany: findManyWatch, update },
    stockDailyBar: { findMany: findManyBars },
  } as unknown as PrismaClient;
}

describe("evaluateAndPersistHealthForActiveWatchItems — NO_DATA persistence", () => {
  it("persists a NO_DATA evaluation (no bars available) as AT_RISK, never HEALTHY/WARNING", async () => {
    const evalDate = new Date("2026-07-14");
    const db = mockDb({
      watches: [
        {
          id: "watch-1",
          symbolId: "sym-1",
          breakoutLevel: 100,
          pullbackZoneLow: 95,
          pullbackZoneHigh: 98,
          firstSeenBarDate: new Date("2026-07-01"),
        },
      ],
      barsBySymbolId: {}, // sym-1 has no bars at all -> evaluateWatchHealth returns NO_DATA
    });

    const result = await evaluateAndPersistHealthForActiveWatchItems(db, evalDate, evalDate);

    expect(result.updated).toBe(1);
    expect(db.setupWatchItem.update).toHaveBeenCalledTimes(1);
    const call = (db.setupWatchItem.update as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.where).toEqual({ id: "watch-1" });
    expect(call.data.healthLevel).toBe("AT_RISK");
    expect(call.data.healthLevel).not.toBe("HEALTHY");
    expect(call.data.healthLevel).not.toBe("WARNING");
  });
});

describe("NO_DATA-turned-AT_RISK round trip — downstream never reads it as healthy/ready", () => {
  it("resolveSetupLadderStage treats a re-read AT_RISK row as 'avoid', never tier_a/tier_b", () => {
    // Simulates re-reading the persisted row from the DB shape:
    // { healthLevel: "AT_RISK", ... } — as it would be stored per the mapping above.
    const rehydrated: DecisionCockpitCandidateSnapshot = {
      id: "c1",
      symbolKey: "AAA",
      quality: "A",
      lifecycleSortLabel: "READY",
      healthLevel: "AT_RISK",
      healthScore: 0,
      healthScoreLabel: "Risky",
      healthFlags: [],
      healthSummary: null,
      reasons: [],
      rankSummary: null,
      close: 100,
      pullbackZoneLow: 95,
      pullbackZoneHigh: 98,
      stopLevel: 90,
      rankScore: 0,
    };

    const stage = resolveSetupLadderStage(rehydrated);
    expect(stage).toBe("avoid");
    expect(stage).not.toBe("tier_a");
    expect(stage).not.toBe("tier_b");
  });

  it("sortCandidatesWithHealth ranks a re-read AT_RISK row below HEALTHY and WARNING rows", () => {
    const rows: CandidateWithHealth[] = [
      {
        symbolKey: "HEALTHY_ROW",
        symbolId: "s-healthy",
        close: 100,
        pullbackZoneLow: 100,
        pullbackZoneHigh: 100,
        lifecycleLabel: "READY",
        healthLevel: "HEALTHY",
        healthScore: 90,
      },
      {
        symbolKey: "WARNING_ROW",
        symbolId: "s-warning",
        close: 100,
        pullbackZoneLow: 100,
        pullbackZoneHigh: 100,
        lifecycleLabel: "READY",
        healthLevel: "WARNING",
        healthScore: 70,
      },
      {
        symbolKey: "REHYDRATED_NO_DATA_ROW",
        symbolId: "s-rehydrated",
        close: 100,
        pullbackZoneLow: 100,
        pullbackZoneHigh: 100,
        lifecycleLabel: "READY",
        healthLevel: "AT_RISK", // was NO_DATA before persistence
        healthScore: 0,
      },
    ];

    const sorted = sortCandidatesWithHealth(rows).map((r) => r.symbolKey);
    expect(sorted.indexOf("HEALTHY_ROW")).toBeLessThan(sorted.indexOf("REHYDRATED_NO_DATA_ROW"));
    expect(sorted.indexOf("WARNING_ROW")).toBeLessThan(sorted.indexOf("REHYDRATED_NO_DATA_ROW"));
  });

  it("the action hint for a re-read AT_RISK row is a caution, never something reassuring", () => {
    const hint = healthLevelActionHint("AT_RISK");
    expect(hint).toBe("Avoid chasing. Wait for reset.");
  });

  it("the badge variant for a re-read AT_RISK row is the at-risk/warning tone, never 'healthy' or 'ready'", () => {
    const variant = healthLevelToBadgeVariant("AT_RISK");
    expect(variant).toBe("at-risk");
    expect(variant).not.toBe("healthy");
    expect(variant).not.toBe("ready");
  });
});
