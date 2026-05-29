"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { truncateForChip } from "@/lib/dashboard/v3-user-copy";
import {
  AVOID_PLACEHOLDER_POSITIONS,
  radarActionLabel,
  radarDotSize,
  radarPosition,
  radarStatusClass,
} from "../v3-radar-utils";

type Props = {
  radar: DashboardV3ViewModel["radar"];
};

function readinessLabel(readiness: number): string {
  if (readiness >= 75) return "High readiness";
  if (readiness >= 55) return "Building readiness";
  return "Low readiness";
}

function riskLabel(risk: number): string {
  if (risk >= 70) return "High risk";
  if (risk >= 45) return "Elevated risk";
  return "Contained risk";
}

function signalTrace(item: DashboardV3ViewModel["radar"]["mapDots"][number]): number[] {
  const base = Math.max(8, Math.min(92, item.readiness));
  const caution = Math.max(6, Math.min(34, Math.round(item.risk / 3)));
  return [
    Math.max(5, base - caution),
    Math.max(5, base - Math.round(caution * 0.6)),
    Math.max(5, base - Math.round(caution * 0.35)),
    Math.max(5, base - Math.round(caution * 0.2)),
    Math.max(5, base),
  ];
}

function prefersHoverDetail(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function RadarDetailCard({
  detail,
  pinned,
  onDismissPin,
}: {
  detail: DashboardV3ViewModel["radar"]["mapDots"][number];
  pinned: boolean;
  onDismissPin: () => void;
}) {
  return (
    <div
      className="tosv3-radar-detail tosv3-radar-tooltip"
      role="status"
      aria-live="polite"
      id={`tosv3-radar-detail-${detail.symbol}`}
    >
      <div className="tosv3-radar-tooltip__head">
        <strong>{detail.symbol}</strong>
        <span>{radarActionLabel(detail)}</span>
        {pinned ? (
          <button
            type="button"
            className="tosv3-radar-detail__close"
            aria-label={`Close ${detail.symbol} details`}
            onClick={onDismissPin}
          >
            Close
          </button>
        ) : null}
      </div>
      <p>{detail.reason}</p>
      <div className="tosv3-radar-tooltip__meta">
        <span className="tabular-nums">
          Readiness {detail.readiness} · {readinessLabel(detail.readiness)}
        </span>
        <span className="tabular-nums">
          Risk {detail.risk} · {riskLabel(detail.risk)}
        </span>
      </div>
      <svg
        viewBox="0 0 120 24"
        className="tosv3-radar-tooltip__trace tosv3-radar-tooltip__trace--desktop"
        role="img"
        aria-hidden
      >
        {signalTrace(detail).map((candle, index) => {
          const x = 12 + index * 24;
          const bodyTop = 24 - candle;
          const wickTop = Math.max(2, bodyTop - 5);
          const wickBottom = Math.min(22, bodyTop + 8);
          const hue =
            detail.status === "qualified"
              ? "rgba(95, 223, 184, 0.92)"
              : "rgba(251, 191, 36, 0.92)";
          return (
            <g key={`${detail.symbol}-trace-${index}`}>
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={hue} strokeWidth="1.5" />
              <rect x={x - 3} y={bodyTop} width="6" height="7" rx="1.5" fill={hue} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function OpportunityRadar({ radar }: Props) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [pinnedSymbol, setPinnedSymbol] = useState<string | null>(null);
  const [bandsOpen, setBandsOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const detailSymbol = pinnedSymbol ?? hoveredSymbol;
  const detail = detailSymbol
    ? radar.mapDots.find((d) => d.symbol === detailSymbol)
    : null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedSymbol(null);
        setHoveredSymbol(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!pinnedSymbol) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (sectionRef.current?.contains(target)) return;
      setPinnedSymbol(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinnedSymbol]);

  const clearHoverUnlessPinned = (symbol: string) => {
    if (pinnedSymbol === symbol) return;
    setHoveredSymbol((current) => (current === symbol ? null : current));
  };

  return (
    <section
      ref={sectionRef}
      className="tosv3-panel tosv3-radar"
      aria-label="Opportunity radar"
      data-testid="dashboard-v3-opportunity-radar"
    >
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Opportunity Radar</span>
        <p className="tosv3-type-muted">Readiness → · Risk ↓ · Size = priority</p>
      </div>

      <ul className="tosv3-radar-legend" aria-label="Radar legend">
        <li>
          <i className="tosv3-radar-legend__swatch tosv3-radar-legend__swatch--execute" />
          Actionable
        </li>
        <li>
          <i className="tosv3-radar-legend__swatch tosv3-radar-legend__swatch--watch" />
          Near-miss
        </li>
        <li>
          <i className="tosv3-radar-legend__swatch tosv3-radar-legend__swatch--avoid" />
          Blocked samples
        </li>
      </ul>

      <div
        className={`tosv3-radar-map ${radar.mapDots.length === 0 ? "tosv3-radar-map--empty" : ""}`}
        role="application"
        aria-label="Readiness versus risk radar"
      >
        <div className="tosv3-radar-map__zones" aria-hidden>
          <span className="tosv3-radar-zone tosv3-radar-zone--execute">Execute</span>
          <span className="tosv3-radar-zone tosv3-radar-zone--watch">Watch</span>
          <span className="tosv3-radar-zone tosv3-radar-zone--avoid">Avoid</span>
        </div>
        <div className="tosv3-radar-map__rings" aria-hidden />

        {radar.mapDots.map((item) => {
          const pos = radarPosition(item);
          const size = radarDotSize(item);
          const half = size / 2;
          const action = radarActionLabel(item);
          const isPinned = pinnedSymbol === item.symbol;
          const isHovered = hoveredSymbol === item.symbol;
          const isActive = isPinned || isHovered;
          return (
            <button
              key={item.symbol}
              type="button"
              className={`tosv3-radar-dot ${radarStatusClass(item.status)} ${isActive ? "is-active" : ""}`}
              style={{
                left: pos.left,
                top: pos.top,
                width: size,
                height: size,
                margin: `${-half}px 0 0 ${-half}px`,
              }}
              aria-label={`${item.symbol}: ${action}, readiness ${item.readiness}, risk ${item.risk}`}
              aria-pressed={isPinned}
              aria-describedby={detail?.symbol === item.symbol ? `tosv3-radar-detail-${item.symbol}` : undefined}
              onClick={() =>
                setPinnedSymbol((current) => (current === item.symbol ? null : item.symbol))
              }
              onMouseEnter={() => {
                if (prefersHoverDetail()) setHoveredSymbol(item.symbol);
              }}
              onMouseLeave={() => {
                if (prefersHoverDetail()) clearHoverUnlessPinned(item.symbol);
              }}
              onFocus={() => setHoveredSymbol(item.symbol)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  clearHoverUnlessPinned(item.symbol);
                }
              }}
            >
              <span className="tosv3-radar-dot__symbol">{item.symbol}</span>
              <span className="tosv3-radar-dot__action">{action}</span>
            </button>
          );
        })}

        {radar.avoidPlaceholders.map((placeholder, index) => {
          const pos = AVOID_PLACEHOLDER_POSITIONS[index] ?? AVOID_PLACEHOLDER_POSITIONS[0];
          return (
            <div
              key={`avoid-${placeholder.symbol}`}
              className="tosv3-radar-dot tosv3-radar__cell--rejected tosv3-radar-dot--placeholder"
              style={{
                left: pos.left,
                top: pos.top,
                width: 44,
                height: 44,
                margin: "-22px 0 0 -22px",
              }}
              title={placeholder.caption}
            >
              <span className="tosv3-radar-dot__symbol">{placeholder.symbol}</span>
              <span className="tosv3-radar-dot__action">AVOID</span>
            </div>
          );
        })}

        <span className="tosv3-radar-map__axis tosv3-radar-map__axis--x">Readiness →</span>
        <span className="tosv3-radar-map__axis tosv3-radar-map__axis--y">Risk ↓</span>

        {radar.mapDots.length === 0 ? (
          <p className="tosv3-radar-map__empty-copy tosv3-empty-state">
            No qualified or near-miss symbols in the latest scan.
          </p>
        ) : null}
      </div>

      {detail ? (
        <RadarDetailCard
          detail={detail}
          pinned={pinnedSymbol === detail.symbol}
          onDismissPin={() => {
            setPinnedSymbol(null);
            setHoveredSymbol(null);
          }}
        />
      ) : null}

      <div className="tosv3-radar-bands-wrap">
        <button
          type="button"
          className="tosv3-radar-bands__toggle"
          aria-expanded={bandsOpen}
          onClick={() => setBandsOpen((open) => !open)}
        >
          {bandsOpen ? "Hide band lists" : "Show band lists"}
          <span className="tabular-nums">
            {radar.qualified.length + radar.nearMiss.length + radar.rejected.length} symbols
          </span>
        </button>
        <div className={`tosv3-radar-bands ${bandsOpen ? "is-open" : ""}`}>
        <article className="tosv3-radar-band tosv3-radar-band--execute">
          <header>
            <strong>Actionable</strong>
            <span className="tabular-nums">{radar.qualified.length}</span>
          </header>
          <ul>
            {radar.qualified.length === 0 ? (
              <li className="tosv3-radar-band__empty">None in latest scan</li>
            ) : (
              radar.qualified.map((item) => (
                <li key={item.symbol}>
                  <b>{item.symbol}</b>
                  <em>{truncateForChip(item.reason, 64)}</em>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="tosv3-radar-band tosv3-radar-band--watch">
          <header>
            <strong>Near-Miss</strong>
            <span className="tabular-nums">{radar.nearMiss.length}</span>
          </header>
          <ul>
            {radar.nearMiss.length === 0 ? (
              <li className="tosv3-radar-band__empty">None in latest scan</li>
            ) : (
              radar.nearMiss.map((item) => (
                <li key={item.symbol}>
                  <b>{item.symbol}</b>
                  <em>{truncateForChip(item.reason, 64)}</em>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="tosv3-radar-band tosv3-radar-band--avoid">
          <header>
            <strong>Blocked / Rejected</strong>
            <span className="tabular-nums">{radar.rejected.length}</span>
          </header>
          <ul>
            {radar.rejected.length === 0 ? (
              <li className="tosv3-radar-band__empty">None rejected</li>
            ) : (
              radar.rejected.map((item) => (
                <li key={item.symbol}>
                  <b>{item.symbol}</b>
                  <em>{truncateForChip(item.reason, 64)}</em>
                </li>
              ))
            )}
          </ul>
        </article>
        </div>
      </div>
    </section>
  );
}
