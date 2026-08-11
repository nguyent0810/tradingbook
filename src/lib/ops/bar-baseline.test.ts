import { describe, expect, it } from "vitest";
import {
  buildBarBaseline,
  changedSharedYears,
  removedYears,
  yearsWithLostDates,
  encodeDayBitmap,
  isDaySubset,
  compareBarBaselines,
  formatBaselineComparison,
  hasDataLoss,
  findMissingBitmaps,
  median,
  type BarBaseline,
  type IndexBaselineRow,
  type SymbolBaselineRow,
} from "./bar-baseline";

/** Bitmap for a contiguous run of days-of-year, for readable fixtures. */
function days(from: number, count: number): string {
  return encodeDayBitmap(Array.from({ length: count }, (_, i) => from + i));
}

function sym(over: Partial<SymbolBaselineRow> = {}): SymbolBaselineRow {
  return {
    symbol: "FPT",
    barCount: 220,
    minDate: "2026-01-08",
    maxDate: "2026-08-10",
    yearChecksums: { "2026": "a26" },
    yearBarCounts: { "2026": 220 },
    yearDayBitmaps: { "2026": days(1, 220) },
    staleBars90d: 27,
    ...over,
  };
}

function idx(over: Partial<IndexBaselineRow> = {}): IndexBaselineRow {
  return {
    symbol: "VNINDEX",
    barCount: 373,
    minDate: "2025-02-12",
    maxDate: "2026-08-10",
    yearChecksums: { "2025": "i25", "2026": "i26" },
    yearBarCounts: { "2025": 200, "2026": 173 },
    yearDayBitmaps: { "2025": days(1, 200), "2026": days(1, 173) },
    ...over,
  };
}

function baseline(rows: SymbolBaselineRow[], indexes: IndexBaselineRow[] = [idx()]): BarBaseline {
  return buildBarBaseline({
    capturedAt: "2026-08-11T00:00:00.000Z",
    databaseHint: "***",
    symbolRows: rows,
    indexRows: indexes,
  });
}

describe("median", () => {
  it("returns 0 for an empty set", () => expect(median([])).toBe(0));
  it("takes the middle of an odd-length set", () => expect(median([3, 1, 2])).toBe(2));
  it("averages the middle pair of an even-length set", () => expect(median([1, 2, 3, 4])).toBe(2.5));
});

describe("removedYears", () => {
  it("lists years present before and gone after", () => {
    expect(removedYears({ "2024": "a", "2025": "b" }, { "2025": "b" })).toEqual(["2024"]);
  });
  it("returns nothing when every prior year survived", () => {
    expect(removedYears({ "2025": "b" }, { "2018": "x", "2025": "b" })).toEqual([]);
  });
});

describe("findMissingBitmaps", () => {
  it("passes a snapshot where every checksummed year has a bitmap", () => {
    expect(findMissingBitmaps(baseline([sym()]))).toEqual([]);
  });
  it("names symbol-years whose bitmap is absent — the fallback must never apply silently", () => {
    const b = baseline([sym({ yearChecksums: { "2025": "x", "2026": "a26" }, yearDayBitmaps: { "2026": days(1, 220) } })]);
    expect(findMissingBitmaps(b)).toEqual(["FPT:2025"]);
  });
  it("checks indexes too", () => {
    const b = baseline([sym()], [idx({ yearChecksums: { "2024": "z" }, yearDayBitmaps: {} })]);
    expect(findMissingBitmaps(b)).toContain("index VNINDEX:2024");
  });
});

describe("day bitmaps", () => {
  it("round-trips a set of days as a subset of itself", () => {
    const b = encodeDayBitmap([1, 5, 366]);
    expect(isDaySubset(b, b)).toBe(true);
  });
  it("treats a superset as containing the subset", () => {
    expect(isDaySubset(encodeDayBitmap([5, 9]), encodeDayBitmap([1, 5, 9, 200]))).toBe(true);
  });
  it("rejects when any day is missing from the superset", () => {
    expect(isDaySubset(encodeDayBitmap([5, 9]), encodeDayBitmap([5, 200]))).toBe(false);
  });
  it("ignores out-of-range days rather than corrupting adjacent bits", () => {
    expect(isDaySubset(encodeDayBitmap([0, 367, 5]), encodeDayBitmap([5]))).toBe(true);
  });
});

