import type { Gate2ClosestSymbolRow } from "@/lib/scanner/gate2-scan-diagnostics";
import {
  computeClosestExecutionStatus,
  computeDistanceAboveBreakoutFrac,
  computeDistanceToPullbackZoneFrac,
  computeRiskToStopFrac,
  hasExecutableBreakout,
  hasExecutableZone,
  pullbackProximityLabel,
} from "@/lib/scanner/closest-execution-metrics";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import {
  displayNearMissDiagnosticStatus,
  nearMissDiagnosticActionHint,
} from "@/lib/trading-display-labels";

function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct1FromFrac(frac: number): string {
  if (!Number.isFinite(frac)) return "—";
  return `${(frac * 100).toFixed(1)}%`;
}

function executionHeadline(status: ReturnType<typeof computeClosestExecutionStatus>): string {
  switch (status) {
    case "READY":
      return "Price is inside the pullback zone — diagnostic only, not a validated setup.";
    case "INVALID":
      return "Structure is no longer valid for this template.";
    default:
      return "Price is outside the zone — waiting for a pullback.";
  }
}

function zoneDistanceLineWithProximity(
  close: number,
  zoneLow: number,
  zoneHigh: number
): string {
  if (!hasExecutableZone(close, zoneLow, zoneHigh)) {
    return "Entry zone: levels unavailable for this stop";
  }
  const dist = computeDistanceToPullbackZoneFrac(close, zoneLow, zoneHigh);
  const prox = pullbackProximityLabel(dist);
  const suffix = prox ? ` (${prox})` : "";

  if (dist === 0) return `At entry zone${suffix}`;
  if (!Number.isFinite(dist)) return "Entry zone: —";
  if (close > zoneHigh) return `${fmtPct1FromFrac(dist)} above entry zone${suffix}`;
  return `${fmtPct1FromFrac(dist)} below entry zone${suffix}`;
}

function statusStyle(status: ReturnType<typeof computeClosestExecutionStatus>): {
  bg: string;
  fg: string;
  border: string;
} {
  switch (status) {
    case "READY":
      return {
        bg: "var(--bg-secondary)",
        fg: "var(--accent-text)",
        border: "var(--accent-text)",
      };
    case "INVALID":
      return {
        bg: "var(--bg-secondary)",
        fg: "var(--danger)",
        border: "var(--danger)",
      };
    default:
      return {
        bg: "var(--bg-secondary)",
        fg: "var(--text-secondary)",
        border: "var(--border-primary)",
      };
  }
}

export function SetupsClosestSymbolsSection({
  rows,
  rsBySymbol,
}: {
  rows: Gate2ClosestSymbolRow[];
  rsBySymbol?: Map<string, RsDiagnosticUi | null>;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        Closest to qualifying
      </h2>
      <p className="mt-1 text-sm leading-snug" style={{ color: "var(--text-tertiary)" }}>
        Ranked by proximity to a valid entry zone, then scanner quality. Execution context from the
        same Gate 2 evaluation — not recommendations. Expand levels for prices (k ₫).
      </p>

      <ul className="mt-5 space-y-4">
        {rows.map((row) => {
          const status = computeClosestExecutionStatus(
            row.terminalCategory,
            row.close,
            row.pullbackZoneLow,
            row.pullbackZoneHigh
          );
          const riskFrac = computeRiskToStopFrac(row.close, row.stopLevel);
          const pill = statusStyle(status);

          return (
            <li
              key={`${row.symbol}-${row.partialPipelineScore}-${row.stageRank}`}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="mono text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {row.symbol}
                </span>
                <span
                  className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide normal-case"
                  style={{
                    background: pill.bg,
                    color: pill.fg,
                    borderColor: pill.border,
                  }}
                >
                  {displayNearMissDiagnosticStatus(status)}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {row.terminalCode ? (
                  <p className="text-xs font-mono" data-testid="closest-terminal-code">
                    <span style={{ color: "var(--text-tertiary)" }}>Rejection code: </span>
                    {row.terminalCode}
                  </p>
                ) : null}
                {row.terminalReasonPreview ? (
                  <p className="text-xs leading-snug" style={{ color: "var(--text-tertiary)" }}>
                    {row.terminalReasonPreview}
                  </p>
                ) : null}
                <p>
                  <span style={{ color: "var(--text-tertiary)" }}>→ </span>
                  {executionHeadline(status)}
                </p>
                <p>
                  <span style={{ color: "var(--text-tertiary)" }}>→ </span>
                  {zoneDistanceLineWithProximity(row.close, row.pullbackZoneLow, row.pullbackZoneHigh)}
                </p>
                <p>
                  <span style={{ color: "var(--text-tertiary)" }}>→ </span>
                  Risk: {fmtPct1FromFrac(riskFrac)}
                </p>
                <p>
                  <span style={{ color: "var(--text-tertiary)" }}>→ </span>
                  {nearMissDiagnosticActionHint(status)}
                </p>
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
                  <RelativeStrengthDiagnosticPanel
                    diagnostic={rsBySymbol?.get(row.symbol) ?? null}
                    compact
                    testId={`setups-closest-rs-${row.symbol}`}
                  />
                </div>
              </div>

              <details className="details-disclosure mt-3 border-t pt-3 text-xs" style={{ borderColor: "var(--border-primary)" }}>
                <summary className="cursor-pointer font-medium outline-none" style={{ color: "var(--accent-text)" }}>
                  <span className="details-marker-closed mr-1 inline text-[var(--text-tertiary)]" aria-hidden>
                    ▸
                  </span>
                  <span className="details-marker-open mr-1 inline text-[var(--text-tertiary)]" aria-hidden>
                    ▾
                  </span>
                  Price levels (k ₫)
                </summary>
                <dl className="mt-2 grid gap-1 sm:grid-cols-2" style={{ color: "var(--text-tertiary)" }}>
                  <div>
                    <dt className="inline font-medium" style={{ color: "var(--text-secondary)" }}>
                      Close:{" "}
                    </dt>
                    <dd className="inline mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.close > 0 ? fmtThousands(row.close) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium" style={{ color: "var(--text-secondary)" }}>
                      Breakout:{" "}
                    </dt>
                    <dd className="inline mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.breakoutLevel > 0 ? fmtThousands(row.breakoutLevel) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium" style={{ color: "var(--text-secondary)" }}>
                      Zone low–high:{" "}
                    </dt>
                    <dd className="inline mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.pullbackZoneLow > 0 || row.pullbackZoneHigh > 0
                        ? `${fmtThousands(row.pullbackZoneLow)} – ${fmtThousands(row.pullbackZoneHigh)}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium" style={{ color: "var(--text-secondary)" }}>
                      Stop:{" "}
                    </dt>
                    <dd className="inline mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.stopLevel > 0 ? fmtThousands(row.stopLevel) : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium" style={{ color: "var(--text-secondary)" }}>
                      Above breakout (vs level):{" "}
                    </dt>
                    <dd className="inline mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {hasExecutableBreakout(row.breakoutLevel)
                        ? fmtPct1FromFrac(
                            computeDistanceAboveBreakoutFrac(row.close, row.breakoutLevel)
                          )
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
