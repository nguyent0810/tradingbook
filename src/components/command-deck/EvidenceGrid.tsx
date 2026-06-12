"use client";

import type { EvidenceItem } from "./types";
import { Card, CardHeader } from "./ui/card";

type Props = {
  items: EvidenceItem[];
  defaultOpen?: boolean;
  summaryLine?: string | null;
};

function toneClass(tone: EvidenceItem["tone"]): string {
  if (tone === "danger") return "cd-tone-danger";
  if (tone === "warning") return "cd-tone-warning";
  if (tone === "success") return "cd-tone-success";
  return "cd-evidence-row__value";
}

export function EvidenceGrid({ items, summaryLine }: Props) {
  return (
    <Card className="p-4 cd-span-12" data-testid="command-deck-evidence">
      <CardHeader title="Session Evidence" subtitle="Diagnostics · freshness · blockers" />
      {summaryLine ? (
        <p
          className="cd-evidence-summary m-0 mb-3"
          data-testid="dashboard-evidence-summary"
        >
          {summaryLine}
        </p>
      ) : null}
      <div className="cd-evidence-grid">
        {items.map((item) => (
          <div key={item.label} className="cd-evidence-row">
            <span className="cd-evidence-row__label">{item.label}</span>
            <span className={toneClass(item.tone)}>{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
