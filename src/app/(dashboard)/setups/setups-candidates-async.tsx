import "server-only";

import Link from "next/link";
import { ScanQuality } from "@/generated/prisma/client";
import { formatGate2RankBreakdownLines } from "@/lib/scanner/gate2/rank-components";
import {
  buildGate2RankWithRsPreview,
  formatRsRankPreviewLines,
} from "@/lib/scanner/gate2/rs-rank-term";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import { toCandidateRows } from "@/lib/scanner/setups-queries";
import {
  loadRsDiagnosticsForSetupsCached,
  loadSetupsBaseData,
  loadSetupPerfRowsCached,
  loadSurfacedCandidatesHealthCached,
} from "./setups-cached-data";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import {
  fmtSetupPerfHint,
  humanizeDisplayLine,
  rankComponentsFromReasons,
  reasonsToStrings,
  type SetupPerfHint,
} from "./setups-shared-helpers";
import {
  SetupsCandidatesMasterDetail,
  type SetupsCandidateBundle,
} from "@/components/setups/setups-candidates-master-detail";

export async function SetupsCandidatesAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const symbolKeys = toCandidateRows(base.latest).map((c) => c.symbolKey);

  const [{ candidatesWithHealth, healthError }, perfPack, rsMap] = await Promise.all([
    loadSurfacedCandidatesHealthCached(),
    loadSetupPerfRowsCached(),
    loadRsDiagnosticsForSetupsCached(symbolKeys),
  ]);

  const perfBanner = [healthError, perfPack.error].filter(Boolean).join(" ") || null;

  const candidates = toCandidateRows(base.latest);

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

  return (
    <>
      {perfBanner ? (
        <ErrorStateWithEvidence
          title="Partial candidate data unavailable"
          message={perfBanner}
          evidence="src/app/(dashboard)/setups/setups-candidates-async.tsx · loadSurfacedCandidatesHealthCached / loadSetupPerfRowsCached"
          data-testid="setups-candidates-partial-data"
        />
      ) : null}

      {candidates.length === 0 ? (
        <section className="tosv3-glass-panel pipeline-deck-panel dash-panel dash-surface-1" data-testid="setups-candidates-panel">
          <header className="dash-panel__header">
            <h2 className="dash-section-title">Surfaced candidates</h2>
            <p className="dash-panel__subtitle">Qualified setups — core scanner Tier A/B only</p>
          </header>
          <div className="dash-empty-compact">
            <EmptyStateWithReason
              title="No surfaced candidates on this scan"
              reason={
                base.latest.candidateCountSurfaced === 0
                  ? `Latest run ${base.latest.id.slice(0, 12)}… completed with Gate 1 ${displayGate1ScanLevel(String(base.latest.gate1Level))} and ${base.latest.symbolCountAfterTradability} symbols passing tradability — none met Tier A/B surfacing rules. Use Market & setup insight and rejection diagnostics above, or closest-to-valid symbols below.`
                  : "No Tier A/B candidates in this scan run."
              }
              data-testid="setups-candidates-empty"
            >
              <Link href="/dashboard" className="btn btn-secondary text-xs">
                Back to Dashboard
              </Link>
            </EmptyStateWithReason>
          </div>
        </section>
      ) : (
        <section className="tosv3-glass-panel pipeline-deck-panel dash-panel dash-surface-1" data-testid="setups-candidates-panel">
          <header className="dash-panel__header">
            <h2 className="dash-section-title">
              Surfaced candidates ({candidates.length})
            </h2>
            <p className="dash-panel__subtitle">Qualified setups — core scanner Tier A/B only</p>
          </header>
          <SetupsCandidatesMasterDetail
            candidates={candidatesWithHealth.map((c): SetupsCandidateBundle => {
              const lines = reasonsToStrings(c.reasons);
              const rankComponents = rankComponentsFromReasons(c.reasons);
              const rankBreakdownLines = rankComponents
                ? formatGate2RankBreakdownLines(rankComponents).map(humanizeDisplayLine)
                : [];
              const rsUi = rsMap.get(c.symbolKey) ?? null;
              const rsRankPreviewLines =
                rankComponents != null
                  ? formatRsRankPreviewLines(
                      buildGate2RankWithRsPreview(
                        rankComponents.rankScore,
                        rsUi?.rs20SpreadPct ?? null
                      )
                    ).map(humanizeDisplayLine)
                  : [];
              const tier = c.quality === ScanQuality.A ? "A" : "B";
              const perfHint = setupPerfMap.get(`${c.setupType}:${c.quality}`) ?? null;
              return {
                candidate: {
                  id: c.id,
                  symbolKey: c.symbolKey,
                  lifecycleSortLabel: c.lifecycleSortLabel,
                  healthLevel: c.healthLevel,
                  healthScore: c.healthScore,
                  healthScoreLabel: c.healthScoreLabel,
                  healthLines: c.healthLines,
                  healthHint: c.healthHint,
                  healthSummary: c.healthSummary,
                  quality: c.quality,
                  close: c.close,
                  pullbackZoneLow: c.pullbackZoneLow,
                  pullbackZoneHigh: c.pullbackZoneHigh,
                  stopLevel: c.stopLevel,
                  barDate: new Date(c.barDate).toLocaleDateString("en-CA"),
                  setupType: c.setupType,
                },
                perfHint: fmtSetupPerfHint(tier, perfHint),
                reasonsLines: lines,
                rankScore: c.rankScore,
                rankBreakdownLines,
                rsRankPreviewLines,
                rsDiagnostic: rsUi,
              };
            })}
          />
        </section>
      )}
    </>
  );
}
