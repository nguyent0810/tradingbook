/**
 * Rollback Tier A-only additive activation: sets active=false for Tier A symbols only.
 * Does not touch baseline actives or Tier B.
 *
 * Dry-run by default. Persist only when:
 *   APPLY_TIER_A_ROLLBACK=1 SMOKE_DATABASE=production \
 *     npx tsx scripts/rollback-tier-a-additive-activation.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

import { describeDatabaseUrl } from "./load-env";
import { loadTierAActivationFile } from "./lib/tier-a-additive-activation";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const activationFile =
    parseArg(argv, "--activation-file=") ??
    resolve(root, "data/expansion-300-tier-a-activation.json");
  const outPath =
    parseArg(argv, "--out=") ?? resolve(root, "reports/tier-a-activation/rollback-dry-run.json");
  const apply = process.env.APPLY_TIER_A_ROLLBACK === "1";

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const activation = loadTierAActivationFile(activationFile);
  const tierA = activation.tierASymbols.map((s) => s.trim().toUpperCase());
  const { prisma } = await import("../src/lib/prisma");

  console.error("[rollback-tier-a-additive-activation] DATABASE_URL:", describeDatabaseUrl());

  const beforeActive = await prisma.stockSymbol.count({ where: { active: true } });
  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: tierA } },
    select: { symbol: true, active: true },
  });

  const toDeactivate = rows.filter((r) => r.active).map((r) => r.symbol.trim().toUpperCase());
  const alreadyInactive = rows.filter((r) => !r.active).map((r) => r.symbol);
  const missing = tierA.filter((s) => !rows.some((r) => r.symbol.trim().toUpperCase() === s));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "tier_a_rollback_apply" : "tier_a_rollback_dry_run",
    activationFile,
    beforeActiveCount: beforeActive,
    afterActiveCountIfRolledBack: beforeActive - toDeactivate.length,
    tierAToDeactivate: toDeactivate,
    tierAAlreadyInactive: alreadyInactive,
    tierAMissingFromDb: missing,
    baselineUntouched: true,
    tierBUntouched: true,
  };

  if (!apply) {
    mkdirSync(resolve(outPath, ".."), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(JSON.stringify(report, null, 2));
    console.error(
      `Dry-run only. Set APPLY_TIER_A_ROLLBACK=1 to deactivate ${toDeactivate.length} Tier A symbol(s).`
    );
    await prisma.$disconnect();
    return;
  }

  if (toDeactivate.length === 0) {
    console.log(JSON.stringify({ ...report, applied: false, message: "Nothing to deactivate" }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.stockSymbol.updateMany({
    where: { symbol: { in: toDeactivate }, active: true },
    data: { active: false },
  });

  const afterActive = await prisma.stockSymbol.count({ where: { active: true } });
  console.log(
    JSON.stringify(
      {
        ...report,
        applied: true,
        rowsUpdated: updated.count,
        afterActiveCount: afterActive,
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
