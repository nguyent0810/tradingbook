"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type ReviewSessionChromeProps = {
  sessionQueueLength: number;
  /** null when queue empty */
  focusOneBased: number | null;
  totalActiveOpen: number;
  /** OPEN positions with a checkpoint logged today (local calendar). */
  reviewedTodayOpenCount: number;
  urgentPendingGlobal: number;
  pendingCheckpointGlobal: number;
  pendingAheadInQueue: number;
  /** Calm session-level notices (e.g. urgent tier cleared for today). */
  sessionQuietLines: readonly string[];
  /** One-line book-level summary for this session (deterministic). */
  sessionOperatingNarrative: string | null;
  prevId: string | null;
  nextId: string | null;
};

function ReviewSessionChromeInner({
  sessionQueueLength,
  focusOneBased,
  totalActiveOpen,
  reviewedTodayOpenCount,
  urgentPendingGlobal,
  pendingCheckpointGlobal,
  pendingAheadInQueue,
  sessionQuietLines,
  sessionOperatingNarrative,
  prevId,
  nextId,
}: ReviewSessionChromeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (tradeId: string | null) => {
      if (!tradeId) return;
      const p = new URLSearchParams(searchParams.toString());
      p.set("reviewSession", "1");
      p.set("reviewFocus", tradeId);
      router.push(`/trades?${p.toString()}`);
    },
    [router, searchParams]
  );

  const exitSession = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("reviewSession");
    p.delete("reviewFocus");
    const qs = p.toString();
    router.push(qs ? `/trades?${qs}` : "/trades");
  }, [router, searchParams]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && prevId) {
        e.preventDefault();
        navigate(prevId);
      }
      if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        navigate(nextId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prevId, nextId]);

  if (sessionQueueLength === 0) {
    return (
      <div
        className="card mt-4 border px-4 py-3"
        data-testid="trades-review-session-bar"
        style={{ borderColor: "var(--border-color)" }}
      >
        {sessionOperatingNarrative ? (
          <p
            className="text-[12px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
            data-testid="trades-review-session-operating-narrative"
          >
            {sessionOperatingNarrative}
          </p>
        ) : null}
        <p
          className={`text-sm ${sessionOperatingNarrative ? "mt-2" : ""}`}
          style={{ color: "var(--text-secondary)" }}
        >
          Review session has no queued positions (only stable open rows remain).
          Exit to browse the full ledger.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm mt-3"
          onClick={exitSession}
        >
          Exit review session
        </button>
      </div>
    );
  }

  return (
    <div
      className="card mt-4 border px-4 py-3"
      data-testid="trades-review-session-bar"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Review session
          </div>
          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {focusOneBased ?? "—"}
            </span>
            <span style={{ color: "var(--text-muted)" }}> / </span>
            <span className="tabular-nums">{sessionQueueLength}</span>
            {" queue · "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {urgentPendingGlobal}
            </span>
            {" urgent · "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {pendingCheckpointGlobal}
            </span>
            {" chk · "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {pendingAheadInQueue}
            </span>
            {" ahead · "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {reviewedTodayOpenCount}
            </span>
            {"/"}
            <span className="tabular-nums">{totalActiveOpen}</span>
            {" reviewed today"}
          </p>
          {sessionQueueLength > 0 ? (
            <div
              className="mt-1.5 h-0.5 max-w-md overflow-hidden rounded-full"
              style={{ background: "var(--bg-tertiary)" }}
              role="img"
              aria-label={`Today's review progress about ${Math.min(
                100,
                Math.round(
                  (totalActiveOpen > 0
                    ? (reviewedTodayOpenCount / totalActiveOpen) * 100
                    : 0)
                )
              )} percent`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (totalActiveOpen > 0
                        ? (reviewedTodayOpenCount / totalActiveOpen) * 100
                        : 0)
                    )
                  )}%`,
                  backgroundColor:
                    "color-mix(in srgb, #64748b 50%, var(--border-color))",
                }}
              />
            </div>
          ) : null}
          {sessionOperatingNarrative ? (
            <p
              className="mt-2 text-[12px] leading-snug"
              style={{ color: "var(--text-secondary)" }}
              data-testid="trades-review-session-operating-narrative"
            >
              {sessionOperatingNarrative}
            </p>
          ) : null}
          {sessionQuietLines.length > 0 ? (
            <ul
              className="mt-2 list-none space-y-0.5 text-[11px] leading-snug"
              style={{ color: "var(--text-muted)" }}
              data-testid="trades-review-session-quiet-lines"
            >
              {sessionQuietLines.map((line, i) => (
                <li key={`quiet-${i}`}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            ← → keys move between positions. No intraday execution prompts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!prevId}
            onClick={() => navigate(prevId)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!nextId}
            onClick={() => navigate(nextId)}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exitSession}
          >
            Exit session
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewSessionChrome(props: ReviewSessionChromeProps) {
  return (
    <Suspense
      fallback={
        <div
          className="card mt-4 border px-4 py-3 skeleton h-24 rounded-lg"
          style={{ borderColor: "var(--border-color)" }}
          data-testid="trades-review-session-bar-fallback"
        />
      }
    >
      <ReviewSessionChromeInner {...props} />
    </Suspense>
  );
}
