"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { CommandDeckMockData } from "./types";
import { CommandBar } from "./CommandBar";
import { DecisionCoreCard } from "./DecisionCoreCard";
import { OpportunityRadar } from "./OpportunityRadar";
import { RelativeStrengthTable } from "./RelativeStrengthTable";
import { EvidenceGrid } from "./EvidenceGrid";
import "./command-deck.css";

export type DashboardLayoutProps = {
  data: CommandDeckMockData;
  loading?: boolean;
  header?: ReactNode;
};

const RS_CONTEXT_NO_TRADE =
  "Context only — relative strength does not qualify a setup and does not change today's no-trade stance.";

export function DashboardLayout({ data, loading = false, header }: DashboardLayoutProps) {
  const reducedMotion = useReducedMotion() ?? false;

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
    <div className="cd-root" data-testid="command-deck-root">
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
            <OpportunityRadar nodes={data.radar} />
          </motion.div>

          <motion.div className="cd-span-6" {...item}>
            <RelativeStrengthTable rows={data.relativeStrength} contextNote={RS_CONTEXT_NO_TRADE} />
          </motion.div>

          <motion.div className="cd-span-12" {...item}>
            <EvidenceGrid items={data.evidence} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
