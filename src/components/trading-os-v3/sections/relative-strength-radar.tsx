"use client";

import { useState } from "react";
import type { V3RsWatchlistCard, V3RsWatchlistPanel } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  panel: V3RsWatchlistPanel;
};

function stateBadgeClass(tone: V3RsWatchlistCard["stateTone"]): string {
  switch (tone) {
    case "supportive":
      return "tosv3-rs-card__badge--supportive";
    case "awaiting":
      return "tosv3-rs-card__badge--awaiting";
    case "not-ready":
      return "tosv3-rs-card__badge--blocked";
    default:
      return "tosv3-rs-card__badge--watch";
  }
}

function metricClass(tone: V3RsWatchlistCard["metrics"][number]["tone"]): string {
  switch (tone) {
    case "strong":
      return "tosv3-rs-chip--strong";
    case "blocker":
      return "tosv3-rs-chip--blocker";
    case "watch":
      return "tosv3-rs-chip--watch";
    default:
      return "tosv3-rs-chip--context";
  }
}

function RsCard({
  card,
  expanded,
  onToggleEvidence,
}: {
  card: V3RsWatchlistCard;
  expanded: boolean;
  onToggleEvidence: () => void;
}) {
  const hasEvidence = card.technicalEvidence.length > 0;

  return (
    <article
      className="tosv3-rs-card"
      data-testid={`dashboard-v3-rs-card-${card.symbol}`}
    >
      <header className="tosv3-rs-card__header">
        <div className="tosv3-rs-card__head-main">
          <strong className="tosv3-rs-card__symbol">{card.symbol}</strong>
          {card.strengthLabel ? (
            <span className="tosv3-rs-card__strength">{card.strengthLabel}</span>
          ) : null}
        </div>
        <span className={`tosv3-rs-card__badge ${stateBadgeClass(card.stateTone)}`}>
          {card.stateBadge}
        </span>
      </header>

      <p className="tosv3-rs-card__insight">{card.primaryInsight}</p>

      <ul className="tosv3-rs-card__metrics" aria-label={`${card.symbol} relative strength metrics`}>
        {card.metrics.map((metric) => (
          <li key={`${card.symbol}-${metric.label}`} className={`tosv3-rs-chip ${metricClass(metric.tone)}`}>
            <span className="tosv3-rs-chip__label">{metric.label}</span>
            <span className="tosv3-rs-chip__value tabular-nums">{metric.value}</span>
          </li>
        ))}
      </ul>

      <footer className="tosv3-rs-card__footer">
        <p className="tosv3-rs-card__next">
          <span className="tosv3-rs-card__next-label">Next</span>
          {card.nextCondition}
        </p>
        <p className="tosv3-rs-card__blocker">{card.blockerLabel}</p>
      </footer>

      {hasEvidence ? (
        <div className="tosv3-rs-card__evidence">
          <button
            type="button"
            className="tosv3-rs-card__evidence-toggle"
            aria-expanded={expanded}
            onClick={onToggleEvidence}
          >
            {expanded ? "Hide technical evidence" : "Show technical evidence"}
          </button>
          {expanded ? (
            <ul className="tosv3-rs-card__evidence-list" data-testid={`dashboard-v3-rs-evidence-${card.symbol}`}>
              {card.technicalEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function RelativeStrengthRadar({ panel }: Props) {
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  const toggleEvidence = (symbol: string) => {
    setExpandedSymbols((current) => {
      const next = new Set(current);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  return (
    <section
      className="tosv3-panel tosv3-rs-radar"
      aria-label="Relative strength radar"
      data-testid="dashboard-v3-relative-strength-radar"
    >
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">{panel.title}</span>
        <p className="tosv3-type-muted">{panel.subtitle}</p>
        <p className="tosv3-rs-radar__context">{panel.contextNote}</p>
      </div>

      {panel.cards.length > 0 ? (
        <div className="tosv3-rs-radar__grid" data-testid="dashboard-v3-rs-cards">
          {panel.cards.map((card) => (
            <RsCard
              key={card.symbol}
              card={card}
              expanded={expandedSymbols.has(card.symbol)}
              onToggleEvidence={() => toggleEvidence(card.symbol)}
            />
          ))}
        </div>
      ) : (
        <p className="tosv3-empty-state" data-testid="dashboard-v3-rs-empty">
          {panel.emptyReason ?? "No relative-strength leaders on watch for this session."}
        </p>
      )}
    </section>
  );
}
