/**
 * Trader-selected review outcome on health checkpoints — persisted in
 * `trade_health_logs.review_checklist` JSON as `reviewOutcome` alongside checklist booleans.
 */

import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";
import { parseReviewChecklistJson } from "@/lib/trades/trade-health-review-checklist";

export const REVIEW_OUTCOME_IDS = [
  "holding_as_planned",
  "monitoring_closely",
  "structure_weakening",
  "reduce_risk_candidate",
  "exit_thesis_under_review",
] as const;

export type ReviewOutcomeId = (typeof REVIEW_OUTCOME_IDS)[number];

const OUTCOME_SET = new Set<string>(REVIEW_OUTCOME_IDS);

export const REVIEW_OUTCOME_TRADER_LABEL: Record<ReviewOutcomeId, string> = {
  holding_as_planned: "Holding as planned",
  monitoring_closely: "Monitoring closely",
  structure_weakening: "Structure weakening",
  reduce_risk_candidate: "Reduce-risk candidate",
  exit_thesis_under_review: "Exit thesis under review",
};

export function reviewOutcomeTraderLabel(id: ReviewOutcomeId | null): string | null {
  if (id == null) return null;
  return REVIEW_OUTCOME_TRADER_LABEL[id] ?? null;
}

export function parseReviewOutcomeFromPayload(raw: unknown): ReviewOutcomeId | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>).reviewOutcome;
  if (typeof v !== "string" || !OUTCOME_SET.has(v)) return null;
  return v as ReviewOutcomeId;
}

export function parseHealthReviewLogPayload(raw: unknown): {
  checklist: EodReviewChecklistState | null;
  reviewOutcome: ReviewOutcomeId | null;
} {
  return {
    checklist: parseReviewChecklistJson(raw),
    reviewOutcome: parseReviewOutcomeFromPayload(raw),
  };
}

/** Optional field on checkpoint form — empty string means none. */
export function reviewOutcomeFromFormData(formData: FormData): ReviewOutcomeId | null {
  const raw = String(formData.get("reviewOutcome") ?? "").trim();
  if (!raw || !OUTCOME_SET.has(raw)) return null;
  return raw as ReviewOutcomeId;
}

/**
 * Merges checklist booleans and optional `reviewOutcome` into one JSONB payload.
 * Returns null only when nothing to persist.
 */
export function serializeTradeHealthReviewPayloadForDb(
  checklist: EodReviewChecklistState,
  reviewOutcome: ReviewOutcomeId | null
): string | null {
  const o: Record<string, unknown> = {};
  if (checklist.stopReviewed) o.stopReviewed = true;
  if (checklist.structureReviewed) o.structureReviewed = true;
  if (checklist.sizingReviewed) o.sizingReviewed = true;
  if (checklist.exitPlanReviewed) o.exitPlanReviewed = true;
  if (reviewOutcome) o.reviewOutcome = reviewOutcome;

  if (Object.keys(o).length === 0) return null;
  return JSON.stringify(o);
}
