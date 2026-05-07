-- CreateEnum
CREATE TYPE "TacticalSymbolStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REMOVED');

-- CreateTable
CREATE TABLE "tactical_symbols" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason_note" TEXT,
    "active_for_scanner" BOOLEAN NOT NULL DEFAULT true,
    "status" "TacticalSymbolStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "imported_bars_at" TIMESTAMP(3),
    "last_evaluated_at" TIMESTAMP(3),
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tactical_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tactical_symbols_symbol_idx" ON "tactical_symbols"("symbol");

-- CreateIndex
CREATE INDEX "tactical_symbols_status_idx" ON "tactical_symbols"("status");

-- CreateIndex
CREATE INDEX "tactical_symbols_active_for_scanner_idx" ON "tactical_symbols"("active_for_scanner");

-- CreateIndex
CREATE INDEX "tactical_symbols_expires_at_idx" ON "tactical_symbols"("expires_at");

-- CreateIndex
CREATE INDEX "tactical_symbols_status_active_for_scanner_expires_at_idx" ON "tactical_symbols"("status", "active_for_scanner", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tactical_symbols_symbol_status_key" ON "tactical_symbols"("symbol", "status");
