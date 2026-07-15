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

/** Mobile primary nav — rendered between the header and main content (<768px). Desktop primary nav lives in `AppShellSidebar`. */
export function AppShellNavMobile() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="app-shell-mobile-nav" aria-label="Primary mobile">
      {NAV_ITEMS.map(({ href, label, deck }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "app-shell-mobile-nav-link app-shell-mobile-nav-link--active" : "app-shell-mobile-nav-link"}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-shell-nav-link__label">{label}</span>
            <span className="app-shell-nav-link__deck">{deck}</span>
          </Link>
        );
      })}
    </nav>
  );
}
