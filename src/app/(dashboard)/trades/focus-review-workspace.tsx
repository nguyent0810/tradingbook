import Link from "next/link";
import type { CSSProperties } from "react";
import {
  formatVND,
  formatEquityThousandVndPerShare,
  formatBarDataDateUtcLong,
} from "@/lib/formatters";
import type { OpenPositionReviewDto } from "@/lib/trades/open-position-intelligence";
import {
  reviewPriorityTraderLabel,
  type ReviewPriorityTier,
} from "@/lib/trades/review-priority-queue";
import type { LatestCloseBar } from "@/lib/trades/unrealized-from-close";

function postureBadgeStyle(postureLabel: string): CSSProperties {
  const p = postureLabel.toLowerCase();
  if (p.includes("high attention")) {
    return {
      borderColor: "color-mix(in srgb, #ea580c 35%, var(--border-color))",
      backgroundColor: "color-mix(in srgb, #ea580c 8%, transparent)",
      color: "#9a3412",
    };
  }
  if (p.includes("defensive")) {
    return {
      borderColor: "color-mix(in srgb, #a855f7 32%, var(--border-color))",
      backgroundColor: "color-mix(in srgb, #a855f7 7%, transparent)",
      color: "var(--text-secondary)",
    };
  }
  if (p.includes("cautious")) {
    return {
      borderColor: "color-mix(in srgb, #ca8a04 32%, var(--border-color))",
      backgroundColor: "color-mix(in srgb, #eab308 7%, transparent)",
      color: "#854d0e",
    };
  }
  return {
    borderColor: "var(--border-color)",
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-muted)",
  };
}

