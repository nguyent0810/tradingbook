import type { CSSProperties } from "react";
import Link from "next/link";
import type { OpenPositionReviewDto } from "@/lib/trades/open-position-intelligence";
import type { LatestCloseBar } from "@/lib/trades/unrealized-from-close";
import { formatVND } from "@/lib/formatters";
import {
  reviewPriorityTraderLabel,
  type ReviewPriorityTier,
} from "@/lib/trades/review-priority-queue";

function priorityTierBadgeStyle(tier: ReviewPriorityTier): CSSProperties {
  switch (tier) {
    case "urgent":
      return {
        borderColor: "color-mix(in srgb, #ea580c 42%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #ea580c 11%, transparent)",
        color: "#fda4af",
      };
    case "high_attention":
      return {
        borderColor: "color-mix(in srgb, #ca8a04 38%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #eab308 10%, transparent)",
        color: "#fcd34d",
      };
    case "routine_review":
      return {
        borderColor: "color-mix(in srgb, #64748b 35%, var(--border-color))",
        backgroundColor: "rgba(30, 41, 59, 0.55)",
        color: "#b6c8e2",
      };
    default:
      return {
        borderColor: "rgba(102, 128, 159, 0.35)",
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        color: "#9eb0c9",
      };
  }
}

function escalationRailStyle(): CSSProperties {
  return {
    borderLeft: "2px solid color-mix(in srgb, #94a3b8 45%, var(--border-color))",
    paddingLeft: "0.5rem",
  };
}

function checklistChipStyle(): CSSProperties {
  return {
    borderColor: "rgba(102, 128, 159, 0.35)",
    color: "#b6c8e2",
  };
}

export type OpenPositionReviewCellProps = {
  compact: boolean;
  /** Ledger grid: chips only; long copy in disclosure. */
  ledgerDense?: boolean;
  tradeId: string;
  priorityTier: ReviewPriorityTier;
  escalationCues: readonly string[];
  memoryLines: readonly string[];
  reviewDto: OpenPositionReviewDto;
  reviewedToday: boolean;
  latestBar: LatestCloseBar | null;
  formatBarSessionDate: (d: Date) => string;
  sessionMode?: boolean;
  sessionFocused?: boolean;
  operatingPostureLabel: string;
  latestOutcomeLabel: string | null;
  evolutionStateLabel?: string;
  evolutionExplainLine?: string | null;
  compactReviewMode?: boolean;
};

function LedgerReviewChip({
  label,
  title,
  tone = "neutral",
}: {
  label: string;
  title?: string;
  tone?: "neutral" | "warn" | "ok" | "risk";
}) {
  const toneClass =
    tone === "warn"
      ? "tos-ledger-review-chip--warn"
      : tone === "ok"
        ? "tos-ledger-review-chip--ok"
        : tone === "risk"
          ? "tos-ledger-review-chip--risk"
          : "";
  return (
    <span className={`tos-ledger-review-chip ${toneClass}`} title={title}>
      {label}
    </span>
  );
}

