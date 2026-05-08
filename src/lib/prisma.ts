import { PrismaClient } from "@/generated/prisma/client";
import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

function normalizePostgresUrl(url: string): string {
  // Neon can provide `prisma://` URLs (for the serverless driver).
  // Our runtime uses `pg`, so we coerce the scheme to a standard postgres one.
  if (/^prisma:\/\//i.test(url)) return `postgresql://${url.slice("prisma://".length)}`;
  if (/^postgres:\/\//i.test(url)) return `postgresql://${url.slice("postgres://".length)}`;
  return url;
}

function hostLooksLikeNeonPooler(url: string): boolean {
  try {
    const u = new URL(normalizePostgresUrl(url));
    return u.hostname.includes("-pooler");
  } catch {
    return false;
  }
}

function selectRuntimeConnectionString(): string {
  const databaseUrlRaw = process.env.DATABASE_URL?.trim();
  const directUrlRaw = process.env.DIRECT_URL?.trim();

  if (!databaseUrlRaw && !directUrlRaw) {
    throw new Error(
      "DATABASE_URL (or DIRECT_URL) must be set. Required for Prisma runtime reads."
    );
  }

  const databaseUrl = databaseUrlRaw ? normalizePostgresUrl(databaseUrlRaw) : "";
  const directUrl = directUrlRaw ? normalizePostgresUrl(directUrlRaw) : "";

  // Neon pooler can be flaky in some serverless SSR scenarios; for production runtime
  // reads, prefer the direct endpoint when it is available.
  if (process.env.NODE_ENV === "production" && directUrl && databaseUrl) {
    if (hostLooksLikeNeonPooler(databaseUrlRaw!)) return directUrl;
  }

  return databaseUrl || directUrl;
}

const connectionString = selectRuntimeConnectionString();

if (process.env.NODE_ENV === "development" && typeof globalThis !== "undefined") {
  const g = globalThis as { __tradingLogDbTarget?: boolean };
  if (!g.__tradingLogDbTarget) {
    g.__tradingLogDbTarget = true;
    console.log(
      "[prisma] (next dev / server) DATABASE_URL (host) →",
      describeDatabaseUrl()
    );
  }
}

// Fail fast in production so server-rendered pages don't sit on the route `loading.tsx` skeleton forever.
const connectionTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 8000);
const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 8000);
const poolMax = Number(process.env.DB_POOL_MAX ?? 5);
const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000);

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: connectionTimeoutMs,
  max: poolMax,
  idleTimeoutMillis: idleTimeoutMs,
  // Applies per-statement on the DB connection.
  options: `-c statement_timeout=${statementTimeoutMs}`,
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalForPrisma.prisma ?? new PrismaClient({ adapter } as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

