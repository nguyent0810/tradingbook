import { describe, expect, it } from "vitest";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";

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
