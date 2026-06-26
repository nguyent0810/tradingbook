import type { Metadata } from "next";
import { PaperLabPageShell } from "@/components/paper-lab/PaperLabPageShell";
import { PaperOnlyDisclaimerBanner } from "@/components/paper-lab/PaperOnlyDisclaimerBanner";
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
    <PaperLabPageShell>
      <PaperOnlyDisclaimerBanner />
      <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
        Session Replay Timeline
      </h2>
      <div className="paper-lab-table-wrap">
        <table className="paper-lab-table">
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
    </PaperLabPageShell>
  );
}
