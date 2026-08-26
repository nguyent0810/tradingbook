import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Cơ sở dữ liệu có phản hồi không.
 *
 * Dùng ở màn Phiên (F6) để người dùng biết trước là đăng nhập có chạy được hay
 * không, thay vì bấm rồi nhận lỗi chung chung. Chỉ một chỉ báo boolean — không
 * lộ mốc vận hành nào cho người chưa đăng nhập.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("[auth] database ping failed:", e);
    return false;
  }
}
