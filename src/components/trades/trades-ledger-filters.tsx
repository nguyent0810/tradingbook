export { TradeFilters } from "@/app/(dashboard)/trades/trade-filters";

/** Mirrors filters layout — Suspense fallback while client filters hydrate. */
export function TradeFiltersSkeleton() {
  return (
    <div className="ledger-deck-filters-skeleton">
      <div className="skeleton h-10 flex-1 rounded-lg sm:max-w-xs" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-40 rounded-lg" />
    </div>
  );
}
