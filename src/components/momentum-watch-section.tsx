import { prisma } from "@/lib/prisma";
import {
  getMomentumWatchRowsForPhase1,
  MOMENTUM_WATCH_UI_DISCLAIMER,
} from "@/lib/scanner/momentum-watch";
import {
  displayMomentumAuditGroup,
  displayMomentumLabel,
  displayMomentumRiskAnnotation,
  displayUniverseSource,
} from "@/lib/trading-display-labels";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { PriceWithUnit } from "@/components/ui/price-with-unit";

function fmtRatio(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function riskEmphasisClass(code: string): string {
  if (code === "STOP_FAR" || code === "EXTENDED") {
    return "font-semibold text-amber-700 dark:text-amber-400";
  }
  return "";
}

export async function MomentumWatchSection() {
  let rows: Awaited<ReturnType<typeof getMomentumWatchRowsForPhase1>> = [];
  let dbError: unknown = null;
  try {
    rows = await getMomentumWatchRowsForPhase1(prisma, {
      limit: 8,
      includeExtendedWatchOnly: true,
      includeFailedRisk: false,
    });
  } catch (e) {
    dbError = e;
    console.error("[momentum-watch] failed to load rows:", e);
    rows = [];
  }

  return (
    <div className="dash-momentum dash-v2-momentum-inner" id="momentum-watch">
      <header className="dash-v2-card__header">
        <h3 className="dash-v2-card__title">Momentum Watch</h3>
        <p className="dash-v2-card__lead">
          {MOMENTUM_WATCH_UI_DISCLAIMER}. Observational only — not a validated Best Setup.
        </p>
      </header>

      {rows.length === 0 && dbError ? (
        <ErrorStateWithEvidence
          title="Momentum watch unavailable"
          message="Momentum watch temporarily unavailable."
          evidence={
            dbError instanceof Error
              ? dbError.message
              : "src/components/momentum-watch-section.tsx · getMomentumWatchRowsForPhase1"
          }
          data-testid="momentum-watch-db-error"
        />
      ) : rows.length === 0 ? (
        <EmptyStateWithReason
          title="No momentum watch names"
          reason="No momentum watch names today."
          data-testid="momentum-watch-empty"
        />
      ) : (
        <div className="overflow-hidden rounded-md border p-0" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
          <div className="table-container">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Source</th>
                  <th>Group</th>
                  <th>Labels</th>
                  <th>Risks</th>
                  <th className="table-num">Close</th>
                  <th className="table-num">Vol / 20D avg</th>
                  <th className="table-num">Ext %</th>
                  <th aria-label="Context link">Context</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} id={`watch-${row.symbol}`} className="align-top">
                    <td className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.symbol}
                    </td>
                    <td className="text-xs">{displayUniverseSource(row.universeSource)}</td>
                    <td className="text-xs whitespace-nowrap">{displayMomentumAuditGroup(row.group)}</td>
                    <td
                      className="max-w-[200px] text-xs leading-snug"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.labels.map(displayMomentumLabel).join(", ") || "—"}
                    </td>
                    <td className="max-w-[180px] text-xs leading-snug">
                      {row.riskAnnotations.length === 0 ? (
                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {row.riskAnnotations.map((r) => (
                            <li key={r} className={riskEmphasisClass(r)}>
                              {displayMomentumRiskAnnotation(r)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="table-num text-sm">
                      <PriceWithUnit value={row.latestClose} />
                    </td>
                    <td className="table-num text-sm">{fmtRatio(row.volumeRatio20)}</td>
                    <td className="table-num text-sm">{fmtPct(row.breakoutExtensionPct)}</td>
                    <td>
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-[var(--accent-text)] hover:underline">
                          View details
                        </summary>
                        <p className="mt-2 max-w-md leading-snug" style={{ color: "var(--text-secondary)" }}>
                          {row.whyNotCoreSetup}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                          Bar date: {row.latestBarDate}
                        </p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
