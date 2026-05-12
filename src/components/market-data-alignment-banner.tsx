import type { MarketDataAlignmentAnalysis } from "@/lib/market/market-data-alignment";
import { MarketDataSourceDetails } from "@/components/market-data-source-details";

type MarketDataAlignmentBannerProps = {
  analysis: MarketDataAlignmentAnalysis;
  /** When true, prepend copy that open-position marks use the benchmark session. */
  mentionOpenPositionMarks?: boolean;
};

/**
 * Calm, explicit banner when VNINDEX / equity / scan timestamps are misaligned.
 */
export function MarketDataAlignmentBanner({
  analysis,
  mentionOpenPositionMarks = false,
}: MarketDataAlignmentBannerProps) {
  if (!analysis.showBanner) return null;

  const lines: string[] = [];
  lines.push("Market benchmark data is stale or incomplete relative to other feeds.");

  if (analysis.benchmarkDay) {
    lines.push(`VNINDEX latest EOD: ${analysis.benchmarkDay}`);
  } else {
    lines.push("VNINDEX latest EOD: (not available — import index daily bars)");
  }

  if (analysis.equityDay) {
    lines.push(`Latest stock bar session (DB max): ${analysis.equityDay}`);
  } else {
    lines.push("Latest stock bar session: (no equity bars in database)");
  }

  if (analysis.scanRunDay) {
    lines.push(`Last scan completed (runtime date, UTC): ${analysis.scanRunDay}`);
  }

  lines.push("Scans may be using a delayed market backdrop until VNINDEX is refreshed.");

  if (mentionOpenPositionMarks) {
    lines.push(
      "Open-position freshness compares your symbol’s latest bar to the VNINDEX session date."
    );
  }

  return (
    <div
      role="status"
      className="card mt-4 border px-4 py-3"
      data-testid="market-data-alignment-banner"
      style={{
        borderColor: "color-mix(in srgb, #64748b 40%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #64748b 10%, var(--bg-secondary))",
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Market data alignment
      </p>
      <ul
        className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <MarketDataSourceDetails analysis={analysis} />
    </div>
  );
}
