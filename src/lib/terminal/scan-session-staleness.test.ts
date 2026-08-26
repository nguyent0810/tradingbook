import { describe, expect, it } from "vitest";
import { scanBehindMarketNotice } from "./scan-session-staleness";

const SCOPE = "Mọi số bên dưới tính trên phiên cũ hơn.";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("lần quét cũ hơn phiên thị trường", () => {
  it("quét phiên 24 trong khi thị trường đã sang 25 ⇒ báo dữ liệu cũ", () => {
    const notice = scanBehindMarketNotice(day("2026-08-24"), day("2026-08-25"), SCOPE);
    expect(notice).not.toBeNull();
    // `fmtSessionDate` in theo vi-VN (dd/MM/yyyy), không phải ISO.
    expect(notice?.sessionLabel).toBe("24/08/2026");
    expect(notice?.consequence).toContain("25/08/2026");
    expect(notice?.consequence).toContain(SCOPE);
  });

  it("cùng phiên thì không báo", () => {
    expect(scanBehindMarketNotice(day("2026-08-25"), day("2026-08-25"), SCOPE)).toBeNull();
  });

  it("bỏ qua phần giờ — cùng ngày lịch UTC là cùng phiên", () => {
    const scan = new Date("2026-08-25T15:30:00.000Z");
    expect(scanBehindMarketNotice(scan, day("2026-08-25"), SCOPE)).toBeNull();
  });

  it("quét mới hơn thị trường thì cũng không báo ở đây", () => {
    // Ca này là một loại lệch khác (bar cổ phiếu đi trước VNINDEX) và có phép
    // kiểm riêng — hàm này chỉ trả lời đúng một câu hỏi.
    expect(scanBehindMarketNotice(day("2026-08-26"), day("2026-08-25"), SCOPE)).toBeNull();
  });

  it("thiếu một trong hai mốc thì KHÔNG đoán", () => {
    expect(scanBehindMarketNotice(null, day("2026-08-25"), SCOPE)).toBeNull();
    expect(scanBehindMarketNotice(day("2026-08-25"), null, SCOPE)).toBeNull();
  });
});
