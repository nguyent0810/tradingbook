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
    <div className="flex flex-1 flex-col">
      {/* Top Navigation */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--border-primary)",
          background: "rgba(9, 9, 11, 0.8)",
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              TradeLog
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/trades">Trades</NavLink>
            </nav>
          </div>

          {/* Right: User + Logout */}
          <div className="flex items-center gap-3">
            <span
              className="hidden text-sm sm:block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {session.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav
        className="flex border-b sm:hidden"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <NavLink href="/dashboard" mobile>
          Dashboard
        </NavLink>
        <NavLink href="/trades" mobile>
          Trades
        </NavLink>
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>
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
      <Link
        href={href}
        className="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </Link>
  );
}
