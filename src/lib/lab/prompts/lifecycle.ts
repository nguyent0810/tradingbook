import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PromptVersionStatus } from "@/generated/prisma/client";

export function hashPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export async function ensureChampionPrompt(
  prisma: PrismaClient,
  agentId: string,
  promptText: string,
  versionLabel = "1.0.0"
) {
  const hash = hashPrompt(promptText);
  const existing = await prisma.promptVersion.findUnique({
    where: { agentId_versionLabel: { agentId, versionLabel } },
  });
  if (existing) return existing;

  return prisma.promptVersion.create({
    data: {
      agentId,
      versionLabel,
      promptHash: hash,
      promptText,
      status: "CHAMPION",
      effectiveFrom: new Date(),
    },
  });
}

export async function getActivePromptForAgent(prisma: PrismaClient, agentId: string) {
  const agent = await prisma.paperAgent.findUnique({
    where: { id: agentId },
    include: { activePromptVersion: true },
  });
  if (agent?.activePromptVersion) return agent.activePromptVersion;

  const champion = await prisma.promptVersion.findFirst({
    where: { agentId, status: "CHAMPION" },
    orderBy: { effectiveFrom: "desc" },
  });
  return champion;
}

export async function promotePromptVersion(
  prisma: PrismaClient,
  agentId: string,
  toVersionId: string,
  reason: string,
  experimentId?: string
) {
  const agent = await prisma.paperAgent.findUniqueOrThrow({ where: { id: agentId } });
  const toVersion = await prisma.promptVersion.findUniqueOrThrow({ where: { id: toVersionId } });

  await prisma.promptVersion.updateMany({
    where: { agentId, status: "CHAMPION" },
    data: { status: "DEPRECATED" },
  });

  await prisma.promptVersion.update({
    where: { id: toVersionId },
    data: { status: "CHAMPION" },
  });

  await prisma.paperAgent.update({
    where: { id: agentId },
    data: { activePromptVersionId: toVersionId },
  });

  await prisma.promptPromotionEvent.create({
    data: {
      agentId,
      experimentId,
      fromVersionId: agent.activePromptVersionId,
      toVersionId,
      reason,
    },
  });

  return toVersion;
}

export async function listPromptVersions(prisma: PrismaClient, agentId: string) {
  return prisma.promptVersion.findMany({
    where: { agentId },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function createPromptVersion(
  prisma: PrismaClient,
  params: {
    agentId: string;
    versionLabel: string;
    promptText: string;
    status?: PromptVersionStatus;
    modelId?: string;
    temperature?: number;
  }
) {
  return prisma.promptVersion.create({
    data: {
      agentId: params.agentId,
      versionLabel: params.versionLabel,
      promptHash: hashPrompt(params.promptText),
      promptText: params.promptText,
      status: params.status ?? "DRAFT",
      modelId: params.modelId,
      temperature: params.temperature,
      effectiveFrom: new Date(),
    },
  });
}
