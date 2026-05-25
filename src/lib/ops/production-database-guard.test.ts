import { afterEach, describe, expect, it } from "vitest";
import { validateProductionDatabaseUrl } from "./production-database-guard";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("validateProductionDatabaseUrl", () => {
  it("passes when guard is off", () => {
    delete process.env.BAR_IMPORT_REQUIRE_PRODUCTION_DB;
    process.env.DATABASE_URL =
      "postgresql://u:p@localhost:5432/dev?sslmode=require";
    expect(validateProductionDatabaseUrl().ok).toBe(true);
  });

  it("rejects localhost when production guard is on", () => {
    process.env.BAR_IMPORT_REQUIRE_PRODUCTION_DB = "1";
    process.env.DATABASE_URL =
      "postgresql://u:p@localhost:5432/dev?sslmode=require";
    const r = validateProductionDatabaseUrl();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("local");
  });

  it("accepts neon host when production guard is on", () => {
    process.env.BAR_IMPORT_REQUIRE_PRODUCTION_DB = "1";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-tiny-meadow.neon.tech/neondb?sslmode=require";
    expect(validateProductionDatabaseUrl().ok).toBe(true);
  });
});
