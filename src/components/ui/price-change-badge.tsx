import { priceColor, type PriceDirection } from "@/lib/design-tokens";

export type PriceChangeBadgeProps = {
  value: string;
  direction: PriceDirection;
  className?: string;
};

export function PriceChangeBadge({
  value,
  direction,
  className = "",
}: PriceChangeBadgeProps) {
  const prefix = direction === "up" ? "+" : direction === "down" ? "" : "";
  return (
    <span
      className={`badge font-mono text-xs tabular-nums ${className}`.trim()}
      style={{
        background:
          direction === "up"
            ? "var(--success-muted)"
            : direction === "down"
              ? "var(--danger-muted)"
              : "var(--bg-tertiary)",
        color: priceColor(direction),
      }}
    >
      {prefix}
      {value}
    </span>
  );
}
