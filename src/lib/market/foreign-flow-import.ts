import type { ForeignCaptureMethod, ForeignDataQuality } from "@/generated/prisma/client";
import { classifyForeignDataQuality } from "@/lib/market/classify-foreign-data-quality";
import {
  FOREIGN_CAPTURE_METHOD,
  FOREIGN_FLOW_SOURCE,
  type ForeignSnapshotFile,
  type ForeignSnapshotRow,
  type ForeignSnapshotSymbolEntry,
} from "@/lib/market/foreign-flow-types";
import { parseSessionDateUtc, sessionDatesEqual } from "@/lib/market/session-date";

export type ForeignImportRow = {
  symbol: string;
  sessionDate: Date;
  buyVolume: number | null;
  sellVolume: number | null;
  netVolume: number | null;
  buyValueVnd: number | null;
  sellValueVnd: number | null;
  netValueVnd: number | null;
  source: string;
  captureMethod: ForeignCaptureMethod;
  dataQuality: ForeignDataQuality;
};

export type ForeignImportSummary = {
  sessionDate: string;
  symbolsTotal: number;
  rowsUpserted: number;
  rowsSkipped: number;
  qualityCounts: Record<ForeignDataQuality, number>;
  warnings: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function parseRow(raw: unknown): ForeignSnapshotRow | null {
  if (!isRecord(raw)) return null;
  const pick = (k: keyof ForeignSnapshotRow): number | null => {
    const v = raw[k];
    return isFiniteNumber(v) ? v : null;
  };
  return {
    buyVolume: pick("buyVolume"),
    sellVolume: pick("sellVolume"),
    netVolume: pick("netVolume"),
    buyValueVnd: pick("buyValueVnd"),
    sellValueVnd: pick("sellValueVnd"),
    netValueVnd: pick("netValueVnd"),
  };
}

function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase();
}

const EXCLUDED_SYMBOLS = new Set(["VNINDEX", "HOSE", "HNX", "UPCOM"]);

export function parseForeignSnapshotFile(raw: unknown): ForeignSnapshotFile {
  if (!isRecord(raw) || !isRecord(raw.meta) || !Array.isArray(raw.symbols)) {
    throw new Error("Invalid foreign snapshot JSON — expected { meta, symbols }");
  }
  const meta = raw.meta;
  if (meta.source !== FOREIGN_FLOW_SOURCE) {
    throw new Error(`Invalid meta.source — expected ${FOREIGN_FLOW_SOURCE}`);
  }
  if (meta.captureMethod !== FOREIGN_CAPTURE_METHOD) {
    throw new Error(`Invalid meta.captureMethod — expected ${FOREIGN_CAPTURE_METHOD}`);
  }
  if (typeof meta.sessionDate !== "string") {
    throw new Error("Invalid meta.sessionDate");
  }
  parseSessionDateUtc(meta.sessionDate);

  return raw as ForeignSnapshotFile;
}

export function assertExpectSession(
  file: ForeignSnapshotFile,
  expectSession: string | undefined
): void {
  if (!expectSession) return;
  if (file.meta.sessionDate !== expectSession) {
    throw new Error(
      `Session mismatch: file meta.sessionDate=${file.meta.sessionDate} expect=${expectSession}`
    );
  }
}

export function mapForeignImportRows(
  file: ForeignSnapshotFile,
  options?: { excludeSymbols?: Set<string> }
): { rows: ForeignImportRow[]; skipped: number; warnings: string[] } {
  const exclude = options?.excludeSymbols ?? EXCLUDED_SYMBOLS;
  const sessionDate = parseSessionDateUtc(file.meta.sessionDate);
  const rows: ForeignImportRow[] = [];
  let skipped = 0;
  const warnings = [...(file.meta.warnings ?? [])];

  for (const entry of file.symbols as ForeignSnapshotSymbolEntry[]) {
    const symbol = normalizeSymbol(entry.symbol);
    if (exclude.has(symbol)) {
      skipped++;
      continue;
    }
    if (entry.status !== "ok" || !entry.row) {
      skipped++;
      if (entry.error) {
        warnings.push(`${symbol}: ${entry.error}`);
      }
      continue;
    }

    const row = entry.row;
    const withNet: ForeignSnapshotRow = {
      ...row,
      netVolume:
        row.netVolume ??
        (row.buyVolume != null && row.sellVolume != null
          ? row.buyVolume - row.sellVolume
          : null),
      netValueVnd:
        row.netValueVnd ??
        (row.buyValueVnd != null && row.sellValueVnd != null
          ? row.buyValueVnd - row.sellValueVnd
          : null),
    };

    rows.push({
      symbol,
      sessionDate,
      buyVolume: withNet.buyVolume,
      sellVolume: withNet.sellVolume,
      netVolume: withNet.netVolume,
      buyValueVnd: withNet.buyValueVnd,
      sellValueVnd: withNet.sellValueVnd,
      netValueVnd: withNet.netValueVnd,
      source: FOREIGN_FLOW_SOURCE,
      captureMethod: "PRICE_BOARD_EOD_SNAPSHOT",
      dataQuality: classifyForeignDataQuality(withNet),
    });
  }

  return { rows, skipped, warnings };
}

export function summarizeForeignImport(
  file: ForeignSnapshotFile,
  rows: readonly ForeignImportRow[],
  skipped: number,
  warnings: readonly string[]
): ForeignImportSummary {
  const qualityCounts: Record<ForeignDataQuality, number> = {
    OK: 0,
    ALL_ZERO: 0,
    PARTIAL: 0,
    ERROR: 0,
  };
  for (const r of rows) {
    qualityCounts[r.dataQuality]++;
  }

  return {
    sessionDate: file.meta.sessionDate,
    symbolsTotal: file.symbols.length,
    rowsUpserted: rows.length,
    rowsSkipped: skipped,
    qualityCounts,
    warnings: [...warnings],
  };
}

export function validateSessionDateArg(day: string, expectedFromDb: Date | null): void {
  const parsed = parseSessionDateUtc(day);
  if (expectedFromDb && !sessionDatesEqual(parsed, expectedFromDb)) {
    throw new Error(
      `Session ${day} does not match expected VNINDEX session ${expectedFromDb.toISOString().slice(0, 10)}`
    );
  }
}
