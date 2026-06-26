-- Phase 2: AI Investment Laboratory

CREATE TYPE "PaperAgentClass" AS ENUM ('AI', 'HUMAN');
CREATE TYPE "PromptVersionStatus" AS ENUM ('DRAFT', 'SHADOW', 'CHALLENGER', 'ACTIVE', 'CHAMPION', 'DEPRECATED');
CREATE TYPE "ExperimentType" AS ENUM ('PROMPT_AB', 'PARAM_AB', 'MODEL_AB', 'TEMPERATURE_AB');
CREATE TYPE "ArenaBattleStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "BattleOutcomeVerdict" AS ENUM ('PENDING', 'CORRECT_BUY', 'WRONG_BUY', 'CORRECT_AVOID', 'WRONG_AVOID', 'CORRECT_RISK', 'OPEN', 'NEUTRAL');
CREATE TYPE "HallOfFameAchievementType" AS ENUM ('GREATEST_TRADE', 'HIGHEST_R_MULTIPLE', 'BEST_MONTHLY_RETURN', 'LONGEST_WIN_STREAK', 'MOST_ACCURATE_AGENT', 'BEST_RECOVERY', 'HIGHEST_CONFIDENCE_CORRECT', 'WORST_PREDICTION', 'LUCKIEST_TRADE', 'UNLUCKIEST_TRADE');
CREATE TYPE "EvolutionTrend" AS ENUM ('IMPROVING', 'STABLE', 'DEGRADING');

ALTER TABLE "paper_agents" ADD COLUMN "active_prompt_version_id" UUID;
ALTER TABLE "paper_agents" ADD COLUMN "agent_class" "PaperAgentClass" NOT NULL DEFAULT 'AI';
ALTER TABLE "paper_agents" ADD COLUMN "user_id" TEXT;

ALTER TABLE "agent_decisions" ADD COLUMN "regime_snapshot_id" DATE;
ALTER TABLE "agent_decisions" ADD COLUMN "battle_id" UUID;
ALTER TABLE "agent_decisions" ADD COLUMN "prompt_version_id" UUID;
ALTER TABLE "agent_decisions" ADD COLUMN "memory_snapshot_json" JSONB;

CREATE TABLE "market_regime_snapshots" (
    "session_date" DATE NOT NULL,
    "gate1_level" "Gate1ScanLevel",
    "dimensions_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "schema_version" TEXT NOT NULL DEFAULT '1.0.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_regime_snapshots_pkey" PRIMARY KEY ("session_date")
);

CREATE TABLE "agent_regime_performance_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "regime_id" DATE NOT NULL,
    "trend_regime" TEXT NOT NULL,
    "return_pct" DOUBLE PRECISION NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "trade_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_regime_performance_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_regime_performance_daily_agent_id_session_date_trend_regime_key" ON "agent_regime_performance_daily"("agent_id", "session_date", "trend_regime");

CREATE TABLE "agent_memory_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "as_of_session" DATE NOT NULL,
    "window_days" INTEGER NOT NULL,
    "stats_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_memory_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_memory_stats_agent_id_as_of_session_window_days_key" ON "agent_memory_stats"("agent_id", "as_of_session", "window_days");

CREATE TABLE "agent_setup_memory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "setup_signature" TEXT NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "avg_return_pct" DOUBLE PRECISION NOT NULL,
    "avg_r_multiple" DOUBLE PRECISION NOT NULL,
    "avg_holding_days" DOUBLE PRECISION NOT NULL,
    "failure_rate" DOUBLE PRECISION NOT NULL,
    "regime_breakdown" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_setup_memory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_setup_memory_agent_id_setup_signature_key" ON "agent_setup_memory"("agent_id", "setup_signature");

CREATE TABLE "agent_memory_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "as_of_session" DATE NOT NULL,
    "profile_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_memory_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_memory_profiles_agent_id_as_of_session_key" ON "agent_memory_profiles"("agent_id", "as_of_session");

CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "params_json" JSONB NOT NULL DEFAULT '{}',
    "status" "PromptVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "model_id" TEXT,
    "temperature" DOUBLE PRECISION,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prompt_versions_agent_id_version_label_key" ON "prompt_versions"("agent_id", "version_label");

CREATE TABLE "prompt_experiments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "ExperimentType" NOT NULL,
    "status" "ExperimentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompt_experiment_arms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "experiment_id" UUID NOT NULL,
    "arm_label" TEXT NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "is_control" BOOLEAN NOT NULL DEFAULT false,
    "metrics_json" JSONB,
    CONSTRAINT "prompt_experiment_arms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prompt_experiment_arms_experiment_id_arm_label_key" ON "prompt_experiment_arms"("experiment_id", "arm_label");

CREATE TABLE "prompt_promotion_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "experiment_id" UUID,
    "agent_id" TEXT NOT NULL,
    "from_version_id" UUID,
    "to_version_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_promotion_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arena_battles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "status" "ArenaBattleStatus" NOT NULL DEFAULT 'OPEN',
    "benchmark_return_5d_pct" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    CONSTRAINT "arena_battles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arena_battles_session_date_symbol_key" ON "arena_battles"("session_date", "symbol");

CREATE TABLE "arena_battle_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "battle_id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action" "PaperAgentAction" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    CONSTRAINT "arena_battle_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arena_battle_decisions_decision_id_key" ON "arena_battle_decisions"("decision_id");

CREATE TABLE "arena_battle_outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "battle_id" UUID NOT NULL,
    "battle_decision_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "verdict" "BattleOutcomeVerdict" NOT NULL DEFAULT 'PENDING',
    "r_multiple" DOUBLE PRECISION,
    "forward_return_5d_pct" DOUBLE PRECISION,
    "explanation" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arena_battle_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arena_battle_outcomes_battle_decision_id_key" ON "arena_battle_outcomes"("battle_decision_id");

