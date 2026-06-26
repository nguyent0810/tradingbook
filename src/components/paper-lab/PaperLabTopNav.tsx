"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import "./paper-lab-command-center.css";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/paper-lab", label: "Arena" },
  { href: "/paper-lab/battles", label: "Battles" },
  { href: "/paper-lab/timeline", label: "Timeline" },
  { href: "/paper-lab/hof", label: "Hall of Fame" },
  { href: "/paper-lab/experiments", label: "Experiments" },
  { href: "/paper-lab/human", label: "Human PM" },
  { href: "/paper-lab/ops", label: "Ops" },
] as const;

export function PaperLabTopNav({
  userEmail,
  executionLabel,
}: {
  userEmail: string;
  executionLabel: string;
}) {
  const pathname = usePathname();

  return (
    <header className="paper-lab-top-nav" data-testid="paper-lab-top-nav">
      <nav className="paper-lab-top-nav__links" aria-label="Lab navigation">
        {LINKS.map(({ href, label }) => {
          const active =
            pathname === href || (href !== "/paper-lab" && href.startsWith("/paper-lab") && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`paper-lab-top-nav__link ${active ? "paper-lab-top-nav__link--active" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="paper-lab-top-nav__right">
        <span className="paper-lab-top-nav__badge" data-testid="paper-lab-execution-mode">
          {executionLabel}
        </span>
        <span className="paper-lab-top-nav__user" title={userEmail}>
          {userEmail}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
