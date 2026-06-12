"use client";

import Link from "next/link";
import type { ReviewStatusDotsProps } from "./types";

function reviewPriorityLabel(tier: string): string {
  switch (tier) {
    case "urgent":
      return "Urgent";
    case "high_attention":
      return "High attention";
    case "routine_review":
      return "Routine review";
    default:
      return tier.replace(/_/g, " ");
  }
}

type DotTone = "ok" | "warn" | "risk" | "neutral";

function StatusDot({
  tone,
  label,
  title,
}: {
  tone: DotTone;
  label: string;
  title?: string;
}) {
  const dotClass =
    tone === "ok"
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
      : tone === "warn"
        ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
        : tone === "risk"
          ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]"
          : "bg-slate-500";

  return (
    <span
      className="group/dot relative inline-flex items-center gap-1.5"
      title={title ?? label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      {!compactLabel(label) ? (
        <span className="font-mono text-[9px] uppercase tracking-wide text-slate-500 group-hover/dot:text-slate-300">
          {label}
        </span>
      ) : null}
      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden whitespace-nowrap rounded border border-slate-700/80 bg-slate-950/95 px-2 py-1 font-mono text-[10px] text-slate-300 shadow-lg group-hover/dot:block">
        {title ?? label}
      </span>
    </span>
  );
}

function compactLabel(label: string): boolean {
  return label.length > 14;
}

export function ReviewStatusDots({
  tradeId,
  priorityTier,
  reviewDto,
  reviewedToday,
  escalationCues,
  evolutionStateLabel,
  evolutionExplainLine,
  compact,
  sessionMode,
  sessionFocused,
}: ReviewStatusDotsProps) {
  const stopTone: DotTone =
    reviewDto.surface === "stop_violated" || reviewDto.stopBand === "breached"
      ? "risk"
      : reviewDto.stopBand === "tight"
        ? "warn"
        : "neutral";

  if (sessionMode && !sessionFocused) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded border border-slate-700/60 bg-slate-900/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-slate-300">
          {reviewPriorityLabel(priorityTier)}
        </span>
        <StatusDot
          tone={reviewedToday ? "ok" : "warn"}
          label={reviewedToday ? "Done" : "Due"}
        />
        <Link
          href={`/trades/${tradeId}`}
          className="font-mono text-[9px] uppercase tracking-wide text-cyan-400/80 hover:text-cyan-300"
        >
          Sheet
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-1"
      data-testid={compact ? "trades-review-cell-dense" : undefined}
    >
      <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cyan-200">
        {reviewPriorityLabel(priorityTier)}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <StatusDot tone={stopTone} label="Stop" title={reviewDto.stopBandLabel} />
        <StatusDot
          tone={reviewedToday ? "ok" : "warn"}
          label={reviewedToday ? "Logged" : "Due"}
        />
        {evolutionStateLabel ? (
          <StatusDot
            tone="neutral"
            label="Evo"
            title={evolutionExplainLine ?? evolutionStateLabel}
          />
        ) : null}
        {escalationCues.length > 0 ? (
          <StatusDot tone="warn" label="!" title={escalationCues.join(" · ")} />
        ) : null}
      </div>
      {!compact && reviewDto.headline ? (
        <p className="max-w-[10rem] truncate font-mono text-[9px] text-slate-500">
          {reviewDto.headline}
        </p>
      ) : null}
    </div>
  );
}
