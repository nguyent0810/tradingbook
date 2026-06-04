/**
 * Import VCI price_board foreign snapshot JSON into foreign_trade_daily.
 *
 * Usage:
 *   npx tsx scripts/import-foreign-flow.ts [path/to/foreign-snapshot.json]
 *   npx tsx scripts/import-foreign-flow.ts data/foreign-snapshot.json --expect-session 2026-06-03
 */
import "./load-env";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import {
  assertExpectSession,
  mapForeignImportRows,
  parseForeignSnapshotFile,
  summarizeForeignImport,
} from "../src/lib/market/foreign-flow-import";

const DEFAULT_JSON = join(process.cwd(), "data", "foreign-snapshot.json");

function parseExpectSession(argv: string[]): string | undefined {
  const flag = argv.find((a) => a.startsWith("--expect-session="));
  if (flag) return flag.slice("--expect-session=".length);
  const idx = argv.indexOf("--expect-session");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase();
}

async function resolveSymbolId(symbol: string): Promise<string> {
  const sym = normalizeSymbol(symbol);
  const existing = await prisma.stockSymbol.findUnique({ where: { symbol: sym } });
  if (existing) return existing.id;
  const created = await prisma.stockSymbol.create({
    data: { symbol: sym, active: true },
  });
  return created.id;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const path = argv.find((a) => !a.startsWith("--")) ?? DEFAULT_JSON;
  const expectSession = parseExpectSession(argv);

  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  const file = parseForeignSnapshotFile(raw);
  assertExpectSession(file, expectSession);

  const { rows, skipped, warnings } = mapForeignImportRows(file);
  const capturedAt = new Date(file.meta.fetchedAt);

  for (const row of rows) {
    const symbolId = await resolveSymbolId(row.symbol);
    await prisma.foreignTradeDaily.upsert({
      where: {
        symbolId_sessionDate: {
          symbolId,
          sessionDate: row.sessionDate,
        },
      },
      create: {
        symbolId,
        sessionDate: row.sessionDate,
        buyVolume: row.buyVolume,
        sellVolume: row.sellVolume,
        netVolume: row.netVolume,
        buyValueVnd: row.buyValueVnd,
        sellValueVnd: row.sellValueVnd,
        netValueVnd: row.netValueVnd,
        source: row.source,
        captureMethod: row.captureMethod,
        capturedAt,
        dataQuality: row.dataQuality,
      },
      update: {
        buyVolume: row.buyVolume,
        sellVolume: row.sellVolume,
        netVolume: row.netVolume,
        buyValueVnd: row.buyValueVnd,
        sellValueVnd: row.sellValueVnd,
        netValueVnd: row.netValueVnd,
        source: row.source,
        captureMethod: row.captureMethod,
        capturedAt,
        dataQuality: row.dataQuality,
      },
    });
  }

  const summary = summarizeForeignImport(file, rows, skipped, warnings);
  console.error("");
  console.error("=== import-foreign-flow summary ===");
  console.error(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
