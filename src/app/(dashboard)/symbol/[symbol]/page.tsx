import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Panel, PanelSkeleton } from "@/components/terminal";
import { F7Screen } from "@/components/symbol/terminal/f7-screen";
import { buildF7ViewModel, type Bar } from "@/lib/symbol/terminal/f7-view-model";
import { loadTerminalVerdict } from "@/lib/terminal/load-terminal-verdict";
import { getTradingAccountEquityVnd } from "@/lib/trading-account-risk-config";
import { loadRsDiagnosticUiForSymbols } from "@/lib/scanner/gate2/load-rs-diagnostics";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { fmtSessionDate } from "@/lib/format/vn";
import { getLatestDailyScanRun, toCandidateRows } from "@/lib/scanner/setups-queries";
import { isSmokeSetupCandidateRow } from "@/lib/scanner/production-smoke-markers";
import { loadSymbolAdvVnd } from "@/lib/trades/symbol-adv";
import { scanBehindMarketNotice } from "@/lib/terminal/scan-session-staleness";
import "@/styles/terminal-f7.css";

/** Số phiên nến hiển thị trên biểu đồ. */
const CHART_SESSIONS = 64;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const code = symbol.toUpperCase();
  return {
    title: `F7 ${code} — TradeLog VN Terminal`,
    description: `Chi tiết mã ${code}: nến ngày, bảng giá, chỉ báo kỹ thuật và lịch sử bộ quét.`,
  };
}

function SymbolSkeleton() {
  return (
    <div className="f7" aria-busy="true">
      <div className="f7__main">
        <div className="f7__ident">
          <span className="tm-skel-bar" style={{ display: "block", width: 120, height: 24 }} />
        </div>
        <div className="f7__chart-panel">
          <PanelSkeleton rows={6} columns={[600]} label="Đang tải biểu đồ nến" />
        </div>
      </div>
      <div className="f7__rail">
        <Panel title="BẢNG GIÁ" tone="floor" body="none">
          <PanelSkeleton rows={6} columns={[100, 70]} dense label="Đang tải bảng giá" />
        </Panel>
        <Panel title="CHỈ BÁO KỸ THUẬT" tone="up" body="none">
          <PanelSkeleton rows={8} columns={[120, 56, 70]} dense label="Đang tải chỉ báo" />
        </Panel>
      </div>
    </div>
  );
}

