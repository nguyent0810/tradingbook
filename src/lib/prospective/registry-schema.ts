/**
 * Prospective feasibility shadow registry — frozen schema and constants.
 *
 * Everything in this file was fixed in PROSPECTIVE-REGISTRY-PLAN.md at `1c5f198`
 * BEFORE any prospective observation existed. Changing a value here is not a
 * refactor: it invalidates the cohort and requires a new `SCHEMA_VERSION`.
 *
 * SHADOW ONLY. No production module imports this.
 */
import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "prospective-registry@1.0.0";
export const OUTCOME_VERSION = "outcomes@1.0.0";

/**
 * Immutable prospective boundary. The last settled session at freeze time was
 * 2026-08-21 and the freeze happened on 2026-08-24, so excluding 2026-08-24
 * itself guarantees no session observable before or during the freeze can enter.
 */
export const PROSPECTIVE_START_EXCLUSIVE = "2026-08-24";

/**
 * Classifier pinned by CONTENT, not by commit. A working tree can differ from a
 * commit label; a blob hash cannot. Verified at write time — a mismatch refuses
 * the write rather than silently mixing classifier versions.
 *
 * This is the TRANSITIVE CLOSURE of the four classifier entry points, not just
 * the entry points themselves. Pinning only the four would have left every
 * threshold they import unpinned — `GATE2_VOL_RATIO_A`, `GATE2_MIN_RISK_TO_STOP_FRAC`,
 * `TRADABILITY_MIN_AVG_VALUE_VND_20`, the tick table — so a one-character edit to
 * a constants file could have changed verdicts with the pin still reporting OK.
 * `CLASSIFIER_PIN_ROOTS` and the test that recomputes the closure keep this set
 * honest as imports change.
 */
export const CLASSIFIER_PIN_ROOTS: readonly string[] = [
  "src/lib/decisions/d2-feasibility.ts",
  "src/lib/decisions/contracts.ts",
  "src/lib/scanner/stop-feasibility.ts",
  "src/lib/scanner/gate2/breakout-pullback.ts",
];
export const CLASSIFIER_BLOBS: Readonly<Record<string, string>> = {
  "src/lib/decisions/contracts.ts": "6b9a69d0add2aa081a97840e57e6e2bea634ba8f",
  "src/lib/decisions/d2-feasibility.ts": "965d8ebe5dbf1b122e6d2d0ef14d09bc445ff998",
  "src/lib/playbook/indicators.ts": "11c8cf3d2703c3ae0e2fdc1df9faf6ca2e01231c",
  "src/lib/scanner/gate2/breakout-pullback.ts": "f1c87dd188e35760b2722b272dd09c4ef1d427cc",
  "src/lib/scanner/gate2/constants.ts": "098ad6a2a14c47c53c0b81b4baa917669da1828e",
  "src/lib/scanner/gate2/gate2-eval-params.ts": "6f0f9511d9d7018c219719b349f2924d5d1ab472",
  "src/lib/scanner/gate2/rank-components.ts": "7112102351fffd263e8c748aa58a18dd908121ed",
  "src/lib/scanner/gate2/rejection-codes.ts": "20c12514b4989e87af452a7c33f689052464a412",
  "src/lib/scanner/gate2/types.ts": "4c8f3a5c5f52f9a9cc1ebe0cdda151fbc8aac903",
  "src/lib/scanner/stop-feasibility.ts": "cfc8adb4a6be756dabccf6350e42a50edfe3d83b",
  "src/lib/scanner/tradability-constants.ts": "e03f95090b74b5125baebcfaaf35ce81ffb02db6",
  "src/lib/setup-health/evaluate-watch-health.ts": "95ac7c221cdd302ce8672e6dd8fd2b0615766abf",
  "src/lib/setup-health/types.ts": "186891d8dd07177cdc09b0359e8882c65ff91bf5",
};
export const CLASSIFIER_COMMIT = "2c9b418";

/** Frozen evaluation checkpoints. Never lowered after seeing results. */
export const CHECKPOINTS: readonly number[] = [100, 250, 500];

/**
 * Outcome horizon. MFE/MAE/stop-first share it, matching the primary endpoint.
 * T+1 is the first settled session after the decision: entry is its open and
 * `fwd1` is its close, the convention every prior phase used.
 */
export const OUTCOME_HORIZON_SESSIONS = 5;

