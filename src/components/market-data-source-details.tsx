import type { MarketDataAlignmentAnalysis } from "@/lib/market/market-data-alignment";

type MarketDataSourceDetailsProps = {
  analysis: MarketDataAlignmentAnalysis;
};

/** Collapsed operator diagnostics — dates only, no raw payloads. */
export function MarketDataSourceDetails({ analysis }: MarketDataSourceDetailsProps) {
  return (
    <details className="mt-2 text-left">
      <summary
        className="cursor-pointer text-xs font-medium tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Data source dates (UTC)
      </summary>
      <dl
        className="mt-2 grid grid-cols-1 gap-1 font-mono text-[11px] leading-snug sm:grid-cols-2"
        style={{ color: "var(--text-muted)" }}
      >
        <div>
          <dt className="inline text-[var(--text-tertiary)]">VNINDEX EOD:</dt>{" "}
          <dd className="inline">{analysis.benchmarkDay ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-[var(--text-tertiary)]">Equity bars max:</dt>{" "}
          <dd className="inline">{analysis.equityDay ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-[var(--text-tertiary)]">Scan runtime day:</dt>{" "}
          <dd className="inline">{analysis.scanRunDay ?? "—"}</dd>
        </div>
      </dl>
    </details>
  );
}
