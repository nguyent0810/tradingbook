"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", deck: "Command" },
  { href: "/setups", label: "Setups", deck: "Pipeline" },
  { href: "/paper-lab", label: "Arena", deck: "Simulation" },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  variant,
  pathname,
}: {
  variant: "desktop" | "mobile";
  pathname: string;
}) {
  const base =
    variant === "mobile" ? "app-shell-mobile-nav-link" : "app-shell-nav-link";
  return (
    <>
      {NAV_ITEMS.map(({ href, label, deck }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? `${base} ${base}--active` : base}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-shell-nav-link__label">{label}</span>
            <span className="app-shell-nav-link__deck">{deck}</span>
          </Link>
        );
      })}
    </>
  );
}

/** Desktop primary nav — semantic Command Deck link row. */
export function AppShellNavDesktop() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="app-shell-nav" aria-label="Primary">
      <NavLinks variant="desktop" pathname={pathname} />
    </nav>
  );
}

/** Mobile primary nav — rendered between the header and main content. */
export function AppShellNavMobile() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="app-shell-mobile-nav" aria-label="Primary mobile">
      <NavLinks variant="mobile" pathname={pathname} />
    </nav>
  );
}
