import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShellNavMobile } from "@/components/app-shell-nav";
import { AppShellSidebar } from "@/components/app-shell-sidebar";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { LogoutButton } from "@/components/logout-button";
import "./dashboard-shell.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="app-shell command-deck-shell">
      <AppShellSidebar />

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

        <main className="app-shell-main command-deck-shell__main">{children}</main>
      </div>
    </div>
  );
}
