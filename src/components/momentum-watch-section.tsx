import { prisma } from "@/lib/prisma";
import {
  getMomentumWatchRowsForPhase1,
  MOMENTUM_WATCH_UI_DISCLAIMER,
} from "@/lib/scanner/momentum-watch";

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
  const rows = await getMomentumWatchRowsForPhase1(prisma, {
    limit: 20,
    includeExtendedWatchOnly: true,
    includeFailedRisk: false,
  });

  return (
    <section className="space-y-3 rounded-lg border border-dashed p-4 md:p-5" id="momentum-watch" style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}>
      <div>
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Momentum Watch
        </h2>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          Có lực / theo dõi
        </p>
        <p
          className="mt-1 rounded-md border px-3 py-2 text-sm leading-snug"
          style={{
            borderColor: "var(--border-primary)",
            color: "var(--text-secondary)",
            background: "var(--bg-secondary)",
          }}
          role="note"
        >
          {MOMENTUM_WATCH_UI_DISCLAIMER}. Not validated core setups — observational context only.
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-md border border-dashed px-4 py-5 text-sm"
          style={{ color: "var(--text-secondary)", borderColor: "var(--border-primary)" }}
        >
          No momentum watch names today.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border p-0" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
          <div className="table-container">
            <table className="table min-w-[760px]">
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
                    <td className="text-xs">{row.universeSource}</td>
                    <td className="text-xs whitespace-nowrap">{row.group}</td>
                    <td
                      className="max-w-[200px] text-xs leading-snug"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.labels.join(", ") || "—"}
                    </td>
                    <td className="max-w-[180px] text-xs leading-snug">
                      {row.riskAnnotations.length === 0 ? (
                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {row.riskAnnotations.map((r) => (
                            <li key={r} className={riskEmphasisClass(r)}>
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="table-num text-sm">{row.latestClose.toFixed(2)}</td>
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
    </section>
  );
}
