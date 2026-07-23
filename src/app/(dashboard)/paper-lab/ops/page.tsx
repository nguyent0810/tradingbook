import type { Metadata } from "next";
import { connection } from "next/server";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import { getTelemetrySummary } from "@/lib/lab/observability/telemetry";
import { prisma } from "@/lib/prisma";
import "@/components/paper-lab/paper-lab-workstation.css";

export const metadata: Metadata = {
  title: "Vận hành | Arena",
};

export default async function LabOpsPage() {
  await connection();
  const summary = await getTelemetrySummary(prisma);

  return (
    <>
      <PaperLabPanel title="Giám sát vận hành" className="mb-4">
        <div className="paper-lab-kpi-grid mb-4">
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Sự kiện (24h)</div>
            <div className="paper-lab-kpi__value tabular-nums">{summary.eventsLast24h}</div>
          </div>
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Lần chạy paper-lab gần nhất</div>
            <div className="paper-lab-kpi__value" style={{ fontSize: "0.85rem" }}>
              {summary.lastPaperLabRun ?? "—"}
            </div>
          </div>
          <div className="paper-lab-kpi">
            <div className="paper-lab-kpi__label">Lần chạy analytics gần nhất</div>
            <div className="paper-lab-kpi__value" style={{ fontSize: "0.85rem" }}>
              {summary.lastAnalyticsRun ?? "—"}
            </div>
          </div>
        </div>
      </PaperLabPanel>
      <PaperLabPanel title="Đo lường job">
        <div className="safe-table-wrap paper-lab-table-wrap">
          <table className="paper-lab-table safe-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Sự kiện</th>
                <th>Lỗi</th>
                <th>Độ trễ TB</th>
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
