import type { InsightCopy } from "@/lib/scanner/setups-trader-copy";

export type SetupsInsightBlockProps = {
  insight: InsightCopy;
  runAtLabel: string;
  gate1Label: string;
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
  gate1Label,
  status,
  tradabilityPassed,
  tradabilityTotal,
  filteredOut,
  candidateCountA,
  candidateCountB,
  candidateCountSurfaced,
  errorSummary,
}: SetupsInsightBlockProps) {
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
          Status <span className="font-medium">{status}</span>
          {" · "}
          Gate 1{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {gate1Label}
          </span>
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
          Tradability{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {tradabilityPassed}/{tradabilityTotal}
          </span>{" "}
          passed
          {filteredOut > 0 ? (
            <>
              {" "}
              (<span className="font-medium">{filteredOut}</span> filtered pre–Gate 2)
            </>
          ) : null}
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
          Gate 2 tiers — A / B / surfaced:{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {candidateCountA} / {candidateCountB} / {candidateCountSurfaced}
          </span>
        </div>
      </div>
    </section>
  );
}
