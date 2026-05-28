"use client";

import { motion, useReducedMotion } from "framer-motion";
import { v3PreviewData } from "./v3-data";
import { MarketPulseCommandBar } from "./sections/market-pulse-command-bar";
import { DecisionHero } from "./sections/decision-hero";
import { OpportunityRadar } from "./sections/opportunity-radar";
import { SetupIntelligenceRail } from "./sections/setup-intelligence-rail";
import { RiskConsole } from "./sections/risk-console";
import { LedgerPulseStrip } from "./sections/ledger-pulse-strip";
import { EvidenceLayer } from "./sections/evidence-layer";

function sparkPath(values: number[], width: number, height: number): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function TradingOsV3Preview() {
  const reducedMotion = useReducedMotion();
  const path = sparkPath(v3PreviewData.pulseSeries, 960, 220);

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: "easeOut" as const },
      };

  return (
    <main className="tosv3-page">
      <div className="tosv3-bg-grid" aria-hidden />
      <div className="tosv3-bg-noise" aria-hidden />

      <motion.div className="tosv3-shell" {...motionProps}>
        <div className="tosv3-zone tosv3-zone--command">
          <MarketPulseCommandBar data={v3PreviewData.marketPulse} />
        </div>

        <motion.section
          className="tosv3-zone tosv3-zone--chart tosv3-panel tosv3-chart"
          aria-label="Market pulse chart"
          {...motionProps}
        >
          <div className="tosv3-section-head">
            <span className="tosv3-kicker">Signal trajectory</span>
            <p className="tosv3-type-muted">Session momentum context</p>
          </div>
          <svg viewBox="0 0 960 220" role="img" aria-label="Signal trajectory chart">
            <defs>
              <linearGradient id="tosv3ChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(80, 227, 194, 0.9)" />
                <stop offset="100%" stopColor="rgba(80, 227, 194, 0.05)" />
              </linearGradient>
            </defs>
            <path d={`${path} L 960 220 L 0 220 Z`} fill="url(#tosv3ChartGrad)" />
            <path d={path} className="tosv3-chart__line" />
          </svg>
        </motion.section>

        <div className="tosv3-grid">
          <div className="tosv3-zone tosv3-zone--decision">
            <DecisionHero data={v3PreviewData.decision} />
          </div>
          <div className="tosv3-zone tosv3-zone--risk">
            <RiskConsole data={v3PreviewData.risk} />
          </div>
          <div className="tosv3-zone tosv3-zone--radar">
            <OpportunityRadar items={v3PreviewData.radarItems} />
          </div>
          <div className="tosv3-zone tosv3-zone--setup">
            <SetupIntelligenceRail cards={v3PreviewData.setupCards} />
          </div>
        </div>

        <div className="tosv3-zone tosv3-zone--ledger">
          <LedgerPulseStrip data={v3PreviewData.ledger} />
        </div>
        <div className="tosv3-zone tosv3-zone--evidence">
          <EvidenceLayer items={v3PreviewData.evidence} />
        </div>
      </motion.div>
    </main>
  );
}
