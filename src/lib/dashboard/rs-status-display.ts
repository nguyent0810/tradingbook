import type { RelativeStrengthRow } from "@/components/command-deck/types";
import { isExtendedDoNotChase } from "./early-entry-ui";

const SETUP_STATE_LABELS: Record<string, string> = {
  "Watch: breakout": "Chờ breakout",
  "Blocked: zone": "Sai vùng",
  "Watch: volume": "Theo dõi: khối lượng",
  "Blocked: MA50": "Dưới MA50",
  "Watch: momentum": "Theo dõi: động lượng",
  "Blocked: extended": "Quá mở rộng",
  "Watch: hold": "Theo dõi: giữ nhịp",
  "Watch: digestion": "Theo dõi: tích lũy",
  "Watch: monitor": "Theo dõi",
};

const SETUP_STATE_TOOLTIPS: Record<string, string> = {
  "Chờ breakout":
    "Sức mạnh tương đối tốt nhưng giá chưa vượt ngưỡng kích hoạt breakout.",
  "Sai vùng": "Giá đang ở ngoài vùng vào lệnh hợp lệ. Chờ tỷ lệ R:R tốt hơn.",
  "Theo dõi: khối lượng": "Cần thêm khối lượng xác nhận trước khi đạt điều kiện.",
  "Dưới MA50": "Bộ lọc xu hướng chưa xác nhận.",
  "Theo dõi: động lượng": "Động lượng ngắn hạn chưa theo kịp xu hướng dài hạn.",
  "Quá mở rộng": "Giá đã cách quá xa vùng vào lệnh rủi ro thấp. Tránh FOMO.",
  "Theo dõi: giữ nhịp": "Breakout chưa giữ vững — cần theo dõi thêm.",
  "Theo dõi: tích lũy": "Cần thời gian tích lũy sau breakout trước khi vào lệnh.",
  "Theo dõi": "Đang theo dõi — chưa đủ điều kiện vào lệnh.",
};

const EARLY_STATE_LABELS: Record<string, string> = {
  "Extended — Do Not Chase": "Quá mở rộng",
  "Pilot Candidate": "Nghiên cứu thử nghiệm",
  "Add Zone": "Vùng gia tăng theo dõi",
  Watch: "Theo dõi",
};

const EARLY_STATE_TOOLTIPS: Record<string, string> = {
  "Quá mở rộng": "Giá đã cách quá xa vùng vào lệnh rủi ro thấp. Tránh FOMO.",
  "Nghiên cứu thử nghiệm":
    "Tín hiệu sớm chỉ để quan sát — không phải khuyến nghị mua.",
  "Vùng gia tăng theo dõi":
    "Chỉ là vùng có thể gia tăng sau khi xác nhận và chỉ khi đã theo dõi giao dịch này.",
  "Theo dõi": "Theo dõi để xác nhận — không phải tín hiệu mua.",
};

export const WORKBENCH_ACTION_TOOLTIPS: Record<string, string> = {
  "Tránh đuổi giá": "Giá đã mở rộng hoặc R:R kém. Đừng FOMO.",
  "Chờ vùng tốt hơn": "Giá đang ở ngoài vùng vào lệnh hợp lệ.",
  "Theo dõi kích hoạt": "Chờ xác nhận breakout.",
  "Còn quá sớm": "Bộ lọc xu hướng chưa xác nhận.",
  "Theo dõi xác thực": "Chỉ là tín hiệu nghiên cứu, không phải khuyến nghị mua.",
  "Chờ xác nhận": "Chỉ gia tăng sau khi có xác nhận.",
  "Quan sát": "Chỉ theo dõi.",
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

  if (early === "Quá mở rộng") return "Tránh đuổi giá";
  if (setup === "Sai vùng" && hasBadRiskReward(row)) return "Tránh đuổi giá";
  if (setup === "Quá mở rộng") return "Tránh đuổi giá";

  if (setup === "Sai vùng") return "Chờ vùng tốt hơn";
  if (setup === "Chờ breakout") return "Theo dõi kích hoạt";
  if (setup === "Dưới MA50") return "Còn quá sớm";

  if (early === "Nghiên cứu thử nghiệm") return "Theo dõi xác thực";
  if (early === "Vùng gia tăng theo dõi") return "Chờ xác nhận";

  return "Quan sát";
}

export function workbenchActionTooltip(row: RelativeStrengthRow): string {
  const label = workbenchActionLabel(row);
  return WORKBENCH_ACTION_TOOLTIPS[label] ?? WORKBENCH_ACTION_TOOLTIPS["Quan sát"];
}

export function setupBadgeTone(setupState: string): WorkbenchBadgeTone {
  const friendly = friendlySetupStateLabel(setupState);
  if (friendly === "Sai vùng" || friendly === "Dưới MA50" || friendly === "Quá mở rộng") {
    return "danger";
  }
  if (friendly === "Chờ breakout") return "warning";
  return "neutral";
}

export function earlyResearchBadgeTone(proposedTradeState: string): WorkbenchBadgeTone {
  const friendly = friendlyEarlyStateLabel(proposedTradeState);
  if (friendly === "Quá mở rộng") return "danger";
  if (friendly === "Nghiên cứu thử nghiệm" || friendly === "Vùng gia tăng theo dõi" || friendly === "Theo dõi") {
    return "info";
  }
  return "neutral";
}

export function rowMatchesAvoidChase(row: RelativeStrengthRow): boolean {
  if (row.earlyEntry && isExtendedDoNotChase(row.earlyEntry.proposedTradeState)) {
    return true;
  }
  const setup = friendlySetupStateLabel(row.setupState);
  if (setup === "Sai vùng" && hasBadRiskReward(row)) return true;
  if (setup === "Quá mở rộng") return true;
  return false;
}
