import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import { formatDecisionLevelForDisplay } from "@/lib/scanner/trading-decision";

export function SetupsStanceCompact({ decision }: { decision: DailyTradingDecision }) {
  const actionLabel = formatDecisionLevelForDisplay(decision.level);

  return (
    <section className="tosv3-setups-stance" data-testid="setups-todays-action">
      <div className="tosv3-setups-stance__head">
        <span className="tosv3-kicker">Lập trường giao dịch</span>
        <span className="tosv3-setups-stance__mode">{actionLabel}</span>
      </div>
      <p className="tosv3-setups-stance__allocation">
        Mức vốn tối đa <strong className="tabular-nums">{decision.allocation}</strong>
      </p>
      <p className="tosv3-setups-stance__reason">{decision.explanation}</p>
      <p className="tosv3-setups-stance__note">Hướng dẫn danh mục — không phải tín hiệu mua.</p>
    </section>
  );
}
