import type { V3RiskConsole } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  data: V3RiskConsole;
};

type RuleState = "pass" | "caution" | "blocked";

function inferRuleState(rule: string, data: V3RiskConsole): RuleState {
  const lower = rule.toLowerCase();
  if (
    lower.includes("no averaging") ||
    lower.includes("pause all new entries") ||
    (data.utilizationTone === "critical" && lower.includes("add risk"))
  ) {
    return "blocked";
  }
  if (lower.includes("do not") || data.utilizationTone === "elevated") return "caution";
  if (data.utilizationTone === "critical") return "caution";
  return "pass";
}

function statusLabel(state: RuleState): string {
  if (state === "blocked") return "Blocked";
  if (state === "caution") return "Guard";
  return "Ready";
}

function actionLabel(state: RuleState): string {
  if (state === "blocked") return "Hold";
  if (state === "caution") return "Watch";
  return "Go";
}

function severityLabel(state: RuleState): string {
  if (state === "blocked") return "High";
  if (state === "caution") return "Med";
  return "Low";
}

function statusTitle(state: RuleState): string {
  if (state === "blocked") return "Rule currently blocking new risk.";
  if (state === "caution") return "Rule requires caution before adding risk.";
  return "Rule currently clear.";
}

function statusClass(state: RuleState): string {
  if (state === "blocked") return "tosv3-risk-rule--blocked";
  if (state === "caution") return "tosv3-risk-rule--caution";
  return "tosv3-risk-rule--pass";
}

function statusIcon(state: RuleState): string {
  if (state === "blocked") return "✕";
  if (state === "caution") return "!";
  return "✓";
}

function cellClass(base: string, label: string): string {
  return `${base} tosv3-risk-rule__cell` + ` tosv3-risk-rule__cell--${label}`;
}

export function RiskConsole({ data }: Props) {
  const hasPercentCap =
    data.exposurePercent != null && data.maxRiskPercent != null && data.utilizationPercent != null;
  const exposureStyle = hasPercentCap
    ? { width: `${Math.min(100, data.utilizationPercent!)}%` }
    : { width: "0%" };
  const utilizationTone =
    data.utilizationTone === "critical"
      ? "tosv3-risk__util--critical"
      : data.utilizationTone === "elevated"
        ? "tosv3-risk__util--elevated"
        : "";

  return (
    <section
      className="tosv3-panel tosv3-risk"
      aria-label="Risk console"
      data-testid="dashboard-v3-risk-console"
    >
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Risk Console</span>
        <p className="tosv3-type-muted">{data.posture}</p>
      </div>

      <div className="tosv3-risk__cap-row">
        {hasPercentCap ? (
          <div>
            <span className="tosv3-type-label">Book exposure</span>
            <strong className="tosv3-type-metric tabular-nums">
              {data.exposurePercent}%
              <em> / {data.maxRiskPercent}% cap</em>
            </strong>
          </div>
        ) : (
          <div>
            <span className="tosv3-type-label">Book exposure</span>
            <strong className="tosv3-type-metric">Configure equity for % cap</strong>
          </div>
        )}
        <div>
          <span className="tosv3-type-label">Open positions</span>
          <strong className="tosv3-type-metric tabular-nums">{data.openPositions}</strong>
        </div>
      </div>

      <div
        className="tosv3-meter tosv3-meter--risk"
        role="img"
        aria-label={
          hasPercentCap
            ? `Exposure utilization ${data.utilizationPercent}% of ${data.maxRiskPercent}% cap`
            : "Exposure utilization unavailable until equity is configured"
        }
      >
        <div className="tosv3-meter__track">
          <span className="tosv3-meter__cap-mark" style={{ left: "100%" }} aria-hidden />
          <div className="tosv3-meter__fill" style={exposureStyle} />
        </div>
      </div>

      {hasPercentCap ? (
        <p className={`tosv3-risk__util tabular-nums ${utilizationTone}`}>
          Utilization {data.utilizationPercent}%
          {data.lossLimit ? ` · ${data.lossLimit}` : ""}
        </p>
      ) : null}

      <p className="tosv3-risk__shield">{data.capitalProtectionState}</p>
      {data.blockers.length > 0 ? (
        <>
          <p className="tosv3-risk__dont-trade">Do not trade if</p>
          <div className="tosv3-risk-matrix" role="table" aria-label="Risk rule matrix">
            <div className="tosv3-risk-matrix__head" role="row">
              <span role="columnheader">Rule</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Severity</span>
              <span role="columnheader">Action</span>
            </div>
            <ol className="tosv3-risk__blockers">
              {data.blockers.map((blocker) => {
                const state = inferRuleState(blocker, data);
                return (
                  <li key={blocker} className={`tosv3-risk-rule ${statusClass(state)}`} role="row">
                    <span className={cellClass("tosv3-risk-rule__text", "rule")} role="cell">
                      {blocker}
                    </span>
                    <span
                      className={cellClass("tosv3-risk-rule__status", "status")}
                      role="cell"
                      title={statusTitle(state)}
                    >
                      <i aria-hidden>{statusIcon(state)}</i>
                      {statusLabel(state)}
                    </span>
                    <span className={cellClass("tabular-nums", "severity")} role="cell">
                      {severityLabel(state)}
                    </span>
                    <span className={cellClass("", "action")} role="cell">
                      {actionLabel(state)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      ) : null}
    </section>
  );
}
