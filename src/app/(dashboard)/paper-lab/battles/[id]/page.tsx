import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import { buildDecisionExplanation } from "@/lib/paper-lab/ui/arena-copy";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Battle Replay | Arena",
};

export const dynamic = "force-dynamic";

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const battle = await prisma.arenaBattle.findUnique({
    where: { id },
    include: {
      battleDecisions: {
        include: { outcome: true, agent: true, decision: { include: { output: true } } },
      },
    },
  });

  if (!battle) notFound();

  return (
    <PaperLabPanel
      title={`${battle.sessionDate.toISOString().slice(0, 10)} — ${battle.symbol}`}
      testId="battle-replay-detail"
    >
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Action</th>
              <th>Conf</th>
              <th>Verdict</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {battle.battleDecisions.map((d) => {
              const display = d.outcome
                ? battleOutcomeToDisplay(d.outcome.verdict)
                : "PENDING";
              const cls =
                display === "WIN"
                  ? "paper-lab-outcome-win"
                  : display === "LOSS"
                    ? "paper-lab-outcome-loss"
                    : "";
              const payload = d.decision.output?.payload as Partial<AgentDecisionOutput> | undefined;
              const explanation = buildDecisionExplanation({
                agentId: d.agent.slug,
                action: d.action as AgentAction,
                symbol: battle.symbol,
                reasoningSummary: d.reasoning ?? d.decision.reasoningSummary,
                payload: payload ?? null,
              });
              return (
                <tr key={d.id}>
                  <td>{d.agent.displayName}</td>
                  <td>{d.action}</td>
                  <td className="tabular-nums">{(d.confidence * 100).toFixed(0)}%</td>
                  <td className={cls}>{display}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 360 }}>
                    {d.outcome?.explanation ?? explanation.summary}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
