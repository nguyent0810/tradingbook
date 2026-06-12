import { execSync } from "node:child_process";

/**
 * Seeds deterministic trades before the dev server starts (requires DATABASE_URL).
 * Skips quietly when the database is unavailable — dashboard smoke tests still run but may show partial data.
 */
export default function globalSetup(): void {
  if (process.env.PLAYWRIGHT_SKIP_SEED === "1") {
    return;
  }
  try {
    execSync("npx tsx scripts/playwright-seed-trades-layout.ts", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    console.warn(
      "[playwright global-setup] Trade seed skipped — database unavailable or seed failed."
    );
  }
}
