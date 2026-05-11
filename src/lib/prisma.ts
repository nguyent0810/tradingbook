import { PrismaClient } from "@/generated/prisma/client";
import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Accelerate / Data Proxy URLs must use `accelerateUrl` + `withAccelerate()` — never `PrismaPg`.
 * Feeding `prisma://` / `prisma+postgres://` into `@prisma/adapter-pg` (or “normalizing” them to
 * `postgresql://`) breaks at runtime and surfaces as `DriverAdapterError: Control plane request failed`.
 * @see https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
 */
function isAccelerateOrDataProxyUrl(url: string): boolean {
  const t = url.trim();
  return /^prisma(\+postgres)?:\/\//i.test(t);
}

/** Canonical `postgres://` → `postgresql://` for TCP URLs only. */
function normalizeTcpPostgresScheme(url: string): string {
  if (/^postgres:\/\//i.test(url)) return `postgresql://${url.slice("postgres://".length)}`;
  return url;
}

function hostLooksLikeNeonPooler(url: string): boolean {
  try {
    const u = new URL(normalizeTcpPostgresScheme(url));
    return u.hostname.includes("-pooler");
  } catch {
    return false;
  }
}

function selectTcpRuntimeConnectionString(): string {
  const databaseUrlRaw = process.env.DATABASE_URL?.trim();
  const directUrlRaw = process.env.DIRECT_URL?.trim();

  if (!databaseUrlRaw && !directUrlRaw) {
    throw new Error(
      "DATABASE_URL (or DIRECT_URL) must be set. Required for Prisma runtime reads."
    );
  }

  if (directUrlRaw && isAccelerateOrDataProxyUrl(directUrlRaw)) {
    throw new Error(
      "DIRECT_URL must be a Postgres TCP URL for migrations. Do not point DIRECT_URL at prisma:// / prisma+postgres://."
    );
  }

  if (databaseUrlRaw && isAccelerateOrDataProxyUrl(databaseUrlRaw)) {
    throw new Error(
      "DATABASE_URL uses a prisma:// / prisma+postgres:// URL. Remove TCP-only env wiring; Accelerate is handled separately."
    );
  }

  const databaseUrl = databaseUrlRaw
    ? normalizeTcpPostgresScheme(databaseUrlRaw)
    : "";
  const directUrl = directUrlRaw ? normalizeTcpPostgresScheme(directUrlRaw) : "";

  if (
    process.env.NODE_ENV === "production" &&
    directUrl &&
    databaseUrl &&
    databaseUrlRaw &&
    hostLooksLikeNeonPooler(databaseUrlRaw)
  ) {
    return directUrl;
  }

  return databaseUrl || directUrl;
}

function logProductionRuntimeDiagnostics(params: {
  mode: "accelerate" | "tcp-pg";
  accelerateScheme?: string;
  tcpMeta?: {
    urlSource: "DATABASE_URL" | "DIRECT_URL";
    host: string;
    pooler: boolean;
    poolMax: number;
    connectTimeoutMs: number;
    statementTimeoutMs: number;
  };
}) {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  if (params.mode === "accelerate") {
    console.log(
      `[prisma runtime] mode=accelerate scheme=${params.accelerateScheme ?? "prisma"} (no driver adapter)`
    );
    return;
  }

  const m = params.tcpMeta;
  if (!m) return;
  console.log(
    `[prisma runtime] mode=tcp-pg urlSource=${m.urlSource} host=${m.host} pooler=${m.pooler} poolMax=${m.poolMax} connectTimeoutMs=${m.connectTimeoutMs} statementTimeoutMs=${m.statementTimeoutMs}`
  );
}

function createPrismaClient(): PrismaClient {
  const databaseUrlRaw = process.env.DATABASE_URL?.trim() ?? "";

  if (databaseUrlRaw && isAccelerateOrDataProxyUrl(databaseUrlRaw)) {
    const schemeMatch = databaseUrlRaw.match(/^[^:]+/);
    logProductionRuntimeDiagnostics({
      mode: "accelerate",
      accelerateScheme: schemeMatch?.[0] ?? "prisma",
    });

    return new PrismaClient({
      accelerateUrl: databaseUrlRaw,
    }).$extends(withAccelerate()) as unknown as PrismaClient;
  }

  const connectionString = selectTcpRuntimeConnectionString();

  const directUrlRaw = process.env.DIRECT_URL?.trim() ?? "";
  const pickedIsDirect =
    !!directUrlRaw &&
    connectionString === normalizeTcpPostgresScheme(directUrlRaw);

  try {
    const u = new URL(connectionString.replace(/^postgresql:\/\//i, "http://"));
    const connectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 8000);
    const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 8000);
    const poolMax = Number(process.env.DB_POOL_MAX ?? 5);

    logProductionRuntimeDiagnostics({
      mode: "tcp-pg",
      tcpMeta: {
        urlSource: pickedIsDirect ? "DIRECT_URL" : "DATABASE_URL",
        host: u.hostname,
        pooler: u.hostname.includes("-pooler"),
        poolMax,
        connectTimeoutMs,
        statementTimeoutMs,
      },
    });
  } catch {
    console.log("[prisma runtime] mode=tcp-pg (host diagnostics unavailable)");
  }

  const connectionTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 8000);
  const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 8000);
  const poolMax = Number(process.env.DB_POOL_MAX ?? 5);
  const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000);

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: connectionTimeoutMs,
    max: poolMax,
    idleTimeoutMillis: idleTimeoutMs,
    options: `-c statement_timeout=${statementTimeoutMs}`,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
