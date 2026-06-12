"use client";

import type { ReactNode } from "react";
import { Activity, Shield, TrendingUp } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { CommandBarData, StatusTone } from "./types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  data: CommandBarData;
  loading?: boolean;
};

function toneTextClass(tone?: StatusTone): string {
  if (tone === "danger") return "text-red-400";
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

function StatDivider() {
  return (
    <div
      className="hidden sm:block h-9 w-px shrink-0 self-center border-r border-gray-800/50"
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
    <div className="flex shrink-0 flex-col gap-1">
      <StatLabel icon={icon}>{label}</StatLabel>
      {children}
    </div>
  );
}

function BarValue({
  children,
  mono = false,
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`text-sm font-medium text-gray-100 whitespace-nowrap ${mono ? "font-mono tabular-nums" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function MonetaryBarValue({ value, tone }: { value: string; tone?: StatusTone }) {
  const { amount, suffix } = splitCurrencySuffix(value);
  const toneClass = toneTextClass(tone);

  return (
    <BarValue mono>
      <span className={`inline-flex items-baseline gap-1 ${toneClass}`}>
        <span>{amount}</span>
        {suffix ? <span className="text-xs font-medium opacity-90">{suffix}</span> : null}
      </span>
    </BarValue>
  );
}

function ToneBarValue({ value, tone }: { value: string; tone?: StatusTone }) {
  const { amount, suffix } = splitCurrencySuffix(value);
  if (suffix) {
    return <MonetaryBarValue value={value} tone={tone} />;
  }

  return (
    <BarValue mono className={toneTextClass(tone)}>
      {value}
    </BarValue>
  );
}

export function CommandBar({ data, loading = false }: Props) {
  const hasFlowStats = data.stats.length > 0;

  return (
    <Card className="cd-card--glass cd-span-12 overflow-hidden" data-testid="command-deck-bar">
      <div className="flex items-center gap-6 overflow-x-auto px-5 py-4 sm:gap-8">
        {/* Session & benchmark */}
        <div className="flex shrink-0 items-center gap-6 sm:gap-8">
          <StatCell
            label="Session"
            icon={<Activity className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
          >
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="10rem" />
            ) : (
              <BarValue mono>{data.session}</BarValue>
            )}
          </StatCell>

          <StatCell
            label="VNINDEX"
            icon={<TrendingUp className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
          >
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="6rem" />
            ) : (
              <BarValue mono className="text-base font-semibold tracking-tight">
                {data.vnindex}
              </BarValue>
            )}
          </StatCell>
        </div>

        <StatDivider />

        {/* Market context */}
        <div className="flex shrink-0 items-center gap-6 sm:gap-8">
          <StatCell label="Freshness">
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="7rem" />
            ) : (
              <BarValue>{data.freshness}</BarValue>
            )}
          </StatCell>

          <StatCell label="Regime">
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="5rem" />
            ) : (
              <div className="flex flex-col gap-0.5">
                <BarValue>{data.regime}</BarValue>
                {data.regimeNote ? (
                  <span className="max-w-[16rem] text-[10px] leading-snug text-amber-400/85">
                    {data.regimeNote}
                  </span>
                ) : null}
              </div>
            )}
          </StatCell>

          {data.breadth ? (
            <StatCell label="Breadth">
              <BarValue mono>{loading ? "—" : data.breadth}</BarValue>
            </StatCell>
          ) : null}

          <StatCell label="Volatility">
            <BarValue>{loading ? "—" : data.volatility}</BarValue>
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
            <div className="whitespace-nowrap">
              <Badge tone="danger" pulse>
                {data.watchState}
              </Badge>
            </div>
          )}
        </StatCell>

        {hasFlowStats ? (
          <>
            <StatDivider />
            <div className="flex shrink-0 items-center gap-6 sm:gap-8">
              {data.stats.map((stat) => (
                <StatCell key={stat.label} label={stat.label}>
                  {loading ? (
                    <LoadingSkeleton height="1.25rem" width="5rem" />
                  ) : (
                    <ToneBarValue value={stat.value} tone={stat.tone} />
                  )}
                </StatCell>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
