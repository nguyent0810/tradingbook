import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const rows = await prisma.marketRegimeSnapshot.findMany({
      where: {
        ...(from ? { sessionDate: { gte: new Date(from) } } : {}),
        ...(to ? { sessionDate: { lte: new Date(to) } } : {}),
      },
      orderBy: { sessionDate: "asc" },
      take: 365,
    });
    return labJson(
      {
        ok: true,
        history: rows.map((r) => ({
          sessionDate: r.sessionDate.toISOString().slice(0, 10),
          gate1Level: r.gate1Level,
          dimensions: r.dimensionsJson,
          confidence: r.confidence,
        })),
      },
      rows[rows.length - 1]?.sessionDate.toISOString().slice(0, 10) ?? null
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
