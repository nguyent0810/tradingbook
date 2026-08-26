import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";
import { LegacyArenaShell } from "@/components/paper-lab/legacy-arena-shell";

export const metadata: Metadata = {
  title: "Session Theatre | Arena",
};

export default async function TimelineSessionPage({
  params,
}: {
  params: Promise<{ sessionDate: string }>;
}) {
  await connection();
  const { sessionDate: raw } = await params;
  const sessionDate = new Date(raw);
  const bundle = await prisma.sessionReplayBundle.findUnique({
    where: { sessionDate },
  });

  if (!bundle) notFound();

  const data = bundle.bundleJson as {
    regime?: { gate1Level?: string; dimensions?: Record<string, string> };
    decisions?: Array<{ agentSlug: string; symbol: string; action: string; confidence: number }>;
    battles?: Array<{ symbol: string; status: string }>;
    rankings?: Array<{ agentSlug: string; rank: number; score: number }>;
  };

  return (
    <LegacyArenaShell>
      <PaperLabPanel title={`Session ${raw}`} className="mb-4">
        {data.regime && (
          <p className="text-sm text-[var(--text-tertiary)]">
            Regime: {data.regime.gate1Level} —{" "}
            {Object.values(data.regime.dimensions ?? {}).join(" · ")}
          </p>
        )}
      </PaperLabPanel>
      <div className="paper-lab-grid-2">
        <PaperLabPanel title="Decisions">
          <div className="safe-table-wrap paper-lab-table-wrap">
            <table className="paper-lab-table safe-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th>Conf</th>
                </tr>
              </thead>
              <tbody>
                {(data.decisions ?? []).slice(0, 40).map((d, i) => (
                  <tr key={i}>
                    <td>{d.agentSlug}</td>
                    <td>{d.symbol}</td>
                    <td>{d.action}</td>
                    <td className="tabular-nums">{(d.confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperLabPanel>
        <PaperLabPanel title="Rankings">
          <div className="safe-table-wrap paper-lab-table-wrap">
            <table className="paper-lab-table safe-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Agent</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {(data.rankings ?? []).map((r) => (
                  <tr key={r.agentSlug}>
                    <td className="tabular-nums">{r.rank}</td>
                    <td>{r.agentSlug}</td>
                    <td className="tabular-nums">{r.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperLabPanel>
      </div>
    </LegacyArenaShell>
  );
}
