import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { getTelemetrySummary } from "@/lib/lab/observability/telemetry";

export async function GET() {
  try {
    const summary = await getTelemetrySummary(prisma);
    return labJson({ ok: true, ...summary });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
