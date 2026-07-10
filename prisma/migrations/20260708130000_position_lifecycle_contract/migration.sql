-- Phase 0.5 (Platform Contracts): position lifecycle vocabulary.
-- Additive and behavior-neutral: the engine initializes every new position to
-- 'OPEN' and never transitions the value; nothing reads it yet. Existing rows are
-- backfilled to 'OPEN' by the column default. `PaperPositionStatus` is unchanged.

-- CreateEnum
CREATE TYPE "PositionLifecycle" AS ENUM (
  'OPEN',
  'ADDING',
  'PARTIAL_EXIT',
  'RUNNING',
  'TRAILING',
  'STOPPED',
  'TARGET_HIT',
  'TIME_EXIT',
  'ROTATED',
  'CLOSED'
);

-- AlterTable
ALTER TABLE "paper_positions"
  ADD COLUMN "lifecycle" "PositionLifecycle" NOT NULL DEFAULT 'OPEN';
