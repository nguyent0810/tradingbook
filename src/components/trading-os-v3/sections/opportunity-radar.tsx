"use client";

import { useState } from "react";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
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

export function OpportunityRadar({ radar }: Props) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(
    radar.mapDots[0]?.symbol ?? null
  );
  const active = radar.mapDots.find((d) => d.symbol === activeSymbol);

  return (
    <section
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

      <div className="tosv3-radar-map" role="application" aria-label="Readiness versus risk radar">
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
          const isActive = activeSymbol === item.symbol;
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
              aria-pressed={isActive}
              onClick={() => setActiveSymbol(item.symbol)}
              onMouseEnter={() => setActiveSymbol(item.symbol)}
              onFocus={() => setActiveSymbol(item.symbol)}
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

        {active ? (
          <div className="tosv3-radar-tooltip" role="status" aria-live="polite">
            <div className="tosv3-radar-tooltip__head">
              <strong>{active.symbol}</strong>
              <span>{radarActionLabel(active)}</span>
            </div>
            <p>{active.reason}</p>
            <div className="tosv3-radar-tooltip__meta">
              <span className="tabular-nums">
                Readiness {active.readiness} · {readinessLabel(active.readiness)}
              </span>
              <span className="tabular-nums">
                Risk {active.risk} · {riskLabel(active.risk)}
              </span>
            </div>
            <svg
              viewBox="0 0 120 24"
              className="tosv3-radar-tooltip__trace"
              role="img"
              aria-label="Signal trace from current radar state"
            >
              {signalTrace(active).map((candle, index) => {
                const x = 12 + index * 24;
                const bodyTop = 24 - candle;
                const wickTop = Math.max(2, bodyTop - 5);
                const wickBottom = Math.min(22, bodyTop + 8);
                const hue =
                  active.status === "qualified"
                    ? "rgba(95, 223, 184, 0.92)"
                    : "rgba(251, 191, 36, 0.92)";
                return (
                  <g key={`${active.symbol}-trace-${index}`}>
                    <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={hue} strokeWidth="1.5" />
                    <rect x={x - 3} y={bodyTop} width="6" height="7" rx="1.5" fill={hue} />
                  </g>
                );
              })}
            </svg>
          </div>
        ) : null}
      </div>

      {active ? (
        <p className="tosv3-radar-focus tabular-nums">
          <strong>{active.symbol}</strong> · {radarActionLabel(active)} · {active.reason}
        </p>
      ) : null}

      <div className="tosv3-radar-bands">
        <article className="tosv3-radar-band tosv3-radar-band--execute">
          <header>
            <strong>Actionable</strong>
            <span className="tabular-nums">{radar.qualified.length}</span>
          </header>
          <ul>
            {radar.qualified.map((item) => (
              <li key={item.symbol}>
                <b>{item.symbol}</b>
                <em>{item.reason}</em>
              </li>
            ))}
          </ul>
        </article>
        <article className="tosv3-radar-band tosv3-radar-band--watch">
          <header>
            <strong>Near-Miss</strong>
            <span className="tabular-nums">{radar.nearMiss.length}</span>
          </header>
          <ul>
            {radar.nearMiss.map((item) => (
              <li key={item.symbol}>
                <b>{item.symbol}</b>
                <em>{item.reason}</em>
              </li>
            ))}
          </ul>
        </article>
        <article className="tosv3-radar-band tosv3-radar-band--avoid">
          <header>
            <strong>Blocked / Rejected</strong>
            <span className="tabular-nums">{radar.rejected.length}</span>
          </header>
          <ul>
            {radar.rejected.map((item) => (
              <li key={item.symbol}>
                <b>{item.symbol}</b>
                <em>{item.reason}</em>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
