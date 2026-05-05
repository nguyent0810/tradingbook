/**
 * Import grouped daily OHLCV JSON (from fetch_stock_bars.py) into StockDailyBar.
 *
 * Usage: npx tsx scripts/import-stock-bars.ts [path/to/stock-bars.json]
 * Default: data/stock-bars.json
 *
 * Creates StockSymbol rows if missing (prefer running seed-stock-symbols.ts first).
 */
import "./load-env";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

const DEFAULT_JSON = join(process.cwd(), "data", "stock-bars.json");
const DEFAULT_SOURCE = "vnstock:VCI";

type JsonBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function dateKeyFromTimeMs(ms: number): Date {
  const d = new Date(ms);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function dateDedupeKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Import validation: OHLC strictly positive, high >= low, volume >= 0 */
function validateBar(
  raw: unknown,
  index: number
): { ok: true; bar: JsonBar } | { ok: false; reason: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: `[${index}] not an object` };
  }
  const o = raw as Record<string, unknown>;
  const keys = ["time", "open", "high", "low", "close", "volume"] as const;
  for (const k of keys) {
    if (!(k in o)) {
      return { ok: false, reason: `[${index}] missing "${k}"` };
    }
  }
  const time = o.time;
  const open = o.open;
  const high = o.high;
  const low = o.low;
  const close = o.close;
  const volume = o.volume;

  if (!isFiniteNumber(time)) return { ok: false, reason: `[${index}] invalid time` };
  if (!isFiniteNumber(open) || !isFiniteNumber(high) || !isFiniteNumber(low)) {
    return { ok: false, reason: `[${index}] non-numeric OHLC` };
  }
  if (!isFiniteNumber(close)) return { ok: false, reason: `[${index}] non-numeric close` };
  if (!isFiniteNumber(volume)) return { ok: false, reason: `[${index}] non-numeric volume` };

  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return { ok: false, reason: `[${index}] OHLC must be positive` };
  }
  if (high < low) {
    return { ok: false, reason: `[${index}] high < low` };
  }
  if (volume < 0) {
    return { ok: false, reason: `[${index}] volume < 0` };
  }

  return {
    ok: true,
    bar: { time, open, high, low, close, volume },
  };
}

function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase();
}

async function resolveSymbolId(symbol: string): Promise<string> {
  const sym = normalizeSymbol(symbol);
  const existing = await prisma.stockSymbol.findUnique({
    where: { symbol: sym },
  });
  if (existing) return existing.id;
  const created = await prisma.stockSymbol.create({
    data: {
      symbol: sym,
      active: true,
    },
  });
  return created.id;
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? DEFAULT_JSON;
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected top-level JSON array in ${path}`);
  }

  const totalSymbols = parsed.length;
  let symbolsImported = 0;
  let symbolsFailed = 0;
  let totalBarsUpserted = 0;
  const allDates: Date[] = [];

  for (const entry of parsed) {
    if (entry === null || typeof entry !== "object") {
      symbolsFailed++;
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.symbol !== "string" || !Array.isArray(e.bars)) {
      symbolsFailed++;
      continue;
    }

    const symbolKey = normalizeSymbol(e.symbol);
    let symbolId: string;
    try {
      symbolId = await resolveSymbolId(symbolKey);
    } catch {
      symbolsFailed++;
      continue;
    }

    const seenDates = new Set<string>();
    const validRows: { date: Date; bar: JsonBar }[] = [];

    for (let i = 0; i < e.bars.length; i++) {
      const v = validateBar(e.bars[i], i);
      if (!v.ok) {
        console.error(`Skip ${symbolKey}: ${v.reason}`);
        continue;
      }
      const bar = v.bar;
      const date = dateKeyFromTimeMs(bar.time);
      const dk = dateDedupeKey(date);
      if (seenDates.has(dk)) {
        console.error(`Skip ${symbolKey}: [${i}] duplicate date ${dk} in JSON`);
        continue;
      }
      seenDates.add(dk);
      validRows.push({ date, bar });
    }

    let upsertedForSymbol = 0;
    const CONCURRENCY = 16;
    for (let i = 0; i < validRows.length; i += CONCURRENCY) {
      const batch = validRows.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(({ date, bar }) =>
          prisma.stockDailyBar.upsert({
            where: {
              symbolId_date: {
                symbolId,
                date,
              },
            },
            create: {
              symbolId,
              date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              source: DEFAULT_SOURCE,
            },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              source: DEFAULT_SOURCE,
            },
          })
        )
      );
      upsertedForSymbol += batch.length;
      for (const { date } of batch) {
        allDates.push(date);
      }
    }

    if (upsertedForSymbol > 0) {
      symbolsImported++;
    } else if (e.bars.length === 0) {
      symbolsFailed++;
    } else {
      symbolsFailed++;
    }
    totalBarsUpserted += upsertedForSymbol;
  }

  allDates.sort((a, b) => a.getTime() - b.getTime());
  const minD = allDates[0];
  const maxD = allDates[allDates.length - 1];

  console.error("");
  console.error("=== import-stock-bars summary ===");
  console.error(`Total symbols (in file): ${totalSymbols}`);
  console.error(`Symbols imported (≥1 bar saved): ${symbolsImported}`);
  console.error(`Symbols failed / empty:       ${symbolsFailed}`);
  console.error(`Total bars upserted:            ${totalBarsUpserted}`);
  if (minD && maxD) {
    console.error(
      `Date range:                   ${minD.toISOString().slice(0, 10)} .. ${maxD.toISOString().slice(0, 10)} (UTC)`
    );
    console.error(`Latest bar date:               ${maxD.toISOString().slice(0, 10)} (UTC)`);
  } else {
    console.error("Date range:                   (none)");
    console.error("Latest bar date:              —");
  }
  console.error(`Source tag:                   ${DEFAULT_SOURCE}`);
  console.error(`File:                         ${path}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
