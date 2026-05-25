import Link from "next/link";

export function SetupsPageHeader() {
  return (
    <div className="setups-page-header">
      <div>
        <h1 className="setups-page-header__title">Setups</h1>
        <p className="setups-page-header__subtitle">
          Breakout-pullback pipeline — surfaced candidates, diagnostics, and near-miss symbols.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-[var(--accent-text)] hover:underline shrink-0"
      >
        ← Dashboard
      </Link>
    </div>
  );
}
