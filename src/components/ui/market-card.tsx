import Link from "next/link";
import { PriceChangeBadge } from "./price-change-badge";
import type { PriceDirection } from "@/lib/design-tokens";

export type MarketCardProps = {
  symbol: string;
  name?: string;
  price: string;
  change: string;
  direction: PriceDirection;
  badge?: string;
  href?: string;
};

export function MarketCard({
  symbol,
  name,
  price,
  change,
  direction,
  badge,
  href,
}: MarketCardProps) {
  const inner = (
    <div className="card group flex flex-col gap-2 p-4 transition-shadow hover:shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {symbol}
          </div>
          {name ? (
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {name}
            </div>
          ) : null}
        </div>
        {badge ? (
          <span className="badge badge-planned text-[10px]">{badge}</span>
        ) : null}
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {price}
        </span>
        <PriceChangeBadge value={change} direction={direction} />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-offset-4">
        {inner}
      </Link>
    );
  }
  return inner;
}
