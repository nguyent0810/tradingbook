import { EquityCurveChart } from "@/components/equity-curve-chart";
import type { EquityDataPoint } from "@/lib/analytics";

export type EquityPanelProps = {
  data: EquityDataPoint[];
  className?: string;
};

export function EquityPanel({ data, className = "" }: EquityPanelProps) {
  return (
    <div
      className={`flex min-h-0 flex-col gap-3 lg:min-h-[350px] ${className}`.trim()}
    >
      <div>
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Equity Curve
        </h2>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          Cumulative progression of closed realized P&L.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <EquityCurveChart data={data} />
      </div>
    </div>
  );
}
