"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./paper-lab-command-center.css";

const NAV = [
  { href: "/paper-lab", label: "Arena", icon: "AR" },
  { href: "/paper-lab/battles", label: "Battles", icon: "BT" },
  { href: "/paper-lab/timeline", label: "Timeline", icon: "TL" },
  { href: "/paper-lab/hof", label: "Hall of Fame", icon: "HF" },
  { href: "/paper-lab/experiments", label: "Experiments", icon: "EX" },
  { href: "/paper-lab/human", label: "Human PM", icon: "PM" },
  { href: "/paper-lab/ops", label: "Ops", icon: "OP" },
] as const;

const HELPERS = [
  { n: "1", title: "Agent Portfolios", text: "Mini-cards · click (i) for drawer" },
  { n: "2", title: "Reasoning", text: "View details for full agent logic" },
  { n: "3", title: "Battle Replay", text: "Per-agent vote breakdown" },
  { n: "4", title: "Open Positions", text: "Board lots · status pills" },
  { n: "5", title: "CIO Explanation", text: "Consensus + dissent summary" },
];

export function PaperLabSidebar() {
  const pathname = usePathname();

  return (
    <aside className="paper-lab-sidebar" data-testid="paper-lab-sidebar">
      <Link href="/paper-lab" className="paper-lab-sidebar__brand">
        <span className="paper-lab-sidebar__logo">TradeLog</span>
        <span className="paper-lab-sidebar__kicker">AI Investment Lab</span>
      </Link>

      <nav className="paper-lab-sidebar__nav" aria-label="Paper Lab">
        {NAV.map(({ href, label, icon }) => {
          const active =
            pathname === href || (href !== "/paper-lab" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`paper-lab-sidebar__link ${active ? "paper-lab-sidebar__link--active" : ""}`}
              title={label}
            >
              <span className="paper-lab-sidebar__icon">{icon}</span>
              <span className="paper-lab-sidebar__label">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="paper-lab-sidebar__helpers">
        {HELPERS.map((h) => (
          <div key={h.n} className="paper-lab-sidebar__helper">
            <strong>{h.n}. {h.title}</strong>
            {h.text}
          </div>
        ))}
        <div className="paper-lab-sidebar__helper">
          <strong>Status colors</strong>
          OPEN · PARTIAL · CLOSED TP/SL
        </div>
      </div>
    </aside>
  );
}
