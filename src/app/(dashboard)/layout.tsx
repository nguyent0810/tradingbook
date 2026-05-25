import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
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
    <div className="app-shell">
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

            <nav className="app-shell-nav" aria-label="Main">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/setups">Setups</NavLink>
              <NavLink href="/trades">Trades</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="app-shell-user hidden sm:block">{session.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav className="app-shell-mobile-nav" aria-label="Main mobile">
        <NavLink href="/dashboard" mobile>
          Dashboard
        </NavLink>
        <NavLink href="/setups" mobile>
          Setups
        </NavLink>
        <NavLink href="/trades" mobile>
          Trades
        </NavLink>
      </nav>

      <main className="app-shell-main">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
  mobile,
}: {
  href: string;
  children: React.ReactNode;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <Link href={href} className="app-shell-mobile-nav-link">
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className="app-shell-nav-link">
      {children}
    </Link>
  );
}
