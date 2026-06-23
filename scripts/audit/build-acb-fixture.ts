/**
 * Build real-data fixtures for audit replay (vnstock VCI + VNINDEX).
 * Run: npx tsx scripts/audit/build-acb-fixture.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const ACB_EXTENDED = resolve(process.cwd(), "data/acb-bars-extended.json");
const VNINDEX = resolve(process.cwd(), "data/vnindex.json");
const STOCK_BARS_FALLBACK = resolve(process.cwd(), "data/stock-bars.json");
const FIXTURE_REAL = resolve(
  process.cwd(),
  "docs/quant-audit/fixtures/acb-replay-real.json"
);
const FIXTURE_LEGACY = resolve(
  process.cwd(),
  "docs/quant-audit/fixtures/acb-replay.json"
);

type RawBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type StockEntry = { symbol: string; bars: RawBar[] };

type VnindexRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function rawToFixtureBar(b: RawBar) {
  return {
    date: msToDateStr(b.time),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  };
}

function loadAcbBars(): RawBar[] {
  if (existsSync(ACB_EXTENDED)) {
    const data = JSON.parse(readFileSync(ACB_EXTENDED, "utf8")) as StockEntry[];
    const acb = data.find((e) => e.symbol === "ACB");
    if (acb?.bars.length) return acb.bars;
  }
  const data = JSON.parse(readFileSync(STOCK_BARS_FALLBACK, "utf8")) as StockEntry[];
  const acb = data.find((e) => e.symbol === "ACB");
  if (!acb?.bars.length) throw new Error("ACB not found in bar sources");
  return acb.bars;
}

function loadVnindexBars(stockDates: Set<string>) {
  if (!existsSync(VNINDEX)) {
    throw new Error(
      "data/vnindex.json missing — run: python scripts/fetch_vnindex.py"
    );
  }
  const rows = JSON.parse(readFileSync(VNINDEX, "utf8")) as VnindexRow[];
  return rows
    .map(rawToFixtureBar)
    .filter((b) => stockDates.has(b.date));
}

function main(): void {
  const acbRaw = loadAcbBars();
  const stockBars = acbRaw.map(rawToFixtureBar);
  const dates = new Set(stockBars.map((b) => b.date));
  const indexBars = loadVnindexBars(dates);

  const fixture = {
    symbol: "ACB",
    generatedAt: new Date().toISOString(),
    source: existsSync(ACB_EXTENDED)
      ? "data/acb-bars-extended.json (vnstock VCI) + data/vnindex.json"
      : "data/stock-bars.json (fallback) + data/vnindex.json",
    stockBars,
    indexBars,
  };

  mkdirSync(resolve(process.cwd(), "docs/quant-audit/fixtures"), { recursive: true });
  writeFileSync(FIXTURE_REAL, JSON.stringify(fixture, null, 2), "utf8");
  writeFileSync(FIXTURE_LEGACY, JSON.stringify(fixture, null, 2), "utf8");

  const first = stockBars[0]!.date;
  const last = stockBars[stockBars.length - 1]!.date;
  console.log(`Wrote ${FIXTURE_REAL}`);
  console.log(`ACB: ${stockBars.length} bars (${first} → ${last})`);
  console.log(`VNINDEX aligned: ${indexBars.length} sessions`);
  const june = stockBars.filter((b) => b.date >= "2026-06-01");
  console.log(`June 2026 bars: ${june.length}${june.length ? ` (through ${june[june.length - 1]!.date})` : " — NOT COVERED"}`);
}

main();
