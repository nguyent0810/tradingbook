import type { PrismaClient } from "@/generated/prisma/client";
import type { PaperAgentAction } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";
import { getMockAgent, MOCK_AGENTS } from "@/lib/paper-lab/agents/mock-rule-agents";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { createHash } from "node:crypto";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import { isDnaEngineEnabled } from "@/lib/paper-lab/dna/dna-engine-flag";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { buildManagerStateSnapshot } from "@/lib/paper-lab/dna/manager-state";
import { evaluateManager } from "@/lib/paper-lab/dna/evaluate-manager";
import { evaluateRotation } from "@/lib/paper-lab/dna/rotation";
import { loadMarketMemory } from "@/lib/paper-lab/dna/market-memory-store";

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
  // Phase 2: when the DNA engine flag is ON, decision generation is produced by
  // the deterministic Fund Manager evaluator instead of the legacy predicates.
  // When OFF (default), the legacy path below runs completely unchanged.
  if (isDnaEngineEnabled()) {
    return runDnaManagersForSession(prisma, sessionDate, bundles, agentSlugs);
  }

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

/**
 * Phase 2 — DNA evaluator path (used only when PAPER_LAB_DNA_ENGINE=true).
 * Mirrors the legacy runner's persistence/dedupe structure; decisions come from
 * the deterministic `evaluateManager` instead of the mock predicates.
 */
export async function runDnaManagersForSession(
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
  const sessionKey = sessionDate.toISOString().slice(0, 10);
  // Market memory dated <= S-1 (loaded once; same for all managers). No lookahead.
  const memory = (await loadMarketMemory(prisma, sessionDate)) ?? undefined;

  for (const agent of agents) {
    const dna = getManagerDna(agent.slug);
    if (!dna) {
      errors.push(`No DNA for ${agent.slug}`);
      continue;
    }

    const existing = await prisma.agentDecision.count({
      where: { agentId: agent.id, sessionDate },
    });
    if (existing > 0) continue;

    try {
      const navFallback = bundles[0]?.portfolioState.navVnd ?? PAPER_INITIAL_CAPITAL_VND;
      const state = await buildManagerStateSnapshot(prisma, agent.id, navFallback);

      // Rotation pass first: if the manager is capacity/cash-blocked on a strong
      // candidate, it may reduce/exit its weakest holding to fund it. The laggard
      // decision is queued before the candidate BUY so it executes first.
      const rotated = new Set<string>();
      const toPersist: { bundle: MarketContextBundle; decision: ReturnType<typeof evaluateManager> }[] = [];

      if (dna.rotation.enabled) {
        const plan = evaluateRotation({ dna, state, sessionDate: sessionKey, bundles, rotationsToday: 0 });
        if (plan.kind === "rotate") {
          for (const item of plan.items) {
            toPersist.push({ bundle: item.bundle, decision: item.decision });
            rotated.add(item.symbol);
          }
        } else if (plan.kind === "blocked") {
          const b = bundles.find((x) => x.symbol === plan.candidateSymbol);
          if (b) {
            const base = evaluateManager({ bundle: b, dna, state, sessionDate: sessionKey, memory });
            toPersist.push({ bundle: b, decision: { ...base, action: "HOLD", reason_codes: [plan.reason] } });
            rotated.add(plan.candidateSymbol);
          }
        }
      }

      for (const bundle of bundles) {
        if (rotated.has(bundle.symbol)) continue;
        toPersist.push({ bundle, decision: evaluateManager({ bundle, dna, state, sessionDate: sessionKey, memory }) });
      }

      for (const { bundle, decision } of toPersist) {
        const ids = await persistAgentDecisions(prisma, {
          agentDbId: agent.id,
          agentVersion: dna.versioning.dnaVersion,
          sessionDate,
          decisions: [decision],
          inputBundle: bundle,
          regimeSnapshotSessionDate: bundle.marketRegime.regimeDimensions ? sessionDate : null,
          memorySnapshot: bundle.agentMemoryRecall ?? null,
        });
        decisionsCreated += ids.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${agent.slug}: ${msg}`);
      await prisma.agentError.create({
        data: { agentId: agent.id, jobName: "run-dna-managers", message: msg },
      });
    }
  }

  return { decisionsCreated, errors };
}

export { MOCK_AGENTS };
