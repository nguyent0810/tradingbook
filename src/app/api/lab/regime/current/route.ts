import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
    const regime = sessionDate
      ? await prisma.marketRegimeSnapshot.findUnique({ where: { sessionDate } })
      : null;

    return labJson(
      {
        ok: true,
        regime: regime
          ? {
              gate1Level: regime.gate1Level,
              dimensions: regime.dimensionsJson,
              confidence: regime.confidence,
              schemaVersion: regime.schemaVersion,
            }
          : null,
      },
      sessionDate?.toISOString().slice(0, 10) ?? null
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
