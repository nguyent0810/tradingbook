-- Lightweight EOD review checklist per checkpoint (optional JSON).
ALTER TABLE "trade_health_logs" ADD COLUMN "review_checklist" JSONB;
