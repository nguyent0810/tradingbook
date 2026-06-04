import { describe, expect, it } from "vitest";
import {
  assertExpectSession,
  mapForeignImportRows,
  parseForeignSnapshotFile,
  summarizeForeignImport,
} from "@/lib/market/foreign-flow-import";

const FIXTURE = {
  meta: {
    source: "vnstock:VCI",
    captureMethod: "price_board_eod_snapshot",
    fetchedAt: "2026-06-03T12:00:00.000Z",
    sessionDate: "2026-06-03",
    symbolCount: 2,
    rowCount: 2,
    batchSize: 10,
    sleepSec: 3.2,
    warnings: [],
  },
  symbols: [
    {
      symbol: "VIC",
      status: "ok",
      error: null,
      sessionHint: "20260603 03:44:42",
      row: {
        buyVolume: 100,
        sellVolume: 200,
        netVolume: -100,
        buyValueVnd: 1_000_000,
        sellValueVnd: 2_000_000,
        netValueVnd: -1_000_000,
      },
    },
    {
      symbol: "VNINDEX",
      status: "ok",
      error: null,
      sessionHint: null,
      row: {
        buyVolume: 0,
        sellVolume: 0,
        netVolume: 0,
        buyValueVnd: 0,
        sellValueVnd: 0,
        netValueVnd: 0,
      },
    },
  ],
} as const;

describe("foreign-flow-import", () => {
  it("parses snapshot file and maps import rows", () => {
    const file = parseForeignSnapshotFile(FIXTURE);
    const { rows, skipped } = mapForeignImportRows(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe("VIC");
    expect(rows[0]?.dataQuality).toBe("OK");
    expect(rows[0]?.captureMethod).toBe("PRICE_BOARD_EOD_SNAPSHOT");
    expect(skipped).toBe(1);
  });

  it("throws on session mismatch", () => {
    const file = parseForeignSnapshotFile(FIXTURE);
    expect(() => assertExpectSession(file, "2026-06-02")).toThrow(/Session mismatch/);
  });

  it("summarizes quality counts", () => {
    const file = parseForeignSnapshotFile(FIXTURE);
    const { rows, skipped, warnings } = mapForeignImportRows(file);
    const summary = summarizeForeignImport(file, rows, skipped, warnings);
    expect(summary.rowsUpserted).toBe(1);
    expect(summary.qualityCounts.OK).toBe(1);
  });
});
