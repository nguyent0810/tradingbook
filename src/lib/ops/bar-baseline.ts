/**
 * Pure helpers behind `scripts/backfill/snapshot-bar-baseline.ts`.
 *
 * Split out from the script so the comparison rules — especially what counts as
 * a *suspicious* change — are unit-testable without a database.
 *
 * The distinction that matters for a backfill: bars being ADDED is the expected
 * outcome. Anything that removes or rewrites what was already stored is not, and
 * has to fail loudly rather than be inferred from a total that went up.
 *
 * Three ways history can be lost while the headline count still grows, all of
 * which this module treats as data loss:
 *   - a whole pre-existing YEAR disappears while older years are appended
 *   - `minDate` moves forward (old history dropped) or `maxDate` moves back
 *     (newest session dropped)
 *   - an index that existed before is absent after, or shrinks
 *
 * Checksums are per calendar year and cover the WHOLE row
 * (date, open, high, low, close, volume, source). A recent-window, close-only
 * checksum would be blind to exactly what a 9-year upsert-with-update rewrites;
 * year buckets stay bounded (≤ ~12 entries/symbol) while pinpointing what moved.
 */

export type YearChecksums = Record<string, string>;
/** Rows stored per calendar year. Distinguishes a value rewrite from dropped rows. */
export type YearBarCounts = Record<string, number>;
/**
 * Base64 bitmap of which days-of-year are stored, one entry per calendar year.
 *
 * Row counts alone cannot express the invariant that actually matters — "no
 * previously stored date may disappear" — because a year can drop March and gain
 * November while the count holds or grows. 367 bits fits in 46 bytes, so the
 * whole universe costs ~200KB and the check becomes an exact subset test.
 */
export type YearDayBitmaps = Record<string, string>;

const BITMAP_BYTES = 46; // ceil(367 / 8)

/** Encode a set of day-of-year values (1..366) as a base64 bitmap. */
export function encodeDayBitmap(daysOfYear: readonly number[]): string {
  const bytes = new Uint8Array(BITMAP_BYTES);
  for (const d of daysOfYear) {
    if (!Number.isInteger(d) || d < 1 || d > 366) continue;
    bytes[d >> 3]! |= 1 << (d & 7);
  }
  return Buffer.from(bytes).toString("base64");
}

/** True when every day set in `subset` is also set in `superset`. */
export function isDaySubset(subset: string, superset: string): boolean {
  const a = Buffer.from(subset, "base64");
  const b = Buffer.from(superset, "base64");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if ((av & ~bv & 0xff) !== 0) return false;
  }
  return true;
}

export type SymbolBaselineRow = {
  symbol: string;
  barCount: number;
  minDate: string | null;
  maxDate: string | null;
  /** md5 per calendar year over full rows. Key = "2024". */
  yearChecksums: YearChecksums;
  /** Row count per calendar year, same keys as `yearChecksums`. */
  yearBarCounts: YearBarCounts;
  /** Which days-of-year are stored, per year. Enables exact subset checking. */
  yearDayBitmaps: YearDayBitmaps;
  staleBars90d: number;
};

export type IndexBaselineRow = {
  symbol: string;
  barCount: number;
  minDate: string | null;
  maxDate: string | null;
  yearChecksums: YearChecksums;
  yearBarCounts: YearBarCounts;
  yearDayBitmaps: YearDayBitmaps;
};

export type BarBaseline = {
  capturedAt: string;
  databaseHint: string;
  totals: {
    symbols: number;
    equityBars: number;
    indexBars: number;
    staleBars90d: number;
    medianBarsPerSymbol: number;
  };
  symbols: SymbolBaselineRow[];
  indexes: IndexBaselineRow[];
};

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function buildBarBaseline(params: {
  capturedAt: string;
  databaseHint: string;
  symbolRows: SymbolBaselineRow[];
  indexRows: IndexBaselineRow[];
}): BarBaseline {
  return {
    capturedAt: params.capturedAt,
    databaseHint: params.databaseHint,
    totals: {
      symbols: params.symbolRows.length,
      equityBars: params.symbolRows.reduce((a, r) => a + r.barCount, 0),
      indexBars: params.indexRows.reduce((a, r) => a + r.barCount, 0),
      staleBars90d: params.symbolRows.reduce((a, r) => a + r.staleBars90d, 0),
      medianBarsPerSymbol: median(params.symbolRows.map((r) => r.barCount)),
    },
    symbols: params.symbolRows,
    indexes: params.indexRows,
  };
}

