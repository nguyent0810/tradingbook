"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, Panel, StaleBanner } from "@/components/terminal";
import { GAP, fmtNum, fmtPctSigned, priceToneClass } from "@/lib/format/vn";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { F7ViewModel } from "@/lib/symbol/terminal/f7-view-model";
import { OrderTicketModal } from "@/components/setups/terminal/order-ticket-modal";

/** Khung vẽ nội bộ; toạ độ trong view model là 0..1 nên nhân thẳng vào đây. */
const W = 780;
const H = 300;

function CandleChart({ model }: { model: F7ViewModel }) {
  if (model.chartEmptyReason) {
    return (
      <EmptyState
        icon="◴"
        tone="var(--tm-floor)"
        title="Chưa đủ dữ liệu để vẽ nến"
        note={model.chartEmptyReason}
        action={
          <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
            CHẠY `npm run data:vnindex` VÀ NHẬP NẾN CỔ PHIẾU
          </span>
        }
      />
    );
  }

  const barWidth = model.candles.length > 1 ? (W / model.candles.length) * 0.62 : 6;
  const maPath = model.ma20
    .map((y, i) =>
      y == null ? null : `${model.candles[i].x * W},${y * H}`
    )
    .reduce<string[]>((acc, point) => {
      if (point == null) return acc;
      acc.push(`${acc.length === 0 ? "M" : "L"}${point}`);
      return acc;
    }, [])
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      fill="none"
      className="f7__chart"
      role="img"
      aria-label={`${model.symbol}: nến ngày ${model.candles.length} phiên, MA20, vùng mua và cắt lỗ`}
    >
      {model.zoneBand ? (
        <rect
          x="0"
          y={model.zoneBand.topY * H}
          width={W}
          height={model.zoneBand.height * H}
          fill="var(--tm-up)"
          fillOpacity="0.08"
        />
      ) : null}
      {model.stopY != null ? (
        <line
          x1="0"
          y1={model.stopY * H}
          x2={W}
          y2={model.stopY * H}
          stroke="var(--tm-down)"
          strokeWidth="1"
          strokeDasharray="5 4"
        />
      ) : null}

      {model.candles.map((c, i) => {
        const tone = c.rising ? "var(--tm-up)" : "var(--tm-down)";
        const x = c.x * W;
        return (
          <g key={i}>
            <line x1={x} y1={c.highY * H} x2={x} y2={c.lowY * H} stroke={tone} strokeWidth="1" />
            <rect
              x={x - barWidth / 2}
              y={c.bodyTopY * H}
              width={barWidth}
              height={c.bodyHeight * H}
              fill={tone}
            />
            <rect
              x={x - barWidth / 2}
              y={H - c.volumeHeight * H}
              width={barWidth}
              height={c.volumeHeight * H}
              fill={tone}
              fillOpacity="0.3"
            />
          </g>
        );
      })}

      {maPath ? <path d={maPath} stroke="var(--tm-accent)" strokeWidth="1.3" opacity="0.85" /> : null}
    </svg>
  );
}

export type F7ScreenProps = {
  model: F7ViewModel;
  verdict: VerdictUxLevel | null;
  equityVnd: number | null;
  /** Lỗi nạp từng phần, kèm bằng chứng thật. */
  loadError: string | null;
  /** Nến mới nhất của mã cũ hơn phiên thị trường gần nhất. */
  stale: { sessionLabel: string; consequence: string } | null;
};

/**
 * Màn F7 · Chi tiết mã.
 * Nhận diện + nến ngày (trái) · bảng giá, chỉ báo, lịch sử quét (phải).
 */
