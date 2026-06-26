import type { Metadata } from "next";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Research Timeline | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const bundles = await prisma.sessionReplayBundle.findMany({
    orderBy: { sessionDate: "desc" },
    take: 60,
  });

  return (
    <PaperLabPanel title="Session Replay Timeline">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Decisions</th>
              <th>Battles</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => {
              const json = b.bundleJson as {
                decisions?: unknown[];
                battles?: unknown[];
              };
              return (
                <tr key={b.id}>
                  <td>
                    <a
                      href={`/paper-lab/timeline/${b.sessionDate.toISOString().slice(0, 10)}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {b.sessionDate.toISOString().slice(0, 10)}
                    </a>
                  </td>
                  <td className="tabular-nums">{json.decisions?.length ?? 0}</td>
                  <td className="tabular-nums">{json.battles?.length ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
