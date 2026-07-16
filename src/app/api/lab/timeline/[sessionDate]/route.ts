import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionDate: string }> }
) {
  try {
    const { sessionDate: raw } = await context.params;
    const sessionDate = new Date(raw);
    const bundle = await prisma.sessionReplayBundle.findUnique({
      where: { sessionDate },
    });

    return labJson(
      {
        ok: true,
        bundle: bundle?.bundleJson ?? null,
      },
      raw
    );
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
