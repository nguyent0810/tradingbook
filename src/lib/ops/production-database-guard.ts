import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";

export type ProductionDbGuardResult =
  | { ok: true; databaseUrlHint: string }
  | { ok: false; reason: string; databaseUrlHint: string };

const DEFAULT_HOST_PATTERNS = ["neon.tech"];

function hostPatternsFromEnv(): string[] {
  const raw = process.env.PROD_DB_HOST_ALLOWLIST?.trim();
  if (!raw) return DEFAULT_HOST_PATTERNS;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameFromDatabaseUrl(url: string): string | null {
  try {
    const normalized = url
      .replace(/^postgresql:\/\//i, "http://")
      .replace(/^postgres:\/\//i, "http://");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Optional guard for scheduled production imports (GitHub Actions).
 * Set `BAR_IMPORT_REQUIRE_PRODUCTION_DB=1` to enforce host allowlist.
 */
export function validateProductionDatabaseUrl(): ProductionDbGuardResult {
  const hint = describeDatabaseUrl();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return { ok: false, reason: "DATABASE_URL is unset", databaseUrlHint: hint };
  }

  if (process.env.BAR_IMPORT_REQUIRE_PRODUCTION_DB !== "1") {
    return { ok: true, databaseUrlHint: hint };
  }

  const host = hostnameFromDatabaseUrl(url);
  if (!host) {
    return {
      ok: false,
      reason: "DATABASE_URL is not parseable",
      databaseUrlHint: hint,
    };
  }

  const patterns = hostPatternsFromEnv();
  const matched = patterns.some((p) => host.includes(p));
  if (!matched) {
    return {
      ok: false,
      reason: `Host "${host}" does not match allowlist: ${patterns.join(", ")}`,
      databaseUrlHint: hint,
    };
  }

  if (process.env.NODE_ENV === "test") {
    return { ok: true, databaseUrlHint: hint };
  }

  const blocked = ["localhost", "127.0.0.1", "0.0.0.0"];
  if (blocked.some((b) => host.includes(b))) {
    return {
      ok: false,
      reason: `Refusing bar import against local host "${host}"`,
      databaseUrlHint: hint,
    };
  }

  return { ok: true, databaseUrlHint: hint };
}
