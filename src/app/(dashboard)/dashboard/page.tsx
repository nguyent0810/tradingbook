import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { scanBehindMarketNotice } from "@/lib/terminal/scan-session-staleness";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import {
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";
import {
  prepareSurfacedCandidatesHealthView,
  type SurfacedCandidateHealthView,
} from "@/lib/setup-health";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import type { SetupHealthLevelValue } from "@/lib/setup-health/types";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { fetchVnindexHistoryCached } from "@/lib/market/fetch-vnindex-history";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { fetchMarketContextUi } from "@/lib/market/fetch-market-context-ui";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import { buildDecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { loadRsDiagnosticUiForSymbols } from "@/lib/scanner/gate2/load-rs-diagnostics";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import {
  buildRsNearMissWatchlistPanel,
  getCachedRsNearMissWatchlist,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import {
  isRsWatchlistSnapshotEnabled,
  persistRsWatchlistSnapshot,
} from "@/lib/scanner/gate2/rs-watchlist-snapshot";
import { buildLatestCloseBySymbol } from "@/lib/dashboard/latest-close-by-symbol";
import { loadCandidateSparkHistory } from "@/lib/dashboard/candidate-spark-history";
import { buildF1ViewModel } from "@/lib/dashboard/terminal/f1-view-model";
import { readLiveGate1 } from "@/lib/terminal/gate1-live";
import { F1Screen } from "@/components/dashboard/terminal/f1-screen";
import { fmtSessionDate } from "@/lib/format/vn";
import "@/styles/terminal-f1.css";

export const metadata: Metadata = {
  title: "F1 Điều khiển — TradeLog VN Terminal",
  description: "Phán quyết phiên, thiết lập Hạng A/B và bối cảnh thị trường.",
};

type Fallible<T> = { data: T; error: string | null };

/**
 * Hàng danh mục theo dõi giữ nguyên hình dạng Prisma (`symbol: { symbol }`) vì
 * `buildDashboardCockpitInput` nhận đúng hình dạng đó; view model F1 tự làm phẳng.
 */
type WatchItem = {
  symbolId: string;
  symbol: { symbol: string };
  lifecycleStatus: SetupLifecycleStatus;
  healthLevel: SetupHealthLevelValue | null;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
};

async function loadLatestScan(): Promise<
  Fallible<Awaited<ReturnType<typeof getLatestDailyScanRun>>>
> {
  try {
    return { data: await getLatestDailyScanRun(), error: null };
  } catch (e) {
    console.error("[dashboard] latest scan query failed:", e);
    return {
      data: null,
      error: "getLatestDailyScanRun() → prisma.dailyScanRun.findMany thất bại: " + String(e),
    };
  }
}

async function loadActiveWatchItems(): Promise<Fallible<WatchItem[]>> {
  try {
    const rows = await prisma.setupWatchItem.findMany({
      where: {
        lifecycleStatus: {
          in: [
            SetupLifecycleStatus.NEW,
            SetupLifecycleStatus.WATCHING,
            SetupLifecycleStatus.READY,
          ],
        },
      },
      orderBy: [{ lifecycleStatus: "asc" }, { updatedAt: "desc" }],
      take: 21,
      select: {
        symbolId: true,
        symbol: { select: { symbol: true } },
        lifecycleStatus: true,
        healthLevel: true,
        pullbackZoneLow: true,
        pullbackZoneHigh: true,
      },
    });
    return { data: rows, error: null };
  } catch (e) {
    console.error("[dashboard] watch item query failed:", e);
    return {
      data: [],
      error: "prisma.setupWatchItem.findMany thất bại: " + String(e),
    };
  }
}

async function loadMarketContext(
  benchmarkDate: string | null,
  rawCandidates: ReturnType<typeof toCandidateRows>,
  scanNotes: DailyScanGate2Notes | null
): Promise<{ data: MarketContextUiDto | null; error: string | null }> {
  if (!benchmarkDate) return { data: null, error: null };
  try {
    const rsSymbolsForContext = [
      ...new Set([
        ...rawCandidates.map((c) => c.symbolKey),
        ...(scanNotes?.closestToValidSymbols ?? []).slice(0, 12).map((r) => r.symbol),
      ]),
    ];
    return {
      data: await fetchMarketContextUi(prisma, benchmarkDate, { symbols: rsSymbolsForContext }),
      error: null,
    };
  } catch (e) {
    console.error("[dashboard] market context load failed:", e);
    return { data: null, error: "fetchMarketContextUi() thất bại: " + String(e) };
  }
}

async function loadCandidatesWithHealth(
  rawCandidates: ReturnType<typeof toCandidateRows>,
  evalDate: Date
): Promise<Fallible<SurfacedCandidateHealthView[]>> {
  if (rawCandidates.length === 0) return { data: [], error: null };
  try {
    const data = await prepareSurfacedCandidatesHealthView(prisma, rawCandidates, evalDate);
    return { data, error: null };
  } catch (e) {
    console.error("[dashboard] candidate health query failed:", e);
    return {
      data: [],
      error: "prepareSurfacedCandidatesHealthView() thất bại: " + String(e),
    };
  }
}

async function loadLatestCloseBySymbol(
  activeWatchItems: WatchItem[]
): Promise<{ data: Map<string, number>; error: string | null }> {
  if (activeWatchItems.length === 0) return { data: new Map(), error: null };
  try {
    return {
      data: await buildLatestCloseBySymbol(
        prisma,
        activeWatchItems.map((item) => item.symbolId),
        new Date()
      ),
      error: null,
    };
  } catch (e) {
    console.error("[dashboard] latest close lookup failed:", e);
    return {
      data: new Map(),
      error: "buildLatestCloseBySymbol() thất bại: " + String(e),
    };
  }
}

async function loadRsDiagnosticsBySymbol(
  candidatesWithHealth: SurfacedCandidateHealthView[],
  scanNotes: DailyScanGate2Notes | null,
  rsSession: Date | null
): Promise<{ data: Record<string, RsDiagnosticUi> | undefined; error: string | null }> {
  if (!rsSession) return { data: undefined, error: null };
  const rsSymbols = [
    ...new Set([
      ...candidatesWithHealth.map((c) => c.symbolKey),
      ...(scanNotes?.closestToValidSymbols ?? []).slice(0, 12).map((r) => r.symbol),
    ]),
  ];
  if (rsSymbols.length === 0) return { data: undefined, error: null };
  try {
    const rsMap = await loadRsDiagnosticUiForSymbols(prisma, rsSymbols, rsSession);
    const rsDiagnosticsBySymbol: Record<string, RsDiagnosticUi> = {};
    for (const [sym, ui] of rsMap) {
      if (ui) rsDiagnosticsBySymbol[sym] = ui;
    }
    return { data: rsDiagnosticsBySymbol, error: null };
  } catch (e) {
    console.error("[dashboard] RS diagnostic load failed:", e);
    return {
      data: undefined,
      error: "loadRsDiagnosticUiForSymbols() thất bại: " + String(e),
    };
  }
}

async function loadRsNearMiss(
  candidatesWithHealth: SurfacedCandidateHealthView[],
  rsSession: Date | null
) {
  const empty = {
    panel: buildRsNearMissWatchlistPanel([]),
    rowsForSnapshot: [] as Awaited<ReturnType<typeof getCachedRsNearMissWatchlist>>["rows"],
    tradabilityCount: 0,
    uiMap: undefined as Map<string, RsDiagnosticUi | null> | undefined,
    error: null as string | null,
  };
  if (!rsSession) return empty;
  try {
    const excludeSymbols = candidatesWithHealth.map((c) => c.symbolKey);
    const { rows, tradabilityPassedCount, earlyEntryBySymbol } =
      await getCachedRsNearMissWatchlist({ limit: 12, excludeSymbols });
    const rsMap = await loadRsDiagnosticUiForSymbols(
      prisma,
      rows.map((r) => r.symbol),
      rsSession
    );
    return {
      panel: buildRsNearMissWatchlistPanel(rows, rsMap, earlyEntryBySymbol),
      rowsForSnapshot: rows,
      tradabilityCount: tradabilityPassedCount,
      uiMap: rsMap,
      error: null as string | null,
    };
  } catch (e) {
    // KHÔNG trả `empty` trơn: panel rỗng vì lỗi trông y hệt panel rỗng vì không
    // có mã nào suýt đạt. Kèm lỗi để F1 dựng trạng thái lỗi có bằng chứng.
    console.error("[dashboard] RS near-miss watchlist failed:", e);
    return {
      ...empty,
      error: "getCachedRsNearMissWatchlist() thất bại: " + String(e),
    };
  }
}

/** Sparkline 20 phiên cho ứng viên — một truy vấn cho mọi mã, không lặp. */
async function loadSparkHistory(
  candidatesWithHealth: SurfacedCandidateHealthView[],
  evalDate: Date
): Promise<{ data: Map<string, number[]>; error: string | null }> {
  if (candidatesWithHealth.length === 0) return { data: new Map(), error: null };
  try {
    return {
      data: await loadCandidateSparkHistory(
        prisma,
        candidatesWithHealth.map((c) => c.symbolId),
        evalDate
      ),
      error: null,
    };
  } catch (e) {
    console.error("[dashboard] spark history load failed:", e);
    return {
      data: new Map(),
      error: "loadCandidateSparkHistory() thất bại: " + String(e),
    };
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Tier 1 — chỉ phụ thuộc phiên đăng nhập; chạy cùng lúc.
  const [[regime, marketSnapshot], latestScanResult, activeWatchItemsResult, vnindexHistoryResult] =
    await Promise.all([
      Promise.all([getMarketRegimeFromDb("VNINDEX"), fetchMarketSessionSnapshot(prisma)]),
      loadLatestScan(),
      loadActiveWatchItems(),
      fetchVnindexHistoryCached(30),
    ]);

  const latestScan = latestScanResult.data;
  const watchlistTruncated = activeWatchItemsResult.data.length > 20;
  const activeWatchItems = activeWatchItemsResult.data.slice(0, 20);

  const alignmentAnalysis = analyzeMarketDataAlignment(marketSnapshot);
  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
  const freshness = buildMarketFreshnessDto({
    snapshot: marketSnapshot,
    alignment: alignmentAnalysis,
    delayedBackdropFromScanNotes: scanNotes?.benchmarkBackdrop?.delayedBackdrop === true,
    scanSessionCoverage: scanNotes?.sessionCoverage ?? null,
  });

  const rawCandidates = toCandidateRows(latestScan);
  const evalDate =
    rawCandidates.length > 0
      ? rawCandidates.reduce(
          (latestDate, c) => (c.barDate > latestDate ? c.barDate : latestDate),
          rawCandidates[0]!.barDate
        )
      : (latestScan?.runAt ?? new Date());

  // Tier 2 — mỗi cái chỉ phụ thuộc Tier 1, độc lập với nhau.
  const [marketContextResult, candidatesHealthResult, latestClose] = await Promise.all([
    loadMarketContext(freshness.benchmarkDate, rawCandidates, scanNotes),
    loadCandidatesWithHealth(rawCandidates, evalDate),
    loadLatestCloseBySymbol(activeWatchItems),
  ]);
  const candidatesWithHealth = candidatesHealthResult.data;

  const rsSession =
    marketSnapshot.benchmarkSessionDate ?? (rawCandidates.length > 0 ? evalDate : null);

  // Tier 3 — cùng phụ thuộc candidatesWithHealth/rsSession, độc lập với nhau.
  const [rsDiagnostics, rsNearMiss, spark] = await Promise.all([
    loadRsDiagnosticsBySymbol(candidatesWithHealth, scanNotes, rsSession),
    loadRsNearMiss(candidatesWithHealth, rsSession),
    loadSparkHistory(candidatesWithHealth, evalDate),
  ]);

  // Gom MỌI đường lỗi: loader nào nuốt lỗi rồi trả rỗng thì panel tương ứng sẽ
  // trông y hệt "không có dữ liệu". Bằng chứng phải đi tới được `ErrorState`.
  const dbLoadError =
    [
      latestScanResult.error,
      candidatesHealthResult.error,
      activeWatchItemsResult.error,
      latestClose.error,
      marketSnapshot.error,
      vnindexHistoryResult.error,
      marketContextResult.error,
      rsDiagnostics.error,
      rsNearMiss.error,
      spark.error,
    ]
      .filter(Boolean)
      .join(String.fromCharCode(10)) || null;

  const cockpitDto = buildDecisionCockpitDto(
    buildDashboardCockpitInput({
      latestScan,
      scanNotes,
      regime,
      freshness,
      candidatesWithHealth,
      activeWatchItems,
      rsDiagnosticsBySymbol: rsDiagnostics.data,
      rsNearMissWatchlist: rsNearMiss.panel,
      marketContext: marketContextResult.data,
    })
  );

  // Ghi snapshot không ảnh hưởng response — đẩy ra sau khi trả trang.
  if (isRsWatchlistSnapshotEnabled() && rsSession && rsNearMiss.rowsForSnapshot.length > 0) {
    const sessionDate = rsSession;
    const rowsForSnapshot = rsNearMiss.rowsForSnapshot;
    const tradabilityCount = rsNearMiss.tradabilityCount;
    const uiMap = rsNearMiss.uiMap;
    const verdictUxLevel = cockpitDto.verdict.uxLevel.value;
    after(async () => {
      try {
        await persistRsWatchlistSnapshot(prisma, {
          sessionDate,
          rows: rowsForSnapshot,
          verdictUxLevel,
          tradabilityPassedCount: tradabilityCount,
          rsUiBySymbol: uiMap,
        });
      } catch (e) {
        // Chỉ ghi log, KHÔNG gom vào `dbLoadError`: khối này chạy trong `after()`,
        // tức sau khi response đã gửi đi. Không còn UI nào để hiện bằng chứng, và
        // đây là một lần ghi snapshot phụ — hỏng nó không làm sai số nào đang hiện
        // trên màn. Đây là ngoại lệ DUY NHẤT của luật "lỗi phải kèm bằng chứng".
        console.error("[dashboard] RS watchlist snapshot failed:", e);
      }
    });
  }

  const model = buildF1ViewModel({
    cockpit: cockpitDto,
    candidates: candidatesWithHealth,
    rsDiagnosticsBySymbol: rsDiagnostics.data,
    sparkBySymbolId: spark.data,
    liveGate1: readLiveGate1(regime),
    vnindexHistory: vnindexHistoryResult.points,
    vnindexHistoryError: vnindexHistoryResult.error,
    watchItems: activeWatchItems.map((item) => ({
      symbol: item.symbol.symbol,
      symbolId: item.symbolId,
      lifecycleStatus: item.lifecycleStatus,
    })),
    latestCloseBySymbolId: latestClose.data,
    watchTruncated: watchlistTruncated,
    universeScanned: latestScan?.symbolCountTotal ?? null,
    statusFilterPassed: latestScan?.symbolCountScanned ?? null,
    tradabilityPassed: latestScan?.symbolCountAfterTradability ?? null,
  });

  // Dữ liệu cũ — HAI kiểu lệch phiên.
  //
  //  (a) LẦN QUÉT cũ hơn thị trường: phán quyết, phễu, ứng viên và định cỡ đều
  //      đến từ `latestScan`, tức từ phiên `expectedSessionDate` của lần quét ĐÓ.
  //      `freshness` không bắt được ca này — nó so ngày CHẠY scan với ngày
  //      VNINDEX, nên một lần quét chạy hôm nay CHO phiên hôm qua vẫn "khớp".
  //  (b) Các lệch phiên khác mà `buildMarketFreshnessDto` đã bắt (bar cổ phiếu
  //      mới hơn VNINDEX, backdrop trễ, phiên quét phủ thiếu).
  //
  // (a) nặng hơn nên xét trước.
  const scanBehind = scanBehindMarketNotice(
    latestScan?.expectedSessionDate ?? null,
    marketSnapshot.benchmarkSessionDate,
    "Phán quyết, phễu bộ quét, danh sách thiết lập và định cỡ vị thế bên dưới đều tính trên phiên cũ hơn."
  );

  const staleFlag = freshness.staleFlags.find((f) => f.severity !== "info") ?? null;
  const stale = scanBehind
    ? scanBehind
    : staleFlag
      ? {
          sessionLabel: freshness.benchmarkDate
            ? fmtSessionDate(new Date(`${freshness.benchmarkDate}T00:00:00.000Z`))
            : "không xác định",
          consequence: `${staleFlag.message} Phán quyết và định cỡ vị thế bên dưới đều tính trên phiên này.`,
        }
      : null;

  return <F1Screen model={model} stale={stale} loadError={dbLoadError} />;
}