/**
 * Years present in both snapshots whose values changed while the row count held.
 * This is the benign case — a corporate-action re-basing rewrites values in place.
 * A checksum change accompanied by FEWER rows is not benign; see `yearsWithLostRows`.
 */
export function changedSharedYears(
  before: YearChecksums,
  after: YearChecksums,
  beforeBitmaps: YearDayBitmaps = {},
  afterBitmaps: YearDayBitmaps = {}
): string[] {
  return Object.keys(before)
    .filter((y) => {
      if (after[y] == null || after[y] === before[y]) return false;
      const b = beforeBitmaps[y];
      const a = afterBitmaps[y];
      // A value rewrite is only benign when no prior date vanished. Missing
      // bitmaps (older baseline files) fall back to treating it as a re-basing
      // so the comparison still runs instead of throwing.
      if (b == null || a == null) return true;
      return isDaySubset(b, a);
    })
    .sort();
}

/**
 * Years that survived but lost at least one previously stored DATE.
 *
 * This is the real invariant, and it is strictly stronger than a row count:
 * a year that drops its March sessions and gains November ones keeps (or grows)
 * its count while silently losing history. The bitmap subset test catches that;
 * counting cannot.
 *
 * Years present before but absent from `afterBitmaps` are left to `removedYears`.
 */
export function yearsWithLostDates(
  beforeBitmaps: YearDayBitmaps,
  afterBitmaps: YearDayBitmaps
): string[] {
  return Object.keys(beforeBitmaps)
    .filter((y) => afterBitmaps[y] != null && !isDaySubset(beforeBitmaps[y]!, afterBitmaps[y]!))
    .sort();
}

/**
 * Years present before and gone after. A backfill only ever appends years, so
 * this is always loss — and it is invisible to a bar-count total that grew
 * because older years were added at the same time.
 */
export function removedYears(before: YearChecksums, after: YearChecksums): string[] {
  return Object.keys(before)
    .filter((y) => after[y] == null)
    .sort();
}

export type SymbolDelta = {
  symbol: string;
  barsBefore: number;
  barsAfter: number;
  barsAdded: number;
  minDateBefore: string | null;
  minDateAfter: string | null;
  maxDateBefore: string | null;
  maxDateAfter: string | null;
  /** Pre-existing years whose stored values changed — a re-basing, not an append. */
  rebasedYears: string[];
  /** Pre-existing years that vanished. Always loss. */
  removedYears: string[];
  /** Pre-existing years that survived but lost at least one stored date. Always loss. */
  yearsWithFewerRows: string[];
  /** Oldest bar moved forward: old history was dropped. */
  minDateRegressed: boolean;
  /** Newest bar moved backwards: the latest session was dropped. */
  maxDateRegressed: boolean;
};

export type IndexDelta = {
  symbol: string;
  barsBefore: number;
  barsAfter: number;
  barsAdded: number;
  rebasedYears: string[];
  removedYears: string[];
  yearsWithFewerRows: string[];
  minDateRegressed: boolean;
  maxDateRegressed: boolean;
  missingAfter: boolean;
};

export type BaselineComparison = {
  equityBarsBefore: number;
  equityBarsAfter: number;
  indexBarsBefore: number;
  indexBarsAfter: number;
  symbolsGained: number;
  symbolsUnchanged: number;
  symbolsLostBars: SymbolDelta[];
  symbolsMissingAfter: string[];
  symbolsWithRegressedDates: SymbolDelta[];
  symbolsWithRemovedYears: SymbolDelta[];
  symbolsWithFewerRowsInYear: SymbolDelta[];
  /** Expected during a backfill, but must be seen and acknowledged, never silent. */
  symbolsWithRebasedYears: SymbolDelta[];
  /** Appeared only after the snapshot — the importer can create symbols. */
  symbolsNewAfter: string[];
  indexDeltas: IndexDelta[];
  indexesWithLoss: IndexDelta[];
  deltas: SymbolDelta[];
};

function dateRegressedForward(before: string | null, after: string | null): boolean {
  return before != null && after != null && after > before;
}
function dateRegressedBackward(before: string | null, after: string | null): boolean {
  return before != null && after != null && after < before;
}

