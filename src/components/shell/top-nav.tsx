"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "./app-logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/setups", label: "Setups" },
  { href: "/trades", label: "Trades" },
] as const;

export type TopNavProps = {
  userEmail?: string;
  trailing?: ReactNode;
};

export function TopNav({ userEmail, trailing }: TopNavProps) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-overlay)",
      }}
    >
      <div
        className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6"
        style={{ maxWidth: "var(--app-max-width)" }}
      >
        <div className="flex items-center gap-6 sm:gap-8">
          <AppLogo />
          <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? "nav-link-active" : ""}`}
                  style={{ color: active ? undefined : "var(--text-secondary)" }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {userEmail ? (
            <span className="hidden max-w-[180px] truncate text-sm sm:block" style={{ color: "var(--text-tertiary)" }}>
              {userEmail}
            </span>
          ) : null}
          {trailing}
        </div>
      </div>
    </header>
  );
}
