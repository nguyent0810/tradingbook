import type { ReactNode } from "react";
import { PaperLabSidebar } from "./PaperLabSidebar";
import { PaperLabTopNav } from "./PaperLabTopNav";
import "./paper-lab-command-center.css";

export function PaperLabCommandShell({
  children,
  userEmail,
  executionLabel,
}: {
  children: ReactNode;
  userEmail: string;
  executionLabel: string;
}) {
  return (
    <div className="paper-lab-command-root" data-testid="paper-lab-command-shell">
      <div className="paper-lab-command-layout">
        <PaperLabSidebar />
        <div className="paper-lab-main">
          <PaperLabTopNav userEmail={userEmail} executionLabel={executionLabel} />
          {children}
        </div>
      </div>
    </div>
  );
}
