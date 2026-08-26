import { GAP, fmtNum, fmtPct, fmtR, fmtVndCompactSigned } from "@/lib/format/vn";

/**
 * Bảng vàng lưu mọi kỷ lục vào **một cột `value` duy nhất** với đơn vị khác nhau
 * tuỳ loại thành tích (xem `detect-achievements.ts`):
 *
 * | Loại                      | Nguồn                       | Đơn vị      |
 * |---------------------------|-----------------------------|-------------|
 * | HIGHEST_R_MULTIPLE        | `rMultiple`                 | bội số R    |
 * | GREATEST_TRADE            | `pnl`                       | đồng        |
 * | BEST_MONTHLY_RETURN       | `totalReturnPct`            | phần trăm   |
 * | MOST_ACCURATE_AGENT       | `accuracy`                  | tỉ lệ 0..1  |
 * | WORST_PREDICTION          | `confidence`                | tỉ lệ 0..1  |
 * | BEST_RECOVERY             | `evo.score`                 | điểm        |
 *
 * In tất cả bằng một định dạng thập phân là sai: một kỷ lục 26 triệu đồng và một
 * kỷ lục 0,82 độ chính xác sẽ nằm cạnh nhau như thể cùng thang đo.
 */

const LABELS: Record<string, string> = {
  GREATEST_TRADE: "Lệnh lãi lớn nhất",
  HIGHEST_R_MULTIPLE: "R lớn nhất một lệnh",
  BEST_MONTHLY_RETURN: "Lợi nhuận tháng tốt nhất",
  LONGEST_WIN_STREAK: "Chuỗi thắng dài nhất",
  MOST_ACCURATE_AGENT: "Tác tử chính xác nhất",
  BEST_RECOVERY: "Hồi phục tốt nhất",
  HIGHEST_CONFIDENCE_CORRECT: "Tự tin cao và đúng",
  WORST_PREDICTION: "Dự đoán tệ nhất",
  LUCKIEST_TRADE: "Lệnh may nhất",
  UNLUCKIEST_TRADE: "Lệnh xui nhất",
};

export function hofLabel(achievementType: string): string {
  return LABELS[achievementType] ?? achievementType.replace(/_/g, " ").toLowerCase();
}

/** Giá trị kỷ lục kèm đúng đơn vị của loại thành tích đó. */
export function hofValue(achievementType: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return GAP;

  switch (achievementType) {
    case "HIGHEST_R_MULTIPLE":
      return fmtR(value);
    case "GREATEST_TRADE":
      return fmtVndCompactSigned(value);
    case "BEST_MONTHLY_RETURN":
      return fmtPct(value, 1);
    case "MOST_ACCURATE_AGENT":
    case "WORST_PREDICTION":
    case "HIGHEST_CONFIDENCE_CORRECT":
      // Nguồn là tỉ lệ 0..1 — nhân 100 để đọc ra phần trăm.
      return fmtPct(value * 100, 1);
    case "LONGEST_WIN_STREAK":
      return `${fmtNum(value, 0)} lệnh`;
    case "BEST_RECOVERY":
      return `${fmtNum(value, 2)} điểm`;
    default:
      return fmtNum(value, 2);
  }
}
