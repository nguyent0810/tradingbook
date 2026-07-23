import type { V3EarlyEntryDisplay, V3RsWatchlistCard } from "./dashboard-v3-view-model";

export const EARLY_ENTRY_DAILY_CHECKLIST = [
  "Xem các Pilot Candidate, nhưng đừng xem đó là tín hiệu mua.",
  "Ưu tiên các ứng viên sau đó xác nhận bằng follow-through.",
  "Theo dõi xem EXTENDED_DO_NOT_CHASE có giúp tránh FOMO không.",
  "Chạy paper-log sau mỗi phiên.",
  "Chạy paper-validate hằng tuần.",
] as const;

export const EARLY_ENTRY_PAPER_COMMANDS = {
  daily: "npm run audit:early-entry:paper-log",
  weeklyValidate: "npm run audit:early-entry:paper-validate",
  weeklySummary: "npm run audit:early-entry:paper-summary",
} as const;

export type EarlyEntryFilterId =
  | "all"
  | "pilot_candidate"
  | "add_zone"
  | "extended"
  | "watch_high_score"
  | "bad_rr"
  | "confirmation_needed";

export type EarlyEntrySortId =
  | "score_desc"
  | "rr_desc"
  | "closest_invalid"
  | "most_extended"
  | "rs_desc"
  | "symbol_asc";

export const EARLY_ENTRY_FILTER_OPTIONS: ReadonlyArray<{
  id: EarlyEntryFilterId;
  label: string;
}> = [
  { id: "all", label: "Hiện tất cả" },
  { id: "pilot_candidate", label: "Chỉ Pilot Candidate" },
  { id: "add_zone", label: "Chỉ Add Zone" },
  { id: "extended", label: "Chỉ Extended — Do Not Chase" },
  { id: "watch_high_score", label: "Chỉ Watch điểm cao" },
  { id: "bad_rr", label: "R:R xấu bị chặn" },
  { id: "confirmation_needed", label: "Cần xác nhận" },
];

export const EARLY_ENTRY_SORT_OPTIONS: ReadonlyArray<{
  id: EarlyEntrySortId;
  label: string;
}> = [
  { id: "score_desc", label: "Early Reversal Score cao nhất" },
  { id: "rr_desc", label: "R:R tốt nhất" },
  { id: "closest_invalid", label: "Gần mức hủy nhất" },
  { id: "most_extended", label: "Extended nhiều nhất / rủi ro đuổi giá" },
  { id: "rs_desc", label: "RS mạnh nhất" },
  { id: "symbol_asc", label: "Tín hiệu mới nhất" },
];

export function hasAnyEarlyEntry(cards: readonly V3RsWatchlistCard[]): boolean {
  return cards.some((c) => c.earlyEntry != null);
}

function matchesEarlyEntryFilter(
  early: V3EarlyEntryDisplay,
  filter: EarlyEntryFilterId
): boolean {
  const state = early.proposedTradeState;
  switch (filter) {
    case "all":
      return true;
    case "pilot_candidate":
      return state.includes("Pilot Candidate");
    case "add_zone":
      return state.includes("Add Zone");
    case "extended":
      return state.includes("Extended");
    case "watch_high_score":
      return state === "Watch" && early.earlyReversalScore >= 35;
    case "bad_rr":
      return (
        early.reasonCodes.includes("BAD_RR") ||
        early.rrRejectionReason != null ||
        (state.includes("Blocked") && early.reasonCodes.includes("BAD_RR"))
      );
    case "confirmation_needed":
      return (
        early.whyNotPilotYet != null ||
        state === "Watch" ||
        early.transitionReasonCodes.some((c) => c.includes("CONFIRM"))
      );
    default:
      return true;
  }
}

export function filterRsWatchlistCards(
  cards: readonly V3RsWatchlistCard[],
  filter: EarlyEntryFilterId
): V3RsWatchlistCard[] {
  if (filter === "all") return [...cards];
  return cards.filter((card) => {
    if (!card.earlyEntry) return false;
    return matchesEarlyEntryFilter(card.earlyEntry, filter);
  });
}

function extensionRiskScore(early: V3EarlyEntryDisplay): number {
  let score = 0;
  if (early.proposedTradeState.includes("Extended")) score += 100;
  if (early.reasonCodes.includes("EXTENDED_FROM_MA20")) score += 40;
  if (early.reasonCodes.includes("CHASE_RISK")) score += 30;
  if (early.reasonCodes.includes("BAD_RR")) score += 10;
  return score;
}

export function sortRsWatchlistCards(
  cards: readonly V3RsWatchlistCard[],
  sort: EarlyEntrySortId
): V3RsWatchlistCard[] {
  const copy = [...cards];
  copy.sort((a, b) => {
    const ae = a.earlyEntry;
    const be = b.earlyEntry;
    switch (sort) {
      case "score_desc":
        return (be?.earlyReversalScore ?? -1) - (ae?.earlyReversalScore ?? -1);
      case "rr_desc":
        return (be?.estimatedRiskReward ?? -1) - (ae?.estimatedRiskReward ?? -1);
      case "closest_invalid": {
        const ad = ae?.stopDistancePct ?? Number.POSITIVE_INFINITY;
        const bd = be?.stopDistancePct ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      }
      case "most_extended":
        return extensionRiskScore(be ?? emptyEarly()) - extensionRiskScore(ae ?? emptyEarly());
      case "rs_desc":
        return (b.rs20SpreadPct ?? -999) - (a.rs20SpreadPct ?? -999);
      case "symbol_asc":
        return b.symbol.localeCompare(a.symbol);
      default:
        return 0;
    }
  });
  return copy;
}

function emptyEarly(): V3EarlyEntryDisplay {
  return {
    earlyReversalScore: 0,
    proposedTradeState: "",
    entryType: null,
    reasonCodes: [],
    transitionReasonCodes: [],
    invalidLevel: null,
    invalidLevelReason: null,
    stopDistancePct: null,
    targetPrice: null,
    targetReason: null,
    estimatedRewardPct: null,
    estimatedRiskReward: null,
    suggestedPilotSizePct: null,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: null,
  };
}

export function formatReasonChip(code: string): string {
  return code.replace(/_/g, " ");
}

export function isExtendedDoNotChase(state: string): boolean {
  return state.includes("Extended");
}
