/**
 * Prospective recorder — the safety layer between a settled session and the
 * append-only registry.
 *
 * Two properties are enforced here rather than asserted in prose:
 *
 *  1. LATE-RUN GUARD (plan §7). The recorder refuses to write an observation for
 *     session T if any bar dated after T already exists. A recorder run late
 *     enough to have seen the outcome is not a prospective observation, and no
 *     amount of care at the call site can make it one afterwards.
 *
 *  2. FAIL-OPEN (plan §6). Every entry point returns a result; none throws. A
 *     registry failure can therefore never fail a scan, which is the invariant any
 *     future inline wiring has to inherit.
 *
 * SHADOW ONLY. No production module imports this.
 */
import {
  PROSPECTIVE_START_EXCLUSIVE,
  SCHEMA_VERSION,
  isEligible,
  setupIdFor,
  type DecisionCandidate,
  type DecisionEntry,
} from "./registry-schema";

export type GuardRefusal =
  | "BEFORE_PROSPECTIVE_BOUNDARY"
  | "OUTCOME_DATA_ALREADY_EXISTS"
  | "STALE_INPUT_BARS";

export type GuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: GuardRefusal; readonly detail: string };

/**
 * The precondition, machine-checked.
 *
 * `maxBarDateInDb` is the newest bar date present anywhere in the price table at
 * the moment of the run. If it is after the session being recorded, the outcome
 * this observation is supposed to predict is already knowable, so the observation
 * is not prospective and is refused outright.
 */
export function guardSession(params: {
  readonly session: string;
  readonly maxBarDateInDb: string | null;
  readonly lastInputBarDate: string | null;
  readonly boundaryExclusive?: string;
}): GuardResult {
  const boundary = params.boundaryExclusive ?? PROSPECTIVE_START_EXCLUSIVE;

  if (!(params.session > boundary)) {
    return { ok: false, refusal: "BEFORE_PROSPECTIVE_BOUNDARY", detail: `${params.session} <= ${boundary}` };
  }
  if (params.maxBarDateInDb != null && params.maxBarDateInDb > params.session) {
    return { ok: false, refusal: "OUTCOME_DATA_ALREADY_EXISTS", detail: `bars exist through ${params.maxBarDateInDb} > ${params.session}` };
  }
  // The session must actually have settled: recording T from bars ending before T
  // would store features that are not the ones a decision at T would have used.
  if (params.lastInputBarDate == null || params.lastInputBarDate !== params.session) {
    return { ok: false, refusal: "STALE_INPUT_BARS", detail: `last input bar ${params.lastInputBarDate ?? "none"} != ${params.session}` };
  }
  return { ok: true };
}

/** Everything the recorder needs about one candidate, already computed from bars <= T. */
export type ObservationInput = Omit<
  DecisionEntry,
  "setupId" | "entryHash" | "seq" | "prevEntryHash" | "schemaVersion" | "eligible"
>;

/**
 * Build the row up to, but not including, the fields only the store may set.
 *
 * `setupId` and `eligible` are derived here and RE-derived by the store, so
 * neither this function nor a hand-written caller can flip a row's eligibility.
 * `seq`, `prevEntryHash` and `entryHash` are not set here at all: they depend on
 * what is already in the file, and letting a caller supply them would let a
 * forged row splice itself into the chain.
 */
export function buildDecisionEntry(input: ObservationInput): DecisionCandidate {
  return {
    ...input,
    setupId: setupIdFor(input.symbol, input.session),
    schemaVersion: SCHEMA_VERSION,
    eligible: isEligible(input.session, input.feasibility),
  };
}

export type SafeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/**
 * Fail-open wrapper. Any throw becomes a returned error, so registry work can
 * never propagate an exception into a caller that has real work to finish.
 */
export function runRecorderSafely<T>(fn: () => T): SafeResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
