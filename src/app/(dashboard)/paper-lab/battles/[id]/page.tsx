import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { BreadcrumbLabelSetter } from "@/components/breadcrumb-label-setter";
import { prisma } from "@/lib/prisma";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import { buildDecisionExplanation } from "@/lib/paper-lab/ui/arena-copy";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import "@/components/paper-lab/paper-lab-workstation.css";
import { LegacyArenaShell } from "@/components/paper-lab/legacy-arena-shell";

export const metadata: Metadata = {
  title: "Xem lại trận đấu | Arena",
};

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
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

  const battleLabel = `${battle.sessionDate.toISOString().slice(0, 10)} — ${battle.symbol}`;

  return (
    <LegacyArenaShell>
      <BreadcrumbLabelSetter label={battleLabel} />
      <PaperLabPanel title={battleLabel} testId="battle-replay-detail">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Hành động</th>
              <th>Độ tin</th>
              <th>Phán quyết</th>
              <th>Lý do</th>
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
    </LegacyArenaShell>
  );
}
