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
      label: "Đã quét vũ trụ mã",
      value: latestScan.symbolCountTotal,
      hint: "mã trong lần quét",
      tone: "neutral",
      active: latestScan.symbolCountTotal > 0,
    },
    {
      id: "regime",
      label: "Bộ lọc chế độ",
      value: gate1Label,
      hint: `còn ${latestScan.symbolCountScanned}`,
      tone: regimeTone(gate1Label),
      active: latestScan.symbolCountScanned > 0,
    },
    {
      id: "tradability",
      label: "Đủ điều kiện GD",
      value: latestScan.symbolCountAfterTradability,
      hint: "sau lọc thanh khoản",
      tone: "neutral",
      active: latestScan.symbolCountAfterTradability > 0,
    },
    {
      id: "surfaced",
      label: "Đã lọc ra",
      value: latestScan.candidateCountSurfaced,
      hint: "Hạng A/B",
      tone: latestScan.candidateCountSurfaced > 0 ? "success" : "neutral",
      active: latestScan.candidateCountSurfaced > 0,
    },
  ];

  if (nearMissCount > 0) {
    stages.push({
      id: "near-miss",
      label: "Suýt đạt",
      value: nearMissCount,
      hint: "gần đạt chuẩn nhất",
      tone: "warning",
      active: true,
    });
  }

  return stages;
}
