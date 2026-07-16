import { Suspense } from "react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShellNavMobile } from "@/components/app-shell-nav";
import { AppShellSidebar } from "@/components/app-shell-sidebar";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { LogoutButton } from "@/components/logout-button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { FocusMainOnRouteChange } from "@/components/focus-main-on-route-change";
import "./dashboard-shell.css";

/** Session check is a Request-time API (cookies()) — isolated in its own component (and
 *  the header that needs `session.email`) so the static sidebar can render immediately. */
async function DashboardShellBody({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="app-shell-body">
      <header className="app-shell-header">
        <div className="app-shell-header-inner">
          <div className="app-shell-header__lead">
            <Link href="/dashboard" className="app-shell-brand" aria-label="TradeLog — Dashboard">
              <svg
                className="app-shell-brand__mark"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              TradeLog
            </Link>
          </div>

          <div className="app-shell-header__actions">
            <span className="app-shell-user hidden sm:block">{session.email}</span>
            <LogoutButton />
          </div>
        </div>

        <AppBreadcrumbs />
      </header>

      <AppShellNavMobile />

      <FocusMainOnRouteChange targetId="main-content" />
      <main id="main-content" tabIndex={-1} className="app-shell-main command-deck-shell__main">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell command-deck-shell">
      <a href="#main-content" className="app-shell-skip">
        Skip to content
      </a>
      <Suspense fallback={<LoadingSkeleton height="100vh" aria-label="Loading" />}>
        <AppShellSidebar />
        <DashboardShellBody>{children}</DashboardShellBody>
      </Suspense>
    </div>
  );
}
