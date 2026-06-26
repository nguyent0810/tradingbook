import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const agent = await prisma.paperAgent.findUnique({ where: { slug } });
    if (!agent) return labError("Agent not found", 404);

    const rows = await prisma.agentCalibrationDaily.findMany({
      where: { agentId: agent.id },
      orderBy: { sessionDate: "desc" },
      take: 90,
    });

    return labJson({
      ok: true,
      series: rows.map((r) => ({
        sessionDate: r.sessionDate.toISOString().slice(0, 10),
        brierScore: r.brierScore,
        overconfidence: r.overconfidence,
        buckets: r.bucketJson,
        sampleSize: r.sampleSize,
      })),
    });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
