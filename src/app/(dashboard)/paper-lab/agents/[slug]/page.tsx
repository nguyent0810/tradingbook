import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import type { AgentDnaProfile } from "@/lib/lab/types/regime";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Agent Profile | Arena",
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
    <>
      <PaperLabPanel title={agent.displayName} className="mb-4">
        <p className="text-sm text-slate-400">{agent.style} · {agent.slug}</p>
      </PaperLabPanel>
      <div className="paper-lab-grid-2">
        <PaperLabPanel title="Agent DNA">
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
        </PaperLabPanel>
        <PaperLabPanel title="Calibration & Evolution">
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
        </PaperLabPanel>
      </div>
    </>
  );
}
