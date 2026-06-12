"use client";

import { Activity, Shield, TrendingUp } from "lucide-react";
import type { FlashMap, V3DecisionHero, V3MarketPulse, V3RiskConsole } from "../types";
import { FlashValue } from "./FlashValue";

type Props = {
  data: V3MarketPulse;
  decision: V3DecisionHero;
  risk: V3RiskConsole;
  flashMap: FlashMap;
};

function watchBadgeClass(
  decision: V3DecisionHero,
  risk: V3RiskConsole
): "ccd-badge--crimson" | "ccd-badge--amber" | "ccd-badge--cyan" | "ccd-badge--emerald" {
  if (decision.mode === "PROTECT CAPITAL" || risk.utilizationTone === "critical") {
    return "ccd-badge--crimson";
  }
  if (decision.mode === "WAIT" || risk.utilizationTone === "elevated") {
    return "ccd-badge--amber";
  }
  if (decision.mode === "TRADE") return "ccd-badge--emerald";
  return "ccd-badge--cyan";
}

export function HeaderPulse({ data, decision, risk, flashMap }: Props) {
  const badgeClass = watchBadgeClass(decision, risk);

  return (
    <section
      className="ccd-panel ccd-header-grid"
      aria-label="Market pulse command bar"
      data-testid="dashboard-cyber-market-pulse"
    >
      <div className="ccd-header-cell">
        <span className="ccd-label">
          <Activity className="inline h-3 w-3 mr-1 opacity-60" aria-hidden />
          Session
        </span>
        <strong className="ccd-metric text-sm truncate">{data.session}</strong>
      </div>

      <div className="ccd-header-cell ccd-header-cell--primary">
        <span className="ccd-label">
          <TrendingUp className="inline h-3 w-3 mr-1 opacity-60" aria-hidden />
          VNINDEX
        </span>
        <FlashValue flashKey="marketPulse.vnindex" flashMap={flashMap}>
          <strong className="ccd-metric">{data.vnindex ?? "—"}</strong>
        </FlashValue>
      </div>

      <div className="ccd-header-cell">
        <span className="ccd-label">Freshness</span>
        <strong className="ccd-metric text-sm">{data.freshness}</strong>
      </div>

      <div className="ccd-header-cell">
        <span className="ccd-label">Regime</span>
        <strong className="ccd-metric text-sm">{data.regime}</strong>
      </div>

      <div className="ccd-header-cell">
        <span className="ccd-label">Volatility</span>
        <strong className="ccd-metric text-sm">{data.volatility ?? "—"}</strong>
      </div>

      <div className="ccd-header-cell">
        <span className="ccd-label">
          <Shield className="inline h-3 w-3 mr-1 opacity-60" aria-hidden />
          Watch State
        </span>
        <span className={`ccd-badge ${badgeClass}`}>
          <span className="ccd-badge__dot" aria-hidden />
          {data.watchState}
        </span>
      </div>
    </section>
  );
}
