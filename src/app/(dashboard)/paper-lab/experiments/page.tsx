import type { Metadata } from "next";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Experiments | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const experiments = await prisma.promptExperiment.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
    include: { arms: { include: { promptVersion: true } } },
  });

  return (
    <PaperLabPanel title="Prompt Experiments">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table safe-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Arms</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.type}</td>
                <td>{e.status}</td>
                <td className="tabular-nums">{e.arms.length}</td>
                <td>{e.startedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {experiments.length === 0 && (
        <p className="text-sm text-slate-500 mt-4">
          No experiments yet. Create via POST /api/lab/experiments.
        </p>
      )}
    </PaperLabPanel>
  );
}
