"use client";

import type { ReactNode } from "react";
import { Activity, Shield, TrendingUp } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { CommandBarData, CommandBarStat, StatusTone } from "./types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  data: CommandBarData;
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

function splitCurrencySuffix(value: string): { amount: string; suffix: string | null } {
  const idx = value.indexOf("₫");
  if (idx === -1) return { amount: value, suffix: null };
  return {
    amount: value.slice(0, idx).trim(),
    suffix: value.slice(idx).trim(),
  };
}

function isNegativeFlow(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("-") || trimmed.startsWith("−");
}

function inferMomentumTrend(value: string, tone?: StatusTone): "up" | "down" | "flat" {
  if (tone === "danger" || isNegativeFlow(value)) return "down";
  if (tone === "success") return "up";
  if (tone === "warning") return "flat";
  return "up";
}

/** Wrap digit runs in tabular mono spans — prevents live-update width jitter. */
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
    <svg
      width={40}
      height={16}
      viewBox="0 0 40 16"
      className="shrink-0 opacity-90"
      aria-hidden
    >
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

function StatDivider() {
  return (
    <div
      className="hidden h-9 w-px shrink-0 self-center border-r border-gray-800/50 sm:block"
      aria-hidden
    />
  );
}

function StatLabel({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400/70">
      {icon}
      {children}
    </span>
  );
}

function StatBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 cursor-pointer rounded-lg px-3 py-2 transition-all duration-200 hover:bg-white/10 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function StatCell({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <StatBlock>
      <div className="flex flex-col gap-1">
        <StatLabel icon={icon}>{label}</StatLabel>
        {children}
      </div>
    </StatBlock>
  );
}

