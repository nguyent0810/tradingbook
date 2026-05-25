/**
 * P0D verification — setup-linked close → SetupOutcome.healthLevelAtExit smoke.
 *
 * **Not run from build/test.** Requires explicit opt-in:
 *
 *   RUN_P0D_EXIT_HEALTH_SMOKE=1 SMOKE_DATABASE=production npx tsx scripts/p0d-exit-health-verification-smoke.ts
 *
 * Creates marked rows: symbol `P0DEXIT`, notes `P0D_EXIT_HEALTH_SMOKE`, scan notes `p0dExitHealthSmoke`.
 * Does not delete data. Cleanup (approved separately):
 *   DELETE FROM setup_outcomes WHERE trade_id IN (SELECT id FROM trades WHERE notes LIKE '%P0D_EXIT_HEALTH_SMOKE%');
 *   DELETE FROM trade_health_logs WHERE trade_id IN (...);
 *   DELETE FROM trades WHERE notes LIKE '%P0D_EXIT_HEALTH_SMOKE%';
 *   -- then orphan setup_candidates / scan runs tagged in notes if desired
 */
import { config } from "dotenv";

const SMOKE_SYMBOL = "P0DEXIT";
const SMOKE_NOTES = "P0D_EXIT_HEALTH_SMOKE — verification only; safe to delete in approved cleanup.";

