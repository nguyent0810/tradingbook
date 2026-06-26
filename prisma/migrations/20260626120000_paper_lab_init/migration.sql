-- Paper Trading Lab (AI Arena)

CREATE TYPE "PaperPortfolioStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PaperOrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "PaperOrderType" AS ENUM ('MARKET_LIMIT_SIM');
CREATE TYPE "PaperOrderStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED');
CREATE TYPE "PaperPositionStatus" AS ENUM ('OPEN', 'PARTIAL', 'CLOSED');
CREATE TYPE "PaperExitReason" AS ENUM ('STOP_LOSS_HIT', 'TAKE_PROFIT_HIT', 'INVALIDATION_EXIT', 'TIME_EXIT', 'AGENT_EXIT', 'MANUAL_SIM');
CREATE TYPE "AgentDecisionValidationStatus" AS ENUM ('VALID', 'INVALID', 'SKIPPED');
CREATE TYPE "PaperAgentAction" AS ENUM ('BUY', 'SELL', 'HOLD', 'EXIT', 'REDUCE', 'ADD');
CREATE TYPE "ExperimentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "BacktestRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "paper_agents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paper_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paper_agents_slug_key" ON "paper_agents"("slug");
CREATE INDEX "paper_agents_active_idx" ON "paper_agents"("active");

CREATE TABLE "paper_agent_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "params_json" JSONB NOT NULL DEFAULT '{}',
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paper_agent_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paper_agent_versions_agent_id_version_key" ON "paper_agent_versions"("agent_id", "version");

CREATE TABLE "paper_portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "initial_capital_vnd" BIGINT NOT NULL DEFAULT 500000000,
    "cash_vnd" BIGINT NOT NULL DEFAULT 500000000,
    "status" "PaperPortfolioStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paper_portfolios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paper_portfolios_agent_id_key" ON "paper_portfolios"("agent_id");

CREATE TABLE "paper_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "decision_id" UUID,
    "symbol" TEXT NOT NULL,
    "side" "PaperOrderSide" NOT NULL,
    "order_type" "PaperOrderType" NOT NULL DEFAULT 'MARKET_LIMIT_SIM',
    "quantity" INTEGER NOT NULL,
    "price_kvnd" DOUBLE PRECISION NOT NULL,
    "status" "PaperOrderStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "session_date" DATE NOT NULL,
    "filled_at" TIMESTAMP(3),
    "fees_vnd" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paper_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paper_orders_decision_id_key" ON "paper_orders"("decision_id");
CREATE INDEX "paper_orders_portfolio_id_session_date_idx" ON "paper_orders"("portfolio_id", "session_date");
CREATE INDEX "paper_orders_symbol_session_date_idx" ON "paper_orders"("symbol", "session_date");
CREATE INDEX "paper_orders_status_idx" ON "paper_orders"("status");

CREATE TABLE "paper_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "avg_entry_kvnd" DOUBLE PRECISION NOT NULL,
    "stop_loss_kvnd" DOUBLE PRECISION NOT NULL,
    "take_profit_kvnd" DOUBLE PRECISION NOT NULL,
    "risk_amount_vnd" BIGINT NOT NULL,
    "status" "PaperPositionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" DATE NOT NULL,
    "closed_at" DATE,
    "entry_decision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paper_positions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paper_positions_portfolio_id_status_idx" ON "paper_positions"("portfolio_id", "status");
CREATE INDEX "paper_positions_symbol_status_idx" ON "paper_positions"("symbol", "status");

CREATE TABLE "paper_trades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "position_id" UUID NOT NULL,
    "exit_reason" "PaperExitReason" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "entry_kvnd" DOUBLE PRECISION NOT NULL,
    "exit_kvnd" DOUBLE PRECISION NOT NULL,
    "realized_pnl_vnd" BIGINT NOT NULL,
    "r_multiple" DOUBLE PRECISION,
    "holding_days" INTEGER NOT NULL,
    "closed_session_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paper_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paper_trades_position_id_idx" ON "paper_trades"("position_id");
CREATE INDEX "paper_trades_closed_session_date_idx" ON "paper_trades"("closed_session_date");

