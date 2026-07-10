-- Market Memory: market-level per-style setup base rates as of a session.
-- Additive: a new standalone table; no existing table or behavior is affected.
CREATE TABLE "market_memory_daily" (
  "session_date" DATE NOT NULL,
  "memory_json" JSONB NOT NULL,
  "schema_version" TEXT NOT NULL DEFAULT '1.0.0',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_memory_daily_pkey" PRIMARY KEY ("session_date")
);
