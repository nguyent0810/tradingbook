/**
 * Seed active Vietnam equity symbols into StockSymbol (upsert by `symbol`).
 *
 * 1) Tries provider list: `python scripts/list_vn_symbols.py` (vnstock; needs network).
 * 2) Falls back to `data/vn-symbols.json`.
 *
 * Also writes `data/active-symbol-keys.json` for `fetch_stock_bars.py`.
 *
 * Usage: npx tsx scripts/seed-stock-symbols.ts
 */
import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import "./load-env";
import { prisma } from "../src/lib/prisma";

const STATIC_PATH = join(process.cwd(), "data", "vn-symbols.json");
const LIST_SCRIPT = join(process.cwd(), "scripts", "list_vn_symbols.py");
const ACTIVE_KEYS_OUT = join(process.cwd(), "data", "active-symbol-keys.json");

type SeedRow = {
  symbol: string;
  exchange?: string | null;
  name?: string | null;
};

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase();
}

function parseProviderStdout(raw: string): SeedRow[] | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: SeedRow[] = [];
    for (const x of parsed) {
      if (x === null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const sym = o.symbol;
      if (typeof sym !== "string" || !sym.trim()) continue;
      out.push({
        symbol: normalizeSymbol(sym),
        exchange: typeof o.exchange === "string" ? o.exchange : null,
        name: typeof o.name === "string" ? o.name : null,
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function loadStaticFile(): SeedRow[] {
  const parsed = readJsonFile(STATIC_PATH);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${STATIC_PATH}`);
  }
  const out: SeedRow[] = [];
  for (const x of parsed) {
    if (x === null || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.symbol !== "string") continue;
    out.push({
      symbol: normalizeSymbol(o.symbol),
      exchange: typeof o.exchange === "string" ? o.exchange : null,
      name: typeof o.name === "string" ? o.name : null,
    });
  }
  if (out.length === 0) throw new Error(`No symbols in ${STATIC_PATH}`);
  return out;
}

function tryLoadFromProvider(): SeedRow[] | null {
  const py = process.platform === "win32" ? "python" : "python3";
  const r = spawnSync(py, [LIST_SCRIPT], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0 || !r.stdout) {
    console.error("[seed-stock-symbols] Provider listing unavailable, using static file.");
    return null;
  }
  return parseProviderStdout(r.stdout);
}

async function main(): Promise<void> {
  let rows = tryLoadFromProvider();
  if (!rows) {
    console.error(`[seed-stock-symbols] Using static seed: ${STATIC_PATH}`);
    rows = loadStaticFile();
  } else {
    console.error(`[seed-stock-symbols] Using provider list (${rows.length} symbols).`);
  }

  let upserted = 0;
  for (const row of rows) {
    await prisma.stockSymbol.upsert({
      where: { symbol: row.symbol },
      create: {
        symbol: row.symbol,
        exchange: row.exchange ?? undefined,
        name: row.name ?? undefined,
        active: true,
      },
      update: {
        exchange: row.exchange ?? undefined,
        name: row.name ?? undefined,
        active: true,
      },
    });
    upserted++;
  }

  const active = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { symbol: true },
    orderBy: { symbol: "asc" },
  });
  const keys = active.map((a) => a.symbol);
  writeFileSync(ACTIVE_KEYS_OUT, JSON.stringify({ symbols: keys }, null, 2), "utf-8");

  console.error("");
  console.error("=== seed-stock-symbols summary ===");
  console.error(`Rows upserted: ${upserted}`);
  console.error(`Active symbols in DB: ${keys.length}`);
  console.error(`Wrote ${ACTIVE_KEYS_OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
