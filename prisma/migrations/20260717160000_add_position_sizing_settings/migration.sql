-- User-configurable position-sizing overrides (risk per trade, max position
-- size, liquidity cap as ADV fraction) — all nullable, additive columns.
-- Null means "use the system default" (see position-sizing-panel.ts DEFAULT_*).
ALTER TABLE "user_trading_settings" ADD COLUMN "risk_per_trade_pct" DOUBLE PRECISION;
ALTER TABLE "user_trading_settings" ADD COLUMN "max_position_pct" DOUBLE PRECISION;
ALTER TABLE "user_trading_settings" ADD COLUMN "liquidity_cap_pct" DOUBLE PRECISION;
