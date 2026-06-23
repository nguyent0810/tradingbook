"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PaperValidationSummaryUi } from "@/lib/dashboard/load-paper-validation-summary";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { buildEvidenceSummaryLine } from "@/lib/dashboard/build-evidence-summary";
import { hasAnyEarlyEntryRows } from "@/lib/dashboard/rs-workbench-ui";
import { mapDashboardV3ToCommandDeck } from "./map-dashboard-v3-to-command-deck";
import { CommandBar } from "./CommandBar";
import { DecisionCoreCard } from "./DecisionCoreCard";
import { OpportunityRadar } from "./OpportunityRadar";
import { RelativeStrengthWorkbench } from "./RelativeStrengthWorkbench";
import { EvidenceGrid } from "./EvidenceGrid";
import { TradeGateSummaryCard } from "./TradeGateSummaryCard";
import { SetupIntelligenceSection } from "./SetupIntelligenceSection";
import { LedgerPulseBar } from "./LedgerPulseBar";
import { PaperValidationSummaryCard } from "./PaperValidationSummaryCard";
import type { ReactNode } from "react";
import "./command-deck.css";

export type DashboardLayoutProps = {
  viewModel: DashboardV3ViewModel;
  loading?: boolean;
  header?: ReactNode;
  paperValidation?: PaperValidationSummaryUi | null;
};

export function DashboardLayout({
  viewModel,
  loading = false,
  header,
  paperValidation = null,
}: DashboardLayoutProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const data = mapDashboardV3ToCommandDeck(viewModel);
  const decisionMode = viewModel.decision.mode;
  const evidenceSummary =
    viewModel.evidenceDefaultOpen && decisionMode === "PROTECT CAPITAL"
      ? buildEvidenceSummaryLine(decisionMode, viewModel.evidence)
      : null;
  const showEarlyEntry = hasAnyEarlyEntryRows(data.relativeStrength);

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

        <motion.div className="cd-cockpit" {...container}>
          <motion.div className="cd-cockpit__top" {...item}>
            <CommandBar
              data={data.commandBar}
              headerCta={viewModel.headerCta}
              loading={loading}
            />
          </motion.div>

          <div className="cd-cockpit__body">
            <motion.aside className="cd-cockpit__rail" {...item}>
              <DecisionCoreCard data={data.decision} />
              <TradeGateSummaryCard risk={viewModel.risk} />
              <OpportunityRadar
                nodes={data.radar}
                decisionMode={decisionMode}
                variant="mini"
                selectedSymbol={selectedSymbol}
                onNodeClick={setSelectedSymbol}
                rsRows={data.relativeStrength.map((r) => ({
                  symbol: r.symbol,
                  rs20: r.rs20,
                }))}
              />
            </motion.aside>

            <motion.main className="cd-cockpit__main" {...item}>
              <RelativeStrengthWorkbench
                rows={data.relativeStrength}
                contextNote={data.rsContextNote}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
              />
            </motion.main>
          </div>

          <motion.div className="cd-cockpit__footer" {...item}>
            <SetupIntelligenceSection
              rows={data.setupIntelligence}
              emptyMessage={data.setupEmptyMessage}
              subtitle={data.setupSubtitle}
            />
            <div className="cd-cockpit__footer-row">
              <PaperValidationSummaryCard
                summary={paperValidation}
                showEarlyEntry={showEarlyEntry}
              />
              <LedgerPulseBar data={viewModel.ledger} />
            </div>
            <EvidenceGrid
              items={data.evidence}
              defaultOpen={viewModel.evidenceDefaultOpen}
              summaryLine={evidenceSummary}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
