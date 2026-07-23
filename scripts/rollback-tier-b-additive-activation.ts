/**
 * Rollback Tier B additive activation: sets active=false for Tier B symbols only.
 * Does not touch baseline actives or Tier A.
 *
 * Dry-run by default. Persist only when:
 *   APPLY_TIER_B_ROLLBACK=1 SMOKE_DATABASE=production \
 *     npx tsx scripts/rollback-tier-b-additive-activation.ts
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
import { loadTierBActivationFile } from "./lib/tier-b-additive-activation";

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
  const outPath =
    parseArg(argv, "--out=") ?? resolve(root, "reports/tier-b-activation/rollback-dry-run.json");
  const apply = process.env.APPLY_TIER_B_ROLLBACK === "1";

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const activation = loadTierBActivationFile(activationFile);
  const tierB = activation.tierBSymbols.map((s) => s.trim().toUpperCase());
  const { prisma } = await import("../src/lib/prisma");

  console.error("[rollback-tier-b-additive-activation] DATABASE_URL:", describeDatabaseUrl());

  const beforeActive = await prisma.stockSymbol.count({ where: { active: true } });
  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: tierB } },
    select: { symbol: true, active: true },
  });

  const toDeactivate = rows.filter((r) => r.active).map((r) => r.symbol.trim().toUpperCase());
  const alreadyInactive = rows.filter((r) => !r.active).map((r) => r.symbol);
  const missing = tierB.filter((s) => !rows.some((r) => r.symbol.trim().toUpperCase() === s));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "tier_b_rollback_apply" : "tier_b_rollback_dry_run",
    activationFile,
    beforeActiveCount: beforeActive,
    afterActiveCountIfRolledBack: beforeActive - toDeactivate.length,
    tierBToDeactivate: toDeactivate,
    tierBAlreadyInactive: alreadyInactive,
    tierBMissingFromDb: missing,
    baselineUntouched: true,
    tierAUntouched: true,
  };

  if (!apply) {
    mkdirSync(resolve(outPath, ".."), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(JSON.stringify(report, null, 2));
    console.error(
      `Dry-run only. Set APPLY_TIER_B_ROLLBACK=1 to deactivate ${toDeactivate.length} Tier B symbol(s).`
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
