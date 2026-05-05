-- CreateTable
CREATE TABLE "stock_symbols" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_daily_bars" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'vnstock:VCI',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_daily_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_symbols_symbol_key" ON "stock_symbols"("symbol");

-- CreateIndex
CREATE INDEX "stock_daily_bars_symbol_id_date_idx" ON "stock_daily_bars"("symbol_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_daily_bars_symbol_id_date_key" ON "stock_daily_bars"("symbol_id", "date");

-- AddForeignKey
ALTER TABLE "stock_daily_bars" ADD CONSTRAINT "stock_daily_bars_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "stock_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
