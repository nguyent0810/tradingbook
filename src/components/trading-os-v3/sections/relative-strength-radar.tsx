"use client";

import { useId, useState } from "react";
import type { V3RsWatchlistCard, V3RsWatchlistPanel } from "@/lib/dashboard/dashboard-v3-view-model";
import { truncateForChip } from "@/lib/dashboard/v3-user-copy";

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

function metricValue(card: V3RsWatchlistCard, label: string): string {
  return card.metrics.find((m) => m.label === label)?.value ?? "—";
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
      {card.blockerLabel ? (
        <p className="tosv3-rs-card__blocker">{card.blockerLabel}</p>
      ) : null}
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
  const [contextOpen, setContextOpen] = useState(false);
  const listId = useId();

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
      className="tosv3-panel tosv3-rs-radar tosv3-rs-radar--compact"
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

      {panel.contextNote ? (
        <div className="tosv3-rs-radar__context-wrap">
          <button
            type="button"
            className="tosv3-rs-radar__context-toggle"
            aria-expanded={contextOpen}
            onClick={() => setContextOpen((v) => !v)}
          >
            {contextOpen ? "Hide context" : "Session context"}
          </button>
          {contextOpen ? (
            <p className="tosv3-rs-radar__context">{panel.contextNote}</p>
          ) : null}
        </div>
      ) : null}

      {panel.cards.length > 0 && selected ? (
        <div className="tosv3-rs-radar__master-detail">
          <div className="tosv3-rs-radar__master" id={listId}>
            <table className="tosv3-rs-table" role="tablist" aria-label="Relative strength leaders">
              <thead>
                <tr>
                  <th scope="col">Ticker</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="table-num">
                    RS20
                  </th>
                  <th scope="col" className="table-num">
                    RS50
                  </th>
                  <th scope="col">Blocker</th>
                </tr>
              </thead>
              <tbody data-testid="dashboard-v3-rs-cards">
                {panel.cards.map((card) => {
                  const isSelected = selected.symbol === card.symbol;
                  return (
                    <tr
                      key={card.symbol}
                      role="tab"
                      id={`tosv3-rs-tab-${card.symbol}`}
                      aria-selected={isSelected}
                      aria-controls={`tosv3-rs-detail-${card.symbol}`}
                      tabIndex={isSelected ? 0 : -1}
                      className={`tosv3-rs-table__row ${isSelected ? "is-selected" : ""}`}
                      data-testid={`dashboard-v3-rs-card-${card.symbol}`}
                      onClick={() => selectSymbol(card.symbol)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectSymbol(card.symbol);
                        }
                      }}
                    >
                      <td className="tosv3-rs-table__symbol">{card.symbol}</td>
                      <td>
                        <span className={`tosv3-rs-row__badge ${stateBadgeClass(card.stateTone)}`}>
                          {card.stateBadge}
                        </span>
                      </td>
                      <td className="table-num tosv3-rs-table__metric">{metricValue(card, "RS20")}</td>
                      <td className="table-num tosv3-rs-table__metric">{metricValue(card, "RS50")}</td>
                      <td className="tosv3-rs-table__blocker" title={card.blockerLabel}>
                        {truncateForChip(card.blockerLabel, 28)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="tosv3-rs-radar__detail-sticky">
            <RsDetailPanel
              card={selected}
              evidenceOpen={evidenceOpen}
              onToggleEvidence={() => setEvidenceOpen((open) => !open)}
            />
          </div>
        </div>
      ) : (
        <p className="tosv3-empty-state" data-testid="dashboard-v3-rs-empty">
          {panel.emptyReason ?? "No relative-strength leaders on watch for this session."}
        </p>
      )}
    </section>
  );
}