export function compareBarBaselines(
  before: BarBaseline,
  after: BarBaseline
): BaselineComparison {
  const afterBySymbol = new Map(after.symbols.map((r) => [r.symbol, r]));
  const beforeSymbols = new Set(before.symbols.map((r) => r.symbol));
  const deltas: SymbolDelta[] = [];
  const missingAfter: string[] = [];

  for (const b of before.symbols) {
    const a = afterBySymbol.get(b.symbol);
    if (!a) {
      missingAfter.push(b.symbol);
      continue;
    }
    deltas.push({
      symbol: b.symbol,
      barsBefore: b.barCount,
      barsAfter: a.barCount,
      barsAdded: a.barCount - b.barCount,
      minDateBefore: b.minDate,
      minDateAfter: a.minDate,
      maxDateBefore: b.maxDate,
      maxDateAfter: a.maxDate,
      rebasedYears: changedSharedYears(
        b.yearChecksums, a.yearChecksums, b.yearDayBitmaps, a.yearDayBitmaps
      ),
      removedYears: removedYears(b.yearChecksums, a.yearChecksums),
      yearsWithFewerRows: yearsWithLostDates(b.yearDayBitmaps ?? {}, a.yearDayBitmaps ?? {}),
      minDateRegressed: dateRegressedForward(b.minDate, a.minDate),
      maxDateRegressed: dateRegressedBackward(b.maxDate, a.maxDate),
    });
  }

  // Built from the UNION of both sides: an index that existed before and is gone
  // after would be invisible if this only walked `after`.
  const beforeIndexes = new Map(before.indexes.map((r) => [r.symbol, r]));
  const afterIndexes = new Map(after.indexes.map((r) => [r.symbol, r]));
  const indexSymbols = [
    ...new Set([...beforeIndexes.keys(), ...afterIndexes.keys()]),
  ].sort();

  const indexDeltas: IndexDelta[] = indexSymbols.map((symbol) => {
    const b = beforeIndexes.get(symbol);
    const a = afterIndexes.get(symbol);
    return {
      symbol,
      barsBefore: b?.barCount ?? 0,
      barsAfter: a?.barCount ?? 0,
      barsAdded: (a?.barCount ?? 0) - (b?.barCount ?? 0),
      rebasedYears:
        b && a
          ? changedSharedYears(b.yearChecksums, a.yearChecksums, b.yearDayBitmaps, a.yearDayBitmaps)
          : [],
      removedYears: b && a ? removedYears(b.yearChecksums, a.yearChecksums) : [],
      yearsWithFewerRows:
        b && a ? yearsWithLostDates(b.yearDayBitmaps ?? {}, a.yearDayBitmaps ?? {}) : [],
      minDateRegressed: b && a ? dateRegressedForward(b.minDate, a.minDate) : false,
      maxDateRegressed: b && a ? dateRegressedBackward(b.maxDate, a.maxDate) : false,
      missingAfter: b != null && a == null,
    };
  });

  const indexesWithLoss = indexDeltas.filter(
    (i) =>
      i.missingAfter ||
      i.barsAdded < 0 ||
      i.removedYears.length > 0 ||
      i.yearsWithFewerRows.length > 0 ||
      i.minDateRegressed ||
      i.maxDateRegressed
  );

  return {
    equityBarsBefore: before.totals.equityBars,
    equityBarsAfter: after.totals.equityBars,
    indexBarsBefore: before.totals.indexBars,
    indexBarsAfter: after.totals.indexBars,
    symbolsGained: deltas.filter((d) => d.barsAdded > 0).length,
    symbolsUnchanged: deltas.filter((d) => d.barsAdded === 0).length,
    symbolsLostBars: deltas.filter((d) => d.barsAdded < 0),
    symbolsMissingAfter: missingAfter,
    symbolsWithRegressedDates: deltas.filter((d) => d.minDateRegressed || d.maxDateRegressed),
    symbolsWithRemovedYears: deltas.filter((d) => d.removedYears.length > 0),
    symbolsWithFewerRowsInYear: deltas.filter((d) => d.yearsWithFewerRows.length > 0),
    symbolsWithRebasedYears: deltas.filter((d) => d.rebasedYears.length > 0),
    symbolsNewAfter: after.symbols.map((r) => r.symbol).filter((s) => !beforeSymbols.has(s)),
    indexDeltas,
    indexesWithLoss,
    deltas,
  };
}

