import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const battle = await prisma.arenaBattle.findUnique({
      where: { id },
      include: {
        battleDecisions: {
          include: {
            outcome: true,
            agent: true,
            decision: { include: { explanationTrace: true } },
          },
        },
      },
    });
    if (!battle) return labError("Battle not found", 404);

    return labJson(
      {
        ok: true,
        battle: {
          id: battle.id,
          sessionDate: battle.sessionDate.toISOString().slice(0, 10),
          symbol: battle.symbol,
          status: battle.status,
          benchmarkReturn5dPct: battle.benchmarkReturn5dPct,
          decisions: battle.battleDecisions.map((d) => ({
            agentSlug: d.agent.slug,
            action: d.action,
            confidence: d.confidence,
            reasoning: d.reasoning,
            verdict: d.outcome?.verdict,
            outcome: d.outcome ? battleOutcomeToDisplay(d.outcome.verdict) : "PENDING",
            explanation: d.outcome?.explanation,
            decisionId: d.decisionId,
          })),
        },
      },
      battle.sessionDate.toISOString().slice(0, 10)
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
