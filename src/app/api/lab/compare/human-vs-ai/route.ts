import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { compareHumanVsAi } from "@/lib/lab/human-pm/submit-decision";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return labError("userId required", 400);
    const comparison = await compareHumanVsAi(prisma, userId);
    return labJson({ ok: true, ...comparison });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
