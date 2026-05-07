import { execSync } from "node:child_process";

/**
 * Seeds deterministic trades before the dev server starts (requires DATABASE_URL).
 */
export default function globalSetup(): void {
  execSync("npx tsx scripts/playwright-seed-trades-layout.ts", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
}
