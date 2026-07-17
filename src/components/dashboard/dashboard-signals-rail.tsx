import type { ReactNode } from "react";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  ConfidenceBand,
  SetupQualityLadderDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import type { HostilityGaugeTone } from "@/lib/dashboard/hostility-gauge";
import { resolveHostilityGauge } from "@/lib/dashboard/hostility-gauge";
import { DashboardSignalsRailShell } from "@/components/dashboard/dashboard-signals-rail-shell";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";
import { DashboardConvictionRing } from "@/components/dashboard/dashboard-conviction-ring";
import { DashboardVnindexTrendChartLazy } from "@/components/dashboard/dashboard-vnindex-trend-chart-lazy";
import { DashboardHostilityGaugeLazy } from "@/components/dashboard/dashboard-hostility-gauge-lazy";

export type DashboardSignalsRailProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  ladder: SetupQualityLadderDto;
  verdict: VerdictDto;
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError?: boolean;
};

type SignalTone = "safe" | "warn" | "danger" | "neutral";

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

function SignalRow({
  icon,
  tone,
  title,
  meta,
  children,
}: {
  icon: ReactNode;
  tone: SignalTone;
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="dash-rail-row">
      <div className="dash-rail-row__head" title={`${title} — ${meta}`}>
        <span className={`dash-rail-icon dash-rail-icon--${tone}`}>{icon}</span>
        <span className="dash-rail-row__title">{title}</span>
        <span className="dash-rail-row__meta">{meta}</span>
      </div>
      <div className="dash-rail-row__body">{children}</div>
    </div>
  );
}

/**
 * Collapsible right rail housing the "Market data aligned" / "Today's scan
 * pulse" widgets plus the existing conviction ring / VNINDEX chart /
 * hostility gauge (moved out of the command band). Server component — the
 * collapse/expand toggle itself lives in DashboardSignalsRailShell (a thin
 * client boundary) so the data-heavy row content below (which touches
 * Prisma-adjacent types via decision-cockpit-dto) never enters the client
 * bundle.
 */
export function DashboardSignalsRail({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  ladder,
  verdict,
  vnindexHistory,
  vnindexHistoryError = false,
}: DashboardSignalsRailProps) {
  const gauge = resolveHostilityGauge(verdict.gate1Resolution.canonical);
  const confidenceBand = verdict.confidenceBand.value;
  const marketDataStale = freshness.delayedBackdrop || freshness.staleFlags.length > 0;
  const vnindexLast = vnindexHistory.length > 0 ? vnindexHistory[vnindexHistory.length - 1]!.close : null;

  return (
    <DashboardSignalsRailShell>
      <SignalRow
        icon={<IconShield />}
        tone={resolveMarketDataTone(freshness)}
        title="Market data"
        meta={marketDataStale ? "Stale" : "Aligned"}
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={scanDelayedBackdrop} />
      </SignalRow>

      <div className="dash-signals-rail__divider" aria-hidden="true" />

      <SignalRow
        icon={<IconPulse />}
        tone={resolveScanPulseTone(ladder)}
        title="Scan pulse"
        meta={`${ladder.totalClassified} today`}
      >
        <DashboardSetupQualityLadder ladder={ladder} embedded />
      </SignalRow>

      <div className="dash-signals-rail__divider" aria-hidden="true" />

      <SignalRow
        icon={<IconTarget />}
        tone={CONFIDENCE_TONE[confidenceBand]}
        title="Confidence"
        meta={CONFIDENCE_LABEL[confidenceBand]}
      >
        <div className="dash-signals-rail__ring-row">
          <DashboardConvictionRing band={confidenceBand} />
          <p className="dash-signals-rail__ring-copy">
            How much evidence backs today&rsquo;s verdict — based on gate alignment &amp; data
            coverage.
          </p>
        </div>
      </SignalRow>

      <div className="dash-signals-rail__divider" aria-hidden="true" />

      <SignalRow
        icon={<IconTrend />}
        tone={resolveVnindexTone(vnindexHistory)}
        title="VNINDEX"
        meta={vnindexLast != null ? vnindexLast.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
      >
        <DashboardVnindexTrendChartLazy history={vnindexHistory} error={vnindexHistoryError} />
      </SignalRow>

      <div className="dash-signals-rail__divider" aria-hidden="true" />

      <SignalRow
        icon={<IconAlertTriangle />}
        tone={HOSTILITY_TONE[gauge.tone]}
        title="Hostility"
        meta={gauge.label}
      >
        <DashboardHostilityGaugeLazy gauge={gauge} />
      </SignalRow>
    </DashboardSignalsRailShell>
  );
}
