/**
 * Prints expected latest session day (YYYY-MM-DD) from VNINDEX bars — for shell/GHA.
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";

function isoDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    console.error("[print-expected-session-day] No VNINDEX session in database.");
    process.exit(1);
  }
  process.stdout.write(isoDayUtc(expected));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
