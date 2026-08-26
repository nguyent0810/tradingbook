import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

const W = 40;
const H = 10;

describe("sparklinePath", () => {
  it("vẽ một đoạn liền cho chuỗi đủ dữ liệu", () => {
    const d = sparklinePath([1, 2, 3], W, H);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.startsWith("M0.0,")).toBe(true);
    expect(d).toContain(`L${W.toFixed(1)},`);
  });

  it("ngắt đường tại ô thiếu dữ liệu thay vì dồn chỉ số", () => {
    const withGap = sparklinePath([1, 2, null, 4, 5], W, H);
    // Hai đoạn rời → hai lệnh M.
    expect(withGap.match(/M/g)).toHaveLength(2);

    // Và phải khác hẳn chuỗi 4 điểm liền — nếu dồn chỉ số thì hai chuỗi này
    // sẽ vẽ giống nhau, đúng thứ quy ước gap cấm.
    expect(withGap).not.toBe(sparklinePath([1, 2, 4, 5], W, H));
  });

  it("giữ đúng vị trí phiên hai bên khoảng trống", () => {
    // 5 phiên, thiếu phiên thứ 3 (index 2).
    const d = sparklinePath([1, 1, null, 1, 1], W, H);
    // Đoạn 1: phiên 0 → 1 (x 0 → 10). Đoạn 2: phiên 3 → 4 (x 30 → 40).
    // Nếu dồn chỉ số, đoạn 2 sẽ bắt đầu ở x ≈ 26,7 chứ không phải 30.
    expect(d).toBe("M0.0,9.0 L10.0,9.0 M30.0,9.0 L40.0,9.0");
  });

  it("phân biệt 0 thật với thiếu dữ liệu", () => {
    expect(sparklinePath([0, 0, 0], W, H).match(/M/g)).toHaveLength(1);
    expect(sparklinePath([0, null, 0], W, H)).toBe("");
  });

  it("bỏ đoạn chỉ có một điểm (không vẽ được đường)", () => {
    expect(sparklinePath([1, null, 2], W, H)).toBe("");
    expect(sparklinePath([1, 2, null, 3], W, H).match(/M/g)).toHaveLength(1);
  });

  it("trả chuỗi rỗng khi không đủ dữ liệu", () => {
    expect(sparklinePath([], W, H)).toBe("");
    expect(sparklinePath([5], W, H)).toBe("");
    expect(sparklinePath([null, undefined, Number.NaN], W, H)).toBe("");
  });

  it("chuỗi đi ngang vẫn vẽ được (range 0 không chia cho 0)", () => {
    const d = sparklinePath([7, 7, 7], W, H);
    expect(d).not.toBe("");
    expect(d).not.toContain("NaN");
  });
});
