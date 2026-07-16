import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { buildExplanationTrace } from "@/lib/lab/explain/build-trace";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const trace = await buildExplanationTrace(prisma, id);
    const decision = await prisma.agentDecision.findUnique({
      where: { id },
      select: { sessionDate: true },
    });
    return labJson({ ok: true, trace }, decision?.sessionDate.toISOString().slice(0, 10) ?? null);
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
