-- Performance Attribution (v1): additive tables. No existing table/behavior changes.
CREATE TABLE "trade_attributions" (
  "id" UUID NOT NULL,
  "paper_trade_id" UUID NOT NULL,
  "position_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "entry_decision_id" TEXT,
  "exit_decision_id" TEXT,
  "attribution_schema_version" TEXT NOT NULL DEFAULT '1.0.0',
  "engine_version" TEXT NOT NULL,
  "dna_version" TEXT,
  "setup_type" TEXT NOT NULL,
  "exit_reason" TEXT NOT NULL,
  "regime_at_entry" TEXT,
  "regime_at_exit" TEXT,
  "mfe_r" DOUBLE PRECISION,
  "mae_r" DOUBLE PRECISION,
  "entry_quality_score" DOUBLE PRECISION NOT NULL,
  "holding_quality_score" DOUBLE PRECISION NOT NULL,
  "exit_quality_score" DOUBLE PRECISION NOT NULL,
  "sizing_quality_score" DOUBLE PRECISION NOT NULL,
  "regime_fit_score" DOUBLE PRECISION NOT NULL,
  "risk_control_score" DOUBLE PRECISION NOT NULL,
  "gross_price_move_vnd" BIGINT NOT NULL,
  "fees_vnd" BIGINT NOT NULL,
  "realized_pnl_vnd" BIGINT NOT NULL,
  "cash_drag_vnd" BIGINT,
  "left_on_table_pct" DOUBLE PRECISION,
  "reason_codes_json" JSONB NOT NULL,
  "contributions_json" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trade_attributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trade_attributions_paper_trade_id_key" ON "trade_attributions"("paper_trade_id");
CREATE INDEX "trade_attributions_agent_id_idx" ON "trade_attributions"("agent_id");
ALTER TABLE "trade_attributions" ADD CONSTRAINT "trade_attributions_paper_trade_id_fkey"
  FOREIGN KEY ("paper_trade_id") REFERENCES "paper_trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "manager_attribution_monthly" (
  "id" UUID NOT NULL,
  "agent_id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "attribution_schema_version" TEXT NOT NULL DEFAULT '1.0.0',
  "trade_count" INTEGER NOT NULL,
  "realized_pnl_vnd" BIGINT NOT NULL,
  "reconciled_pnl_vnd" BIGINT NOT NULL,
  "avg_entry_quality" DOUBLE PRECISION NOT NULL,
  "avg_holding_quality" DOUBLE PRECISION NOT NULL,
  "avg_exit_quality" DOUBLE PRECISION NOT NULL,
  "avg_sizing_quality" DOUBLE PRECISION NOT NULL,
  "avg_regime_fit" DOUBLE PRECISION NOT NULL,
  "avg_risk_control" DOUBLE PRECISION NOT NULL,
  "cash_drag_vnd" BIGINT NOT NULL,
  "by_setup_json" JSONB NOT NULL,
  "by_regime_json" JSONB NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manager_attribution_monthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "manager_attribution_monthly_agent_id_month_key" ON "manager_attribution_monthly"("agent_id", "month");
