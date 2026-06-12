"use client";

import type { SetupIntelligenceRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Sparkline } from "./ui/sparkline";

type Props = {
  rows: SetupIntelligenceRow[];
  emptyMessage: string;
  subtitle: string;
};

export function SetupIntelligenceSection({ rows, emptyMessage, subtitle }: Props) {
  return (
    <Card className="p-4 cd-span-12" data-testid="dashboard-cyber-setup-table">
      <CardHeader title="Setup Intelligence" subtitle={subtitle} />

      {rows.length === 0 ? (
        <p className="text-sm m-0 text-center py-8" style={{ color: "var(--cd-text-muted)" }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="cd-rs-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Trigger</th>
                <th>Risk</th>
                <th>Action</th>
                <th className="text-right">Trace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol}>
                  <td className="cd-rs-table__symbol cd-mono">{row.symbol}</td>
                  <td className="cd-mono">{row.trigger}</td>
                  <td className="cd-mono">{row.risk}</td>
                  <td>{row.action}</td>
                  <td className="text-right">
                    <Sparkline values={row.sparkline} color="#00E5FF" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
