-- User-configurable trading settings (currently just account equity), settable
-- from the app's Settings page instead of only the TRADING_ACCOUNT_EQUITY_VND
-- env var. Additive table, no existing table/behavior changes.
CREATE TABLE "user_trading_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "account_equity_vnd" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_trading_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_trading_settings_user_id_key" ON "user_trading_settings"("user_id");
ALTER TABLE "user_trading_settings" ADD CONSTRAINT "user_trading_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
