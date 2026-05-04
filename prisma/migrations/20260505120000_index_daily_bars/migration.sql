-- CreateTable
CREATE TABLE "index_daily_bars" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "index_daily_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "index_daily_bars_symbol_date_key" ON "index_daily_bars"("symbol", "date");

-- CreateIndex
CREATE INDEX "index_daily_bars_symbol_idx" ON "index_daily_bars"("symbol");
