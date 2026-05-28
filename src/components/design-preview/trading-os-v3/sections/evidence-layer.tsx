"use client";

import { useState } from "react";
import type { EvidenceItem } from "../types";

type Props = {
  items: EvidenceItem[];
};

function stateClass(state: EvidenceItem["state"]): string {
  if (state === "ok") return "tosv3-evidence__item--ok";
  if (state === "warn") return "tosv3-evidence__item--warn";
  return "tosv3-evidence__item--danger";
}

export function EvidenceLayer({ items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="tosv3-panel tosv3-evidence" aria-label="Evidence layer">
      <button
        type="button"
        className="tosv3-evidence__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="tosv3-evidence-panel"
      >
        <span className="tosv3-kicker">Evidence layer</span>
        <strong>{open ? "Hide diagnostics" : "Show diagnostics"}</strong>
      </button>
      <div
        id="tosv3-evidence-panel"
        className={`tosv3-evidence__content ${open ? "is-open" : ""}`}
        aria-hidden={!open}
      >
        {items.map((item) => (
          <article key={item.label} className={`tosv3-evidence__item ${stateClass(item.state)}`}>
            <span className="tosv3-type-label">{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
