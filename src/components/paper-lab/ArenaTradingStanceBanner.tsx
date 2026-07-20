"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import { formatDecisionLevelForDisplay } from "@/lib/scanner/trading-decision";
import "./paper-lab-command-center.css";

type TradingDecision = ArenaOverviewDto["tradingDecision"];
type FunnelKind = "universe" | "tradable" | "setups";

function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.textContent = String(value);
      return;
    }
    node.textContent = "0";
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return <span ref={ref}>{value}</span>;
}

function FunnelStep({
  name,
  value,
  pct,
  kind,
  delay,
  reduced,
}: {
  name: string;
  value: number;
  pct: number;
  kind: FunnelKind;
  delay: number;
  reduced: boolean;
}) {
  return (
    <div className="arena-stance__funnel-step">
      <span className="arena-stance__funnel-count">
        <CountUp value={value} reduced={reduced} />
      </span>
      <div className="arena-stance__funnel-bar">
        <motion.div
          className={`arena-stance__funnel-fill arena-stance__funnel-fill--${kind}`}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: Math.max(0, Math.min(100, pct)) / 100 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: reduced ? 0 : delay }}
        />
      </div>
      <span className="arena-stance__funnel-name">{name}</span>
    </div>
  );
}

/**
 * Answers "why aren't the agents trading today" right where the question comes up —
 * the day's stance (NO_TRADE / PROBE / NORMAL) plus the scan funnel that produced it.
 */
export function ArenaTradingStanceBanner({ decision }: { decision: TradingDecision }) {
  const reducedMotion = useReducedMotion() ?? false;
  const tone = decision.level.toLowerCase();
  const { universe, tradable, setups } = decision.funnel;
  const tradablePct = universe > 0 ? Math.round((tradable / universe) * 100) : 0;
  const setupsPct = tradable > 0 ? Math.round((setups / tradable) * 100) : 0;

  return (
    <motion.section
      className={`arena-stance arena-stance--${tone}`}
      data-testid="arena-trading-stance-banner"
      initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="arena-stance__head">
        <span className="arena-stance__kicker">Today&apos;s trading stance</span>
        <div className="arena-stance__badge-row">
          <span className="arena-stance__dot" aria-hidden="true" />
          <span className="arena-stance__level">{formatDecisionLevelForDisplay(decision.level)}</span>
        </div>
        <p className="arena-stance__allocation">
          Max exposure <strong>{decision.allocation}</strong>
        </p>
        <p className="arena-stance__explanation">{decision.explanation}</p>
      </div>

      <div className="arena-stance__funnel">
        <span className="arena-stance__funnel-label">Why — today&apos;s scan funnel</span>
        <div className="arena-stance__funnel-steps">
          <FunnelStep name="Universe scanned" value={universe} pct={100} kind="universe" delay={0} reduced={reducedMotion} />
          <span className="arena-stance__funnel-arrow" aria-hidden="true">→</span>
          <FunnelStep name="Passed liquidity" value={tradable} pct={tradablePct} kind="tradable" delay={0.15} reduced={reducedMotion} />
          <span className="arena-stance__funnel-arrow" aria-hidden="true">→</span>
          <FunnelStep name="Valid setups" value={setups} pct={setupsPct} kind="setups" delay={0.3} reduced={reducedMotion} />
        </div>
      </div>
    </motion.section>
  );
}
