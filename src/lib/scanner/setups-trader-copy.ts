import type { TerminalCategory } from "./gate2-scan-diagnostics";

/** Gate 2 INVALID bucket key → trader-facing label (presentation only). */
export const REJECTION_BUCKET_LABELS: Record<string, string> = {
  trend_below_ma50: "Dưới xu hướng dài hạn",
  trend_ma20_below_ma50: "Xu hướng ngắn hạn yếu hơn dài hạn",
  breakout_recency: "Không có breakout gần đây",
  pullback_zone_interaction: "Chưa vào vùng pullback",
  breakout_not_holding: "Breakout không giữ được",
  digestion: "Không tích lũy sau breakout",
  mid_pullback_below_ma50: "Pullback đóng cửa dưới đường MA50",
  swept_breakout_weak_close: "Đóng cửa yếu sau khi quét đáy breakout",
  pullback_zone_two_closes: "Hai phiên đóng cửa dưới đáy vùng pullback",
  pullback_zone_malformed: "Cấu trúc vùng pullback không rõ ràng",
  volume_median_bad: "Nền khối lượng không đáng tin cậy",
  volume_ratio: "Thanh khoản quá mỏng so với khối lượng trung vị",
  extension_cap: "Đuổi giá — vượt quá xa trên breakout",
  depth_cap: "Pullback sâu hơn mức mẫu hình cho phép",
  stop_structure: "Khoảng cách vào lệnh/dừng lỗ không khả thi",
  insufficient_bars: "Không đủ dữ liệu lịch sử cho Gate 2",
  stale_or_session_mismatch: "Ngày phiên không khớp với chỉ số tham chiếu",
  ma_compute: "Không tính được đường trung bình động",
  unknown: "Không khớp mẫu hình khác",
};

export function rejectionBucketLabel(categoryKey: string): string {
  return REJECTION_BUCKET_LABELS[categoryKey] ?? categoryKey.replace(/_/g, " ");
}

export type RejectionBucketTraderGuide = {
  /** What this Gate 2 bucket means in plain language */
  meaning: string;
  /** What to wait for before expecting a name to clear this check */
  waitFor: string;
};

const DEFAULT_GUIDE: RejectionBucketTraderGuide = {
  meaning: "Quy tắc này đã loại mã theo mẫu hình breakout-pullback hôm nay.",
  waitFor: "Cấu trúc hoặc thanh khoản cải thiện để lần quét tiếp theo vượt qua bước này.",
};

