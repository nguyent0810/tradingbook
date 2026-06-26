#!/usr/bin/env npx tsx
/**
 * Validates Phase 2 paper-lab / lab table row counts after daily jobs.
 * Usage: npx tsx scripts/validate-paper-lab-data.ts
 */
import "./load-env";
import { prisma } from "@/lib/prisma";

async function count(label: string, fn: () => Promise<number>) {
  const n = await fn();
  console.log(`${label}: ${n}`);
  return n;
}

async function main() {
  const checks: Record<string, number> = {};

  checks.market_regime_snapshots = await count(
    "market_regime_snapshots",
    () => prisma.marketRegimeSnapshot.count()
  );
  checks.paper_portfolios = await count("paper_portfolios", () => prisma.paperPortfolio.count());
  checks.agent_decisions = await count("agent_decisions", () => prisma.agentDecision.count());
  checks.paper_orders = await count("paper_orders", () => prisma.paperOrder.count());
  checks.paper_positions = await count("paper_positions", () => prisma.paperPosition.count());
  checks.paper_trades = await count("paper_trades", () => prisma.paperTrade.count());
  checks.portfolio_snapshots = await count(
    "portfolio_snapshots",
    () => prisma.portfolioSnapshot.count()
  );
  checks.agent_rankings = await count("agent_rankings", () => prisma.agentRanking.count());
  checks.arena_battles = await count("arena_battles", () => prisma.arenaBattle.count());
  checks.agent_calibration_daily = await count(
    "agent_calibration_daily",
    () => prisma.agentCalibrationDaily.count()
  );
  checks.agent_dna_profiles = await count(
    "agent_dna_profiles",
    () => prisma.agentDnaProfile.count()
  );
  checks.agent_evolution_daily = await count(
    "agent_evolution_daily",
    () => prisma.agentEvolutionDaily.count()
  );
  checks.cio_recommendations = await count(
    "cio_recommendations",
    () => prisma.cioRecommendation.count()
  );
  checks.explanation_traces = await count(
    "explanation_traces",
    () => prisma.explanationTrace.count()
  );
  checks.session_replay_bundles = await count(
    "session_replay_bundles",
    () => prisma.sessionReplayBundle.count()
  );
  checks.lab_telemetry_events = await count(
    "lab_telemetry_events",
    () => prisma.labTelemetryEvent.count()
  );

  const required = [
    "market_regime_snapshots",
    "paper_portfolios",
    "agent_decisions",
    "portfolio_snapshots",
    "agent_rankings",
    "arena_battles",
    "agent_calibration_daily",
    "agent_dna_profiles",
    "agent_evolution_daily",
    "cio_recommendations",
    "explanation_traces",
    "session_replay_bundles",
    "lab_telemetry_events",
  ];

  const missing = required.filter((k) => (checks[k] ?? 0) < 1);
  if (missing.length > 0) {
    console.error("\nMissing data in:", missing.join(", "));
    process.exit(1);
  }

  console.log("\nAll required Phase 2 tables have data.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
