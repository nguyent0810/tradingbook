/**
 * Persist daily RS near-miss watchlist snapshot for validation.
 *
 * Usage:
 *   npx tsx scripts/save-rs-watchlist-snapshot.ts
 *   npx tsx scripts/save-rs-watchlist-snapshot.ts --limit=30
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { computeRsNearMissWatchlistFromDb } from "../src/lib/scanner/gate2/rs-near-miss-watchlist";
import { loadRsDiagnosticUiForSymbols } from "../src/lib/scanner/gate2/load-rs-diagnostics";
import { persistRsWatchlistSnapshot } from "../src/lib/scanner/gate2/rs-watchlist-snapshot";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";
import { buildMarketFreshnessDto } from "../src/lib/market/market-freshness-dto";
import { buildDecisionCockpitDto } from "../src/lib/dashboard/decision-cockpit-dto";
import { fetchMarketSessionSnapshot } from "../src/lib/market/market-session-snapshot";

function parseLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return 20;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 20;
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  console.error(`DB: ${describeDatabaseUrl()}`);

  const { expectedLatestSession, tradabilityPassedCount, rows } =
    await computeRsNearMissWatchlistFromDb(prisma, { limit });

  const rsMap = await loadRsDiagnosticUiForSymbols(
    prisma,
    rows.map((r) => r.symbol),
    expectedLatestSession
  );

  const regime = await getMarketRegimeFromDb(prisma);
  const snapshot = await fetchMarketSessionSnapshot(prisma);
  const freshness = buildMarketFreshnessDto({ snapshot });
  const dto = buildDecisionCockpitDto({
    latestScan: null,
    scanNotes: null,
    liveRegime: regime,
    freshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
  });

  const result = await persistRsWatchlistSnapshot(prisma, {
    sessionDate: expectedLatestSession,
    rows,
    verdictUxLevel: dto.verdict.uxLevel.value,
    tradabilityPassedCount,
    rsUiBySymbol: rsMap,
  });

  const topRows = rows.slice(0, 10).map((r) => ({
    symbol: r.symbol,
    rs20: r.rs20SpreadPct,
    rs50: r.rs50SpreadPct,
    terminalCode: r.terminalCode,
    setupState: r.terminalCode,
    stageRank: r.stageRank,
  }));

  console.log(
    JSON.stringify(
      {
        ...result,
        sessionDate: expectedLatestSession.toISOString().slice(0, 10),
        verdict: dto.verdict.uxLevel.value,
        scoringEnabled: process.env.RS_SCORING_V1_ENABLED ?? "(unset)",
        top10: topRows,
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