describe("yearsWithLostDates", () => {
  it("lists shared years that dropped a previously stored date", () => {
    expect(
      yearsWithLostDates({ "2025": days(1, 250) }, { "2025": days(1, 100) })
    ).toEqual(["2025"]);
  });
  it("ignores years that only gained dates", () => {
    expect(yearsWithLostDates({ "2025": days(1, 100) }, { "2025": days(1, 250) })).toEqual([]);
  });
  it("ignores years absent after — that is removedYears' job", () => {
    expect(yearsWithLostDates({ "2025": days(1, 100) }, {})).toEqual([]);
  });
  it("CATCHES same-count date substitution: March dropped, November added", () => {
    // The exact hole a row count cannot see. Count is identical; history is lost.
    const before = encodeDayBitmap([60, 61, 62, 63]);   // early-March sessions
    const after = encodeDayBitmap([310, 311, 312, 313]); // November sessions
    expect(yearsWithLostDates({ "2025": before }, { "2025": after })).toEqual(["2025"]);
  });
  it("CATCHES substitution that GROWS the count", () => {
    const before = encodeDayBitmap([60, 61]);
    const after = encodeDayBitmap([61, 310, 311, 312]); // day 60 gone, count up
    expect(yearsWithLostDates({ "2025": before }, { "2025": after })).toEqual(["2025"]);
  });
});

describe("changedSharedYears", () => {
  it("reports only years present in both snapshots whose checksum moved", () => {
    expect(
      changedSharedYears({ "2024": "a", "2025": "b" }, { "2024": "a", "2025": "CHANGED" })
    ).toEqual(["2025"]);
  });
  it("ignores years that only exist after — those are appended history, not a rewrite", () => {
    expect(changedSharedYears({ "2026": "a" }, { "2018": "x", "2026": "a" })).toEqual([]);
  });
  it("returns years sorted so output is deterministic", () => {
    expect(
      changedSharedYears({ "2025": "a", "2019": "a" }, { "2025": "z", "2019": "z" })
    ).toEqual(["2019", "2025"]);
  });
});

describe("buildBarBaseline", () => {
  it("totals bars and stale counts across symbols", () => {
    const b = baseline([
      sym({ symbol: "FPT", barCount: 220, staleBars90d: 27 }),
      sym({ symbol: "HPG", barCount: 180, staleBars90d: 13 }),
    ]);
    expect(b.totals).toMatchObject({
      symbols: 2,
      equityBars: 400,
      indexBars: 373,
      staleBars90d: 40,
      medianBarsPerSymbol: 200,
    });
  });
});

describe("compareBarBaselines — the expected backfill shape", () => {
  it("counts added bars and does not flag appended older years as a rewrite", () => {
    const c = compareBarBaselines(
      baseline([sym({ barCount: 220, minDate: "2026-01-08", yearChecksums: { "2026": "a26" } })]),
      baseline([
        sym({
          barCount: 1987,
          minDate: "2018-08-24",
          yearChecksums: { "2018": "n18", "2019": "n19", "2026": "a26" },
        }),
      ])
    );
    expect(c.symbolsGained).toBe(1);
    expect(c.symbolsLostBars).toEqual([]);
    expect(c.symbolsWithRebasedYears).toEqual([]);
    expect(hasDataLoss(c)).toBe(false);
    expect(c.deltas[0]).toMatchObject({ barsAdded: 1767, minDateAfter: "2018-08-24" });
  });
});

