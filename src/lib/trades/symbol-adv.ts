import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Kết quả đọc giá trị giao dịch bình quân 20 phiên (VND) của một mã.
 *
 * Phân biệt HAI trạng thái mà một `null` trơn sẽ gộp làm một:
 *   • `{ ok: true, value: null }` — không có hàng ADV. Cả màn lẫn server cùng bỏ
 *     trần thanh khoản. Cân bằng.
 *   • `{ ok: false }` — TRUY VẤN HỎNG. Coi đây là "không có ADV" thì server lặng
 *     lẽ bỏ trần trong khi màn hình vẫn áp ⇒ server LỎNG HƠN màn.
 */
/**
 * Hàng ADV cũ hơn phiên mốc quá số ngày lịch này thì không dùng (coi như không
 * có ADV). `symbolMarketContextDaily` được ghi mỗi phiên, nên một hàng cũ hơn
 * một tháng không còn là GTGD 20 phiên của phiên mốc; giới hạn này cũng giữ truy
 * vấn batch không quét toàn bộ lịch sử. Áp CHUNG cho bản một mã và bản batch để
 * màn hình và server action vẫn ra cùng một con số.
 */
export const ADV_ROW_MAX_AGE_DAYS = 30;

function windowStart(sessionDate: Date): Date {
  return new Date(sessionDate.getTime() - ADV_ROW_MAX_AGE_DAYS * 86_400_000);
}

export type AdvLookup = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * ADV của một mã **tại hoặc trước** `sessionDate`.
 *
 * Đây là hàm DUY NHẤT được phép trả lời câu hỏi này. Màn F7 và server action ghi
 * lệnh phải gọi cùng nó với cùng mốc phiên — nếu màn lấy ADV phiên mới nhất còn
 * server lấy ADV phiên của thiết lập, trần thanh khoản hai bên khác nhau và
 * người dùng thấy một khối lượng mà server sẽ không chấp nhận.
 *
 * Công thức khớp `symbolMarketContextDaily`: `close × 1000 × volMa20` (giá lưu
 * theo nghìn ₫/cp).
 */
export async function loadSymbolAdvVnd(
  prisma: PrismaClient,
  symbolId: string,
  sessionDate: Date
): Promise<AdvLookup> {
  try {
    const row = await prisma.symbolMarketContextDaily.findFirst({
      where: { symbolId, sessionDate: { lte: sessionDate, gte: windowStart(sessionDate) } },
      orderBy: { sessionDate: "desc" },
      select: { close: true, volMa20: true },
    });
    if (row?.close == null || row.volMa20 == null) return { ok: true, value: null };
    return { ok: true, value: row.close * 1000 * row.volMa20 };
  } catch (e) {
    console.error("[symbol-adv] lookup failed:", e);
    return {
      ok: false,
      error: "prisma.symbolMarketContextDaily.findFirst() thất bại: " + String(e),
    };
  }
}

/**
 * ADV cho NHIỀU mã cùng lúc, mỗi mã theo mốc phiên riêng của nó.
 *
 * Cùng quy tắc "tại hoặc trước" với `loadSymbolAdvVnd()` — F2 định cỡ hàng loạt
 * ứng viên nên không thể gọi một-hàm-một-mã, nhưng **kết quả phải trùng khít**
 * với cái server action sẽ tính khi ghi lệnh từng mã. Truy vấn exact ngày (bản
 * cũ của F2) cho ra khối lượng khác khi thiếu hàng đúng ngày mà có hàng trước đó.
 *
 * Một truy vấn cho mọi mã: lấy mọi hàng tại-hoặc-trước mốc muộn nhất, rồi mỗi mã
 * tự chọn hàng mới nhất không vượt mốc của chính nó.
 */
export async function loadSymbolAdvVndBatch(
  prisma: PrismaClient,
  targets: readonly { symbolId: string; sessionDate: Date }[]
): Promise<{ ok: true; map: Map<string, number | null> } | { ok: false; error: string }> {
  if (targets.length === 0) return { ok: true, map: new Map() };
  const latestCutoff = targets.reduce(
    (max, t) => (t.sessionDate > max ? t.sessionDate : max),
    targets[0]!.sessionDate
  );
  const earliestTarget = targets.reduce(
    (min, t) => (t.sessionDate < min ? t.sessionDate : min),
    targets[0]!.sessionDate
  );
  try {
    const rows = await prisma.symbolMarketContextDaily.findMany({
      where: {
        symbolId: { in: targets.map((t) => t.symbolId) },
        sessionDate: { lte: latestCutoff, gte: windowStart(earliestTarget) },
      },
      orderBy: { sessionDate: "desc" },
      select: { symbolId: true, sessionDate: true, close: true, volMa20: true },
    });
    const map = new Map<string, number | null>();
    for (const target of targets) {
      // `rows` đã sắp giảm dần theo phiên nên hàng đầu tiên khớp là hàng mới nhất
      // không vượt mốc của mã đó.
      const from = windowStart(target.sessionDate);
      const row = rows.find(
        (r) =>
          r.symbolId === target.symbolId &&
          r.sessionDate <= target.sessionDate &&
          r.sessionDate >= from
      );
      map.set(
        target.symbolId,
        row?.close != null && row.volMa20 != null ? row.close * 1000 * row.volMa20 : null
      );
    }
    return { ok: true, map };
  } catch (e) {
    console.error("[symbol-adv] batch lookup failed:", e);
    return {
      ok: false,
      error: "prisma.symbolMarketContextDaily.findMany() thất bại: " + String(e),
    };
  }
}
