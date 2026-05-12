import type { InsightCopy } from "@/lib/scanner/setups-trader-copy";
import { displayDailyScanRunStatus } from "@/lib/trading-display-labels";

export type SetupsInsightBlockProps = {
  insight: InsightCopy;
  runAtLabel: string;
  /** Latest VNINDEX EOD calendar day (UTC) used as benchmark session — not scan wall-clock time. */
  benchmarkSessionDate?: string | null;
  /** Latest calendar day among all `StockDailyBar` rows (UTC) — may differ from VNINDEX session. */
  equityBarsLatestSession?: string | null;
  /** Trader-facing regime label (e.g. Favorable / Caution). */
  gate1DisplayLabel: string;
  status: string;
  tradabilityPassed: number;
  tradabilityTotal: number;
  filteredOut: number;
  candidateCountA: number;
  candidateCountB: number;
  candidateCountSurfaced: number;
  errorSummary?: string | null;
};

export function SetupsInsightBlock({
  insight,
  runAtLabel,
  benchmarkSessionDate,
  equityBarsLatestSession,
  gate1DisplayLabel,
  status,
  tradabilityPassed,
  tradabilityTotal,
  filteredOut,
  candidateCountA,
  candidateCountB,
  candidateCountSurfaced,
  errorSummary,
}: SetupsInsightBlockProps) {
  const statusDisplay = displayDailyScanRunStatus(status);

  return (
    <section className="card p-6 sm:p-7">
      {status === "FAILED" && errorSummary ? (
        <p className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {errorSummary}
        </p>
      ) : null}

      <p className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
        {insight.headline}
      </p>

      {insight.contextLine ? (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {insight.contextLine}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          Insight:{" "}
        </span>
        {insight.explanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <span className="font-medium" style={{ color: "var(--accent-text)" }}>
          Action:{" "}
        </span>
        {insight.action}
      </p>

      <div
        className="mt-6 grid gap-3 border-t pt-5 text-xs sm:grid-cols-2 sm:text-sm"
        style={{ borderColor: "var(--border-primary)" }}
      >
        <div style={{ color: "var(--text-tertiary)" }}>
          Scan completed{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {runAtLabel}
          </span>
          {" · "}
          Run status <span className="font-medium">{statusDisplay}</span>
          {" · "}
          Market backdrop{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {gate1DisplayLabel}
          </span>
          {benchmarkSessionDate ? (
            <>
              <br />
              Benchmark EOD session (VNINDEX):{" "}
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {benchmarkSessionDate}
              </span>
              {" — "}
              <span style={{ color: "var(--text-muted)" }}>
                not the same as &quot;scan completed&quot; wall time
              </span>
            </>
          ) : null}
          {equityBarsLatestSession &&
          (!benchmarkSessionDate ||
            equityBarsLatestSession !== benchmarkSessionDate) ? (
            <>
              <br />
              Equity bars latest session:{" "}
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {equityBarsLatestSession}
              </span>
              {benchmarkSessionDate &&
              equityBarsLatestSession !== benchmarkSessionDate ? (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  (newer than benchmark EOD — refresh VNINDEX import for alignment)
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
          Liquidity &amp; session screen{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {tradabilityPassed}/{tradabilityTotal}
          </span>{" "}
          passed
          {filteredOut > 0 ? (
            <>
              {" "}
              (<span className="font-medium">{filteredOut}</span> removed before setup scoring)
            </>
          ) : null}
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
          Setup quality tiers — A / B / surfaced:{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {candidateCountA} / {candidateCountB} / {candidateCountSurfaced}
          </span>
        </div>
      </div>
    </section>
  );
}
