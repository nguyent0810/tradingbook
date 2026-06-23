"use client";

import {
  EARLY_ENTRY_DAILY_CHECKLIST,
  EARLY_ENTRY_PAPER_COMMANDS,
} from "@/lib/dashboard/early-entry-ui";
import { EARLY_ENTRY_RESEARCH_DISCLAIMER } from "@/lib/scanner/early-entry";

export function EarlyEntryHelpPanel() {
  return (
    <details className="cd-early-help" data-testid="early-entry-help">
      <summary className="cd-early-help__trigger">Safety details &amp; commands</summary>
      <div className="cd-early-help__body">
        <p className="m-0 mb-2 text-xs" data-testid="command-deck-rs-early-research-warning">
          {EARLY_ENTRY_RESEARCH_DISCLAIMER}
        </p>
        <ul className="m-0 mb-2 pl-4 text-xs" data-testid="command-deck-rs-daily-checklist">
          {EARLY_ENTRY_DAILY_CHECKLIST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="cd-mono m-0 text-[10px]" data-testid="command-deck-rs-paper-commands">
          Daily: {EARLY_ENTRY_PAPER_COMMANDS.daily} · Weekly:{" "}
          {EARLY_ENTRY_PAPER_COMMANDS.weeklyValidate} · {EARLY_ENTRY_PAPER_COMMANDS.weeklySummary}
        </p>
      </div>
    </details>
  );
}
