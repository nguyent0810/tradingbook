import "server-only";



import { ScanQuality } from "@/generated/prisma/client";

import { formatGate2RankBreakdownLines } from "@/lib/scanner/gate2/rank-components";

import {

  buildGate2RankWithRsPreview,

  formatRsRankPreviewLines,

} from "@/lib/scanner/gate2/rs-rank-term";

import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

import {

  loadRsDiagnosticsForSetupsCached,

  loadSetupsBaseData,

  loadSetupPerfRowsCached,

  loadSurfacedCandidatesHealthCached,

} from "./setups-cached-data";

import { fetchMarketContextUi } from "@/lib/market/fetch-market-context-ui";

import { buildSymbolContextEvidenceLines } from "@/lib/market/build-market-context-evidence";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { safeLoadPositionSizingDefaults } from "./setups-position-sizing-defaults";

import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CandidateScanner } from "@/components/setups-workstation";

import {

  fmtSetupPerfHint,

  humanizeDisplayLine,

  rankComponentsFromReasons,

  reasonsToStrings,

  type SetupPerfHint,

} from "./setups-shared-helpers";

import type { SetupsCandidateBundle } from "@/components/setups/setups-candidates-master-detail";

export async function SetupsCandidatesAsync() {

  const base = await loadSetupsBaseData();

  if (!base.latest) {

    return null;

  }



  const candidateRows = base.candidateRows;

  const symbolKeys = candidateRows.map((c) => c.symbolKey);
  const symbolIds = candidateRows.map((c) => c.symbolId);

  const session = await getSession();
  const userId = session?.userId ?? null;

  const [
    { candidatesWithHealth, healthError },
    perfPack,
    rsMap,
    marketContext,
    positionSizing,
  ] =

    await Promise.all([

      loadSurfacedCandidatesHealthCached(),

      loadSetupPerfRowsCached(),

      loadRsDiagnosticsForSetupsCached(symbolKeys),

      base.expectedSession

        ? fetchMarketContextUi(prisma, base.expectedSession, { symbols: symbolKeys })

        : Promise.resolve(null),

      safeLoadPositionSizingDefaults(prisma, userId, symbolIds, base.expectedSession),

    ]);

  const { equityVnd, positionSizingConfig, advBySymbolId, error: positionSizingError } = positionSizing;

  const positionSizingDefaults = {
    equityVnd,
    baseRiskPct: positionSizingConfig.riskPerTradePct,
    maxTradePct: positionSizingConfig.maxPositionPct,
    liquidityCapPct: positionSizingConfig.liquidityCapPct,
  };



  const perfBanner = [healthError, perfPack.error, positionSizingError].filter(Boolean).join(" ") || null;



  const candidates = candidateRows;



  const setupPerfMap = new Map<string, SetupPerfHint>();

  for (const r of perfPack.rows) {

    const tradeCount = Number(r.trade_count);

    const winCount = Number(r.win_count);

    const winRatePct = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

    setupPerfMap.set(`${r.setup_type}:${r.setup_tier_at_entry}`, {

      tradeCount,

      winRatePct,

      avgR: r.avg_r,

    });

  }



  const candidateBundles = candidatesWithHealth.map((c): SetupsCandidateBundle => {

    const lines = reasonsToStrings(c.reasons);

    const rankComponents = rankComponentsFromReasons(c.reasons);

    const rankBreakdownLines = rankComponents

      ? formatGate2RankBreakdownLines(rankComponents).map(humanizeDisplayLine)

      : [];

    const rsUi = rsMap.get(c.symbolKey) ?? null;

    const rsRankPreviewLines =

      rankComponents != null

        ? formatRsRankPreviewLines(

            buildGate2RankWithRsPreview(rankComponents.rankScore, rsUi?.rs20SpreadPct ?? null)

          ).map(humanizeDisplayLine)

        : [];

    const tier = c.quality === ScanQuality.A ? "A" : "B";

    const perfHint = setupPerfMap.get(`${c.setupType}:${c.quality}`) ?? null;

    const marketContextLines = buildSymbolContextEvidenceLines(

      marketContext?.bySymbol[c.symbolKey.toUpperCase()] ?? null

    );

    return {

      candidate: {

        id: c.id,

        symbolKey: c.symbolKey,

        lifecycleSortLabel: c.lifecycleSortLabel,

        healthLevel: c.healthLevel,

        healthScore: c.healthScore,

        healthScoreLabel: c.healthScoreLabel,

        healthLines: c.healthLines.map(humanizeDisplayLine),

        healthHint: c.healthHint ? humanizeDisplayLine(c.healthHint) : null,

        healthSummary: c.healthSummary ? humanizeDisplayLine(c.healthSummary) : null,

        quality: c.quality,

        close: c.close,

        pullbackZoneLow: c.pullbackZoneLow,

        pullbackZoneHigh: c.pullbackZoneHigh,

        stopLevel: c.stopLevel,

        barDate: new Date(c.barDate).toLocaleDateString("en-CA"),

        setupType: c.setupType,

        avgValueVnd20: advBySymbolId.get(c.symbolId) ?? null,

      },

      perfHint: fmtSetupPerfHint(tier, perfHint),

      reasonsLines: lines,

      marketContextLines,

      rankScore: c.rankScore,

      rankBreakdownLines,

      rsRankPreviewLines,

      rsDiagnostic: rsUi,

    };

  });



  const emptyReason =
    base.latest.candidateCountSurfaced === 0
      ? `Latest run ${base.latest.id.slice(0, 12)}… completed with Gate 1 ${displayGate1ScanLevel(String(base.latest.gate1Level))} and ${base.latest.symbolCountAfterTradability} symbols passing tradability — none met Tier A/B surfacing rules. Use Market & setup insight and rejection diagnostics above, or closest-to-valid symbols below.`
      : "No Tier A/B candidates in this scan run.";

  return (
    <CandidateScanner
      candidates={candidateBundles}
      emptyReason={emptyReason}
      positionSizingDefaults={positionSizingDefaults}
      scanMeta={{
        gate1: displayGate1ScanLevel(String(base.latest.gate1Level)),
        tradabilityCount: base.latest.symbolCountAfterTradability,
        scanId: base.latest.id,
      }}
      partialBanner={
        perfBanner ? (
          <ErrorStateWithEvidence
            title="Partial candidate data unavailable"
            message={perfBanner}
            evidence="src/app/(dashboard)/setups/setups-candidates-async.tsx · loadSurfacedCandidatesHealthCached / loadSetupPerfRowsCached"
            data-testid="setups-candidates-partial-data"
          >
            <RefreshButton />
          </ErrorStateWithEvidence>
        ) : null
      }
    />
  );
}

