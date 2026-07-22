import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type SetupsFunnelCompactProps = {
  latestScan: LatestScanWithCandidates;
  nearMissCount: number;
};

export function SetupsFunnelCompact({ latestScan, nearMissCount }: SetupsFunnelCompactProps) {
  const gate1Label = displayGate1ScanLevel(String(latestScan.gate1Level));

  const steps = [
    { label: "Vũ trụ", value: latestScan.symbolCountTotal, hint: "đã quét" },
    { label: "Chế độ", value: latestScan.symbolCountScanned, hint: gate1Label },
    { label: "Đủ ĐK GD", value: latestScan.symbolCountAfterTradability, hint: "đạt" },
    { label: "Đã lọc ra", value: latestScan.candidateCountSurfaced, hint: "Hạng A/B" },
    { label: "Suýt đạt", value: nearMissCount, hint: "hàng chờ" },
  ];

  return (
    <div className="tosv3-setups-funnel-compact" data-testid="setups-pipeline-funnel">
      <p className="tosv3-setups-funnel-compact__intro">
        Số mã còn lại sau mỗi giai đoạn — không phải số lượng bị loại.
      </p>
      <ul className="tosv3-setups-funnel-compact__steps">
        {steps.map((step) => (
          <li key={step.label} className="tosv3-setups-funnel-compact__step">
            <span className="tosv3-setups-funnel-compact__label">{step.label}</span>
            <span className="tosv3-setups-funnel-compact__value tabular-nums">{step.value}</span>
            <span className="tosv3-setups-funnel-compact__hint">{step.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
