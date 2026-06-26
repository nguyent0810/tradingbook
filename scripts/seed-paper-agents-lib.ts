import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";

const AGENT_VERSION = "1.0.0";

function promptHash(slug: string): string {
  return createHash("sha256").update(`${slug}:${AGENT_VERSION}`).digest("hex").slice(0, 16);
}

export async function seedPaperAgents(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const seed of PAPER_AGENT_SEEDS) {
    const agent = await prisma.paperAgent.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        displayName: seed.displayName,
        style: seed.style,
        active: true,
        configJson: {},
      },
      update: {
        displayName: seed.displayName,
        style: seed.style,
        active: true,
      },
    });

    await prisma.paperAgentVersion.upsert({
      where: { agentId_version: { agentId: agent.id, version: AGENT_VERSION } },
      create: {
        agentId: agent.id,
        version: AGENT_VERSION,
        promptHash: promptHash(seed.slug),
        paramsJson: {},
        effectiveFrom: today,
      },
      update: {},
    });

    await prisma.paperPortfolio.upsert({
      where: { agentId: agent.id },
      create: {
        agentId: agent.id,
        initialCapitalVnd: BigInt(PAPER_INITIAL_CAPITAL_VND),
        cashVnd: BigInt(PAPER_INITIAL_CAPITAL_VND),
      },
      update: {},
    });
  }
}
