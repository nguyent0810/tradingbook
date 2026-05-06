-- Persist per-trade EOD health checkpoints (referenced by raw SQL in server actions / trades pages).

CREATE TABLE "trade_health_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trade_id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "health_level" TEXT NOT NULL,
    "health_score" INTEGER,
    "price_vs_zone" TEXT,
    "structure_status" TEXT,
    "recommended_action" TEXT,

    CONSTRAINT "trade_health_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trade_health_logs_trade_id_checked_at_idx" ON "trade_health_logs"("trade_id", "checked_at");

ALTER TABLE "trade_health_logs" ADD CONSTRAINT "trade_health_logs_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
