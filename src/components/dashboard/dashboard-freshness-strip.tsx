import Link from "next/link";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { StaleDataWarning } from "@/components/ui/stale-data-warning";

export type DashboardFreshnessStripProps = {
  freshness: MarketFreshnessDto;
};

function formatScanRunLabel(iso: string | null): string {
  if (!iso) return "No scan yet";
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
  } catch {
    return iso;
  }
}

/**
 * Unified market freshness — aligned OK strip or stale warning from P1 DTO.
 * Replaces showing `MarketDataAlignmentBanner` only when misaligned.
 */
export function DashboardFreshnessStrip({ freshness }: DashboardFreshnessStripProps) {
  const hasStale =
    freshness.delayedBackdrop || freshness.staleFlags.length > 0;

  if (hasStale) {
    const detail = [
      freshness.benchmarkDate
        ? `VNINDEX EOD: ${freshness.benchmarkDate}`
        : "VNINDEX EOD: unavailable",
      freshness.equityMaxDate
        ? `Equity max session: ${freshness.equityMaxDate}`
        : "Equity bars: none",
      `Last scan: ${formatScanRunLabel(freshness.scanRunAt)}`,
    ].join(" · ");

    const primaryMessage =
      freshness.staleFlags[0]?.message ??
      "Market benchmark data is stale or incomplete relative to other feeds.";

    return (
      <StaleDataWarning
        title="Market data alignment"
        message={primaryMessage}
        detail={detail}
        data-testid="dashboard-freshness-stale"
      >
        {freshness.staleFlags.length > 1 ? (
          <ul
            className="list-disc space-y-1 pl-4 text-xs leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {freshness.staleFlags.slice(1).map((f) => (
              <li key={f.code}>{f.message}</li>
            ))}
          </ul>
        ) : null}
        <Link href="/setups" className="btn btn-secondary text-xs">
          View setups pipeline
        </Link>
      </StaleDataWarning>
    );
  }

  return (
    <div
      className="dashboard-freshness-ok"
      role="status"
      data-testid="dashboard-freshness-ok"
    >
      <p className="dashboard-freshness-ok__title">Market data aligned</p>
      <p className="dashboard-freshness-ok__detail">
        VNINDEX {freshness.benchmarkDate ?? "—"} · Equity max{" "}
        {freshness.equityMaxDate ?? "—"} · Scan{" "}
        {formatScanRunLabel(freshness.scanRunAt)}
        {freshness.delayedBackdrop === false ? " · Backdrop current" : ""}
      </p>
    </div>
  );
}
