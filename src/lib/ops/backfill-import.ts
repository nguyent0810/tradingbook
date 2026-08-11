/**
 * Pure helpers for the backfill importer.
 *
 * Kept out of the script so parsing, validation and batching are unit-testable
 * without a database — the batching in particular, because the whole reason this
 * path exists is that per-row upserts do not survive ~570k rows.
 *
 * Deliberately separate from `scripts/import-stock-bars.ts`: the daily job must
 * keep its current behaviour exactly, and a bulk write path with different
 * failure modes has no business sharing its code.
 */

export type BackfillBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ParsedLine =
  | { ok: true; symbol: string; bars: BackfillBar[] }
  | { ok: false; reason: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A bar is only usable when every OHLCV field is finite and internally coherent. */
export function validateBar(raw: unknown, index: number): { ok: true; bar: BackfillBar } | { ok: false; reason: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: `[${index}] not an object` };
  }
  const r = raw as Record<string, unknown>;
  for (const k of ["time", "open", "high", "low", "close", "volume"] as const) {
    if (!isFiniteNumber(r[k])) return { ok: false, reason: `[${index}] ${k} is not a finite number` };
  }
  const bar = r as unknown as BackfillBar;
  if (bar.time <= 0) return { ok: false, reason: `[${index}] time must be positive epoch ms` };
  if (bar.volume < 0) return { ok: false, reason: `[${index}] negative volume` };
  if (bar.high < bar.low) return { ok: false, reason: `[${index}] high < low` };
  // A zero or negative price is never a real VN equity bar; letting one through
  // would poison MA/ATR maths far downstream from here.
  for (const k of ["open", "high", "low", "close"] as const) {
    if (bar[k] <= 0) return { ok: false, reason: `[${index}] ${k} must be > 0` };
  }
  return { ok: true, bar };
}

export function parseNdjsonLine(line: string, lineNo: number): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, reason: `line ${lineNo}: empty` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: `line ${lineNo}: invalid JSON` };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, reason: `line ${lineNo}: not an object` };
  }
  const e = parsed as Record<string, unknown>;
  if (typeof e.symbol !== "string" || !e.symbol.trim()) {
    return { ok: false, reason: `line ${lineNo}: missing symbol` };
  }
  if (!Array.isArray(e.bars)) {
    return { ok: false, reason: `line ${lineNo}: bars is not an array` };
  }
  return { ok: true, symbol: e.symbol.trim().toUpperCase(), bars: e.bars as BackfillBar[] };
}