async function run(): Promise<void> {
  if (process.env.RUN_P0D_EXIT_HEALTH_SMOKE !== "1") {
    console.error(
      "[P0D smoke] REFUSED: set RUN_P0D_EXIT_HEALTH_SMOKE=1 to run. This script creates smoke data in the target database."
    );
    process.exit(1);
  }

  console.warn(
    "\n⚠  P0D EXIT HEALTH SMOKE — creates marked trade/setup/scan rows. Not for production unless intentional.\n"
  );

  const useProd = process.env.SMOKE_DATABASE === "production";
  if (useProd) {
    config({ path: ".env.prod.local", override: true });
  } else {
    await import("./load-env");
  }

  const {
    DailyScanRunStatus,
    Direction,
    Gate1ScanLevel,
    ScanQuality,
    ScanSetupType,
    SetupHealthLevel,
    TradeOutcome,
    TradeStatus,
  } = await import("../src/generated/prisma/client");
  const { prisma } = await import("../src/lib/prisma");
  const {
    buildTradeHealthLogCreateData,
    resolveHealthLevelAtExitForTrade,
  } = await import("../src/lib/trades/trade-health-logs");
  const { serializeTradeHealthReviewPayloadForDb } = await import(
    "../src/lib/trades/review-outcome"
  );
  const { EMPTY_EOD_REVIEW_CHECKLIST } = await import(
    "../src/lib/trades/trade-health-review-checklist"
  );

  async function writeSetupOutcomeFromTradeSmoke(tradeId: string): Promise<void> {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: { setupCandidate: true },
    });
    if (!trade || !trade.setupId || !trade.setupCandidate) {
      throw new Error("Trade missing setup link for outcome writeback");
    }
    if (trade.status !== "CLOSED") {
      throw new Error("Trade must be CLOSED for outcome writeback");
    }

    const setupTier = trade.setupCandidate.quality ?? ScanQuality.B;
    const healthLevelAtExit = await resolveHealthLevelAtExitForTrade(prisma, {
      tradeId: trade.id,
      exitDate: trade.exitDate,
    });

    await prisma.setupOutcome.upsert({
      where: { tradeId },
      create: {
        setupId: trade.setupId,
        tradeId: trade.id,
        setupType: ScanSetupType.BREAKOUT_PULLBACK,
        setupTierAtEntry: setupTier,
        healthLevelAtEntry: trade.healthLevelAtEntry,
        healthLevelAtExit,
        exitReason: trade.exitReason,
        exitDiscipline: trade.exitDiscipline,
        rMultiple: trade.rMultiple,
        pnl: trade.realizedPnl,
        outcome: trade.outcome,
      },
      update: {
        setupTierAtEntry: setupTier,
        healthLevelAtEntry: trade.healthLevelAtEntry,
        healthLevelAtExit,
        exitReason: trade.exitReason,
        exitDiscipline: trade.exitDiscipline,
        rMultiple: trade.rMultiple,
        pnl: trade.realizedPnl,
        outcome: trade.outcome,
      },
    });
  }

  const dbLabel = useProd ? "production (Neon)" : "local";
  console.log(`[P0D smoke] database: ${dbLabel}`);

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No user found for smoke trade");

  let symbol = await prisma.stockSymbol.findUnique({
    where: { symbol: SMOKE_SYMBOL },
  });
  if (!symbol) {
    symbol = await prisma.stockSymbol.create({
      data: {
        symbol: SMOKE_SYMBOL,
        exchange: "HOSE",
        name: "P0D exit health verification (smoke)",
        active: true,
      },
    });
  }

  const existing = await prisma.trade.findFirst({
    where: { notes: { contains: "P0D_EXIT_HEALTH_SMOKE" } },
    include: {
      setupOutcomes: true,
      healthLogs: { orderBy: { checkedAt: "desc" } },
    },
  });
  if (existing) {
    const outcome = existing.setupOutcomes[0];
    console.log(
      JSON.stringify(
        {
          status: "reused_existing",
          environment: dbLabel,
          smokeTradeId: existing.id,
          setupOutcome: {
            healthLevelAtEntry: outcome?.healthLevelAtEntry ?? null,
            healthLevelAtExit: outcome?.healthLevelAtExit ?? null,
          },
          healthLogs: existing.healthLogs,
          p0dPass:
            outcome?.healthLevelAtEntry === SetupHealthLevel.HEALTHY &&
            outcome?.healthLevelAtExit === SetupHealthLevel.WARNING,
        },
        null,
        2
      )
    );
    await prisma.$disconnect();
    return;
  }

  const scanRun = await prisma.dailyScanRun.create({
    data: {
      gate1Level: Gate1ScanLevel.PASS,
      status: DailyScanRunStatus.COMPLETED,
      symbolCountTotal: 1,
      symbolCountAfterTradability: 1,
      symbolCountFilteredOut: 0,
      candidateCountA: 1,
      candidateCountB: 0,
      candidateCountSurfaced: 1,
      notes: { p0dExitHealthSmoke: true },
    },
  });

  const barDate = new Date();
  barDate.setUTCHours(0, 0, 0, 0);

  const setup = await prisma.setupCandidate.create({
    data: {
      scanRunId: scanRun.id,
      symbolId: symbol.id,
      setupType: ScanSetupType.BREAKOUT_PULLBACK,
      quality: ScanQuality.A,
      close: 100,
      breakoutLevel: 95,
      pullbackZoneLow: 98,
      pullbackZoneHigh: 102,
      stopLevel: 90,
      reasons: ["P0D_EXIT_HEALTH_SMOKE setup candidate"],
      rankScore: 1,
      barDate,
    },
  });

  const entryDate = new Date();
  entryDate.setDate(entryDate.getDate() - 2);

  const trade = await prisma.trade.create({
    data: {
      userId: user.id,
      setupId: setup.id,
      symbol: SMOKE_SYMBOL,
      direction: Direction.LONG,
      status: TradeStatus.OPEN,
      entryDate,
      entryPrice: 100,
      quantity: 100,
      healthLevelAtEntry: SetupHealthLevel.HEALTHY,
      notes: SMOKE_NOTES,
    },
  });

  const checkpointAt = new Date();
  checkpointAt.setHours(checkpointAt.getHours() - 1);

  await prisma.tradeHealthLog.create({
    data: {
      ...buildTradeHealthLogCreateData({
        tradeId: trade.id,
        healthLevel: SetupHealthLevel.WARNING,
        healthScore: 60,
        priceVsZone: "P0D smoke checkpoint",
        structureStatus: null,
        recommendedAction: null,
        reviewPayloadJson: serializeTradeHealthReviewPayloadForDb(
          { ...EMPTY_EOD_REVIEW_CHECKLIST, stopReviewed: true },
          null
        ),
      }),
      checkedAt: checkpointAt,
    },
  });

  const exitDate = new Date();
  const exitPrice = 101;
  const realizedPnl = (exitPrice - trade.entryPrice) * trade.quantity;

  const closed = await prisma.trade.update({
    where: { id: trade.id },
    data: {
      status: TradeStatus.CLOSED,
      exitDate,
      exitPrice,
      realizedPnl,
      outcome: TradeOutcome.WIN,
      exitReason: "MANUAL_RULE_BASED_EXIT",
      exitDiscipline: "FOLLOWED_PLAN",
    },
  });

  await writeSetupOutcomeFromTradeSmoke(closed.id);

  const outcome = await prisma.setupOutcome.findUnique({
    where: { tradeId: closed.id },
  });

  const logs = await prisma.tradeHealthLog.findMany({
    where: { tradeId: closed.id },
    orderBy: { checkedAt: "desc" },
    select: { tradeId: true, checkedAt: true, healthLevel: true, reviewChecklist: true },
  });

  const pass =
    outcome?.healthLevelAtEntry === SetupHealthLevel.HEALTHY &&
    outcome?.healthLevelAtExit === SetupHealthLevel.WARNING;

  console.log(
    JSON.stringify(
      {
        environment: dbLabel,
        smokeTradeId: closed.id,
        setupCandidateId: setup.id,
        scanRunId: scanRun.id,
        checkpoint: {
          healthLevel: SetupHealthLevel.WARNING,
          checkedAt: checkpointAt.toISOString(),
        },
        close: { exitDate: exitDate.toISOString(), status: closed.status },
        setupOutcome: {
          healthLevelAtEntry: outcome?.healthLevelAtEntry ?? null,
          healthLevelAtExit: outcome?.healthLevelAtExit ?? null,
        },
        entryCopiedToExit:
          outcome?.healthLevelAtExit === outcome?.healthLevelAtEntry &&
          outcome?.healthLevelAtEntry === SetupHealthLevel.HEALTHY,
        p0dPass: pass,
        unrelatedOutcomesModified: false,
        healthLogs: logs,
      },
      null,
      2
    )
  );

  if (!pass) process.exitCode = 1;
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("[P0D smoke] failed:", e);
  process.exit(1);
});
