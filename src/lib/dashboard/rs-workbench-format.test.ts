import { describe, expect, it } from "vitest";
import {
  formatMa20DistPct,
  formatRiskReward,
  WORKBENCH_COLUMN_TOOLTIPS,
} from "./rs-workbench-format";

describe("rs-workbench-format", () => {
  it("formats R:R with :1 suffix", () => {
    expect(formatRiskReward(0.3)).toBe("0.30:1");
    expect(formatRiskReward(2.04)).toBe("2.04:1");
  });

  it("formats MA20 distance with sign", () => {
    expect(formatMa20DistPct(3.2)).toBe("+3.2%");
    expect(formatMa20DistPct(-1.5)).toBe("-1.5%");
  });

  it("exposes column tooltips for target and invalid", () => {
    expect(WORKBENCH_COLUMN_TOOLTIPS.target).toContain("R:R");
    expect(WORKBENCH_COLUMN_TOOLTIPS.invalid).toContain("hợp lệ");
  });
});
