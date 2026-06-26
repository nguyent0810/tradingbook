"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "./ui/StatusPill";
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

export function PaperLabSidebar() {
  const pathname = usePathname();
  const [legendOpen, setLegendOpen] = useState(false);

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

      <button
        type="button"
        className="paper-lab-sidebar__guide-toggle"
        onClick={() => setLegendOpen((v) => !v)}
        aria-expanded={legendOpen}
      >
        <span>Status Legend</span>
        <span aria-hidden>{legendOpen ? "−" : "+"}</span>
      </button>

      {legendOpen && (
        <div className="paper-lab-sidebar__legend paper-lab-panel--muted">
          <div className="paper-lab-sidebar__legend-pills">
            <StatusPill status="OPEN" />
            <StatusPill status="PARTIAL" />
            <StatusPill status="CLOSED_TP" />
            <StatusPill status="CLOSED_SL" />
            <StatusPill status="EXPIRED" />
          </div>
        </div>
      )}
    </aside>
  );
}
