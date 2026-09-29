-- Trade suggestion snapshot (#17): the Gợi ý lệnh as it stood when a trade was
-- logged from it, and when it was taken. Additive and nullable only: existing
-- trades (and manual entries, which have no suggestion) keep NULL, and no
-- existing column changes.
ALTER TABLE "trades" ADD COLUMN "suggestion_snapshot" JSONB;
ALTER TABLE "trades" ADD COLUMN "suggestion_snapshot_at" TIMESTAMP(3);
