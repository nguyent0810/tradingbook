import type { RelativeStrengthRow } from "@/components/command-deck/types";
import { formatReasonChip, isExtendedDoNotChase } from "./early-entry-ui";
import {
  rowMatchesAvoidChase,
  workbenchActionLabel,
} from "./rs-status-display";
import { sectorForSymbol } from "./rs-sector-display";

export type RsWorkbenchFilterId =
  | "all"
  | "avoid_chase"
  | "watch_trigger"
  | "wait_better_zone"
  | "below_ma50"
  | "pilot_research"
  | "bank_only"
  | "bad_rr";

export type RsWorkbenchSortId =
  | "rs20_desc"
  | "rs50_desc"
  | "score_desc"
  | "rr_desc"
  | "ma20_dist_asc"
  | "most_extended";

export const RS_WORKBENCH_FILTER_OPTIONS: ReadonlyArray<{
  id: RsWorkbenchFilterId;
  label: string;
  requiresEarlyEntry?: boolean;
}> = [
  { id: "all", label: "Tất cả" },
  { id: "avoid_chase", label: "Tránh đuổi giá", requiresEarlyEntry: true },
  { id: "watch_trigger", label: "Theo dõi điểm kích hoạt" },
  { id: "wait_better_zone", label: "Chờ vùng tốt hơn" },
  { id: "below_ma50", label: "Dưới MA50" },
  { id: "pilot_research", label: "Nghiên cứu Pilot", requiresEarlyEntry: true },
  { id: "bank_only", label: "Ngân hàng" },
  { id: "bad_rr", label: "R:R xấu", requiresEarlyEntry: true },
];

export const RS_WORKBENCH_SORT_OPTIONS: ReadonlyArray<{
  id: RsWorkbenchSortId;
  label: string;
}> = [
  { id: "rs20_desc", label: "RS20" },
  { id: "rs50_desc", label: "RS50" },
  { id: "score_desc", label: "Điểm Early" },
  { id: "rr_desc", label: "R:R" },
  { id: "ma20_dist_asc", label: "Khoảng cách đến MA20" },
  { id: "most_extended", label: "Extended nhiều nhất" },
];

export function hasAnyEarlyEntryRows(rows: readonly RelativeStrengthRow[]): boolean {
  return rows.some((r) => r.earlyEntry != null);
}

export function visibleFilterOptions(
  rows: readonly RelativeStrengthRow[]
): typeof RS_WORKBENCH_FILTER_OPTIONS {
  const hasEarly = hasAnyEarlyEntryRows(rows);
  return RS_WORKBENCH_FILTER_OPTIONS.filter((opt) => {
    if (opt.requiresEarlyEntry && !hasEarly) return false;
    return true;
  });
}

export function countWorkbenchRowsByFilter(
  rows: readonly RelativeStrengthRow[]
): Record<RsWorkbenchFilterId, number> {
  const counts = {} as Record<RsWorkbenchFilterId, number>;
  for (const opt of RS_WORKBENCH_FILTER_OPTIONS) {
    counts[opt.id] = filterWorkbenchRows(rows, opt.id).length;
  }
  return counts;
}

export function filterEmptyStateMessage(
  filter: RsWorkbenchFilterId,
  resultCount: number
): string | null {
  if (resultCount > 0) return null;
  if (filter === "pilot_research") {
    return "Không có ứng viên Pilot Research hôm nay. Đây là điều bình thường. Đừng ép giao dịch.";
  }
  if (filter === "bank_only") {
    return "Không có mã ngân hàng trong tập đã lọc hiện tại.";
  }
  if (filter === "avoid_chase") {
    return "Không có mã bị đuổi giá quá mức trong lần quét hiện tại.";
  }
  return "Không có mã nào khớp với bộ lọc này.";
}

function matchesTerminal(row: RelativeStrengthRow, code: string): boolean {
  return row.terminalCode === code;
}

function matchesSetupState(row: RelativeStrengthRow, ...states: string[]): boolean {
  return states.some((s) => row.setupState.toLowerCase().includes(s.toLowerCase()));
}

function extensionRiskScore(row: RelativeStrengthRow): number {
  const early = row.earlyEntry;
  if (!early) return 0;
  let score = 0;
  if (isExtendedDoNotChase(early.proposedTradeState)) score += 100;
  if (early.reasonCodes.includes("EXTENDED_FROM_MA20")) score += 40;
  if (early.reasonCodes.includes("CHASE_RISK")) score += 30;
  if (early.reasonCodes.includes("BAD_RR")) score += 10;
  return score;
}

export function filterWorkbenchRows(
  rows: readonly RelativeStrengthRow[],
  filter: RsWorkbenchFilterId
): RelativeStrengthRow[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => {
    switch (filter) {
      case "avoid_chase":
        return rowMatchesAvoidChase(row);
      case "watch_trigger":
        return workbenchActionLabel(row) === "Theo dõi kích hoạt";
      case "wait_better_zone":
        return workbenchActionLabel(row) === "Chờ vùng tốt hơn";
      case "below_ma50":
        return workbenchActionLabel(row) === "Còn quá sớm";
      case "pilot_research":
        return row.earlyEntry?.proposedTradeState.includes("Pilot Candidate") ?? false;
      case "bad_rr":
        return (
          row.earlyEntry != null &&
          (row.earlyEntry.reasonCodes.includes("BAD_RR") ||
            row.earlyEntry.rrRejectionReason != null)
        );
      case "bank_only":
        return sectorForSymbol(row.symbol) === "bank";
      default:
        return true;
    }
  });
}

export function sortWorkbenchRows(
  rows: readonly RelativeStrengthRow[],
  sort: RsWorkbenchSortId
): RelativeStrengthRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const ae = a.earlyEntry;
    const be = b.earlyEntry;
    switch (sort) {
      case "rs20_desc":
        return (b.rs20 ?? -999) - (a.rs20 ?? -999);
      case "rs50_desc":
        return (b.rs50 ?? -999) - (a.rs50 ?? -999);
      case "score_desc":
        return (be?.earlyReversalScore ?? -1) - (ae?.earlyReversalScore ?? -1);
      case "rr_desc":
        return (be?.estimatedRiskReward ?? -1) - (ae?.estimatedRiskReward ?? -1);
      case "ma20_dist_asc": {
        const ad = ae?.distFromMa20Pct ?? Number.POSITIVE_INFINITY;
        const bd = be?.distFromMa20Pct ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      }
      case "most_extended":
        return extensionRiskScore(b) - extensionRiskScore(a);
      default:
        return 0;
    }
  });
  return copy;
}

export { formatReasonChip };
