import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShellNavDesktop, AppShellNavMobile } from "@/components/app-shell-nav";
import { LogoutButton } from "@/components/logout-button";

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
      <header className="app-shell-header">
        <div className="app-shell-header-inner">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="app-shell-brand">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              TradeLog
            </Link>

            <AppShellNavDesktop />
          </div>

          <div className="flex items-center gap-3">
            <span className="app-shell-user hidden sm:block">{session.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <AppShellNavMobile />

      <main className="app-shell-main command-deck-shell__main">{children}</main>
    </div>
  );
}
