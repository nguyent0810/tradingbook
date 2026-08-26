/**
 * Định dạng số cho TradeLog VN Terminal.
 *
 * Quy ước bàn giao (QA §1): mọi số hiển thị dùng locale **vi-VN** — dấu phẩy
 * thập phân, dấu chấm phân cách nghìn. Ô thiếu dữ liệu hiện `—`, không hiện 0.
 *
 * Các hàm ở đây thuần trình bày: không làm tròn dữ liệu gốc, không suy diễn.
 */

/** Ký tự dùng cho ô thiếu dữ liệu (gap). Không bao giờ thay bằng 0. */
export const GAP = "—";

type Num = number | null | undefined;

function isGap(value: Num): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

const cache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    cache.set(key, f);
  }
  return f;
}

/**
 * Số vi-VN với đúng `digits` chữ số thập phân (cố định, để cột thẳng hàng).
 * `fmtNum(1284.62, 2)` → "1.284,62"
 */
export function fmtNum(value: Num, digits = 0): string {
  if (isGap(value)) return GAP;
  return nf(digits, digits).format(value);
}

/**
 * Số vi-VN có dấu, luôn hiện `+` khi ≥ 0.
 * `fmtSigned(1.62, 2, "%")` → "+1,62%"
 */
export function fmtSigned(value: Num, digits = 0, suffix = ""): string {
  if (isGap(value)) return GAP;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${nf(digits, digits).format(value)}${suffix}`;
}

/** Phần trăm không dấu: `fmtPct(42.35, 1)` → "42,4%". */
export function fmtPct(value: Num, digits = 1): string {
  if (isGap(value)) return GAP;
  return `${nf(digits, digits).format(value)}%`;
}

/** Phần trăm có dấu: `fmtPctSigned(-0.44, 2)` → "-0,44%". */
export function fmtPctSigned(value: Num, digits = 2): string {
  return fmtSigned(value, digits, "%");
}

/** Bội số R: `fmtR(2.31)` → "+2,31R". */
export function fmtR(value: Num, digits = 2): string {
  return fmtSigned(value, digits, "R");
}

/** Đồng nguyên: `fmtVnd(26400000)` → "26.400.000 ₫". */
export function fmtVnd(value: Num): string {
  if (isGap(value)) return GAP;
  return `${nf(0, 0).format(value)} ₫`;
}

/** Đồng có dấu: `fmtVndSigned(-16200000)` → "-16.200.000 ₫". */
export function fmtVndSigned(value: Num): string {
  if (isGap(value)) return GAP;
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${nf(0, 0).format(Math.abs(value))} ₫`;
}

/**
 * Đồng rút gọn theo đơn vị Việt: nghìn / triệu (tr) / tỷ.
 * `fmtVndCompact(1_420_000_000)` → "1,42 tỷ ₫"
 * `fmtVndCompact(48_200_000)` → "48,2 tr ₫"
 */
export function fmtVndCompact(value: Num): string {
  if (isGap(value)) return GAP;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${nf(2, 2).format(abs / 1_000_000_000)} tỷ ₫`;
  if (abs >= 1_000_000) return `${sign}${nf(1, 1).format(abs / 1_000_000)} tr ₫`;
  if (abs >= 1_000) return `${sign}${nf(0, 0).format(abs)} ₫`;
  return `${sign}${nf(0, 0).format(abs)} ₫`;
}

/** Đồng rút gọn có dấu (dùng cho lãi/lỗ). */
export function fmtVndCompactSigned(value: Num): string {
  if (isGap(value)) return GAP;
  const body = fmtVndCompact(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${body}`;
}

/** Khối lượng cổ phiếu: `fmtShares(8600)` → "8.600". */
export function fmtShares(value: Num): string {
  return fmtNum(value, 0);
}

/** Ngày phiên dd/MM/yyyy theo giờ Việt Nam. */
export function fmtSessionDate(date: Date | string | null | undefined): string {
  if (date == null) return GAP;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return GAP;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/**
 * Ngày ngắn dd/MM (dùng trong log, timeline).
 * Cắt từ chuỗi dd/MM/yyyy — `Intl` với riêng day+month cho ra "25-08" ở vi-VN.
 */
export function fmtDayMonth(date: Date | string | null | undefined): string {
  const full = fmtSessionDate(date);
  if (full === GAP) return GAP;
  return full.slice(0, 5);
}

/** Giờ HH:mm:ss theo giờ Việt Nam. */
export function fmtClock(date: Date | string | null | undefined): string {
  if (date == null) return GAP;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return GAP;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** Ngày + giờ phiên: "25/08/2026 09:15:02". */
export function fmtSessionStamp(date: Date | string | null | undefined): string {
  const day = fmtSessionDate(date);
  if (day === GAP) return GAP;
  return `${day} ${fmtClock(date)}`;
}

/** Khoảng thời gian đã trôi qua, dạng "4g 47ph" / "12ph" / "38s". */
export function fmtAge(ms: Num): string {
  if (isGap(ms) || ms < 0) return GAP;
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return `${Math.floor(ms / 1000)}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 1) return `${minutes}ph`;
  return `${hours}g ${String(minutes).padStart(2, "0")}ph`;
}

/**
 * Hướng giá theo quy ước bảng giá VN — dùng để chọn token màu.
 * Không đảo ngược: xanh tăng, đỏ giảm, vàng tham chiếu.
 */
export type PriceDirection = "up" | "down" | "ref" | "gap";

export function priceDirection(value: Num): PriceDirection {
  if (isGap(value)) return "gap";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "ref";
}

/**
 * Màu NHẬN DIỆN của một ô — chỉ áp khi ô thật sự có số.
 *
 * Khác `priceToneVar()`: ở đây màu không nói về *dấu* của giá trị mà về *vai trò*
 * của ô (cắt lỗ đỏ nhạt, mục tiêu xanh nhạt, vùng mua xanh, bậc phễu…). Vai trò
 * thì không đổi, nhưng gán nó cho một ô đang hiện "—" là nói rằng chỗ đó đã có
 * số — nên thiếu dữ liệu vẫn phải rơi về màu mờ trung tính.
 */
export function semanticTone(value: Num, tone: string): string {
  return isGap(value) ? "var(--tm-text-faint)" : tone;
}

/**
 * GIÁ TRỊ màu (không phải class) theo hướng của một con số — dùng ở những chỗ
 * cần truyền màu vào thuộc tính style hoặc prop, ví dụ `tone` của `Sparkline`.
 *
 * Cùng một quy ước với `priceToneClass()`, kể cả hai ca dễ sai:
 *   • `null` / không hữu hạn ⇒ **gap**, màu mờ trung tính. Tô xanh cho ô chưa có
 *     dữ liệu là nói "lãi" ở nơi ta không biết gì.
 *   • `0` ⇒ **tham chiếu** (vàng), theo quy ước bảng giá VN — không phải "tăng".
 */
export function priceToneVar(value: Num): string {
  switch (priceDirection(value)) {
    case "up":
      return "var(--tm-up)";
    case "down":
      return "var(--tm-down)";
    case "ref":
      return "var(--tm-ref)";
    default:
      return "var(--tm-text-faint)";
  }
}

/** Class màu tương ứng hướng giá (định nghĩa trong styles/terminal.css). */
export function priceToneClass(value: Num): string {
  switch (priceDirection(value)) {
    case "up":
      return "tm-up";
    case "down":
      return "tm-down";
    case "ref":
      return "tm-ref";
    default:
      return "tm-gap";
  }
}
