import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLabPageShell } from "@/components/paper-lab/PaperLabPageShell";
import { PaperOnlyDisclaimerBanner } from "@/components/paper-lab/PaperOnlyDisclaimerBanner";
import { prisma } from "@/lib/prisma";
import type { AgentDnaProfile } from "@/lib/lab/types/regime";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Agent Profile | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await prisma.paperAgent.findUnique({
    where: { slug },
    include: {
      dnaProfiles: { orderBy: { asOfSession: "desc" }, take: 1 },
      calibration: { orderBy: { sessionDate: "desc" }, take: 1 },
      evolution: { orderBy: { sessionDate: "desc" }, take: 1 },
      setupMemory: { take: 5, orderBy: { sampleSize: "desc" } },
      promptVersions: { orderBy: { effectiveFrom: "desc" }, take: 5 },
    },
  });

  if (!agent) notFound();

  const dna = agent.dnaProfiles[0]?.profileJson as AgentDnaProfile | undefined;

  return (
    <PaperLabPageShell>
      <PaperOnlyDisclaimerBanner />
      <h2 className="text-lg font-semibold text-slate-200">{agent.displayName}</h2>
      <p className="text-sm text-slate-400 mb-4">{agent.style} · {agent.slug}</p>

      <div className="paper-lab-grid-2">
        <div className="paper-lab-cio-panel">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Agent DNA</h3>
          {dna ? (
            <ul className="text-sm text-slate-300 space-y-1">
              <li>Avg confidence: {(dna.avgConfidence * 100).toFixed(0)}%</li>
              <li>Trade frequency: {dna.tradeFrequency.toFixed(2)}/day</li>
              <li>Specialization: {(dna.specializationScore * 100).toFixed(0)}%</li>
              <li>Loves: {dna.loves.map((l) => l.signal).join(", ") || "—"}</li>
              <li>Avoids: {dna.avoids.map((a) => a.signal).join(", ") || "—"}</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-500">DNA not computed yet.</p>
          )}
        </div>
        <div className="paper-lab-cio-panel">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Calibration & Evolution</h3>
          <p className="text-sm text-slate-300">
            Brier: {agent.calibration[0]?.brierScore.toFixed(3) ?? "—"}
          </p>
          <p className="text-sm text-slate-300">
            Overconfidence:{" "}
            {agent.calibration[0]
              ? `${(agent.calibration[0].overconfidence * 100).toFixed(1)}%`
              : "—"}
          </p>
          <p className="text-sm text-slate-300">
            Evolution: {agent.evolution[0]?.score.toFixed(3) ?? "—"} (
            {agent.evolution[0]?.trend ?? "—"})
          </p>
        </div>
      </div>
    </PaperLabPageShell>
  );
}
