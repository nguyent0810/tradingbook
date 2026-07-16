import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { BreadcrumbLabelSetter } from "@/components/breadcrumb-label-setter";
import { prisma } from "@/lib/prisma";
import type { AgentDnaProfile } from "@/lib/lab/types/regime";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Agent Profile | Arena",
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
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
      <BreadcrumbLabelSetter label={agent.displayName} />
      <PaperLabPanel title={agent.displayName} className="mb-4">
        <p className="text-sm text-[var(--text-tertiary)]">{agent.style} · {agent.slug}</p>
      </PaperLabPanel>
      <div className="paper-lab-grid-2">
        <PaperLabPanel title="Agent DNA">
          {dna ? (
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li>Avg confidence: {(dna.avgConfidence * 100).toFixed(0)}%</li>
              <li>Trade frequency: {dna.tradeFrequency.toFixed(2)}/day</li>
              <li>Specialization: {(dna.specializationScore * 100).toFixed(0)}%</li>
              <li>Loves: {dna.loves.map((l) => l.signal).join(", ") || "—"}</li>
              <li>Avoids: {dna.avoids.map((a) => a.signal).join(", ") || "—"}</li>
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">DNA not computed yet.</p>
          )}
        </PaperLabPanel>
        <PaperLabPanel title="Calibration & Evolution">
          <p className="text-sm text-[var(--text-secondary)]">
            Brier: {agent.calibration[0]?.brierScore.toFixed(3) ?? "—"}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Overconfidence:{" "}
            {agent.calibration[0]
              ? `${(agent.calibration[0].overconfidence * 100).toFixed(1)}%`
              : "—"}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Evolution: {agent.evolution[0]?.score.toFixed(3) ?? "—"} (
            {agent.evolution[0]?.trend ?? "—"})
          </p>
        </PaperLabPanel>
      </div>
    </>
  );
}
