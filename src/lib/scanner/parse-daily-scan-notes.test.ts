import { describe, expect, it } from "vitest";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";

describe("parseDailyScanGate2Notes sessionCoverage", () => {
  it("parses session coverage and treats weak coverage as signal-bearing", () => {
    const notes = parseDailyScanGate2Notes({
      sessionCoverage: {
        expectedSessionDate: "2026-05-25",
        universeScanned: 300,
        tradabilityEvaluated: 300,
        tradabilityPassed: 34,
        staleSessionCount: 121,
        staleSessionFrac: 121 / 300,
        sessionAlignedCount: 179,
        sessionAlignedFrac: 179 / 300,
        weakCoverage: true,
        headline: "Weak session coverage — 40% stale (121/300)",
        operatorWarning:
          "Data coverage is weak for the expected session. Scanner result may be incomplete because many symbols are stale.",
      },
    });
    expect(notes).not.toBeNull();
    expect(notes?.sessionCoverage?.weakCoverage).toBe(true);
    expect(notes?.sessionCoverage?.staleSessionCount).toBe(121);
    expect(notes?.sessionCoverage?.operatorWarning).toMatch(/weak for the expected session/i);
  });
});

describe("parseDailyScanGate2Notes benchmarkBackdrop", () => {
  it("parses delayed backdrop and treats it as signal-bearing", () => {
    const notes = parseDailyScanGate2Notes({
      benchmarkBackdrop: {
        vnindexSessionDate: "2026-05-06",
        equityBarsMaxDate: "2026-05-11",
        delayedBackdrop: true,
      },
    });
    expect(notes).not.toBeNull();
    expect(notes?.benchmarkBackdrop?.delayedBackdrop).toBe(true);
    expect(notes?.benchmarkBackdrop?.vnindexSessionDate).toBe("2026-05-06");
    expect(notes?.benchmarkBackdrop?.equityBarsMaxDate).toBe("2026-05-11");
  });
});
