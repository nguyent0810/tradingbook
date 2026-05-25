"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/setups", label: "Setups" },
  { href: "/trades", label: "Trades" },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function desktopLinkClass(active: boolean): string {
  return active
    ? "app-shell-nav-link app-shell-nav-link--active"
    : "app-shell-nav-link";
}

function mobileLinkClass(active: boolean): string {
  return active
    ? "app-shell-mobile-nav-link app-shell-mobile-nav-link--active"
    : "app-shell-mobile-nav-link";
}

function NavLinks({
  mobile,
  pathname,
}: {
  mobile: boolean;
  pathname: string;
}) {
  return (
    <>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={mobile ? mobileLinkClass(active) : desktopLinkClass(active)}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

/** Desktop nav — render inside `app-shell-header-inner`. */
export function AppShellNavDesktop() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="app-shell-nav" aria-label="Main">
      <NavLinks mobile={false} pathname={pathname} />
    </nav>
  );
}

/** Mobile nav — render between header and main. */
export function AppShellNavMobile() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="app-shell-mobile-nav" aria-label="Main mobile">
      <NavLinks mobile pathname={pathname} />
    </nav>
  );
}
