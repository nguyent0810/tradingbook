"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FilterToolbarProps } from "./types";
import "./trades-workstation.css";

type SelectOption = { value: string; label: string };

function AnimatedSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const selected = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 min-w-[7.5rem] items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 font-mono text-[10px] uppercase tracking-wide text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selected.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            role="listbox"
            aria-labelledby={id}
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1 min-w-full overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/95 py-1 shadow-xl backdrop-blur-md"
          >
            {options.map((opt, i) => (
              <motion.li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                initial={reducedMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reducedMotion ? 0 : i * 0.03 }}
              >
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide ${
                    opt.value === value
                      ? "bg-cyan-500/10 text-cyan-300"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
      <span className="sr-only">{label}</span>
    </div>
  );
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
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-300"
      data-testid={`trades-filter-chip-${label}`}
    >
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
      <button
        type="button"
        className="text-slate-500 hover:text-rose-400"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FilterToolbar({
  currentSearch,
  currentStatus,
  currentSort,
  currentCompactReview,
  currentReviewSession,
}: FilterToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chipGroupId = useId();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/trades?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearAllFilters = useCallback(() => router.push("/trades"), [router]);

  const hasActiveFilters =
    Boolean(currentSearch.trim()) ||
    Boolean(currentStatus && currentStatus !== "ALL") ||
    currentSort === "oldest" ||
    currentCompactReview ||
    currentReviewSession;

  const activeChipKeys = [
    currentSearch.trim() ? "search" : null,
    currentStatus && currentStatus !== "ALL" ? "status" : null,
    currentSort === "oldest" ? "sort" : null,
    currentCompactReview ? "compact" : null,
    currentReviewSession ? "session" : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className="tw-glass-toolbar px-3 py-2.5"
      data-testid="trades-filters-bar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
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
            className="h-9 w-full rounded-lg border border-slate-800/80 bg-slate-950/50 pl-9 pr-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            id="trade-search"
          />
        </div>

        <AnimatedSelect
          id="status-filter"
          label="Status"
          value={currentStatus || "ALL"}
          options={[
            { value: "ALL", label: "All status" },
            { value: "PLANNED", label: "Planned" },
            { value: "OPEN", label: "Open" },
            { value: "CLOSED", label: "Closed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          onChange={(v) => updateParam("status", v === "ALL" ? "" : v)}
        />

        <AnimatedSelect
          id="sort-filter"
          label="Sort"
          value={currentSort}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
          ]}
          onChange={(v) => updateParam("sort", v)}
        />

        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-800/60 px-2.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={currentCompactReview}
            onChange={(e) => updateParam("compactReview", e.target.checked ? "1" : "")}
            id="compact-review-toggle"
          />
          Compact
        </label>

        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-800/60 px-2.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={currentReviewSession}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.checked) params.set("reviewSession", "1");
              else {
                params.delete("reviewSession");
                params.delete("reviewFocus");
              }
              const qs = params.toString();
              router.push(qs ? `/trades?${qs}` : "/trades");
            }}
            id="review-session-toggle"
          />
          Session
        </label>
      </div>

      {hasActiveFilters ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800/50 pt-2"
          data-testid="trades-active-filters"
        >
          <span className="font-mono text-[10px] uppercase tracking-wide text-slate-600">
            Active
          </span>
          <div className="relative flex flex-wrap gap-1.5" id={chipGroupId}>
            {activeChipKeys.map((key) => (
              <motion.span
                key={key}
                layoutId={`tw-filter-chip-${key}`}
                className="relative"
              >
                {key === "search" && currentSearch.trim() ? (
                  <FilterChip
                    label="Symbol"
                    value={currentSearch.trim().toUpperCase()}
                    onRemove={() => {
                      setSearchInput("");
                      updateParam("search", "");
                    }}
                  />
                ) : null}
                {key === "status" && currentStatus && currentStatus !== "ALL" ? (
                  <FilterChip
                    label="Status"
                    value={currentStatus}
                    onRemove={() => updateParam("status", "")}
                  />
                ) : null}
                {key === "sort" && currentSort === "oldest" ? (
                  <FilterChip
                    label="Sort"
                    value="Oldest first"
                    onRemove={() => updateParam("sort", "")}
                  />
                ) : null}
                {key === "compact" && currentCompactReview ? (
                  <FilterChip
                    label="View"
                    value="Compact review"
                    onRemove={() => updateParam("compactReview", "")}
                  />
                ) : null}
                {key === "session" && currentReviewSession ? (
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
              </motion.span>
            ))}
          </div>
          <button
            type="button"
            className="ml-auto font-mono text-[10px] uppercase tracking-wide text-cyan-400/80 hover:text-cyan-300"
            onClick={clearAllFilters}
            data-testid="trades-clear-filters"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
