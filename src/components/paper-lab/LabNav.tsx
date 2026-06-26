"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./paper-lab-workstation.css";

const LINKS = [
  { href: "/paper-lab", label: "Arena" },
  { href: "/paper-lab/battles", label: "Battles" },
  { href: "/paper-lab/timeline", label: "Timeline" },
  { href: "/paper-lab/hof", label: "Hall of Fame" },
  { href: "/paper-lab/experiments", label: "Experiments" },
  { href: "/paper-lab/human", label: "Human PM" },
  { href: "/paper-lab/ops", label: "Ops" },
] as const;

export function LabNav() {
  const pathname = usePathname();

  return (
    <nav className="paper-lab-nav mb-4" data-testid="paper-lab-nav">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || (href !== "/paper-lab" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`paper-lab-nav-link ${active ? "paper-lab-nav-link--active" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
