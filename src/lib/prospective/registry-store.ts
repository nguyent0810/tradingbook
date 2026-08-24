/**
 * Append-only store for the prospective registry.
 *
 * The immutability guarantee (§4) is STRUCTURAL, not procedural, on three levels:
 *
 *  - decisions and outcomes live in two different files, and nothing here ever
 *    opens the decisions file for anything but `appendFile`, so the outcome
 *    process has no code path that could touch a decision-time value;
 *  - every row carries `seq` and `prevEntryHash`, so the file is a hash CHAIN.
 *    A per-row hash alone cannot notice a deleted or reordered row — each
 *    survivor still verifies against itself. A chain can;
 *  - the store, not the caller, sets `setupId`, `eligible`, `seq`,
 *    `prevEntryHash` and `entryHash`, so a hand-written row cannot claim
 *    eligibility it does not have.
 *
 * SHADOW ONLY. No production module imports this.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import {
  CLASSIFIER_BLOBS,
  GENESIS_HASH,
  hashEntry,
  isEligible,
  setupIdFor,
  type DecisionCandidate,
  type DecisionEntry,
  type OutcomeCandidate,
  type OutcomeEntry,
} from "./registry-schema";

export const DEFAULT_DIR = "docs/trading/replay/prospective";
export const decisionsPath = (dir = DEFAULT_DIR) => `${dir}/decisions.ndjson`;
export const outcomesPath = (dir = DEFAULT_DIR) => `${dir}/outcomes.ndjson`;
const lockPath = (dir = DEFAULT_DIR) => `${dir}/.registry.lock`;

/**
 * A crash between `write` and `\n` leaves a truncated final line. Parsing must
 * survive that: if a bad line threw, one interrupted run would make every later
 * read — and therefore every later append and every integrity check — fail
 * permanently. Bad lines are surfaced instead, and the file is never repaired
 * here, because repairing means rewriting, which this module must not do.
 */
function readNdjson<T>(path: string): { rows: T[]; malformed: number[] } {
  if (!existsSync(path)) return { rows: [], malformed: [] };
  const raw = readFileSync(path, "utf-8");
  if (!raw.trim()) return { rows: [], malformed: [] };
  const rows: T[] = [];
  const malformed: number[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try { rows.push(JSON.parse(line) as T); } catch { malformed.push(i + 1); }
  });
  return { rows, malformed };
}

export const readDecisions = (dir = DEFAULT_DIR): DecisionEntry[] => readNdjson<DecisionEntry>(decisionsPath(dir)).rows;
export const readOutcomes = (dir = DEFAULT_DIR): OutcomeEntry[] => readNdjson<OutcomeEntry>(outcomesPath(dir)).rows;

export type WriteRefusal =
  | "DUPLICATE_SETUP_ID"
  | "CLASSIFIER_BLOB_MISMATCH"
  | "OUTCOME_ALREADY_EXISTS"
  | "NO_DECISION_FOR_OUTCOME"
  | "TRAILING_PARTIAL_LINE"
  | "MALFORMED_EXISTING_ROWS"
  | "REGISTRY_LOCKED"
  | "WRITE_FAILED";

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: WriteRefusal; readonly detail: string };

/**
 * Verify the classifier is byte-identical to what the plan pinned. A working tree
 * can differ from a commit label; a blob hash cannot.
 *
 * Uses git's blob format (`blob <len>\0<content>`) so the value matches
 * `git hash-object` exactly.
 */
export function verifyClassifierBlobs(
  hashFile: (path: string) => string,
): { ok: true } | { ok: false; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const [path, expected] of Object.entries(CLASSIFIER_BLOBS)) {
    let actual: string;
    try {
      actual = hashFile(path);
    } catch {
      mismatches.push(`${path}: unreadable`);
      continue;
    }
    if (actual !== expected) mismatches.push(`${path}: ${actual} != ${expected}`);
  }
  return mismatches.length ? { ok: false, mismatches } : { ok: true };
}

/**
 * Exclusive lock around the read-then-append sequence. Without it, two recorder
 * runs can each read "not present" before either appends, and both write. The
 * verifier would catch the duplicate afterwards, but a registry that can be
 * corrupted and then diagnosed is weaker than one that refuses.
 *
 * `wx` fails if the file already exists, which is the atomic primitive this needs.
 */
