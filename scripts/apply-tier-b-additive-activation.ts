/**
 * Tier B additive activation: sets active=true for approved Tier B symbols only.
 * Never deactivates baseline, Tier A, or other rows.
 *
 * Dry-run by default. Persist only when:
 *   APPLY_TIER_B_ADDITIVE_ACTIVATION=1 SMOKE_DATABASE=production \
 *     npx tsx scripts/apply-tier-b-additive-activation.ts
 */
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
  loadTierBActivationFile,
  validateTierBActivation,
} from "./lib/tier-b-additive-activation";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const activationFile =
    parseArg(argv, "--activation-file=") ??
    resolve(root, "data/expansion-300-tier-b-activation.json");
  const cohortFile =
    parseArg(argv, "--cohort-file=") ?? resolve(root, "data/expansion-300-cohort.json");
  const apply = process.env.APPLY_TIER_B_ADDITIVE_ACTIVATION === "1";
  const maxWeekdaySessionsStale = Number(parseArg(argv, "--max-weekday-stale=") ?? "0");

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const activation = loadTierBActivationFile(activationFile);
  const { prisma } = await import("../src/lib/prisma");

  console.error("[apply-tier-b-additive-activation] DATABASE_URL:", describeDatabaseUrl());
  console.error(JSON.stringify({ activationFile, apply, maxWeekdaySessionsStale, tierBCount: activation.tierBSymbols.length }, null, 2));

  const validation = await validateTierBActivation(prisma, activation, cohortFile, {
    maxWeekdaySessionsStale,
  });
  if (!validation.ok) {
    console.log(JSON.stringify({ ok: false, errors: validation.errors, warnings: validation.warnings }, null, 2));
    await prisma.$disconnect();
    process.exit(1);
  }

  // Partial-batch activation: skip stale stragglers rather than all-or-nothing (Tier A style).
  const toActivate = validation.perSymbol
    .filter((r) => !r.active && r.sessionAligned)
    .map((r) => r.symbol);
  const skippedStale = validation.perSymbol
    .filter((r) => !r.active && !r.sessionAligned)
    .map((r) => ({ symbol: r.symbol, latestBarDay: r.latestBarDay, weekdaySessionsStale: r.weekdaySessionsStale }));

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          wouldActivate: toActivate,
          wouldActivateCount: toActivate.length,
          skippedStale,
          skippedStaleCount: skippedStale.length,
          projectedActiveCount: validation.beforeActiveCount + toActivate.length,
          impact: validation.impact,
        },
        null,
        2
      )
    );
    console.error(
      `Dry-run only. Set APPLY_TIER_B_ADDITIVE_ACTIVATION=1 to activate ${toActivate.length} Tier B symbol(s) (${skippedStale.length} skipped as stale).`
    );
    await prisma.$disconnect();
    return;
  }

  if (toActivate.length === 0) {
    console.log(JSON.stringify({ ok: true, applied: false, message: "Nothing to activate" }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.stockSymbol.updateMany({
    where: { symbol: { in: toActivate }, active: false },
    data: { active: true },
  });

  const afterActive = await prisma.stockSymbol.count({ where: { active: true } });
  const activatedRows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: toActivate } },
    select: { symbol: true, active: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        applied: true,
        rowsUpdated: updated.count,
        afterActiveCount: afterActive,
        activated: activatedRows.sort((a, b) => a.symbol.localeCompare(b.symbol)),
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
