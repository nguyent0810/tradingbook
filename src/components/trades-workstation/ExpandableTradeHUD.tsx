"use client";

import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { formatVND } from "@/lib/formatters";
import { formatEquityThousandVndPerShare } from "@/lib/formatters";
import type { ExpandableTradeHUDProps, PositionalTimelineProps } from "./types";
import "./trades-workstation.css";

function PositionalTimeline({
  direction,
  entryPrice,
  markPrice,
  stopLoss,
  takeProfit,
}: PositionalTimelineProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const lo = Math.min(
    entryPrice,
    markPrice ?? entryPrice,
    stopLoss ?? entryPrice,
    takeProfit ?? entryPrice
  );
  const hi = Math.max(
    entryPrice,
    markPrice ?? entryPrice,
    stopLoss ?? entryPrice,
    takeProfit ?? entryPrice
  );
  const span = hi - lo || 1;
  const x = (v: number) => 40 + ((v - lo) / span) * 520;

  const entryX = x(entryPrice);
  const markX = markPrice != null ? x(markPrice) : entryX;
  const stopX = stopLoss != null ? x(stopLoss) : null;
  const tpX = takeProfit != null ? x(takeProfit) : null;

  return (
    <svg
      viewBox="0 0 600 88"
      className="tw-timeline-svg h-20 w-full"
      aria-label="Position price timeline"
    >
      <defs>
        <linearGradient id="tw-timeline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <line
        x1={entryX}
        y1="44"
        x2={markX}
        y2="44"
        stroke="url(#tw-timeline-grad)"
        strokeWidth="2"
        strokeDasharray="6 6"
        className={reducedMotion ? undefined : "tw-timeline-dash"}
      />
      <circle cx={entryX} cy="44" r="5" fill="#64748b" stroke="#94a3b8" strokeWidth="1.5" />
      <text x={entryX} y="68" textAnchor="middle" className="fill-slate-500 text-[9px] font-mono">
        Entry
      </text>
      <text x={entryX} y="24" textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">
        {formatEquityThousandVndPerShare(entryPrice)}
      </text>

      {markPrice != null ? (
        <>
          <circle
            cx={markX}
            cy="44"
            r="5"
            fill="#22d3ee"
            className={reducedMotion ? undefined : "tw-mark-pulse"}
          />
          <text x={markX} y="68" textAnchor="middle" className="fill-cyan-400 text-[9px] font-mono">
            Mark
          </text>
          <text x={markX} y="24" textAnchor="middle" className="fill-cyan-200 text-[10px] font-mono">
            {formatEquityThousandVndPerShare(markPrice)}
          </text>
        </>
      ) : null}

      {stopX != null && stopLoss != null ? (
        <>
          <circle cx={stopX} cy="44" r="4" fill="#fb7185" />
          <text x={stopX} y="68" textAnchor="middle" className="fill-rose-400 text-[9px] font-mono">
            Stop
          </text>
        </>
      ) : null}

      {tpX != null && takeProfit != null ? (
        <>
          <circle cx={tpX} cy="44" r="4" fill="#34d399" />
          <text x={tpX} y="68" textAnchor="middle" className="fill-emerald-400 text-[9px] font-mono">
            Target
          </text>
        </>
      ) : null}

      <text x="8" y="48" className="fill-slate-600 text-[8px] font-mono uppercase">
        {direction}
      </text>
    </svg>
  );
}

const CHECKLIST_ITEMS = [
  { key: "stopReviewed", label: "Stop reviewed" },
  { key: "structureReviewed", label: "Structure reviewed" },
  { key: "sizingReviewed", label: "Sizing reviewed" },
  { key: "exitPlanReviewed", label: "Exit plan reviewed" },
] as const;

export function ExpandableTradeHUD({
  trade,
  openPack,
  latestBar,
  formatBarSessionDate,
}: ExpandableTradeHUDProps) {
  const { reviewDto, memoryLines, escalationCues, postureExplainLines } = openPack;
  const checklist = reviewDto.latestChecklist;
  const markPrice = latestBar?.close ?? null;

  return (
    <div className="tw-hud-panel border-t border-cyan-500/15 bg-slate-950/40 px-4 py-3">
      <PositionalTimeline
        direction={trade.direction}
        entryPrice={trade.entryPrice}
        markPrice={markPrice}
        stopLoss={trade.stopLoss}
        takeProfit={trade.takeProfit}
      />

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Technical checklist">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            Technical checklist
          </p>
          <ul className="space-y-1.5">
            {CHECKLIST_ITEMS.map((item) => {
              const done = checklist?.[item.key] === true;
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-2 font-mono text-xs text-slate-400"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      done
                        ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                        : "bg-slate-600"
                    }`}
                  />
                  {item.label}
                </li>
              );
            })}
          </ul>
          {reviewDto.setupValidityLine ? (
            <p className="mt-2 text-xs text-slate-500">Setup: {reviewDto.setupValidityLine}</p>
          ) : null}
        </section>

        <section aria-label="Review logs">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            Review logs
          </p>
          <div className="rounded-lg border border-slate-800/60 bg-black/30 p-3 font-mono text-xs leading-relaxed text-slate-400">
            <p className="text-slate-300">{reviewDto.headline}</p>
            {reviewDto.primaryReviewLabel ? (
              <p className="mt-1 text-slate-500">{reviewDto.primaryReviewLabel}</p>
            ) : null}
            {reviewDto.plannedCapitalAtRisk != null ? (
              <p className="mt-1 tabular-nums">
                At risk {formatVND(reviewDto.plannedCapitalAtRisk, false)}
              </p>
            ) : null}
            {escalationCues.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-amber-300/80">
                {escalationCues.map((c, i) => (
                  <li key={`esc-${i}`}>→ {c}</li>
                ))}
              </ul>
            ) : null}
            {memoryLines.length > 0 ? (
              <ul className="mt-2 space-y-0.5">
                {memoryLines.map((line, mi) => (
                  <li key={`mem-${mi}`}>· {line}</li>
                ))}
              </ul>
            ) : null}
            {postureExplainLines.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-slate-500">
                {postureExplainLines.map((line, pi) => (
                  <li key={`pos-${pi}`}>{line}</li>
                ))}
              </ul>
            ) : null}
            {latestBar ? (
              <p className="mt-2 text-slate-600">
                Latest bar {formatBarSessionDate(latestBar.date)}
              </p>
            ) : null}
          </div>
          <Link
            href={`/trades/${trade.id}`}
            className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wide text-cyan-400 hover:text-cyan-300"
          >
            Open trade sheet →
          </Link>
        </section>
      </div>
    </div>
  );
}
