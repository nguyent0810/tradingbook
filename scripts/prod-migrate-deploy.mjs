// Guarded Production migration step for Vercel builds.
//
// Runs `prisma migrate deploy` ONLY for Production builds, against the NON-POOLED
// Neon endpoint, and blocks the release if it fails. Preview/dev/local builds skip
// it entirely (they must never mutate the Production database).
//
// Why not a persistent DIRECT_URL env var: src/lib/prisma.ts
// (selectTcpRuntimeConnectionString) returns DIRECT_URL at *runtime* when
// DATABASE_URL is a Neon pooler, which would switch the serverless runtime to
// non-pooled connections. So we inject the non-pooled URL as DIRECT_URL only into
// the migrate subprocess; runtime keeps using the pooled DATABASE_URL.
//
// Never use migrate dev / db push / migrate reset. Never print connection strings.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Pure decision so it can be unit-tested without touching a database. */
export function decideMigrationAction({ vercelEnv, hasDirectUrl }) {
  if (vercelEnv !== "production") {
    return { action: "skip", reason: `VERCEL_ENV=${vercelEnv ?? "(unset/local)"} — not Production; skipping migrations so Preview/dev never mutate the Production DB` };
  }
  if (!hasDirectUrl) {
    return { action: "fail", reason: "Production build but no non-pooled URL (DATABASE_URL_UNPOOLED / DIRECT_URL) is available — refusing to migrate over the pooler" };
  }
  return { action: "run", reason: "Production build with a non-pooled URL — applying pending migrations (idempotent)" };
}

/** Resolve a non-pooled connection string and ensure ssl + a generous connect timeout for idle Neon compute. Never logged. */
export function resolveNonPooledUrl(env = process.env) {
  const raw = (env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || "").trim();
  if (!raw) return "";
  let u = raw;
  if (!/[?&]sslmode=/.test(u)) u += (u.includes("?") ? "&" : "?") + "sslmode=require";
  if (!/[?&]connect_timeout=/.test(u)) u += "&connect_timeout=30";
  return u;
}

function main() {
  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined
  const direct = resolveNonPooledUrl();
  const { action, reason } = decideMigrationAction({ vercelEnv, hasDirectUrl: Boolean(direct) });
  console.log(`[prod-migrate] ${action.toUpperCase()}: ${reason}`);

  if (action === "skip") process.exit(0);
  if (action === "fail") process.exit(1);

  try {
    // Inject the non-pooled URL as DIRECT_URL for THIS subprocess only (prisma.config.ts
    // reads DIRECT_URL first). Does not persist to Vercel runtime env.
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DIRECT_URL: direct } });
    console.log("[prod-migrate] migrate deploy succeeded");
  } catch {
    console.error("[prod-migrate] migrate deploy FAILED — blocking Production release");
    process.exit(1);
  }
}

// Only run when executed directly (so unit tests can import the pure helpers safely).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
