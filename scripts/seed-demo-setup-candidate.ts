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
 *   DEMO_SETUP_SYMBOL=FPT| SAB (default FPT)
 */
import "./load-env";
import {
  DailyScanRunStatus,
  Gate1ScanLevel,
  ScanQuality,
  ScanSetupType,
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

async function main(): Promise<void> {
  refuseProduction();

  console.warn("\n╔══════════════════════════════════════════════════════════════════╗");
  console.warn("║  ⚠  DEMO SEED — NOT FOR PRODUCTION                                ║");
  console.warn("║  Inserts a synthetic scan run + setup candidate for UI smoke.    ║");
  console.warn("║  Scanner rules and production pipelines are unaffected.            ║");
  console.warn("╚══════════════════════════════════════════════════════════════════╝\n");

  console.warn("[demo seed] DATABASE_URL →", describeDatabaseUrl());

  const symKey = (process.env.DEMO_SETUP_SYMBOL ?? "FPT").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(symKey)) {
    console.error("[demo seed] Invalid DEMO_SETUP_SYMBOL");
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

  /**
   * Magnitudes in k ₫ (same convention as scanner rows on /setups).
   * Close inside pullback zone; stop below zone for long template.
   */
  const close = 92.5;
  const breakoutLevel = 88.0;
  const pullbackZoneLow = 90.0;
  const pullbackZoneHigh = 93.0;
  const stopLevel = 86.5;
  const rankScore = 2847.32;

  const reasons: string[] = [
    "Tier A — demo seed only (not produced by live scanner).",
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