function withLock(dir: string, fn: () => WriteResult): WriteResult {
  const path = lockPath(dir);
  let fd: number;
  try {
    mkdirSync(dirname(path), { recursive: true });
    fd = openSync(path, "wx");
  } catch {
    return { ok: false, refusal: "REGISTRY_LOCKED", detail: `${path} held by another run` };
  }
  try {
    return fn();
  } finally {
    try { closeSync(fd); rmSync(path, { force: true }); } catch { /* lock cleanup is best-effort */ }
  }
}

/**
 * Refuse to append onto an interrupted write. Appending after a truncated line
 * would splice two records into one unparseable row and lose them both; leaving
 * the file untouched keeps the damage to the single interrupted record and makes
 * it visible to the verifier.
 */
function unterminated(path: string): boolean {
  if (!existsSync(path)) return false;
  const raw = readFileSync(path, "utf-8");
  return raw.length > 0 && !raw.endsWith("\n");
}

/** The one place a row is finalised: chain fields and hash, computed here only. */
function seal<T extends Record<string, unknown>>(
  candidate: T,
  prior: { seq: number; entryHash: string } | undefined,
): T & { seq: number; prevEntryHash: string; entryHash: string } {
  const body = {
    ...candidate,
    seq: prior ? prior.seq + 1 : 0,
    prevEntryHash: prior ? prior.entryHash : GENESIS_HASH,
  };
  return { ...body, entryHash: hashEntry(body) };
}

/** Append one line, converting any filesystem failure into a returned refusal. */
function appendLine(path: string, row: unknown): WriteResult {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(row)}\n`, "utf-8");
    return { ok: true };
  } catch (e) {
    return { ok: false, refusal: "WRITE_FAILED", detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Append one decision. Refuses on a duplicate id — the registry never overwrites,
 * so a duplicate would create two conflicting decision-time records.
 *
 * `setupId` and `eligible` are RECOMPUTED here from the row's own symbol, session
 * and verdict. A caller cannot hand in a row that claims to be eligible when the
 * frozen rule says otherwise.
 */
export function appendDecision(candidate: DecisionCandidate, dir = DEFAULT_DIR): WriteResult {
  return withLock(dir, () => {
    const path = decisionsPath(dir);
    if (unterminated(path)) return { ok: false, refusal: "TRAILING_PARTIAL_LINE", detail: path };

    const file = readNdjson<DecisionEntry>(path);
    if (file.malformed.length) {
      return { ok: false, refusal: "MALFORMED_EXISTING_ROWS", detail: `lines ${file.malformed.join(",")}` };
    }
    const normalised: DecisionCandidate = {
      ...candidate,
      setupId: setupIdFor(candidate.symbol, candidate.session),
      eligible: isEligible(candidate.session, candidate.feasibility),
    };
    if (file.rows.some((d) => d.setupId === normalised.setupId)) {
      return { ok: false, refusal: "DUPLICATE_SETUP_ID", detail: normalised.setupId };
    }
    const prior = file.rows[file.rows.length - 1];
    return appendLine(path, seal(normalised as unknown as Record<string, unknown>, prior));
  });
}

/**
 * Append one outcome. Requires a decision to exist and refuses to append twice.
 * It cannot touch the decisions file: only `outcomesPath` is written here.
 */
export function appendOutcome(candidate: OutcomeCandidate, dir = DEFAULT_DIR): WriteResult {
  return withLock(dir, () => {
    const path = outcomesPath(dir);
    if (unterminated(path)) return { ok: false, refusal: "TRAILING_PARTIAL_LINE", detail: path };

    const decided = new Set(readDecisions(dir).map((d) => d.setupId));
    if (!decided.has(candidate.setupId)) {
      return { ok: false, refusal: "NO_DECISION_FOR_OUTCOME", detail: candidate.setupId };
    }
    const file = readNdjson<OutcomeEntry>(path);
    if (file.malformed.length) {
      return { ok: false, refusal: "MALFORMED_EXISTING_ROWS", detail: `lines ${file.malformed.join(",")}` };
    }
    if (file.rows.some((o) => o.setupId === candidate.setupId)) {
      return { ok: false, refusal: "OUTCOME_ALREADY_EXISTS", detail: candidate.setupId };
    }
    const prior = file.rows[file.rows.length - 1];
    return appendLine(path, seal(candidate as unknown as Record<string, unknown>, prior));
  });
}

export type IntegrityReport = {
  readonly decisions: number;
  readonly outcomes: number;
  readonly malformedLines: { file: string; line: number }[];
  readonly hashMismatches: string[];
  readonly chainBreaks: string[];
  readonly forgedEligibility: string[];
  readonly duplicateSetupIds: string[];
  readonly duplicateSymbolSessions: string[];
  readonly beforeBoundary: string[];
  readonly outcomesWithoutDecision: string[];
  readonly outcomesBeforeDecision: string[];
  readonly ok: boolean;
};

/** Recompute every row's hash and its link to the row before it. */
function checkChain(
  rows: readonly { seq: number; prevEntryHash: string; entryHash: string }[],
  label: string,
): { hashMismatches: string[]; chainBreaks: string[] } {
  const hashMismatches: string[] = [];
  const chainBreaks: string[] = [];
  rows.forEach((row, i) => {
    const { entryHash, ...body } = row;
    if (hashEntry(body as Record<string, unknown>) !== entryHash) hashMismatches.push(`${label}#${i}`);
    if (row.seq !== i) chainBreaks.push(`${label}#${i}: seq ${row.seq}`);
    const expectedPrev = i === 0 ? GENESIS_HASH : rows[i - 1]!.entryHash;
    if (row.prevEntryHash !== expectedPrev) chainBreaks.push(`${label}#${i}: broken link`);
  });
  return { hashMismatches, chainBreaks };
}

