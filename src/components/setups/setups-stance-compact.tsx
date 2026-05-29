import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import { formatDecisionLevelForDisplay } from "@/lib/scanner/trading-decision";

export function SetupsStanceCompact({ decision }: { decision: DailyTradingDecision }) {
  const actionLabel = formatDecisionLevelForDisplay(decision.level);

  return (
    <section className="tosv3-setups-stance" data-testid="setups-todays-action">
      <div className="tosv3-setups-stance__head">
        <span className="tosv3-kicker">Trading stance</span>
        <span className="tosv3-setups-stance__mode">{actionLabel}</span>
      </div>
      <p className="tosv3-setups-stance__allocation">
        Max exposure <strong className="tabular-nums">{decision.allocation}</strong>
      </p>
      <p className="tosv3-setups-stance__reason">{decision.explanation}</p>
      <p className="tosv3-setups-stance__note">Portfolio guide — not a buy signal.</p>
    </section>
  );
}
