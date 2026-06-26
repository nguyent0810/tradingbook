import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PaperAgentAction } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";
import { getMockAgent, MOCK_AGENTS } from "@/lib/paper-lab/agents/mock-rule-agents";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { createHash } from "node:crypto";

function hashInput(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toPrismaAction(action: AgentDecisionOutput["action"]): PaperAgentAction {
  return action as PaperAgentAction;
}

export async function persistAgentDecisions(
  prisma: PrismaClient,
  params: {
    agentDbId: string;
    agentVersion: string;
    sessionDate: Date;
    decisions: AgentDecisionOutput[];
    inputBundle?: MarketContextBundle;
    experimentRunId?: string;
    regimeSnapshotSessionDate?: Date | null;
    memorySnapshot?: object | null;
    promptVersionId?: string | null;
  }
): Promise<string[]> {
  const ids: string[] = [];

  for (const raw of params.decisions) {
    const parsed = AgentDecisionOutputSchema.safeParse(raw);
    const validationStatus = parsed.success ? "VALID" : "INVALID";
    const validationErrors = parsed.success ? undefined : parsed.error.flatten();

    const decision = await prisma.agentDecision.create({
      data: {
        id: raw.decision_id,
        agentId: params.agentDbId,
        agentVersion: params.agentVersion,
        sessionDate: params.sessionDate,
        symbol: raw.symbol,
        action: toPrismaAction(raw.action),
        confidence: raw.confidence,
        validationStatus: parsed.success ? validationStatus : "INVALID",
        validationErrors: validationErrors ?? undefined,
        inputHash: params.inputBundle ? hashInput(params.inputBundle) : null,
        experimentRunId: params.experimentRunId,
        reasoningSummary: raw.reasoning.slice(0, 500),
        regimeSnapshotSessionDate: params.regimeSnapshotSessionDate ?? null,
        memorySnapshotJson: params.memorySnapshot ?? undefined,
        promptVersionId: params.promptVersionId ?? null,
      },
    });

    if (params.inputBundle) {
      await prisma.agentDecisionInput.create({
        data: { decisionId: decision.id, payload: params.inputBundle as object },
      });
    }

    await prisma.agentDecisionOutput.create({
      data: { decisionId: decision.id, payload: raw as object },
    });

    ids.push(decision.id);
  }

  return ids;
}

export async function runMockAgentsForSession(
  prisma: PrismaClient,
  sessionDate: Date,
  bundles: MarketContextBundle[],
  agentSlugs?: string[]
): Promise<{ decisionsCreated: number; errors: string[] }> {
  const agents = await prisma.paperAgent.findMany({
    where: {
      active: true,
      slug: { not: "cio" },
      ...(agentSlugs?.length ? { slug: { in: agentSlugs } } : {}),
    },
  });

  let decisionsCreated = 0;
  const errors: string[] = [];

  for (const agent of agents) {
    const existing = await prisma.agentDecision.count({
      where: { agentId: agent.id, sessionDate },
    });
    if (existing > 0) continue;

    const runner = getMockAgent(agent.slug);
    if (!runner) {
      errors.push(`No runner for ${agent.slug}`);
      continue;
    }

    try {
      const sessionKey = sessionDate.toISOString().slice(0, 10);
      const decisions = await runner.run({ bundles, sessionDate: sessionKey });
      for (const bundle of bundles) {
        const symbolDecisions = decisions.filter((d) => d.symbol === bundle.symbol);
        if (symbolDecisions.length === 0) continue;
        const ids = await persistAgentDecisions(prisma, {
          agentDbId: agent.id,
          agentVersion: "1.0.0",
          sessionDate,
          decisions: symbolDecisions,
          inputBundle: bundle,
          regimeSnapshotSessionDate: bundle.marketRegime.regimeDimensions
            ? sessionDate
            : null,
          memorySnapshot: bundle.agentMemoryRecall ?? null,
        });
        decisionsCreated += ids.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${agent.slug}: ${msg}`);
      await prisma.agentError.create({
        data: {
          agentId: agent.id,
          jobName: "run-mock-agents",
          message: msg,
        },
      });
    }
  }

  return { decisionsCreated, errors };
}

export { MOCK_AGENTS };
