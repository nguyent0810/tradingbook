"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./paper-lab-command-center.css";

/**
 * Arena section index — a light in-page outline (not an app sidebar). Renders as
 * a slim sticky pill row inside the Arena page. Jumps to a zone (smooth scroll)
 * and scroll-spies the active zone; from a deep link it carries ?focus=.
 */
const SECTIONS = [
  { id: "arena-now", focus: "now", label: "Now" },
  { id: "arena-consensus", focus: "consensus", label: "Consensus" },
  { id: "arena-conflict", focus: "conflict", label: "Conflict" },
  { id: "arena-decision", focus: "decision", label: "Decision" },
  { id: "arena-learning", focus: "learning", label: "Learning" },
] as const;

export function PaperLabSidebar() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  return (
    <nav className="arena-index" data-testid="paper-lab-sidebar" aria-label="Arena sections">
      <span className="arena-index__eyebrow">Report</span>
      <ol className="arena-index__list">
        {SECTIONS.map((s, i) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <Link
                href={`/paper-lab?focus=${s.focus}`}
                scroll={false}
                onClick={(e) => handleClick(e, s.id)}
                className={`arena-index__link${isActive ? " arena-index__link--active" : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="arena-index__num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
