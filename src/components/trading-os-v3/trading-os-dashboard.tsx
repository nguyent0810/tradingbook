"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { MarketPulseCommandBar } from "./sections/market-pulse-command-bar";
import { DecisionHero } from "./sections/decision-hero";
import { SignalTrajectoryChart } from "./sections/signal-trajectory-chart";
import { OpportunityRadar } from "./sections/opportunity-radar";
import { SetupIntelligenceRail } from "./sections/setup-intelligence-rail";
import { RiskConsole } from "./sections/risk-console";
import { LedgerPulseStrip } from "./sections/ledger-pulse-strip";
import { EvidenceLayer } from "./sections/evidence-layer";
import { RsNearMissWatchlistPanel } from "@/components/rs-near-miss-watchlist-panel";

export type TradingOsDashboardProps = {
  viewModel: DashboardV3ViewModel;
};

export function TradingOsDashboard({ viewModel }: TradingOsDashboardProps) {
  const reducedMotion = useReducedMotion();
  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: "easeOut" as const },
      };

  return (
    <div className="tosv3-page" data-testid="dashboard-v3">
      <div className="tosv3-bg-grid" aria-hidden />
      <div className="tosv3-bg-noise" aria-hidden />

      <motion.div className="tosv3-shell" {...motionProps}>
        <div className="tosv3-page-header-slot">
          <DashboardPageHeader />
        </div>

        {viewModel.partialError ? (
          <ErrorStateWithEvidence
            className="tosv3-partial-error"
            title="Partial dashboard data unavailable"
            message={viewModel.partialError}
            evidence="Some sections may be empty until the database is reachable."
            data-testid="dashboard-v3-db-load-error"
          />
        ) : null}

        <div className="tosv3-zone tosv3-zone--command">
          <MarketPulseCommandBar data={viewModel.marketPulse} />
        </div>

        <motion.section className="tosv3-zone tosv3-zone--chart" {...motionProps}>
          <SignalTrajectoryChart data={viewModel.signalTrajectory} />
        </motion.section>

        <div className="tosv3-grid">
          <div className="tosv3-zone tosv3-zone--decision">
            <DecisionHero data={viewModel.decision} />
          </div>
          <div className="tosv3-zone tosv3-zone--risk">
            <RiskConsole data={viewModel.risk} />
          </div>
          <div className="tosv3-zone tosv3-zone--radar">
            <OpportunityRadar radar={viewModel.radar} />
          </div>
          <div className="tosv3-zone tosv3-zone--setup">
            <SetupIntelligenceRail cards={viewModel.setupCards} />
          </div>
        </div>

        <div className="tosv3-zone tosv3-zone--ledger">
          <LedgerPulseStrip data={viewModel.ledger} />
        </div>
        <div className="tosv3-zone tosv3-zone--rs-watchlist">
          <RsNearMissWatchlistPanel
            panel={viewModel.rsNearMissWatchlist}
            testId="dashboard-rs-near-miss-watchlist"
          />
        </div>
        <div className="tosv3-zone tosv3-zone--evidence">
          <EvidenceLayer items={viewModel.evidence} />
        </div>
      </motion.div>
    </div>
  );
}
