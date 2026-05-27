import Link from "next/link";

export function DashboardPageHeader() {
  return (
    <header className="dash-v2-page-header" data-testid="dashboard-page-header">
      <div className="dash-v2-page-header__copy">
        <p className="dash-v2-eyebrow">Trading command center</p>
        <h1 className="dash-v2-page-header__title">Today&apos;s decision cockpit</h1>
        <p className="dash-v2-page-header__lead">
          Stance, exposure, and setups from the latest production scan — scan in five seconds,
          act with confidence.
        </p>
      </div>
      <div className="dash-v2-page-header__actions">
        <Link href="/setups" className="btn btn-secondary dash-v2-btn-secondary">
          Open pipeline
        </Link>
        <Link href="/trades/new" className="btn btn-primary dash-v2-btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Log trade
        </Link>
      </div>
    </header>
  );
}
