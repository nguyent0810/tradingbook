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

    const profile = await prisma.agentDnaProfile.findFirst({
      where: { agentId: agent.id },
      orderBy: { asOfSession: "desc" },
    });

    return labJson(
      {
        ok: true,
        dna: profile?.profileJson ?? null,
        asOfSession: profile?.asOfSession.toISOString().slice(0, 10) ?? null,
      },
      profile?.asOfSession.toISOString().slice(0, 10) ?? null
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
