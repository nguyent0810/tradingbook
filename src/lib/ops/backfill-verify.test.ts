import { describe, expect, it } from "vitest";
import { buildBarBaseline, encodeDayBitmap, type BarBaseline, type IndexBaselineRow } from "./bar-baseline";
import type { FetchManifest } from "./fetch-manifest";
import {
  buildExpectedCoverage,
  buildVerificationReport,
  coverageFailures,
  formatVerificationReport,
  proveConvergence,
  verifyCoverage,
} from "./backfill-verify";

const CAPTURED = "2026-08-11T07:00:00.000Z";

function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

/** Contiguous day bitmap so fixtures read as "this year holds N sessions". */
function days(from: number, count: number): string {
  return encodeDayBitmap(Array.from({ length: count }, (_, i) => from + i));
}

function baselineOf(
  rows: Array<{ symbol: string; bars: number; min: string; max: string; years?: Record<string, string> }>,
  indexes: IndexBaselineRow[] = []
): BarBaseline {
  return buildBarBaseline({
    capturedAt: CAPTURED,
    databaseHint: "***",
    symbolRows: rows.map((r) => ({
      symbol: r.symbol,
      barCount: r.bars,
      minDate: r.min,
      maxDate: r.max,
      yearChecksums: r.years ?? { "2026": "c" },
      yearBarCounts: { "2026": r.bars },
      yearDayBitmaps: { "2026": days(1, Math.min(r.bars, 360)) },
      staleBars90d: 0,
    })),
    indexRows: indexes,
  });
}

function manifestOf(
  rows: Array<{ symbol: string; bars: number; first: string; last: string }>
): FetchManifest {
  return {
    capturedAt: CAPTURED,
    command: "python scripts/fetch_stock_bars.py",
    params: { start: "2017-01-01", end: "2026-08-10", format: "ndjson", sleepSeconds: 3.2, maxFailurePct: 0 },
    totals: {
      symbolsRequested: rows.length,
      symbolsWithData: rows.length,
      symbolsFailed: 0,
      totalBars: rows.reduce((a, r) => a + r.bars, 0),
    },
    failedSymbols: [],
    perSymbol: rows.map((r) => ({
      symbol: r.symbol,
      bars: r.bars,
      firstTimeMs: ms(r.first),
      lastTimeMs: ms(r.last),
      // Mirrors baselineOf's bitmap so a "complete backfill" fixture is coherent.
      yearDays: { "2026": Array.from({ length: Math.min(r.bars, 360) }, (_, i) => i + 1) },
      valueChecksum: `md5-${r.symbol}`,
    })),
  };
}

/** A manifest from before date-set tracking, which cannot prove coverage. */
function legacyManifest(): FetchManifest {
  const m = manifestOf(FETCHED);
  delete m.perSymbol[0]!.yearDays;
  return m;
}

const FETCHED = [{ symbol: "FPT", bars: 2248, first: "2017-08-10", last: "2026-08-10" }];

function report(over: {
  before?: BarBaseline;
  after?: BarBaseline;
  manifest?: FetchManifest;
  dryRun?: boolean;
  convergenceBaseline?: BarBaseline;
  storedValueChecksums?: Record<string, string | null>;
}) {
  return buildVerificationReport(
    {
      before: over.before ?? baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }]),
      after: over.after ?? baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
      manifest: over.manifest ?? manifestOf(FETCHED),
      importWasDryRun: over.dryRun ?? false,
      fingerprints: { input: "abc123" },
      // Supplied by default so existing cases isolate the property under test;
      // dedicated cases below cover their absence.
      convergenceBaseline: over.convergenceBaseline ?? over.after ?? baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
      storedValueChecksums:
        over.storedValueChecksums ??
        Object.fromEntries((over.manifest ?? manifestOf(FETCHED)).perSymbol.map((m) => [m.symbol, m.valueChecksum ?? null])),
    },
    CAPTURED
  );
}

describe("buildExpectedCoverage", () => {
  it("turns the verified manifest into a per-symbol expectation", () => {
    const [e] = buildExpectedCoverage(manifestOf(FETCHED));
    expect(e).toMatchObject({
      symbol: "FPT",
      expectedBars: 2248,
      expectedFirst: "2017-08-10",
      expectedLast: "2026-08-10",
    });
    expect(Object.keys(e!.expectedDayBitmaps)).toEqual(["2026"]);
  });
});

