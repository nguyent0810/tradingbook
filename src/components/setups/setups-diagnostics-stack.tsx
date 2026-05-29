import { DiagnosticsReasonStack } from "@/components/command-deck/diagnostics-reason-stack";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type SetupsDiagnosticsStackProps = {
  rejectionBuckets: Array<[string, number]>;
  scanNotes: DailyScanGate2Notes | null;
  latestScan: LatestScanWithCandidates | null;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
};

export function SetupsDiagnosticsStack({
  title = "Rejection diagnostics",
  subtitle = "Gate 2 — why setups fell short",
  embedded = false,
  ...props
}: SetupsDiagnosticsStackProps) {
  return (
    <DiagnosticsReasonStack
      {...props}
      title={title}
      subtitle={subtitle}
      embedded={embedded}
      testIdPanel="setups-diagnostics-panel"
      testIdEmpty="setups-diagnostics-empty"
      testIdStack="setups-diagnostics-stack"
    />
  );
}
