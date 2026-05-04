/**
 * Upsert normalized OHLCV JSON (from fetch_vnindex.py) into IndexDailyBar.
 *
 * Usage: npx tsx scripts/import-bars.ts [path/to/bars.json]
 * Default path: data/vnindex.json
 *
 * Requires DATABASE_URL (see scripts/load-env.ts: `.env` + `.env.local`)
 */
import "./load-env";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

const DEFAULT_JSON = join(process.cwd(), "data", "vnindex.json");
const DEFAULT_SYMBOL = "VNINDEX";
const DEFAULT_SOURCE = "vnstock:VCI";

type JsonBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** One calendar day in UTC (matches Python date_to_utc_midnight_ms). */
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

function validateBar(raw: unknown, index: number): { ok: true; bar: JsonBar } | { ok: false; reason: string } {
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

  if (high < low) {
    return { ok: false, reason: `[${index}] high < low` };
  }
  if (close <= 0) {
    return { ok: false, reason: `[${index}] close <= 0` };
  }
  if (volume < 0) {
    return { ok: false, reason: `[${index}] volume < 0` };
  }

  return {
    ok: true,
    bar: { time, open, high, low, close, volume },
  };
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? DEFAULT_JSON;
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Expected non-empty JSON array in ${path}`);
  }

  let imported = 0;
  let skippedInvalid = 0;
  let skippedDuplicate = 0;
  const seenDates = new Set<string>();
  const validCloses: { date: Date; close: number }[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const v = validateBar(parsed[i], i);
    if (!v.ok) {
      skippedInvalid++;
      console.error(`Skip: ${v.reason}`);
      continue;
    }
    const bar = v.bar;
    const date = dateKeyFromTimeMs(bar.time);
    const dk = dateDedupeKey(date);
    if (seenDates.has(dk)) {
      skippedDuplicate++;
      console.error(`Skip: [${i}] duplicate date ${dk} in JSON`);
      continue;
    }
    seenDates.add(dk);

    await prisma.indexDailyBar.upsert({
      where: {
        symbol_date: {
          symbol: DEFAULT_SYMBOL,
          date,
        },
      },
      create: {
        symbol: DEFAULT_SYMBOL,
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
    });
    imported++;
    validCloses.push({ date, close: bar.close });
  }

  validCloses.sort((a, b) => a.date.getTime() - b.date.getTime());
  const minD = validCloses[0]?.date;
  const maxD = validCloses[validCloses.length - 1]?.date;
  const latestClose = validCloses[validCloses.length - 1]?.close;

  console.error("");
  console.error("=== import-bars summary ===");
  console.error(`Symbol:      ${DEFAULT_SYMBOL}`);
  console.error(`Source tag:  ${DEFAULT_SOURCE}`);
  console.error(`Imported:    ${imported}`);
  console.error(`Skipped:     ${skippedInvalid + skippedDuplicate} (invalid: ${skippedInvalid}, duplicate date in file: ${skippedDuplicate})`);
  if (minD && maxD) {
    console.error(
      `Date range:  ${minD.toISOString().slice(0, 10)} .. ${maxD.toISOString().slice(0, 10)} (UTC)`
    );
  } else {
    console.error("Date range:  (none)");
  }
  console.error(
    `Latest close: ${latestClose !== undefined ? latestClose.toFixed(2) : "—"}`
  );
  console.error(`File:        ${path}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
