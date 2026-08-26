/**
 * Phân tích ô nhập của màn Cài đặt — **cùng một quy tắc với server action**.
 *
 * `parsePositiveMoney()` và `optionalPercentField()` phía server đều làm đúng
 * một việc: bỏ dấu phẩy rồi `Number()`. Nghĩa là dấu chấm là **dấu thập phân**,
 * còn dấu phẩy là dấu phân cách nghìn — ví dụ `0.75` là 0,75 phần trăm.
 *
 * Khối xem trước định cỡ ở F5 bắt buộc dùng chung hàm này. Nếu nó tự phân tích
 * theo quy ước khác (chẳng hạn coi dấu chấm là phân cách nghìn kiểu vi-VN) thì
 * `0.75` sẽ thành 75 và bảng xem trước nói dối về chính giá trị người dùng sắp
 * lưu — đúng thứ mà khối xem trước sinh ra để ngăn chặn.
 */
export function parseSettingsField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Số dương, dùng cho vốn tài khoản. */
export function parseSettingsPositive(raw: string): number | null {
  const n = parseSettingsField(raw);
  return n != null && n > 0 ? n : null;
}
