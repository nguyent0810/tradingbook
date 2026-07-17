import Link from "next/link";
import type { TomorrowPlanDto } from "@/lib/dashboard/decision-cockpit-dto";

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
            What next
          </h2>
          <p className="dash-card__lead">
            Watch · trigger · avoid · posture for the next session
          </p>
        </header>

        <dl className="dash-tomorrow__grid dash-tomorrow__grid--promoted">
          <div data-testid="dashboard-tomorrow-watch">
            <dt>Watch</dt>
            <dd>
              {symbols.length > 0 ? (
                <span className="dash-tomorrow__symbols font-mono">{symbols.join(", ")}</span>
              ) : (
                <span className="dash-tomorrow__note">{watchNote}</span>
              )}
            </dd>
          </div>
          <div data-testid="dashboard-tomorrow-trigger">
            <dt>Trigger</dt>
            <dd className="dash-tomorrow__line-clamp" title={tomorrow.triggerLine.value}>
              {tomorrow.triggerLine.value}
            </dd>
          </div>
          <div data-testid="dashboard-tomorrow-avoid">
            <dt>Avoid</dt>
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
          <p className="dash-v2-eyebrow">Plan</p>
          <h2 id="dashboard-tomorrow-heading" className="dash-v2-zone-title">
            Tomorrow&rsquo;s plan
          </h2>
          <p className="dash-v2-zone-lead">Watch, triggers, and avoid rules for the next session.</p>
        </div>
      </header>

      <div className="dash-tomorrow__body dash-v2-zone__body dash-card">
        <div className="dash-tomorrow-blocks">
          <div className="dash-tomorrow-block dash-tomorrow-block--wide dash-tomorrow-block--watch">
            <p className="dash-tomorrow-block__label">
              Watch{symbols.length > 0 ? " — hover a symbol for its reason" : ""}
            </p>
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
              <p className="dash-tomorrow-block__body" data-testid="dashboard-tomorrow-watch">
                {watchNote}
              </p>
            )}
          </div>

          <div className="dash-tomorrow-block dash-tomorrow-block--trigger" data-testid="dashboard-tomorrow-trigger">
            <p className="dash-tomorrow-block__label">Trigger</p>
            <p className="dash-tomorrow-block__body">{tomorrow.triggerLine.value}</p>
          </div>

          <div className="dash-tomorrow-block dash-tomorrow-block--avoid" data-testid="dashboard-tomorrow-avoid">
            <p className="dash-tomorrow-block__label">Avoid</p>
            <p className="dash-tomorrow-block__body">{tomorrow.avoidLine.value}</p>
          </div>
        </div>

        {symbols.length === 0 ? (
          <p className="dash-tomorrow__link">
            <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
              Review /setups for pipeline context →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
