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
        <div className="card p-3 relative group cursor-help transition-all hover:border-[#6366f1]/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1">
            Expectancy
            <span className="text-[10px] text-[#71717a] opacity-60">ⓘ</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(expectancy, true)}
          </div>
          {/* Tooltip */}
          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#121215] border border-[#1f1f23] rounded-lg shadow-xl text-[11px] leading-relaxed text-[#a1a1aa] font-normal opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0">
            <strong className="text-white block mb-1 font-semibold">System Expectancy (Kỳ vọng)</strong>
            Average net value generated per trade. A positive expectancy confirms a valid mathematical edge.
            <span className="text-[#10b981] block mt-1.5 font-medium">💡 EOD Action: Continue execution if &gt;0. If negative, halt risk and audit setup criteria.</span>
          </div>
        </div>

        <div className="card p-3 relative group cursor-help transition-all hover:border-[#6366f1]/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1">
            Profit Factor
            <span className="text-[10px] text-[#71717a] opacity-60">ⓘ</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {profitFactor > 0 ? profitFactor : "—"}
          </div>
          {/* Tooltip */}
          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#121215] border border-[#1f1f23] rounded-lg shadow-xl text-[11px] leading-relaxed text-[#a1a1aa] font-normal opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0">
            <strong className="text-white block mb-1 font-semibold">Profit Factor (Hệ số LN)</strong>
            Ratio of gross profits to gross losses. Healthy systems target &gt; 1.5.
            <span className="text-[#6366f1] block mt-1.5 font-medium">📈 EOD Action: Target &gt; 1.5. If below 1.0, audit exits to cut losses faster.</span>
          </div>
        </div>

        <div className="card p-3 relative group cursor-help transition-all hover:border-[#6366f1]/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1">
            Max Drawdown
            <span className="text-[10px] text-[#71717a] opacity-60">ⓘ</span>
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
            {formatVND(maxDrawdown, true)}
          </div>
          {/* Tooltip */}
          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#121215] border border-[#1f1f23] rounded-lg shadow-xl text-[11px] leading-relaxed text-[#a1a1aa] font-normal opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0">
            <strong className="text-white block mb-1 font-semibold">Max Drawdown (Sụt giảm tối đa)</strong>
            The largest peak-to-trough drop in equity from the historical high watermark.
            <span className="text-[#f87171] block mt-1.5 font-medium">⚠️ EOD Action: If drawdown nears limit, downsize position sizes by 50% immediately.</span>
          </div>
        </div>

        <div className="card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            Avg Winner
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(averageWinner, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            Avg Loser
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
            {formatVND(-averageLoser, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            Largest Win
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
            {formatVND(largestWinner, true)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
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
