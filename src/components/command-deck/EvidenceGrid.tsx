"use client";

import type { EvidenceItem } from "./types";
import { Card, CardHeader } from "./ui/card";

type Props = {
  items: EvidenceItem[];
};

function toneClass(tone: EvidenceItem["tone"]): string {
  if (tone === "danger") return "cd-tone-danger";
  if (tone === "warning") return "cd-tone-warning";
  if (tone === "success") return "cd-tone-success";
  return "";
}

export function EvidenceGrid({ items }: Props) {
  return (
    <Card className="p-4 cd-span-12" data-testid="command-deck-evidence">
      <CardHeader title="Session Evidence" subtitle="Diagnostics · freshness · blockers" />
      <div className="cd-evidence-grid">
        {items.map((item) => (
          <div key={item.label} className="cd-evidence-row">
            <span style={{ color: "var(--cd-text-muted)" }}>{item.label}</span>
            <span className={toneClass(item.tone)}>{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
