/**
 * DEV / LOCAL ONLY — synthetic DailyScanRun + Tier A SetupCandidate for /setups smoke testing.
 *
 * - Does NOT run automatically anywhere.
 * - Refuses NODE_ENV=production (and Vercel production).
 * - Safe to re-run: removes prior rows tagged with notes.demoSeed === true (same DB).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-setup-candidate.ts
 *
 * Optional:
 *   DEMO_SETUP_SYMBOL=DEMOSETUP| SAB
 *   DEMO_HEALTH_CASE=default|dead   (default: default)
 */
import "./load-env";
import {
  DailyScanRunStatus,
  Gate1ScanLevel,
  ScanQuality,
  ScanSetupType,
  SetupHealthLevel,
  SetupLifecycleStatus,
} from "../src/generated/prisma/client";
import { describeDatabaseUrl } from "./load-env";
import { prisma } from "../src/lib/prisma";

function refuseProduction(): void {
  if (process.env.NODE_ENV === "production") {
    console.error("[demo seed] REFUSED: NODE_ENV=production. This script is dev/local only.");
    process.exit(1);
  }
  if (process.env.VERCEL_ENV === "production") {
    console.error("[demo seed] REFUSED: VERCEL_ENV=production.");
    process.exit(1);
  }
}

async function removePriorDemoSeeds(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "daily_scan_runs" WHERE "notes"::jsonb @> $1::jsonb`,
    JSON.stringify({ demoSeed: true })
  );
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  refuseProduction();

  console.warn("\n╔══════════════════════════════════════════════════════════════════╗");
  console.warn("║  ⚠  DEMO SEED — NOT FOR PRODUCTION                                ║");
  console.warn("║  Inserts a synthetic scan run + setup candidate for UI smoke.    ║");
  console.warn("║  Scanner rules and production pipelines are unaffected.            ║");
  console.warn("╚══════════════════════════════════════════════════════════════════╝\n");

  console.warn("[demo seed] DATABASE_URL →", describeDatabaseUrl());

  const symKey = (process.env.DEMO_SETUP_SYMBOL ?? "DEMOSETUP").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(symKey)) {
    console.error("[demo seed] Invalid DEMO_SETUP_SYMBOL");
    process.exit(1);
  }
  const healthCase = (process.env.DEMO_HEALTH_CASE ?? "default").trim().toLowerCase();
  if (!["default", "dead"].includes(healthCase)) {
    console.error("[demo seed] Invalid DEMO_HEALTH_CASE (use default|dead)");
    process.exit(1);
  }

  let symbol = await prisma.stockSymbol.findUnique({ where: { symbol: symKey } });
  if (!symbol) {
    symbol = await prisma.stockSymbol.create({
      data: {
        symbol: symKey,
        exchange: "HOSE",
        name: `${symKey} (demo seed placeholder)`,
        active: true,
      },
    });
    console.warn(`[demo seed] Created StockSymbol for ${symKey} (no existing row).`);
  }

  await removePriorDemoSeeds();

  /** Deterministic evaluation bar (UTC date-only matches @db.Date). */
  const barDate = new Date(Date.UTC(2026, 4, 2));
  const isDeadCase = healthCase === "dead";

  const close = isDeadCase ? 112.0 : 92.5;
  const breakoutLevel = 88.0;
  const pullbackZoneLow = 90.0;
  const pullbackZoneHigh = 93.0;
  const stopLevel = 86.5;
  const rankScore = isDeadCase ? 2500.11 : 2847.32;

  const reasons: string[] = isDeadCase
    ? [
        "Tier A — demo seed only (DEAD health example mode).",
        "Use to validate DEAD visual treatment and warnings.",
      ]
    : [
        "Tier A — demo seed only (READY + HEALTHY baseline).",
        "Use for /setups table + position sizing UI smoke.",
      ];

  const notes = {
    demoSeed: true,
    decision: {
      level: "NORMAL",
      allocation: "50-70%",
      explanation: "Demo seed — illustrative decision payload only.",
    },
    topRejectionCategories: {},
    closestToValidSymbols: [],
    recommendation: {
      likelyBottleneck: "none_obvious",
      summary: "",
      note: "",
    },
  };

  const run = await prisma.dailyScanRun.create({
    data: {
      gate1Level: Gate1ScanLevel.PASS,
      status: DailyScanRunStatus.COMPLETED,
      symbolCountTotal: 120,
      symbolCountAfterTradability: 95,
      symbolCountFilteredOut: 25,
      candidateCountA: 1,
      candidateCountB: 0,
      candidateCountSurfaced: 1,
      tradabilityBreakdown: { demo_seed_placeholder: 1 },
      notes,
    },
  });

  const candidate = await prisma.setupCandidate.create({
    data: {
      scanRunId: run.id,
      symbolId: symbol.id,
      setupType: ScanSetupType.BREAKOUT_PULLBACK,
      quality: ScanQuality.A,
      close,
      breakoutLevel,
      pullbackZoneLow,
      pullbackZoneHigh,
      stopLevel,
      reasons,
      rankScore,
      barDate,
    },
  });

  // Ensure watch row uses seeded setup levels and quality.
  await prisma.setupWatchItem.upsert({
    where: {
      symbolId_setupType: {
        symbolId: symbol.id,
        setupType: ScanSetupType.BREAKOUT_PULLBACK,
      },
    },
    create: {
      symbolId: symbol.id,
      setupType: ScanSetupType.BREAKOUT_PULLBACK,
      quality: ScanQuality.A,
      lifecycleStatus: SetupLifecycleStatus.READY,
      breakoutLevel,
      pullbackZoneLow,
      pullbackZoneHigh,
      firstSeenBarDate: addDays(barDate, -2),
      lastSeenScanRunId: run.id,
      healthFlags: isDeadCase ? ["DEAD_SETUP"] : [],
      healthScore: isDeadCase ? 50 : 100,
      healthLevel: isDeadCase ? SetupHealthLevel.DEAD : SetupHealthLevel.HEALTHY,
      lastHealthEvaluatedAt: new Date(),
    },
    update: {
      quality: ScanQuality.A,
      lifecycleStatus: SetupLifecycleStatus.READY,
      breakoutLevel,
      pullbackZoneLow,
      pullbackZoneHigh,
      firstSeenBarDate: addDays(barDate, -2),
      lastSeenScanRunId: run.id,
      healthFlags: isDeadCase ? ["DEAD_SETUP"] : [],
      healthScore: isDeadCase ? 50 : 100,
      healthLevel: isDeadCase ? SetupHealthLevel.DEAD : SetupHealthLevel.HEALTHY,
      lastHealthEvaluatedAt: new Date(),
    },
  });

  // Seed local bars so evaluator produces deterministic health for demo symbol.
  await prisma.stockDailyBar.deleteMany({
    where: {
      symbolId: symbol.id,
      date: { gte: addDays(barDate, -29), lte: barDate },
    },
  });

  const demoBars = Array.from({ length: 30 }).map((_, idx) => {
    const date = addDays(barDate, idx - 29);
    const c = idx === 29 ? close : 92.2;
    const v = isDeadCase ? 1_000_000 - idx * 15_000 : 1_000_000;
    return {
      symbolId: symbol.id,
      date,
      open: c - 0.2,
      high: c + 0.5,
      low: c - 0.5,
      close: c,
      volume: Math.max(v, 250_000),
      source: "demo-seed",
    };
  });

  await prisma.stockDailyBar.createMany({ data: demoBars });

  const summary = {
    scanRunId: run.id,
    setupCandidateId: candidate.id,
    symbol: symKey,
    gate1Level: "PASS",
    quality: "A",
    levelsKVnd: {
      close,
      breakoutLevel,
      pullbackZoneLow,
      pullbackZoneHigh,
      stopLevel,
      rankScore,
    },
    barDate: barDate.toISOString().slice(0, 10),
    reasons,
    healthCase,
  };

  console.warn("[demo seed] Done. Latest run should appear first on /setups.\n");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
