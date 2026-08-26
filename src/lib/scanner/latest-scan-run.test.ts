import { describe, expect, it, vi } from "vitest";
import { findLatestNonSmokeScanRunId } from "./latest-scan-run";
import type { PrismaClient } from "@/generated/prisma/client";

function fakePrisma(rows: { id: string; notes: unknown }[]) {
  return {
    dailyScanRun: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaClient;
}

const SMOKE = { p0dExitHealthSmoke: true };

describe("lần quét thật gần nhất", () => {
  it("bỏ qua lần quét smoke dù nó mới hơn", async () => {
    // Đây là ca khiến màn hình và server nói về HAI lần quét khác nhau nếu mỗi
    // bên tự đọc `findFirst({ orderBy: { runAt: "desc" } })`.
    const id = await findLatestNonSmokeScanRunId(
      fakePrisma([
        { id: "smoke-moi-nhat", notes: SMOKE },
        { id: "that", notes: { sessionCoverage: "full" } },
      ])
    );
    expect(id).toBe("that");
  });

  it("lần quét mới nhất là thật thì lấy luôn", async () => {
    const id = await findLatestNonSmokeScanRunId(
      fakePrisma([{ id: "that", notes: null }, { id: "cu", notes: null }])
    );
    expect(id).toBe("that");
  });

  it("toàn smoke thì trả null, KHÔNG rơi về một lần quét smoke", async () => {
    const id = await findLatestNonSmokeScanRunId(
      fakePrisma([{ id: "s1", notes: SMOKE }, { id: "s2", notes: SMOKE }])
    );
    expect(id).toBeNull();
  });

  it("chưa có lần quét nào thì trả null", async () => {
    expect(await findLatestNonSmokeScanRunId(fakePrisma([]))).toBeNull();
  });
});
