import { describe, expect, it } from "vitest";
import {
  formatRelativeStrengthDiagnosticForUi,
  interpretRs20Spread,
  interpretRs50Spread,
  RS_DIAGNOSTIC_DISCLAIMER,
} from "./rs-diagnostic-format";
import type { RelativeStrengthDiagnostic } from "./relative-strength";

function sampleDiagnostic(overrides: Partial<RelativeStrengthDiagnostic> = {}): RelativeStrengthDiagnostic {
  return {
    asOfDate: "2026-05-25",
    returns: [
      {
        lookbackSessions: 20,
        asOfDate: "2026-05-25",
        stockReturnPct: 8,
        indexReturnPct: 2,
        rsSpreadPct: 6,
      },
      {
        lookbackSessions: 50,
        asOfDate: "2026-05-25",
        stockReturnPct: 15,
        indexReturnPct: 5,
        rsSpreadPct: 10,
      },
    ],
    stockAboveMa50: true,
    indexAboveMa50: false,
    stockLeadingMa50: true,
    dualUptrendMa50: false,
    ...overrides,
  };
}

describe("interpretRs20Spread", () => {
  it("positive spread uses outperforming copy", () => {
    expect(interpretRs20Spread(3.2)).toMatch(/vượt trội/i);
  });

  it("negative spread uses underperforming copy", () => {
    expect(interpretRs20Spread(-1.5)).toMatch(/kém hơn/i);
  });
});

describe("formatRelativeStrengthDiagnosticForUi", () => {
  it("includes disclaimer and RS20 line", () => {
    const ui = formatRelativeStrengthDiagnosticForUi(sampleDiagnostic());
    expect(ui.disclaimer).toBe(RS_DIAGNOSTIC_DISCLAIMER);
    expect(ui.rs20SpreadPct).toBe(6);
    expect(ui.lines.some((l) => l.startsWith("RS20:"))).toBe(true);
    expect(ui.lines.some((l) => /vượt trội/i.test(l))).toBe(true);
  });

  it("stockLeadingMa50 adds leadership line", () => {
    const ui = formatRelativeStrengthDiagnosticForUi(sampleDiagnostic());
    expect(ui.lines.some((l) => /Cổ phiếu trên MA50 trong khi VNINDEX thì không/i.test(l))).toBe(true);
  });

  it("negative RS20 renders underperforming copy", () => {
    const ui = formatRelativeStrengthDiagnosticForUi(
      sampleDiagnostic({
        returns: [
          {
            lookbackSessions: 20,
            asOfDate: "2026-05-25",
            stockReturnPct: 1,
            indexReturnPct: 4,
            rsSpreadPct: -3,
          },
        ],
        stockLeadingMa50: false,
      })
    );
    expect(ui.lines[0]).toMatch(/RS20:/);
    expect(ui.lines[0]).toMatch(/kém hơn/i);
    expect(interpretRs50Spread(-3)).toMatch(/kém hơn/i);
  });
});
