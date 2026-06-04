-- Phase 1A: forward-only VCI price_board foreign snapshots + market context rollups

CREATE TYPE "ForeignCaptureMethod" AS ENUM ('PRICE_BOARD_EOD_SNAPSHOT');

CREATE TYPE "ForeignDataQuality" AS ENUM ('OK', 'ALL_ZERO', 'PARTIAL', 'ERROR');

CREATE TABLE "foreign_trade_daily" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "buy_volume" DOUBLE PRECISION,
    "sell_volume" DOUBLE PRECISION,
    "net_volume" DOUBLE PRECISION,
    "buy_value_vnd" DOUBLE PRECISION,
    "sell_value_vnd" DOUBLE PRECISION,
    "net_value_vnd" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'vnstock:VCI',
    "capture_method" "ForeignCaptureMethod" NOT NULL DEFAULT 'PRICE_BOARD_EOD_SNAPSHOT',
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_quality" "ForeignDataQuality" NOT NULL DEFAULT 'PARTIAL',

    CONSTRAINT "foreign_trade_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_context_daily" (
    "session_date" DATE NOT NULL,
    "vnindex_close" DOUBLE PRECISION,
    "vnindex_ma20" DOUBLE PRECISION,
    "vnindex_ma50" DOUBLE PRECISION,
    "vnindex_volume" DOUBLE PRECISION,
    "vnindex_vol_ma20" DOUBLE PRECISION,
    "vnindex_vol_ratio_ma20" DOUBLE PRECISION,
    "gate1_level" "Gate1ScanLevel",
    "foreign_net_value_1d" DOUBLE PRECISION,
    "foreign_net_value_5d" DOUBLE PRECISION,
    "foreign_net_value_10d" DOUBLE PRECISION,
    "foreign_symbols_ok" INTEGER NOT NULL DEFAULT 0,
    "foreign_symbols_total" INTEGER NOT NULL DEFAULT 0,
    "foreign_coverage_pct" DOUBLE PRECISION,
    "symbols_built" INTEGER NOT NULL DEFAULT 0,
    "built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_context_daily_pkey" PRIMARY KEY ("session_date")
);

CREATE TABLE "symbol_market_context_daily" (
    "id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "vol_ma20" DOUBLE PRECISION,
    "vol_ratio_ma20" DOUBLE PRECISION,
    "foreign_net_value_1d" DOUBLE PRECISION,
    "foreign_net_value_5d" DOUBLE PRECISION,
    "foreign_net_value_10d" DOUBLE PRECISION,
    "foreign_data_quality" "ForeignDataQuality",

    CONSTRAINT "symbol_market_context_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "foreign_trade_daily_symbol_id_session_date_key" ON "foreign_trade_daily"("symbol_id", "session_date");

CREATE INDEX "foreign_trade_daily_session_date_idx" ON "foreign_trade_daily"("session_date");

CREATE INDEX "foreign_trade_daily_symbol_id_session_date_idx" ON "foreign_trade_daily"("symbol_id", "session_date" DESC);

CREATE UNIQUE INDEX "symbol_market_context_daily_session_date_symbol_id_key" ON "symbol_market_context_daily"("session_date", "symbol_id");

CREATE INDEX "symbol_market_context_daily_symbol_id_session_date_idx" ON "symbol_market_context_daily"("symbol_id", "session_date" DESC);

ALTER TABLE "foreign_trade_daily" ADD CONSTRAINT "foreign_trade_daily_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "stock_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "symbol_market_context_daily" ADD CONSTRAINT "symbol_market_context_daily_session_date_fkey" FOREIGN KEY ("session_date") REFERENCES "market_context_daily"("session_date") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "symbol_market_context_daily" ADD CONSTRAINT "symbol_market_context_daily_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "stock_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
