"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import "./paper-lab-command-center.css";

const PAGE_LABELS: Record<string, string> = {
  "/paper-lab": "Arena",
  "/paper-lab/battles": "Battles",
  "/paper-lab/timeline": "Timeline",
  "/paper-lab/hof": "Hall of Fame",
  "/paper-lab/experiments": "Experiments",
  "/paper-lab/human": "Human PM",
  "/paper-lab/ops": "Ops",
};

function resolvePageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  if (pathname.startsWith("/paper-lab/battles/")) return "Battle Detail";
  if (pathname.startsWith("/paper-lab/timeline/")) return "Session Theatre";
  if (pathname.startsWith("/paper-lab/agents/")) return "Agent Profile";
  return "Paper Lab";
}

export function PaperLabTopNav({
  userEmail,
  executionLabel,
}: {
  userEmail: string;
  executionLabel: string;
}) {
  const pathname = usePathname();
  const pageLabel = resolvePageLabel(pathname);

  return (
    <header className="paper-lab-utility-bar" data-testid="paper-lab-top-nav">
      <div className="paper-lab-utility-bar__left">
        <Link
          href="/dashboard"
          className="paper-lab-utility-bar__back"
          aria-label="Back to Dashboard"
          title="Back to Dashboard"
          data-testid="paper-lab-back-dashboard"
        >
          <LayoutGrid size={15} strokeWidth={2} aria-hidden />
        </Link>
        <span className="paper-lab-utility-bar__crumb">AI Investment Lab</span>
        <span className="paper-lab-utility-bar__sep" aria-hidden>
          /
        </span>
        <span className="paper-lab-utility-bar__page">{pageLabel}</span>
      </div>

      <div className="paper-lab-utility-bar__right">
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
