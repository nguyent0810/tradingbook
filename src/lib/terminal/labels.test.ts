import { describe, expect, it } from "vitest";
import { dataFreshness } from "./labels";

describe("độ tươi dữ liệu — ba trạng thái", () => {
  it("khớp phiên ⇒ TRỰC TIẾP, có đèn", () => {
    expect(dataFreshness(true)).toMatchObject({ label: "TRỰC TIẾP", led: true });
  });

  it("biết chắc lệch phiên ⇒ DỮ LIỆU CŨ", () => {
    expect(dataFreshness(false)).toMatchObject({ label: "DỮ LIỆU CŨ", led: false });
  });

  it("CHƯA BIẾT ⇒ gap trung tính, KHÔNG nói là dữ liệu cũ", () => {
    // Thiếu mốc phiên hoặc đọc lỗi thì không đo được gì — khẳng định "cũ" ở đây
    // là nói thay dữ liệu, đúng lớp lỗi mà cả gate này đang chống.
    const f = dataFreshness(null);
    expect(f.label).not.toContain("CŨ");
    expect(f.label).not.toContain("TRỰC TIẾP");
    expect(f.color).toBe("var(--tm-text-faint)");
    expect(f.led).toBe(false);
    expect(f.title).toBeTruthy();
  });
});
