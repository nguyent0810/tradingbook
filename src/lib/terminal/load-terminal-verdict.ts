import "server-only";

import { prisma } from "@/lib/prisma";
import { findLatestNonSmokeScanRunId } from "@/lib/scanner/latest-scan-run";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import { readLiveGate1 } from "@/lib/terminal/gate1-live";
import { resolveTerminalVerdict, type TerminalVerdict } from "@/lib/terminal/verdict-resolve";
import type { Gate1Level } from "@/lib/scanner/gate2/types";

/**
 * Phán quyết phiên đọc từ cơ sở dữ liệu, dùng ở **phía server**.
 *
 * Server action phải tự dựng lại phán quyết chứ không nhận từ client: ràng buộc
 * khối lượng theo phán quyết là quy tắc rủi ro, mà quy tắc rủi ro thì không được
 * để phía gọi tự khai.
 */
export async function loadTerminalVerdict(): Promise<TerminalVerdict> {
  // PHẢI dùng cùng bộ lọc smoke với các màn. Đọc thô `findFirst` sẽ lấy trúng
  // một lần quét smoke nếu nó mới hơn, và khi đó server áp trần phán quyết của
  // lần quét smoke trong khi màn hình đang hiển thị lần quét thật.
  const latestId = await findLatestNonSmokeScanRunId(prisma);
  const [scan, regime] = await Promise.all([
    latestId == null
      ? Promise.resolve(null)
      : prisma.dailyScanRun.findUnique({
          where: { id: latestId },
          select: {
            id: true,
            runAt: true,
            gate1Level: true,
            candidateCountA: true,
            candidateCountB: true,
            candidateCountSurfaced: true,
            notes: true,
          },
        }),
    getMarketRegimeFromDb(),
  ]);

  return resolveTerminalVerdict({
    scanGate1: (scan?.gate1Level as Gate1Level | undefined) ?? null,
    candidateCountA: scan?.candidateCountA ?? null,
    candidateCountB: scan?.candidateCountB ?? null,
    liveGate1: readLiveGate1(regime),
    scanNotes: scan ? parseDailyScanGate2Notes(scan.notes) : null,
    scan: scan
      ? { id: scan.id, runAt: scan.runAt, candidateCountSurfaced: scan.candidateCountSurfaced }
      : null,
  });
}
