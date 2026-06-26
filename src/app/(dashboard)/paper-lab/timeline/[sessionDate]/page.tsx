import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLabPageShell } from "@/components/paper-lab/PaperLabPageShell";
import { PaperOnlyDisclaimerBanner } from "@/components/paper-lab/PaperOnlyDisclaimerBanner";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Session Theatre | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function TimelineSessionPage({
  params,
}: {
  params: Promise<{ sessionDate: string }>;
}) {
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
    <PaperLabPageShell>
      <PaperOnlyDisclaimerBanner />
      <h2 className="text-lg font-semibold text-slate-200 mb-1">Session {raw}</h2>
      {data.regime && (
        <p className="text-sm text-slate-400 mb-4">
          Regime: {data.regime.gate1Level} —{" "}
          {Object.values(data.regime.dimensions ?? {}).join(" · ")}
        </p>
      )}
      <div className="paper-lab-grid-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Decisions</h3>
          <div className="paper-lab-table-wrap">
            <table className="paper-lab-table">
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
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Rankings</h3>
          <div className="paper-lab-table-wrap">
            <table className="paper-lab-table">
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
        </div>
      </div>
    </PaperLabPageShell>
  );
}
