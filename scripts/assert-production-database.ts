/**
 * Exit 1 when BAR_IMPORT_REQUIRE_PRODUCTION_DB=1 and DATABASE_URL fails allowlist.
 */
import "./load-env";
import { validateProductionDatabaseUrl } from "../src/lib/ops/production-database-guard";

const result = validateProductionDatabaseUrl();
if (!result.ok) {
  console.error("[assert-production-database]", result.reason, result.databaseUrlHint);
  process.exit(1);
}
console.error(
  "[assert-production-database] ok",
  result.databaseUrlHint,
  process.env.BAR_IMPORT_REQUIRE_PRODUCTION_DB === "1" ? "(production guard on)" : "(guard off)"
);
