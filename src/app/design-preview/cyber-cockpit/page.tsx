import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "@/lib/dashboard/decision-cockpit-dto";
import { mapDashboardV3ViewModel } from "@/lib/dashboard/map-dashboard-v3-view-model";
import { CyberCommandDeck } from "@/components/cyber-command-deck";

/** Non-production — renders CyberCommandDeck with production-like NO TRADE fixture. */
function noTradeFixture(): DecisionCockpitInput {
  const freshness = buildMarketFreshnessDto({
    snapshot: {
      benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
      latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
      latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
    },
  });

  return {
    latestScan: {
      id: "cmpku2jyq000004l42cv873wq",
      runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
      gate1Level: "PASS",
      candidateCountA: 0,
      candidateCountB: 0,
      candidateCountSurfaced: 0,
      universeScannedCount: 412,
    },
    scanNotes: {
      invalidCountByCategory: {},
      topRejectionCategories: {
        pullback_zone_interaction: 42,
        extension_cap: 18,
      },
      rejectionSymbolsByCategory: {
        pullback_zone_interaction: ["HPG", "FPT", "VNM"],
        extension_cap: ["SSI", "VCB"],
      },
      topRejectionTerminalReasons: {},
      closestToValidSymbols: [
        {
          symbol: "HPG",
          partialPipelineScore: 0.82,
          stageRank: 58,
          reasonLineCount: 2,
          terminalCategory: "pullback_zone_interaction",
          terminalReasonPreview: "Current bar does not interact with the pullback box.",
          rankScore: 71.2,
          close: 28.5,
          breakoutLevel: 27.1,
          pullbackZoneLow: 27.8,
          pullbackZoneHigh: 28.2,
          stopLevel: 26.9,
        },
      ],
      recommendation: {
        likelyBottleneck: "pullback_zone_interaction",
        summary: "Largest bucket pullback_zone_interaction",
        note: "Use closest rows.",
      },
    },
    liveRegime: {
      level: "WARNING",
      symbol: "VNINDEX",
      latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1245.5 },
    },
    freshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
  };
}

export default function CyberCockpitPreviewPage() {
  const input = noTradeFixture();
  const dto = buildDecisionCockpitDto(input);
  const viewModel = mapDashboardV3ViewModel({
    cockpitDto: dto,
    freshness: input.freshness,
    regime: {
      ...input.liveRegime,
      storedBarsCount: 60,
      evaluatedBarsCount: 60,
      checkedAt: input.now ?? new Date(),
      reasons: [],
      trend: "bullish",
      momentum: "up",
    },
    latestScan: null,
    topSetups: [],
    trades: [],
    watchItemCount: 2,
    openPositionCount: 0,
  });

  return <CyberCommandDeck viewModel={viewModel} />;
}