/** Trader-facing copy for diagnostics accordion (does not change Gate 2 rules). */
export function rejectionBucketTraderGuide(categoryKey: string): RejectionBucketTraderGuide {
  switch (categoryKey) {
    case "trend_below_ma50":
      return {
        meaning: "Giá đang nằm sai phía bộ lọc xu hướng dài hạn cho phong cách swing này.",
        waitFor: "Giá mạnh trở lại trên đường xu hướng chậm trước khi xem thiên hướng là hỗ trợ.",
      };
    case "trend_ma20_below_ma50":
      return {
        meaning: "Xu hướng ngắn hạn yếu hơn xu hướng chậm — động lượng chưa xác nhận.",
        waitFor: "Xu hướng ngắn hạn cần vững lên so với đường dài hạn trước khi ưu tiên breakout.",
      };
    case "breakout_recency":
      return {
        meaning: "Chưa có breakout đạt chuẩn trong khung phiên gần đây.",
        waitFor: "Một cú bứt phá dứt khoát qua kháng cự, sau đó đánh giá lại tích lũy và pullback.",
      };
    case "breakout_not_holding":
      return {
        meaning: "Giá xuyên qua kháng cự nhưng không giữ được đến cuối phiên.",
        waitFor: "Một phiên đóng cửa giữ trên mức breakout để mức này trở thành hỗ trợ.",
      };
    case "pullback_zone_interaction":
      return {
        meaning: "Cây nến gần nhất chưa chạm hoặc chưa hoạt động trong vùng pullback sau breakout.",
        waitFor: "Một nhịp giảm hoặc giành lại vào vùng pullback để thời điểm vào lệnh khớp với mẫu hình.",
      };
    case "digestion":
      return {
        meaning: "Giá tăng thẳng đứng mà không có nhịp nghỉ/tích lũy như mẫu hình yêu cầu sau đợt bứt phá.",
        waitFor: "Một nhịp pullback có kiểm soát hoặc dao động dưới giá đóng cửa ngày breakout (tích lũy) trước khi vào lệnh.",
      };
    case "pullback_zone_two_closes":
      return {
        meaning: "Hai phiên đóng cửa liên tiếp mất đáy vùng pullback.",
        waitFor: "Giành lại trên đáy vùng để cấu trúc không vỡ vào trong vùng.",
      };
    case "pullback_zone_malformed":
      return {
        meaning: "Không thể vẽ rõ vùng pullback từ các đợt dao động gần đây.",
        waitFor: "Các đợt dao động rõ ràng hơn để mốc vùng được xác định tốt.",
      };
    case "mid_pullback_below_ma50":
      return {
        meaning: "Trong giai đoạn pullback, giá đã phá vỡ đường MA50.",
        waitFor: "Pullback tôn trọng hỗ trợ xu hướng chính trước khi có thiết lập tiếp diễn.",
      };
    case "swept_breakout_weak_close":
      return {
        meaning: "Đóng cửa yếu sau khi quét dưới các đáy liên quan đến breakout — cấu trúc mong manh.",
        waitFor: "Một phiên đóng cửa mạnh hơn từ chối cú quét và bảo vệ vùng breakout.",
      };
    case "volume_median_bad":
      return {
        meaning: "Nền khối lượng chưa đủ tin cậy để chấm điểm thanh khoản.",
        waitFor: "Lịch sử khối lượng đều đặn hơn để so sánh trung vị có ý nghĩa.",
      };
    case "volume_ratio":
      return {
        meaning: "Thanh khoản trên cây nến quá mỏng so với ngưỡng mẫu hình.",
        waitFor: "Khối lượng lớn hơn đi kèm hành động giá hỗ trợ tại mức này.",
      };
    case "extension_cap":
      return {
        meaning: "Giá đã vươn quá xa trên breakout — rủi ro đuổi giá.",
        waitFor: "Một nhịp pullback nông hơn hoặc reset để tỷ lệ lợi nhuận/rủi ro không bị kéo căng.",
      };
    case "depth_cap":
      return {
        meaning: "Pullback thoái lui sâu hơn mức mẫu hình này cho phép.",
        waitFor: "Một nhịp tích lũy nông hơn hoặc cấu trúc được reset mới.",
      };
    case "stop_structure":
      return {
        meaning: "Dừng lỗ so với điểm vào không tạo ra định nghĩa rủi ro khả thi.",
        waitFor: "Cấu trúc có khoảng cách rõ ràng giữa điểm dừng lỗ và điểm vào.",
      };
    case "insufficient_bars":
      return {
        meaning: "Không đủ dữ liệu lịch sử theo ngày để chạy đầy đủ danh sách kiểm tra Gate 2.",
        waitFor: "Nhập thêm dữ liệu nến trước khi đánh giá mã này.",
      };
    case "stale_or_session_mismatch":
      return {
        meaning: "Dữ liệu cổ phiếu không khớp với ngày phiên của chỉ số tham chiếu.",
        waitFor: "Dữ liệu nến cập nhật cùng phiên với chỉ số.",
      };
    case "ma_compute":
      return {
        meaning: "Không thể tính đường trung bình động cho chuỗi dữ liệu này.",
        waitFor: "Dữ liệu nến sạch, không có khoảng trống cản trở tính MA.",
      };
    case "unknown":
      return {
        meaning: "Dừng lại vì lý do chưa được phân loại vào nhóm chuẩn.",
        waitFor: "Xem lại các dòng gần đạt chuẩn nhất hoặc quét lại sau khi sửa dữ liệu.",
      };
    default:
      return DEFAULT_GUIDE;
  }
}

export type InsightCopy = {
  headline: string;
  contextLine: string;
  explanation: string;
  action: string;
};

export function buildSetupsInsightCopy(params: {
  surfacedCount: number;
  dominantCategoryKey: string | null;
  tradableCount: number;
}): InsightCopy {
  const { surfacedCount, dominantCategoryKey, tradableCount } = params;

  if (surfacedCount > 0) {
    return {
      headline:
        surfacedCount === 1
          ? "Một thiết lập breakout-pullback đạt chuẩn xuất hiện hôm nay."
          : `${surfacedCount} thiết lập breakout-pullback đạt chuẩn xuất hiện hôm nay.`,
      contextLine:
        tradableCount > 0
          ? `Đã đánh giá trên ${tradableCount} mã có thể giao dịch trong phiên gần nhất.`
          : "",
      explanation: "Xem lại các mức giá và lý do bên dưới trước khi phân bổ rủi ro.",
      action: "Xác nhận thanh khoản và kế hoạch của bạn ở từng hạng (A và B).",
    };
  }

  const headline = "Thị trường chưa thuận lợi cho các thiết lập breakout.";
  const { explanation, action } = dominantInsightExplanationAndAction(dominantCategoryKey);

  return {
    headline,
    contextLine:
      tradableCount > 0
        ? `${tradableCount} mã đạt điều kiện giao dịch nhưng không mã nào vượt qua đầy đủ các kiểm tra Gate 2.`
        : "Không có mã nào đạt điều kiện giao dịch trong phiên này.",
    explanation,
    action,
  };
}

