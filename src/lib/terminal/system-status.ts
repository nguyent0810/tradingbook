import "server-only";

import { prisma } from "@/lib/prisma";
import { findLatestNonSmokeScanRunId } from "@/lib/scanner/latest-scan-run";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { readLiveGate1 } from "@/lib/terminal/gate1-live";
import { gate1Color, gate1Label } from "@/lib/terminal/verdict-tokens";
import { isRsWatchlistSnapshotEnabled } from "@/lib/scanner/gate2/rs-watchlist-snapshot";
import { GAP, fmtNum, fmtSessionStamp } from "@/lib/format/vn";

export type SystemStatusRow = {
  key: string;
  value: string;
  color: string;
};

const OK = "var(--tm-up)";
const WARN = "var(--tm-accent)";
const BAD = "var(--tm-down)";
const INFO = "var(--tm-floor)";
const DIM = "var(--tm-text-faint)";

/**
 * Bảng tình trạng hệ thống ở màn F5.
 *
 * Mỗi dòng là một phép đo thật, không phải đèn xanh trang trí: dòng nào không đo
 * được thì hiện `—` màu mờ chứ không mặc định "SẴN SÀNG".
 */
export async function loadSystemStatus(): Promise<SystemStatusRow[]> {
  const dbStartedAt = Date.now();

  const [scan, equityBar, regime, agentCount, dbPing] = await Promise.allSettled([
    // Cùng bộ lọc smoke với mọi nơi khác — xem `latest-scan-run.ts`.
    findLatestNonSmokeScanRunId(prisma).then((id) =>
      id == null
        ? null
        : prisma.dailyScanRun.findUnique({
            where: { id },
            select: { runAt: true, status: true },
          })
    ),
    prisma.stockDailyBar.aggregate({ _max: { date: true } }),
    getMarketRegimeFromDb(),
    prisma.paperAgent.count({ where: { active: true } }),
    prisma.$queryRaw`SELECT 1`,
  ]);

  const dbMs = Date.now() - dbStartedAt;

  const rows: SystemStatusRow[] = [];

  rows.push({
    key: "Cơ sở dữ liệu",
    value: dbPing.status === "fulfilled" ? `${fmtNum(dbMs, 0)} ms` : "KHÔNG KẾT NỐI",
    color: dbPing.status === "fulfilled" ? OK : BAD,
  });

  if (scan.status === "fulfilled" && scan.value) {
    rows.push({
      key: "Bộ quét hằng ngày",
      value: fmtSessionStamp(scan.value.runAt),
      color: scan.value.status === "COMPLETED" ? OK : WARN,
    });
  } else {
    rows.push({
      key: "Bộ quét hằng ngày",
      value: scan.status === "rejected" ? "LỖI TRUY VẤN" : "CHƯA CHẠY",
      color: scan.status === "rejected" ? BAD : DIM,
    });
  }

  const live = regime.status === "fulfilled" ? readLiveGate1(regime.value) : null;
  rows.push({
    key: "Chế độ thị trường (Cổng 1)",
    value: live?.level ? gate1Label(live.level) : GAP,
    color: live?.level ? gate1Color(live.level) : DIM,
  });

  const latestEquityDate =
    equityBar.status === "fulfilled" ? equityBar.value._max.date : null;
  rows.push({
    key: "Nến cổ phiếu mới nhất",
    value: latestEquityDate ? fmtSessionStamp(latestEquityDate) : GAP,
    color: latestEquityDate ? OK : equityBar.status === "rejected" ? BAD : DIM,
  });

  const latestIndexDate =
    regime.status === "fulfilled" ? (regime.value.latestBar?.date ?? null) : null;
  rows.push({
    key: "Nến VNINDEX mới nhất",
    value: latestIndexDate ? fmtSessionStamp(latestIndexDate) : GAP,
    color: latestIndexDate ? OK : DIM,
  });

  rows.push({
    key: "Đấu trường mô phỏng",
    value:
      agentCount.status === "fulfilled"
        ? `${fmtNum(agentCount.value, 0)} TÁC TỬ`
        : "LỖI TRUY VẤN",
    color: agentCount.status === "fulfilled" ? INFO : BAD,
  });

  rows.push({
    key: "Ảnh chụp danh mục RS",
    value: isRsWatchlistSnapshotEnabled() ? "BẬT" : "TẮT",
    color: isRsWatchlistSnapshotEnabled() ? OK : DIM,
  });

  return rows;
}
