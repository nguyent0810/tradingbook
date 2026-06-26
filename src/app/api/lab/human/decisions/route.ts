import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { submitHumanPmDecision, compareHumanVsAi, ensureHumanPmAgent } from "@/lib/lab/human-pm/submit-decision";
import { buildMarketContextBundle } from "@/lib/paper-lab/context/build-market-context-bundle";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId: string;
      decision: Record<string, unknown>;
      symbol: string;
    };

    const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
    if (!sessionDate) return labError("No session date", 400);

    const { agentId } = await ensureHumanPmAgent(prisma, body.userId);

    const bundle = await buildMarketContextBundle(prisma, {
      symbol: body.symbol,
      sessionDate,
      agentId,
    });
    if (!bundle) return labError("Could not build context bundle", 400);

    const bar = await prisma.stockDailyBar.findFirst({
      where: { symbol: { symbol: body.symbol }, date: sessionDate },
    });
    if (!bar) return labError("No bar for symbol", 400);

    const result = await submitHumanPmDecision(prisma, {
      userId: body.userId,
      sessionDate,
      decision: body.decision as never,
      bundle,
      bar: { low: bar.low, high: bar.high, close: bar.close },
    });

    return labJson(
      { ok: true, ...result },
      sessionDate.toISOString().slice(0, 10),
      201
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return labError("userId required", 400);
    const comparison = await compareHumanVsAi(prisma, userId);
    return labJson({ ok: true, comparison });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