/** Below this many blocks the interval is indicative and carries no weight. */
export const MIN_BOOTSTRAP_BLOCKS = 10;
export const BOOTSTRAP_BLOCK_SESSIONS = 30;

// ---------------------------------------------------------------- decision row

export type FeasibilityVerdictRecorded =
  | "FEASIBLE" | "NOT_FEASIBLE_NOISE" | "NOT_FEASIBLE_LIQUIDITY" | "UNKNOWN_INPUT";

export type DecisionEntry = {
  // identity
  readonly setupId: string;
  readonly symbol: string;
  readonly session: string;
  readonly decisionRecordedAt: string;
  readonly sourceDataCutoff: string;
  readonly codeSha: string;
  readonly classifierBlobs: Readonly<Record<string, string>>;
  readonly schemaVersion: string;

  // classifier inputs — sufficient to reproduce the feasibility decision
  readonly entryPriceKVnd: number;
  readonly structuralStopKVnd: number;
  readonly riskFrac: number | null;
  readonly atrKVnd: number | null;
  readonly board: "HOSE" | "HNX" | "UPCOM";
  readonly avgDailyValueVnd: number | null;
  readonly minStopFrac: number | null;
  readonly bindingFloor: string;

  // decisions
  readonly v1Visibility: "SHOWN" | "HIDDEN";
  readonly feasibility: FeasibilityVerdictRecorded;
  readonly feasibilityReasons: readonly string[];
  readonly gate1Level: "PASS" | "WARNING" | "FAIL";
  readonly quality: "A" | "B";
  readonly validity: "VALID";
  readonly eligible: boolean;

  // geometry — OBSERVATIONAL ONLY, never classifier inputs
  readonly breakoutLevelKVnd: number;
  readonly stopDistancePct: number;
  readonly ma20DistPct: number | null;
  readonly ma50DistPct: number | null;
  readonly volRatioMedian: number | null;
  readonly volRatioMean: number | null;

  // integrity
  readonly lastInputBarDate: string;
  readonly inputBarCount: number;
  /** Position in the append-only file. Set by the store, never by a caller. */
  readonly seq: number;
  /** `entryHash` of the preceding row, or GENESIS for the first. */
  readonly prevEntryHash: string;
  readonly entryHash: string;
};

/** Chain anchor. A first row claiming any other predecessor fails verification. */
export const GENESIS_HASH = "GENESIS";

/** A finished row minus the fields only the store may set. */
export type DecisionCandidate = Omit<DecisionEntry, "seq" | "prevEntryHash" | "entryHash">;
export type OutcomeCandidate = Omit<OutcomeEntry, "seq" | "prevEntryHash" | "entryHash">;

export type OutcomeEntry = {
  readonly setupId: string;
  readonly seq: number;
  readonly prevEntryHash: string;
  readonly entryHash: string;
  readonly outcomeVersion: string;
  readonly outcomeRecordedAt: string;
  readonly entryOpenKVnd: number;
  readonly fwd1: number | null;
  readonly fwd3: number | null;
  readonly fwd5: number | null;
  readonly win5: boolean | null;
  readonly mfe5: number | null;
  readonly mae5: number | null;
  readonly stopFirst: boolean | null;
  readonly barDatesUsed: readonly string[];
};

/** Deterministic id, so a duplicate write is detectable rather than silent. */
export function setupIdFor(symbol: string, session: string): string {
  return createHash("sha256").update(`${symbol}|${session}|${SCHEMA_VERSION}`).digest("hex").slice(0, 32);
}

/**
 * Hash over every field except the hash itself — including `seq` and
 * `prevEntryHash`, which is what makes the file a CHAIN rather than a bag of
 * independently-valid rows.
 *
 * A per-row hash alone cannot see a deleted or reordered row: each survivor still
 * verifies against itself. Chaining makes deletion, truncation and reordering
 * detectable, because every later row commits to the one before it.
 */
export function hashEntry(e: Record<string, unknown>): string {
  const ordered = Object.keys(e).sort().map((k) => [k, e[k]]);
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}

/** @deprecated name kept for readability at call sites that hash a decision row. */
export const hashDecisionEntry = hashEntry;

/** The frozen eligibility rule. Both halves must hold. */
export function isEligible(session: string, verdict: FeasibilityVerdictRecorded): boolean {
  return session > PROSPECTIVE_START_EXCLUSIVE
    && (verdict === "FEASIBLE" || verdict === "NOT_FEASIBLE_NOISE");
}
