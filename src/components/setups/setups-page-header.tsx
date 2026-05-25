import Link from "next/link";

export function SetupsPageHeader() {
  return (
    <div className="tos-page-header setups-page-header">
      <div>
        <h1 className="tos-page-header__title setups-page-header__title">Setups pipeline</h1>
        <p className="tos-page-header__subtitle setups-page-header__subtitle">
          EOD scanner — surfaced candidates, near-miss context, and rejection diagnostics.
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
