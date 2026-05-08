// Prisma CLI (migrate, db push, etc.) reads `datasource.url` from this file — not from schema.prisma.
//
// Neon: use the pooled URL as DATABASE_URL for the app (`src/lib/prisma.ts`) and set DIRECT_URL to the
// *direct* connection string (hostname without `-pooler`) for migrations. Running `migrate deploy` against
// the pooler endpoint often fails with P1001. See https://neon.tech/docs/guides/prisma
//
// If Neon compute was idle, add query params on DIRECT_URL, e.g. `sslmode=require&connect_timeout=30`.
import "dotenv/config";
import { defineConfig } from "prisma/config";

function prismaCliDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;
  return process.env.DATABASE_URL?.trim() ?? "";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: prismaCliDatabaseUrl(),
  },
});
