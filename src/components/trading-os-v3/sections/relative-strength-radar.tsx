"use client";

import { useId, useMemo, useState } from "react";
import type { V3RsWatchlistCard, V3RsWatchlistPanel } from "@/lib/dashboard/dashboard-v3-view-model";
import {
  EARLY_ENTRY_DAILY_CHECKLIST,
  EARLY_ENTRY_FILTER_OPTIONS,
  EARLY_ENTRY_PAPER_COMMANDS,
  EARLY_ENTRY_SORT_OPTIONS,
  filterRsWatchlistCards,
  formatReasonChip,
  hasAnyEarlyEntry,
  isExtendedDoNotChase,
  sortRsWatchlistCards,
  type EarlyEntryFilterId,
  type EarlyEntrySortId,
} from "@/lib/dashboard/early-entry-ui";
import { EARLY_ENTRY_RESEARCH_DISCLAIMER } from "@/lib/scanner/early-entry";
import { truncateForChip } from "@/lib/dashboard/v3-user-copy";
import {
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
} from "@/lib/dashboard/rs-status-display";

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

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatRr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}:1`;
}

function formatSpread(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}pp`;
}

/** Small diverging bar for a table cell — same read as the dashboard RS bar, narrower. */
const RS_MINI_BAR_SCALE_PP = 8;
function RsMiniBar({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="tosv3-rs-mini-cell tabular-nums">—</span>;
  }
  const clamped = Math.max(-RS_MINI_BAR_SCALE_PP, Math.min(RS_MINI_BAR_SCALE_PP, pct));
  const width = (Math.abs(clamped) / RS_MINI_BAR_SCALE_PP) * 50;
  const positive = pct >= 0;
  return (
    <span className="tosv3-rs-mini-cell">
      <span className="tosv3-rs-mini-bar" aria-hidden="true">
        <span className="tosv3-rs-mini-bar__mid" />
        <span
          className={`tosv3-rs-mini-bar__fill ${positive ? "tosv3-rs-mini-bar__fill--pos" : "tosv3-rs-mini-bar__fill--neg"}`}
          style={{ ["--w" as string]: `${width}%` }}
        />
      </span>
      <span className={`tabular-nums ${positive ? "tosv3-rs-mini-cell__num--pos" : "tosv3-rs-mini-cell__num--neg"}`}>
        {formatSpread(pct)}
      </span>
    </span>
  );
}

function earlyStateClass(state: string): string {
  if (isExtendedDoNotChase(state)) return "tosv3-rs-chip--blocker tosv3-rs-chip--extended-warning";
  if (state.includes("Pilot Candidate")) return "tosv3-rs-chip--watch";
  if (state.includes("Add Zone")) return "tosv3-rs-chip--watch";
  if (state.includes("Failed") || state.includes("Blocked")) {
    return "tosv3-rs-chip--blocker";
  }
  return "tosv3-rs-chip--context";
}

function EarlyEntryResearchHeader({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: {
  filter: EarlyEntryFilterId;
  sort: EarlyEntrySortId;
  onFilterChange: (v: EarlyEntryFilterId) => void;
  onSortChange: (v: EarlyEntrySortId) => void;
}) {
  return (
    <div className="tosv3-rs-early-research" data-testid="dashboard-v3-rs-early-research-section">
      <header className="tosv3-rs-early-research__head">
        <h3 className="tosv3-rs-early-research__title">Nghiên cứu vào lệnh sớm</h3>
        <span className="tosv3-rs-early-research__badge">Chỉ mang tính nghiên cứu</span>
      </header>
      <p
        className="tosv3-rs-early-research__disclaimer"
        data-testid="dashboard-v3-rs-early-research-warning"
      >
        {EARLY_ENTRY_RESEARCH_DISCLAIMER}
      </p>
      <div className="tosv3-rs-early-research__controls">
        <label className="tosv3-rs-early-research__control">
          <span>Lọc</span>
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as EarlyEntryFilterId)}
            data-testid="dashboard-v3-rs-early-filter"
          >
            {EARLY_ENTRY_FILTER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="tosv3-rs-early-research__control">
          <span>Sắp xếp</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as EarlyEntrySortId)}
            data-testid="dashboard-v3-rs-early-sort"
          >
            {EARLY_ENTRY_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="tosv3-rs-early-research__checklist" data-testid="dashboard-v3-rs-daily-checklist">
        <summary className="tosv3-rs-early-research__checklist-title">Danh sách kiểm tra nghiên cứu hàng ngày</summary>
        <ul>
          {EARLY_ENTRY_DAILY_CHECKLIST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <p className="tosv3-rs-early-research__paper" data-testid="dashboard-v3-rs-paper-commands">
        <span>Hàng ngày:</span> <code>{EARLY_ENTRY_PAPER_COMMANDS.daily}</code>
        <span className="tosv3-rs-early-research__paper-sep">·</span>
        <span>Hàng tuần:</span> <code>{EARLY_ENTRY_PAPER_COMMANDS.weeklyValidate}</code>
        <span className="tosv3-rs-early-research__paper-sep">·</span>
        <code>{EARLY_ENTRY_PAPER_COMMANDS.weeklySummary}</code>
      </p>
    </div>
  );
}

