import type { RelativeStrengthRow } from "@/components/command-deck/types";

const SETUP_STATE_LABELS: Record<string, string> = {
  "Watch: breakout": "Wait Breakout",
  "Blocked: zone": "Bad Zone",
  "Blocked: MA50": "Below MA50",
  "Blocked: extended": "Too Extended",
};

const SETUP_STATE_TOOLTIPS: Record<string, string> = {
  "Wait Breakout":
    "Relative strength is good but price has not cleared the breakout trigger.",
  "Bad Zone": "Price is outside the valid entry zone. Wait for better R:R.",
  "Below MA50": "Trend filter has not confirmed yet.",
  "Too Extended": "Price is too far from a low-risk entry zone. Avoid FOMO.",
};

const EARLY_STATE_LABELS: Record<string, string> = {
  "Extended — Do Not Chase": "Too Extended",
  "Pilot Candidate": "Pilot Research",
  "Add Zone": "Add Watch",
  Watch: "Watch",
};

const EARLY_STATE_TOOLTIPS: Record<string, string> = {
  "Too Extended": "Price is too far from a low-risk entry zone. Avoid FOMO.",
  "Pilot Research":
    "Early signal for observation only — not a buy recommendation.",
  "Add Watch":
    "Possible add area only after confirmation and only if already tracking the trade.",
  Watch: "Monitor for confirmation — not a buy signal.",
};

export function friendlySetupStateLabel(setupState: string): string {
  return SETUP_STATE_LABELS[setupState] ?? setupState;
}

export function friendlyEarlyStateLabel(state: string): string {
  return EARLY_STATE_LABELS[state] ?? state;
}

export function setupStateTooltip(setupState: string): string | null {
  const friendly = friendlySetupStateLabel(setupState);
  return SETUP_STATE_TOOLTIPS[friendly] ?? null;
}

export function earlyStateTooltip(state: string): string | null {
  const friendly = friendlyEarlyStateLabel(state);
  return EARLY_STATE_TOOLTIPS[friendly] ?? null;
}

export function statusTooltipForRow(row: RelativeStrengthRow): string | null {
  if (row.earlyEntry?.proposedTradeState) {
    const early = earlyStateTooltip(row.earlyEntry.proposedTradeState);
    if (early) return early;
  }
  return setupStateTooltip(row.setupState);
}

/** Action-oriented label for workbench table and radar tooltips. */
export function workbenchActionLabel(row: RelativeStrengthRow): string {
  if (row.earlyEntry) {
    const early = friendlyEarlyStateLabel(row.earlyEntry.proposedTradeState);
    if (early === "Too Extended") return "Avoid chase";
    if (early === "Pilot Research") return "Paper watch only";
    if (early === "Add Watch") return "Wait confirmation";
    if (early === "Watch") return "Observe";
  }
  const setup = friendlySetupStateLabel(row.setupState);
  if (setup === "Wait Breakout") return "Watch trigger";
  if (setup === "Bad Zone") return "Wait better zone";
  if (setup === "Below MA50") return "Too early";
  if (setup === "Too Extended") return "Avoid chase";
  return row.actionLabel && row.actionLabel !== "—" ? row.actionLabel : "Observe";
}
