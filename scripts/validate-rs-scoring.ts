/**
 * RS scoring validation dump — does not change trading decisions.
 * Usage:
 *   npx tsx scripts/validate-rs-scoring.ts
 *   RS_SCORING_V1_ENABLED=true npx tsx scripts/validate-rs-scoring.ts
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { buildMarketFreshnessDto } from "../src/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "../src/lib/dashboard/decision-cockpit-dto";
import { mapDashboardV3ViewModel } from "../src/lib/dashboard/map-dashboard-v3-view-model";
import { fetchMarketSessionSnapshot } from "../src/lib/market/market-session-snapshot";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";
import { getLatestDailyScanRun } from "../src/lib/scanner/setups-queries";
import { parseDailyScanGate2Notes } from "../src/lib/scanner/parse-daily-scan-notes";
import {
  buildRsNearMissWatchlistPanel,
  computeRsNearMissWatchlistFromDb,
} from "../src/lib/scanner/gate2/rs-near-miss-watchlist";
import { loadRsDiagnosticUiForSymbols } from "../src/lib/scanner/gate2/load-rs-diagnostics";
import { isRsScoringV1Enabled } from "../src/lib/scanner/gate2/rs-scoring-v1";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";

function envFlag(name: string): string {
  const v = process.env[name];
  return v == null || v.trim() === "" ? "(unset)" : v;
}

async function buildVm(scoringEnabled: boolean) {
  const prev = process.env.RS_SCORING_V1_ENABLED;
  process.env.RS_SCORING_V1_ENABLED = scoringEnabled ? "true" : "false";

  const session = await getExpectedLatestSessionFromIndexBars(prisma);
  const latestScan = await getLatestDailyScanRun(prisma);
  const regime = await getMarketRegimeFromDb(prisma);
  const snapshot = await fetchMarketSessionSnapshot(prisma);
  const freshness = buildMarketFreshnessDto({ snapshot });

  let rsNearMissWatchlist = buildRsNearMissWatchlistPanel([]);
  if (session) {
    const { rows } = await computeRsNearMissWatchlistFromDb(prisma, { limit: 12 });
    const rsMap = await loadRsDiagnosticUiForSymbols(
      prisma,
      rows.map((r) => r.symbol),
      session
    );
    rsNearMissWatchlist = buildRsNearMissWatchlistPanel(rows, rsMap);
  }

  const input: DecisionCockpitInput = {
    latestScan: latestScan
      ? {
          id: latestScan.id,
          runAt: latestScan.runAt,
          gate1Level: latestScan.gate1Level,
          candidateCountA: latestScan.candidateCountA,
          candidateCountB: latestScan.candidateCountB,
          candidateCountSurfaced: latestScan.candidateCountSurfaced,
          universeScannedCount: latestScan.universeScannedCount,
        }
      : null,
    scanNotes: latestScan?.notes ? parseDailyScanGate2Notes(latestScan.notes) : null,
    liveRegime: regime,
    freshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    rsNearMissWatchlist,
  };

  const cockpitDto = buildDecisionCockpitDto(input);
  const vm = mapDashboardV3ViewModel({
    cockpitDto,
    freshness,
    regime,
    latestScan,
    topSetups: [],
    trades: [],
    watchItemCount: 0,
    openPositionCount: 0,
  });

  if (prev === undefined) delete process.env.RS_SCORING_V1_ENABLED;
  else process.env.RS_SCORING_V1_ENABLED = prev;

  return { vm, cockpitDto, session };
}

function dumpRsRows(label: string, vm: Awaited<ReturnType<typeof buildVm>>["vm"]) {
  console.log(`\n=== ${label} ===`);
  console.log(`RS_SCORING_V1_ENABLED=${isRsScoringV1Enabled()}`);
  console.log(`stance=${vm.decision.stanceLabel} mode=${vm.decision.mode}`);
  console.log(`contextNote=${vm.rsWatchlist.contextNote}`);
  console.log(
    `tradeGate=${vm.risk.tradeGate.rows.map((r) => `${r.rule}:${r.statusLabel}:${r.action}`).join(" | ")}`
  );
  console.log(`headerCta primary=${vm.headerCta.primaryLabel} → ${vm.headerCta.primaryHref}`);
  for (const card of vm.rsWatchlist.cards) {
    const scorePart =
      card.rsStrengthScore != null ? ` score=${card.rsStrengthScore}` : "";
    const readyPart =
      card.setupReadinessScore != null ? ` readiness=${card.setupReadinessScore}` : "";
    console.log(
      [
        card.symbol,
        `RS20=${card.rs20SpreadPct.toFixed(1)}`,
        `RS50=${card.rs50SpreadPct != null ? card.rs50SpreadPct.toFixed(1) : "—"}`,
        `strength=${card.strengthLabel ?? "—"}${scorePart}`,
        readyPart.trim(),
        `state=${card.setupState}`,
        `reason=${card.setupReason}`,
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }
  if (vm.rsWatchlist.cards.length === 0) {
    console.log("(no RS watchlist rows)");
  }
}

async function main(): Promise<void> {
  console.log("=== Environment ===");
  console.log(`DATABASE_URL: ${describeDatabaseUrl()}`);
  console.log(`RS_WATCHLIST_SNAPSHOT_ENABLED=${envFlag("RS_WATCHLIST_SNAPSHOT_ENABLED")}`);
  console.log(`RS_SCORING_V1_ENABLED (shell)=${envFlag("RS_SCORING_V1_ENABLED")}`);

  const vmOff = await buildVm(false);
  dumpRsRows("Dashboard RS Watchlist — scoring OFF", vmOff.vm);

  const vmOn = await buildVm(true);
  dumpRsRows("Dashboard RS Watchlist — scoring ON", vmOn.vm);

  const gateOff = JSON.stringify(vmOff.vm.risk.tradeGate.rows);
  const gateOn = JSON.stringify(vmOn.vm.risk.tradeGate.rows);
  console.log("\n=== Safety checks ===");
  console.log(`tradeGate unchanged OFF vs ON: ${gateOff === gateOn}`);
  console.log(`stance unchanged OFF vs ON: ${vmOff.vm.decision.mode === vmOn.vm.decision.mode}`);
  console.log(
    `NO_TRADE has no Go: ${vmOff.vm.risk.tradeGate.rows.every((r) => r.action !== "Go") || vmOff.vm.decision.mode !== "PROTECT CAPITAL" ? "ok (or not NO_TRADE)" : "FAIL"}`
  );
  console.log(`context banner present: ${Boolean(vmOff.vm.rsWatchlist.contextNote)}`);
  console.log(
    `scores null when OFF: ${vmOff.vm.rsWatchlist.cards.every((c) => c.rsStrengthScore == null)}`
  );
  console.log(
    `scores present when ON (if rows): ${
      vmOn.vm.rsWatchlist.cards.length === 0 ||
      vmOn.vm.rsWatchlist.cards.some((c) => c.rsStrengthScore != null)
    }`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
