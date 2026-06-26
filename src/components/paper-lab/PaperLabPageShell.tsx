import type { ReactNode } from "react";
import { V3PageShell } from "@/components/trading-os-v3/layout/v3-page-shell";
import { V3PageHeader } from "@/components/trading-os-v3/shared/v3-page-header";
import { LabNav } from "@/components/paper-lab/LabNav";

export function PaperLabPageShell({ children }: { children: ReactNode }) {
  return (
    <V3PageShell pageClassName="tosv3-paper-lab-page" testId="paper-lab-page-shell">
      <V3PageHeader
        kicker="AI Investment Lab"
        title="Paper Trading Arena"
        lead="Virtual agent competition · regime intelligence · research only"
      />
      <LabNav />
      {children}
    </V3PageShell>
  );
}
