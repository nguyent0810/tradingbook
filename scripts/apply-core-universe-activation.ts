/**
 * Bounded core activation: set active=true only for approved symbols.
 * Does NOT deactivate other rows (unlike curate-active-symbols --apply).
 *
 * Dry-run by default. Persist only when:
 *   APPLY_CORE_UNIVERSE_ACTIVATION=1 SMOKE_DATABASE=production npx tsx scripts/apply-core-universe-activation.ts
 *
 * Optional: --symbols-file path (default data/core-universe-recovery-activation.json)
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

import { describeDatabaseUrl } from "./load-env";
import { loadEffectiveScanUniverse } from "../src/lib/tactical-universe";
import { buildImportSymbolKeys } from "../src/lib/effective-universe-export";
import { isSmokeProductionSymbol } from "../src/lib/scanner/production-smoke-markers";
import { tradedValueVnd } from "../src/lib/scanner/price-units";

const DEFAULT_SET_FILE = resolve(
  root,
  "data/core-universe-recovery-activation.json"
);

type ActivationFile = {
  tier1_required?: string[];
  tier2_supplemental?: string[];
};

function parseActivationFile(path: string): {
  all: string[];
  tier1: Set<string>;
  tier2: Set<string>;
} {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as ActivationFile;
  const tier1 = new Set(
    (raw.tier1_required ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean)
  );
  const tier2 = new Set(
    (raw.tier2_supplemental ?? [])
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
  const all = [...new Set([...tier1, ...tier2])].sort((a, b) => a.localeCompare(b));
  return { all, tier1, tier2 };
}

function parseArgvFile(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith("--symbols-file="));
  if (flag) return flag.slice("--symbols-file=".length);
  const idx = argv.indexOf("--symbols-file");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return DEFAULT_SET_FILE;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "DATABASE_URL is unset. Set SMOKE_DATABASE=production with .env.prod.local."
    );
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  try {
  const argv = process.argv.slice(2);
  const symbolsFile = parseArgvFile(argv);
  const { all: proposed, tier1, tier2 } = parseActivationFile(symbolsFile);
  const apply = process.env.APPLY_CORE_UNIVERSE_ACTIVATION === "1";

  console.error("[apply-core-universe-activation] DATABASE_URL:", describeDatabaseUrl());
  console.error(
    JSON.stringify({ symbolsFile, proposedCount: proposed.length, apply }, null, 2)
  );

  const beforeActive = await prisma.stockSymbol.count({ where: { active: true } });
  const effectiveBefore = await loadEffectiveScanUniverse(prisma);
  const importBefore = buildImportSymbolKeys(effectiveBefore.symbols, {
    exclude: (s) => isSmokeProductionSymbol(s),
  });

  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: proposed } },
    select: {
      id: true,
      symbol: true,
      active: true,
      name: true,
      bars: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
      _count: { select: { bars: true } },
    },
  });
  const rowBySymbol = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

  const avgBySymbol = new Map<string, number | null>();
  for (const sym of proposed) {
    const row = rowBySymbol.get(sym);
    if (!row) continue;
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: row.id },
      orderBy: { date: "desc" },
      take: 20,
      select: { close: true, volume: true },
    });
    if (bars.length === 0) {
      avgBySymbol.set(sym, null);
      continue;
    }
    const avg =
      bars.reduce((sum, b) => sum + tradedValueVnd(b.close, b.volume), 0) /
      bars.length;
    avgBySymbol.set(sym, avg);
  }

  const MIN_LIQUIDITY_VND = 2_000_000_000;
  const proposalTable: Array<Record<string, unknown>> = [];
  const missing: string[] = [];
  const alreadyActive: string[] = [];
  const toActivate: string[] = [];
  const lowLiquidity: string[] = [];
  const noBars: string[] = [];

  for (const sym of proposed) {
    const row = rowBySymbol.get(sym);
    if (!row) {
      missing.push(sym);
      proposalTable.push({
        symbol: sym,
        exists: false,
        currentActive: null,
        latestBarDate: null,
        avgValue20Vnd: null,
        reasonToActivate: "SKIP — not in stock_symbols",
      });
      continue;
    }
    const barCount = row._count.bars;
    const latest = row.bars[0]?.date ?? null;
    const avgVal = avgBySymbol.get(sym) ?? null;
    const isTier1 = tier1.has(sym);
    const isTier2 = tier2.has(sym);
    let reason = isTier1
      ? "Tier 1 mandated liquid leader — inactive import/scan gap (May 2026 audit)"
      : "Tier 2 supplemental liquid leader — same stale cluster";
    if (row.active) {
      alreadyActive.push(sym);
      reason = "Already active — no change needed";
    } else if (isTier1) {
      toActivate.push(sym);
      if (barCount === 0) noBars.push(sym);
    } else if (barCount === 0) {
      noBars.push(sym);
      reason = "SKIP tier 2 — no bars in DB";
    } else if (avgVal != null && avgVal < MIN_LIQUIDITY_VND) {
      lowLiquidity.push(sym);
      reason = `SKIP tier 2 — below liquidity floor (${MIN_LIQUIDITY_VND} VND 20d avg value)`;
    } else if (isTier2) {
      toActivate.push(sym);
    }

    proposalTable.push({
      symbol: sym,
      exists: true,
      currentActive: row.active,
      latestBarDate: latest ? latest.toISOString().slice(0, 10) : null,
      barCount,
      avgValue20Vnd: avgVal,
      reasonToActivate: reason,
    });
  }

  const afterActiveIfApplied = beforeActive + toActivate.length;

  let effectiveAfterCount = effectiveBefore.stats.effectiveCount;
  let importAfterCount = importBefore.length;
  if (toActivate.length > 0) {
    const simulatedIds = new Set(
      effectiveBefore.symbols.map((s) => s.symbol.trim().toUpperCase())
    );
    for (const sym of toActivate) simulatedIds.add(sym);
    effectiveAfterCount = simulatedIds.size;
    importAfterCount = buildImportSymbolKeys(
      [...simulatedIds].map((symbol) => ({
        symbolId: rowBySymbol.get(symbol)?.id ?? symbol,
        symbol,
        universeSource: "CORE" as const,
      })),
      { exclude: (s) => isSmokeProductionSymbol(s) }
    ).length;
  }

  const impact = {
    before: {
      activeCoreCount: beforeActive,
      effectiveUniverseCount: effectiveBefore.stats.effectiveCount,
      estimatedImportSymbolCount: importBefore.length,
      estimatedScanSymbolCount: effectiveBefore.stats.effectiveCount,
      tacticalActiveCount: effectiveBefore.stats.tacticalCount,
      tacticalMissingStockSymbolCount:
        effectiveBefore.stats.tacticalMissingStockSymbolCount,
    },
    afterProposedActivation: {
      activeCoreCount: afterActiveIfApplied,
      effectiveUniverseCount: effectiveAfterCount,
      estimatedImportSymbolCount: importAfterCount,
      estimatedScanSymbolCount: effectiveAfterCount,
      newlyActivatedSymbols: toActivate.length,
    },
    symbolsMissingFromStockSymbols: missing,
    symbolsAlreadyActive: alreadyActive,
    symbolsWithNoBars: noBars,
    symbolsLowLiquidityWarning: lowLiquidity,
    symbolsToActivate: toActivate,
    staleBarsRequiringFetch: toActivate.filter((s) => {
      const row = rowBySymbol.get(s);
      return (row?._count.bars ?? 0) > 0;
    }),
  };

  const unexpectedlyLarge =
    toActivate.length > 50 ||
    afterActiveIfApplied > beforeActive + 50 ||
    afterActiveIfApplied > 400;

  console.log(
    JSON.stringify(
      {
        proposalTable,
        impact,
        unexpectedlyLarge,
        readyToActivate: toActivate,
      },
      null,
      2
    )
  );

  if (unexpectedlyLarge) {
    console.error(
      "STOP: activation impact unexpectedly large. Review proposal before applying."
    );
    process.exit(1);
  }

  if (!apply) {
    console.error(
      `Dry-run only. Ready to activate ${toActivate.length} symbol(s): [${toActivate.join(", ")}]. ` +
        "Set APPLY_CORE_UNIVERSE_ACTIVATION=1 to persist."
    );
    return;
  }

  if (toActivate.length === 0) {
    console.error("Nothing to activate.");
    return;
  }

  const updated = await prisma.stockSymbol.updateMany({
    where: { symbol: { in: toActivate } },
    data: { active: true },
  });

  const afterRows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: toActivate } },
    select: { symbol: true, active: true },
  });

  console.log(
    JSON.stringify(
      {
        applied: true,
        rowsUpdated: updated.count,
        activationResults: afterRows
          .sort((a, b) => a.symbol.localeCompare(b.symbol))
          .map((r) => ({
            symbol: r.symbol,
            beforeActive: false,
            afterActive: r.active,
          })),
      },
      null,
      2
    )
  );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