CREATE TABLE "hall_of_fame_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "achievement_type" "HallOfFameAchievementType" NOT NULL,
    "agent_id" TEXT,
    "season_id" TEXT,
    "session_date" DATE,
    "symbol" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hall_of_fame_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_dna_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "as_of_session" DATE NOT NULL,
    "profile_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_dna_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_dna_profiles_agent_id_as_of_session_key" ON "agent_dna_profiles"("agent_id", "as_of_session");

CREATE TABLE "agent_calibration_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "brier_score" DOUBLE PRECISION NOT NULL,
    "overconfidence" DOUBLE PRECISION NOT NULL,
    "bucket_json" JSONB NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_calibration_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_calibration_daily_agent_id_session_date_key" ON "agent_calibration_daily"("agent_id", "session_date");

CREATE TABLE "agent_evolution_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "trend" "EvolutionTrend" NOT NULL,
    "components_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_evolution_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_evolution_daily_agent_id_session_date_key" ON "agent_evolution_daily"("agent_id", "session_date");

CREATE TABLE "explanation_traces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "trace_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "explanation_traces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "explanation_traces_decision_id_key" ON "explanation_traces"("decision_id");

CREATE TABLE "session_replay_bundles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_date" DATE NOT NULL,
    "regime_id" DATE,
    "bundle_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_replay_bundles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_replay_bundles_session_date_key" ON "session_replay_bundles"("session_date");

CREATE TABLE "experiment_portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "experiment_run_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "arm_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_portfolios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "experiment_portfolios_portfolio_id_key" ON "experiment_portfolios"("portfolio_id");

CREATE TABLE "lab_telemetry_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" TEXT NOT NULL,
    "agent_id" TEXT,
    "event_type" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "token_count" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "context_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lab_telemetry_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "paper_agents" ADD CONSTRAINT "paper_agents_active_prompt_version_id_fkey" FOREIGN KEY ("active_prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_regime_snapshot_id_fkey" FOREIGN KEY ("regime_snapshot_id") REFERENCES "market_regime_snapshots"("session_date") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "arena_battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_regime_performance_daily" ADD CONSTRAINT "agent_regime_performance_daily_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_regime_performance_daily" ADD CONSTRAINT "agent_regime_performance_daily_regime_id_fkey" FOREIGN KEY ("regime_id") REFERENCES "market_regime_snapshots"("session_date") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memory_stats" ADD CONSTRAINT "agent_memory_stats_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_setup_memory" ADD CONSTRAINT "agent_setup_memory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memory_profiles" ADD CONSTRAINT "agent_memory_profiles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_experiment_arms" ADD CONSTRAINT "prompt_experiment_arms_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "prompt_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_experiment_arms" ADD CONSTRAINT "prompt_experiment_arms_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_promotion_events" ADD CONSTRAINT "prompt_promotion_events_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "prompt_experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prompt_promotion_events" ADD CONSTRAINT "prompt_promotion_events_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "prompt_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_battle_decisions" ADD CONSTRAINT "arena_battle_decisions_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "arena_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_battle_decisions" ADD CONSTRAINT "arena_battle_decisions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_battle_decisions" ADD CONSTRAINT "arena_battle_decisions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_battle_outcomes" ADD CONSTRAINT "arena_battle_outcomes_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "arena_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_battle_outcomes" ADD CONSTRAINT "arena_battle_outcomes_battle_decision_id_fkey" FOREIGN KEY ("battle_decision_id") REFERENCES "arena_battle_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hall_of_fame_entries" ADD CONSTRAINT "hall_of_fame_entries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_dna_profiles" ADD CONSTRAINT "agent_dna_profiles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_calibration_daily" ADD CONSTRAINT "agent_calibration_daily_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_evolution_daily" ADD CONSTRAINT "agent_evolution_daily_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "explanation_traces" ADD CONSTRAINT "explanation_traces_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_replay_bundles" ADD CONSTRAINT "session_replay_bundles_regime_id_fkey" FOREIGN KEY ("regime_id") REFERENCES "market_regime_snapshots"("session_date") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experiment_portfolios" ADD CONSTRAINT "experiment_portfolios_experiment_run_id_fkey" FOREIGN KEY ("experiment_run_id") REFERENCES "experiment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_portfolios" ADD CONSTRAINT "experiment_portfolios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "paper_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experiment_portfolios" ADD CONSTRAINT "experiment_portfolios_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "paper_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "agent_regime_performance_daily_agent_id_trend_regime_idx" ON "agent_regime_performance_daily"("agent_id", "trend_regime");
CREATE INDEX "arena_battles_session_date_idx" ON "arena_battles"("session_date");
CREATE INDEX "arena_battle_outcomes_battle_id_verdict_idx" ON "arena_battle_outcomes"("battle_id", "verdict");
CREATE INDEX "hall_of_fame_entries_achievement_type_value_idx" ON "hall_of_fame_entries"("achievement_type", "value" DESC);
CREATE INDEX "hall_of_fame_entries_agent_id_idx" ON "hall_of_fame_entries"("agent_id");
CREATE INDEX "lab_telemetry_events_job_name_created_at_idx" ON "lab_telemetry_events"("job_name", "created_at" DESC);
CREATE INDEX "lab_telemetry_events_event_type_created_at_idx" ON "lab_telemetry_events"("event_type", "created_at" DESC);
CREATE INDEX "prompt_promotion_events_agent_id_created_at_idx" ON "prompt_promotion_events"("agent_id", "created_at" DESC);
