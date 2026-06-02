/**
 * Match Next.js env precedence for CLI scripts: `.env` then `.env.local` overrides.
 * `dotenv/config` alone only reads `.env`, so scripts could hit a different DB than `next dev`.
 */
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

export { describeDatabaseUrl } from "../src/lib/database-url-fingerprint";
