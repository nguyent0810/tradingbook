"use client";

import { useCallback, useId, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { ScanQuality } from "@/generated/prisma/client";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import { SetupsCandidatePositionSizing } from "@/components/setups-candidate-position-sizing";
import { SignalBadge, qualityToTierVariant } from "@/components/command-deck/signal-badge";
import { displayScanQualityTier } from "@/lib/trading-display-labels";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { formatScannerReasonForUser } from "@/lib/dashboard/v3-user-copy";
import { fmtThousands } from "./setups-shared-helpers";

export type CandidateRowClientProps = {
  candidate: {
    id: string;
    symbolKey: string;
    lifecycleSortLabel: "READY" | "WATCHING";
    healthLevel: SetupHealthLevelValue;
    healthScore: number;
    healthScoreLabel: "Strong" | "Decent" | "Weak" | "Risky";
    healthLines: string[];
    healthHint: string | null;
    healthSummary: string | null;
    quality: ScanQuality;
    close: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
    barDate: Date | string;
    reasons: unknown;
    setupType: string;
  };
  perfHint: string;
  reasonsLines: string[];
  rankScore: number;
  rankBreakdownLines: string[];
  rsRankPreviewLines: string[];
  rsDiagnostic: RsDiagnosticUi | null;
};

function humanizeLine(line: string): string {
  return formatScannerReasonForUser(line);
}

export function CandidateRowClient({
  candidate,
  perfHint,
  reasonsLines,
  rankScore,
  rankBreakdownLines,
  rsRankPreviewLines,
  rsDiagnostic,
}: CandidateRowClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const detailsId = useId();
  const techId = useId();
  const tier = candidate.quality === "A" ? "A" : "B";
  const rowAttention =
    candidate.lifecycleSortLabel === "READY"
      ? "dense-candidate-row--ready"
      : candidate.healthLevel === "AT_RISK"
        ? "dense-candidate-row--at-risk"
        : candidate.healthLevel === "DEAD"
          ? "dense-candidate-row--dead"
          : "";

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  const hasTechnicalDetail =
    rankBreakdownLines.length > 0 ||
    rsRankPreviewLines.length > 0 ||
    rsDiagnostic != null;

  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={onRowKeyDown}
        className={`dense-candidate-row ${rowAttention}${isOpen ? " dense-candidate-row--open" : ""}`}
        data-testid="setups-candidate-row"
        aria-expanded={isOpen}
        aria-controls={detailsId}
      >
        <td className="dense-candidate-row__symbol-cell">
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <SetupsCandidateHealthStrip
              symbolKey={candidate.symbolKey}
              lifecycleSortLabel={candidate.lifecycleSortLabel}
              healthLevel={candidate.healthLevel}
              healthScore={candidate.healthScore}
              healthScoreLabel={candidate.healthScoreLabel}
              healthLines={candidate.healthLines}
              healthHint={candidate.healthHint}
              compact
            />
          </div>
          <p className="dense-candidate-row__perf-hint">{perfHint}</p>
        </td>
        <td className="dense-candidate-row__tier-cell">
          <SignalBadge variant={qualityToTierVariant(tier)}>
            Tier {displayScanQualityTier(candidate.quality)}
          </SignalBadge>
        </td>
        <td className="table-num dense-candidate-row__num">{candidate.healthScore}</td>
        <td className="table-num dense-candidate-row__num">{fmtThousands(candidate.close)}</td>
        <td className="table-num dense-candidate-row__num dense-candidate-row__zone">
          {fmtThousands(candidate.pullbackZoneLow)} – {fmtThousands(candidate.pullbackZoneHigh)}
        </td>
        <td className="table-num dense-candidate-row__num dense-candidate-row__stop">
          {fmtThousands(candidate.stopLevel)}
        </td>
        <td className="table-num dense-candidate-row__num dense-candidate-row__date">
          {new Date(candidate.barDate).toLocaleDateString("en-CA")}
        </td>
      </tr>

      <tr className="dense-candidate-row__detail-row">
        <td colSpan={7} className="dense-candidate-row__detail-cell">
          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.div
                id={detailsId}
                role="region"
                aria-label={`Details for ${candidate.symbolKey}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="dense-candidate-row__detail-panel"
              >
                <div className="dense-candidate-row__detail-grid">
                  <div className="dense-candidate-row__detail-col">
                    <h4 className="dense-candidate-row__detail-title">Setup context</h4>

                    {candidate.healthLines.length > 0 ||
                    candidate.healthHint ||
                    candidate.healthSummary ? (
                      <div className="dense-candidate-row__detail-card">
                        {candidate.healthSummary ? (
                          <p className="dense-candidate-row__summary">
                            {humanizeLine(candidate.healthSummary)}
                          </p>
                        ) : null}
                        {candidate.healthLines.length > 0 ? (
                          <ul className="dense-candidate-row__list">
                            {candidate.healthLines.map((line, i) => (
                              <li key={i}>{humanizeLine(line)}</li>
                            ))}
                          </ul>
                        ) : null}
                        {candidate.healthHint ? (
                          <p className="dense-candidate-row__hint">{humanizeLine(candidate.healthHint)}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {reasonsLines.length > 0 ? (
                      <div className="dense-candidate-row__notes">
                        <span className="dense-candidate-row__notes-label">Why this setup surfaced</span>
                        <ul className="dense-candidate-row__list">
                          {reasonsLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="dense-candidate-row__empty-note">No extra notes for this candidate.</p>
                    )}

                    {hasTechnicalDetail ? (
                      <div className="tosv3-tech-detail">
                        <button
                          type="button"
                          className="tosv3-tech-detail__toggle"
                          aria-expanded={techOpen}
                          aria-controls={techId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTechOpen((v) => !v);
                          }}
                        >
                          {techOpen ? "Hide" : "Show"} technical evidence
                        </button>
                        {techOpen ? (
                          <div id={techId} className="tosv3-tech-detail__body">
                            <div
                              className="dense-candidate-row__notes"
                              data-testid="setups-candidate-rs-diagnostic"
                            >
                              <RelativeStrengthDiagnosticPanel
                                diagnostic={rsDiagnostic}
                                compact
                                testId="setups-candidate-rs-panel"
                              />
                            </div>
                            {rankBreakdownLines.length > 0 ? (
                              <div
                                className="dense-candidate-row__notes"
                                data-testid="setups-candidate-rank-breakdown"
                              >
                                <span className="dense-candidate-row__notes-label">
                                  Setup score breakdown ({rankScore.toFixed(1)})
                                </span>
                                <ul className="dense-candidate-row__list">
                                  {rankBreakdownLines.map((line, i) => (
                                    <li key={`rank-${i}`}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {rsRankPreviewLines.length > 0 ? (
                              <div
                                className="dense-candidate-row__notes dense-candidate-row__notes--preview"
                                data-testid="setups-candidate-rs-rank-preview"
                              >
                                <span className="dense-candidate-row__notes-label">
                                  Relative strength context
                                </span>
                                <ul className="dense-candidate-row__list">
                                  {rsRankPreviewLines.map((line, i) => (
                                    <li key={`rs-rank-${i}`}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="dense-candidate-row__detail-col dense-candidate-row__detail-col--action">
                    <div className="dense-candidate-row__action-head">
                      <h4 className="dense-candidate-row__detail-title">Position sizing</h4>
                      <Link
                        href={`/trades/new?setupCandidateId=${candidate.id}`}
                        className="tosv3-btn tosv3-btn--primary tosv3-btn--sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Log trade
                      </Link>
                    </div>
                    <div
                      className="dense-candidate-row__detail-card"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <SetupsCandidatePositionSizing
                        symbolKey={candidate.symbolKey}
                        quality={tier}
                        defaultEntryKVnd={candidate.close}
                        defaultStopKVnd={candidate.stopLevel}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </td>
      </tr>
    </>
  );
}
