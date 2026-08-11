import { describe, expect, it } from "vitest";
import { buildBarBaseline, encodeDayBitmap, type BarBaseline } from "./bar-baseline";
import {
  fetchIsUnsafeToImport,
  formatReconciliation,
  msToIsoDate,
  reconcileFetchAgainstBaseline,
  type FetchManifest,
  type FetchManifestSymbol,
} from "./fetch-manifest";

const DAY = 86_400_000;
function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function baselineOf(
  rows: Array<{ symbol: string; bars: number; min: string; max: string }>
): BarBaseline {
  return buildBarBaseline({
    capturedAt: "2026-08-11T00:00:00.000Z",
    databaseHint: "***",
    symbolRows: rows.map((r) => ({
      symbol: r.symbol,
      barCount: r.bars,
      minDate: r.min,
      maxDate: r.max,
      yearChecksums: { "2026": "c" },
      yearBarCounts: { "2026": r.bars },
      yearDayBitmaps: { "2026": encodeDayBitmap([1, 2, 3]) },
      staleBars90d: 0,
    })),
    indexRows: [],
  });
}

function manifestOf(rows: FetchManifestSymbol[]): FetchManifest {
  return {
    capturedAt: "2026-08-11T06:00:00.000Z",
    command: "python scripts/fetch_stock_bars.py --start 2017-01-01",
    params: {
      start: "2017-01-01",
      end: "2026-08-10",
      format: "ndjson",
      sleepSeconds: 3.2,
      maxFailurePct: 0,
    },
    totals: {
      symbolsRequested: rows.length,
      symbolsWithData: rows.filter((r) => r.bars > 0).length,
      symbolsFailed: rows.filter((r) => r.bars === 0).length,
      totalBars: rows.reduce((a, r) => a + r.bars, 0),
    },
    failedSymbols: rows.filter((r) => r.bars === 0).map((r) => r.symbol),
    perSymbol: rows,
  };
}

function fetched(symbol: string, bars: number, first: string, last: string): FetchManifestSymbol {
  return { symbol, bars, firstTimeMs: ms(first), lastTimeMs: ms(last) };
}

describe("msToIsoDate", () => {
  it("converts epoch ms to a UTC date", () => {
    expect(msToIsoDate(ms("2018-08-24"))).toBe("2018-08-24");
  });
  it("returns null for null or non-finite input", () => {
    expect(msToIsoDate(null)).toBeNull();
    expect(msToIsoDate(Number.NaN)).toBeNull();
  });
});

describe("reconcileFetchAgainstBaseline — the shape a backfill should have", () => {
  it("accepts a fetch that goes deeper and stays current", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 2249, "2017-08-10", "2026-08-10")]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(fetchIsUnsafeToImport(r)).toBe(false);
    expect(formatReconciliation(r)).toContain("safe to import");
  });

  it("reports symbols that exist in the fetch but not the baseline as informational", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([
        fetched("FPT", 2249, "2017-08-10", "2026-08-10"),
        fetched("NEWCO", 300, "2025-06-01", "2026-08-10"),
      ]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.newInFetch).toEqual(["NEWCO"]);
    expect(fetchIsUnsafeToImport(r)).toBe(false);
  });
});

describe("reconcileFetchAgainstBaseline — refusals", () => {
  it("refuses when a stored symbol was never fetched", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 2249, "2017-08-10", "2026-08-10")]),
      baselineOf([
        { symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" },
        { symbol: "HPG", bars: 215, min: "2025-09-30", max: "2026-08-10" },
      ])
    );
    expect(r.missingFromFetch).toEqual(["HPG"]);
    expect(fetchIsUnsafeToImport(r)).toBe(true);
    expect(formatReconciliation(r)).toContain("stored but not fetched");
  });

  it("refuses when a fetch returned no bars for a stored symbol", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([{ symbol: "FPT", bars: 0, firstTimeMs: null, lastTimeMs: null }]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.emptyFetch).toEqual(["FPT"]);
    expect(fetchIsUnsafeToImport(r)).toBe(true);
  });

  it("refuses a fetch shallower than what is already stored", () => {
    // Importing this would not deepen history, and could overwrite good rows
    // with a narrower window.
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 100, "2026-04-01", "2026-08-10")]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.shallowerThanStored).toHaveLength(1);
    expect(r.shallowerThanStored[0]).toMatchObject({
      storedFirst: "2026-01-08",
      fetchedFirst: "2026-04-01",
    });
    expect(fetchIsUnsafeToImport(r)).toBe(true);
    expect(formatReconciliation(r)).toContain("shallower than stored");
  });

  it("refuses a fetch whose newest bar is older than what is stored", () => {
    // Deeper history is no excuse for losing the latest session.
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 2000, "2017-08-10", "2026-08-03")]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.staleThanStored).toHaveLength(1);
    expect(fetchIsUnsafeToImport(r)).toBe(true);
    expect(formatReconciliation(r)).toContain("older than stored");
  });

  it("catches deeper-but-stale, the combination that looks like success", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 5000, "2010-01-04", "2026-07-01")]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.shallowerThanStored).toEqual([]);
    expect(r.staleThanStored).toHaveLength(1);
    expect(fetchIsUnsafeToImport(r)).toBe(true);
  });

  it("counts bars on both sides so a shrinking total is visible", () => {
    const r = reconcileFetchAgainstBaseline(
      manifestOf([fetched("FPT", 2249, "2017-08-10", "2026-08-10")]),
      baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }])
    );
    expect(r.totalBarsStored).toBe(220);
    expect(r.totalBarsFetched).toBe(2249);
    expect(ms("2026-08-11") - ms("2026-08-10")).toBe(DAY);
  });
});
