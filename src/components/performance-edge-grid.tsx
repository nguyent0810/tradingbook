import { formatVND } from "@/lib/formatters";

export type PerformanceEdgeGridProps = {
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  averageWinner: number;
  averageLoser: number;
  largestWinner: number;
  largestLoser: number;
};

export function PerformanceEdgeGrid({
  expectancy,
  profitFactor,
  maxDrawdown,
  averageWinner,
  averageLoser,
  largestWinner,
  largestLoser,
}: PerformanceEdgeGridProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        Performance Edge
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Expectancy
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(expectancy, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Profit Factor
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {profitFactor > 0 ? profitFactor : "—"}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Max Drawdown
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
            {formatVND(maxDrawdown, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Avg Winner
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(averageWinner, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Avg Loser
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
            {formatVND(-averageLoser, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Largest Win
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(largestWinner, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Largest Loss
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
            {formatVND(largestLoser, true)}
          </div>
        </div>
      </div>
    </div>
  );
}
