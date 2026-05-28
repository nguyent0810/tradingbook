"use client";

import { useState } from "react";
import type { RadarItem } from "../types";
import {
  radarActionLabel,
  radarDotSize,
  radarPosition,
  radarStatusClass,
} from "../v3-radar-utils";

type Props = {
  items: RadarItem[];
};

export function OpportunityRadar({ items }: Props) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(items[0]?.symbol ?? null);
  const qualified = items.filter((item) => item.status === "qualified");
  const nearMiss = items.filter((item) => item.status === "near-miss");
  const rejected = items.filter((item) => item.status === "rejected");
  const active = items.find((item) => item.symbol === activeSymbol);

  return (
    <section className="tosv3-panel tosv3-radar" aria-label="Opportunity radar">
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
          Rejected
        </li>
      </ul>

      <div className="tosv3-radar-map" role="application" aria-label="Readiness versus risk radar">
        <div className="tosv3-radar-map__zones" aria-hidden>
          <span className="tosv3-radar-zone tosv3-radar-zone--execute">Execute</span>
          <span className="tosv3-radar-zone tosv3-radar-zone--watch">Watch</span>
          <span className="tosv3-radar-zone tosv3-radar-zone--avoid">Avoid</span>
        </div>
        <div className="tosv3-radar-map__rings" aria-hidden />
        {items.map((item) => {
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
            >
              <span className="tosv3-radar-dot__symbol">{item.symbol}</span>
              <span className="tosv3-radar-dot__action">{action}</span>
            </button>
          );
        })}
        <span className="tosv3-radar-map__axis tosv3-radar-map__axis--x">Readiness →</span>
        <span className="tosv3-radar-map__axis tosv3-radar-map__axis--y">Risk ↓</span>
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
            <span className="tabular-nums">{qualified.length}</span>
          </header>
          <ul>
            {qualified.map((item) => (
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
            <span className="tabular-nums">{nearMiss.length}</span>
          </header>
          <ul>
            {nearMiss.map((item) => (
              <li key={item.symbol}>
                <b>{item.symbol}</b>
                <em>{item.reason}</em>
              </li>
            ))}
          </ul>
        </article>
        <article className="tosv3-radar-band tosv3-radar-band--avoid">
          <header>
            <strong>Rejected</strong>
            <span className="tabular-nums">{rejected.length}</span>
          </header>
          <ul>
            {rejected.map((item) => (
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
