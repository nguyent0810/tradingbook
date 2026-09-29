import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { readLiveGate1 } from "@/lib/terminal/gate1-live";
import { resolveTerminalVerdict } from "@/lib/terminal/verdict-resolve";
import { loadCandidateSparkHistory } from "@/lib/dashboard/candidate-spark-history";
import { buildF2ViewModel } from "@/lib/setups/terminal/f2-view-model";
import { buildScanLog } from "@/lib/setups/terminal/scan-log";
import { F2Screen } from "@/components/setups/terminal/f2-screen";
import { F2Skeleton } from "@/components/setups/terminal/f2-skeleton";
import { fmtSessionDate, fmtSessionStamp } from "@/lib/format/vn";
import { scanBehindMarketNotice } from "@/lib/terminal/scan-session-staleness";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import { loadScreenTradeSuggestions } from "@/lib/trades/load-screen-trade-suggestions";
import {
  loadRsDiagnosticsForSetupsCached,
  loadRsNearMissWatchlistForSetupsCached,
  loadSetupsBaseData,
  loadSurfacedCandidatesHealthCached,
} from "./setups-cached-data";
import "@/styles/terminal-f2.css";

export const metadata: Metadata = {
  title: "F2 Thiết lập — TradeLog VN Terminal",
  description: "Đường ống bộ quét, hồ sơ thiết lập và định cỡ vị thế đề xuất.",
};

/** Số phiên giá kéo về cho biểu đồ hồ sơ thiết lập. */
const PROFILE_SESSIONS = 60;

