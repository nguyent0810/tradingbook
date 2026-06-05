/**
 * Validate expansion-300-cohort.json (offline). Optional DB cross-check (read-only).
 *
 *   npx tsx scripts/validate-expansion-300-cohort.ts
 *   npx tsx scripts/validate-expansion-300-cohort.ts --file=data/expansion-300-cohort.json
 *   SMOKE_DATABASE=production npx tsx scripts/validate-expansion-300-cohort.ts --with-db
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

import { TRADABILITY_MIN_BARS } from "../src/lib/scanner/tradability-constants";

type CohortDoc = {
  baselineActiveSymbols: string[];
  additiveSymbols: string[];
  additiveByTier?: { tierA: string[]; tierB: string[] };
  symbolMetadata?: Record<
    string,
    {
      tier?: string;
      barCount?: number;
      coldStartExcluded?: boolean;
    }
  >;
  policy?: {
    intendedActiveCount?: number;
    coldStartTrack?: string[];
  };
  exclusions?: Array<{ symbol: string; category: string }>;
};

function parseFile(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith("--file="));
  if (flag) return flag.slice("--file=".length);
  return resolve(root, "data", "expansion-300-cohort.json");
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const filePath = parseFile(argv);
  const withDb = hasFlag(argv, "--with-db");

  const doc = JSON.parse(readFileSync(filePath, "utf-8")) as CohortDoc;
  const errors: string[] = [];
  const warnings: string[] = [];

  const baseline = doc.baselineActiveSymbols.map((s) => s.trim().toUpperCase());
  const additive = doc.additiveSymbols.map((s) => s.trim().toUpperCase());
  const baselineSet = new Set(baseline);
  const additiveSet = new Set(additive);

  if (baseline.length !== baselineSet.size) errors.push("Duplicate symbols in baselineActiveSymbols");
  if (additive.length !== additiveSet.size) errors.push("Duplicate symbols in additiveSymbols");

  const overlap = baseline.filter((s) => additiveSet.has(s));
  if (overlap.length > 0) {
    errors.push(`Baseline/additive overlap: ${overlap.join(", ")}`);
  }

  const intended = doc.policy?.intendedActiveCount ?? baseline.length + additive.length;
  if (baseline.length + additive.length !== intended) {
    errors.push(`intendedActiveCount ${intended} != baseline+additive (${baseline.length + additive.length})`);
  }
  if (intended !== 300) errors.push(`Expected intended active count 300, got ${intended}`);
  if (additive.length !== 94) errors.push(`Expected 94 additive symbols, got ${additive.length}`);

  const coldStart = new Set((doc.policy?.coldStartTrack ?? []).map((s) => s.toUpperCase()));
  for (const sym of additive) {
    if (coldStart.has(sym)) errors.push(`Cold-start symbol ${sym} must not be in additive list`);
    const meta = doc.symbolMetadata?.[sym];
    if (meta?.barCount != null && meta.barCount < TRADABILITY_MIN_BARS) {
      errors.push(`${sym}: barCount ${meta.barCount} < ${TRADABILITY_MIN_BARS}`);
    }
  }

  if (doc.additiveByTier) {
    const tierAll = [...doc.additiveByTier.tierA, ...doc.additiveByTier.tierB];
    if (new Set(tierAll).size !== tierAll.length) errors.push("Duplicate across tierA/tierB");
    if (tierAll.length !== additive.length) {
      errors.push(`tierA+tierB count ${tierAll.length} != additiveSymbols ${additive.length}`);
    }
    for (const sym of tierAll) {
      if (!additiveSet.has(sym)) errors.push(`Tier symbol ${sym} missing from additiveSymbols`);
    }
  }

  if (withDb) {
    if (!process.env.DATABASE_URL?.trim()) {
      errors.push("--with-db requires DATABASE_URL");
    } else {
      const { prisma } = await import("../src/lib/prisma");
      const rows = await prisma.stockSymbol.findMany({
        where: { symbol: { in: [...baseline, ...additive] } },
        select: { symbol: true, active: true, _count: { select: { bars: true } } },
      });
      const rowBy = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

      for (const sym of baseline) {
        const row = rowBy.get(sym);
        if (!row) errors.push(`Baseline ${sym} not in DB`);
        else if (!row.active) errors.push(`Baseline ${sym} is not active in DB (would imply deactivation risk)`);
      }

      for (const sym of additive) {
        const row = rowBy.get(sym);
        if (!row) errors.push(`Additive ${sym} not in DB`);
        else if (row.active) errors.push(`Additive ${sym} is already active in DB`);
        else if (row._count.bars < TRADABILITY_MIN_BARS) {
          errors.push(`Additive ${sym} has ${row._count.bars} bars in DB (< ${TRADABILITY_MIN_BARS})`);
        }
      }

      const activeCount = await prisma.stockSymbol.count({ where: { active: true } });
      if (activeCount !== baseline.length) {
        warnings.push(`DB active count ${activeCount} != cohort baseline ${baseline.length}`);
      }

      await prisma.$disconnect();
    }
  }

  const ok = errors.length === 0;
  console.log(
    JSON.stringify(
      {
        file: filePath,
        ok,
        errors,
        warnings,
        baselineCount: baseline.length,
        additiveCount: additive.length,
        intendedActiveCount: intended,
        withDb,
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
