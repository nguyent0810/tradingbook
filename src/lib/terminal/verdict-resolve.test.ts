import { describe, expect, it } from "vitest";
import { resolveTerminalVerdict } from "./verdict-resolve";

const LIVE_OK = { level: "PASS" as const, error: null };

describe("resolveTerminalVerdict", () => {
  it("lấy giá trị XẤU HƠN giữa bản đã lưu và bản trực tiếp", () => {
    const worseLive = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: { level: "WARNING", error: null },
    });
    expect(worseLive.gate1).toBe("WARNING");
    expect(worseLive.resolution?.liveOverrideApplied).toBe(true);

    const worseScan = resolveTerminalVerdict({
      scanGate1: "FAIL",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: LIVE_OK,
    });
    expect(worseScan.gate1).toBe("FAIL");
    expect(worseScan.resolution?.liveOverrideApplied).toBe(false);
  });

  it("KHÔNG có phán quyết khi chế độ trực tiếp chưa đo được", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: { level: null, error: "chỉ có 31 bar VNINDEX, cần tối thiểu 50" },
    });
    expect(r.level).toBeNull();
    expect(r.gate1).toBeNull();
    expect(r.resolution).toBeNull();
    expect(r.blockedReason).toContain("31 bar VNINDEX");
  });

  it("chưa có lần quét thì có Cổng 1 nhưng chưa có phán quyết", () => {
    const r = resolveTerminalVerdict({
      scanGate1: null,
      candidateCountA: null,
      candidateCountB: null,
      liveGate1: LIVE_OK,
    });
    expect(r.gate1).toBe("PASS");
    expect(r.level).toBeNull();
    expect(r.blockedReason).toContain("lần quét");
  });

  it("Cổng 1 ĐẠT + có ứng viên ⇒ TRADE", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: LIVE_OK,
    });
    expect(r.level).toBe("TRADE");
  });

  it("Cổng 1 CẢNH BÁO + có Hạng A ⇒ PROBE", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "WARNING",
      candidateCountA: 1,
      candidateCountB: 0,
      liveGate1: { level: "WARNING", error: null },
    });
    expect(r.level).toBe("PROBE");
  });

  it("Cổng 1 FAIL ⇒ NO_TRADE bất kể có bao nhiêu ứng viên", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "FAIL",
      candidateCountA: 9,
      candidateCountB: 9,
      liveGate1: LIVE_OK,
    });
    expect(r.level).toBe("NO_TRADE");
  });

  it("dùng quyết định ĐÃ LƯU khi bản trực tiếp không xấu hơn — cùng quy tắc với DecisionCockpitDto", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: LIVE_OK,
      scanNotes: {
        decision: { level: "PROBE", allocation: "20-40%", explanation: "đã lưu" },
      } as never,
      scan: { id: "run_1", runAt: new Date("2026-08-25T02:15:00Z"), candidateCountSurfaced: 5 },
    });
    // Tính lại thuần sẽ ra TRADE; quyết định đã lưu là PROBE và phải thắng,
    // đúng như F1 đọc từ DTO.
    expect(r.level).toBe("PROBE");
    expect(r.allocation).toBe("20-40%");
  });

  it("bỏ qua quyết định đã lưu khi bản trực tiếp XẤU HƠN — luôn hạ về phía thận trọng", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 3,
      candidateCountB: 2,
      liveGate1: { level: "FAIL", error: null },
      scanNotes: {
        decision: { level: "NORMAL", allocation: "50-70%", explanation: "đã lưu" },
      } as never,
      scan: { id: "run_1", runAt: new Date("2026-08-25T02:15:00Z"), candidateCountSurfaced: 5 },
    });
    expect(r.gate1).toBe("FAIL");
    expect(r.level).toBe("NO_TRADE");
  });

  it("Cổng 1 ĐẠT nhưng không có ứng viên nào ⇒ NO_TRADE", () => {
    const r = resolveTerminalVerdict({
      scanGate1: "PASS",
      candidateCountA: 0,
      candidateCountB: 0,
      liveGate1: LIVE_OK,
    });
    expect(r.level).toBe("NO_TRADE");
  });
});
