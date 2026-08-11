import { describe, expect, it } from "vitest";
import {
  decideScanIdempotency,
  resolveScanForceRerun,
  type ExistingScanRun,
} from "./scan-idempotency";

const SESSION = new Date(Date.UTC(2026, 7, 10)); // 2026-08-10

function run(over: Partial<ExistingScanRun> = {}): ExistingScanRun {
  return {
    id: "run-1",
    status: "COMPLETED",
    expectedSessionDate: new Date(Date.UTC(2026, 7, 10)),
    ...over,
  } as ExistingScanRun;
}

describe("decideScanIdempotency", () => {
  it("skips when the session already completed", () => {
    const d = decideScanIdempotency({ expectedSession: SESSION, priorRuns: [run()] });
    expect(d.proceed).toBe(false);
    expect(d).toMatchObject({ reason: "already_completed", existingRunId: "run-1" });
  });

  it("proceeds when there is no prior run at all", () => {
    const d = decideScanIdempotency({ expectedSession: SESSION, priorRuns: [] });
    expect(d).toEqual({ proceed: true, reason: "no_prior_completed_run" });
  });

  it("proceeds when the prior run for this session FAILED — the backup trigger exists for exactly this", () => {
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run({ status: "FAILED" })],
    });
    expect(d.proceed).toBe(true);
  });

  it("proceeds when the only completed run is for a different session", () => {
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run({ expectedSessionDate: new Date(Date.UTC(2026, 7, 7)) })],
    });
    expect(d.proceed).toBe(true);
  });

  it("ignores legacy rows with a null session rather than blocking on them", () => {
    // Pre-migration rows have no session date; treating them as a match would
    // wrongly suppress every scan.
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run({ expectedSessionDate: null })],
    });
    expect(d.proceed).toBe(true);
  });

  it("matches on UTC calendar day, not on exact timestamp", () => {
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run({ expectedSessionDate: new Date(Date.UTC(2026, 7, 10, 23, 59, 59)) })],
    });
    expect(d.proceed).toBe(false);
  });

  it("force overrides an already-completed session", () => {
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run()],
      force: true,
    });
    expect(d).toEqual({ proceed: true, reason: "forced" });
  });

  it("picks the completed run even when a failed run for the same session comes first", () => {
    const d = decideScanIdempotency({
      expectedSession: SESSION,
      priorRuns: [run({ id: "failed", status: "FAILED" }), run({ id: "ok" })],
    });
    expect(d).toMatchObject({ proceed: false, existingRunId: "ok" });
  });
});

describe("resolveScanForceRerun", () => {
  it.each(["1", "true", "TRUE", "yes", " Yes "])("treats %j as force", (v) => {
    expect(resolveScanForceRerun(v)).toBe(true);
  });
  it.each([undefined, "", "0", "false", "no", "maybe"])("treats %j as not force", (v) => {
    expect(resolveScanForceRerun(v)).toBe(false);
  });
});