async function SetupsContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const base = await loadSetupsBaseData();
  const symbolKeys = base.candidateRows.map((c) => c.symbolKey);

  const [{ candidatesWithHealth, healthError }, rsMap, rsWatch, regime] = await Promise.all([
    loadSurfacedCandidatesHealthCached(),
    loadRsDiagnosticsForSetupsCached([
      ...symbolKeys,
      ...(base.notes?.closestToValidSymbols ?? []).map((r) => r.symbol),
    ]),
    loadRsNearMissWatchlistForSetupsCached(),
    getMarketRegimeFromDb("VNINDEX"),
  ]);
  const verdict = resolveTerminalVerdict({
    scanGate1: (base.latest?.gate1Level as Gate1Level | undefined) ?? null,
    candidateCountA: base.latest?.candidateCountA ?? null,
    candidateCountB: base.latest?.candidateCountB ?? null,
    liveGate1: readLiveGate1(regime),
    scanNotes: base.notes,
    scan: base.latest
      ? {
          id: base.latest.id,
          runAt: base.latest.runAt,
          candidateCountSurfaced: base.latest.candidateCountSurfaced,
        }
      : null,
  });

  // Cùng bộ nạp với F1 và F7 (#16), nên ba màn hiện một gợi ý lệnh duy nhất.
  const [spark, suggestions] = await Promise.all([
    loadSparkHistory(candidatesWithHealth, base.expectedSession),
    loadScreenTradeSuggestions({
      userId: session.userId,
      candidates: candidatesWithHealth,
      latestSession: base.latestEquityBarSession,
      expectedSession: base.expectedSession,
      gate1Level: readLiveGate1(regime).level,
      verdictLevel: verdict.level,
    }),
  ]);
  const sizingDefaults = suggestions.sizingDefaults;
  const closesBySymbolId = spark.data;

  const reasonLinesBySymbol: Record<string, string[]> = {};
  for (const candidate of candidatesWithHealth) {
    reasonLinesBySymbol[candidate.symbolKey] = parseSetupCandidateReasons(candidate.reasons).lines;
  }

  const scanLog = base.latest
    ? buildScanLog({
        runAt: base.latest.runAt,
        startedAt: base.latest.startedAt,
        finishedAt: base.latest.finishedAt,
        expectedSessionDate: base.latest.expectedSessionDate,
        status: String(base.latest.status),
        gate1Level: String(base.latest.gate1Level),
        symbolCountTotal: base.latest.symbolCountTotal,
        symbolCountScanned: base.latest.symbolCountScanned,
        symbolCountFailed: base.latest.symbolCountFailed,
        symbolCountAfterTradability: base.latest.symbolCountAfterTradability,
        symbolCountFilteredOut: base.latest.symbolCountFilteredOut,
        candidateCountA: base.latest.candidateCountA,
        candidateCountB: base.latest.candidateCountB,
        candidateCountSurfaced: base.latest.candidateCountSurfaced,
        errorSummary: base.latest.errorSummary,
        notes: base.notes,
        surfaced: candidatesWithHealth.map((c) => ({
          symbol: c.symbolKey,
          quality: c.quality === "A" ? "A" : "B",
          rankScore: c.rankScore,
        })),
      })
    : [];

  const model = buildF2ViewModel({
    candidates: candidatesWithHealth,
    reasonLinesBySymbol,
    rsBySymbol: rsMap.map,
    advBySymbolId: sizingDefaults.advBySymbolId,
    closesBySymbolId,
    suggestionBySetupId: suggestions.bySetupId,
    prospectiveN: suggestions.prospectiveN,
    sizing: { equityVnd: sizingDefaults.equityVnd, unavailable: suggestions.sizingUnavailable },
    closest: base.notes?.closestToValidSymbols ?? [],
    rsWatchRows: rsWatch.panel.rows.map((r) => ({
      symbol: r.symbol,
      rs20SpreadPct: r.rs20SpreadPct,
      topRejectionReason: r.topRejectionReason,
    })),
    // LỖI đứng TRƯỚC lý do rỗng. `buildRsNearMissWatchlistPanel([])` luôn gắn một
    // câu "không có mã nào…" khi danh sách rỗng, kể cả khi rỗng vì truy vấn hỏng
    // — viết `emptyReason ?? error` thì câu chung đó luôn thắng và bằng chứng lỗi
    // không bao giờ hiện ra.
    rsWatchEmptyReason: rsWatch.error ?? rsWatch.panel.emptyReason,
    funnel: {
      universeScanned: base.latest?.symbolCountTotal ?? null,
      statusFilterPassed: base.latest?.symbolCountScanned ?? null,
      tradabilityPassed: base.latest?.symbolCountAfterTradability ?? null,
      qualifiedTotal: base.latest
        ? base.latest.candidateCountA + base.latest.candidateCountB
        : null,
    },
    scanLabel: base.latest ? fmtSessionStamp(base.latest.runAt) : "—",
    scanId: base.latest?.id ?? null,
    scanLog,
    candidatesEmptyReason: base.latest
      ? `Lần quét ${base.latest.id.slice(0, 12)}… hoàn tất với ${base.latest.symbolCountAfterTradability} mã đạt điều kiện giao dịch — không mã nào đạt đủ tiêu chí Hạng A/B.`
      : "Bộ quét hằng ngày chưa chạy lần nào.",
    verdictLevel: verdict.level,
    verdictAllocation: verdict.allocation,
    verdictBlockedReason: verdict.blockedReason,
  });

  const loadError =
    [
      base.scanLoadError,
      base.sessionLoadError,
      base.equityMaxLoadError,
      healthError,
      ...suggestions.errors,
      rsMap.error,
      rsWatch.error,
      spark.error,
    ]
      .filter(Boolean)
      .join(String.fromCharCode(10)) || null;

  // Dữ liệu cũ — HAI kiểu lệch phiên, kiểm cả hai:
  //
  //  (a) LẦN QUÉT cũ hơn thị trường. Toàn bộ ứng viên, vùng mua, cắt lỗ và khối
  //      lượng đề xuất đến từ `base.latest`, tức từ phiên `expectedSessionDate`
  //      của lần quét ĐÓ. Chỉ so bar cổ phiếu với phiên VNINDEX là bỏ lọt: quét
  //      cho phiên 24 trong khi thị trường đã sang phiên 25 thì hai số kia bằng
  //      nhau và banner không bật, dù cả màn đang nói về phiên 24.
  //  (b) Bar cổ phiếu mới hơn phiên VNINDEX mà bộ quét bám.
  //
  // (a) nặng hơn nên xét trước.
  const scanBehind = scanBehindMarketNotice(
    base.latest?.expectedSessionDate ?? null,
    base.expectedSession,
    "Toàn bộ ứng viên, vùng mua, cắt lỗ, phán quyết và khối lượng đề xuất bên dưới đều tính trên phiên cũ hơn."
  );
  const stale = scanBehind
    ? scanBehind
    : base.expectedSession &&
          base.latestEquityBarSession &&
          base.latestEquityBarSession.getTime() > base.expectedSession.getTime()
        ? {
            sessionLabel: fmtSessionDate(base.expectedSession),
            consequence: `Đã có nến cổ phiếu tới ${fmtSessionDate(
              base.latestEquityBarSession
            )} nhưng bộ quét vẫn bám phiên VNINDEX cũ hơn. Phán quyết và định cỡ vị thế bên dưới tính trên phiên cũ.`,
          }
        : null;

  return (
    <F2Screen
      model={model}
      stale={stale}
      loadError={loadError}
      equityVnd={sizingDefaults.equityVnd}
    />
  );
}

/** Giá đóng cửa nhiều phiên cho biểu đồ hồ sơ — một truy vấn cho mọi mã. */
async function loadSparkHistory(
  candidates: Awaited<ReturnType<typeof loadSurfacedCandidatesHealthCached>>["candidatesWithHealth"],
  expectedSession: Date | null
): Promise<{ data: Map<string, number[]>; error: string | null }> {
  if (candidates.length === 0) return { data: new Map(), error: null };
  const through =
    expectedSession ??
    candidates.reduce(
      (latest, c) => (c.barDate > latest ? c.barDate : latest),
      candidates[0]!.barDate
    );
  try {
    return {
      data: await loadCandidateSparkHistory(
        prisma,
        candidates.map((c) => c.symbolId),
        through,
        PROFILE_SESSIONS
      ),
      error: null,
    };
  } catch (e) {
    // Không nuốt: biểu đồ hồ sơ trống vì LỖI khác hẳn với trống vì chưa có nến.
    console.error("[setups] profile history load failed:", e);
    return {
      data: new Map(),
      error: "loadCandidateSparkHistory() that bai: " + String(e),
    };
  }
}

export default function SetupsPage() {
  return (
    <Suspense fallback={<F2Skeleton />}>
      <SetupsContent />
    </Suspense>
  );
}
