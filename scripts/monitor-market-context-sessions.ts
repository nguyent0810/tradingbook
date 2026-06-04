/**
 * Read-only ops monitor: market context session inventory after Phase 1B.
 *
 * Production (required for ops use):
 *   SMOKE_DATABASE=production npm run ops:monitor-market-context
 *
 * Summarizes foreign_trade_daily / market_context_daily / symbol_market_context_daily
 * row counts, health alignment, Dashboard chip expectations, and 5D/10D rollout status.
 * No writes; does not touch scanner, pipeline, or UI.
 */
import "./load-env";
import { describeDatabaseUrl } from "../src/lib/database-url-fingerprint";
import { prisma } from "../src/lib/prisma";
import { buildMarketContextHealthReport } from "../src/lib/market/market-context-health";
import { fetchMarketContextUi } from "../src/lib/market/fetch-market-context-ui";
import { buildMarketContextCockpitChips } from "../src/lib/market/build-market-context-evidence";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { isoDayUtc } from "../src/lib/market/session-date";

const PRODUCTION_SESSION = process.env.SMOKE_DATABASE === "production";

async function main() {
  if (!PRODUCTION_SESSION) {
    console.error(
      "Refused: set SMOKE_DATABASE=production to read production (loads .env.prod.local)."
    );
    console.error("  SMOKE_DATABASE=production npm run ops:monitor-market-context");
    process.exit(1);
  }

  const databaseTarget = describeDatabaseUrl();
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  const expectedDay = expected ? isoDayUtc(expected) : null;

  const marketRows = await prisma.marketContextDaily.findMany({
    orderBy: { sessionDate: "asc" },
    select: {
      sessionDate: true,
      foreignNetValue1d: true,
      foreignNetValue5d: true,
      foreignNetValue10d: true,
      foreignSymbolsOk: true,
      foreignSymbolsTotal: true,
      symbolsBuilt: true,
      builtAt: true,
    },
  });

  const sessions: Array<Record<string, unknown>> = [];
  for (const row of marketRows) {
    const day = isoDayUtc(row.sessionDate);
    const [foreignCount, symbolContextCount] = await Promise.all([
      prisma.foreignTradeDaily.count({ where: { sessionDate: row.sessionDate } }),
      prisma.symbolMarketContextDaily.count({ where: { sessionDate: row.sessionDate } }),
    ]);
    const health = await buildMarketContextHealthReport(prisma, day);
    sessions.push({
      sessionDate: day,
      foreignTradeDailyRows: foreignCount,
      symbolMarketContextRows: symbolContextCount,
      marketContextExists: true,
      foreignSymbolsOk: row.foreignSymbolsOk,
      foreignSymbolsTotal: row.foreignSymbolsTotal,
      symbolsBuilt: row.symbolsBuilt,
      foreignNetValue1d: row.foreignNetValue1d,
      foreignNetValue5d: row.foreignNetValue5d,
      foreignNetValue10d: row.foreignNetValue10d,
      has5d: row.foreignNetValue5d != null,
      has10d: row.foreignNetValue10d != null,
      sessionAligned: health.sessionAligned,
      issueCount: health.issues.length,
      issues: health.issues.map((i) => i.code),
    });
  }

  const latestSession = sessions.at(-1) ?? null;
  const sessionCount = marketRows.length;

  let dashboardChips: string[] = [];
  let coverageDisplay: string | null = null;
  let foreign1dDisplay: string | null = null;
  let expect5dChip = false;
  let expect10dChip = false;
  if (expected) {
    const ctx = await fetchMarketContextUi(prisma, expected);
    const chips = buildMarketContextCockpitChips(ctx);
    dashboardChips = chips.map((c) => c.id);
    coverageDisplay =
      chips.find((c) => c.id === "market_foreign_coverage")?.display ?? null;
    foreign1dDisplay = chips.find((c) => c.id === "market_foreign_1d")?.display ?? null;
    expect5dChip = chips.some((c) => c.id === "market_foreign_5d");
    expect10dChip = chips.some((c) => c.id === "market_foreign_10d");
  }

  const rollupExpectations = {
    foreign5dEligibleAfterSessions: 5,
    foreign10dEligibleAfterSessions: 10,
    sessionsBuilt: sessionCount,
    expect5dOnLatestSession: sessionCount >= 5,
    expect10dOnLatestSession: sessionCount >= 10,
    latestSessionHas5d: latestSession?.has5d === true,
    latestSessionHas10d: latestSession?.has10d === true,
  };

  console.log(
    JSON.stringify(
      {
        monitoredAt: new Date().toISOString(),
        databaseTarget,
        smokeDatabase: process.env.SMOKE_DATABASE ?? null,
        expectedVnindexSession: expectedDay,
        sessionCount,
        rollupExpectations,
        sessions,
        dashboardEvidence: {
          chipIds: dashboardChips,
          foreign1d: foreign1dDisplay,
          coverage: coverageDisplay,
          expect5dChip,
          expect10dChip,
          omit5d10dWhileNull: !expect5dChip && !expect10dChip,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
