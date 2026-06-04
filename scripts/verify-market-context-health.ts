/**
 * Read-only market context health snapshot (JSON for GHA / ops).
 *
 *   npx tsx scripts/verify-market-context-health.ts
 *   npx tsx scripts/verify-market-context-health.ts --json
 *   npx tsx scripts/verify-market-context-health.ts --session-date 2026-06-03 --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { buildMarketContextHealthReport } from "../src/lib/market/market-context-health";
import {
  exitCodeFromHealthReport,
  formatMarketContextHealthReport,
} from "../src/lib/market/market-context-health-format";

function parseSessionDateArg(argv: string[]): string | undefined {
  const flag = argv.find((a) => a.startsWith("--session-date="));
  if (flag) return flag.slice("--session-date=".length);
  const idx = argv.indexOf("--session-date");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const sessionDate = parseSessionDateArg(argv);

  const report = await buildMarketContextHealthReport(prisma, sessionDate);
  console.log(formatMarketContextHealthReport(report, asJson));

  const code = exitCodeFromHealthReport(report);
  if (code !== 0) {
    process.exit(code);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
