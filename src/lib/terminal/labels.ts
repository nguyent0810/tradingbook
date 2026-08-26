import type { SetupHealthLevelValue } from "@/lib/setup-health/types";

/**
 * Nhãn ngắn viết hoa cho giao diện terminal — mật độ cao, ô bảng chỉ đủ chỗ cho
 * một hai từ. Khác với `trading-display-labels.ts` (nhãn dài, dùng ở prose).
 */

const HEALTH_SHORT: Record<string, string> = {
  HEALTHY: "TỐT",
  WARNING: "CẢNH BÁO",
  AT_RISK: "RỦI RO",
  DEAD: "HỎNG",
  NO_DATA: "—",
};

export function healthShortLabel(level: SetupHealthLevelValue | string | null): string {
  if (!level) return "—";
  return HEALTH_SHORT[level] ?? level;
}

/** Màu token theo mức sức khoẻ thiết lập. */
export function healthTone(level: SetupHealthLevelValue | string | null): string {
  switch (level) {
    case "HEALTHY":
      return "var(--tm-up)";
    case "WARNING":
      return "var(--tm-ref)";
    case "AT_RISK":
      return "var(--tm-accent)";
    case "DEAD":
      return "var(--tm-down)";
    default:
      return "var(--tm-text-faint)";
  }
}

/** Màu token theo RS20 so với VNINDEX (ngưỡng đạt của bộ quét là 6). */
export function rsTone(rs20: number | null | undefined): string {
  if (rs20 == null || !Number.isFinite(rs20)) return "var(--tm-text-faint)";
  if (rs20 >= 6) return "var(--tm-up)";
  if (rs20 > 0) return "var(--tm-ref)";
  return "var(--tm-down)";
}

const LIFECYCLE_SHORT: Record<string, string> = {
  NEW: "MỚI",
  WATCHING: "THEO DÕI",
  READY: "SẴN SÀNG",
  TRIGGERED: "ĐÃ KÍCH HOẠT",
  INVALIDATED: "MẤT HIỆU LỰC",
  EXPIRED: "HẾT HẠN",
};

export function lifecycleShortLabel(status: string | null): string {
  if (!status) return "—";
  return LIFECYCLE_SHORT[status] ?? status;
}

export function lifecycleTone(status: string | null): string {
  switch (status) {
    case "READY":
      return "var(--tm-up)";
    case "WATCHING":
      return "var(--tm-floor)";
    case "NEW":
      return "var(--tm-text-soft)";
    default:
      return "var(--tm-text-faint)";
  }
}

/**
 * Hiển thị độ tươi dữ liệu trên thanh trên — BA trạng thái, không phải hai.
 *
 * `null` là **chưa biết** (thiếu một trong hai mốc phiên, hoặc đọc lỗi). Ép nó
 * thành "cũ" là khẳng định một điều ta không đo được; bàn giao §6 xếp trường hợp
 * này vào gap.
 */
export function dataFreshness(live: boolean | null): {
  label: string;
  color: string;
  led: boolean;
  title?: string;
} {
  if (live === true) return { label: "TRỰC TIẾP", color: "var(--tm-up)", led: true };
  if (live === false) return { label: "DỮ LIỆU CŨ", color: "var(--tm-accent)", led: false };
  return {
    label: "ĐỘ TƯƠI —",
    color: "var(--tm-text-faint)",
    led: false,
    title: "Thiếu mốc phiên để so — không kết luận được độ tươi.",
  };
}
