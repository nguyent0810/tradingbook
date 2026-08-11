import { describe, expect, it } from "vitest";
import {
  chunk,
  isoDay,
  parseNdjsonLine,
  prepareSymbolRows,
  summarizeImport,
  utcDayFromMs,
  validateBar,
  isValidIsoDate,
  reconcileInputAgainstManifest,
  inputMatchesManifest,
  formatInputReconciliation,
  findDuplicateSymbols,
  type BackfillBar,
} from "./backfill-import";

function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}
function bar(over: Partial<BackfillBar> = {}): BackfillBar {
  return { time: ms("2026-08-10"), open: 71, high: 72, low: 70, close: 71.5, volume: 1_000, ...over };
}

describe("validateBar", () => {
  it("accepts a coherent bar", () => {
    expect(validateBar(bar(), 0)).toMatchObject({ ok: true });
  });

  it.each(["time", "open", "high", "low", "close", "volume"] as const)(
    "rejects a non-finite %s",
    (field) => {
      const r = validateBar({ ...bar(), [field]: Number.NaN }, 3);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(field);
    }
  );

  it("rejects high < low — an incoherent bar, not just an odd one", () => {
    expect(validateBar(bar({ high: 60, low: 70 }), 0)).toMatchObject({ ok: false });
  });

  it("rejects a zero or negative price, which would poison MA/ATR downstream", () => {
    expect(validateBar(bar({ close: 0 }), 0)).toMatchObject({ ok: false });
    expect(validateBar(bar({ open: -1 }), 0)).toMatchObject({ ok: false });
  });

  it("rejects negative volume but allows zero (a real halted session)", () => {
    expect(validateBar(bar({ volume: -1 }), 0)).toMatchObject({ ok: false });
    expect(validateBar(bar({ volume: 0 }), 0)).toMatchObject({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateBar(null, 0)).toMatchObject({ ok: false });
    expect(validateBar(42, 0)).toMatchObject({ ok: false });
  });
});

describe("parseNdjsonLine", () => {
  it("parses a valid line and upper-cases the symbol", () => {
    const r = parseNdjsonLine(JSON.stringify({ symbol: "fpt", bars: [bar()] }), 1);
    expect(r).toMatchObject({ ok: true, symbol: "FPT" });
  });
  it("rejects blank lines, bad JSON, missing symbol and non-array bars", () => {
    expect(parseNdjsonLine("   ", 1)).toMatchObject({ ok: false });
    expect(parseNdjsonLine("{not json", 2)).toMatchObject({ ok: false });
    expect(parseNdjsonLine(JSON.stringify({ bars: [] }), 3)).toMatchObject({ ok: false });
    expect(parseNdjsonLine(JSON.stringify({ symbol: "FPT", bars: 5 }), 4)).toMatchObject({ ok: false });
  });
  it("accepts a symbol with zero bars — emptiness is reconciliation's call, not the parser's", () => {
    expect(parseNdjsonLine(JSON.stringify({ symbol: "FPT", bars: [] }), 1)).toMatchObject({
      ok: true,
      bars: [],
    });
  });
});

describe("utcDayFromMs", () => {
  it("truncates an intraday timestamp to its UTC calendar day", () => {
    expect(isoDay(utcDayFromMs(Date.parse("2026-08-10T14:30:00.000Z")))).toBe("2026-08-10");
  });
});

describe("prepareSymbolRows", () => {
  it("sorts ascending and reports nothing skipped for clean input", () => {
    const p = prepareSymbolRows("FPT", [
      bar({ time: ms("2026-08-10") }),
      bar({ time: ms("2026-08-03") }),
    ]);
    expect(p.rows.map((r) => isoDay(r.date))).toEqual(["2026-08-03", "2026-08-10"]);
    expect(p.skipped).toEqual([]);
  });

  it("keeps the LAST bar when a date repeats, and counts the duplicate", () => {
    const p = prepareSymbolRows("FPT", [
      bar({ time: ms("2026-08-10"), close: 1 }),
      bar({ time: ms("2026-08-10"), close: 2 }),
    ]);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.bar.close).toBe(2);
    expect(p.duplicateDates).toBe(1);
  });

  it("drops invalid bars without discarding the whole symbol", () => {
    const p = prepareSymbolRows("FPT", [bar(), { time: ms("2026-08-11"), open: "x" }, bar({ time: ms("2026-08-12") })]);
    expect(p.rows).toHaveLength(2);
    expect(p.skipped).toHaveLength(1);
  });

  it("treats intraday timestamps on the same day as one date", () => {
    const p = prepareSymbolRows("FPT", [
      bar({ time: Date.parse("2026-08-10T02:00:00.000Z") }),
      bar({ time: Date.parse("2026-08-10T09:00:00.000Z") }),
    ]);
    expect(p.rows).toHaveLength(1);
  });
});

