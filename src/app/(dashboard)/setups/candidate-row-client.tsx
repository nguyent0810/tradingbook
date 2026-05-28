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
};

export function CandidateRowClient({ candidate, perfHint, reasonsLines }: CandidateRowClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = useId();
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
                    <h4 className="dense-candidate-row__detail-title">
                      Scanner diagnostic &amp; reasons
                    </h4>

                    {candidate.healthLines.length > 0 ||
                    candidate.healthHint ||
                    candidate.healthSummary ? (
                      <div className="dense-candidate-row__detail-card">
                        {candidate.healthSummary ? (
                          <p className="dense-candidate-row__summary">{candidate.healthSummary}</p>
                        ) : null}
                        {candidate.healthLines.length > 0 ? (
                          <ul className="dense-candidate-row__list">
                            {candidate.healthLines.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                        {candidate.healthHint ? (
                          <p className="dense-candidate-row__hint">{candidate.healthHint}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {reasonsLines.length > 0 ? (
                      <div className="dense-candidate-row__notes">
                        <span className="dense-candidate-row__notes-label">
                          Scanner notes &amp; criteria
                        </span>
                        <ul className="dense-candidate-row__list">
                          {reasonsLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="dense-candidate-row__empty-note">No extra scanner notes.</p>
                    )}
                  </div>

                  <div className="dense-candidate-row__detail-col dense-candidate-row__detail-col--action">
                    <div className="dense-candidate-row__action-head">
                      <h4 className="dense-candidate-row__detail-title">Position sizing</h4>
                      <Link
                        href={`/trades/new?setupCandidateId=${candidate.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Log trade from setup
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
