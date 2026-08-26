import { fmtSessionDate } from "@/lib/format/vn";

/** Nội dung băng "DỮ LIỆU CŨ" — cùng hình dạng mà `StaleBanner` nhận. */
export type StaleNotice = { sessionLabel: string; consequence: string };

/** So hai mốc theo NGÀY LỊCH UTC, bỏ phần giờ. */
function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Lần quét gần nhất chạy cho một phiên CŨ HƠN phiên thị trường mới nhất.
 *
 * Đây là kiểu lệch phiên dễ lọt nhất, vì mọi phép kiểm "độ tươi" khác đều so
 * **thời điểm chạy** scan với ngày VNINDEX: một lần quét chạy hôm nay CHO phiên
 * hôm qua vẫn trông như khớp. Nhưng ứng viên, vùng mua, cắt lỗ và phán quyết đều
 * là kết quả của phiên mà scan đã quét, không phải của phiên mà thị trường đang ở.
 *
 * Mỗi màn tự nêu phạm vi ảnh hưởng của mình qua tham số `scope` — nội dung đó
 * phải khớp đúng những gì màn ĐÓ thật sự dựng từ lần quét.
 *
 * @param scanSession `DailyScanRun.expectedSessionDate` — phiên mà lần quét nhắm tới.
 * @param marketSession Phiên thị trường mới nhất (bar VNINDEX gần nhất).
 * @param scope Câu mô tả những gì trên màn bị ảnh hưởng.
 */
export function scanBehindMarketNotice(
  scanSession: Date | null,
  marketSession: Date | null,
  scope: string
): StaleNotice | null {
  if (scanSession == null || marketSession == null) return null;
  if (utcDay(scanSession) >= utcDay(marketSession)) return null;
  return {
    sessionLabel: fmtSessionDate(scanSession),
    consequence:
      `Thị trường đã có phiên ${fmtSessionDate(marketSession)} nhưng bộ quét mới ` +
      `chỉ chạy tới phiên ${fmtSessionDate(scanSession)}. ${scope}`,
  };
}
