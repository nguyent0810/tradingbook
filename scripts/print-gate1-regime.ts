/**
 * Dev helper: print Gate 1 regime from DB (after import-bars).
 * Usage: npx tsx scripts/print-gate1-regime.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";

async function main() {
  const r = await getMarketRegimeFromDb();
  console.log(JSON.stringify(r, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
