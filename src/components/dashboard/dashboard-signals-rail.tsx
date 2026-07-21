import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  ActionableBlockerDto,
  ConfidenceBand,
  EvidenceChipDto,
  SetupQualityLadderDto,
  VerdictDto,
  VerdictUxLevel,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import type { HostilityGaugeTone } from "@/lib/dashboard/hostility-gauge";
import { resolveHostilityGauge } from "@/lib/dashboard/hostility-gauge";
import {
  DashboardSignalsDock,
  type DashboardSignalDescriptor,
  type SignalTone,
} from "@/components/dashboard/dashboard-signals-dock";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";
import { DashboardConvictionRing } from "@/components/dashboard/dashboard-conviction-ring";
import { DashboardVnindexTrendChartLazy } from "@/components/dashboard/dashboard-vnindex-trend-chart-lazy";
import { DashboardHostilityGaugeLazy } from "@/components/dashboard/dashboard-hostility-gauge-lazy";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";

export type DashboardSignalsRailProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  ladder: SetupQualityLadderDto;
  verdict: VerdictDto;
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError?: boolean;
  surfacedCount: number;
  evidence: EvidenceChipDto[];
  blockers: ActionableBlockerDto[];
};

function resolveMarketDataTone(freshness: MarketFreshnessDto): SignalTone {
  const hasStale = freshness.delayedBackdrop || freshness.staleFlags.length > 0;
  if (!hasStale) return "safe";
  return freshness.staleFlags.some((f) => f.severity === "error") ? "danger" : "warn";
}

function resolveScanPulseTone(ladder: SetupQualityLadderDto): SignalTone {
  const byStage = new Map(ladder.stages.map((s) => [s.stage, s.count]));
  if ((byStage.get("avoid") ?? 0) > 0) return "danger";
  if ((byStage.get("tier_a") ?? 0) + (byStage.get("tier_b") ?? 0) > 0) return "safe";
  return "neutral";
}

const CONFIDENCE_TONE: Record<ConfidenceBand, SignalTone> = {
  high: "safe",
  medium: "warn",
  low: "neutral",
};
const CONFIDENCE_LABEL: Record<ConfidenceBand, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function resolveVnindexTone(history: VnindexHistoryPoint[]): SignalTone {
  if (history.length < 2) return "neutral";
  return history[history.length - 1]!.close >= history[0]!.close ? "safe" : "danger";
}

const HOSTILITY_TONE: Record<HostilityGaugeTone, SignalTone> = {
  calm: "safe",
  caution: "warn",
  hostile: "danger",
};

function resolveVerdictTone(uxLevel: VerdictUxLevel): SignalTone {
  switch (uxLevel) {
    case "NO_TRADE":
      return "danger";
    case "PROBE":
      return "warn";
    case "TRADE":
      return "safe";
    default:
      return "safe";
  }
}

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const IconPulse = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h4l2-7 4 14 2-7h6" />
  </svg>
);
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconTrend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 7 9 13 13 9 21 17" />
    <polyline points="21 10 21 17 14 17" />
  </svg>
);
const IconAlertTriangle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
const IconFlag = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 21V4" />
    <path d="M4 4h13l-2.5 4L17 12H4" />
  </svg>
);

/**
 * Server component building the descriptor array for the icon-only signals
 * dock — content is fully pre-rendered here (touching Prisma-adjacent types
 * via decision-cockpit-dto) so DashboardSignalsDock (a thin client boundary
 * owning only open/close + popover positioning) never needs those types.
 */
export function DashboardSignalsRail({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  ladder,
  verdict,
  vnindexHistory,
  vnindexHistoryError = false,
  surfacedCount,
  evidence,
  blockers,
}: DashboardSignalsRailProps) {
  const gauge = resolveHostilityGauge(verdict.gate1Resolution.canonical);
  const confidenceBand = verdict.confidenceBand.value;
  const marketDataStale = freshness.delayedBackdrop || freshness.staleFlags.length > 0;
  const vnindexLast = vnindexHistory.length > 0 ? vnindexHistory[vnindexHistory.length - 1]!.close : null;

  const items: DashboardSignalDescriptor[] = [
    {
      id: "verdict",
      icon: <IconFlag />,
      tone: resolveVerdictTone(verdict.uxLevel.value),
      title: "Verdict",
      meta: verdict.headline.value,
      content: (
        <DashboardDecisionHero
          verdict={verdict}
          surfacedCount={surfacedCount}
          evidence={evidence}
          blockers={blockers}
        />
      ),
    },
    {
      id: "market-data",
      icon: <IconShield />,
      tone: resolveMarketDataTone(freshness),
      title: "Market data",
      meta: marketDataStale ? "Stale" : "Aligned",
      content: (
        <div className="dash-dock-widget">
          <DashboardMarketStatusBar freshness={freshness} />
          <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={scanDelayedBackdrop} />
        </div>
      ),
    },
    {
      id: "scan-pulse",
      icon: <IconPulse />,
      tone: resolveScanPulseTone(ladder),
      title: "Scan pulse",
      meta: `${ladder.totalClassified} today`,
      content: (
        <div className="dash-dock-widget">
          <DashboardSetupQualityLadder ladder={ladder} embedded />
        </div>
      ),
    },
    {
      id: "confidence",
      icon: <IconTarget />,
      tone: CONFIDENCE_TONE[confidenceBand],
      title: "Confidence",
      meta: CONFIDENCE_LABEL[confidenceBand],
      content: (
        <div className="dash-dock-widget dash-signals-rail__ring-row">
          <DashboardConvictionRing band={confidenceBand} />
          <p className="dash-signals-rail__ring-copy">
            How much evidence backs today&rsquo;s verdict — based on gate alignment &amp; data
            coverage.
          </p>
        </div>
      ),
    },
    {
      id: "vnindex",
      icon: <IconTrend />,
      tone: resolveVnindexTone(vnindexHistory),
      title: "VNINDEX",
      meta: vnindexLast != null ? vnindexLast.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—",
      content: (
        <div className="dash-dock-widget">
          <DashboardVnindexTrendChartLazy history={vnindexHistory} error={vnindexHistoryError} />
        </div>
      ),
    },
    {
      id: "hostility",
      icon: <IconAlertTriangle />,
      tone: HOSTILITY_TONE[gauge.tone],
      title: "Hostility",
      meta: gauge.label,
      content: (
        <div className="dash-dock-widget">
          <DashboardHostilityGaugeLazy gauge={gauge} />
        </div>
      ),
    },
  ];

  return <DashboardSignalsDock items={items} />;
}
