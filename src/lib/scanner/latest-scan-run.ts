import type { PrismaClient } from "@/generated/prisma/client";
import { isSmokeDailyScanRunNotes } from "@/lib/scanner/production-smoke-markers";

/**
 * Số lần quét gần nhất được xét khi tìm lần quét THẬT.
 *
 * Các lần quét smoke (`p0dExitHealthSmoke`, `demoSeed`) chạy xen kẽ với lần quét
 * thật, nên "mới nhất" theo `runAt` chưa chắc là cái nên dùng.
 */
const LATEST_SCAN_LOOKBACK = 30;

/**
 * Id của lần quét THẬT gần nhất — đã loại các lần quét smoke.
 *
 * **Mọi** nơi cần "lần quét gần nhất" phải đi qua đây. Đọc thẳng
 * `dailyScanRun.findFirst({ orderBy: { runAt: "desc" } })` sẽ lấy trúng một lần
 * quét smoke nếu nó mới hơn, và khi đó màn hình (dùng hàm này) với server action
 * ghi lệnh (nếu đọc thô) sẽ nói về HAI lần quét khác nhau — đúng kiểu lệch mà
 * bản thiết kế cấm: phán quyết hiển thị và phán quyết được áp phải là một.
 *
 * Chỉ đọc metadata (`id`, `notes`), không join bảng ứng viên.
 *
 * Nhận `prisma` qua tham số chứ không import singleton: có nơi gọi (ví dụ
 * `market-session-snapshot.ts`) cố ý chỉ phụ thuộc KIỂU của Prisma để test thuần
 * không phải dựng `DATABASE_URL`.
 */
export async function findLatestNonSmokeScanRunId(
  prisma: PrismaClient
): Promise<string | null> {
  const recentRuns = await prisma.dailyScanRun.findMany({
    orderBy: { runAt: "desc" },
    take: LATEST_SCAN_LOOKBACK,
    select: { id: true, notes: true },
  });
  return recentRuns.find((r) => !isSmokeDailyScanRunNotes(r.notes))?.id ?? null;
}
