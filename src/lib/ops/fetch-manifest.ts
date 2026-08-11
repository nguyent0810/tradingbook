/**
 * Reconcile a fetch manifest against the Gate 1 baseline BEFORE anything is
 * imported.
 *
 * The failure this prevents: a fetch that silently covered less than the
 * universe, or came back shallower than what is already stored, and then gets
 * upserted over good data. Checking after the import means discovering it from
 * a corrupted database; checking here means the import never starts.
 *
 * The rules are deliberately one-directional. A backfill must go DEEPER and no
 * less recent — never the reverse:
 *   - every baseline symbol must appear in the manifest
 *   - no symbol may come back empty
 *   - fetched first date must be <= the stored first date
 *   - fetched last date must be >= the stored last date
 */
import type { BarBaseline } from "./bar-baseline";

export type FetchManifestSymbol = {
  symbol: string;
  bars: number;
  firstTimeMs: number | null;
  lastTimeMs: number | null;
};

export type FetchManifest = {
  capturedAt: string;
  command: string;
  params: {
    start: string;
    end: string;
    format: string;
    sleepSeconds: number;
    maxFailurePct: number;
  };
  totals: {
    symbolsRequested: number;
    symbolsWithData: number;
    /** Every symbol without data, however it got there. */
    symbolsFailed: number;
    symbolsErrored?: number;
    symbolsEmpty?: number;
    totalBars: number;
  };
  /**
   * Union of errored and empty. Kept because a provider answering with nothing
   * is not an error but is still a hole — reconciliation must not infer
   * completeness from the errored list alone.
   */
  failedSymbols: string[];
  erroredSymbols?: string[];
  emptySymbols?: string[];
  perSymbol: FetchManifestSymbol[];
};

export function msToIsoDate(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export type ManifestReconciliation = {
  symbolsInBaseline: number;
  symbolsInManifest: number;
  /** In the baseline but never fetched — the fetch did not cover the universe. */
  missingFromFetch: string[];
  /** Fetched but returned nothing. */
  emptyFetch: string[];
  /** Fetch did not reach as far back as what is already stored. */
  shallowerThanStored: Array<{ symbol: string; storedFirst: string; fetchedFirst: string }>;
  /** Fetch's newest bar is older than what is already stored. */
  staleThanStored: Array<{ symbol: string; storedLast: string; fetchedLast: string }>;
  /** Present in the fetch but not in the baseline — new listings, informational. */
  newInFetch: string[];
  totalBarsFetched: number;
  totalBarsStored: number;
};

export function reconcileFetchAgainstBaseline(
  manifest: FetchManifest,
  baseline: BarBaseline
): ManifestReconciliation {
  const fetched = new Map(manifest.perSymbol.map((r) => [r.symbol, r]));
  const stored = new Map(baseline.symbols.map((r) => [r.symbol, r]));

  const missingFromFetch: string[] = [];
  const emptyFetch: string[] = [];
  const shallowerThanStored: ManifestReconciliation["shallowerThanStored"] = [];
  const staleThanStored: ManifestReconciliation["staleThanStored"] = [];

  for (const [symbol, s] of stored) {
    const f = fetched.get(symbol);
    if (!f) {
      missingFromFetch.push(symbol);
      continue;
    }
    if (f.bars <= 0) {
      emptyFetch.push(symbol);
      continue;
    }
    const fFirst = msToIsoDate(f.firstTimeMs);
    const fLast = msToIsoDate(f.lastTimeMs);
    if (s.minDate && fFirst && fFirst > s.minDate) {
      shallowerThanStored.push({ symbol, storedFirst: s.minDate, fetchedFirst: fFirst });
    }
    if (s.maxDate && fLast && fLast < s.maxDate) {
      staleThanStored.push({ symbol, storedLast: s.maxDate, fetchedLast: fLast });
    }
  }

  return {
    symbolsInBaseline: stored.size,
    symbolsInManifest: fetched.size,
    missingFromFetch,
    emptyFetch,
    shallowerThanStored,
    staleThanStored,
    newInFetch: [...fetched.keys()].filter((s) => !stored.has(s)),
    totalBarsFetched: manifest.totals.totalBars,
    totalBarsStored: baseline.totals.equityBars,
  };
}

/** True when the fetch is not safe to import over the stored data. */
export function fetchIsUnsafeToImport(r: ManifestReconciliation): boolean {
  return (
    r.missingFromFetch.length > 0 ||
    r.emptyFetch.length > 0 ||
    r.shallowerThanStored.length > 0 ||
    r.staleThanStored.length > 0
  );
}

export function formatReconciliation(r: ManifestReconciliation): string {
  const lines: string[] = [];
  lines.push("=== fetch vs stored baseline ===");
  lines.push(`symbols: baseline ${r.symbolsInBaseline} · fetched ${r.symbolsInManifest}`);
  lines.push(`bars:    stored ${r.totalBarsStored} · fetched ${r.totalBarsFetched}`);
  if (r.newInFetch.length > 0) {
    lines.push(`new in fetch (not yet stored): ${r.newInFetch.length}`);
  }

  if (fetchIsUnsafeToImport(r)) {
    lines.push("");
    lines.push("!! FETCH IS NOT SAFE TO IMPORT");
    for (const s of r.missingFromFetch) lines.push(`   ${s}: stored but not fetched`);
    for (const s of r.emptyFetch) lines.push(`   ${s}: fetch returned no bars`);
    for (const x of r.shallowerThanStored) {
      lines.push(
        `   ${x.symbol}: fetch starts ${x.fetchedFirst}, shallower than stored ${x.storedFirst}`
      );
    }
    for (const x of r.staleThanStored) {
      lines.push(
        `   ${x.symbol}: fetch ends ${x.fetchedLast}, older than stored ${x.storedLast}`
      );
    }
  } else {
    lines.push("");
    lines.push("every stored symbol was fetched, none empty, none shallower or staler — safe to import");
  }
  return lines.join("\n");
}
