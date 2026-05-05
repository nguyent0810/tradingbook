"use client";

import { useCallback, useState } from "react";

export type SetupsRejectionAccordionItem = {
  categoryKey: string;
  label: string;
  count: number;
  symbols: string[];
  meaning: string;
  waitFor: string;
};

const INITIAL_SYMBOLS = 5;

export function SetupsRejectionAccordion({
  items,
  sectionTitle = "Diagnostics",
  sectionIntro,
}: {
  items: SetupsRejectionAccordionItem[];
  sectionTitle?: string;
  sectionIntro?: string;
}) {
  const [visibleCapByKey, setVisibleCapByKey] = useState<Record<string, number>>({});

  const bumpCap = useCallback((categoryKey: string, next: number) => {
    setVisibleCapByKey((prev) => ({ ...prev, [categoryKey]: next }));
  }, []);

  const sorted = [...items].sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  const defaultIntro =
    "Each row is one Gate 2 stop rule — expand to see what it means, what to wait for, and sample symbols.";

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        {sectionTitle}
      </h2>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {sectionIntro ?? defaultIntro}
      </p>

      <ul className="mt-5 space-y-2">
        {sorted.map((row) => {
          const defaultCap = Math.min(INITIAL_SYMBOLS, row.symbols.length);
          const cap = visibleCapByKey[row.categoryKey] ?? defaultCap;
          const visible = row.symbols.slice(0, cap);
          const canExpandList = row.symbols.length > INITIAL_SYMBOLS;
          const showingAll = cap >= row.symbols.length;

          return (
            <li key={row.categoryKey}>
              <details className="details-disclosure overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
                <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-secondary)]">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="tabular-nums">{row.count}</span>
                    <span className="details-marker-closed text-[var(--text-tertiary)]" aria-hidden>
                      ▸
                    </span>
                    <span className="details-marker-open text-[var(--text-tertiary)]" aria-hidden>
                      ▾
                    </span>
                  </span>
                </summary>

                <div className="border-t px-4 py-3 text-sm" style={{ borderColor: "var(--border-primary)" }}>
                  <div className="space-y-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    <p>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        What it means:{" "}
                      </span>
                      {row.meaning}
                    </p>
                    <p>
                      <span className="font-medium" style={{ color: "var(--accent-text)" }}>
                        Wait for:{" "}
                      </span>
                      {row.waitFor}
                    </p>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    Symbols in this bucket
                  </p>

                  {row.symbols.length === 0 ? (
                    <p className="mt-2 text-sm italic" style={{ color: "var(--text-tertiary)" }}>
                      No symbol list stored for this bucket on this run. Run{" "}
                      <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-[11px]">
                        npx tsx scripts/run-daily-scanner.ts
                      </code>{" "}
                      again to refresh notes, or ensure index bars are loaded for live lists on this page.
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {visible.map((sym) => (
                          <span
                            key={sym}
                            className="mono rounded-md px-2 py-1 text-xs font-semibold"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                      {canExpandList ? (
                        <div className="mt-3">
                          {!showingAll ? (
                            <button
                              type="button"
                              className="text-sm font-medium text-[var(--accent-text)] hover:underline"
                              onClick={() => bumpCap(row.categoryKey, row.symbols.length)}
                            >
                              Show more
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-sm font-medium text-[var(--accent-text)] hover:underline"
                              onClick={() => bumpCap(row.categoryKey, INITIAL_SYMBOLS)}
                            >
                              Show fewer
                            </button>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
