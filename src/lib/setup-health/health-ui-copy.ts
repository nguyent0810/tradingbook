import type { SetupHealthFlag } from "./types";
import type { SetupHealthLevelValue } from "./types";
import type { WatchHealthMeta } from "./types";

export type ScoreBandLabel = "Strong" | "Decent" | "Weak" | "Risky";

export function healthScoreLabel(score: number): ScoreBandLabel {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Decent";
  if (score >= 40) return "Weak";
  return "Risky";
}

export function healthLevelActionHint(level: SetupHealthLevelValue): string | null {
  switch (level) {
    case "WARNING":
      return "Monitor carefully.";
    case "AT_RISK":
      return "Avoid chasing. Wait for reset.";
    case "DEAD":
      return "Setup no longer tradable.";
    default:
      return null;
  }
}

function flagReason(flag: SetupHealthFlag): string | null {
  switch (flag) {
    case "CHASE":
      return "is in chase territory";
    case "TOO_EXTENDED":
      return "is too extended";
    case "EXTENDED":
      return "is extended";
    case "VOLUME_FADE":
      return "volume is fading";
    case "FAILED_TO_PULLBACK":
      return "failed to retest entry zone";
    case "AGING_SETUP":
      return "is aging";
    case "REVERSAL_RISK":
      return "shows reversal risk";
    case "DEAD_SETUP":
      return "is too far from entry zone";
    default:
      return null;
  }
}

/**
 * Trader-friendly explanation from flags, capped at two reasons.
 * Example: "Setup is extended and volume is fading."
 */
export function healthFlagSummary(flags: SetupHealthFlag[]): string | null {
  const priority: SetupHealthFlag[] = [
    "CHASE",
    "TOO_EXTENDED",
    "DEAD_SETUP",
    "EXTENDED",
    "FAILED_TO_PULLBACK",
    "VOLUME_FADE",
    "REVERSAL_RISK",
    "AGING_SETUP",
  ];

  const reasons: string[] = [];
  for (const f of priority) {
    if (!flags.includes(f)) continue;
    const reason = flagReason(f);
    if (!reason) continue;
    reasons.push(reason);
    if (reasons.length >= 2) break;
  }
  if (reasons.length === 0) return null;
  if (reasons.length === 1) return `Setup ${reasons[0]}.`;
  return `Setup ${reasons[0]} and ${reasons[1]}.`;
}

/** Bullet lines under symbol row on /setups */
export function buildHealthLines(flags: SetupHealthFlag[], meta: WatchHealthMeta): string[] {
  const lines: string[] = [];

  if (
    meta.sessionsSinceBreakout != null &&
    meta.sessionsSinceBreakout >= 1 &&
    (flags.includes("FAILED_TO_PULLBACK") ||
      flags.some((f) => f === "EXTENDED" || f === "TOO_EXTENDED" || f === "CHASE") ||
      flags.includes("AGING_SETUP"))
  ) {
    lines.push(`→ ${meta.sessionsSinceBreakout} sessions since breakout`);
  }

  if (meta.extendedPct != null && meta.extendedPct > 0) {
    const pct = (meta.extendedPct * 100).toFixed(1);
    const tag = flags.includes("CHASE")
      ? "CHASE"
      : flags.includes("TOO_EXTENDED")
        ? "TOO_EXTENDED"
        : "EXTENDED";
    lines.push(`→ ${pct}% above entry zone (${tag})`);
  }

  if (flags.includes("VOLUME_FADE")) lines.push("→ Volume fading");

  if (flags.includes("FAILED_TO_PULLBACK")) {
    lines.push("→ No pullback interaction in window");
  }

  if (flags.includes("REVERSAL_RISK")) {
    lines.push("→ Weak close on volume (reversal risk)");
  }

  if (flags.includes("DEAD_SETUP")) {
    lines.push(`→ ${(meta.distanceToZonePct * 100).toFixed(1)}% from pullback zone`);
  }

  if (flags.includes("AGING_SETUP")) {
    lines.push(`→ ${meta.sessionsAfterFirstSeen} sessions since first seen`);
  }

  return lines;
}

/** Compact chips for flags (subset). */
export function compactFlagLabel(f: SetupHealthFlag): string {
  switch (f) {
    case "AGING_SETUP":
      return "AGING";
    case "EXTENDED":
      return "EXTENDED";
    case "TOO_EXTENDED":
      return "TOO_EXT";
    case "CHASE":
      return "CHASE";
    case "VOLUME_FADE":
      return "VOL";
    case "FAILED_TO_PULLBACK":
      return "NO_PB";
    case "REVERSAL_RISK":
      return "REV";
    case "DEAD_SETUP":
      return "DEAD_ZONE";
    default:
      return f;
  }
}