describe("verifyCoverage", () => {
  it("passes when the store reaches everything the fetch contained", () => {
    const checks = verifyCoverage(
      baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
      buildExpectedCoverage(manifestOf(FETCHED))
    );
    expect(coverageFailures(checks)).toEqual([]);
  });

  it("allows the store to hold MORE than the fetch window", () => {
    // Older bars outside the requested window are not a shortfall.
    const checks = verifyCoverage(
      baselineOf([{ symbol: "FPT", bars: 3000, min: "2015-01-02", max: "2026-08-10" }]),
      buildExpectedCoverage(manifestOf(FETCHED))
    );
    expect(coverageFailures(checks)).toEqual([]);
  });

  it("fails a symbol absent from the store", () => {
    const checks = verifyCoverage(baselineOf([]), buildExpectedCoverage(manifestOf(FETCHED)));
    expect(coverageFailures(checks)[0]).toMatchObject({ symbol: "FPT", missingFromStore: true });
  });

  it("fails when stored history is shallower than the fetch", () => {
    const checks = verifyCoverage(
      baselineOf([{ symbol: "FPT", bars: 2248, min: "2020-01-02", max: "2026-08-10" }]),
      buildExpectedCoverage(manifestOf(FETCHED))
    );
    expect(coverageFailures(checks)[0]).toMatchObject({ shallowerThanExpected: true });
  });

  it("fails when the store stops short of the fetch's newest bar", () => {
    const checks = verifyCoverage(
      baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-07-01" }]),
      buildExpectedCoverage(manifestOf(FETCHED))
    );
    expect(coverageFailures(checks)[0]).toMatchObject({ staleThanExpected: true });
  });

  it("fails on a bar shortfall even when both date bounds look right", () => {
    // Correct span, holes inside it — the import did not land in full.
    const checks = verifyCoverage(
      baselineOf([{ symbol: "FPT", bars: 900, min: "2017-08-10", max: "2026-08-10" }]),
      buildExpectedCoverage(manifestOf(FETCHED))
    );
    expect(coverageFailures(checks)[0]).toMatchObject({ fewerBarsThanExpected: true });
  });
});

describe("buildVerificationReport", () => {
  it("returns GO for a clean, complete backfill", () => {
    const r = report({});
    expect(r.verdict).toBe("GO");
    expect(r.reasons).toEqual([]);
    expect(r.totals).toMatchObject({ equityBarsBefore: 220, equityBarsAfter: 2248, barsAdded: 2028 });
    expect(formatVerificationReport(r)).toContain("VERDICT: GO");
  });

  it("returns NO_GO when the import was a dry run — nothing written proves nothing", () => {
    const r = report({ dryRun: true });
    expect(r.verdict).toBe("NO_GO");
    expect(r.reasons.join(" ")).toContain("dryRun");
  });

  it("returns NO_GO when nothing was actually imported", () => {
    // The trap this whole module exists for: losing nothing while gaining nothing
    // passes every data-loss invariant.
    const unchanged = baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }]);
    const r = report({ before: unchanged, after: unchanged });
    expect(r.verdict).toBe("NO_GO");
    expect(r.dataLoss.symbolsLostBars).toEqual([]);
    expect(r.coverageFailures).toHaveLength(1);
    expect(formatVerificationReport(r)).toContain("coverage shortfalls");
  });

  it("returns NO_GO on data loss even when coverage improved", () => {
    const r = report({
      before: baselineOf([
        { symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" },
        { symbol: "HPG", bars: 215, min: "2025-09-30", max: "2026-08-10" },
      ]),
      after: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
    });
    expect(r.verdict).toBe("NO_GO");
    expect(r.dataLoss.symbolsMissingAfter).toEqual(["HPG"]);
  });

  it("returns NO_GO when the total bar count went down", () => {
    const r = report({
      before: baselineOf([{ symbol: "FPT", bars: 5000, min: "2010-01-04", max: "2026-08-10" }]),
      after: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
      manifest: manifestOf(FETCHED),
    });
    expect(r.verdict).toBe("NO_GO");
    expect(r.reasons.join(" ")).toContain("went DOWN");
  });

  it("reports re-based years explicitly rather than hiding them", () => {
    // A backfill legitimately re-bases values; it must be visible, not silent.
    const r = report({
      before: baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10", years: { "2026": "old" } }]),
      after: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10", years: { "2026": "new" } }]),
    });
    expect(r.rebasedSymbols).toEqual([{ symbol: "FPT", years: ["2026"] }]);
    expect(r.verdict).toBe("GO");
  });

  it("carries fingerprints through so the verdict is tied to specific artifacts", () => {
    expect(report({}).fingerprints).toEqual({ input: "abc123" });
  });
});

