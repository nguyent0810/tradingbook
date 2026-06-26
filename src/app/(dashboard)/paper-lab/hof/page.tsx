import type { Metadata } from "next";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { queryHallOfFame } from "@/lib/lab/hall-of-fame/detect-achievements";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Hall of Fame | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function HofPage() {
  const entries = await queryHallOfFame(prisma, { limit: 100 });

  return (
    <PaperLabPanel title="Hall of Fame" testId="paper-lab-leaderboard">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Achievement</th>
              <th>Agent</th>
              <th>Session</th>
              <th>Symbol</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.achievementType.replace(/_/g, " ")}</td>
                <td>{e.agent?.displayName ?? "—"}</td>
                <td>{e.sessionDate?.toISOString().slice(0, 10) ?? "—"}</td>
                <td>{e.symbol ?? "—"}</td>
                <td className="tabular-nums">{e.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
