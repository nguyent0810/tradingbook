import type { ReactNode } from "react";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  className = "",
}: StatCardProps) {
  const valueColor =
    trend === "up"
      ? "var(--pnl-positive)"
      : trend === "down"
        ? "var(--pnl-negative)"
        : "var(--text-primary)";

  return (
    <div className={`metric-card ${className}`.trim()}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: valueColor }}>
        {value}
      </div>
      {hint ? (
        <p className="mt-2 text-xs leading-snug" style={{ color: "var(--text-tertiary)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
