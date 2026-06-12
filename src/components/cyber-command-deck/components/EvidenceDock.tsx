"use client";

import { useState } from "react";
import type { V3EvidenceItem } from "../types";

type Props = {
  items: V3EvidenceItem[];
};

function stateClass(state: V3EvidenceItem["state"]): string {
  return `ccd-evidence__item--${state === "ok" ? "ok" : state === "warn" ? "warn" : "danger"}`;
}

export function EvidenceDock({ items }: Props) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <section
      className="ccd-panel"
      aria-label="Evidence layer"
      data-testid="dashboard-cyber-evidence"
    >
      <button
        type="button"
        className="ccd-evidence__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="ccd-kicker">Session evidence</span>
        <strong className="text-sm">
          {open ? "Hide details" : `${items.length} checks · expand`}
        </strong>
      </button>

      {open ? (
        <ul className="ccd-evidence__list">
          {items.map((item) => (
            <li key={item.label} className={`ccd-evidence__item ${stateClass(item.state)}`}>
              <span>{item.label}</span>
              <strong className="ccd-metric text-xs">{item.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
