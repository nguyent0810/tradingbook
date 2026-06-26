import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionDateParam = searchParams.get("sessionDate");
    const symbol = searchParams.get("symbol");

    const battles = await prisma.arenaBattle.findMany({
      where: {
        ...(sessionDateParam ? { sessionDate: new Date(sessionDateParam) } : {}),
        ...(symbol ? { symbol } : {}),
      },
      orderBy: { sessionDate: "desc" },
      take: 50,
      include: {
        battleDecisions: { include: { outcome: true, agent: true } },
      },
    });

    return labJson(
      {
        ok: true,
        battles: battles.map((b) => ({
          id: b.id,
          sessionDate: b.sessionDate.toISOString().slice(0, 10),
          symbol: b.symbol,
          status: b.status,
          benchmarkReturn5dPct: b.benchmarkReturn5dPct,
          decisions: b.battleDecisions.map((d) => ({
            agentSlug: d.agent.slug,
            action: d.action,
            confidence: d.confidence,
            verdict: d.outcome?.verdict,
            outcome: d.outcome ? battleOutcomeToDisplay(d.outcome.verdict) : "PENDING",
            explanation: d.outcome?.explanation,
          })),
        })),
      },
      battles[0]?.sessionDate.toISOString().slice(0, 10) ?? null
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