function dominantInsightExplanationAndAction(dominant: string | null): {
  explanation: string;
  action: string;
} {
  switch (dominant) {
    case "trend_below_ma50":
      return {
        explanation: "Hầu hết cổ phiếu vẫn ở dưới các mức xu hướng quan trọng.",
        action: "Chờ xu hướng hồi phục trước khi quét tìm thiết lập.",
      };
    case "trend_ma20_below_ma50":
      return {
        explanation: "Động lượng ngắn hạn yếu hơn xu hướng chậm ở nhiều mã.",
        action: "Chờ MA20 vượt lại MA50 trước khi ưu tiên các breakout.",
      };
    case "breakout_recency":
      return {
        explanation: "Rất ít mã ghi nhận breakout mới trong 10 phiên gần đây.",
        action: "Theo dõi cú bứt phá dứt khoát trên đỉnh biên độ 20 phiên.",
      };
    case "breakout_not_holding":
      return {
        explanation: "Một số mã đã mất mức breakout trước khi đạt chuẩn.",
        action: "Ưu tiên các cú giữ giá sạch trên kháng cự trước khi vào lệnh pullback.",
      };
    case "pullback_zone_interaction":
    case "pullback_zone_two_closes":
    case "pullback_zone_malformed":
      return {
        explanation: "Giá chưa tương tác rõ ràng với vùng pullback.",
        action: "Chờ giá chạm hoặc giành lại bên trong vùng pullback.",
      };
    case "digestion":
      return {
        explanation: "Các cú breakout tăng thẳng không tích lũy đang bị bỏ qua.",
        action: "Tìm nhịp giảm tích lũy dưới giá đóng cửa ngày breakout trước.",
      };
    case "volume_ratio":
    case "volume_median_bad":
      return {
        explanation: "Thanh khoản tại cây nến đánh giá yếu hơn mức mẫu hình yêu cầu.",
        action: "Đứng ngoài cho đến khi khối lượng xác nhận sự quan tâm tại mức này.",
      };
    case "extension_cap":
      return {
        explanation: "Nhiều giá đóng cửa nằm quá xa trên mức breakout đối với mẫu hình swing này.",
        action: "Tránh đuổi giá; chờ cấu trúc pullback nông hơn.",
      };
    case "depth_cap":
      return {
        explanation: "Các pullback đang thoái lui quá sâu so với mốc breakout.",
        action: "Chờ tích lũy nông hơn hoặc reset sạch hơn.",
      };
    case "stop_structure":
      return {
        explanation: "Vị trí dừng lỗ so với điểm vào không đạt mức rủi ro swing tối thiểu.",
        action: "Bỏ qua các cấu trúc biên cho đến khi xác định được điểm dừng lỗ rõ ràng.",
      };
    default:
      return {
        explanation: "Bộ lọc đang chặt chẽ — nhiều kiểm tra khác nhau đang thu hẹp danh sách.",
        action: "Kiên nhẫn chờ đến khi cấu trúc khớp hoàn toàn với mẫu hình.",
      };
  }
}

/** One-line “closest” copy per terminal category (arrow format). */
export function traderClosestOneLiner(symbol: string, category: TerminalCategory | string): string {
  const c = category;
  switch (c) {
    case "pullback_zone_interaction":
      return `${symbol} → Đã breakout nhưng chưa vào vùng pullback`;
    case "breakout_not_holding":
      return `${symbol} → Breakout không giữ được trên kháng cự`;
    case "trend_below_ma50":
      return `${symbol} → Vẫn dưới bộ lọc xu hướng MA50`;
    case "trend_ma20_below_ma50":
      return `${symbol} → Xu hướng ngắn hạn yếu hơn dài hạn`;
    case "breakout_recency":
      return `${symbol} → Không có breakout đạt chuẩn trong 10 phiên gần đây`;
    case "digestion":
      return `${symbol} → Cần tích lũy sau đợt bứt phá`;
    case "pullback_zone_two_closes":
      return `${symbol} → Mất vùng pullback — cần giành lại`;
    case "volume_ratio":
      return `${symbol} → Thanh khoản dưới ngưỡng mẫu hình`;
    case "extension_cap":
      return `${symbol} → Vượt quá xa so với breakout (rủi ro đuổi giá)`;
    case "depth_cap":
      return `${symbol} → Pullback sâu hơn mức mẫu hình cho phép`;
    case "stop_structure":
      return `${symbol} → Cấu trúc vào lệnh/dừng lỗ chưa khả thi`;
    default:
      return `${symbol} → Gần khớp mẫu hình — còn một quy tắc Gate 2 đang chặn`;
  }
}
