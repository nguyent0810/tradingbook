import type { RelativeStrengthRow } from "@/components/command-deck/types";
import { isExtendedDoNotChase } from "./early-entry-ui";

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

export const WORKBENCH_ACTION_TOOLTIPS: Record<string, string> = {
  "Avoid chase": "Price is extended or R:R is poor. Do not FOMO.",
  "Wait better zone": "Price is outside a valid entry zone.",
  "Watch trigger": "Wait for breakout confirmation.",
  "Too early": "Trend filter has not confirmed.",
  "Validation watch": "Research signal only, not a buy recommendation.",
  "Wait confirmation": "Add only after confirmation.",
  Observe: "Monitor only.",
};

export type WorkbenchBadgeTone = "danger" | "warning" | "info" | "neutral";

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

export function hasBadRiskReward(row: RelativeStrengthRow): boolean {
  const early = row.earlyEntry;
  if (!early) return false;
  return early.reasonCodes.includes("BAD_RR") || early.rrRejectionReason != null;
}

/** Priority-based action label for RS Workbench — display only. */
export function workbenchActionLabel(row: RelativeStrengthRow): string {
  const setup = friendlySetupStateLabel(row.setupState);
  const early = row.earlyEntry
    ? friendlyEarlyStateLabel(row.earlyEntry.proposedTradeState)
    : null;

  if (early === "Too Extended") return "Avoid chase";
  if (setup === "Bad Zone" && hasBadRiskReward(row)) return "Avoid chase";
  if (setup === "Too Extended") return "Avoid chase";

  if (setup === "Bad Zone") return "Wait better zone";
  if (setup === "Wait Breakout") return "Watch trigger";
  if (setup === "Below MA50") return "Too early";

  if (early === "Pilot Research") return "Validation watch";
  if (early === "Add Watch") return "Wait confirmation";

  return "Observe";
}

export function workbenchActionTooltip(row: RelativeStrengthRow): string {
  const label = workbenchActionLabel(row);
  return WORKBENCH_ACTION_TOOLTIPS[label] ?? WORKBENCH_ACTION_TOOLTIPS.Observe;
}

export function setupBadgeTone(setupState: string): WorkbenchBadgeTone {
  const friendly = friendlySetupStateLabel(setupState);
  if (friendly === "Bad Zone" || friendly === "Below MA50" || friendly === "Too Extended") {
    return "danger";
  }
  if (friendly === "Wait Breakout") return "warning";
  return "neutral";
}

export function earlyResearchBadgeTone(proposedTradeState: string): WorkbenchBadgeTone {
  const friendly = friendlyEarlyStateLabel(proposedTradeState);
  if (friendly === "Too Extended") return "danger";
  if (friendly === "Pilot Research" || friendly === "Add Watch" || friendly === "Watch") {
    return "info";
  }
  return "neutral";
}

export function rowMatchesAvoidChase(row: RelativeStrengthRow): boolean {
  if (row.earlyEntry && isExtendedDoNotChase(row.earlyEntry.proposedTradeState)) {
    return true;
  }
  const setup = friendlySetupStateLabel(row.setupState);
  if (setup === "Bad Zone" && hasBadRiskReward(row)) return true;
  if (setup === "Too Extended") return true;
  return false;
}
