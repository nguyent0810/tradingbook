import type { PrismaClient } from "@/generated/prisma/client";
import type { ExperimentType } from "@/generated/prisma/client";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import { promotePromptVersion } from "@/lib/lab/prompts/lifecycle";

export async function createPromptExperiment(
  prisma: PrismaClient,
  params: {
    name: string;
    type: ExperimentType;
    agentId: string;
    controlVersionId: string;
    challengerVersionId: string;
  }
) {
  const experiment = await prisma.promptExperiment.create({
    data: {
      name: params.name,
      type: params.type,
      status: "RUNNING",
      configJson: { agentId: params.agentId },
      arms: {
        create: [
          {
            armLabel: "control",
            promptVersionId: params.controlVersionId,
            isControl: true,
          },
          {
            armLabel: "challenger",
            promptVersionId: params.challengerVersionId,
            isControl: false,
          },
        ],
      },
    },
    include: { arms: true },
  });

  await prisma.promptVersion.update({
    where: { id: params.challengerVersionId },
    data: { status: "CHALLENGER" },
  });

  return experiment;
}

export async function createExperimentPortfolio(
  prisma: PrismaClient,
  params: {
    experimentRunId: string;
    agentId: string;
    armLabel: string;
  }
) {
  const portfolio = await prisma.paperPortfolio.create({
    data: {
      agentId: params.agentId,
      initialCapitalVnd: BigInt(PAPER_INITIAL_CAPITAL_VND),
      cashVnd: BigInt(PAPER_INITIAL_CAPITAL_VND),
    },
  });

  return prisma.experimentPortfolio.create({
    data: {
      experimentRunId: params.experimentRunId,
      agentId: params.agentId,
      portfolioId: portfolio.id,
      armLabel: params.armLabel,
    },
    include: { portfolio: true },
  });
}

export async function evaluateExperimentArms(prisma: PrismaClient, experimentId: string) {
  const experiment = await prisma.promptExperiment.findUniqueOrThrow({
    where: { id: experimentId },
    include: { arms: { include: { promptVersion: true } } },
  });

  const config = experiment.configJson as { agentId?: string };
  const agentId = config.agentId;
  if (!agentId) return experiment.arms;

  const results = [];
  for (const arm of experiment.arms) {
    const decisions = await prisma.agentDecision.count({
      where: { agentId, promptVersionId: arm.promptVersionId },
    });
    const perf = await prisma.agentPerformanceDaily.findFirst({
      where: { agentId },
      orderBy: { sessionDate: "desc" },
    });
    const metrics = {
      decisionCount: decisions,
      totalReturnPct: perf?.totalReturnPct ?? 0,
      sharpeLike: perf?.sharpeLike ?? 0,
      maxDrawdownPct: perf?.maxDrawdownPct ?? 0,
    };
    await prisma.promptExperimentArm.update({
      where: { id: arm.id },
      data: { metricsJson: metrics as object },
    });
    results.push({ armLabel: arm.armLabel, metrics, isControl: arm.isControl });
  }
  return results;
}

export async function promoteExperimentWinner(
  prisma: PrismaClient,
  experimentId: string,
  winningArmLabel: string
) {
  const experiment = await prisma.promptExperiment.findUniqueOrThrow({
    where: { id: experimentId },
    include: { arms: true },
  });
  const config = experiment.configJson as { agentId?: string };
  const agentId = config.agentId;
  if (!agentId) throw new Error("Experiment missing agentId");

  const winner = experiment.arms.find((a) => a.armLabel === winningArmLabel);
  if (!winner) throw new Error("Arm not found");

  await promotePromptVersion(
    prisma,
    agentId,
    winner.promptVersionId,
    `Experiment ${experiment.name} winner: ${winningArmLabel}`,
    experimentId
  );

  await prisma.promptExperiment.update({
    where: { id: experimentId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
}

export async function rollbackExperiment(
  prisma: PrismaClient,
  experimentId: string
) {
  const experiment = await prisma.promptExperiment.findUniqueOrThrow({
    where: { id: experimentId },
    include: { arms: true },
  });
  const config = experiment.configJson as { agentId?: string };
  const agentId = config.agentId;
  const control = experiment.arms.find((a) => a.isControl);
  if (agentId && control) {
    await promotePromptVersion(
      prisma,
      agentId,
      control.promptVersionId,
      `Rollback experiment ${experiment.name}`,
      experimentId
    );
  }
  await prisma.promptExperiment.update({
    where: { id: experimentId },
    data: { status: "FAILED", finishedAt: new Date() },
  });
}

export function resolveExperimentPromptVersion(
  arms: Array<{ armLabel: string; promptVersionId: string; isControl: boolean }>,
  experimentRunId: string | null | undefined
): string | null {
  if (!experimentRunId) return null;
  const challenger = arms.find((a) => !a.isControl);
  return challenger?.promptVersionId ?? null;
}
