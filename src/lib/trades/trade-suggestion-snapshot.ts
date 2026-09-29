import type { TargetR, TradeSuggestion } from "./trade-suggestion";

/**
 * `Trade.suggestionSnapshot` (#17, #11 story 28): the Gợi ý lệnh as it stood
 * when the trade was logged from it — the "plan trước phiên" that tuân thủ can
 * later be judged against. The time it was taken is `Trade.suggestionSnapshotAt`
 * (a column, so it can be queried); trades logged without a suggestion (manual
 * entries, trades before #17) have both null.
 *
 * `schemaVersion` lets a later reader tell this shape from a future one.
 */
export type TradeSuggestionSnapshot = {
  schemaVersion: 1;
  /** The Mốc chốt the logged take-profit equals; null when the user typed another price. */
  targetR: TargetR | null;
  suggestion: TradeSuggestion;
};
