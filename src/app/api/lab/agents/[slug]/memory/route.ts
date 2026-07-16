import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { loadAgentMemoryRecall } from "@/lib/lab/memory/build-memory";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const setup = searchParams.get("setup") ?? "default";

    const agent = await prisma.paperAgent.findUnique({ where: { slug } });
    if (!agent) return labError("Agent not found", 404);

    const recall = await loadAgentMemoryRecall(prisma, agent.id, setup);
    return labJson({ ok: true, memory: recall });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
