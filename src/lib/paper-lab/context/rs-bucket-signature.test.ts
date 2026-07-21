import { describe, expect, it } from "vitest";
import { classifyRsBucketForSignature } from "./build-market-context-bundle";
import { extractRs20SpreadPct } from "@/lib/scanner/gate2/rs-rank-term";
import type { RelativeStrengthDiagnostic } from "@/lib/scanner/gate2/relative-strength";

function diagnosticWith(returns: RelativeStrengthDiagnostic["returns"]): RelativeStrengthDiagnostic {
  return {
    asOfDate: "2026-05-14",
    returns,
    stockAboveMa50: null,
    indexAboveMa50: null,
    stockLeadingMa50: null,
    dualUptrendMa50: null,
  };
}

describe("classifyRsBucketForSignature", () => {
  it("is neutral when RS20 is unavailable", () => {
    expect(classifyRsBucketForSignature(null)).toBe("neutral");
  });
  it("is strong above the threshold", () => {
    expect(classifyRsBucketForSignature(2.01)).toBe("strong");
  });
  it("is weak below the negative threshold", () => {
    expect(classifyRsBucketForSignature(-2.01)).toBe("weak");
  });
  it("is neutral within the threshold band", () => {
    expect(classifyRsBucketForSignature(1)).toBe("neutral");
  });
});

describe("extractRs20SpreadPct + classifyRsBucketForSignature (regression: returns[0] indexing bug)", () => {
  it("does not mistake an RS50-only diagnostic for RS20 when RS20 is missing", () => {
    // Only the 50-session return is present (e.g. after a holiday gap drops the
    // 20-session anchor bar). `returns[0]` here is r50, not r20 — the bug used
    // to compare this r50 value against the RS20 threshold.
    const rs = diagnosticWith([
      { lookbackSessions: 50, asOfDate: "2026-05-14", stockReturnPct: 20, indexReturnPct: 10, rsSpreadPct: 10 },
    ]);

    const rs20 = extractRs20SpreadPct(rs);
    expect(rs20).toBeNull();
    expect(classifyRsBucketForSignature(rs20)).toBe("neutral");
  });

  it("uses the RS20 row even when it is not first in the returns array", () => {
    const rs = diagnosticWith([
      { lookbackSessions: 50, asOfDate: "2026-05-14", stockReturnPct: -20, indexReturnPct: -5, rsSpreadPct: -15 },
      { lookbackSessions: 20, asOfDate: "2026-05-14", stockReturnPct: 5, indexReturnPct: 1, rsSpreadPct: 4 },
    ]);

    const rs20 = extractRs20SpreadPct(rs);
    expect(rs20).toBe(4);
    expect(classifyRsBucketForSignature(rs20)).toBe("strong");
  });
});
