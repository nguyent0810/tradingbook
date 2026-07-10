/**
 * Reset Paper Lab simulation data (dry-run). Keeps paper_agents and portfolios (cash restored).
 * Usage: load .env.prod.local then `npx tsx scripts/reset-paper-lab-simulation.ts`
 */
import "./load-env";
import { prisma } from "@/lib/prisma";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";

async function main() {
  console.log("Resetting Paper Lab simulation data (agents preserved)...");

  await prisma.arenaBattleOutcome.deleteMany({});
  await prisma.arenaBattleDecision.deleteMany({});
  await prisma.arenaBattle.deleteMany({});
  await prisma.explanationTrace.deleteMany({});
  await prisma.sessionReplayBundle.deleteMany({});
  await prisma.labTelemetryEvent.deleteMany({});
  await prisma.agentCalibrationDaily.deleteMany({});
  await prisma.agentEvolutionDaily.deleteMany({});
  await prisma.agentDnaProfile.deleteMany({});
  await prisma.agentRegimePerformanceDaily.deleteMany({});
  await prisma.agentMemoryProfile.deleteMany({});
  await prisma.agentSetupMemory.deleteMany({});
  await prisma.agentMemoryStats.deleteMany({});
  await prisma.agentError.deleteMany({});

  await prisma.paperTrade.deleteMany({});
  await prisma.paperOrder.deleteMany({});
  await prisma.paperPosition.deleteMany({});

  await prisma.agentDecisionOutput.deleteMany({});
  await prisma.agentDecisionInput.deleteMany({});
  await prisma.agentDecision.deleteMany({});

  await prisma.portfolioSnapshot.deleteMany({});
  await prisma.agentPerformanceDaily.deleteMany({});
  await prisma.agentRanking.deleteMany({});
  await prisma.cioRecommendation.deleteMany({});
  await prisma.marketRegimeSnapshot.deleteMany({});

  const portfolios = await prisma.paperPortfolio.findMany();
  for (const p of portfolios) {
    await prisma.paperPortfolio.update({
      where: { id: p.id },
      data: {
        cashVnd: BigInt(PAPER_INITIAL_CAPITAL_VND),
        status: "ACTIVE",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        portfoliosReset: portfolios.length,
        initialCapitalVnd: PAPER_INITIAL_CAPITAL_VND,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