describe("date-set coverage — the shape counts and bounds cannot see", () => {
  function manifestWithDays(
    symbol: string,
    bars: number,
    first: string,
    last: string,
    yearDays: Record<string, number[]>
  ): FetchManifest {
    const m = manifestOf([{ symbol, bars, first, last }]);
    m.perSymbol[0]!.yearDays = yearDays;
    return m;
  }

  function afterWithBitmaps(symbol: string, bars: number, min: string, max: string, bitmaps: Record<string, string>) {
    const b = baselineOf([{ symbol, bars, min, max }]);
    b.symbols[0]!.yearDayBitmaps = bitmaps;
    return b;
  }

  it("passes when every fetched date is present in the store", () => {
    const r = report({
      manifest: manifestWithDays("FPT", 3, "2026-01-01", "2026-01-05", { "2026": [1, 3, 5] }),
      after: afterWithBitmaps("FPT", 3, "2026-01-01", "2026-01-05", { "2026": encodeDayBitmap([1, 3, 5]) }),
      before: baselineOf([{ symbol: "FPT", bars: 0, min: "2026-01-01", max: "2026-01-01" }]),
    });
    expect(r.coverageFailures).toEqual([]);
  });

  it("CATCHES a partial import hidden by pre-existing out-of-window bars", () => {
    // Codex's exact counter-example: the store already holds old rows, the import
    // lands only part of the fetch, so total bars and both bounds look correct.
    const r = report({
      manifest: manifestWithDays("FPT", 3, "2026-01-01", "2026-01-05", { "2026": [1, 3, 5] }),
      // Day 3 never landed, but day 2 (pre-existing, not fetched) keeps the count at 3.
      after: afterWithBitmaps("FPT", 3, "2026-01-01", "2026-01-05", { "2026": encodeDayBitmap([1, 2, 5]) }),
      before: baselineOf([{ symbol: "FPT", bars: 1, min: "2026-01-02", max: "2026-01-02" }]),
    });
    expect(r.coverageFailures).toHaveLength(1);
    expect(r.coverageFailures[0]!.fewerBarsThanExpected).toBe(false); // count says fine
    expect(r.coverageFailures[0]!.shallowerThanExpected).toBe(false); // bounds say fine
    expect(r.coverageFailures[0]!.missingFetchedDateYears).toEqual(["2026"]);
    expect(r.verdict).toBe("NO_GO");
    expect(formatVerificationReport(r)).toContain("fetched dates missing");
  });

  it("CATCHES an entire fetched year absent from the store", () => {
    const r = report({
      manifest: manifestWithDays("FPT", 4, "2025-01-01", "2026-01-05", {
        "2025": [1, 2],
        "2026": [1, 5],
      }),
      after: afterWithBitmaps("FPT", 4, "2025-01-01", "2026-01-05", { "2026": encodeDayBitmap([1, 5]) }),
      before: baselineOf([{ symbol: "FPT", bars: 0, min: "2026-01-01", max: "2026-01-01" }]),
    });
    expect(r.coverageFailures[0]!.missingFetchedDateYears).toEqual(["2025"]);
    expect(r.verdict).toBe("NO_GO");
  });

  it("refuses to bless a manifest with no date set at all", () => {
    // An older manifest cannot prove coverage, so it must not be treated as proof.
    const r = report({ manifest: legacyManifest() });
    expect(r.coverageFailures[0]!.dateSetUnprovable).toBe(true);
    expect(r.verdict).toBe("NO_GO");
    expect(formatVerificationReport(r)).toContain("coverage unprovable");
  });
});