CREATE TABLE "agent_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "action" "PaperAgentAction" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "validation_status" "AgentDecisionValidationStatus" NOT NULL,
    "validation_errors" JSONB,
    "input_hash" TEXT,
    "experiment_run_id" UUID,
    "reasoning_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_decisions_session_date_agent_id_idx" ON "agent_decisions"("session_date", "agent_id");
CREATE INDEX "agent_decisions_symbol_session_date_idx" ON "agent_decisions"("symbol", "session_date");
CREATE INDEX "agent_decisions_validation_status_idx" ON "agent_decisions"("validation_status");

CREATE TABLE "agent_decision_inputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_decision_inputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_decision_inputs_decision_id_key" ON "agent_decision_inputs"("decision_id");

CREATE TABLE "agent_decision_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_decision_outputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_decision_outputs_decision_id_key" ON "agent_decision_outputs"("decision_id");

CREATE TABLE "portfolio_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "nav_vnd" BIGINT NOT NULL,
    "cash_vnd" BIGINT NOT NULL,
    "exposure_pct" DOUBLE PRECISION NOT NULL,
    "holdings_json" JSONB NOT NULL DEFAULT '[]',
    "sector_exposure_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolio_snapshots_portfolio_id_session_date_key" ON "portfolio_snapshots"("portfolio_id", "session_date");
CREATE INDEX "portfolio_snapshots_session_date_idx" ON "portfolio_snapshots"("session_date");

CREATE TABLE "agent_performance_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "nav_vnd" BIGINT NOT NULL,
    "total_return_pct" DOUBLE PRECISION NOT NULL,
    "realized_pnl_vnd" BIGINT NOT NULL,
    "unrealized_pnl_vnd" BIGINT NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "max_drawdown_pct" DOUBLE PRECISION NOT NULL,
    "sharpe_like" DOUBLE PRECISION NOT NULL,
    "trade_count" INTEGER NOT NULL,
    "open_positions" INTEGER NOT NULL,
    "metrics_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_performance_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_performance_daily_agent_id_session_date_key" ON "agent_performance_daily"("agent_id", "session_date");
CREATE INDEX "agent_performance_daily_session_date_idx" ON "agent_performance_daily"("session_date");

CREATE TABLE "agent_rankings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_date" DATE NOT NULL,
    "agent_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rank_change" INTEGER NOT NULL DEFAULT 0,
    "composite_score" DOUBLE PRECISION NOT NULL,
    "score_breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_rankings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_rankings_session_date_agent_id_key" ON "agent_rankings"("session_date", "agent_id");
CREATE INDEX "agent_rankings_session_date_rank_idx" ON "agent_rankings"("session_date", "rank");

CREATE TABLE "cio_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cio_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cio_recommendations_session_date_symbol_key" ON "cio_recommendations"("session_date", "symbol");
CREATE INDEX "cio_recommendations_session_date_idx" ON "cio_recommendations"("session_date");

CREATE TABLE "experiment_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "agent_version_map" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "ExperimentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    CONSTRAINT "experiment_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backtest_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_json" JSONB NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "results_json" JSONB,
    "status" "BacktestRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "backtest_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_logs_job_name_created_at_idx" ON "system_logs"("job_name", "created_at" DESC);

CREATE TABLE "agent_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT,
    "job_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_errors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_errors_agent_id_created_at_idx" ON "agent_errors"("agent_id", "created_at" DESC);

ALTER TABLE "paper_agent_versions" ADD CONSTRAINT "paper_agent_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paper_portfolios" ADD CONSTRAINT "paper_portfolios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "paper_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paper_positions" ADD CONSTRAINT "paper_positions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "paper_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "paper_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_experiment_run_id_fkey" FOREIGN KEY ("experiment_run_id") REFERENCES "experiment_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_decision_inputs" ADD CONSTRAINT "agent_decision_inputs_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_decision_outputs" ADD CONSTRAINT "agent_decision_outputs_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "paper_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_performance_daily" ADD CONSTRAINT "agent_performance_daily_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_rankings" ADD CONSTRAINT "agent_rankings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_errors" ADD CONSTRAINT "agent_errors_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
