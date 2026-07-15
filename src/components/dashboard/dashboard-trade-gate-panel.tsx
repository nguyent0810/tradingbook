import type { V3TradeGate, V3TradeGateRow } from "@/lib/dashboard/dashboard-v3-view-model";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export type DashboardTradeGatePanelProps = {
  tradeGate: V3TradeGate;
};

const STATUS_TONE: Record<V3TradeGateRow["status"], BadgeTone> = {
  blocked: "danger",
  waiting: "warning",
  setup_needed: "neutral",
  ready: "success",
};

/**
 * "Why not Go" explainability panel — renders the trade-gate rule checklist
 * (`buildTradeGate`) that already encodes every fail-closed gate (Gate 1,
 * confidence band, health, budget, utilization) but previously had no UI
 * consumer despite being computed on every render.
 */
export function DashboardTradeGatePanel({ tradeGate }: DashboardTradeGatePanelProps) {
  return (
    <section
      className="dash-v2-card dash-v2-card--inset dash-trade-gate"
      data-testid="dashboard-trade-gate-panel"
      aria-labelledby="dashboard-trade-gate-heading"
    >
      <h2 id="dashboard-trade-gate-heading" className="dash-section-title">
        Why not Go?
      </h2>
      <p className="dash-trade-gate__subtitle text-xs" style={{ color: "var(--text-tertiary)" }}>
        {tradeGate.subtitle}
      </p>
      <ul className="dash-trade-gate__rows" data-testid="dashboard-trade-gate-rows">
        {tradeGate.rows.map((row) => (
          <li
            key={row.id}
            className={`dash-trade-gate__row dash-trade-gate__row--${row.status}`}
            data-testid={`dashboard-trade-gate-row-${row.id}`}
          >
            <Badge tone={STATUS_TONE[row.status]} size="compact">
              {row.statusLabel}
            </Badge>
            <span className="dash-trade-gate__rule">{row.rule}</span>
            <span className="dash-trade-gate__action text-xs">{row.action}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
