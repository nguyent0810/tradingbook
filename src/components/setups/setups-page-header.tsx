import Link from "next/link";

export function SetupsPageHeader() {
  return (
    <header
      className="dash-v2-page-header command-deck-page-header pipeline-deck-page-header"
      data-testid="setups-page-header"
    >
      <div className="dash-v2-page-header__copy">
        <p className="dash-v2-eyebrow dash-v2-eyebrow--accent">Pipeline deck</p>
        <h1 className="dash-v2-page-header__title">Setups pipeline</h1>
        <p className="dash-v2-page-header__lead">
          EOD scanner funnel — surfaced candidates, near-miss queue, and rejection diagnostics from the latest run.
        </p>
      </div>
      <div className="dash-v2-page-header__actions">
        <Link href="/dashboard" className="btn btn-secondary btn-sm dash-v2-btn-secondary">
          Command deck
        </Link>
      </div>
    </header>
  );
}
