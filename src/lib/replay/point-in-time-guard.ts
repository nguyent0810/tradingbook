/**
 * Enforce, mechanically, that a replay decision at session T uses only data
 * available at T.
 *
 * A replay has two data channels and they must never be confused:
 *
 *   DECISION  — everything the strategy is allowed to see when deciding at T.
 *               Must be bounded by T. Any bar after T is look-ahead.
 *   OUTCOME   — bars after T, used solely to score what the decision produced.
 *               Legitimately future, and must never flow back into a decision.
 *
 * Look-ahead bugs live exactly at that boundary: an outcome bar that quietly
 * reaches a decision path looks like a brilliant strategy. So rather than trust
 * the call sites, the guard makes the boundary a checked runtime property —
 * every decision read is asserted, and every violation is recorded with the
 * offending date so a test can prove absence rather than assume it.
 */

export type DatedRow = { date: Date };

export type PointInTimeViolation = {
  channel: "decision";
  label: string;
  sessionDate: string;
  offendingDate: string;
  rowCount: number;
};

export function isoDay(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

export type PointInTimeGuard = {
  readonly sessionDate: string;
  /**
   * Gate a decision-channel read. Returns the rows unchanged when clean, records
   * a violation and throws when any row post-dates the session.
   */
  decisionRows<T extends DatedRow>(label: string, rows: readonly T[]): readonly T[];
  /** Gate a single decision-channel date (e.g. a regime session, a config asOf). */
  decisionDate(label: string, date: Date): Date;
  /**
   * Mark a read as outcome-channel. Not bounded — but it is counted, so a test
   * can assert which labels were allowed to see the future and catch a decision
   * path quietly relabelled to escape the check.
   */
  outcomeRows<T extends DatedRow>(label: string, rows: readonly T[]): readonly T[];
  readonly violations: readonly PointInTimeViolation[];
  readonly outcomeReads: readonly string[];
};

export class PointInTimeViolationError extends Error {
  constructor(readonly violation: PointInTimeViolation) {
    super(
      `Look-ahead in "${violation.label}": session ${violation.sessionDate} read a row dated ` +
        `${violation.offendingDate}. A decision at T may not see data after T.`
    );
    this.name = "PointInTimeViolationError";
  }
}

export function createPointInTimeGuard(
  sessionDate: Date | string,
  options?: { throwOnViolation?: boolean }
): PointInTimeGuard {
  const session = typeof sessionDate === "string" ? sessionDate.slice(0, 10) : isoDay(sessionDate);
  const throwOnViolation = options?.throwOnViolation ?? true;
  const violations: PointInTimeViolation[] = [];
  const outcomeReads: string[] = [];

  function record(label: string, offendingDate: string, rowCount: number): void {
    const v: PointInTimeViolation = {
      channel: "decision",
      label,
      sessionDate: session,
      offendingDate,
      rowCount,
    };
    violations.push(v);
    if (throwOnViolation) throw new PointInTimeViolationError(v);
  }

  return {
    sessionDate: session,
    decisionRows(label, rows) {
      for (const r of rows) {
        const d = isoDay(r.date);
        if (d > session) {
          record(label, d, rows.length);
          break;
        }
      }
      return rows;
    },
    decisionDate(label, date) {
      const d = isoDay(date);
      if (d > session) record(label, d, 1);
      return date;
    },
    outcomeRows(label, rows) {
      outcomeReads.push(label);
      return rows;
    },
    get violations() {
      return violations;
    },
    get outcomeReads() {
      return outcomeReads;
    },
  };
}

/**
 * Split a full history at the session boundary.
 *
 * Doing the split in one audited place keeps every call site from re-deriving
 * `<= T` and getting it subtly wrong — an off-by-one here is a silent
 * look-ahead, not a crash.
 */
export function splitAtSession<T extends DatedRow>(
  rows: readonly T[],
  sessionDate: Date | string
): { decision: T[]; outcome: T[] } {
  const session = typeof sessionDate === "string" ? sessionDate.slice(0, 10) : isoDay(sessionDate);
  const decision: T[] = [];
  const outcome: T[] = [];
  for (const r of rows) {
    if (isoDay(r.date) <= session) decision.push(r);
    else outcome.push(r);
  }
  return { decision, outcome };
}
