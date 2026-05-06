/**
 * Seed active Vietnam equity symbols into StockSymbol (upsert by `symbol`).
 *
 * 1) Tries provider list: `python scripts/list_vn_symbols.py` (vnstock; needs network).
 * 2) Falls back to `data/vn-symbols.json`.
 *
 * Also writes `data/active-symbol-keys.json` for `fetch_stock_bars.py`.
 *
 * Usage:
 *   npx tsx scripts/seed-stock-symbols.ts
 *   npx tsx scripts/seed-stock-symbols.ts --ramp-target=100
 *
 * For DB activation based on bar freshness / tradability (explicit, opt-in), see
 * `scripts/curate-active-symbols.ts` (dry-run unless `--apply`).
 */
import { spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import "./load-env";
import { prisma } from "../src/lib/prisma";

const STATIC_PATH = join(process.cwd(), "data", "vn-symbols-seed.json");
const LIST_SCRIPT = join(process.cwd(), "scripts", "list_vn_symbols.py");
const ACTIVE_KEYS_OUT = join(process.cwd(), "data", "active-symbol-keys.json");
const PROVIDER_TMP_OUT = join(process.cwd(), "data", "vn-symbols.provider.tmp.json");

type SeedRow = {
  symbol: string;
  exchange?: string | null;
  name?: string | null;
};

function parseRampTargetArg(argv: string[]): number | null {
  const arg = argv.find((x) => x.startsWith("--ramp-target="));
  if (!arg) return null;
  const raw = arg.slice("--ramp-target=".length).trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--ramp-target must be a positive integer.");
  }
  return parsed;
}

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
  if (existsSync(PROVIDER_TMP_OUT)) {
    try {
      unlinkSync(PROVIDER_TMP_OUT);
    } catch {
      // Ignore stale temp cleanup errors.
    }
  }
  const r = spawnSync(py, [LIST_SCRIPT, "--output", PROVIDER_TMP_OUT], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0 || !r.stdout) {
    const err = (r.stderr ?? "").trim();
    if (err) {
      const lines = err.split(/\r?\n/).slice(-4);
      console.error(`[seed-stock-symbols] Provider listing unavailable: ${lines.join(" | ")}`);
    } else {
      console.error("[seed-stock-symbols] Provider listing unavailable, using static file.");
    }
    return null;
  }
  try {
    const parsed = readJsonFile(PROVIDER_TMP_OUT);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parseProviderStdout(JSON.stringify(parsed));
  } catch {
    return null;
  } finally {
    if (existsSync(PROVIDER_TMP_OUT)) {
      try {
        unlinkSync(PROVIDER_TMP_OUT);
      } catch {
        // Ignore temp file cleanup errors.
      }
    }
  }
}

async function main(): Promise<void> {
  const rampTarget = parseRampTargetArg(process.argv.slice(2));
  let rows = tryLoadFromProvider();
  if (!rows) {
    console.error(`[seed-stock-symbols] Using static seed: ${STATIC_PATH}`);
    rows = loadStaticFile();
  } else {
    console.error(`[seed-stock-symbols] Using provider list (${rows.length} symbols).`);
  }

  const dedupedRows = [...rows]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .filter((row, idx, all) => idx === 0 || all[idx - 1]!.symbol !== row.symbol);
  const rampUniverse = rampTarget
    ? new Set(dedupedRows.slice(0, Math.min(rampTarget, dedupedRows.length)).map((r) => r.symbol))
    : null;

  if (rampUniverse) {
    console.error(
      `[seed-stock-symbols] Ramp mode enabled: activating first ${rampUniverse.size} symbols (sorted alphabetically), deactivating others.`
    );
  }

  let upserted = 0;
  for (const row of dedupedRows) {
    const active = rampUniverse ? rampUniverse.has(row.symbol) : true;
    await prisma.stockSymbol.upsert({
      where: { symbol: row.symbol },
      create: {
        symbol: row.symbol,
        exchange: row.exchange ?? undefined,
        name: row.name ?? undefined,
        active,
      },
      update: {
        exchange: row.exchange ?? undefined,
        name: row.name ?? undefined,
        active,
      },
    });
    upserted++;
  }

  if (rampUniverse) {
    await prisma.stockSymbol.updateMany({
      where: { symbol: { notIn: [...rampUniverse] } },
      data: { active: false },
    });
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
  if (rampTarget) {
    console.error(`Ramp target requested: ${rampTarget}`);
  }
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