async function SymbolContent({ symbolKey }: { symbolKey: string }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const stockSymbol = await prisma.stockSymbol.findUnique({
    where: { symbol: symbolKey },
    select: { id: true, symbol: true, exchange: true },
  });
  if (!stockSymbol) notFound();

  // Lỗi của các nguồn PHỤ gom về đây rồi hiện thành bằng chứng thật; nuốt im
  // sẽ khiến ô trống vì hỏng truy vấn trông y hệt ô trống vì mã chưa đủ dữ liệu.
  //
  // Hai nguồn CỐT LÕI — nến ngày và phán quyết phiên — cố tình KHÔNG bắt lỗi:
  // không có nến thì không có màn để vẽ, và không có phán quyết thì mọi ràng
  // buộc khối lượng đều vô nghĩa. Chúng ném lên `error.tsx` của route để người
  // dùng thấy một trang lỗi có bằng chứng, thay vì một màn trông như bình
  // thường nhưng rỗng ruột.
  const errors: string[] = [];

  /** Nguồn phụ: hỏng thì ghi bằng chứng và trả `fallback`, không sập cả màn. */
  function optional<T>(label: string, fallback: T) {
    return (e: unknown): T => {
      console.error(`[symbol] ${label} failed:`, e);
      errors.push(`${label} thất bại: ${String(e)}`);
      return fallback;
    };
  }

  const [
    barRows,
    latestScan,
    context,
    foreign,
    verdict,
    equityVnd,
    scanHistory,
    marketSession,
  ] = await Promise.all([
      prisma.stockDailyBar.findMany({
        where: { symbolId: stockSymbol.id },
        orderBy: { date: "desc" },
        take: CHART_SESSIONS,
        select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      }),
      // Ứng viên phải thuộc **lần quét gần nhất**, đúng nguồn mà F2 dùng. Lấy
      // hàng `setupCandidate` mới nhất theo `barDate` sẽ cho phép ghi lệnh từ một
      // mã đã rớt khỏi Cổng 2 từ nhiều phiên trước.
      getLatestDailyScanRun()
        .then((run) => ({
          run,
          candidate: toCandidateRows(run).find((c) => c.symbolId === stockSymbol.id) ?? null,
        }))
        .catch(optional("getLatestDailyScanRun()", { run: null, candidate: null })),
      prisma.symbolMarketContextDaily
        .findFirst({
          where: { symbolId: stockSymbol.id },
          orderBy: { sessionDate: "desc" },
          select: { close: true, volMa20: true, volRatioMa20: true, foreignNetValue1d: true },
        })
        .catch(optional("prisma.symbolMarketContextDaily.findFirst()", null)),
      prisma.foreignTradeDaily
        .findFirst({
          where: { symbolId: stockSymbol.id },
          orderBy: { sessionDate: "desc" },
          select: { netValueVnd: true },
        })
        .catch(optional("prisma.foreignTradeDaily.findFirst()", null)),
      loadTerminalVerdict(),
      getTradingAccountEquityVnd(session.userId).catch(
        optional("getTradingAccountEquityVnd()", null)
      ),
      // Lấy dư rồi lọc smoke trong bộ nhớ: marker nằm trong `reasons` (JSON) nên
      // không lọc được bằng `where`. Không lọc thì một hàng do lần quét kiểm thử
      // sinh ra sẽ hiện trong "LỊCH SỬ BỘ QUÉT" y như một lần đạt Cổng 2 thật.
      prisma.setupCandidate
        .findMany({
          where: { symbolId: stockSymbol.id },
          orderBy: { barDate: "desc" },
          take: 24,
          select: { barDate: true, quality: true, rankScore: true, reasons: true },
        })
        .catch(optional("prisma.setupCandidate.findMany()", [])),
      getExpectedLatestSessionFromIndexBars(prisma).catch(
        optional("getExpectedLatestSessionFromIndexBars()", null as Date | null)
      ),
    ]);

  const bars: Bar[] = barRows.slice().reverse();


  // Không có nến ⇒ không có phiên nào để đo RS. Lấy `new Date()` làm phiên là tự
  // đặt ra một mốc không có thật; bỏ hẳn truy vấn và để RS20 là gap.
  const rsMap =
    bars.length > 0
      ? await loadRsDiagnosticUiForSymbols(prisma, [stockSymbol.symbol], bars[bars.length - 1].date)
          .catch(optional("loadRsDiagnosticUiForSymbols()", new Map()))
      : new Map();

  const candidateRow = latestScan.candidate;

  // ADV cho ĐỊNH CỠ phải dùng ĐÚNG hàm và ĐÚNG mốc phiên mà server action dùng
  // khi ghi lệnh (`loadSymbolAdvVnd(prisma, symbolId, setup.barDate)`). Lấy ADV
  // của phiên mới nhất ở đây sẽ cho một trần thanh khoản khác với trần server áp.
  const sizingAdv = candidateRow
    ? await loadSymbolAdvVnd(prisma, stockSymbol.id, candidateRow.barDate)
    : ({ ok: true, value: null } as const);
  if (!sizingAdv.ok) errors.push(sizingAdv.error);

  // Còn ô "GTGD 20N" trên bảng giá là một thống kê thị trường — ở đó phiên MỚI
  // NHẤT mới đúng. Hai con số này trả lời hai câu hỏi khác nhau.
  const avgValue20Vnd =
    context?.close != null && context.volMa20 != null
      ? context.close * 1000 * context.volMa20
      : null;

  // Sức khoẻ thiết lập cần cả bảng theo dõi; ở màn này chỉ lấy mức đã lưu nếu có.
  const watch = candidateRow
    ? await prisma.setupWatchItem
        .findFirst({
          where: { symbolId: stockSymbol.id },
          orderBy: { updatedAt: "desc" },
          select: { healthLevel: true, healthScore: true },
        })
        .catch(optional("prisma.setupWatchItem.findFirst()", null))
    : null;

  // Hàng do lần quét kiểm thử sinh ra không phải một lần đạt Cổng 2 thật.
  const realScanHistory = scanHistory
    .filter((row) => !isSmokeSetupCandidateRow({ symbol: stockSymbol.symbol, reasons: row.reasons }))
    .slice(0, 8);

  const model = buildF7ViewModel({
    symbol: stockSymbol.symbol,
    exchange: stockSymbol.exchange,
    bars,
    candidate: candidateRow
      ? {
          id: candidateRow.id,
          quality: candidateRow.quality,
          rankScore: candidateRow.rankScore,
          pullbackZoneLow: candidateRow.pullbackZoneLow,
          pullbackZoneHigh: candidateRow.pullbackZoneHigh,
          stopLevel: candidateRow.stopLevel,
          healthLevel: watch?.healthLevel ?? null,
          healthScore: watch?.healthScore ?? null,
          // Số phiên nền chỉ nằm trong JSON `reasons` dạng chữ, không có cột
          // cấu trúc nào — để gap thay vì tách chuỗi rồi đoán.
          baseSessions: null,
        }
      : null,
    avgValue20Vnd,
    volumeRatioMa20: context?.volRatioMa20 ?? null,
    foreignNetVnd: foreign?.netValueVnd ?? context?.foreignNetValue1d ?? null,
    rs20SpreadPct: rsMap.get(stockSymbol.symbol)?.rs20SpreadPct ?? null,
    scanHistory: realScanHistory.map((row) => ({
      sessionDate: row.barDate,
      quality: row.quality,
      rankScore: row.rankScore,
    })),
  });

  // Dữ liệu cũ: nến mới nhất của mã này cũ hơn phiên thị trường gần nhất. Khi đó
  // bảng giá, chỉ báo và vùng mua đều tính trên giá cũ — phải nói rõ đang xem
  // phiên nào (bàn giao §6). F7 KHÔNG còn tự tính khối lượng: phiếu ghi lệnh hỏi
  // server tại đúng giá đang nhập, nên đừng nhắc tới nó trong câu cảnh báo này.
  const lastBarDate = bars.length > 0 ? bars[bars.length - 1].date : null;
  // Cùng phép kiểm với F2: vùng mua, cắt lỗ và `setupId` đều đến từ lần quét, nên
  // lần quét đi sau thị trường là ca nặng hơn — xét trước.
  const scanBehind = scanBehindMarketNotice(
    latestScan.run?.expectedSessionDate ?? null,
    marketSession,
    "Vùng mua, cắt lỗ và hạng thiết lập trên màn này đều lấy từ lần quét đó."
  );
  const stale = scanBehind
    ? scanBehind
    : lastBarDate && marketSession && lastBarDate.getTime() < marketSession.getTime()
      ? {
          sessionLabel: fmtSessionDate(lastBarDate),
          consequence: `Thị trường đã có phiên ${fmtSessionDate(
            marketSession
          )} nhưng mã này chưa có nến cho phiên đó. Bảng giá, chỉ báo kỹ thuật và vùng mua bên dưới đều tính trên phiên cũ hơn.`,
        }
      : null;

  return (
    <F7Screen
      model={model}
      verdict={verdict.level}
      equityVnd={equityVnd}
      loadError={errors.length > 0 ? errors.join(String.fromCharCode(10)) : null}
      stale={stale}
    />
  );
}

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const symbolKey = decodeURIComponent(symbol).toUpperCase();

  return (
    <Suspense fallback={<SymbolSkeleton />}>
      <SymbolContent symbolKey={symbolKey} />
    </Suspense>
  );
}
