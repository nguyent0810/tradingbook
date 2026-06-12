"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { mapDashboardV3ToCommandDeck } from "./map-dashboard-v3-to-command-deck";
import { CommandBar } from "./CommandBar";
import { DecisionCoreCard } from "./DecisionCoreCard";
import { OpportunityRadar } from "./OpportunityRadar";
import { RelativeStrengthTable } from "./RelativeStrengthTable";
import { EvidenceGrid } from "./EvidenceGrid";
import { TradeGateCard } from "./TradeGateCard";
import { SetupIntelligenceSection } from "./SetupIntelligenceSection";
import { LedgerPulseBar } from "./LedgerPulseBar";
import "./command-deck.css";

export type DashboardLayoutProps = {
  viewModel: DashboardV3ViewModel;
  loading?: boolean;
  header?: ReactNode;
};

export function DashboardLayout({ viewModel, loading = false, header }: DashboardLayoutProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const data = mapDashboardV3ToCommandDeck(viewModel);
  const decisionMode = viewModel.decision.mode;

  const container = reducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.35 },
      };

  const item = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: "easeOut" as const },
      };

  return (
    <div className="cd-root" data-testid="dashboard-cyber">
      <div className="cd-shell">
        {header}

        <motion.div className="cd-grid cd-grid--main" {...container}>
          <motion.div className="cd-span-12" {...item}>
            <CommandBar data={data.commandBar} loading={loading} />
          </motion.div>

          <motion.div className="cd-span-6" {...item}>
            <DecisionCoreCard data={data.decision} />
          </motion.div>

          <motion.div className="cd-span-6" {...item}>
            <TradeGateCard risk={viewModel.risk} />
          </motion.div>

          <motion.div className="cd-span-6" {...item}>
            <OpportunityRadar nodes={data.radar} decisionMode={decisionMode} />
          </motion.div>

          <motion.div className="cd-span-6" {...item}>
            <RelativeStrengthTable
              rows={data.relativeStrength}
              contextNote={data.rsContextNote}
            />
          </motion.div>

          <motion.div className="cd-span-12" {...item}>
            <SetupIntelligenceSection
              rows={data.setupIntelligence}
              emptyMessage={data.setupEmptyMessage}
              subtitle={data.setupSubtitle}
            />
          </motion.div>

          <motion.div className="cd-span-12" {...item}>
            <LedgerPulseBar data={viewModel.ledger} />
          </motion.div>

          <motion.div className="cd-span-12" {...item}>
            <EvidenceGrid items={data.evidence} defaultOpen={viewModel.evidenceDefaultOpen} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
