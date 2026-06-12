"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DecisionCore } from "./components/DecisionCore";
import { EvidenceDock } from "./components/EvidenceDock";
import { HeaderPulse } from "./components/HeaderPulse";
import { LedgerStrip } from "./components/LedgerStrip";
import { OpportunityRadar } from "./components/OpportunityRadar";
import { TradeGateTable } from "./components/TradeGateTable";
import { RsWatchlistTable } from "./components/RsWatchlistTable";
import { SetupTable } from "./components/SetupTable";
import { useTradingData } from "./hooks/useTradingData";
import type { CyberCommandDeckProps } from "./types";
import "./cyber-command-deck.css";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.36, ease: "easeOut" as const },
  },
};

export function DashboardContainer({ viewModel }: CyberCommandDeckProps) {
  const reducedMotion = useReducedMotion();
  const { viewModel: data, flashMap } = useTradingData(viewModel);

  const shouldAnimate = reducedMotion === false;

  const motionProps = {
    variants: staggerContainer,
    initial: shouldAnimate ? "hidden" : "show",
    animate: "show",
  };

  const itemProps = {
    variants: staggerItem,
    initial: shouldAnimate ? "hidden" : "show",
    animate: "show",
  };

  return (
    <div className="ccd-root pb-10" data-testid="dashboard-cyber">
      <div className="ccd-bg-grid" aria-hidden />
      <div className="ccd-bg-noise" aria-hidden />

      <div className="ccd-shell">
        <div className="mb-6">
          <DashboardPageHeader cta={data.headerCta} />
        </div>

        {data.partialError ? (
          <ErrorStateWithEvidence
            className="ccd-partial-error"
            title="Partial dashboard data unavailable"
            message={data.partialError}
            evidence="Some sections may be empty until the database is reachable."
            data-testid="dashboard-cyber-db-load-error"
          />
        ) : null}

        <motion.div className="ccd-dashboard-grid" {...motionProps}>
          <motion.div className="ccd-zone ccd-zone--header" {...itemProps}>
            <HeaderPulse
              data={data.marketPulse}
              decision={data.decision}
              risk={data.risk}
              flashMap={flashMap}
            />
          </motion.div>

          <motion.div className="ccd-zone ccd-zone--decision" {...itemProps}>
            <DecisionCore data={data.decision} />
          </motion.div>

          <motion.div className="ccd-zone ccd-zone--risk" {...itemProps}>
            <TradeGateTable data={data.risk} flashMap={flashMap} />
          </motion.div>

          <motion.div className="ccd-zone ccd-zone--radar" {...itemProps}>
            <OpportunityRadar radar={data.radar} decisionMode={data.decision.mode} />
          </motion.div>

          <motion.div className="ccd-zone ccd-zone--rs" {...itemProps}>
            <RsWatchlistTable panel={data.rsWatchlist} />
          </motion.div>
        </motion.div>

        <motion.div className="ccd-footer" {...itemProps}>
          <SetupTable cards={data.setupCards} intelligence={data.setupIntelligence} />
          <LedgerStrip data={data.ledger} />
          <EvidenceDock items={data.evidence} defaultOpen={data.evidenceDefaultOpen} />
        </motion.div>
      </div>
    </div>
  );
}

export const CyberCommandDeck = DashboardContainer;
