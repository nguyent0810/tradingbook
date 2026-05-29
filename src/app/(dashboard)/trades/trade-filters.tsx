"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface TradeFiltersProps {
  currentSearch: string;
  currentStatus: string;
  currentSort: string;
  currentCompactReview: boolean;
  currentReviewSession: boolean;
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="tos-filter-chip" data-testid={`trades-filter-chip-${label}`}>
      <span className="tos-filter-chip__label">{label}</span>
      <span className="tos-filter-chip__value">{value}</span>
      <button
        type="button"
        className="tos-filter-chip__remove"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}

export function TradeFilters({
  currentSearch,
  currentStatus,
  currentSort,
  currentCompactReview,
  currentReviewSession,
}: TradeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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

  const clearAllFilters = useCallback(() => {
    router.push("/trades");
  }, [router]);

  const hasActiveFilters =
    Boolean(currentSearch.trim()) ||
    Boolean(currentStatus && currentStatus !== "ALL") ||
    currentSort === "oldest" ||
    currentCompactReview ||
    currentReviewSession;

  return (
    <div
      className="tosv3-glass-panel ledger-deck-filters ledger-deck-filters--compact pipeline-deck-panel tos-trades-filters dash-surface-1"
      data-testid="trades-filters-bar"
    >
      <div className="ledger-deck-filters__row ledger-deck-filters__row--compact tos-trades-filters__row">
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
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by ticker…"
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              searchDebounceRef.current = setTimeout(() => updateParam("search", value), 300);
            }}
            className="input tos-trades-filters__input"
            style={{ paddingLeft: "36px" }}
            id="trade-search"
          />
        </div>

        <select
          value={currentStatus || "ALL"}
          onChange={(e) =>
            updateParam("status", e.target.value === "ALL" ? "" : e.target.value)
          }
          className="select tos-trades-filters__select"
          id="status-filter"
        >
          <option value="ALL">All Status</option>
          <option value="PLANNED">Planned</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="select tos-trades-filters__select"
          id="sort-filter"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      <div className="tos-trades-filters__row tos-trades-filters__row--secondary">
        <label
          className="flex cursor-pointer items-center gap-2 text-xs whitespace-nowrap"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            className="rounded border"
            style={{ borderColor: "var(--border-color)" }}
            checked={currentCompactReview}
            onChange={(e) =>
              updateParam("compactReview", e.target.checked ? "1" : "")
            }
            id="compact-review-toggle"
          />
          Compact review
        </label>

        <label
          className="flex cursor-pointer items-center gap-2 text-xs whitespace-nowrap"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            className="rounded border"
            style={{ borderColor: "var(--border-color)" }}
            checked={currentReviewSession}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.checked) {
                params.set("reviewSession", "1");
              } else {
                params.delete("reviewSession");
                params.delete("reviewFocus");
              }
              const qs = params.toString();
              router.push(qs ? `/trades?${qs}` : "/trades");
            }}
            id="review-session-toggle"
          />
          Review session
        </label>
      </div>

      {hasActiveFilters ? (
        <div
          className="tos-trades-filters__chips"
          data-testid="trades-active-filters"
        >
          <span className="tos-trades-filters__chips-label">Active filters</span>
          <div className="tos-trades-filters__chips-list">
            {currentSearch.trim() ? (
              <FilterChip
                label="Symbol"
                value={currentSearch.trim().toUpperCase()}
                onRemove={() => {
                  setSearchInput("");
                  updateParam("search", "");
                }}
              />
            ) : null}
            {currentStatus && currentStatus !== "ALL" ? (
              <FilterChip
                label="Status"
                value={currentStatus}
                onRemove={() => updateParam("status", "")}
              />
            ) : null}
            {currentSort === "oldest" ? (
              <FilterChip
                label="Sort"
                value="Oldest first"
                onRemove={() => updateParam("sort", "")}
              />
            ) : null}
            {currentCompactReview ? (
              <FilterChip
                label="View"
                value="Compact review"
                onRemove={() => updateParam("compactReview", "")}
              />
            ) : null}
            {currentReviewSession ? (
              <FilterChip
                label="View"
                value="Review session"
                onRemove={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("reviewSession");
                  params.delete("reviewFocus");
                  const qs = params.toString();
                  router.push(qs ? `/trades?${qs}` : "/trades");
                }}
              />
            ) : null}
          </div>
          <button
            type="button"
            className="tos-trades-filters__clear"
            onClick={clearAllFilters}
            data-testid="trades-clear-filters"
          >
            Clear all filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