describe("chunk", () => {
  it("splits evenly and keeps the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns nothing for an empty input", () => expect(chunk([], 10)).toEqual([]));
  it("refuses a non-positive size rather than looping forever", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("summarizeImport", () => {
  it("aggregates counts and the overall date span", () => {
    const s = summarizeImport([
      { symbol: "FPT", barsWritten: 2249, firstDate: "2017-08-10", lastDate: "2026-08-10", skipped: 0 },
      { symbol: "HPG", barsWritten: 1500, firstDate: "2019-01-02", lastDate: "2026-08-10", skipped: 3 },
      { symbol: "GONE", barsWritten: 0, firstDate: null, lastDate: null, skipped: 0 },
    ]);
    expect(s).toMatchObject({
      symbols: 3,
      symbolsWithBars: 2,
      totalBars: 3749,
      totalSkipped: 3,
      earliest: "2017-08-10",
      latest: "2026-08-10",
    });
  });
  it("handles an all-empty result set without throwing", () => {
    expect(summarizeImport([])).toMatchObject({ symbols: 0, earliest: null, latest: null });
  });
});

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => expect(isValidIsoDate("2026-08-10")).toBe(true));
  it.each(["2026-8-10", "20260810", "2026-08-10T00:00:00Z", "", "not-a-date", null, 42])(
    "rejects %j",
    (v) => expect(isValidIsoDate(v)).toBe(false)
  );
  it("rejects a well-formed but non-existent date", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
  });
  it("accepts a real leap day", () => expect(isValidIsoDate("2024-02-29")).toBe(true));
});

describe("reconcileInputAgainstManifest", () => {
  const mf = (rows: Array<{ symbol: string; bars: number; first: string; last: string }>) => ({
    perSymbol: rows.map((r) => ({
      symbol: r.symbol,
      bars: r.bars,
      firstTimeMs: ms(r.first),
      lastTimeMs: ms(r.last),
    })),
  });

  it("passes when the input is exactly the fetch the manifest describes", () => {
    const r = reconcileInputAgainstManifest(
      [{ symbol: "FPT", bars: 2248, firstDate: "2017-08-10", lastDate: "2026-08-10" }],
      mf([{ symbol: "FPT", bars: 2248, first: "2017-08-10", last: "2026-08-10" }])
    );
    expect(inputMatchesManifest(r)).toBe(true);
    expect(formatInputReconciliation(r)).toContain("matches the manifest exactly");
  });

  it("catches a TRUNCATED input file — the manifest is fine, the data is not", () => {
    const r = reconcileInputAgainstManifest(
      [{ symbol: "FPT", bars: 2248, firstDate: "2017-08-10", lastDate: "2026-08-10" }],
      mf([
        { symbol: "FPT", bars: 2248, first: "2017-08-10", last: "2026-08-10" },
        { symbol: "HPG", bars: 2248, first: "2017-08-10", last: "2026-08-10" },
      ])
    );
    expect(r.missingFromInput).toEqual(["HPG"]);
    expect(inputMatchesManifest(r)).toBe(false);
    expect(formatInputReconciliation(r)).toContain("absent from input");
  });

  it("catches an input carrying a symbol the manifest never mentions", () => {
    const r = reconcileInputAgainstManifest(
      [
        { symbol: "FPT", bars: 10, firstDate: "2026-08-01", lastDate: "2026-08-10" },
        { symbol: "SNEAKY", bars: 10, firstDate: "2026-08-01", lastDate: "2026-08-10" },
      ],
      mf([{ symbol: "FPT", bars: 10, first: "2026-08-01", last: "2026-08-10" }])
    );
    expect(r.extraInInput).toEqual(["SNEAKY"]);
    expect(inputMatchesManifest(r)).toBe(false);
  });

  it("catches a stale input: right symbols, wrong bar count", () => {
    const r = reconcileInputAgainstManifest(
      [{ symbol: "FPT", bars: 220, firstDate: "2026-01-08", lastDate: "2026-08-10" }],
      mf([{ symbol: "FPT", bars: 2248, first: "2017-08-10", last: "2026-08-10" }])
    );
    expect(r.mismatched).toHaveLength(1);
    expect(r.mismatched[0]).toMatchObject({ manifestBars: 2248, inputBars: 220 });
    expect(inputMatchesManifest(r)).toBe(false);
  });

  it("catches a date-span mismatch even when the count agrees", () => {
    const r = reconcileInputAgainstManifest(
      [{ symbol: "FPT", bars: 2248, firstDate: "2018-01-02", lastDate: "2026-08-10" }],
      mf([{ symbol: "FPT", bars: 2248, first: "2017-08-10", last: "2026-08-10" }])
    );
    expect(r.mismatched).toHaveLength(1);
    expect(inputMatchesManifest(r)).toBe(false);
  });
});

describe("findDuplicateSymbols", () => {
  it("returns nothing for a unique list", () => {
    expect(findDuplicateSymbols(["FPT", "VCB", "HPG"])).toEqual([]);
  });
  it("names each repeated symbol once, sorted", () => {
    expect(findDuplicateSymbols(["VCB", "FPT", "VCB", "FPT", "HPG"])).toEqual(["FPT", "VCB"]);
  });
  it("catches the case reconciliation cannot: a repeat whose LAST entry matches the manifest", () => {
    // seenMap keys by symbol, so the duplicate collapses and the check passes —
    // while the writer would still process both lines.
    expect(findDuplicateSymbols(["FPT", "FPT"])).toEqual(["FPT"]);
  });
});
