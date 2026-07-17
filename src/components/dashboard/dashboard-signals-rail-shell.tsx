"use client";

import { useState, type ReactNode } from "react";

export type DashboardSignalsRailShellProps = {
  children: ReactNode;
};

const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 6 9 12 15 18" />
  </svg>
);

/**
 * Thin client boundary owning only the collapse/expand toggle (mirrors
 * AppShellSidebar's own mechanics). Row content is passed as children so it
 * stays server-rendered — DashboardSetupQualityLadder et al. pull in
 * Prisma-adjacent types that must never enter the client bundle.
 */
export function DashboardSignalsRailShell({ children }: DashboardSignalsRailShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`dash-signals-rail${collapsed ? " dash-signals-rail--collapsed" : ""}`}
      aria-label="Signals"
      data-testid="dashboard-signals-rail"
    >
      <div className="dash-signals-rail__head">
        <span className="dash-signals-rail__head-label">Signals</span>
        <button
          type="button"
          className="dash-signals-rail__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand signals rail" : "Collapse signals rail"}
        >
          <span
            className={
              collapsed
                ? "dash-signals-rail__toggle-icon dash-signals-rail__toggle-icon--collapsed"
                : "dash-signals-rail__toggle-icon"
            }
          >
            <IconChevron />
          </span>
        </button>
      </div>

      <div className="dash-signals-rail__body">{children}</div>
    </aside>
  );
}
