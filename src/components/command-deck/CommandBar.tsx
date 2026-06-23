"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ChevronDown, Shield, TrendingUp } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { V3HeaderCta } from "@/lib/dashboard/dashboard-v3-view-model";
import type { CommandBarData, CommandBarStat, StatusTone } from "./types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  data: CommandBarData;
  headerCta: V3HeaderCta;
  loading?: boolean;
};

const NUMERIC_SPLIT = /([+\-−]?\d[\d.,%/]*)/g;

function isNumericChunk(part: string): boolean {
  return /^[+\-−]?\d[\d.,%/]*$/.test(part);
}

function toneTextClass(tone?: StatusTone): string {
  if (tone === "danger") return "text-rose-500";
  if (tone === "warning") return "text-amber-400";
  if (tone === "success") return "text-emerald-400";
  return "text-gray-100";
}

function inferMomentumTrend(value: string, tone?: StatusTone): "up" | "down" | "flat" {
  if (tone === "danger" || value.trim().startsWith("-") || value.trim().startsWith("−")) {
    return "down";
  }
  if (tone === "success") return "up";
  return "flat";
}

function TabularText({ children, className = "" }: { children: string; className?: string }) {
  const parts = children.split(NUMERIC_SPLIT);
  return (
    <span className={`whitespace-nowrap ${className}`.trim()}>
      {parts.map((part, index) =>
        isNumericChunk(part) ? (
          <span key={`${part}-${index}`} className="font-mono tabular-nums">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </span>
  );
}

function MiniMomentumSparkline({ trend }: { trend: "up" | "down" | "flat" }) {
  const stroke =
    trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#94a3b8";
  const points =
    trend === "up"
      ? "2,12 9,10 16,9 24,7 32,5 38,3"
      : trend === "down"
        ? "2,3 9,5 16,7 24,9 32,11 38,13"
        : "2,8 10,7 18,9 26,8 34,9 38,8";

  return (
    <svg width={32} height={14} viewBox="0 0 40 16" className="shrink-0 opacity-80" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400/70">
      {icon}
      {children}
    </span>
  );
}

function regimePresentation(regime: string): string {
  const lower = regime.toLowerCase();
  if (lower.includes("caution") || lower.includes("warning") || lower.includes("no trade")) {
    return "text-amber-300";
  }
  if (lower.includes("favorable") || lower.includes("pass") || lower.includes("trade mode")) {
    return "text-emerald-300";
  }
  return "text-gray-100";
}

function ForeignFlowChip({
  stats,
  loading,
}: {
  stats: CommandBarStat[];
  loading: boolean;
}) {
  const primary =
    stats.find((s) => s.label.toLowerCase().includes("foreign 1d")) ?? stats[0];
  if (!primary) return null;

  const trend = inferMomentumTrend(primary.value, primary.tone);

  return (
    <details className="cd-foreign-flow" data-testid="foreign-flow-chip">
      <summary className="cd-foreign-flow__chip">
        <span className="cd-foreign-flow__label">Foreign 1D</span>
        {loading ? (
          <LoadingSkeleton height="1rem" width="4rem" />
        ) : (
          <span className={`cd-foreign-flow__value ${toneTextClass(primary.tone)}`}>
            <MiniMomentumSparkline trend={trend} />
            <TabularText>{primary.value}</TabularText>
          </span>
        )}
        <ChevronDown className="cd-foreign-flow__chevron h-3 w-3 opacity-60" aria-hidden />
      </summary>
      <div className="cd-foreign-flow__detail" data-testid="foreign-flow-detail">
        {stats.map((stat) => (
          <div key={stat.label} className="cd-foreign-flow__detail-row">
            <span className="text-[10px] uppercase text-gray-400">{stat.label}</span>
            <span className={`text-xs font-mono tabular-nums ${toneTextClass(stat.tone)}`}>
              {loading ? "—" : stat.value}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function SessionActions({ cta }: { cta: V3HeaderCta }) {
  return (
    <div className="cd-session-actions">
      <Link href={cta.primaryHref} className="cd-session-actions__link">
        {cta.primaryLabel}
      </Link>
      {cta.secondaryHref && cta.secondaryLabel ? (
        <Link href={cta.secondaryHref} className="cd-session-actions__link">
          {cta.secondaryLabel}
        </Link>
      ) : null}
      <Link href="/setups" className="cd-session-actions__link">
        Latest scan
      </Link>
    </div>
  );
}

export function CommandBar({ data, headerCta, loading = false }: Props) {
  const foreignStats = data.stats.filter((s) => s.label.toLowerCase().startsWith("foreign"));
  const regimeClassName = regimePresentation(data.regime);
  const vnindexTrend: "up" | "down" | "flat" =
    data.volatility.toLowerCase().includes("down") ||
    data.regime.toLowerCase().includes("caution")
      ? "down"
      : "up";
  const hasActiveWatch = !data.watchState.toLowerCase().includes("no active");

  return (
    <Card className="cd-session-bar overflow-hidden" data-testid="command-deck-bar">
      <div className="cd-session-bar__inner">
        <div className="cd-session-bar__core">
          <div className="cd-session-bar__metric">
            <StatLabel icon={<Activity className="h-3 w-3 opacity-60" aria-hidden />}>
              Session
            </StatLabel>
            {loading ? (
              <LoadingSkeleton height="1rem" width="8rem" />
            ) : (
              <span className="cd-session-bar__value">
                <TabularText>{data.session}</TabularText>
              </span>
            )}
          </div>

          <div className="cd-session-bar__metric">
            <StatLabel icon={<TrendingUp className="h-3 w-3 opacity-60" aria-hidden />}>
              VNINDEX
            </StatLabel>
            {loading ? (
              <LoadingSkeleton height="1rem" width="4rem" />
            ) : (
              <span className="cd-session-bar__value cd-session-bar__value--strong">
                <MiniMomentumSparkline trend={vnindexTrend} />
                <TabularText>{data.vnindex}</TabularText>
              </span>
            )}
          </div>

          <div className="cd-session-bar__metric">
            <StatLabel>Freshness</StatLabel>
            <span className="cd-session-bar__value">
              <TabularText>{loading ? "—" : data.freshness}</TabularText>
            </span>
          </div>

          <div className="cd-session-bar__metric cd-session-bar__metric--regime">
            <StatLabel>Regime</StatLabel>
            <span className={`cd-session-bar__value truncate ${regimeClassName}`} title={data.regimeNote ?? undefined}>
              <TabularText>{loading ? "—" : data.regime}</TabularText>
            </span>
          </div>

          <div className="cd-session-bar__metric">
            <StatLabel>Volatility</StatLabel>
            <span className="cd-session-bar__value">
              <TabularText>{loading ? "—" : data.volatility}</TabularText>
            </span>
          </div>

          <div className="cd-session-bar__metric">
            <StatLabel icon={<Shield className="h-3 w-3 opacity-60" aria-hidden />}>
              Watch
            </StatLabel>
            <Badge tone={hasActiveWatch ? "warning" : "neutral"} pulse={hasActiveWatch} size="compact">
              <TabularText>{loading ? "—" : data.watchState}</TabularText>
            </Badge>
          </div>
        </div>

        {foreignStats.length > 0 ? (
          <div className="cd-session-bar__flow">
            <ForeignFlowChip stats={foreignStats} loading={loading} />
          </div>
        ) : null}

        <div className="cd-session-bar__actions">
          <SessionActions cta={headerCta} />
        </div>
      </div>
    </Card>
  );
}
