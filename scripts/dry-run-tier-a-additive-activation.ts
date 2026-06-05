/**
 * Tier A-only additive activation dry-run (read-only). No DB writes.
 *
 *   SMOKE_DATABASE=production npx tsx scripts/dry-run-tier-a-additive-activation.ts
 *   SMOKE_DATABASE=production npx tsx scripts/dry-run-tier-a-additive-activation.ts \
 *     --activation-file=data/expansion-300-tier-a-activation.json \
 *     --cohort-file=data/expansion-300-cohort.json \
 *     --out=reports/tier-a-activation/dry-run-report.json
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
import {
  loadTierAActivationFile,
  validateTierAActivation,
} from "./lib/tier-a-additive-activation";

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
  const cohortFile =
    parseArg(argv, "--cohort-file=") ?? resolve(root, "data/expansion-300-cohort.json");
  const outPath =
    parseArg(argv, "--out=") ?? resolve(root, "reports/tier-a-activation/dry-run-report.json");

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const activation = loadTierAActivationFile(activationFile);
  const { prisma } = await import("../src/lib/prisma");
  const validation = await validateTierAActivation(prisma, activation, cohortFile);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "tier_a_additive_activation_dry_run",
    appliesChanges: false,
    databaseUrlHint: describeDatabaseUrl(),
    activationFile,
    cohortFile,
    goNoGo: {
      readyForActivation: validation.ok,
      criteria: {
        tierAAllInactive: validation.tierAAllInactive,
        tierAAllSessionAligned: validation.tierAAllSessionAligned,
        baselineAllStillActive: validation.baselineAllStillActive,
        projectedActiveCount229: validation.afterActiveCountIfApplied === 229,
        noDuplicates: validation.noDuplicates,
        noBaselineOverlap: validation.noBaselineOverlap,
        noTierBIncluded: validation.noTierBIncluded,
      },
    },
    activationCommands: {
      apply:
        "APPLY_TIER_A_ADDITIVE_ACTIVATION=1 SMOKE_DATABASE=production npx tsx scripts/apply-tier-a-additive-activation.ts",
      rollback:
        "APPLY_TIER_A_ROLLBACK=1 SMOKE_DATABASE=production npx tsx scripts/rollback-tier-a-additive-activation.ts",
    },
    postActivationValidation: {
      exportActiveKeys:
        "SMOKE_DATABASE=production npx tsx scripts/export-active-symbol-keys.ts",
      barImportStaleCheck:
        "SMOKE_DATABASE=production npx tsx scripts/list-stale-fetch-targets.ts",
      scanPilot:
        "SMOKE_DATABASE=production npx tsx scripts/run-daily-scanner.ts",
      marketContext:
        "SMOKE_DATABASE=production npx tsx scripts/verify-market-context-health.ts",
    },
    ...validation,
  };

  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
  if (!validation.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
