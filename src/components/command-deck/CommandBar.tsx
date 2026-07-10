"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ChevronDown, Gauge, Shield, TrendingUp } from "lucide-react";
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

type Tone = "danger" | "warning" | "success" | "neutral";

const NUMERIC_SPLIT = /([+\-−]?\d[\d.,%/]*)/g;

function isNumericChunk(part: string): boolean {
  return /^[+\-−]?\d[\d.,%/]*$/.test(part);
}

/** Semantic tone class backed by foundation tokens (not raw colors). */
function toneClass(tone?: StatusTone | Tone): string {
  if (tone === "danger") return "cd-tone-danger";
  if (tone === "warning") return "cd-tone-warning";
  if (tone === "success") return "cd-tone-success";
  return "";
}

function inferMomentumTrend(value: string, tone?: StatusTone): "up" | "down" | "flat" {
  if (tone === "danger" || value.trim().startsWith("-") || value.trim().startsWith("−")) {
    return "down";
  }
  if (tone === "success") return "up";
  return "flat";
}

/** Verdict tone derived from the decision lead + regime text (text still conveys meaning). */
function verdictTone(lead: string, regime: string): Tone {
  const t = `${lead} ${regime}`.toLowerCase();
  if (t.includes("protect") || t.includes("no trade") || t.includes("avoid") || t.includes("danger")) return "danger";
  if (t.includes("caution") || t.includes("warning") || t.includes("probe") || t.includes("wait")) return "warning";
  if (t.includes("trade") || t.includes("favorable") || t.includes("pass") || t.includes("execute") || t.includes("normal"))
    return "success";
  return "neutral";
}

function regimeTone(regime: string): Tone {
  const l = regime.toLowerCase();
  if (l.includes("caution") || l.includes("warning") || l.includes("no trade")) return "warning";
  if (l.includes("favorable") || l.includes("pass") || l.includes("trade mode")) return "success";
  return "neutral";
}

function TabularText({ children, className = "" }: { children: string; className?: string }) {
  const parts = children.split(NUMERIC_SPLIT);
  return (
    <span className={`whitespace-nowrap ${className}`.trim()}>
      {parts.map((part, index) =>
        isNumericChunk(part) ? (
          <span key={`${part}-${index}`} className="cd-mono">
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
    trend === "up"
      ? "var(--cd-pnl-pos, #34d399)"
      : trend === "down"
        ? "var(--cd-pnl-neg, #f87171)"
        : "var(--cd-neutral, #94a3b8)";
  const points =
    trend === "up"
      ? "2,12 9,10 16,9 24,7 32,5 38,3"
      : trend === "down"
        ? "2,3 9,5 16,7 24,9 32,11 38,13"
        : "2,8 10,7 18,9 26,8 34,9 38,8";

  return (
    <svg width={32} height={14} viewBox="0 0 40 16" className="cd-spark" aria-hidden>
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

/** Compact label/value stat used across the status cluster. */
function StatItem({
  label,
  icon,
  children,
  valueClass = "",
  title,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="cd-stat">
      <span className="cd-stat__label">
        {icon}
        {label}
      </span>
      <span className={`cd-stat__value ${valueClass}`.trim()} title={title}>
        {children}
      </span>
    </div>
  );
}

function ForeignFlowChip({ stats, loading }: { stats: CommandBarStat[]; loading: boolean }) {
  const primary = stats.find((s) => s.label.toLowerCase().includes("foreign 1d")) ?? stats[0];
  if (!primary) return null;

  const trend = inferMomentumTrend(primary.value, primary.tone);

  return (
    <details className="cd-foreign-flow" data-testid="foreign-flow-chip">
      <summary className="cd-foreign-flow__chip">
        <span className="cd-foreign-flow__label">Foreign 1D</span>
        {loading ? (
          <LoadingSkeleton height="1rem" width="4rem" />
        ) : (
          <span className={`cd-foreign-flow__value ${toneClass(primary.tone)}`.trim()}>
            <MiniMomentumSparkline trend={trend} />
            <TabularText>{primary.value}</TabularText>
          </span>
        )}
        <ChevronDown className="cd-foreign-flow__chevron h-3 w-3" aria-hidden />
      </summary>
      <div className="cd-foreign-flow__detail" data-testid="foreign-flow-detail">
        {stats.map((stat) => (
          <div key={stat.label} className="cd-foreign-flow__detail-row">
            <span className="cd-foreign-flow__detail-label">{stat.label}</span>
            <span className={`cd-mono cd-foreign-flow__detail-value ${toneClass(stat.tone)}`.trim()}>
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
      <Link href={cta.primaryHref} className="cd-session-actions__link cd-session-actions__link--primary">
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
  const vTone = verdictTone(headerCta.lead, data.regime);
  const rTone = regimeTone(data.regime);
  const vnindexTrend: "up" | "down" | "flat" =
    data.volatility.toLowerCase().includes("down") || data.regime.toLowerCase().includes("caution") ? "down" : "up";
  const hasActiveWatch = !data.watchState.toLowerCase().includes("no active");

  return (
    <Card className="cd-session-bar overflow-hidden" data-testid="command-deck-bar">
      <div className="cd-session-bar__inner" aria-label="Session command bar">
        {/* Decision verdict — primary, scanned first */}
        <div className={`cd-verdict cd-verdict--${vTone}`}>
          <span className="cd-verdict__kicker">Decision</span>
          {loading ? (
            <LoadingSkeleton height="1.25rem" width="9rem" />
          ) : (
            <span className="cd-verdict__lead">
              <span className="cd-verdict__dot" aria-hidden />
              {headerCta.lead}
            </span>
          )}
        </div>

        <div className="cd-session-bar__divider" aria-hidden />

        {/* Status cluster — regime, freshness, watch, then market context */}
        <div className="cd-session-bar__status" role="group" aria-label="Market status">
          <StatItem label="Regime" title={data.regimeNote ?? undefined} valueClass={`cd-truncate ${toneClass(rTone)}`}>
            <TabularText>{loading ? "—" : data.regime}</TabularText>
          </StatItem>

          <StatItem label="Freshness">
            <TabularText>{loading ? "—" : data.freshness}</TabularText>
          </StatItem>

          <StatItem label="Watch" icon={<Shield className="cd-stat__icon" aria-hidden />}>
            <Badge tone={hasActiveWatch ? "warning" : "neutral"} size="compact">
              <TabularText>{loading ? "—" : data.watchState}</TabularText>
            </Badge>
          </StatItem>

          <StatItem label="VNINDEX" icon={<TrendingUp className="cd-stat__icon" aria-hidden />} valueClass="cd-stat__value--strong">
            {loading ? (
              <LoadingSkeleton height="1rem" width="4rem" />
            ) : (
              <>
                <MiniMomentumSparkline trend={vnindexTrend} />
                <TabularText>{data.vnindex}</TabularText>
              </>
            )}
          </StatItem>

          <StatItem label="Volatility" icon={<Gauge className="cd-stat__icon" aria-hidden />}>
            <TabularText>{loading ? "—" : data.volatility}</TabularText>
          </StatItem>

          <StatItem label="Session" icon={<Activity className="cd-stat__icon" aria-hidden />}>
            <TabularText>{loading ? "—" : data.session}</TabularText>
          </StatItem>
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
