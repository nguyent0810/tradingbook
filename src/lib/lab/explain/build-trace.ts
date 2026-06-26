import type { PrismaClient } from "@/generated/prisma/client";
import type { RegimeSnapshot } from "@/lib/lab/types/regime";

export type ExplanationNode = {
  id: string;
  type: string;
  label: string;
  summary: string;
  data?: Record<string, unknown>;
};

export async function buildExplanationTrace(
  prisma: PrismaClient,
  decisionId: string
): Promise<{ nodes: ExplanationNode[] }> {
  const decision = await prisma.agentDecision.findUnique({
    where: { id: decisionId },
    include: {
      agent: true,
      input: true,
      output: true,
      regimeSnapshot: true,
      order: true,
      battleDecision: { include: { outcome: true } },
    },
  });

  if (!decision) return { nodes: [] };

  const nodes: ExplanationNode[] = [];

  if (decision.regimeSnapshot) {
    const dims = decision.regimeSnapshot.dimensionsJson as RegimeSnapshot["dimensions"];
    nodes.push({
      id: "regime",
      type: "regime",
      label: "Market Regime",
      summary: `${dims.trendRegime} · ${dims.breadthRegime} · Gate1 ${decision.regimeSnapshot.gate1Level}`,
      data: dims as unknown as Record<string, unknown>,
    });
  }

  if (decision.memorySnapshotJson) {
    nodes.push({
      id: "memory",
      type: "memory",
      label: "Agent Memory Recall",
      summary: "Historical setup statistics injected at decision time",
      data: decision.memorySnapshotJson as Record<string, unknown>,
    });
  }

  if (decision.input?.payload) {
    nodes.push({
      id: "context",
      type: "context",
      label: "Market Context",
      summary: `Input bundle for ${decision.symbol}`,
      data: { schemaVersion: (decision.input.payload as { schemaVersion?: string }).schemaVersion },
    });
  }

  nodes.push({
    id: "decision",
    type: "decision",
    label: `${decision.agent.displayName} Decision`,
    summary: `${decision.action} @ ${(decision.confidence * 100).toFixed(0)}% confidence — ${decision.reasoningSummary ?? ""}`,
    data: decision.output?.payload as Record<string, unknown> | undefined,
  });

  if (decision.validationStatus !== "VALID") {
    nodes.push({
      id: "validation",
      type: "validation",
      label: "Validation",
      summary: `Status: ${decision.validationStatus}`,
      data: { errors: decision.validationErrors },
    });
  }

  if (decision.order) {
    nodes.push({
      id: "execution",
      type: "execution",
      label: "Simulated Execution",
      summary: `Order ${decision.order.status} — ${decision.order.side} ${decision.order.quantity} @ ${decision.order.priceKvnd} k`,
    });
  }

  if (decision.battleDecision?.outcome) {
    const o = decision.battleDecision.outcome;
    nodes.push({
      id: "outcome",
      type: "outcome",
      label: "Battle Outcome",
      summary: `${o.verdict} — ${o.explanation ?? ""}`,
      data: { rMultiple: o.rMultiple, forwardReturn5dPct: o.forwardReturn5dPct },
    });
  }

  return { nodes };
}

export async function persistExplanationTrace(
  prisma: PrismaClient,
  decisionId: string
): Promise<void> {
  const trace = await buildExplanationTrace(prisma, decisionId);
  await prisma.explanationTrace.upsert({
    where: { decisionId },
    create: { decisionId, traceJson: trace as object },
    update: { traceJson: trace as object },
  });
}

export async function persistAllExplanationTraces(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const decisions = await prisma.agentDecision.findMany({
    where: { sessionDate, validationStatus: "VALID" },
    select: { id: true },
  });
  for (const d of decisions) {
    await persistExplanationTrace(prisma, d.id);
  }
  return decisions.length;
}
