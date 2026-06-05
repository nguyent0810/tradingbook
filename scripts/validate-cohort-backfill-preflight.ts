/**
 * Read-only preflight before cohort backfill fetch (bars-only; never activates symbols).
 *
 *   SMOKE_DATABASE=production npx tsx scripts/validate-cohort-backfill-preflight.ts \
 *     --cohort-file=data/expansion-300-cohort.json --tier=b
 *
 *   # Emergency only — allow baseline actives in fetch list (default: fail)
 *   ... --allow-baseline-fetch
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
import {
  type ExpansionCohortDoc,
  normalizeSymbolList,
  validateTierSymbolsOffline,
} from "./lib/cohort-tier";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cohortFile =
    parseArg(argv, "--cohort-file=") ?? resolve(root, "data/expansion-300-cohort.json");
  const tier = parseArg(argv, "--tier=") ?? "a";
  const allowBaselineFetch = hasFlag(argv, "--allow-baseline-fetch");

  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as ExpansionCohortDoc;
  const errors: string[] = [];
  const warnings: string[] = [];

  let offline;
  try {
    offline = validateTierSymbolsOffline(doc, tier);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    console.log(JSON.stringify({ ok: false, errors, warnings }, null, 2));
    process.exit(1);
  }

  if (offline.symbols.length === 0) {
    errors.push(`Tier ${offline.tier} has no symbols`);
  }
  if (offline.duplicateSymbols.length > 0) {
    errors.push(`Duplicate symbols in tier list: ${offline.duplicateSymbols.join(", ")}`);
  }
  if (offline.baselineOverlap.length > 0 && !allowBaselineFetch) {
    errors.push(
      `Tier includes ${offline.baselineOverlap.length} baseline active symbol(s) (disallowed without --allow-baseline-fetch): ${offline.baselineOverlap.slice(0, 10).join(", ")}${offline.baselineOverlap.length > 10 ? "…" : ""}`
    );
  }

  const additiveSet = new Set(normalizeSymbolList(doc.additiveSymbols ?? []));
  for (const sym of offline.symbols) {
    if (!additiveSet.has(sym)) {
      errors.push(`${sym}: not in additiveSymbols (only additive cohort may be backfilled)`);
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL required for preflight");
  } else {
    const { prisma } = await import("../src/lib/prisma");
    const rows = await prisma.stockSymbol.findMany({
      where: { symbol: { in: offline.symbols } },
      select: { symbol: true, active: true },
    });
    const rowBy = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

    for (const sym of offline.symbols) {
      const row = rowBy.get(sym);
      if (!row) {
        errors.push(`${sym}: not found in DB`);
      } else if (row.active && !allowBaselineFetch) {
        errors.push(`${sym}: active=true in DB (additive must be inactive before backfill)`);
      }
    }

    const activeCount = await prisma.stockSymbol.count({ where: { active: true } });
    const baselineExpected = doc.baselineActiveSymbols?.length ?? null;
    if (baselineExpected != null && activeCount !== baselineExpected) {
      warnings.push(
        `DB active count ${activeCount} != cohort baseline ${baselineExpected} (universe may have drifted)`
      );
    }

    await prisma.$disconnect();
  }

  const ok = errors.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        mode: "cohort_backfill_preflight",
        activatesSymbols: false,
        databaseUrlHint: process.env.DATABASE_URL ? describeDatabaseUrl() : null,
        cohortFile,
        tier: offline.tier,
        requestedCount: offline.symbols.length,
        allowBaselineFetch,
        duplicateCount: offline.duplicateSymbols.length,
        baselineOverlapCount: offline.baselineOverlap.length,
        errors,
        warnings,
      },
      null,
      2
    )
  );

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
