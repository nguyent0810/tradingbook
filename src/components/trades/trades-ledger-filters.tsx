import { FilterToolbar } from "@/components/trades-workstation/FilterToolbar";
import "@/components/trades-workstation/trades-workstation.css";

export { FilterToolbar as TradeFilters };

/** Mirrors filters layout — Suspense fallback while client filters hydrate. */
export function TradeFiltersSkeleton() {
  return (
    <div
      className="tw-glass-toolbar flex flex-wrap gap-2 px-3 py-2.5"
      aria-busy="true"
      data-testid="trades-filters-loading"
    >
      <div className="skeleton h-9 min-w-[10rem] flex-1 rounded-lg sm:max-w-xs" />
      <div className="skeleton h-9 w-28 rounded-lg" />
      <div className="skeleton h-9 w-28 rounded-lg" />
      <div className="skeleton h-9 w-24 rounded-lg" />
      <div className="skeleton h-9 w-24 rounded-lg" />
    </div>
  );
}