/** Epoch ms → the UTC calendar day, the storage key used throughout the app. */
export function utcDayFromMs(ms: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PreparedSymbol = {
  symbol: string;
  rows: Array<{ date: Date; bar: BackfillBar }>;
  skipped: string[];
  duplicateDates: number;
};

/**
 * Validate and de-duplicate one symbol's bars.
 *
 * Later duplicates win: a provider returning the same date twice usually means
 * the second is the corrected one, and the storage key is unique per (symbol, date)
 * anyway, so a silent last-write-wins at write time would be less visible.
 */
export function prepareSymbolRows(symbol: string, bars: readonly unknown[]): PreparedSymbol {
  const byDate = new Map<string, { date: Date; bar: BackfillBar }>();
  const skipped: string[] = [];
  let duplicateDates = 0;

  bars.forEach((raw, i) => {
    const v = validateBar(raw, i);
    if (!v.ok) {
      skipped.push(v.reason);
      return;
    }
    const date = utcDayFromMs(v.bar.time);
    const key = isoDay(date);
    if (byDate.has(key)) duplicateDates++;
    byDate.set(key, { date, bar: v.bar });
  });

  const rows = [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  return { symbol, rows, skipped, duplicateDates };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type SymbolImportResult = {
  symbol: string;
  barsWritten: number;
  firstDate: string | null;
  lastDate: string | null;
  skipped: number;
};

export function summarizeImport(results: readonly SymbolImportResult[]): {
  symbols: number;
  symbolsWithBars: number;
  totalBars: number;
  totalSkipped: number;
  earliest: string | null;
  latest: string | null;
} {
  const withBars = results.filter((r) => r.barsWritten > 0);
  const firsts = results.map((r) => r.firstDate).filter((d): d is string => d != null);
  const lasts = results.map((r) => r.lastDate).filter((d): d is string => d != null);
  return {
    symbols: results.length,
    symbolsWithBars: withBars.length,
    totalBars: results.reduce((a, r) => a + r.barsWritten, 0),
    totalSkipped: results.reduce((a, r) => a + r.skipped, 0),
    earliest: firsts.length ? firsts.reduce((a, b) => (a < b ? a : b)) : null,
    latest: lasts.length ? lasts.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/** Strict YYYY-MM-DD with a real calendar date behind it. */
export function isValidIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type SeenSymbol = { symbol: string; bars: number; firstDate: string | null; lastDate: string | null };

export type InputReconciliation = {
  /** In the manifest but absent from the input file — truncated or wrong artifact. */
  missingFromInput: string[];
  /** In the input but not the manifest — the two do not describe the same fetch. */
  extraInInput: string[];
  /** Same symbol, different bar count or date span. */
  mismatched: Array<{
    symbol: string;
    manifestBars: number;
    inputBars: number;
    manifestFirst: string | null;
    inputFirst: string | null;
    manifestLast: string | null;
    inputLast: string | null;
  }>;
};

/**
 * Prove the NDJSON actually IS the fetch the manifest describes.
 *
 * Reconciling the manifest against the baseline is not enough on its own: a
 * valid manifest paired with a truncated, stale or simply different NDJSON file
 * would still pass that check and then write. This closes the gap by comparing
 * what was really read — symbol set, bar counts and date spans — against what
 * the manifest claims.
 */
export function reconcileInputAgainstManifest(
  seen: readonly SeenSymbol[],
  manifest: {
    perSymbol: ReadonlyArray<{ symbol: string; bars: number; firstTimeMs: number | null; lastTimeMs: number | null }>;
  }
): InputReconciliation {
  const toIso = (ms: number | null): string | null =>
    ms == null || !Number.isFinite(ms) ? null : new Date(ms).toISOString().slice(0, 10);

  const seenMap = new Map(seen.map((s) => [s.symbol, s]));
  const manifestMap = new Map(manifest.perSymbol.map((m) => [m.symbol, m]));

  const missingFromInput: string[] = [];
  const mismatched: InputReconciliation["mismatched"] = [];

  for (const [symbol, m] of manifestMap) {
    const s = seenMap.get(symbol);
    if (!s) {
      missingFromInput.push(symbol);
      continue;
    }
    const mFirst = toIso(m.firstTimeMs);
    const mLast = toIso(m.lastTimeMs);
    if (s.bars !== m.bars || s.firstDate !== mFirst || s.lastDate !== mLast) {
      mismatched.push({
        symbol,
        manifestBars: m.bars,
        inputBars: s.bars,
        manifestFirst: mFirst,
        inputFirst: s.firstDate,
        manifestLast: mLast,
        inputLast: s.lastDate,
      });
    }
  }

  return {
    missingFromInput,
    extraInInput: [...seenMap.keys()].filter((s) => !manifestMap.has(s)),
    mismatched,
  };
}

/**
 * Symbols appearing more than once in a list.
 *
 * Reconciliation keys by symbol, so a repeated symbol collapses to one entry and
 * can satisfy the check while the writer still processes every line. Duplicates
 * therefore have to be fatal before writes rather than merged.
 */
export function findDuplicateSymbols(symbols: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const s of symbols) {
    if (seen.has(s)) dupes.add(s);
    seen.add(s);
  }
  return [...dupes].sort();
}

export function inputMatchesManifest(r: InputReconciliation): boolean {
  return r.missingFromInput.length === 0 && r.extraInInput.length === 0 && r.mismatched.length === 0;
}

export function formatInputReconciliation(r: InputReconciliation): string {
  if (inputMatchesManifest(r)) return "input file matches the manifest exactly";
  const lines = ["!! INPUT FILE DOES NOT MATCH ITS MANIFEST"];
  for (const s of r.missingFromInput) lines.push(`   ${s}: in manifest, absent from input`);
  for (const s of r.extraInInput) lines.push(`   ${s}: in input, absent from manifest`);
  for (const m of r.mismatched) {
    lines.push(
      `   ${m.symbol}: manifest ${m.manifestBars} bars ${m.manifestFirst}→${m.manifestLast}, ` +
        `input ${m.inputBars} bars ${m.inputFirst}→${m.inputLast}`
    );
  }
  return lines.join("\n");
}
