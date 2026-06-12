import Link from "next/link";
import type { V3HeaderCta } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  cta: V3HeaderCta;
};

export function DashboardPageHeader({ cta }: Props) {
  const showSecondary =
    Boolean(cta.secondaryHref && cta.secondaryLabel) &&
    (cta.secondaryHref !== cta.primaryHref || cta.secondaryLabel !== cta.primaryLabel);

  return (
    <header className="dash-v2-page-header command-deck-page-header" data-testid="dashboard-page-header">
      <div className="dash-v2-page-header__copy">
        <p className="dash-v2-eyebrow dash-v2-eyebrow--accent">Command deck</p>
        <h1 className="dash-v2-page-header__title">Today&apos;s decision</h1>
        <p className="dash-v2-page-header__lead">{cta.lead}</p>
      </div>
      <div className="dash-v2-page-header__actions">
        <Link
          href={cta.primaryHref}
          className="btn btn-primary btn-sm dash-v2-btn-primary"
          data-testid="dashboard-header-primary-cta"
        >
          {cta.primaryLabel === "Log trade" ? (
            <>
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
              {cta.primaryLabel}
            </>
          ) : (
            cta.primaryLabel
          )}
        </Link>
        {showSecondary && cta.secondaryHref && cta.secondaryLabel ? (
          <Link
            href={cta.secondaryHref}
            className="btn btn-secondary btn-sm dash-v2-btn-secondary"
            data-testid="dashboard-header-secondary-cta"
          >
            {cta.secondaryLabel}
          </Link>
        ) : null}
        {cta.tertiaryHref && cta.tertiaryLabel ? (
          <Link
            href={cta.tertiaryHref}
            className="text-xs text-slate-500 hover:text-slate-300 self-center ml-1"
            data-testid="dashboard-header-tertiary-cta"
          >
            {cta.tertiaryLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
