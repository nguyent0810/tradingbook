"use client";

import { useState } from "react";
import type { V3EvidenceItem } from "@/lib/dashboard/dashboard-v3-view-model";
import { truncateForChip } from "@/lib/dashboard/v3-user-copy";

type Props = {
  items: V3EvidenceItem[];
};

function stateClass(state: V3EvidenceItem["state"]): string {
  if (state === "ok") return "tosv3-evidence__item--ok";
  if (state === "warn") return "tosv3-evidence__item--warn";
  return "tosv3-evidence__item--danger";
}

function stateIcon(state: V3EvidenceItem["state"]): string {
  if (state === "ok") return "✓";
  if (state === "warn") return "!";
  return "✕";
}

function worstState(items: V3EvidenceItem[]): V3EvidenceItem["state"] {
  if (items.some((i) => i.state === "danger")) return "danger";
  if (items.some((i) => i.state === "warn")) return "warn";
  return "ok";
}

export function EvidenceLayer({ items }: Props) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const summaryState = worstState(items);

  return (
    <section
      className="tosv3-panel tosv3-evidence"
      aria-label="Evidence layer"
      data-testid="dashboard-v3-evidence-layer"
    >
      <button
        type="button"
        className="tosv3-evidence__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="dashboard-v3-evidence-panel"
        aria-label={open ? "Hide session evidence" : "Show session evidence"}
      >
        <span className="tosv3-kicker">Session evidence</span>
        <strong>{open ? "Hide details" : `${items.length} checks · expand`}</strong>
        <span className={`tosv3-evidence__summary-badge tosv3-evidence__item--${summaryState}`}>
          {stateIcon(summaryState)}
        </span>
      </button>

      {!open ? (
        <ul className="tosv3-evidence__chips" aria-label="Evidence summary">
          {items.map((item) => (
            <li key={item.label} className={`tosv3-evidence-chip ${stateClass(item.state)}`}>
              <span className="tosv3-evidence-chip__label">{item.label}</span>
              <span className="tosv3-evidence-chip__value">{truncateForChip(item.value, 42)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        id="dashboard-v3-evidence-panel"
        className={`tosv3-evidence__content ${open ? "is-open" : ""}`}
        aria-hidden={!open}
      >
        {items.map((item) => (
          <article key={item.label} className={`tosv3-evidence__item ${stateClass(item.state)}`}>
            <span className="tosv3-evidence__item-icon" aria-hidden>
              {stateIcon(item.state)}
            </span>
            <div className="tosv3-evidence__item-body">
              <span className="tosv3-type-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
