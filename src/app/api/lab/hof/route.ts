import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { queryHallOfFame } from "@/lib/lab/hall-of-fame/detect-achievements";
import type { HallOfFameAchievementType } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as HallOfFameAchievementType | null;
    const agentId = searchParams.get("agentId") ?? undefined;
    const entries = await queryHallOfFame(prisma, {
      achievementType: type ?? undefined,
      agentId,
      limit: 100,
    });

    return labJson({
      ok: true,
      entries: entries.map((e) => ({
        id: e.id,
        achievementType: e.achievementType,
        agentSlug: e.agent?.slug ?? null,
        agentName: e.agent?.displayName ?? null,
        sessionDate: e.sessionDate?.toISOString().slice(0, 10) ?? null,
        symbol: e.symbol,
        value: e.value,
        metadata: e.metadataJson,
      })),
    });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
