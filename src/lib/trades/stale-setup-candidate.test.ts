import { describe, expect, it } from "vitest";
import {
  resolveStaleSetupCandidateNotice,
  scanRunIdPrefix,
} from "@/lib/trades/stale-setup-candidate";

describe("resolveStaleSetupCandidateNotice", () => {
  it("returns none when no candidate scan run", () => {
    expect(
      resolveStaleSetupCandidateNotice({
        candidateScanRunId: null,
        latestScanRunId: "latest1",
      })
    ).toEqual({ kind: "none" });
  });

  it("returns none when candidate matches latest", () => {
    expect(
      resolveStaleSetupCandidateNotice({
        candidateScanRunId: "run-a",
        latestScanRunId: "run-a",
      })
    ).toEqual({ kind: "none" });
  });

  it("returns stale when scan runs differ", () => {
    expect(
      resolveStaleSetupCandidateNotice({
        candidateScanRunId: "old-run",
        latestScanRunId: "new-run",
      })
    ).toEqual({
      kind: "stale",
      candidateScanRunId: "old-run",
      latestScanRunId: "new-run",
    });
  });

  it("returns lookup_unavailable when latest lookup failed", () => {
    expect(
      resolveStaleSetupCandidateNotice({
        candidateScanRunId: "old-run",
        latestScanRunId: "new-run",
        latestScanLookupFailed: true,
      })
    ).toEqual({ kind: "lookup_unavailable" });
  });

  it("returns lookup_unavailable when latest id is missing", () => {
    expect(
      resolveStaleSetupCandidateNotice({
        candidateScanRunId: "old-run",
        latestScanRunId: null,
      })
    ).toEqual({ kind: "lookup_unavailable" });
  });
});

describe("scanRunIdPrefix", () => {
  it("truncates long ids", () => {
    expect(scanRunIdPrefix("cmpku2jyq000004l42cv873wq")).toBe("cmpku2jyq000…");
  });
});