function EarlyEntryPanel({
  earlyEntry,
}: {
  earlyEntry: NonNullable<V3RsWatchlistCard["earlyEntry"]>;
}) {
  const chips = [
    ...earlyEntry.reasonCodes.slice(0, 8),
    ...earlyEntry.transitionReasonCodes.slice(0, 4),
  ];
  const extended = isExtendedDoNotChase(earlyEntry.proposedTradeState);

  return (
    <div
      className={`tosv3-rs-early-entry ${extended ? "tosv3-rs-early-entry--extended" : ""}`}
      data-testid="dashboard-v3-rs-early-entry"
      aria-label="Dữ liệu chỉ hiển thị — vào lệnh sớm"
    >
      <header className="tosv3-rs-early-entry__head">
        <span className="tosv3-rs-early-entry__label">Nghiên cứu vào lệnh sớm</span>
        <span className={`tosv3-rs-chip ${earlyStateClass(earlyEntry.proposedTradeState)}`}>
          {friendlyEarlyStateLabel(earlyEntry.proposedTradeState)}
        </span>
        {earlyEntry.entryType ? (
          <span className="tosv3-rs-early-entry__entry-type">{earlyEntry.entryType}</span>
        ) : null}
      </header>
      {extended ? (
        <p className="tosv3-rs-early-entry__extended-banner" data-testid="dashboard-v3-rs-extended-warning">
          Cảnh báo Anti-FOMO — Mở rộng quá đà — Không đuổi giá. Không phải tín hiệu mua.
        </p>
      ) : null}
      <p className="tosv3-rs-early-entry__research-warning">
        Không phải khuyến nghị mua · Cần được kiểm chứng thêm
      </p>
      <ul className="tosv3-rs-card__metrics" aria-label="Chỉ số vào lệnh sớm">
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">Điểm</span>
          <span className="tosv3-rs-chip__value tabular-nums">{earlyEntry.earlyReversalScore}</span>
        </li>
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">R:R</span>
          <span className="tosv3-rs-chip__value tabular-nums">{formatRr(earlyEntry.estimatedRiskReward)}</span>
        </li>
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">% Cắt lỗ</span>
          <span className="tosv3-rs-chip__value tabular-nums">{formatPct(earlyEntry.stopDistancePct)}</span>
        </li>
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">% Lợi nhuận</span>
          <span className="tosv3-rs-chip__value tabular-nums">
            {formatPct(earlyEntry.estimatedRewardPct)}
          </span>
        </li>
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">Mục tiêu</span>
          <span className="tosv3-rs-chip__value tabular-nums">{formatPrice(earlyEntry.targetPrice)}</span>
        </li>
        <li className="tosv3-rs-chip tosv3-rs-chip--context">
          <span className="tosv3-rs-chip__label">Vô hiệu</span>
          <span className="tosv3-rs-chip__value tabular-nums">{formatPrice(earlyEntry.invalidLevel)}</span>
        </li>
      </ul>
      {chips.length > 0 ? (
        <ul className="tosv3-rs-early-entry__chips" aria-label="Nhãn lý do vào lệnh sớm">
          {chips.map((code) => (
            <li key={code} className="tosv3-rs-early-entry__chip">
              {truncateForChip(formatReasonChip(code), 28)}
            </li>
          ))}
        </ul>
      ) : null}
      {earlyEntry.targetReason ||
      earlyEntry.invalidLevelReason ||
      earlyEntry.whyNotPilotYet ||
      earlyEntry.rrRejectionReason ? (
        <details className="tosv3-rs-card__why">
          <summary className="tosv3-rs-card__why-toggle">Vì sao</summary>
          {earlyEntry.targetReason || earlyEntry.invalidLevelReason ? (
            <p className="tosv3-rs-early-entry__explain">
              {earlyEntry.targetReason ? (
                <span>
                  <strong>Lý do mục tiêu:</strong> {earlyEntry.targetReason}.
                </span>
              ) : null}{" "}
              {earlyEntry.invalidLevelReason ? (
                <span>
                  <strong>Lý do vô hiệu:</strong> {earlyEntry.invalidLevelReason}.
                </span>
              ) : null}
            </p>
          ) : null}
          {earlyEntry.whyNotPilotYet ? (
            <p className="tosv3-rs-early-entry__why-not" data-testid="dashboard-v3-rs-why-not-pilot">
              <strong>Lý do chưa vào lệnh thử:</strong> {earlyEntry.whyNotPilotYet}
            </p>
          ) : null}
          {earlyEntry.rrRejectionReason ? (
            <p className="tosv3-rs-early-entry__why-not">
              <strong>Từ chối do R:R:</strong> {earlyEntry.rrRejectionReason}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
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
          {friendlySetupStateLabel(card.setupState)}
        </span>
      </header>
      <p className="tosv3-rs-card__insight">{card.primaryInsight}</p>
      <ul className="tosv3-rs-card__metrics" aria-label={`Chỉ số ${card.symbol}`}>
        {card.metrics.map((metric) => (
          <li key={`${card.symbol}-${metric.label}`} className={`tosv3-rs-chip ${metricClass(metric.tone)}`}>
            <span className="tosv3-rs-chip__label">{metric.label}</span>
            <span className="tosv3-rs-chip__value tabular-nums">{metric.value}</span>
          </li>
        ))}
      </ul>
      {card.nextCondition || card.blockerLabel ? (
        <details className="tosv3-rs-card__why">
          <summary className="tosv3-rs-card__why-toggle">Vì sao</summary>
          <p className="tosv3-rs-card__next">
            <span className="tosv3-rs-card__next-label">Tiếp theo</span>
            {card.nextCondition}
          </p>
          {card.blockerLabel ? (
            <p className="tosv3-rs-card__blocker">{card.blockerLabel}</p>
          ) : null}
        </details>
      ) : null}
      {card.earlyEntry ? <EarlyEntryPanel earlyEntry={card.earlyEntry} /> : null}
      {card.technicalEvidence.length > 0 ? (
        <div className="tosv3-rs-card__evidence">
          <button
            type="button"
            className="tosv3-rs-card__evidence-toggle"
            aria-expanded={evidenceOpen}
            onClick={onToggleEvidence}
          >
            {evidenceOpen ? "Ẩn bằng chứng kỹ thuật" : "Hiện bằng chứng kỹ thuật"}
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
  const [filter, setFilter] = useState<EarlyEntryFilterId>("all");
  const [sort, setSort] = useState<EarlyEntrySortId>("score_desc");
  const listId = useId();

  const showEarlyEntry = hasAnyEarlyEntry(panel.cards);

  const visibleCards = useMemo(() => {
    const filtered = showEarlyEntry ? filterRsWatchlistCards(panel.cards, filter) : panel.cards;
    return showEarlyEntry ? sortRsWatchlistCards(filtered, sort) : filtered;
  }, [panel.cards, filter, sort, showEarlyEntry]);

  const activeSymbol =
    selectedSymbol && visibleCards.some((card) => card.symbol === selectedSymbol)
      ? selectedSymbol
      : (visibleCards[0]?.symbol ?? null);

  const selected = visibleCards.find((card) => card.symbol === activeSymbol) ?? null;

  const selectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setEvidenceOpen(false);
  };

  return (
    <section
      className="tosv3-panel tosv3-rs-radar tosv3-rs-radar--compact"
      aria-label="Ra-đa sức mạnh tương đối"
      data-testid="dashboard-v3-relative-strength-radar"
    >
      <div className="tosv3-section-head tosv3-section-head--stack">
        <div>
          <span className="tosv3-kicker">{panel.title}</span>
          <p className="tosv3-type-muted">{panel.subtitle}</p>
        </div>
        {visibleCards.length > 0 ? (
          <span className="tosv3-rs-radar__count tabular-nums">{visibleCards.length} mã dẫn đầu</span>
        ) : null}
      </div>

      {showEarlyEntry ? (
        <EarlyEntryResearchHeader
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
        />
      ) : null}

      {panel.contextNote ? (
        <div className="tosv3-rs-radar__context-wrap">
          <button
            type="button"
            className="tosv3-rs-radar__context-toggle"
            aria-expanded={contextOpen}
            onClick={() => setContextOpen((v) => !v)}
          >
            {contextOpen ? "Ẩn bối cảnh" : "Bối cảnh phiên"}
          </button>
          {contextOpen ? (
            <p className="tosv3-rs-radar__context">{panel.contextNote}</p>
          ) : null}
        </div>
      ) : null}

      {visibleCards.length > 0 && selected ? (
        <div className="tosv3-rs-radar__master-detail">
          <div className="tosv3-rs-radar__master" id={listId}>
            <table className="tosv3-rs-table" role="tablist" aria-label="Danh sách mã dẫn đầu sức mạnh tương đối">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Trạng thái thiết lập</th>
                  <th scope="col" className="table-num">
                    RS20
                  </th>
                  <th scope="col" className="table-num">
                    RS50
                  </th>
                  <th scope="col">Lý do</th>
                  {showEarlyEntry ? (
                    <>
                      <th scope="col">Trạng thái sớm</th>
                      <th scope="col" className="table-num">
                        Điểm
                      </th>
                      <th scope="col" className="table-num">
                        R:R
                      </th>
                      <th scope="col">Loại vào lệnh</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody data-testid="dashboard-v3-rs-cards">
                {visibleCards.map((card) => {
                  const isSelected = selected.symbol === card.symbol;
                  return (
                    <tr
                      key={card.symbol}
                      role="tab"
                      id={`tosv3-rs-tab-${card.symbol}`}
                      aria-selected={isSelected}
                      aria-controls={`tosv3-rs-detail-${card.symbol}`}
                      tabIndex={isSelected ? 0 : -1}
                      className={`tosv3-rs-table__row ${isSelected ? "is-selected" : ""} ${
                        card.earlyEntry && isExtendedDoNotChase(card.earlyEntry.proposedTradeState)
                          ? "tosv3-rs-table__row--extended"
                          : ""
                      }`}
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
                          {friendlySetupStateLabel(card.setupState)}
                        </span>
                      </td>
                      <td className="table-num tosv3-rs-table__metric">
                        <RsMiniBar pct={card.rs20SpreadPct} />
                      </td>
                      <td className="table-num tosv3-rs-table__metric">
                        <RsMiniBar pct={card.rs50SpreadPct} />
                      </td>
                      <td className="tosv3-rs-table__blocker" title={card.setupReason}>
                        {truncateForChip(card.setupReason, 32)}
                      </td>
                      {showEarlyEntry ? (
                        <>
                          <td
                            className="tosv3-rs-table__early"
                            title={card.earlyEntry?.whyNotPilotYet ?? undefined}
                          >
                            {card.earlyEntry ? (
                              <span
                                className={`tosv3-rs-row__badge ${earlyStateClass(card.earlyEntry.proposedTradeState)}`}
                              >
                                {truncateForChip(
                                  friendlyEarlyStateLabel(card.earlyEntry.proposedTradeState),
                                  18
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="table-num tosv3-rs-table__metric">
                            {card.earlyEntry?.earlyReversalScore ?? "—"}
                          </td>
                          <td className="table-num tosv3-rs-table__metric">
                            {formatRr(card.earlyEntry?.estimatedRiskReward)}
                          </td>
                          <td
                            className="tosv3-rs-table__entry-type"
                            title={card.earlyEntry?.entryType ?? undefined}
                          >
                            {card.earlyEntry?.entryType ?? "—"}
                          </td>
                        </>
                      ) : null}
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
          {showEarlyEntry && filter !== "all"
            ? "Không có mã dẫn đầu RS nào khớp với bộ lọc Vào lệnh sớm đã chọn."
            : (panel.emptyReason ?? "Không có mã dẫn đầu sức mạnh tương đối nào được theo dõi trong phiên này.")}
        </p>
      )}
    </section>
  );
}
