import type { Metadata } from "next";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { getTelemetrySummary } from "@/lib/lab/observability/telemetry";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Lab Ops | AI Lab",
};

export const dynamic = "force-dynamic";

export default async function LabOpsPage() {
  const summary = await getTelemetrySummary(prisma);

  return (
    <>
      <PaperLabPanel title="Production Observability" className="mb-4">
        <div className="paper-lab-kpi-grid mb-4">
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Events (24h)</div>
            <div className="paper-lab-kpi__value tabular-nums">{summary.eventsLast24h}</div>
          </div>
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Last paper-lab run</div>
            <div className="paper-lab-kpi__value" style={{ fontSize: "0.85rem" }}>
              {summary.lastPaperLabRun ?? "—"}
            </div>
          </div>
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Last analytics run</div>
            <div className="paper-lab-kpi__value" style={{ fontSize: "0.85rem" }}>
              {summary.lastAnalyticsRun ?? "—"}
            </div>
          </div>
        </div>
      </PaperLabPanel>
      <PaperLabPanel title="Job telemetry">
        <div className="safe-table-wrap paper-lab-table-wrap">
          <table className="paper-lab-table safe-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Events</th>
                <th>Errors</th>
                <th>Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {summary.jobs.map((j) => (
                <tr key={j.jobName}>
                  <td>{j.jobName}</td>
                  <td className="tabular-nums">{j.count}</td>
                  <td className="tabular-nums">{j.errors}</td>
                  <td className="tabular-nums">{j.avgLatencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PaperLabPanel>
    </>
  );
}
