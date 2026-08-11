/**
 * Post-import verification for the backfill.
 *
 * Two independent questions, both of which must be answered before a backfill is
 * called successful, and which fail in different ways:
 *
 *   1. Did we LOSE anything? — answered by the Gate 1 baseline invariants
 *      (`compareBarBaselines` / `hasDataLoss`): no symbol or index gone, no year
 *      removed, no stored date dropped, no date-span regression.
 *   2. Did we actually GAIN what we set out to gain? — answered here. A run that
 *      loses nothing but also imports nothing passes question 1 perfectly. The
 *      expected coverage comes from the fetch manifest, which was itself verified
 *      against the input file before any write.
 *
 * The verdict is deliberately conservative: anything unexplained is NO_GO. A
 * backfill that cannot be proven correct is not one to build analysis on.
 */
import type { BarBaseline, YearDayBitmaps } from "./bar-baseline";
import {
  compareBarBaselines,
  encodeDayBitmap,
  hasDataLoss,
  isDaySubset,
  type BaselineComparison,
} from "./bar-baseline";
import { msToIsoDate, type FetchManifest } from "./fetch-manifest";

export type ExpectedCoverage = {
  symbol: string;
  expectedBars: number;
  expectedFirst: string | null;
  expectedLast: string | null;
  /** Exact fetched dates, folded into per-year bitmaps. */
  expectedDayBitmaps: YearDayBitmaps;
};

/** What the verified fetch said should now be in the database, per symbol. */
export function buildExpectedCoverage(manifest: FetchManifest): ExpectedCoverage[] {
  return manifest.perSymbol.map((m) => {
    const expectedDayBitmaps: YearDayBitmaps = {};
    for (const [year, days] of Object.entries(m.yearDays ?? {})) {
      expectedDayBitmaps[year] = encodeDayBitmap(days ?? []);
    }
    return {
      symbol: m.symbol,
      expectedBars: m.bars,
      expectedFirst: msToIsoDate(m.firstTimeMs),
      expectedLast: msToIsoDate(m.lastTimeMs),
      expectedDayBitmaps,
    };
  });
}

export type CoverageCheck = {
  symbol: string;
  storedBars: number | null;
  storedFirst: string | null;
  storedLast: string | null;
  expectedBars: number;
  expectedFirst: string | null;
  expectedLast: string | null;
  missingFromStore: boolean;
  /** Stored history does not reach as far back as the fetch did. */
  shallowerThanExpected: boolean;
  /** Stored history stops short of the fetch's newest bar. */
  staleThanExpected: boolean;
  /** Fewer rows than the fetch contained — the import did not land in full. */
  fewerBarsThanExpected: boolean;
  /**
   * Fetched dates that are not in the store. The only check that actually proves
   * the artifact landed; counts and bounds can both look right while dates are missing.
   */
  missingFetchedDateYears: string[];
  /** The manifest predates date-set tracking, so coverage cannot be proven. */
  dateSetUnprovable: boolean;
};

export function verifyCoverage(
  after: BarBaseline,
  expected: readonly ExpectedCoverage[]
): CoverageCheck[] {
  const stored = new Map(after.symbols.map((r) => [r.symbol, r]));
  return expected.map((e) => {
    const s = stored.get(e.symbol);
    if (!s) {
      return {
        symbol: e.symbol,
        storedBars: null,
        storedFirst: null,
        storedLast: null,
        expectedBars: e.expectedBars,
        expectedFirst: e.expectedFirst,
        expectedLast: e.expectedLast,
        missingFromStore: true,
        shallowerThanExpected: false,
        staleThanExpected: false,
        fewerBarsThanExpected: false,
        missingFetchedDateYears: [],
        dateSetUnprovable: false,
      };
    }
    return {
      symbol: e.symbol,
      storedBars: s.barCount,
      storedFirst: s.minDate,
      storedLast: s.maxDate,
      expectedBars: e.expectedBars,
      expectedFirst: e.expectedFirst,
      expectedLast: e.expectedLast,
      missingFromStore: false,
      shallowerThanExpected:
        e.expectedFirst != null && s.minDate != null && s.minDate > e.expectedFirst,
      staleThanExpected:
        e.expectedLast != null && s.maxDate != null && s.maxDate < e.expectedLast,
      // `>=` not `===`: the store legitimately holds bars the fetch window did
      // not cover, so only a shortfall is a failure. This alone is NOT sufficient
      // — see missingFetchedDateYears.
      fewerBarsThanExpected: s.barCount < e.expectedBars,
      missingFetchedDateYears: Object.keys(e.expectedDayBitmaps)
        .filter((y) => {
          const stored = s.yearDayBitmaps?.[y];
          if (!stored) return true; // a fetched year absent from the store entirely
          return !isDaySubset(e.expectedDayBitmaps[y]!, stored);
        })
        .sort(),
      dateSetUnprovable: Object.keys(e.expectedDayBitmaps).length === 0 && e.expectedBars > 0,
    };
  });
}

