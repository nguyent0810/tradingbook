import Link from "next/link";
import type { ActionableDiagnosticsDto } from "@/lib/dashboard/decision-cockpit-dto";
import { formatBlockerSeverity } from "@/lib/dashboard/decision-cockpit-dto";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardActionableBlockersProps = {
  diagnostics: ActionableDiagnosticsDto;
  compact?: boolean;
};

export function DashboardActionableBlockers({
  diagnostics,
  compact = false,
}: DashboardActionableBlockersProps) {
  const { blockers, emptyReason } = diagnostics;

  return (
    <section
      className={`dash-panel dash-surface-1${compact ? " dash-blockers--compact" : ""}`}
      data-testid="dashboard-diagnostics-panel"
      aria-labelledby="dashboard-actionable-blockers-heading"
    >
      <header className="dash-panel__header">
        <h2
          id="dashboard-actionable-blockers-heading"
          className={`dash-section-title${compact ? " dash-section-title--muted" : ""}`}
        >
          Rào cản cần xử lý
        </h2>
        {!compact ? (
          <p className="dash-panel__subtitle">
            Các điều kiện hàng đầu đang chặn lệnh swing mới — chi tiết đầy đủ tại Thiết lập
          </p>
        ) : null}
      </header>

      {blockers.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="Không có rào cản cần xử lý"
            reason={emptyReason ?? "Không có tóm tắt lý do bị loại cho lần quét này."}
            data-testid="dashboard-diagnostics-empty"
          >
            <Link href="/setups" className="btn btn-secondary text-xs">
              Thiết lập
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : (
        <ul
          className={`dash-actionable-blockers${compact ? " dash-actionable-blockers--compact" : ""}`}
          data-testid="dashboard-diagnostics-stack"
        >
          {blockers.map((b) => (
            <li
              key={`${b.severity}-${b.title}`}
              className={`dash-actionable-blockers__item dash-actionable-blockers__item--${b.severity}${compact ? " dash-actionable-blockers__item--compact" : ""}`}
              data-testid="dashboard-actionable-blocker"
            >
              {compact ? (
                <details className="dash-blocker-details">
                  <summary className="dash-blocker-details__summary">
                    <span
                      className={`dash-blocker-details__strip dash-blocker-details__strip--${b.severity}`}
                      aria-hidden
                    />
                    <span className="dash-blocker-details__severity">
                      {formatBlockerSeverity(b.severity)}
                    </span>
                    <span className="dash-blocker-details__title">{b.title}</span>
                    {b.count > 0 ? (
                      <span className="dash-blocker-details__count tabular-nums">{b.count}</span>
                    ) : null}
                  </summary>
                  <div className="dash-blocker-details__body">
                    <p>{b.meaning}</p>
                    <p className="text-xs">
                      <span className="font-medium">Tiếp theo:</span> {b.waitFor}
                    </p>
                    {b.sampleSymbols.length > 0 ? (
                      <p className="font-mono text-xs">Ví dụ: {b.sampleSymbols.join(", ")}</p>
                    ) : null}
                  </div>
                </details>
              ) : (
                <>
                  <div className="dash-actionable-blockers__head">
                    <span className="dash-actionable-blockers__severity">
                      {formatBlockerSeverity(b.severity)}
                    </span>
                    <span className="dash-actionable-blockers__title">{b.title}</span>
                    {b.count > 0 ? (
                      <span className="dash-actionable-blockers__count tabular-nums">{b.count}</span>
                    ) : null}
                  </div>
                  <p className="dash-actionable-blockers__meaning">{b.meaning}</p>
                  <p className="dash-actionable-blockers__wait">
                    <span className="font-medium">Tiếp theo:</span> {b.waitFor}
                  </p>
                  {b.sampleSymbols.length > 0 ? (
                    <p className="dash-actionable-blockers__symbols">
                      Ví dụ: {b.sampleSymbols.join(", ")}
                    </p>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="dash-actionable-blockers__footer">
        <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          Xem toàn bộ chẩn đoán tại Thiết lập →
        </Link>
      </p>
    </section>
  );
}
