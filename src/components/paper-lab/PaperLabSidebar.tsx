"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

const GUIDE_ITEMS = [
  { title: "Agent Funds", text: "Virtual NAV and PnL per portfolio manager." },
  { title: "Decision Logic", text: "Agent reasoning and validation audit trail." },
  { title: "Battle Outcomes", text: "Symbol-level agent votes and consensus." },
  { title: "Position Status", text: "Open paper positions with risk metrics." },
  { title: "Risk Colors", text: "Status pills reflect position lifecycle." },
] as const;

export function PaperLabSidebar() {
  const pathname = usePathname();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1367px)");
    setGuideOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setGuideOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
        onClick={() => setGuideOpen((v) => !v)}
        aria-expanded={guideOpen}
      >
        <span>Lab Guide</span>
        <span aria-hidden>{guideOpen ? "−" : "+"}</span>
      </button>

      {guideOpen && (
        <div className="paper-lab-sidebar__guide-body">
          {GUIDE_ITEMS.map((item) => (
            <div key={item.title} className="paper-lab-sidebar__guide-item">
              <strong>{item.title}</strong>
              {item.text}
            </div>
          ))}
          <div className="paper-lab-sidebar__legend paper-lab-panel--muted">
            <div className="paper-lab-sidebar__legend-title">Status Legend</div>
            <div className="paper-lab-sidebar__legend-pills">
              <StatusPill status="OPEN" />
              <StatusPill status="PARTIAL" />
              <StatusPill status="CLOSED_TP" />
              <StatusPill status="CLOSED_SL" />
              <StatusPill status="EXPIRED" />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
