"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface TradeFiltersProps {
  currentSearch: string;
  currentStatus: string;
  currentSort: string;
}

export function TradeFilters({
  currentSearch,
  currentStatus,
  currentSort,
}: TradeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/trades?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1 sm:max-w-xs">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search by ticker…"
          defaultValue={currentSearch}
          onChange={(e) => {
            // Debounce the search
            const value = e.target.value;
            const timeout = setTimeout(() => updateParam("search", value), 300);
            return () => clearTimeout(timeout);
          }}
          className="input"
          style={{ paddingLeft: "36px" }}
          id="trade-search"
        />
      </div>

      {/* Status Filter */}
      <select
        value={currentStatus || "ALL"}
        onChange={(e) =>
          updateParam("status", e.target.value === "ALL" ? "" : e.target.value)
        }
        className="select"
        style={{ width: "auto", minWidth: "140px" }}
        id="status-filter"
      >
        <option value="ALL">All Status</option>
        <option value="PLANNED">Planned</option>
        <option value="OPEN">Open</option>
        <option value="CLOSED">Closed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      {/* Sort */}
      <select
        value={currentSort}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="select"
        style={{ width: "auto", minWidth: "140px" }}
        id="sort-filter"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </div>
  );
}
