import type { CSSProperties } from "react";
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
        color: "#9a3412",
      };
    case "high_attention":
      return {
        borderColor: "color-mix(in srgb, #ca8a04 38%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #eab308 10%, transparent)",
        color: "#854d0e",
      };
    case "routine_review":
      return {
        borderColor: "color-mix(in srgb, #64748b 35%, var(--border-color))",
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-secondary)",
      };
    default:
      return {
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-muted)",
      };
  }
}

function escalationRailStyle(): CSSProperties {
  return {
    borderLeft: "2px solid color-mix(in srgb, #94a3b8 45%, var(--border-color))",
    paddingLeft: "0.5rem",
  };
}

export type OpenPositionReviewCellProps = {
  compact: boolean;
  priorityTier: ReviewPriorityTier;
  escalationCues: readonly string[];
  memoryLines: readonly string[];
  reviewDto: OpenPositionReviewDto;
  reviewedToday: boolean;
  latestBar: LatestCloseBar | null;
  formatBarSessionDate: (d: Date) => string;
};

export function OpenPositionReviewCell({
  compact,
  priorityTier,
  escalationCues,
  memoryLines,
  reviewDto,
  reviewedToday,
  latestBar,
  formatBarSessionDate,
}: OpenPositionReviewCellProps) {
  const meaningfulChange =
    reviewDto.sinceReviewDeltaLine ?? reviewDto.sessionDeltaLine;

  const riskSnippet =
    reviewDto.plannedCapitalAtRisk != null
      ? formatVND(reviewDto.plannedCapitalAtRisk, false)
      : null;

  const stopRiskLine = compact ? (
    <div
      className="text-[10px] leading-snug"
      style={{ color: "var(--text-primary)" }}
    >
      <span className="font-medium">{reviewDto.stopBandLabel}</span>
      {reviewDto.cushionPctDisplay ? (
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {" "}
          · {reviewDto.cushionPctDisplay}
        </span>
      ) : null}
      {riskSnippet ? (
        <span style={{ color: "var(--text-muted)" }}>
          {" "}
          · At risk {riskSnippet}
        </span>
      ) : null}
    </div>
  ) : (
    <div
      className="text-[11px] leading-snug"
      style={{ color: "var(--text-secondary)" }}
    >
      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
        {reviewDto.stopBandLabel}
      </span>
      {reviewDto.cushionPctDisplay ? (
        <>
          {" · "}
          <span className="tabular-nums">{reviewDto.cushionPctDisplay}</span>
        </>
      ) : null}
      {riskSnippet ? (
        <>
          {" · "}
          <span style={{ color: "var(--text-muted)" }}>
            Planned capital at risk{" "}
            <span className="mono font-medium" style={{ color: "var(--text-secondary)" }}>
              {riskSnippet}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );

  const reviewStatusLine = (
    <div
      className={compact ? "text-[10px] leading-snug" : "text-[10px] leading-snug"}
      style={{ color: "var(--text-muted)" }}
    >
      {reviewedToday ? "Checkpoint logged today." : "Checkpoint pending today."}
      <span style={{ color: "var(--text-muted)" }}>
        {" "}
        · {reviewDto.primaryReviewLabel}
      </span>
    </div>
  );

  const hintItems = reviewDto.focusHints;

  const checklistSection =
    reviewDto.latestChecklist != null ? (
      <div className="flex flex-col gap-1">
        {reviewDto.checklistSummaryLine ? (
          <div
            className="text-[10px] tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {reviewDto.checklistSummaryLine}
          </div>
        ) : null}
        {!compact ? (
          <div className="flex flex-wrap gap-1">
            {reviewDto.latestChecklist.stopReviewed ? (
              <span
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Stop reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.structureReviewed ? (
              <span
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Structure reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.sizingReviewed ? (
              <span
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Sizing reviewed
              </span>
            ) : null}
            {reviewDto.latestChecklist.exitPlanReviewed ? (
              <span
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
              >
                Exit plan reviewed
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Checklist on latest checkpoint — expand notes for detail.
          </div>
        )}
      </div>
    ) : null;

  const supportingBlock = (
    <>
      {hintItems.length > 0 ? (
        <ul
          className="list-disc space-y-0.5 pl-3.5 text-[10px] leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          {hintItems.map((h, hi) => (
            <li key={`${hi}-${h.slice(0, 32)}`}>{h}</li>
          ))}
        </ul>
      ) : null}
      {reviewDto.setupValidityLine ? (
        <div className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
          Setup: {reviewDto.setupValidityLine}
        </div>
      ) : null}
      <p
        className="text-[10px] leading-snug line-clamp-4"
        style={{ color: "var(--text-muted)" }}
      >
        {reviewDto.headline}
      </p>
      {checklistSection}
      {latestBar ? (
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Latest bar: {formatBarSessionDate(latestBar.date)}
        </div>
      ) : (
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          No equity bar loaded.
        </div>
      )}
      <p className="text-[9px] leading-snug" style={{ color: "var(--text-muted)" }}>
        Daily bars only — not live execution advice.
      </p>
    </>
  );

  return (
    <div
      className={
        compact
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

      {escalationCues.length > 0 ? (
        <div className="flex flex-col gap-0.5 text-[10px] leading-snug" style={escalationRailStyle()}>
          {escalationCues.map((c, i) => (
            <div key={`${i}-${c.slice(0, 28)}`} style={{ color: "var(--text-secondary)" }}>
              {c}
            </div>
          ))}
        </div>
      ) : null}

      {memoryLines.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {memoryLines.map((line, mi) => (
            <div
              key={`m-${mi}-${line.slice(0, 24)}`}
              className="text-[10px] leading-snug"
              style={{ color: "var(--text-muted)" }}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {stopRiskLine}

      {reviewStatusLine}

      {meaningfulChange ? (
        <div
          className={compact ? "text-[10px] leading-snug" : "text-[10px] leading-snug"}
          style={{ color: "var(--text-secondary)" }}
        >
          {meaningfulChange}
        </div>
      ) : null}

      {!compact &&
      reviewDto.sessionDeltaLine &&
      reviewDto.sinceReviewDeltaLine &&
      reviewDto.sessionDeltaLine.trim() !== reviewDto.sinceReviewDeltaLine.trim() ? (
        <div className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
          {reviewDto.sessionDeltaLine}
        </div>
      ) : null}

      <details className="group">
        <summary
          className="cursor-pointer list-none text-[10px] font-medium underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          Supporting notes
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5" style={{ borderColor: "var(--border-color)" }}>
          {supportingBlock}
        </div>
      </details>
    </div>
  );
}
