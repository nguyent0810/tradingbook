-- Shadow Capital Allocation review (read-only). Additive; moves no capital.
CREATE TABLE "allocation_reviews" (
  "id" UUID NOT NULL,
  "review_date" DATE NOT NULL,
  "cadence" TEXT NOT NULL,
  "trailing_window_sessions" INTEGER NOT NULL,
  "schema_version" TEXT NOT NULL DEFAULT '1.0.0',
  "scoring_version" TEXT NOT NULL,
  "total_pool_vnd" BIGINT NOT NULL,
  "scorecards_json" JSONB NOT NULL,
  "current_allocation_json" JSONB NOT NULL,
  "proposed_allocation_json" JSONB NOT NULL,
  "reason_codes_json" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "allocation_reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "allocation_reviews_review_date_cadence_scoring_version_key" ON "allocation_reviews"("review_date", "cadence", "scoring_version");
