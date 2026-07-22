"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClayThemeRoute } from "@/lib/clay-theme-routes";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", labelVi: "Bảng điều khiển", deck: "Command", deckVi: "Sở chỉ huy" },
  { href: "/setups", label: "Setups", labelVi: "Thiết lập", deck: "Pipeline", deckVi: "Đường ống" },
  { href: "/paper-lab", label: "Arena", labelVi: "Đấu trường", deck: "Simulation", deckVi: "Mô phỏng" },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile primary nav — rendered between the header and main content (<768px). Desktop primary nav lives in `AppShellSidebar`. */
export function AppShellNavMobile() {
  const pathname = usePathname() ?? "";
  const vi = isClayThemeRoute(pathname);
  return (
    <nav className="app-shell-mobile-nav" aria-label="Primary mobile">
      {NAV_ITEMS.map(({ href, label, labelVi, deck, deckVi }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "app-shell-mobile-nav-link app-shell-mobile-nav-link--active" : "app-shell-mobile-nav-link"}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-shell-nav-link__label">{vi ? labelVi : label}</span>
            <span className="app-shell-nav-link__deck">{vi ? deckVi : deck}</span>
          </Link>
        );
      })}
    </nav>
  );
}
