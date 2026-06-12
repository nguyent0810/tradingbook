"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DataFlowLayer } from "./components/DataFlowLayer";
import { DecisionCore } from "./components/DecisionCore";
import { EvidenceDock } from "./components/EvidenceDock";
import { HeaderPulse } from "./components/HeaderPulse";
import { IntelligenceCore } from "./components/IntelligenceCore";
import { LedgerStrip } from "./components/LedgerStrip";
import { OpportunityRadar } from "./components/OpportunityRadar";
import { RiskConsoleTable } from "./components/RiskConsoleTable";
import { RsWatchlistTable } from "./components/RsWatchlistTable";
import { SetupTable } from "./components/SetupTable";
import { usePanelAnchors } from "./hooks/usePanelAnchors";
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });

  const { viewModel: data, flashMap, wirePhase, bootComplete } = useTradingData(viewModel);
  const { refs, anchors, coreCenter, remeasure } = usePanelAnchors(gridRef);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setGridSize({ width: rect.width, height: rect.height });
      remeasure();
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [remeasure]);

  const motionProps = reducedMotion
    ? {}
    : { variants: staggerContainer, initial: "hidden", animate: "show" };

  const itemProps = reducedMotion ? {} : { variants: staggerItem };

  return (
    <div className="ccd-root pb-10" data-testid="dashboard-cyber">
      <div className="ccd-bg-grid" aria-hidden />
      <div className="ccd-bg-noise" aria-hidden />

      <div className="ccd-shell">
        <div className="mb-6">
          <DashboardPageHeader />
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

        <div className="relative">
          <DataFlowLayer
            anchors={anchors}
            coreCenter={coreCenter}
            wirePhase={wirePhase}
            bootComplete={bootComplete}
            width={gridSize.width}
            height={gridSize.height}
          />

          <motion.div
            ref={gridRef}
            className="ccd-dashboard-grid relative z-[2]"
            {...motionProps}
          >
            <motion.div className="ccd-zone ccd-zone--header" {...itemProps}>
              <HeaderPulse
                data={data.marketPulse}
                decision={data.decision}
                risk={data.risk}
                flashMap={flashMap}
              />
            </motion.div>

            <motion.div
              ref={refs.decision}
              className="ccd-zone ccd-zone--decision"
              {...itemProps}
            >
              <DecisionCore data={data.decision} />
            </motion.div>

            <motion.div className="ccd-zone ccd-zone--ai" {...itemProps}>
              <div className="ccd-ai-core-card ccd-panel h-full" aria-label="AI intelligence core">
                <span className="ccd-kicker">AI Core</span>
                <p className="ccd-ai-core-card__hint">Signal mesh</p>
                <IntelligenceCore compact />
              </div>
            </motion.div>

            <motion.div ref={refs.risk} className="ccd-zone ccd-zone--risk" {...itemProps}>
              <RiskConsoleTable data={data.risk} flashMap={flashMap} />
            </motion.div>

            <motion.div ref={refs.radar} className="ccd-zone ccd-zone--radar" {...itemProps}>
              <OpportunityRadar radar={data.radar} />
            </motion.div>

            <motion.div ref={refs.rs} className="ccd-zone ccd-zone--rs" {...itemProps}>
              <RsWatchlistTable panel={data.rsWatchlist} />
            </motion.div>
          </motion.div>
        </div>

        <motion.div className="ccd-footer" {...itemProps}>
          <SetupTable cards={data.setupCards} />
          <LedgerStrip data={data.ledger} />
          <EvidenceDock items={data.evidence} />
        </motion.div>
      </div>
    </div>
  );
}

export const CyberCommandDeck = DashboardContainer;
