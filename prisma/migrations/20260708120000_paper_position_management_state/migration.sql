-- Phase 0 (Fund Manager Engine): additive position-management state on paper_positions.
-- All columns are nullable or defaulted, so existing rows and legacy execution are unaffected.
-- Trailing/add/partial EXECUTION is deferred to later phases; these are initialized on open only.
ALTER TABLE "paper_positions"
  ADD COLUMN "high_water_mark_kvnd" DOUBLE PRECISION,
  ADD COLUMN "trailing_stop_kvnd" DOUBLE PRECISION,
  ADD COLUMN "initial_risk_per_share_kvnd" DOUBLE PRECISION,
  ADD COLUMN "adds_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "partials_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "max_favorable_excursion_kvnd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "max_adverse_excursion_kvnd" DOUBLE PRECISION NOT NULL DEFAULT 0;
