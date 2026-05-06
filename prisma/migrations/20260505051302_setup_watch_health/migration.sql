-- CreateEnum
CREATE TYPE "SetupLifecycleStatus" AS ENUM ('NEW', 'WATCHING', 'READY', 'TRIGGERED', 'EXPIRED', 'INVALID');

-- CreateEnum
CREATE TYPE "SetupHealthLevel" AS ENUM ('HEALTHY', 'WARNING', 'AT_RISK', 'DEAD');

-- CreateTable
CREATE TABLE "setup_watch_items" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "setup_type" "ScanSetupType" NOT NULL,
    "quality" "ScanQuality" NOT NULL,
    "lifecycle_status" "SetupLifecycleStatus" NOT NULL DEFAULT 'WATCHING',
    "breakout_level" DOUBLE PRECISION NOT NULL,
    "pullback_zone_low" DOUBLE PRECISION NOT NULL,
    "pullback_zone_high" DOUBLE PRECISION NOT NULL,
    "first_seen_bar_date" DATE NOT NULL,
    "last_seen_scan_run_id" TEXT,
    "health_flags" JSONB,
    "health_score" INTEGER,
    "health_level" "SetupHealthLevel",
    "last_health_evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setup_watch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setup_watch_items_health_level_idx" ON "setup_watch_items"("health_level");

-- CreateIndex
CREATE INDEX "setup_watch_items_lifecycle_status_idx" ON "setup_watch_items"("lifecycle_status");

-- CreateIndex
CREATE UNIQUE INDEX "setup_watch_items_symbol_id_setup_type_key" ON "setup_watch_items"("symbol_id", "setup_type");

-- AddForeignKey
ALTER TABLE "setup_watch_items" ADD CONSTRAINT "setup_watch_items_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "stock_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
