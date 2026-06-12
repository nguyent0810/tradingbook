import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { PipelineStage, PipelineStageTone } from "./types";

function regimeTone(gate1Label: string): PipelineStageTone {
  const lower = gate1Label.toLowerCase();
  if (lower.includes("caution") || lower.includes("warning") || lower.includes("no trade")) {
    return "warning";
  }
  if (lower.includes("pass") || lower.includes("favorable")) {
    return "success";
  }
  return "neutral";
}

export function buildPipelineStages(
  latestScan: LatestScanWithCandidates,
  nearMissCount: number,
  gate1Label: string
): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      id: "universe",
      label: "Universe scanned",
      value: latestScan.symbolCountTotal,
      hint: "symbols in run",
      tone: "neutral",
      active: latestScan.symbolCountTotal > 0,
    },
    {
      id: "regime",
      label: "Regime filter",
      value: gate1Label,
      hint: `${latestScan.symbolCountScanned} remaining`,
      tone: regimeTone(gate1Label),
      active: latestScan.symbolCountScanned > 0,
    },
    {
      id: "tradability",
      label: "Tradability",
      value: latestScan.symbolCountAfterTradability,
      hint: "after liquidity filters",
      tone: "neutral",
      active: latestScan.symbolCountAfterTradability > 0,
    },
    {
      id: "surfaced",
      label: "Surfaced",
      value: latestScan.candidateCountSurfaced,
      hint: "Tier A/B",
      tone: latestScan.candidateCountSurfaced > 0 ? "success" : "neutral",
      active: latestScan.candidateCountSurfaced > 0,
    },
  ];

  if (nearMissCount > 0) {
    stages.push({
      id: "near-miss",
      label: "Near-miss",
      value: nearMissCount,
      hint: "closest-to-valid",
      tone: "warning",
      active: true,
    });
  }

  return stages;
}
