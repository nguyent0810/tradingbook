import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import { evaluateExperimentArms } from "@/lib/lab/experiments/router";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const results = await evaluateExperimentArms(prisma, id);
    return labJson({ ok: true, results });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
