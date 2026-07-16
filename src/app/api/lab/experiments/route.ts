import { prisma } from "@/lib/prisma";
import { labError, labJson } from "@/lib/lab/api-response";
import {
  createPromptExperiment,
  evaluateExperimentArms,
  promoteExperimentWinner,
  rollbackExperiment,
} from "@/lib/lab/experiments/router";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      type: "PROMPT_AB" | "PARAM_AB" | "MODEL_AB" | "TEMPERATURE_AB";
      agentId: string;
      controlVersionId: string;
      challengerVersionId: string;
    };

    const experiment = await createPromptExperiment(prisma, body);
    return labJson({ ok: true, experiment }, null, 201);
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}

export async function GET() {
  try {
    const experiments = await prisma.promptExperiment.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { arms: true },
    });
    return labJson({ ok: true, experiments });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      action: "promote" | "rollback" | "evaluate";
      experimentId: string;
      winningArmLabel?: string;
    };

    if (body.action === "promote" && body.winningArmLabel) {
      await promoteExperimentWinner(prisma, body.experimentId, body.winningArmLabel);
    } else if (body.action === "rollback") {
      await rollbackExperiment(prisma, body.experimentId);
    } else if (body.action === "evaluate") {
      const results = await evaluateExperimentArms(prisma, body.experimentId);
      return labJson({ ok: true, results });
    }

    return labJson({ ok: true });
  } catch (err) {
    return labError(err instanceof Error ? err.message : String(err));
  }
}
