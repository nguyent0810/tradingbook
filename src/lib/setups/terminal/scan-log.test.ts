import { describe, expect, it } from "vitest";
import { buildScanLog, type ScanLogInput } from "./scan-log";

function input(over: Partial<ScanLogInput> = {}): ScanLogInput {
  return {
    runAt: new Date("2026-08-25T02:15:02.000Z"),
    startedAt: new Date("2026-08-25T02:15:02.000Z"),
    finishedAt: new Date("2026-08-25T02:15:31.400Z"),
    expectedSessionDate: new Date("2026-08-25T00:00:00.000Z"),
    status: "COMPLETED",
    gate1Level: "WARNING",
    symbolCountTotal: 1605,
    symbolCountScanned: 1240,
    symbolCountFailed: 0,
    symbolCountAfterTradability: 612,
    symbolCountFilteredOut: 365,
    candidateCountA: 3,
    candidateCountB: 2,
    candidateCountSurfaced: 5,
    errorSummary: null,
    notes: {
      topRejectionCategories: { base_not_formed: 214, rs20_below: 187 },
      closestToValidSymbols: [{ symbol: "SSI" }, { symbol: "TCB" }],
      recommendation: { likelyBottleneck: "", summary: "", note: "" },
      decision: { level: "PROBE", allocation: "20-40%", explanation: "" },
    } as never,
    surfaced: [
      { symbol: "FPT", quality: "A", rankScore: 92.4 },
      { symbol: "HPG", quality: "A", rankScore: 88.1 },
      { symbol: "VCB", quality: "B", rankScore: 79.2 },
    ],
    ...over,
  };
}

describe("buildScanLog", () => {
  it("mở đầu bằng phiên và vũ trụ mã, dùng số vi-VN", () => {
    const rows = buildScanLog(input());
    expect(rows[0].message).toContain("25/08/2026");
    expect(rows[1].message).toContain("1.605");
  });

  it("ghi mức Cổng 1 với tông màu tương ứng", () => {
    expect(buildScanLog(input()).find((r) => r.message.startsWith("Cổng 1"))).toMatchObject({
      message: "Cổng 1 = CẢNH BÁO",
      tone: "warn",
    });
    expect(
      buildScanLog(input({ gate1Level: "PASS" })).find((r) => r.message.startsWith("Cổng 1"))?.tone
    ).toBe("good");
    expect(
      buildScanLog(input({ gate1Level: "FAIL" })).find((r) => r.message.startsWith("Cổng 1"))?.tone
    ).toBe("bad");
  });

  it("liệt kê nhóm loại theo thứ tự giảm dần", () => {
    const rejects = buildScanLog(input()).filter((r) => r.message.startsWith("Loại:"));
    expect(rejects).toHaveLength(2);
    expect(rejects[0].message).toContain("214");
    expect(rejects[1].message).toContain("187");
  });

  it("ghi mã ĐẠT tách theo hạng", () => {
    const passed = buildScanLog(input()).filter((r) => r.message.startsWith("ĐẠT:"));
    expect(passed).toHaveLength(2);
    expect(passed[0].message).toContain("FPT (A · 92,4)");
    expect(passed[1].message).toContain("VCB (B · 79,2)");
  });

  it("không có mã nào đạt thì nói rõ 0 kèm số ứng viên đã chấm", () => {
    const rows = buildScanLog(input({ surfaced: [] }));
    const line = rows.find((r) => r.message.startsWith("ĐẠT:"));
    expect(line?.message).toContain("0 mã");
    expect(line?.tone).toBe("warn");
  });

  it("chỉ ghi dòng lỗi khi thực sự có lỗi", () => {
    expect(buildScanLog(input()).some((r) => r.message.startsWith("Lỗi:"))).toBe(false);
    expect(
      buildScanLog(input({ errorSummary: "timeout tại HOSE" })).some((r) =>
        r.message.includes("timeout tại HOSE")
      )
    ).toBe(true);
  });

  it("chỉ ghi số mã lỗi khi lớn hơn 0", () => {
    expect(buildScanLog(input()).some((r) => r.message.startsWith("Lỗi khi quét"))).toBe(false);
    expect(
      buildScanLog(input({ symbolCountFailed: 7 })).some((r) =>
        r.message.startsWith("Lỗi khi quét")
      )
    ).toBe(true);
  });

  it("tính thời lượng khi có cả mốc bắt đầu và kết thúc", () => {
    const line = buildScanLog(input()).find((r) => r.message.startsWith("Hoàn tất"));
    expect(line?.message).toContain("29,4s");
  });

  it("thiếu mốc thời gian thì ghi trạng thái thay vì bịa thời lượng", () => {
    const rows = buildScanLog(input({ startedAt: null, finishedAt: null }));
    expect(rows.some((r) => r.message.startsWith("Hoàn tất"))).toBe(false);
    expect(rows.some((r) => r.message.includes("Trạng thái lần quét: COMPLETED"))).toBe(true);
  });

  it("không có notes thì không sinh dòng loại hay phán quyết", () => {
    const rows = buildScanLog(input({ notes: null }));
    expect(rows.some((r) => r.message.startsWith("Loại:"))).toBe(false);
    expect(rows.some((r) => r.message.includes("Phán quyết đã lưu"))).toBe(false);
  });
});
