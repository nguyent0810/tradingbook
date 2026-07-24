import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadOpenPositionMarks, computeDisplayHoldingDaysUtc } from "@/lib/trades/position-health";
import { deriveTradesLedgerRowFields, type LedgerTradeShape } from "@/lib/trades/trades-ledger-row-derived";
import {
  formatQuantityCell,
  formatSignedVnd,
  formatRMultiple,
  formatTradeLedgerDate,
} from "@/lib/trades/trades-ledger-formatters";
import { formatSignedPct } from "@/lib/trades/unrealized-from-close";
import { LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import { OpenTradeRow, type OpenTradeRowData } from "@/components/book/open-trade-row";
import { ManualTradeForm } from "@/components/book/manual-trade-form";
import "./book.css";

export const metadata: Metadata = {
  title: "Sổ lệnh — TradeLog",
  description: "Theo dõi tự động các lệnh đang mở và lịch sử lệnh đã đóng.",
};

const HEALTH_SEVERITY: Record<string, number> = {
  DEAD: 0,
  AT_RISK: 1,
  WARNING: 2,
  HEALTHY: 3,
};

async function BookContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    orderBy: { entryDate: "desc" },
    include: {
      healthLogs: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const marks = await loadOpenPositionMarks(
    prisma,
    openTrades.map((t) => t.symbol)
  );
  const now = new Date();

  const openRows: OpenTradeRowData[] = openTrades.map((t) => {
    const shape: LedgerTradeShape = {
      id: t.id,
      symbol: t.symbol,
      status: t.status,
      direction: t.direction,
      entryPrice: t.entryPrice,
      quantity: t.quantity,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
    };
    const derived = deriveTradesLedgerRowFields(shape, {
      latestCloseBySymbol: marks.latestCloseBySymbol,
      expectedSessionDate: marks.expectedSessionDate,
      checkedTodayTradeIds: new Set(),
      now,
    });
    const latestLog = t.healthLogs[0] ?? null;

    return {
      id: t.id,
      symbol: t.symbol,
      direction: t.direction,
      entryDateLabel: formatTradeLedgerDate(t.entryDate),
      entryPrice: t.entryPrice,
      quantity: formatQuantityCell(t.quantity),
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      latestCloseLabel: derived.latestBar ? derived.latestBar.close.toLocaleString("en-US") : "—",
      unrealizedLabel: derived.unrealized ? formatSignedVnd(derived.unrealized.pnlAmount) : "—",
      unrealizedPctLabel: derived.unrealized ? formatSignedPct(derived.unrealized.pnlPct) : "",
      rMultipleLabel: formatRMultiple(derived.rMultiple),
      holdingDaysLabel: derived.holdingDays != null ? `${derived.holdingDays} ngày` : "—",
      staleLabel: derived.staleState === true ? "Dữ liệu cũ hơn phiên chuẩn" : null,
      priceUnitMismatch: derived.priceUnitMismatch,
      healthLevel: latestLog?.healthLevel ?? null,
      healthAsOfLabel: latestLog ? `Đánh giá lúc ${formatTradeLedgerDate(latestLog.checkedAt)}` : null,
      recommendedAction: latestLog?.recommendedAction ?? null,
    };
  });

  openRows.sort((a, b) => {
    const sa = a.healthLevel != null ? (HEALTH_SEVERITY[a.healthLevel] ?? 4) : 4;
    const sb = b.healthLevel != null ? (HEALTH_SEVERITY[b.healthLevel] ?? 4) : 4;
    if (sa !== sb) return sa - sb;
    return a.symbol.localeCompare(b.symbol);
  });

  return (
    <>
      <div className="dash-card">
        <div className="dash-card__header book-section-header">
          <div>
            <h2 className="dash-card__title">Đang mở ({openRows.length})</h2>
            <p className="dash-card__lead">
              Sức khỏe lệnh được đánh giá tự động mỗi đêm từ dữ liệu quét. Giá gần nhất và lãi/lỗ chưa
              thực hiện được tính lại mỗi lần tải trang.
            </p>
          </div>
          <ManualTradeForm />
        </div>
        {openRows.length === 0 ? (
          <p className="book-empty">Chưa có lệnh nào đang mở. Ghi lệnh từ trang Thiết lập, hoặc ghi thủ công một mã đã được hệ thống theo dõi.</p>
        ) : (
          <div className="book-table-scroll">
            <table className="book-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Giá vào</th>
                  <th>KL</th>
                  <th>Cắt lỗ / Chốt lãi</th>
                  <th>Giá gần nhất</th>
                  <th>Lãi/lỗ chưa TH</th>
                  <th>R</th>
                  <th>Số ngày giữ</th>
                  <th>Sức khỏe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((row) => (
                  <OpenTradeRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card__header">
          <h2 className="dash-card__title">Đã đóng ({closedTrades.length})</h2>
        </div>
        {closedTrades.length === 0 ? (
          <p className="book-empty">Chưa có lệnh nào đã đóng.</p>
        ) : (
          <div className="book-table-scroll">
            <table className="book-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Vào / Thoát</th>
                  <th>KL</th>
                  <th>Lãi/lỗ thực hiện</th>
                  <th>R</th>
                  <th>Kết quả</th>
                  <th>Số ngày giữ</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="book-symbol">{t.symbol}</span>
                      <span className="book-direction">{t.direction === "LONG" ? "Mua" : "Bán"}</span>
                    </td>
                    <td>
                      {t.entryPrice.toLocaleString("en-US")} → {t.exitPrice?.toLocaleString("en-US") ?? "—"}
                      <span className="book-cell-sub">
                        {formatTradeLedgerDate(t.entryDate)} → {t.exitDate ? formatTradeLedgerDate(t.exitDate) : "—"}
                      </span>
                    </td>
                    <td>{formatQuantityCell(t.quantity)}</td>
                    <td>{formatSignedVnd(t.realizedPnl)}</td>
                    <td>{formatRMultiple(t.rMultiple)}</td>
                    <td>
                      {t.outcome === "WIN" && <span className="book-badge book-badge--ok">Thắng</span>}
                      {t.outcome === "LOSS" && <span className="book-badge book-badge--dead">Thua</span>}
                      {t.outcome === "BREAKEVEN" && <span className="book-badge book-badge--muted">Hòa vốn</span>}
                      {!t.outcome && "—"}
                    </td>
                    <td>
                      {(() => {
                        const days = computeDisplayHoldingDaysUtc({
                          status: t.status,
                          entryDate: t.entryDate,
                          exitDate: t.exitDate,
                          now,
                        });
                        return days != null ? `${days} ngày` : "—";
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function BookPage() {
  return (
    <div className="page-container command-deck dash-cockpit dash-cockpit--v2 pb-10" data-testid="book-page">
      <header className="dash-v2-page-header">
        <div className="dash-v2-page-header__copy">
          <p className="dash-v2-eyebrow">Giao dịch</p>
          <h1 className="dash-v2-page-header__title">Sổ lệnh</h1>
          <p className="dash-v2-page-header__lead">
            Ghi lệnh tự động từ setup đã xác nhận giá vào, theo dõi sức khỏe hàng đêm và đóng lệnh khi cần.
          </p>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Suspense fallback={<LoadingSkeletonGroup rows={2} rowHeight="16rem" />}>
          <BookContent />
        </Suspense>
      </div>
    </div>
  );
}
