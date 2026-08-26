import { describe, expect, it } from "vitest";
import { parsePositiveMoney } from "@/lib/trading-account-risk-config";
import { parseSettingsField, parseSettingsPositive } from "./parse-settings-field";

describe("parseSettingsField", () => {
  it("coi dấu chấm là dấu THẬP PHÂN — 0.75 là 0,75 phần trăm", () => {
    // Đây chính là lỗi đã xảy ra: bỏ dấu chấm theo thói quen vi-VN biến "0.75"
    // thành 75, và khối xem trước định cỡ nói dối gấp 100 lần.
    expect(parseSettingsField("0.75")).toBe(0.75);
    expect(parseSettingsField("1.5")).toBe(1.5);
  });

  it("coi dấu phẩy là phân cách nghìn", () => {
    expect(parseSettingsField("1,200,000,000")).toBe(1_200_000_000);
    expect(parseSettingsField("500,000")).toBe(500_000);
  });

  it("bỏ khoảng trắng thừa và trả null cho chuỗi rỗng", () => {
    expect(parseSettingsField("  12  ")).toBe(12);
    expect(parseSettingsField("")).toBeNull();
    expect(parseSettingsField("   ")).toBeNull();
  });

  it("trả null cho chuỗi không phải số", () => {
    expect(parseSettingsField("abc")).toBeNull();
    expect(parseSettingsField("12abc")).toBeNull();
  });
});

describe("parseSettingsPositive", () => {
  it("chỉ nhận số dương", () => {
    expect(parseSettingsPositive("1200000000")).toBe(1_200_000_000);
    expect(parseSettingsPositive("0")).toBeNull();
    expect(parseSettingsPositive("-5")).toBeNull();
  });
});

describe("khớp với bộ phân tích của server", () => {
  it("cho cùng kết quả với parsePositiveMoney trên mọi dạng đầu vào tiền", () => {
    // Khối xem trước và server action phải hiểu ô nhập giống hệt nhau, nếu không
    // con số người dùng thấy trước khi lưu sẽ khác con số thực sự được lưu.
    for (const raw of ["1200000000", "1,200,000,000", " 500000 ", "0", "-1", "", "abc", "12.5"]) {
      expect(parseSettingsPositive(raw), raw).toEqual(parsePositiveMoney(raw));
    }
  });
});
