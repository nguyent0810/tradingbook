import Link from "next/link";
import type { CSSProperties } from "react";
import type { TomorrowPlanDto } from "@/lib/dashboard/decision-cockpit-dto";

const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconBolt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 11 14 9 22 21 10 13 10 13 2" />
  </svg>
);
const IconSlashCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
  </svg>
);

function planCardIndexStyle(index: number): CSSProperties {
  return { "--plan-card-index": index } as CSSProperties;
}

export type DashboardTomorrowPlanProps = {
  tomorrow: TomorrowPlanDto;
  /** Promoted beside verdict in primary action row (S8) — keeps the older
   *  compact layout; the card-based watch/trigger/avoid redesign below is
   *  for the standalone (non-promoted) zone shown on Dashboard today. */
  promoted?: boolean;
};

export function DashboardTomorrowPlan({
  tomorrow,
  promoted = false,
}: DashboardTomorrowPlanProps) {
  const symbols = tomorrow.watchSymbols.value;
  const watchNote = tomorrow.watchNote.value;

  if (promoted) {
    return (
      <section
        className="dash-tomorrow dash-card dash-tomorrow--promoted"
        data-testid="dashboard-tomorrow-plan"
        aria-labelledby="dashboard-tomorrow-heading"
      >
        <header className="dash-card__header">
          <h2 id="dashboard-tomorrow-heading" className="dash-section-title">
            Tiếp theo là gì
          </h2>
          <p className="dash-card__lead">
            Theo dõi · kích hoạt · tránh · tư thế cho phiên tiếp theo
          </p>
        </header>

        <dl className="dash-tomorrow__grid dash-tomorrow__grid--promoted">
          <div data-testid="dashboard-tomorrow-watch">
            <dt>Theo dõi</dt>
            <dd>
              {symbols.length > 0 ? (
                <span className="dash-tomorrow__symbols font-mono">{symbols.join(", ")}</span>
              ) : (
                <span className="dash-tomorrow__note">{watchNote}</span>
              )}
            </dd>
          </div>
          <div data-testid="dashboard-tomorrow-trigger">
            <dt>Kích hoạt</dt>
            <dd className="dash-tomorrow__line-clamp" title={tomorrow.triggerLine.value}>
              {tomorrow.triggerLine.value}
            </dd>
          </div>
          <div data-testid="dashboard-tomorrow-avoid">
            <dt>Tránh</dt>
            <dd className="dash-tomorrow__line-clamp" title={tomorrow.avoidLine.value}>
              {tomorrow.avoidLine.value}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section
      className="dash-tomorrow dash-v2-zone dash-v2-zone--context"
      data-testid="dashboard-tomorrow-plan"
      aria-labelledby="dashboard-tomorrow-heading"
    >
      <header className="dash-v2-zone-header dash-header--numbered">
        <span className="dash-header-num" aria-hidden="true">
          02
        </span>
        <div>
          <p className="dash-v2-eyebrow">Kế hoạch</p>
          <h2 id="dashboard-tomorrow-heading" className="dash-v2-zone-title">
            Kế hoạch ngày mai
          </h2>
          <p className="dash-v2-zone-lead">Theo dõi, kích hoạt, và quy tắc tránh cho phiên tiếp theo.</p>
        </div>
      </header>

      <div className="dash-plan-grid dash-v2-zone__body">
        <div
          className="dash-card dash-plan-card dash-plan-card--wide dash-plan-card--watch dash-card--tilt"
          style={planCardIndexStyle(0)}
        >
          <div className="dash-plan-card__head">
            <span className="dash-plan-card__icon">
              <IconEye />
            </span>
            <span className="dash-plan-card__label">
              Theo dõi{symbols.length > 0 ? " — di chuột vào mã để xem lý do" : ""}
            </span>
          </div>
          <div className="dash-plan-card__body">
            {symbols.length > 0 ? (
              <ul className="dash-tomorrow-watch-cards" data-testid="dashboard-tomorrow-watch">
                {symbols.map((symbol) => (
                  <li key={symbol} className="dash-sym-card" tabIndex={0}>
                    {symbol}
                    {tomorrow.watchReasons[symbol] ? (
                      <span className="dash-sym-card__tip">{tomorrow.watchReasons[symbol]}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="dashboard-tomorrow-watch">{watchNote}</p>
            )}
          </div>
        </div>

        <div
          className="dash-card dash-plan-card dash-plan-card--trigger dash-card--tilt dash-card--breathe"
          style={planCardIndexStyle(1)}
          data-testid="dashboard-tomorrow-trigger"
        >
          <div className="dash-plan-card__head">
            <span className="dash-plan-card__icon">
              <IconBolt />
            </span>
            <span className="dash-plan-card__label">Kích hoạt</span>
          </div>
          <div className="dash-plan-card__body">
            <p>{tomorrow.triggerLine.value}</p>
          </div>
        </div>

        <div
          className="dash-card dash-plan-card dash-plan-card--avoid dash-card--tilt"
          style={planCardIndexStyle(2)}
          data-testid="dashboard-tomorrow-avoid"
        >
          <div className="dash-plan-card__head">
            <span className="dash-plan-card__icon">
              <IconSlashCircle />
            </span>
            <span className="dash-plan-card__label">Tránh</span>
          </div>
          <div className="dash-plan-card__body">
            <p>{tomorrow.avoidLine.value}</p>
          </div>
        </div>
      </div>

      {symbols.length === 0 ? (
        <p className="dash-tomorrow__link">
          <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
            Xem /setups để hiểu bối cảnh đường ống →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
