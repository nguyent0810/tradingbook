import type { Metadata } from "next";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Arena Battles | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  const battles = await prisma.arenaBattle.findMany({
    orderBy: { sessionDate: "desc" },
    take: 30,
    include: {
      battleDecisions: { include: { outcome: true, agent: true } },
    },
  });

  return (
    <PaperLabPanel title="Symbol Battles">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Symbol</th>
              <th>Status</th>
              <th>Agents</th>
              <th>5d bench</th>
            </tr>
          </thead>
          <tbody>
            {battles.map((b) => (
              <tr key={b.id}>
                <td>{b.sessionDate.toISOString().slice(0, 10)}</td>
                <td>
                  <a href={`/paper-lab/battles/${b.id}`} className="text-cyan-400 hover:underline">
                    {b.symbol}
                  </a>
                </td>
                <td>{b.status}</td>
                <td className="tabular-nums">{b.battleDecisions.length}</td>
                <td className="tabular-nums">
                  {b.benchmarkReturn5dPct != null ? `${b.benchmarkReturn5dPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
