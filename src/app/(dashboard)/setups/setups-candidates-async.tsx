import "server-only";

import { Fragment } from "react";
import Link from "next/link";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import { SetupsCandidatePositionSizing } from "@/components/setups-candidate-position-sizing";
import { ScanQuality } from "@/generated/prisma/client";
import { displayScanQualityTier } from "@/lib/trading-display-labels";
import { toCandidateRows } from "@/lib/scanner/setups-queries";
import {
  loadSetupsBaseData,
  loadSetupPerfRowsCached,
  loadSurfacedCandidatesHealthCached,
} from "./setups-cached-data";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import {
  fmtSetupPerfHint,
  fmtThousands,
  reasonsToStrings,
  type SetupPerfHint,
} from "./setups-shared-helpers";

export async function SetupsCandidatesAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const [{ candidatesWithHealth, healthError }, perfPack] = await Promise.all([
    loadSurfacedCandidatesHealthCached(),
    loadSetupPerfRowsCached(),
  ]);

  const perfBanner = [healthError, perfPack.error].filter(Boolean).join(" ") || null;

  const candidates = toCandidateRows(base.latest);

  const setupPerfMap = new Map<string, SetupPerfHint>();
  for (const r of perfPack.rows) {
    const tradeCount = Number(r.trade_count);
    const winCount = Number(r.win_count);
    const winRatePct = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;
    setupPerfMap.set(`${r.setup_type}:${r.setup_tier_at_entry}`, {
      tradeCount,
      winRatePct,
      avgR: r.avg_r,
    });
  }

  return (
    <>
      {perfBanner ? (
        <ErrorStateWithEvidence
          title="Partial candidate data unavailable"
          message={perfBanner}
          evidence="src/app/(dashboard)/setups/setups-candidates-async.tsx · loadSurfacedCandidatesHealthCached / loadSetupPerfRowsCached"
          data-testid="setups-candidates-partial-data"
        />
      ) : null}

      {candidates.length === 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              Surfaced candidates
            </h2>
            <p className="mt-0.5 text-xs font-medium tracking-wide text-[var(--text-tertiary)]">
              Qualified setups — core scanner Tier A/B only
            </p>
          </div>
          <div className="card p-0">
            <EmptyStateWithReason
              title="No surfaced candidates"
              reason="No Tier A/B candidates surfaced on this run."
              data-testid="setups-candidates-empty"
            />
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              Surfaced candidates ({candidates.length})
            </h2>
            <p className="mt-0.5 text-xs font-medium tracking-wide text-[var(--text-tertiary)]">
              Qualified setups — core scanner Tier A/B only
            </p>
          </div>
          <div className="table-container">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Tier</th>
                  <th className="table-num">Score</th>
                  <th className="table-num">close (k ₫)</th>
                  <th className="table-num">zone low–high</th>
                  <th className="table-num">stop</th>
                  <th className="table-num">Bar date</th>
                </tr>
              </thead>
              <tbody>
                {candidatesWithHealth.map((c) => {
                  const lines = reasonsToStrings(c.reasons);
                  const tier = c.quality === ScanQuality.A ? "A" : "B";
                  const perfHint = setupPerfMap.get(`${c.setupType}:${c.quality}`) ?? null;
                  return (
                    <Fragment key={c.id}>
                      <tr>
                        <td className="max-w-[280px] align-top">
                          <SetupsCandidateHealthStrip
                            symbolKey={c.symbolKey}
                            lifecycleSortLabel={c.lifecycleSortLabel}
                            healthLevel={c.healthLevel}
                            healthScore={c.healthScore}
                            healthScoreLabel={c.healthScoreLabel}
                            healthLines={c.healthLines}
                            healthHint={c.healthHint}
                            compact
                          />
                          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {fmtSetupPerfHint(tier, perfHint)}
                          </p>
                        </td>
                        <td className="align-top">{displayScanQualityTier(c.quality)}</td>
                        <td className="table-num align-top">{c.healthScore}</td>
                        <td className="table-num">{fmtThousands(c.close)}</td>
                        <td className="table-num">
                          {fmtThousands(c.pullbackZoneLow)} – {fmtThousands(c.pullbackZoneHigh)}
                        </td>
                        <td className="table-num">{fmtThousands(c.stopLevel)}</td>
                        <td className="table-num whitespace-nowrap text-xs">
                          {new Date(c.barDate).toLocaleDateString("en-CA")}
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={7}
                          className="border-t p-0 align-top"
                          style={{ borderColor: "var(--border-primary)" }}
                        >
                          <details
                            className="px-3 py-2 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <summary
                              className="cursor-pointer font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              Candidate details
                            </summary>
                            {c.healthLines.length > 0 || c.healthHint ? (
                              <div className="mt-2">
                                {c.healthSummary ? (
                                  <p className="leading-snug" style={{ color: "var(--text-primary)" }}>
                                    {c.healthSummary}
                                  </p>
                                ) : null}
                                {c.healthLines.length > 0 ? (
                                  <ul className="mt-1 space-y-0.5 leading-snug">
                                    {c.healthLines.map((line, i) => (
                                      <li key={i}>{line}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {c.healthHint ? (
                                  <p
                                    className="mt-1 italic leading-snug"
                                    style={{ color: "var(--text-tertiary)" }}
                                  >
                                    {c.healthHint}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                            {lines.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 leading-snug">
                                {lines.map((line, i) => (
                                  <li key={i} className="break-words">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 leading-snug">No extra scanner notes.</p>
                            )}
                          </details>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={7}
                          className="border-t p-0 align-top"
                          style={{ borderColor: "var(--border-primary)" }}
                        >
                          <div className="px-3 py-2">
                            <div className="mb-2 flex justify-end">
                              <Link
                                href={`/trades/new?setupCandidateId=${c.id}`}
                                className="btn btn-secondary btn-sm"
                              >
                                Create Trade from Setup
                              </Link>
                            </div>
                            <SetupsCandidatePositionSizing
                              symbolKey={c.symbolKey}
                              quality={tier}
                              defaultEntryKVnd={c.close}
                              defaultStopKVnd={c.stopLevel}
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