function tierBadgeStyle(tier: ReviewPriorityTier): CSSProperties {
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

export type FocusReviewWorkspaceProps = {
  tradeId: string;
  symbol: string;
  priorityTier: ReviewPriorityTier;
  reviewDto: OpenPositionReviewDto;
  reviewedToday: boolean;
  continuityLines: readonly string[];
  memoryLines: readonly string[];
  escalationCues: readonly string[];
  latestBar: LatestCloseBar | null;
  queuePositionOneBased: number;
  queueLength: number;
  reviewedTodayOpenCount: number;
  pendingCheckpointGlobal: number;
  totalActiveOpen: number;
  operatingPostureLabel: string;
  postureExplainLines: readonly string[];
  latestOutcomeLabel: string | null;
  sessionPendingAheadInQueue: number;
  sessionQuietLines: readonly string[];
  /** Same-visit evolution label — text only, no extra badges. */
  evolutionStateLabel: string;
  evolutionExplainLine: string | null;
};

export function FocusReviewWorkspace({
  tradeId,
  symbol,
  priorityTier,
  reviewDto,
  reviewedToday,
  continuityLines,
  memoryLines,
  escalationCues,
  latestBar,
  queuePositionOneBased,
  queueLength,
  reviewedTodayOpenCount,
  pendingCheckpointGlobal,
  totalActiveOpen,
  operatingPostureLabel,
  postureExplainLines,
  latestOutcomeLabel,
  sessionPendingAheadInQueue,
  sessionQuietLines,
  evolutionStateLabel,
  evolutionExplainLine,
}: FocusReviewWorkspaceProps) {
  const meaningfulChange =
    reviewDto.sinceReviewDeltaLine ?? reviewDto.sessionDeltaLine;
  const riskSnippet =
    reviewDto.plannedCapitalAtRisk != null
      ? formatVND(reviewDto.plannedCapitalAtRisk, false)
      : null;

  const progressRatio =
    totalActiveOpen > 0 ? reviewedTodayOpenCount / totalActiveOpen : 0;

  const memorySlice = memoryLines.slice(0, 4);

  return (
    <section
      className="ledger-deck-focus-review pipeline-deck-panel ledger-deck-panel"
      data-testid="focus-review-workspace"
      role="region"
      aria-labelledby="focus-review-workspace-title"
      aria-label={`Operational review for ${symbol}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Focus review
          </p>
          <h2
            id="focus-review-workspace-title"
            className="mt-1 font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="mono text-lg">{symbol}</span>
            <span
              className="ml-2 inline-block align-middle text-[11px] font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              Position {queuePositionOneBased} of {queueLength} in session queue
            </span>
          </h2>
        </div>
        <Link
          href={`/trades/${tradeId}`}
          className="btn btn-secondary btn-sm shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--accent-text)" }}
        >
          Trade sheet
        </Link>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-2 text-[12px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <span
          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={tierBadgeStyle(priorityTier)}
        >
          {reviewPriorityTraderLabel(priorityTier)}
        </span>
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {reviewDto.primaryReviewLabel}
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden>
          ·
        </span>
        <span>
          {reviewedTodayOpenCount} of {totalActiveOpen} open reviewed today
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden>
          ·
        </span>
        <span>{pendingCheckpointGlobal} checkpoints still pending</span>
      </div>

      <div
        className="mt-2 h-1 max-w-md overflow-hidden rounded-full"
        style={{ background: "var(--bg-tertiary)" }}
        role="img"
        aria-label={`Today's review progress about ${Math.round(progressRatio * 100)} percent`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{
            width: `${Math.min(100, Math.round(progressRatio * 100))}%`,
            backgroundColor:
              "color-mix(in srgb, #64748b 55%, var(--border-color))",
          }}
        />
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-[12px]"
        style={{ borderColor: "var(--border-color)" }}
      >
        <span
          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={postureBadgeStyle(operatingPostureLabel)}
        >
          Posture · {operatingPostureLabel}
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden>
          ·
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          Outcome:{" "}
          <span style={{ color: "var(--text-primary)" }}>
            {latestOutcomeLabel ?? "—"}
          </span>
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden>
          ·
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          Today&apos;s checkpoint:{" "}
          <span style={{ color: reviewedToday ? "#166534" : "var(--text-primary)" }}>
            {reviewedToday ? "Complete" : "Pending"}
          </span>
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden>
          ·
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {sessionPendingAheadInQueue} ahead in this session queue
        </span>
      </div>
      <div
        className="mt-2 text-[11px] leading-snug"
        style={{ color: "var(--text-muted)" }}
        data-testid="focus-review-evolution"
      >
        <span style={{ color: "var(--text-tertiary)" }}>Evolution · </span>
        {evolutionStateLabel}
        {evolutionExplainLine ? (
          <div className="mt-0.5 text-[10px] leading-snug">{evolutionExplainLine}</div>
        ) : null}
      </div>
      {postureExplainLines.length > 0 ? (
        <p
          className="mt-2 text-[11px] leading-snug"
          style={{ color: "var(--text-muted)" }}
          data-testid="focus-review-posture-explain"
        >
          {postureExplainLines.join(" ")}
        </p>
      ) : null}
      {sessionQuietLines.length > 0 ? (
        <ul
          className="mt-2 list-none space-y-0.5 text-[11px] leading-snug"
          style={{ color: "var(--text-muted)" }}
          data-testid="focus-review-session-quiet"
        >
          {sessionQuietLines.map((line, i) => (
            <li key={`ws-quiet-${i}`}>{line}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Stop / risk
            </h3>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-primary)" }}>
              <span className="font-semibold">{reviewDto.stopBandLabel}</span>
              {reviewDto.cushionPctDisplay ? (
                <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  · {reviewDto.cushionPctDisplay}
                </span>
              ) : null}
              {riskSnippet ? (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  · Planned capital at risk{" "}
                  <span className="mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {riskSnippet}
                  </span>
                </span>
              ) : null}
            </p>
          </div>

          <div>
            <h3
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Latest meaningful change
            </h3>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              {meaningfulChange ?? "No session or vs-checkpoint move to report on latest bar."}
            </p>
            {latestBar ? (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Latest close: {formatEquityThousandVndPerShare(latestBar.close)} · Data date:{" "}
                {formatBarDataDateUtcLong(latestBar.date)}
              </p>
            ) : null}
          </div>

          <div>
            <h3
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Review focus hints
            </h3>
            {reviewDto.focusHints.length > 0 ? (
              <ul
                className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {reviewDto.focusHints.map((h, i) => (
                  <li key={`hint-${i}`}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                No extra scan hints for this bar.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Continuity
            </h3>
            {continuityLines.length > 0 ? (
              <ul
                className="mt-1 list-none space-y-1 text-[12px] leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {continuityLines.map((line, i) => (
                  <li key={`cont-${i}`}>— {line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                Continuity unavailable.
              </p>
            )}
          </div>

          <div>
            <h3
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Checklist (last checkpoint)
            </h3>
            <p
              className="mt-1 text-[12px] leading-snug"
              style={{
                color: reviewedToday ? "#166534" : "var(--text-secondary)",
                fontWeight: reviewedToday ? 600 : 400,
              }}
            >
              {reviewedToday ? "Handled today." : "Checkpoint pending today."}
            </p>
            {reviewDto.checklistSummaryLine ? (
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                {reviewDto.checklistSummaryLine}
              </p>
            ) : null}
            {reviewDto.latestChecklist ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {reviewDto.latestChecklist.stopReviewed ? (
                  <span
                    className="rounded border px-1.5 py-0.5 text-[10px]"
                    style={{
                      borderColor: "var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Stop
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
                    Structure
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
                    Sizing
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
                    Exit plan
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                No checklist items were saved on the last log.
              </p>
            )}
          </div>

          {escalationCues.length > 0 ? (
            <div>
              <h3
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Escalation cues
              </h3>
              <ul
                className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {escalationCues.map((c, i) => (
                  <li key={`esc-${i}`}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {memorySlice.length > 0 ? (
            <div>
              <h3
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Recent review context
              </h3>
              <ul
                className="mt-1 list-none space-y-0.5 text-[11px] leading-snug"
                style={{ color: "var(--text-muted)" }}
              >
                {memorySlice.map((m, i) => (
                  <li key={`mem-${i}`}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