/**
 * Full integrity sweep. Recomputes every hash and every chain link, so a
 * post-hoc edit, a deleted row, a truncated tail and a reordering are all
 * detected — not merely an edit to a surviving row.
 */
export function verifyRegistry(dir = DEFAULT_DIR, boundaryExclusive: string): IntegrityReport {
  const decisionFile = readNdjson<DecisionEntry>(decisionsPath(dir));
  const outcomeFile = readNdjson<OutcomeEntry>(outcomesPath(dir));
  const decisions = decisionFile.rows;
  const outcomes = outcomeFile.rows;
  const malformedLines = [
    ...decisionFile.malformed.map((line) => ({ file: decisionsPath(dir), line })),
    ...outcomeFile.malformed.map((line) => ({ file: outcomesPath(dir), line })),
  ];

  const dChain = checkChain(decisions, "decision");
  const oChain = checkChain(outcomes, "outcome");

  const forgedEligibility: string[] = [];
  const seenIds = new Set<string>();
  const duplicateSetupIds: string[] = [];
  const seenKey = new Set<string>();
  const duplicateSymbolSessions: string[] = [];
  const beforeBoundary: string[] = [];

  for (const d of decisions) {
    // The frozen rules, re-derived rather than trusted.
    if (d.eligible !== isEligible(d.session, d.feasibility)) forgedEligibility.push(d.setupId);
    if (d.setupId !== setupIdFor(d.symbol, d.session)) forgedEligibility.push(`${d.setupId} (id)`);

    if (seenIds.has(d.setupId)) duplicateSetupIds.push(d.setupId);
    seenIds.add(d.setupId);
    const k = `${d.symbol}|${d.session}`;
    if (seenKey.has(k)) duplicateSymbolSessions.push(k);
    seenKey.add(k);
    if (!(d.session > boundaryExclusive)) beforeBoundary.push(`${d.setupId} ${d.session}`);
  }

  const byId = new Map(decisions.map((d) => [d.setupId, d]));
  const outcomesWithoutDecision: string[] = [];
  const outcomesBeforeDecision: string[] = [];
  for (const o of outcomes) {
    const d = byId.get(o.setupId);
    if (!d) { outcomesWithoutDecision.push(o.setupId); continue; }
    // every bar used for an outcome must be dated strictly after the decision
    if (o.barDatesUsed.some((b) => b <= d.session)) outcomesBeforeDecision.push(o.setupId);
    if (o.outcomeRecordedAt < d.decisionRecordedAt) outcomesBeforeDecision.push(o.setupId);
  }

  const hashMismatches = [...dChain.hashMismatches, ...oChain.hashMismatches];
  const chainBreaks = [...dChain.chainBreaks, ...oChain.chainBreaks];

  return {
    decisions: decisions.length,
    outcomes: outcomes.length,
    malformedLines,
    hashMismatches,
    chainBreaks,
    forgedEligibility,
    duplicateSetupIds,
    duplicateSymbolSessions,
    beforeBoundary,
    outcomesWithoutDecision,
    outcomesBeforeDecision,
    ok:
      malformedLines.length === 0 &&
      hashMismatches.length === 0 &&
      chainBreaks.length === 0 &&
      forgedEligibility.length === 0 &&
      duplicateSetupIds.length === 0 &&
      duplicateSymbolSessions.length === 0 &&
      beforeBoundary.length === 0 &&
      outcomesWithoutDecision.length === 0 &&
      outcomesBeforeDecision.length === 0,
  };
}