export function F7Screen({
  model,
  verdict,
  equityVnd,
  loadError,
  stale,
}: F7ScreenProps) {
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <div className="f7" data-testid="f7-symbol">
      <div className="f7__main">
        <div className="f7__ident">
          <span className="f7__sym">{model.symbol}</span>
          <span className="f7__px">{fmtNum(model.close, 2)}</span>
          <span className={`f7__chg ${priceToneClass(model.changePct)}`}>
            {fmtPctSigned(model.changePct)}
          </span>
          {model.tier ? (
            <span className="f7__tier">
              HẠNG {model.tier} · {fmtNum(model.rankScore, 1)}
            </span>
          ) : (
            <span className="f7__tier" style={{ color: "var(--tm-text-faint)" }}>
              CHƯA ĐẠT CỔNG 2
            </span>
          )}
          <span className="tm-panel__spacer" />
          <button
            type="button"
            className="tm-btn tm-btn--primary"
            style={{ ["--tm-btn-tone" as string]: "var(--tm-up)" }}
            onClick={() => setTicketOpen(true)}
            disabled={model.setupId == null}
            title={
              model.setupId == null
                ? "Chỉ ghi lệnh được từ mã đang là ứng viên Cổng 2"
                : undefined
            }
          >
            GHI LỆNH
          </button>
          <Link href={`/setups?symbol=${encodeURIComponent(model.symbol)}`} className="tm-btn">
            HỒ SƠ THIẾT LẬP
          </Link>
        </div>

        {stale ? (
          <StaleBanner sessionLabel={stale.sessionLabel} consequence={stale.consequence} />
        ) : null}

        {loadError ? (
          <ErrorState
            title="Một phần dữ liệu mã này không nạp được"
            note="Các ô bên dưới có thể để trống. Ô trống vì lỗi KHÁC ô trống vì mã chưa đủ dữ liệu — đọc bằng chứng để phân biệt."
            evidence={loadError}
          />
        ) : null}

        <div className="f7__chart-panel">
          <div className="f7__chart-head">
            <span className="tm-eyebrow">NẾN NGÀY · {fmtNum(model.candles.length, 0)} PHIÊN</span>
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-dim)" }}>
              MA20 amber · vùng mua xanh · cắt lỗ đỏ · dải dưới là khối lượng
            </span>
          </div>
          <CandleChart model={model} />
        </div>
      </div>

      <div className="f7__rail">
        <Panel title="BẢNG GIÁ" tone="floor" body="none" style={{ flex: "none" }}>
          <div className="f7-quote">
            {model.quote.map((cell) => (
              <div key={cell.key} className="f7-quote__cell">
                <span className="f7-quote__k">{cell.key}</span>
                <span className="f7-quote__v" style={{ color: cell.color }}>
                  {cell.value}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="CHỈ BÁO KỸ THUẬT" tone="up" body="none" style={{ flex: "none" }}>
          <div>
            {model.tech.map((row) => (
              <div key={row.key} className="f7-tech__row">
                <span className="f7-tech__k">{row.key}</span>
                <span className="f7-tech__v">{row.value}</span>
                <span className="f7-tech__s" style={{ color: row.color }}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="LỊCH SỬ BỘ QUÉT"
          tone="ceil"
          body="none"
          style={{ flex: "none" }}
        >
          {model.history.length === 0 ? (
            <EmptyState
              icon="∅"
              tone="var(--tm-ceil)"
              title="Chưa có lần quét nào ghi nhận mã này"
              note={model.historyEmptyReason ?? ""}
              action={
                <Link href="/setups" className="tm-btn tm-btn--sm">
                  MỞ ĐƯỜNG ỐNG
                </Link>
              }
            />
          ) : (
            <div className="f7-history">
              {model.history.map((row) => (
                <div key={`${row.time}-${row.message}`} className="f7-history__row">
                  <span className="f7-history__t">{row.time || GAP}</span>
                  <span style={{ color: row.color }}>{row.message}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {ticketOpen && model.setupId ? (
        <OrderTicketModal
          target={{
            setupId: model.setupId,
            symbol: model.symbol,
            tier: model.tier === "A" ? "A" : "B",
            equityVnd,
          }}
          verdict={verdict}
          onClose={() => setTicketOpen(false)}
        />
      ) : null}
    </div>
  );
}
