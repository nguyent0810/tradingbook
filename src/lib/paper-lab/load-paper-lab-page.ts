import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";

/**
 * Kết quả nạp dữ liệu Đấu trường.
 *
 * Ba trạng thái **tách bạch**, cố ý không gộp: trước đây hàm này nuốt cả lỗi lẫn
 * trạng thái rỗng rồi trả về bộ dữ liệu mẫu (`buildMockPaperLabPageDto`), nên khi
 * cơ sở dữ liệu hỏng hoặc chưa có tác tử nào, màn Đấu trường vẫn hiện một bảng
 * xếp hạng đầy đủ với những con số bịa. Trên một sản phẩm ra quyết định giao
 * dịch thì đó là lỗi nặng nhất có thể có.
 */
export type PaperLabPageLoad =
  | { kind: "ok"; dto: PaperLabPageDto }
  | { kind: "empty"; reason: string }
  | { kind: "error"; error: string };

export async function loadPaperLabPage(): Promise<PaperLabPageLoad> {
  try {
    const { loadPaperLabPageDbLoad } = await import(
      "@/lib/paper-lab/queries/load-paper-lab-page-from-db"
    );
    const result = await loadPaperLabPageDbLoad();

    if (result.kind === "ok") return { kind: "ok", dto: result.dto };
    if (result.kind === "error") {
      console.error("[paper-lab] load failed:", result.error);
      return { kind: "error", error: result.error };
    }
    // Rỗng thật: bảng tồn tại, truy vấn chạy, chỉ là chưa có tác tử nào.
    return {
      kind: "empty",
      reason:
        "Chưa có tác tử mô phỏng nào trong cơ sở dữ liệu. Chạy `npm run seed:paper-agents` để khởi tạo.",
    };
  } catch (e) {
    console.error("[paper-lab] load threw:", e);
    return { kind: "error", error: `loadPaperLabPageDbLoad() → ${String(e)}` };
  }
}