/**
 * Every year with a checksum must also carry a day bitmap.
 *
 * The subset test is the only thing standing between a benign re-basing and
 * silent date loss, and it degrades to "assume benign" when a bitmap is absent.
 * A snapshot missing bitmaps therefore cannot prove anything, so callers must
 * reject it rather than compare against it.
 */
export function findMissingBitmaps(b: BarBaseline): string[] {
  const gaps: string[] = [];
  for (const r of b.symbols) {
    for (const year of Object.keys(r.yearChecksums)) {
      if (!r.yearDayBitmaps?.[year]) gaps.push(`${r.symbol}:${year}`);
    }
  }
  for (const r of b.indexes) {
    for (const year of Object.keys(r.yearChecksums)) {
      if (!r.yearDayBitmaps?.[year]) gaps.push(`index ${r.symbol}:${year}`);
    }
  }
  return gaps;
}

/** True when the comparison shows anything that means the backfill was unsafe. */
export function hasDataLoss(c: BaselineComparison): boolean {
  return (
    c.symbolsLostBars.length > 0 ||
    c.symbolsMissingAfter.length > 0 ||
    c.symbolsWithRegressedDates.length > 0 ||
    c.symbolsWithRemovedYears.length > 0 ||
    c.symbolsWithFewerRowsInYear.length > 0 ||
    c.indexesWithLoss.length > 0
  );
}

export function formatBaselineComparison(c: BaselineComparison): string {
  const lines: string[] = [];
  const d = c.equityBarsAfter - c.equityBarsBefore;
  lines.push("=== bar baseline comparison ===");
  lines.push(`equity bars: ${c.equityBarsBefore} → ${c.equityBarsAfter} (${d >= 0 ? "+" : ""}${d})`);
  lines.push(`index bars:  ${c.indexBarsBefore} → ${c.indexBarsAfter}`);
  lines.push(`symbols gaining bars:  ${c.symbolsGained}`);
  lines.push(`symbols unchanged:     ${c.symbolsUnchanged}`);
  lines.push(`symbols new after:     ${c.symbolsNewAfter.length}`);
  lines.push(`symbols with re-based years: ${c.symbolsWithRebasedYears.length}`);

  for (const i of c.indexDeltas) {
    const flags: string[] = [];
    if (i.missingAfter) flags.push("MISSING AFTER");
    if (i.rebasedYears.length) flags.push(`re-based years: ${i.rebasedYears.join(",")}`);
    if (i.removedYears.length) flags.push(`REMOVED years: ${i.removedYears.join(",")}`);
    lines.push(
      `index ${i.symbol}: ${i.barsBefore} → ${i.barsAfter}${flags.length ? ` · ${flags.join(" · ")}` : ""}`
    );
  }

  if (hasDataLoss(c)) {
    lines.push("");
    lines.push("!! DATA LOSS DETECTED — do not treat this backfill as successful");
    for (const x of c.symbolsLostBars) {
      lines.push(`   ${x.symbol}: ${x.barsBefore} → ${x.barsAfter} bars (${x.barsAdded})`);
    }
    for (const s of c.symbolsMissingAfter) {
      lines.push(`   ${s}: present before, absent after`);
    }
    for (const x of c.symbolsWithRemovedYears) {
      lines.push(`   ${x.symbol}: years removed → ${x.removedYears.join(",")}`);
    }
    for (const x of c.symbolsWithFewerRowsInYear) {
      lines.push(`   ${x.symbol}: years lost stored dates → ${x.yearsWithFewerRows.join(",")}`);
    }
    for (const x of c.symbolsWithRegressedDates) {
      if (x.minDateRegressed) {
        lines.push(`   ${x.symbol}: oldest bar moved forward ${x.minDateBefore} → ${x.minDateAfter}`);
      }
      if (x.maxDateRegressed) {
        lines.push(`   ${x.symbol}: newest bar went backwards ${x.maxDateBefore} → ${x.maxDateAfter}`);
      }
    }
    for (const i of c.indexesWithLoss) {
      lines.push(`   index ${i.symbol}: lost data (${i.barsBefore} → ${i.barsAfter})`);
    }
  } else {
    lines.push("");
    lines.push(
      "no bars lost, no symbol or index disappeared, no year removed and no stored date dropped, no date-span regression — no data loss"
    );
  }
  return lines.join("\n");
}
