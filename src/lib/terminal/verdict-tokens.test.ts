import { describe, expect, it } from "vitest";
import { applyVerdictToShares, gate1Color, gate1Label, verdictTokens } from "./verdict-tokens";

describe("verdictTokens", () => {
  it("gắn màu theo quy ước: NO_TRADE đỏ · PROBE amber · TRADE xanh", () => {
    expect(verdictTokens("NO_TRADE").color).toBe("var(--tm-down)");
    expect(verdictTokens("PROBE").color).toBe("var(--tm-accent)");
    expect(verdictTokens("TRADE").color).toBe("var(--tm-up)");
  });

  it("phân bổ khối lượng 0% / 30% / 100%", () => {
    expect(verdictTokens("NO_TRADE").sizeMultiplier).toBe(0);
    expect(verdictTokens("PROBE").sizeMultiplier).toBe(0.3);
    expect(verdictTokens("TRADE").sizeMultiplier).toBe(1);
  });

  it("rơi về PROBE khi mức không hợp lệ", () => {
    expect(verdictTokens("KHÔNG_TỒN_TẠI" as never).level).toBe("PROBE");
  });
});

describe("applyVerdictToShares", () => {
  it("NO_TRADE chặn toàn bộ khối lượng", () => {
    const r = applyVerdictToShares(8600, "NO_TRADE");
    expect(r.shares).toBe(0);
    expect(r.removedShares).toBe(8600);
  });

  it("PROBE giảm còn 30%, làm tròn xuống lô 100", () => {
    const r = applyVerdictToShares(8600, "PROBE");
    expect(r.shares).toBe(2500); // 2580 → lô chẵn 2500
    expect(r.removedShares).toBe(6100);
  });

  it("TRADE giữ khối lượng chuẩn, vẫn về lô chẵn", () => {
    expect(applyVerdictToShares(8600, "TRADE").shares).toBe(8600);
    expect(applyVerdictToShares(8650, "TRADE").shares).toBe(8600);
  });

  it("không bao giờ vượt khối lượng chuẩn", () => {
    const r = applyVerdictToShares(50, "TRADE");
    expect(r.shares).toBe(0);
    expect(r.shares).toBeLessThanOrEqual(r.baseShares);
  });

  it("chịu được đầu vào rác", () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = applyVerdictToShares(bad, "TRADE");
      expect(r.shares).toBe(0);
      expect(r.baseShares).toBe(0);
      expect(r.removedShares).toBe(0);
    }
  });
});

describe("Gate 1", () => {
  it("ĐẠT xanh · CẢNH BÁO amber · FAIL đỏ", () => {
    expect(gate1Label("PASS")).toBe("ĐẠT");
    expect(gate1Label("WARNING")).toBe("CẢNH BÁO");
    expect(gate1Label("FAIL")).toBe("FAIL");
    expect(gate1Color("PASS")).toBe("var(--tm-up)");
    expect(gate1Color("WARNING")).toBe("var(--tm-accent)");
    expect(gate1Color("FAIL")).toBe("var(--tm-down)");
  });
});
