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
    case "NO_DATA":
      return "No recent bar data — cannot evaluate. Not eligible for entry.";
    default:
      return null;
  }
}

function flagReason(flag: SetupHealthFlag): string | null {
  switch (flag) {
    case "CHASE":
      return "đang trong vùng đuổi giá";
    case "TOO_EXTENDED":
      return "đã vượt quá xa vùng vào lệnh";
    case "EXTENDED":
      return "đã vượt xa vùng vào lệnh";
    case "VOLUME_FADE":
      return "khối lượng đang suy yếu";
    case "FAILED_TO_PULLBACK":
      return "chưa quay lại kiểm định vùng vào lệnh";
    case "AGING_SETUP":
      return "đang cũ dần";
    case "REVERSAL_RISK":
      return "có dấu hiệu rủi ro đảo chiều";
    case "DEAD_SETUP":
      return "đã cách quá xa vùng vào lệnh";
    default:
      return null;
  }
}

/**
 * Trader-friendly explanation from flags, capped at two reasons.
 * Example: "Thiết lập đã vượt xa vùng vào lệnh và khối lượng đang suy yếu."
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
  if (reasons.length === 1) return `Thiết lập ${reasons[0]}.`;
  return `Thiết lập ${reasons[0]} và ${reasons[1]}.`;
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
    lines.push(`→ ${meta.sessionsSinceBreakout} phiên kể từ breakout`);
  }

  if (meta.extendedPct != null && meta.extendedPct > 0) {
    const pct = (meta.extendedPct * 100).toFixed(1);
    const tag = flags.includes("CHASE")
      ? "CHASE"
      : flags.includes("TOO_EXTENDED")
        ? "TOO_EXTENDED"
        : "EXTENDED";
    lines.push(`→ Cao hơn vùng vào lệnh ${pct}% (${tag})`);
  }

  if (flags.includes("VOLUME_FADE")) lines.push("→ Khối lượng đang suy yếu");

  if (flags.includes("FAILED_TO_PULLBACK")) {
    lines.push("→ Chưa có tương tác pullback trong khung thời gian này");
  }

  if (flags.includes("REVERSAL_RISK")) {
    lines.push("→ Đóng cửa yếu kèm khối lượng (rủi ro đảo chiều)");
  }

  if (flags.includes("DEAD_SETUP") && meta.distanceToZonePct != null) {
    lines.push(`→ Cách vùng pullback ${(meta.distanceToZonePct * 100).toFixed(1)}%`);
  }

  if (flags.includes("AGING_SETUP")) {
    lines.push(`→ ${meta.sessionsAfterFirstSeen} phiên kể từ lần đầu xuất hiện`);
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