describe("proveConvergence", () => {
  const post = () => baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]);

  it("converges when a rerun changed nothing", () => {
    expect(proveConvergence(post(), post())).toEqual({ converged: true, differences: [] });
  });

  it("fails when a rerun added bars — the import is not idempotent", () => {
    const c = proveConvergence(post(), baselineOf([{ symbol: "FPT", bars: 2300, min: "2017-08-10", max: "2026-08-10" }]));
    expect(c.converged).toBe(false);
    expect(c.differences.join(" ")).toContain("equity bars changed");
  });

  it("fails when a rerun rewrote values — non-deterministic writes", () => {
    const c = proveConvergence(
      baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10", years: { "2026": "a" } }]),
      baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10", years: { "2026": "b" } }])
    );
    expect(c.converged).toBe(false);
    expect(c.differences.join(" ")).toContain("values rewritten");
  });

  it("is reported in the verdict when a convergence baseline is supplied", () => {
    const r = buildVerificationReport(
      {
        before: baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }]),
        after: post(),
        manifest: (() => {
          const m = manifestOf(FETCHED);
          m.perSymbol[0]!.yearDays = { "2026": [1] };
          return m;
        })(),
        importWasDryRun: false,
        fingerprints: {},
        convergenceBaseline: baselineOf([{ symbol: "FPT", bars: 9999, min: "2017-08-10", max: "2026-08-10" }]),
      },
      CAPTURED
    );
    expect(r.convergence.checked).toBe(true);
    expect(r.convergence.converged).toBe(false);
    expect(r.verdict).toBe("NO_GO");
    expect(formatVerificationReport(r)).toContain("convergence: FAILED");
  });
});

describe("convergence and value proof are mandatory, not optional", () => {
  it("returns NO_GO when no convergence baseline was supplied", () => {
    // Omitting the check must not silently buy a GO.
    const r = buildVerificationReport(
      {
        before: baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }]),
        after: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
        manifest: manifestOf(FETCHED),
        importWasDryRun: false,
        fingerprints: {},
        storedValueChecksums: { FPT: "md5-FPT" },
      },
      CAPTURED
    );
    expect(r.convergence.checked).toBe(false);
    expect(r.verdict).toBe("NO_GO");
    expect(r.reasons.join(" ")).toContain("Convergence was not checked");
  });

  it("returns NO_GO when stored values differ from the fetched artifact", () => {
    // Every fetched date present, but the values are wrong — date coverage alone
    // would have blessed this.
    const r = report({ storedValueChecksums: { FPT: "something-else" } });
    expect(r.verdict).toBe("NO_GO");
    expect(r.valueMismatches[0]).toContain("stored values differ");
  });

  it("returns NO_GO when no stored value checksums were computed at all", () => {
    const r = buildVerificationReport(
      {
        before: baselineOf([{ symbol: "FPT", bars: 220, min: "2026-01-08", max: "2026-08-10" }]),
        after: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
        manifest: manifestOf(FETCHED),
        importWasDryRun: false,
        fingerprints: {},
        convergenceBaseline: baselineOf([{ symbol: "FPT", bars: 2248, min: "2017-08-10", max: "2026-08-10" }]),
      },
      CAPTURED
    );
    expect(r.verdict).toBe("NO_GO");
    expect(r.valueMismatches.join(" ")).toContain("cannot prove values landed");
  });

  it("returns NO_GO when the manifest has no value checksum to compare against", () => {
    const m = manifestOf(FETCHED);
    delete m.perSymbol[0]!.valueChecksum;
    const r = report({ manifest: m, storedValueChecksums: { FPT: "abc" } });
    expect(r.verdict).toBe("NO_GO");
    expect(r.valueMismatches[0]).toContain("no value checksum");
  });

  it("returns GO only when coverage, values and convergence all pass", () => {
    const r = report({});
    expect(r.verdict).toBe("GO");
    expect(r.convergence).toMatchObject({ checked: true, converged: true });
    expect(r.valueMismatches).toEqual([]);
  });
});