export function coverageFailures(checks: readonly CoverageCheck[]): CoverageCheck[] {
  return checks.filter(
    (c) =>
      c.missingFromStore ||
      c.shallowerThanExpected ||
      c.staleThanExpected ||
      c.fewerBarsThanExpected ||
      c.missingFetchedDateYears.length > 0 ||
      c.dateSetUnprovable
  );
}

/**
 * Fixed-point proof for a rerun/resume.
 *
 * Compares a previously captured post-import baseline against the current one,
 * ignoring volatile capture metadata. An idempotent import re-run must leave the
 * database byte-identical; anything else means the operation is not converging
 * and a second run is not safe.
 */
export function proveConvergence(
  firstPostImport: BarBaseline,
  current: BarBaseline
): { converged: boolean; differences: string[] } {
  const differences: string[] = [];
  const cmp = compareBarBaselines(firstPostImport, current);

  if (cmp.equityBarsAfter !== cmp.equityBarsBefore) {
    differences.push(`equity bars changed ${cmp.equityBarsBefore} → ${cmp.equityBarsAfter}`);
  }
  if (cmp.indexBarsAfter !== cmp.indexBarsBefore) {
    differences.push(`index bars changed ${cmp.indexBarsBefore} → ${cmp.indexBarsAfter}`);
  }
  if (cmp.symbolsGained > 0) differences.push(`${cmp.symbolsGained} symbol(s) gained bars on rerun`);
  if (cmp.symbolsNewAfter.length > 0) {
    differences.push(`${cmp.symbolsNewAfter.length} new symbol(s) appeared on rerun`);
  }
  // Values changing on a rerun of the same artifact means the write is not
  // deterministic — a stronger failure than merely not converging.
  if (cmp.symbolsWithRebasedYears.length > 0) {
    differences.push(
      `${cmp.symbolsWithRebasedYears.length} symbol(s) had values rewritten on rerun`
    );
  }
  if (hasDataLoss(cmp)) differences.push("rerun lost data");

  return { converged: differences.length === 0, differences };
}

export type VerificationInputs = {
  before: BarBaseline;
  after: BarBaseline;
  manifest: FetchManifest;
  /** From the import report. A dry run proves nothing about the database. */
  importWasDryRun: boolean;
  fingerprints: Record<string, string>;
  /** Post-import baseline from an earlier run, for the fixed-point check. */
  convergenceBaseline?: BarBaseline;
  /**
   * Per-symbol md5 computed from STORED rows restricted to the fetched dates,
   * to be compared against the manifest's own checksum.
   */
  storedValueChecksums?: Record<string, string | null>;
};

export type VerificationReport = {
  verdict: "GO" | "NO_GO";
  reasons: string[];
  capturedAt: string;
  fingerprints: Record<string, string>;
  totals: {
    equityBarsBefore: number;
    equityBarsAfter: number;
    barsAdded: number;
    symbolsGained: number;
    symbolsWithRebasedYears: number;
  };
  dataLoss: BaselineComparison;
  coverageFailures: CoverageCheck[];
  convergence: { checked: boolean; converged: boolean; differences: string[] };
  valueMismatches: string[];
  /** Expected during a backfill; reported so it is acknowledged, never silent. */
  rebasedSymbols: Array<{ symbol: string; years: string[] }>;
};

