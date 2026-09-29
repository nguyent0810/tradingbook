import { describe, expect, it } from "vitest";
import { worstCaseRiskPerShare } from "./worst-case-risk";

describe("worstCaseRiskPerShare", () => {
  it("HOSE worked example: entry 20.20, stop 18.60", () => {
    // gross = 20.20 − 18.60 = 1.60
    // net   = 1.60 + 20.20 × 0.0015 (buy brokerage) + 18.60 × 0.0025 (sell brokerage + tax)
    //       = 1.60 + 0.0303 + 0.0465 = 1.6768
    // gap   = 18.60 × 7% = 1.302 (one HOSE band below the stop)
    // worst = 1.6768 + 1.302 = 2.9788 kVND per share
    const r = worstCaseRiskPerShare({ entryKvnd: 20.2, stopKvnd: 18.6, exchange: "HOSE" });
    expect(r.perShareGrossKvnd).toBeCloseTo(1.6, 9);
    expect(r.perShareNetKvnd).toBeCloseTo(1.6768, 9);
    expect(r.gapBufferKvnd).toBeCloseTo(1.302, 9);
    expect(r.worstCasePerShareKvnd).toBeCloseTo(2.9788, 9);
  });

  it("uses the exchange's own band for the gap: HNX 10%, UPCOM 15%", () => {
    // HNX: 18.60 × 10% = 1.86 → 1.6768 + 1.86 = 3.5368
    expect(
      worstCaseRiskPerShare({ entryKvnd: 20.2, stopKvnd: 18.6, exchange: "HNX" }).worstCasePerShareKvnd
    ).toBeCloseTo(3.5368, 9);
    // UPCOM: 18.60 × 15% = 2.79 → 1.6768 + 2.79 = 4.4668
    expect(
      worstCaseRiskPerShare({ entryKvnd: 20.2, stopKvnd: 18.6, exchange: "UPCOM" }).worstCasePerShareKvnd
    ).toBeCloseTo(4.4668, 9);
  });

  it("a better fill lowers the worst case: entry 19.60, stop 18.60 on HOSE", () => {
    // gross 1.00; net 1.00 + 19.60 × 0.0015 + 18.60 × 0.0025 = 1.00 + 0.0294 + 0.0465 = 1.0759
    // worst = 1.0759 + 1.302 = 2.3779
    expect(
      worstCaseRiskPerShare({ entryKvnd: 19.6, stopKvnd: 18.6, exchange: "HOSE" }).worstCasePerShareKvnd
    ).toBeCloseTo(2.3779, 9);
  });
});
