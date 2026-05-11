/**
 * Optional checklist persisted on trade_health_logs.review_checklist (JSON).
 * Conservative booleans only — no workflow engine.
 */

export type EodReviewChecklistState = {
  stopReviewed: boolean;
  structureReviewed: boolean;
  sizingReviewed: boolean;
  exitPlanReviewed: boolean;
};

export const EMPTY_EOD_REVIEW_CHECKLIST: EodReviewChecklistState = {
  stopReviewed: false,
  structureReviewed: false,
  sizingReviewed: false,
  exitPlanReviewed: false,
};

export function parseReviewChecklistJson(raw: unknown): EodReviewChecklistState | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const b = (k: string) => o[k] === true;
  const state: EodReviewChecklistState = {
    stopReviewed: b("stopReviewed"),
    structureReviewed: b("structureReviewed"),
    sizingReviewed: b("sizingReviewed"),
    exitPlanReviewed: b("exitPlanReviewed"),
  };
  const any =
    state.stopReviewed ||
    state.structureReviewed ||
    state.sizingReviewed ||
    state.exitPlanReviewed;
  return any ? state : null;
}

/** Form checkboxes: presence "on" = checked. */
export function reviewChecklistFromFormData(formData: FormData): EodReviewChecklistState {
  return {
    stopReviewed: formData.get("checkStopReviewed") === "on",
    structureReviewed: formData.get("checkStructureReviewed") === "on",
    sizingReviewed: formData.get("checkSizingReviewed") === "on",
    exitPlanReviewed: formData.get("checkExitPlanReviewed") === "on",
  };
}

export function checklistMarkedCount(state: EodReviewChecklistState): number {
  return [
    state.stopReviewed,
    state.structureReviewed,
    state.sizingReviewed,
    state.exitPlanReviewed,
  ].filter(Boolean).length;
}

/** Persist JSON only when at least one item checked; otherwise NULL in DB. */
export function serializeReviewChecklistForDb(
  state: EodReviewChecklistState
): string | null {
  if (checklistMarkedCount(state) === 0) return null;
  return JSON.stringify(state);
}
