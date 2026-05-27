import Link from "next/link";

export function DashboardPageHeader() {
  return (
    <div className="dashboard-page-header">
      <div>
        <h1 className="dashboard-page-header__title">Dashboard</h1>
        <p className="dashboard-page-header__subtitle">
          Today&apos;s stance, setups, and exposure — from the latest production scan.
        </p>
      </div>
      <Link
        href="/trades/new"
        className="btn btn-primary shrink-0 dash-cockpit-v11__cta"
      >
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
        Log Trade
      </Link>
    </div>
  );
}