export function buildVerificationReport(
  inputs: VerificationInputs,
  capturedAt: string
): VerificationReport {
  const cmp = compareBarBaselines(inputs.before, inputs.after);
  const failures = coverageFailures(verifyCoverage(inputs.after, buildExpectedCoverage(inputs.manifest)));
  const reasons: string[] = [];

  if (inputs.importWasDryRun) {
    reasons.push("Import report says dryRun — nothing was written, so nothing is verified.");
  }
  if (hasDataLoss(cmp)) {
    reasons.push(
      `Data loss detected: ${cmp.symbolsLostBars.length} symbols lost bars, ` +
        `${cmp.symbolsMissingAfter.length} disappeared, ` +
        `${cmp.symbolsWithRemovedYears.length} lost a year, ` +
        `${cmp.symbolsWithFewerRowsInYear.length} lost stored dates, ` +
        `${cmp.symbolsWithRegressedDates.length} regressed a date bound, ` +
        `${cmp.indexesWithLoss.length} index issues.`
    );
  }
  if (failures.length > 0) {
    reasons.push(
      `${failures.length} symbol(s) did not reach the coverage the verified fetch contained.`
    );
  }
  const convergence = inputs.convergenceBaseline
    ? { checked: true, ...proveConvergence(inputs.convergenceBaseline, inputs.after) }
    : { checked: false, converged: false, differences: [] };
  if (!convergence.checked) {
    // An unproven fixed point is not a passing one. Without this, omitting the
    // convergence baseline would silently buy a GO.
    reasons.push("Convergence was not checked — supply --convergence-baseline. A GO requires it.");
  } else if (!convergence.converged) {
    reasons.push(`Rerun did not converge: ${convergence.differences.join("; ")}.`);
  }

  const valueMismatches: string[] = [];
  if (inputs.storedValueChecksums) {
    for (const m of inputs.manifest.perSymbol) {
      if (!m.valueChecksum) {
        valueMismatches.push(`${m.symbol}: manifest carries no value checksum`);
        continue;
      }
      const stored = inputs.storedValueChecksums[m.symbol];
      if (stored == null) {
        valueMismatches.push(`${m.symbol}: no stored rows for the fetched dates`);
      } else if (stored !== m.valueChecksum) {
        valueMismatches.push(
          `${m.symbol}: stored values differ from the fetched artifact ` +
            `(${stored.slice(0, 12)} vs ${m.valueChecksum.slice(0, 12)})`
        );
      }
    }
  } else {
    valueMismatches.push("Stored value checksums were not computed — cannot prove values landed.");
  }
  if (valueMismatches.length > 0) {
    reasons.push(`Value verification failed for ${valueMismatches.length} case(s).`);
  }
  if (inputs.after.totals.equityBars < inputs.before.totals.equityBars) {
    reasons.push(
      `Total equity bars went DOWN (${inputs.before.totals.equityBars} → ${inputs.after.totals.equityBars}).`
    );
  }

  return {
    verdict: reasons.length === 0 ? "GO" : "NO_GO",
    reasons,
    capturedAt,
    fingerprints: inputs.fingerprints,
    totals: {
      equityBarsBefore: inputs.before.totals.equityBars,
      equityBarsAfter: inputs.after.totals.equityBars,
      barsAdded: inputs.after.totals.equityBars - inputs.before.totals.equityBars,
      symbolsGained: cmp.symbolsGained,
      symbolsWithRebasedYears: cmp.symbolsWithRebasedYears.length,
    },
    dataLoss: cmp,
    coverageFailures: failures,
    convergence,
    valueMismatches,
    rebasedSymbols: cmp.symbolsWithRebasedYears.map((d) => ({
      symbol: d.symbol,
      years: d.rebasedYears,
    })),
  };
}

export function formatVerificationReport(r: VerificationReport): string {
  const lines: string[] = [];
  lines.push("=== backfill verification ===");
  lines.push(
    `equity bars: ${r.totals.equityBarsBefore} → ${r.totals.equityBarsAfter} ` +
      `(${r.totals.barsAdded >= 0 ? "+" : ""}${r.totals.barsAdded})`
  );
  lines.push(`symbols gaining bars: ${r.totals.symbolsGained}`);
  lines.push(`symbols with re-based years: ${r.totals.symbolsWithRebasedYears}`);

  if (r.coverageFailures.length > 0) {
    lines.push("");
    lines.push("coverage shortfalls:");
    for (const c of r.coverageFailures.slice(0, 20)) {
      const why = [
        c.missingFromStore ? "absent from store" : null,
        c.shallowerThanExpected ? `stored starts ${c.storedFirst}, fetch had ${c.expectedFirst}` : null,
        c.staleThanExpected ? `stored ends ${c.storedLast}, fetch had ${c.expectedLast}` : null,
        c.fewerBarsThanExpected ? `stored ${c.storedBars} bars, fetch had ${c.expectedBars}` : null,
        c.missingFetchedDateYears.length
          ? `fetched dates missing in year(s) ${c.missingFetchedDateYears.join(",")}`
          : null,
        c.dateSetUnprovable ? "manifest carries no date set — coverage unprovable" : null,
      ]
        .filter(Boolean)
        .join("; ");
      lines.push(`   ${c.symbol}: ${why}`);
    }
    if (r.coverageFailures.length > 20) {
      lines.push(`   … and ${r.coverageFailures.length - 20} more`);
    }
  }

  if (r.valueMismatches.length > 0) {
    lines.push("");
    lines.push("value verification:");
    for (const m of r.valueMismatches.slice(0, 10)) lines.push(`   ${m}`);
  }

  if (r.convergence.checked) {
    lines.push("");
    lines.push(
      r.convergence.converged
        ? "convergence: rerun changed nothing — fixed point reached"
        : `convergence: FAILED — ${r.convergence.differences.join("; ")}`
    );
  }

  lines.push("");
  lines.push(`VERDICT: ${r.verdict}`);
  for (const reason of r.reasons) lines.push(`  - ${reason}`);
  return lines.join("\n");
}