function BarValue({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-sm font-medium text-gray-100 ${className}`.trim()}>{children}</div>
  );
}

function regimePresentation(regime: string): string {
  const lower = regime.toLowerCase();
  if (lower.includes("caution") || lower.includes("warning") || lower.includes("no trade")) {
    return "text-amber-300 drop-shadow-[0_0_8px_rgba(255,184,0,0.5)]";
  }
  if (lower.includes("favorable") || lower.includes("pass") || lower.includes("trade mode")) {
    return "text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]";
  }
  return "text-gray-100";
}

function MonetaryBarValue({
  value,
  tone,
  sparkline,
}: {
  value: string;
  tone?: StatusTone;
  sparkline?: ReactNode;
}) {
  const { amount, suffix } = splitCurrencySuffix(value);
  const toneClass = toneTextClass(tone);

  return (
    <BarValue>
      <span className={`inline-flex items-center gap-2 ${toneClass}`}>
        {sparkline}
        <span className="inline-flex items-baseline gap-1">
          <TabularText>{amount}</TabularText>
          {suffix ? (
            <span className="text-xs font-medium font-mono tabular-nums opacity-90">
              {suffix}
            </span>
          ) : null}
        </span>
      </span>
    </BarValue>
  );
}

function ToneBarValue({
  value,
  tone,
  sparkline,
}: {
  value: string;
  tone?: StatusTone;
  sparkline?: ReactNode;
}) {
  const { suffix } = splitCurrencySuffix(value);
  if (suffix) {
    return <MonetaryBarValue value={value} tone={tone} sparkline={sparkline} />;
  }

  return (
    <BarValue className={toneTextClass(tone)}>
      <span className="inline-flex items-center gap-2">
        {sparkline}
        <TabularText>{value}</TabularText>
      </span>
    </BarValue>
  );
}

function ForeignFlowPill({
  stats,
  loading,
}: {
  stats: CommandBarStat[];
  loading: boolean;
}) {
  return (
    <StatBlock className="!px-1 !py-1 hover:bg-transparent">
      <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-[#1A1D24] px-4 py-1.5">
        {stats.map((stat) => {
          const isForeign1d = stat.label.toLowerCase().includes("foreign 1d");
          const sparkline =
            !loading && isForeign1d ? (
              <MiniMomentumSparkline
                trend={inferMomentumTrend(stat.value, stat.tone)}
              />
            ) : null;

          return (
            <div key={stat.label} className="flex shrink-0 flex-col gap-1">
              <StatLabel>{stat.label}</StatLabel>
              {loading ? (
                <LoadingSkeleton height="1.25rem" width="5rem" />
              ) : (
                <ToneBarValue value={stat.value} tone={stat.tone} sparkline={sparkline} />
              )}
            </div>
          );
        })}
      </div>
    </StatBlock>
  );
}

function WatchStateValue({ watchState }: { watchState: string }) {
  const hasActiveWatch = !watchState.toLowerCase().includes("no active");
  const tone: StatusTone = hasActiveWatch ? "warning" : "neutral";

  return (
    <div className="whitespace-nowrap">
      <span
        className={
          hasActiveWatch
            ? "inline-flex drop-shadow-[0_0_8px_rgba(255,184,0,0.5)]"
            : undefined
        }
      >
        <Badge tone={tone} pulse={hasActiveWatch}>
          <span className="uppercase tracking-wide">
            <TabularText>{watchState}</TabularText>
          </span>
        </Badge>
      </span>
    </div>
  );
}

export function CommandBar({ data, loading = false }: Props) {
  const foreignStats = data.stats.filter((s) => s.label.toLowerCase().startsWith("foreign"));
  const regimeClassName = regimePresentation(data.regime);
  const vnindexTrend: "up" | "down" | "flat" =
    data.volatility.toLowerCase().includes("down") ||
    data.regime.toLowerCase().includes("caution")
      ? "down"
      : "up";

  return (
    <Card className="cd-span-12 overflow-hidden" data-testid="command-deck-bar">
      <div className="flex items-center gap-4 overflow-x-auto px-4 py-3 sm:gap-6">
        {/* Session & benchmark */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <StatCell
            label="Session"
            icon={<Activity className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
          >
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="10rem" />
            ) : (
              <BarValue>
                <TabularText>{data.session}</TabularText>
              </BarValue>
            )}
          </StatCell>

          <StatCell
            label="VNINDEX"
            icon={<TrendingUp className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
          >
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="6rem" />
            ) : (
              <BarValue className="text-base font-semibold tracking-tight">
                <span className="inline-flex items-center gap-2">
                  {!loading ? <MiniMomentumSparkline trend={vnindexTrend} /> : null}
                  <TabularText className="text-gray-100">{data.vnindex}</TabularText>
                </span>
              </BarValue>
            )}
          </StatCell>
        </div>

        <StatDivider />

        {/* Market context */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <StatCell label="Freshness">
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="7rem" />
            ) : (
              <BarValue>
                <TabularText>{data.freshness}</TabularText>
              </BarValue>
            )}
          </StatCell>

          <StatCell label="Regime">
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="5rem" />
            ) : (
              <div className="flex flex-col gap-0.5">
                <BarValue className={regimeClassName}>
                  <TabularText>{data.regime}</TabularText>
                </BarValue>
                {data.regimeNote ? (
                  <span className="max-w-[16rem] text-[10px] leading-snug text-amber-400/85 drop-shadow-[0_0_6px_rgba(255,184,0,0.35)]">
                    {data.regimeNote}
                  </span>
                ) : null}
              </div>
            )}
          </StatCell>

          {data.breadth ? (
            <StatCell label="Breadth">
              <BarValue>
                <TabularText>{loading ? "—" : data.breadth}</TabularText>
              </BarValue>
            </StatCell>
          ) : null}

          <StatCell label="Volatility">
            <BarValue>
              <TabularText>{loading ? "—" : data.volatility}</TabularText>
            </BarValue>
          </StatCell>
        </div>

        <StatDivider />

        <StatCell
          label="Watch state"
          icon={<Shield className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
        >
          {loading ? (
            <LoadingSkeleton height="1.5rem" width="8rem" />
          ) : (
            <WatchStateValue watchState={data.watchState} />
          )}
        </StatCell>

        {foreignStats.length > 0 ? (
          <>
            <StatDivider />
            <ForeignFlowPill stats={foreignStats} loading={loading} />
          </>
        ) : null}
      </div>
    </Card>
  );
}
