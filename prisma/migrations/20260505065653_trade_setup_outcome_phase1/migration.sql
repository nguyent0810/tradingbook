-- CreateEnum
CREATE TYPE "TradeEntryReason" AS ENUM ('ZONE_RETEST', 'BREAKOUT_CONFIRM', 'PULLBACK_ENTRY', 'STRUCTURE_CONTINUATION', 'MOMENTUM_CONFIRM', 'READY_ON_OPEN', 'READY_INTRADAY', 'LATE_CHASE');

-- CreateEnum
CREATE TYPE "TradeExitReason" AS ENUM ('TAKE_PROFIT_HIT', 'STOP_LOSS_HIT', 'ZONE_INVALIDATED', 'STRUCTURE_BROKEN', 'HEALTH_DEGRADED_EOD', 'TIME_STOP', 'MANUAL_RULE_BASED_EXIT');

-- CreateEnum
CREATE TYPE "TradeExitDiscipline" AS ENUM ('FOLLOWED_PLAN', 'EARLY_EXIT_RULE_BASED', 'EMOTIONAL_EXIT', 'RULE_VIOLATION');

-- CreateEnum
CREATE TYPE "TradeEntryLocationVsZone" AS ENUM ('IN_ZONE', 'ABOVE_ZONE', 'BELOW_ZONE');

-- CreateEnum
CREATE TYPE "TradeOutcome" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN');

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "entry_location_vs_zone" "TradeEntryLocationVsZone",
ADD COLUMN     "entry_note" TEXT,
ADD COLUMN     "entry_reason" "TradeEntryReason",
ADD COLUMN     "exit_discipline" "TradeExitDiscipline",
ADD COLUMN     "exit_note" TEXT,
ADD COLUMN     "exit_reason" "TradeExitReason",
ADD COLUMN     "health_level_at_entry" "SetupHealthLevel",
ADD COLUMN     "health_score_at_entry" INTEGER,
ADD COLUMN     "outcome" "TradeOutcome",
ADD COLUMN     "position_size" DOUBLE PRECISION,
ADD COLUMN     "r_multiple" DOUBLE PRECISION,
ADD COLUMN     "setup_id" TEXT,
ADD COLUMN     "setup_snapshot" JSONB,
ADD COLUMN     "stop_loss" DOUBLE PRECISION,
ADD COLUMN     "take_profit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "setup_outcomes" (
    "id" TEXT NOT NULL,
    "setup_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "setup_type" "ScanSetupType" NOT NULL,
    "setup_tier_at_entry" "ScanQuality" NOT NULL,
    "entry_reason" "TradeEntryReason",
    "entry_location_vs_zone" "TradeEntryLocationVsZone",
    "health_level_at_entry" "SetupHealthLevel",
    "health_level_at_exit" "SetupHealthLevel",
    "exit_reason" "TradeExitReason",
    "exit_discipline" "TradeExitDiscipline",
    "r_multiple" DOUBLE PRECISION,
    "pnl" DOUBLE PRECISION,
    "outcome" "TradeOutcome",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setup_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setup_outcomes_trade_id_key" ON "setup_outcomes"("trade_id");

-- CreateIndex
CREATE INDEX "setup_outcomes_setup_id_idx" ON "setup_outcomes"("setup_id");

-- CreateIndex
CREATE INDEX "setup_outcomes_setup_type_setup_tier_at_entry_idx" ON "setup_outcomes"("setup_type", "setup_tier_at_entry");

-- CreateIndex
CREATE INDEX "trades_setup_id_idx" ON "trades"("setup_id");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_setup_id_fkey" FOREIGN KEY ("setup_id") REFERENCES "setup_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_outcomes" ADD CONSTRAINT "setup_outcomes_setup_id_fkey" FOREIGN KEY ("setup_id") REFERENCES "setup_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_outcomes" ADD CONSTRAINT "setup_outcomes_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
