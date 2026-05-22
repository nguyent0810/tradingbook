"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/setups", label: "Setups" },
  { href: "/trades", label: "Trades" },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="grid grid-cols-3 border-t sm:hidden"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
      aria-label="Mobile"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2 py-3 text-center text-xs font-medium transition-colors ${active ? "nav-link-active" : ""}`}
            style={{ color: active ? undefined : "var(--text-secondary)" }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
