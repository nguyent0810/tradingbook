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

function rs20Metric(card: V3RsWatchlistCard): string | null {
  return card.metrics.find((m) => m.label === "RS20")?.value ?? null;
}

function RsDetailPanel({
  card,
  evidenceOpen,
  onToggleEvidence,
}: {
  card: V3RsWatchlistCard;
  evidenceOpen: boolean;
  onToggleEvidence: () => void;
}) {
  return (
    <div
      className="tosv3-rs-detail"
      role="tabpanel"
      id={`tosv3-rs-detail-${card.symbol}`}
      aria-labelledby={`tosv3-rs-tab-${card.symbol}`}
      data-testid={`dashboard-v3-rs-detail-${card.symbol}`}
    >
      <header className="tosv3-rs-detail__head">
        <div>
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
      <ul className="tosv3-rs-card__metrics" aria-label={`${card.symbol} metrics`}>
        {card.metrics.map((metric) => (
          <li key={`${card.symbol}-${metric.label}`} className={`tosv3-rs-chip ${metricClass(metric.tone)}`}>
            <span className="tosv3-rs-chip__label">{metric.label}</span>
            <span className="tosv3-rs-chip__value tabular-nums">{metric.value}</span>
          </li>
        ))}
      </ul>
      <p className="tosv3-rs-card__next">
        <span className="tosv3-rs-card__next-label">Next</span>
        {card.nextCondition}
      </p>
      <p className="tosv3-rs-card__blocker">{card.blockerLabel}</p>
      {card.technicalEvidence.length > 0 ? (
        <div className="tosv3-rs-card__evidence">
          <button
            type="button"
            className="tosv3-rs-card__evidence-toggle"
            aria-expanded={evidenceOpen}
            onClick={onToggleEvidence}
          >
            {evidenceOpen ? "Hide technical evidence" : "Show technical evidence"}
          </button>
          {evidenceOpen ? (
            <ul
              className="tosv3-rs-card__evidence-list"
              data-testid={`dashboard-v3-rs-evidence-${card.symbol}`}
            >
              {card.technicalEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RelativeStrengthRadar({ panel }: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const activeSymbol =
    selectedSymbol && panel.cards.some((card) => card.symbol === selectedSymbol)
      ? selectedSymbol
      : (panel.cards[0]?.symbol ?? null);

  const selected = panel.cards.find((card) => card.symbol === activeSymbol) ?? null;

  const selectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setEvidenceOpen(false);
  };

  return (
    <section
      className="tosv3-panel tosv3-rs-radar"
      aria-label="Relative strength radar"
      data-testid="dashboard-v3-relative-strength-radar"
    >
      <div className="tosv3-section-head tosv3-section-head--stack">
        <div>
          <span className="tosv3-kicker">{panel.title}</span>
          <p className="tosv3-type-muted">{panel.subtitle}</p>
        </div>
        {panel.cards.length > 0 ? (
          <span className="tosv3-rs-radar__count tabular-nums">{panel.cards.length} leaders</span>
        ) : null}
      </div>
      <p className="tosv3-rs-radar__context">{panel.contextNote}</p>

      {panel.cards.length > 0 && selected ? (
        <div className="tosv3-rs-radar__master-detail">
          <div
            className="tosv3-rs-radar__list"
            role="tablist"
            aria-label="Relative strength leaders"
            data-testid="dashboard-v3-rs-cards"
          >
            {panel.cards.map((card) => {
              const isSelected = selected.symbol === card.symbol;
              const rs20 = rs20Metric(card);
              return (
                <button
                  key={card.symbol}
                  type="button"
                  role="tab"
                  id={`tosv3-rs-tab-${card.symbol}`}
                  aria-selected={isSelected}
                  aria-controls={`tosv3-rs-detail-${card.symbol}`}
                  className={`tosv3-rs-row ${isSelected ? "is-selected" : ""}`}
                  data-testid={`dashboard-v3-rs-card-${card.symbol}`}
                  onClick={() => selectSymbol(card.symbol)}
                >
                  <span className="tosv3-rs-row__symbol">{card.symbol}</span>
                  <span className={`tosv3-rs-row__badge ${stateBadgeClass(card.stateTone)}`}>
                    {card.stateBadge}
                  </span>
                  {rs20 ? (
                    <span className="tosv3-rs-row__rs tabular-nums">{rs20}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <RsDetailPanel
            card={selected}
            evidenceOpen={evidenceOpen}
            onToggleEvidence={() => setEvidenceOpen((open) => !open)}
          />
        </div>
      ) : (
        <p className="tosv3-empty-state" data-testid="dashboard-v3-rs-empty">
          {panel.emptyReason ?? "No relative-strength leaders on watch for this session."}
        </p>
      )}
    </section>
  );
}