export function OpenPositionReviewCell({
  compact,
  ledgerDense = false,
  tradeId,
  priorityTier,
  escalationCues,
  memoryLines,
  reviewDto,
  reviewedToday,
  latestBar,
  formatBarSessionDate,
  sessionMode = false,
  sessionFocused = false,
  operatingPostureLabel,
  latestOutcomeLabel,
  evolutionStateLabel,
  evolutionExplainLine,
  compactReviewMode = false,
}: OpenPositionReviewCellProps) {
  const meaningfulChange =
    reviewDto.sinceReviewDeltaLine ?? reviewDto.sessionDeltaLine;

  const riskSnippet =
    reviewDto.plannedCapitalAtRisk != null
      ? formatVND(reviewDto.plannedCapitalAtRisk, false)
      : null;

  const useDenseLedger = ledgerDense && !sessionFocused;

  if (sessionMode && !sessionFocused) {
    return (
      <div className="tos-ledger-review-cell tos-ledger-review-cell--session">
        <span
          className="tos-ledger-review-chip tos-ledger-review-chip--priority"
          style={priorityTierBadgeStyle(priorityTier)}
        >
          {reviewPriorityTraderLabel(priorityTier)}
        </span>
        <LedgerReviewChip
          label={reviewedToday ? "Handled today" : "Pending today"}
          tone={reviewedToday ? "ok" : "warn"}
        />
        <LedgerReviewChip label={operatingPostureLabel} title={latestOutcomeLabel ?? undefined} />
        {evolutionStateLabel ? (
          <LedgerReviewChip label={`Evolution · ${evolutionStateLabel}`} />
        ) : null}
        <Link href={`/trades/${tradeId}`} className="tos-ledger-review-cell__link">
          Trade sheet
        </Link>
      </div>
    );
  }

  if (useDenseLedger) {
    const stopTone =
      reviewDto.surface === "stop_violated" || reviewDto.stopBand === "breached"
        ? "risk"
        : reviewDto.stopBand === "tight"
          ? "warn"
          : "neutral";

    return (
      <div className="tos-ledger-review-cell" data-testid="trades-review-cell-dense">
        <div className="tos-ledger-review-cell__chips">
          <span
            className="tos-ledger-review-chip tos-ledger-review-chip--priority"
            style={priorityTierBadgeStyle(priorityTier)}
          >
            {reviewPriorityTraderLabel(priorityTier)}
          </span>
          <LedgerReviewChip label={reviewDto.stopBandLabel} tone={stopTone} title={reviewDto.cushionPctDisplay ?? undefined} />
          <LedgerReviewChip
            label={reviewedToday ? "Logged today" : "Review due"}
            tone={reviewedToday ? "ok" : "warn"}
          />
          {evolutionStateLabel ? (
            <LedgerReviewChip label={evolutionStateLabel} title={evolutionExplainLine ?? undefined} />
          ) : null}
          {meaningfulChange ? (
            <LedgerReviewChip label="Δ since review" title={meaningfulChange} tone="warn" />
          ) : null}
        </div>
        <details className="tos-ledger-review-cell__details">
          <summary className="tos-ledger-review-cell__summary">Review detail</summary>
          <div className="tos-ledger-review-cell__detail-body">
            <p className="tos-ledger-review-cell__headline">{reviewDto.headline}</p>
            {reviewDto.primaryReviewLabel ? (
              <p className="tos-ledger-review-cell__meta">{reviewDto.primaryReviewLabel}</p>
            ) : null}
            {riskSnippet ? (
              <p className="tos-ledger-review-cell__meta">At risk {riskSnippet}</p>
            ) : null}
            {escalationCues.length > 0 ? (
              <ul className="tos-ledger-review-cell__list">
                {escalationCues.map((c, i) => (
                  <li key={`e-${i}`}>{c}</li>
                ))}
              </ul>
            ) : null}
            {memoryLines.length > 0 ? (
              <ul className="tos-ledger-review-cell__list">
                {memoryLines.map((line, mi) => (
                  <li key={`m-${mi}`}>{line}</li>
                ))}
              </ul>
            ) : null}
            {reviewDto.setupValidityLine ? (
              <p className="tos-ledger-review-cell__meta">Setup: {reviewDto.setupValidityLine}</p>
            ) : null}
            {latestBar ? (
              <p className="tos-ledger-review-cell__meta">
                Latest bar: {formatBarSessionDate(latestBar.date)}
              </p>
            ) : null}
            <Link href={`/trades/${tradeId}`} className="tos-ledger-review-cell__link">
              Open trade sheet
            </Link>
          </div>
        </details>
      </div>
    );
  }

  const effectiveCompact = compact && !(sessionMode && sessionFocused);

  const stopRiskLine = effectiveCompact ? (
    <div className="text-[10px] leading-snug text-[var(--text-primary)]">
      <span className="font-medium">{reviewDto.stopBandLabel}</span>
      {reviewDto.cushionPctDisplay ? (
        <span className="tabular-nums text-[var(--text-secondary)]">
          {" "}
          · {reviewDto.cushionPctDisplay}
        </span>
      ) : null}
      {riskSnippet ? (
        <span className="text-[var(--text-muted)]">
          {" "}
          · At risk {riskSnippet}
        </span>
      ) : null}
    </div>
  ) : sessionFocused ? (
    <div className="text-[12px] leading-snug text-[var(--text-primary)]">
      <span className="font-semibold">{reviewDto.stopBandLabel}</span>
      {reviewDto.cushionPctDisplay ? (
        <>
          {" · "}
          <span className="tabular-nums text-[var(--text-secondary)]">
            {reviewDto.cushionPctDisplay}
          </span>
        </>
      ) : null}
      {riskSnippet ? (
        <>
          {" · "}
          <span className="text-[var(--text-muted)]">
            Planned capital at risk{" "}
            <span className="mono font-semibold text-[var(--text-secondary)]">{riskSnippet}</span>
          </span>
        </>
      ) : null}
    </div>
  ) : (
    <div className="text-[11px] leading-snug text-[var(--text-secondary)]">
      <span className="font-medium text-[var(--text-primary)]">{reviewDto.stopBandLabel}</span>
      {reviewDto.cushionPctDisplay ? (
        <>
          {" · "}
          <span className="tabular-nums">{reviewDto.cushionPctDisplay}</span>
        </>
      ) : null}
      {riskSnippet ? (
        <>
          {" · "}
          <span className="text-[var(--text-muted)]">
            Planned capital at risk{" "}
            <span className="mono font-medium text-[var(--text-secondary)]">{riskSnippet}</span>
          </span>
        </>
      ) : null}
    </div>
  );

  const reviewStatusLine = (
    <div
      className="text-[10px] leading-snug"
      style={{
        color: reviewedToday ? "#6ee7b7" : "#9eb0c9",
        fontWeight: sessionFocused && reviewedToday ? 600 : 400,
      }}
    >
      {reviewedToday ? "Checkpoint logged today." : "Checkpoint pending today."}
      <span className="text-[var(--text-muted)] font-normal">
        {" "}
        · {reviewDto.primaryReviewLabel}
      </span>
    </div>
  );

  const hintItems = reviewDto.focusHints;

  function renderChecklistBody(includeCompactSummary: boolean) {
    if (reviewDto.latestChecklist == null) return null;
    return (
      <div className="flex flex-col gap-1">
        {reviewDto.checklistSummaryLine ? (
          <div
            className={
              sessionFocused ? "text-[11px] tabular-nums text-[var(--text-muted)]" : "text-[10px] tabular-nums text-[var(--text-muted)]"
            }
          >
            {reviewDto.checklistSummaryLine}
          </div>
        ) : null}
        {!effectiveCompact ? (
          <div className="flex flex-wrap gap-1">
            {reviewDto.latestChecklist.stopReviewed ? (
              <span className="rounded border px-1.5 py-0.5 text-[10px]" style={checklistChipStyle()}>
                Stop reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.structureReviewed ? (
              <span className="rounded border px-1.5 py-0.5 text-[10px]" style={checklistChipStyle()}>
                Structure reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.sizingReviewed ? (
              <span className="rounded border px-1.5 py-0.5 text-[10px]" style={checklistChipStyle()}>
                Sizing reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.exitPlanReviewed ? (
              <span className="rounded border px-1.5 py-0.5 text-[10px]" style={checklistChipStyle()}>
                Exit plan reviewed
              </span>
            ) : null}
          </div>
        ) : includeCompactSummary && reviewDto.checklistSummaryLine ? (
          <div className="text-[10px] text-[var(--text-muted)]">{reviewDto.checklistSummaryLine}</div>
        ) : null}
      </div>
    );
  }

  const checklistSection =
    sessionFocused ? renderChecklistBody(false) : renderChecklistBody(true);

  const supportingBlock = (
    <>
      {hintItems.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-3.5 text-[10px] leading-snug text-[var(--text-muted)]">
          {hintItems.map((h, hi) => (
            <li key={`${hi}-${h.slice(0, 32)}`}>{h}</li>
          ))}
        </ul>
      ) : null}
      {reviewDto.setupValidityLine ? (
        <div className="text-[10px] leading-snug text-[var(--text-muted)]">
          Setup: {reviewDto.setupValidityLine}
        </div>
      ) : null}
      <p
        className={`leading-snug text-[var(--text-muted)] ${sessionFocused ? "line-clamp-2 text-[10px]" : "line-clamp-4 text-[10px]"}`}
      >
        {reviewDto.headline}
      </p>
      {!sessionFocused ? checklistSection : null}
      {latestBar ? (
        <div className="text-[10px] text-[var(--text-muted)]">
          Latest bar: {formatBarSessionDate(latestBar.date)}
        </div>
      ) : (
        <div className="text-[10px] text-[var(--text-muted)]">No equity bar loaded.</div>
      )}
      {!compactReviewMode ? (
        <p className="text-[9px] leading-snug text-[var(--text-muted)]">
          Daily bars only — not live execution advice.
        </p>
      ) : null}
    </>
  );

  if (sessionFocused) {
    return (
      <div
        className="flex max-w-[18rem] flex-col gap-2 border-l-2 pl-2"
        style={{ borderColor: "color-mix(in srgb, #0ea5e9 45%, var(--border-color))" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={priorityTierBadgeStyle(priorityTier)}
          >
            {reviewPriorityTraderLabel(priorityTier)}
          </span>
          <Link
            href={`/trades/${tradeId}`}
            className="text-[11px] font-medium underline-offset-2 hover:underline text-[var(--accent-text)]"
          >
            Log checkpoint
          </Link>
        </div>
        <p className="text-[10px] leading-snug text-[var(--text-muted)]">
          Posture: {operatingPostureLabel}
          {" · "}
          Outcome: {latestOutcomeLabel ?? "—"}
        </p>
        {evolutionStateLabel ? (
          <p className="text-[10px] leading-snug text-[var(--text-muted)]">
            Evolution: {evolutionStateLabel}
            {evolutionExplainLine && !compactReviewMode ? ` — ${evolutionExplainLine}` : ""}
          </p>
        ) : null}

        {stopRiskLine}

        {meaningfulChange ? (
          <div className="text-[11px] leading-snug text-[var(--text-primary)]">{meaningfulChange}</div>
        ) : null}

        {escalationCues.length > 0 ? (
          <div className="flex flex-col gap-0.5 text-[10px] leading-snug" style={escalationRailStyle()}>
            {escalationCues.map((c, i) => (
              <div key={`${i}-${c.slice(0, 28)}`} className="text-[var(--text-secondary)]">
                {c}
              </div>
            ))}
          </div>
        ) : null}

        {checklistSection}

        {reviewStatusLine}

        <details className="group">
          <summary className="tos-ledger-review-cell__summary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Supporting notes
          </summary>
          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-[var(--border-color)] pt-1.5">
            {memoryLines.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {memoryLines.map((line, mi) => (
                  <div key={`m-${mi}-${line.slice(0, 24)}`} className="text-[10px] leading-snug text-[var(--text-muted)]">
                    {line}
                  </div>
                ))}
              </div>
            ) : null}
            {supportingBlock}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div
      className={
        effectiveCompact
          ? "flex max-w-[14rem] flex-col gap-1"
          : "flex max-w-[17rem] flex-col gap-1.5"
      }
    >
      <div className="flex flex-wrap items-center gap-1">
        <span
          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={priorityTierBadgeStyle(priorityTier)}
        >
          {reviewPriorityTraderLabel(priorityTier)}
        </span>
      </div>
      <p className="text-[9px] leading-snug text-[var(--text-muted)]">
        {operatingPostureLabel}
        {latestOutcomeLabel ? ` · ${latestOutcomeLabel}` : ""}
      </p>
      {evolutionStateLabel ? (
        <p className="text-[9px] leading-snug line-clamp-2 text-[var(--text-muted)]">
          Evolution · {evolutionStateLabel}
          {evolutionExplainLine && !compactReviewMode ? ` — ${evolutionExplainLine}` : ""}
        </p>
      ) : null}

      {effectiveCompact ? null : (
        <>
          {escalationCues.length > 0 ? (
            <div className="flex flex-col gap-0.5 text-[10px] leading-snug" style={escalationRailStyle()}>
              {escalationCues.map((c, i) => (
                <div key={`${i}-${c.slice(0, 28)}`} className="text-[var(--text-secondary)]">
                  {c}
                </div>
              ))}
            </div>
          ) : null}
          {memoryLines.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {memoryLines.map((line, mi) => (
                <div key={`m-${mi}-${line.slice(0, 24)}`} className="text-[10px] leading-snug text-[var(--text-muted)]">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {stopRiskLine}

      {reviewStatusLine}

      {meaningfulChange && effectiveCompact ? (
        <LedgerReviewChip label="Δ change" title={meaningfulChange} tone="warn" />
      ) : meaningfulChange ? (
        <div className="text-[10px] leading-snug text-[var(--text-secondary)]">{meaningfulChange}</div>
      ) : null}

      {!effectiveCompact &&
      reviewDto.sessionDeltaLine &&
      reviewDto.sinceReviewDeltaLine &&
      reviewDto.sessionDeltaLine.trim() !== reviewDto.sinceReviewDeltaLine.trim() ? (
        <div className="text-[10px] leading-snug text-[var(--text-muted)]">{reviewDto.sessionDeltaLine}</div>
      ) : null}

      <details className="group">
        <summary className="tos-ledger-review-cell__summary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Supporting notes
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-[var(--border-color)] pt-1.5">
          {supportingBlock}
        </div>
      </details>
    </div>
  );
}