describe("compareBarBaselines — things that must never pass silently", () => {
  it("flags a symbol that LOST bars", () => {
    const c = compareBarBaselines(baseline([sym({ barCount: 220 })]), baseline([sym({ barCount: 100 })]));
    expect(c.symbolsLostBars).toHaveLength(1);
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("DATA LOSS DETECTED");
  });

  it("flags a symbol that disappeared entirely", () => {
    const c = compareBarBaselines(baseline([sym({ symbol: "GONE" })]), baseline([]));
    expect(c.symbolsMissingAfter).toEqual(["GONE"]);
    expect(hasDataLoss(c)).toBe(true);
  });

  it("flags a newest-bar regression even when the total count grew", () => {
    // Gaining old history while losing the latest session is still data loss.
    const c = compareBarBaselines(
      baseline([sym({ barCount: 220, maxDate: "2026-08-10" })]),
      baseline([sym({ barCount: 1900, maxDate: "2026-08-03" })])
    );
    expect(c.symbolsWithRegressedDates).toHaveLength(1);
    expect(c.symbolsWithRegressedDates[0]!.maxDateRegressed).toBe(true);
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("newest bar went backwards");
  });

  it("detects a re-based year even when the bar count is identical", () => {
    // The case a row count alone cannot catch: same bars, different values.
    const c = compareBarBaselines(
      baseline([sym({ barCount: 220, yearChecksums: { "2026": "before" } })]),
      baseline([sym({ barCount: 220, yearChecksums: { "2026": "after" } })])
    );
    expect(c.symbolsWithRebasedYears).toHaveLength(1);
    expect(c.symbolsWithRebasedYears[0]!.rebasedYears).toEqual(["2026"]);
    expect(c.symbolsUnchanged).toBe(1);
    // A re-basing is expected during a backfill — it is reported, not an error.
    expect(hasDataLoss(c)).toBe(false);
  });

  it("reports symbols that appeared only after the snapshot", () => {
    // The importer can create StockSymbol rows, so new names must be visible.
    const c = compareBarBaselines(
      baseline([sym({ symbol: "FPT" })]),
      baseline([sym({ symbol: "FPT" }), sym({ symbol: "BRAND_NEW" })])
    );
    expect(c.symbolsNewAfter).toEqual(["BRAND_NEW"]);
  });

  it("tracks index bars and re-based index years separately from equities", () => {
    const c = compareBarBaselines(
      baseline([sym()], [idx({ barCount: 373, yearChecksums: { "2026": "before" } })]),
      baseline([sym()], [idx({ barCount: 2248, yearChecksums: { "2026": "after" } })])
    );
    expect(c.indexBarsBefore).toBe(373);
    expect(c.indexBarsAfter).toBe(2248);
    expect(c.indexDeltas[0]).toMatchObject({ rebasedYears: ["2026"] });
    expect(formatBaselineComparison(c)).toContain("re-based years: 2026");
  });

  it("flags a whole pre-existing YEAR disappearing even though the total grew", () => {
    // The nastiest shape: old years appended while a stored year silently vanishes,
    // so bar count goes UP and neither date bound regresses.
    const c = compareBarBaselines(
      baseline([
        sym({ barCount: 400, minDate: "2025-01-02", maxDate: "2026-08-10",
              yearChecksums: { "2025": "y25", "2026": "y26" } }),
      ]),
      baseline([
        sym({ barCount: 1600, minDate: "2018-01-02", maxDate: "2026-08-10",
              yearChecksums: { "2018": "n18", "2019": "n19", "2026": "y26" } }),
      ])
    );
    expect(c.symbolsWithRemovedYears).toHaveLength(1);
    expect(c.symbolsWithRemovedYears[0]!.removedYears).toEqual(["2025"]);
    expect(c.symbolsLostBars).toEqual([]);      // count went UP
    expect(c.symbolsWithRegressedDates).toEqual([]); // neither bound regressed
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("years removed");
  });

  it("flags minDate moving forward — old history dropped", () => {
    const c = compareBarBaselines(
      baseline([sym({ barCount: 220, minDate: "2018-08-24" })]),
      baseline([sym({ barCount: 220, minDate: "2024-01-02" })])
    );
    expect(c.symbolsWithRegressedDates).toHaveLength(1);
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("oldest bar moved forward");
  });

  it("flags an index that existed before and is absent after", () => {
    const c = compareBarBaselines(
      baseline([sym()], [idx({ symbol: "VNINDEX" })]),
      baseline([sym()], [])
    );
    expect(c.indexesWithLoss).toHaveLength(1);
    expect(c.indexesWithLoss[0]).toMatchObject({ symbol: "VNINDEX", missingAfter: true });
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("MISSING AFTER");
  });

  it("flags an index losing bars or a removed index year", () => {
    const c = compareBarBaselines(
      baseline([sym()], [idx({ barCount: 373, yearChecksums: { "2025": "a", "2026": "b" } })]),
      baseline([sym()], [idx({ barCount: 200, yearChecksums: { "2026": "b" } })])
    );
    expect(c.indexesWithLoss).toHaveLength(1);
    expect(c.indexesWithLoss[0]!.removedYears).toEqual(["2025"]);
    expect(hasDataLoss(c)).toBe(true);
  });

  it("does not flag an index that only gained older years", () => {
    const c = compareBarBaselines(
      baseline([sym()], [idx({ barCount: 373, yearChecksums: { "2025": "a", "2026": "b" } })]),
      baseline([sym()], [idx({ barCount: 2248, yearChecksums: { "2018": "x", "2025": "a", "2026": "b" } })])
    );
    expect(c.indexesWithLoss).toEqual([]);
    expect(hasDataLoss(c)).toBe(false);
  });

  it("flags a shared year that kept its entry but LOST stored dates inside it", () => {
    // Checksum changes and total grows, so this looks like a benign re-basing.
    // The date-set subset test is what separates 'values rewritten' from 'dates dropped'.
    const c = compareBarBaselines(
      baseline([
        sym({ barCount: 400, minDate: "2025-01-02",
              yearChecksums: { "2025": "y25", "2026": "y26" },
              yearDayBitmaps: { "2025": days(1, 250), "2026": days(1, 150) } }),
      ]),
      baseline([
        sym({ barCount: 1600, minDate: "2018-01-02",
              yearChecksums: { "2018": "n18", "2025": "CHANGED", "2026": "y26" },
              yearDayBitmaps: { "2018": days(1, 250), "2025": days(1, 100), "2026": days(1, 150) } }),
      ])
    );
    expect(c.symbolsWithFewerRowsInYear).toHaveLength(1);
    expect(c.symbolsWithFewerRowsInYear[0]!.yearsWithFewerRows).toEqual(["2025"]);
    // Must NOT be excused as a benign re-basing.
    expect(c.symbolsWithRebasedYears).toEqual([]);
    expect(c.symbolsLostBars).toEqual([]);
    expect(hasDataLoss(c)).toBe(true);
    expect(formatBaselineComparison(c)).toContain("years lost stored dates");
  });

  it("still calls a same-DATE-SET value rewrite a benign re-basing", () => {
    const c = compareBarBaselines(
      baseline([sym({ yearChecksums: { "2026": "before" }, yearDayBitmaps: { "2026": days(1, 220) } })]),
      baseline([sym({ yearChecksums: { "2026": "after" }, yearDayBitmaps: { "2026": days(1, 220) } })])
    );
    expect(c.symbolsWithRebasedYears).toHaveLength(1);
    expect(c.symbolsWithFewerRowsInYear).toEqual([]);
    expect(hasDataLoss(c)).toBe(false);
  });

  it("flags an index whose date span regressed", () => {
    const c = compareBarBaselines(
      baseline([sym()], [idx({ minDate: "2018-01-02", maxDate: "2026-08-10" })]),
      baseline([sym()], [idx({ minDate: "2024-01-02", maxDate: "2026-08-10" })])
    );
    expect(c.indexesWithLoss).toHaveLength(1);
    expect(c.indexesWithLoss[0]!.minDateRegressed).toBe(true);
    expect(hasDataLoss(c)).toBe(true);
  });

  it("does not mark a brand-new index as missing", () => {
    const c = compareBarBaselines(
      baseline([sym()], []),
      baseline([sym()], [idx({ symbol: "HNXINDEX" })])
    );
    const d = c.indexDeltas.find((i) => i.symbol === "HNXINDEX")!;
    expect(d.missingAfter).toBe(false);
    expect(d.barsAdded).toBeGreaterThan(0);
    expect(hasDataLoss(c)).toBe(false);
  });

  it("reports no data loss when every symbol only gained", () => {
    const c = compareBarBaselines(
      baseline([sym({ symbol: "A", barCount: 10 }), sym({ symbol: "B", barCount: 20 })]),
      baseline([sym({ symbol: "A", barCount: 100 }), sym({ symbol: "B", barCount: 200 })])
    );
    expect(formatBaselineComparison(c)).toContain("no data loss");
  });
});
