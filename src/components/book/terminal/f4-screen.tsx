"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, Panel, StaleBanner } from "@/components/terminal";
import { sparklinePath } from "@/components/terminal/sparkline";
import {
  GAP,
  fmtNum,
  fmtPctSigned,
  fmtVndCompactSigned,
  priceToneClass,
  semanticTone,
} from "@/lib/format/vn";
import type { F4ViewModel } from "@/lib/trades/terminal/f4-view-model";
import { ClosedTradeModal, ManualTradeModal, PositionModal } from "./f4-modals";

const EQ_W = 160;
const EQ_H = 28;

export type F4ScreenProps = {
  model: F4ViewModel;
  loadError: string | null;
  /** Ghi chú sau lệnh theo id, để modal chi tiết điền sẵn. */
  exitNotesById: Record<string, string>;
};

/**
 * Màn F4 · Sổ lệnh.
 * Dải KPI + đường vốn · lệnh đang mở · lệnh đã đóng + sổ nhật ký rủi ro.
 */
export function F4Screen({ model, loadError, exitNotesById }: F4ScreenProps) {
  // Từng hàng đã tự nêu phiên của giá nó dùng, nhưng một bảng dài thì người đọc
  // dễ bỏ sót. Băng tóm tắt ở đầu màn nói thẳng có bao nhiêu vị thế đang định
  // giá bằng dữ liệu cũ và hệ quả (bàn giao §6 · QA §11).
  const staleRows = model.openRows.filter((r) => r.stale);
  const [manualOpen, setManualOpen] = useState(false);
  const [openTradeId, setOpenTradeId] = useState<string | null>(null);
  const [closedTradeId, setClosedTradeId] = useState<string | null>(null);

  const openRow = model.openRows.find((r) => r.id === openTradeId) ?? null;
  const closedRow = model.closedRows.find((r) => r.id === closedTradeId) ?? null;

  const equityPath = sparklinePath(model.equityCurve, EQ_W, EQ_H);
  const equityRising =
    model.equityCurve.length >= 2 &&
    model.equityCurve[model.equityCurve.length - 1] >= model.equityCurve[0];
  const equityTone = equityRising ? "var(--tm-up)" : "var(--tm-down)";

  return (
    <div className="f4" data-testid="f4-book">
      {staleRows.length > 0 ? (
        <StaleBanner
          sessionLabel={`${staleRows.length}/${model.openRows.length} vị thế`}
          consequence={`Các vị thế ${staleRows
            .map((r) => r.symbol)
            .join(", ")} đang định giá bằng dữ liệu cũ hoặc thiếu bar giá. Lãi/lỗ chưa thực hiện, bội số R và tổng giá trị danh mục bên dưới tính trên giá đó. Xem cột LƯU Ý của từng hàng để biết phiên cụ thể.`}
        />
      ) : null}

      <div className="f4__kpis">
        {model.kpis.map((kpi) => (
          <div key={kpi.key} className="f4-kpi">
            <div className="f4-kpi__k">{kpi.key}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="f4-kpi__v" style={{ color: kpi.color }}>
                {kpi.value}
              </span>
              <span className="f4-kpi__sub">{kpi.sub}</span>
            </div>
          </div>
        ))}
        <div className="f4__equity">
          <div className="f4-kpi__k" title={model.equityCurveNote}>
            ĐƯỜNG VỐN THỰC HIỆN
          </div>
          {equityPath ? (
            <svg
              viewBox={`0 0 ${EQ_W} ${EQ_H}`}
              width={EQ_W}
              height={EQ_H}
              fill="none"
              style={{ display: "block", marginTop: 2 }}
              role="img"
              aria-label={model.equityCurveNote}
            >
              <path
                d={`${equityPath} L${EQ_W},${EQ_H} L0,${EQ_H} Z`}
                fill={equityTone}
                fillOpacity="0.1"
              />
              <path d={equityPath} stroke={equityTone} strokeWidth="1.4" />
            </svg>
          ) : (
            <div className="f4-kpi__sub" style={{ marginTop: 6 }}>
              cần ít nhất 1 lệnh đã đóng
            </div>
          )}
        </div>
      </div>

      <div className="f4__body">
        {loadError ? (
          <ErrorState
            title="Một phần dữ liệu sổ lệnh không nạp được"
            note="Các bảng bên dưới có thể trống hoặc thiếu cột."
            evidence={loadError}
          />
        ) : null}

        <Panel
          className="f4__open"
          title="LỆNH ĐANG MỞ"
          tone="up"
          meta={model.openSummary || undefined}
          trailing={
            <button type="button" className="tm-btn tm-btn--sm" onClick={() => setManualOpen(true)}>
              + GHI LỆNH TAY
            </button>
          }
          body={model.openRows.length > 0 ? "scroll" : "pad"}
        >
          {model.openRows.length === 0 ? (
            <EmptyState
              icon="▤"
              tone="var(--tm-up)"
              title="Sổ lệnh còn trống"
              note={model.openEmptyReason ?? "Chưa có vị thế nào đang mở."}
              action={
                <Link href="/setups" className="tm-btn tm-btn--sm">
                  MỞ BẢNG THIẾT LẬP
                </Link>
              }
            />
          ) : (
            <table className="tm-table">
              <thead>
                <tr>
                  <th>MÃ</th>
                  <th>CHIỀU</th>
                  <th className="tm-t-num">KL</th>
                  <th className="tm-t-num">GIÁ VÀO</th>
                  <th className="tm-t-num">GIÁ HIỆN TẠI</th>
                  <th className="tm-t-num">CẮT LỖ</th>
                  <th className="tm-t-num">CHỐT LỜI</th>
                  <th className="tm-t-num">LÃI/LỖ</th>
                  <th className="tm-t-num">%</th>
                  <th className="tm-t-num">R</th>
                  <th>SỨC KHOẺ</th>
                  <th className="tm-t-num">NGÀY GIỮ</th>
                  <th>CẢNH BÁO</th>
                </tr>
              </thead>
              <tbody>
                {model.openRows.map((row) => (
                  <tr
                    key={row.id}
                    className="f4-open-row"
                    style={{ borderLeftColor: row.healthColor }}
                    tabIndex={0}
                    aria-label={`Quản lý vị thế ${row.symbol}`}
                    onClick={() => setOpenTradeId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenTradeId(row.id);
                      }
                    }}
                  >
                    <td className="tm-t-sym">{row.symbol}</td>
                    <td>
                      <span
                        className="tm-mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: ".06em",
                          // Theo CHÍNH chiều lệnh: "BÁN" tô xanh là nói ngược.
                          color: row.direction === "MUA" ? "var(--tm-up)" : "var(--tm-down)",
                        }}
                      >
                        {row.direction}
                      </span>
                    </td>
                    <td className="tm-t-num" style={{ color: "var(--tm-text-mute)" }}>
                      {fmtNum(row.quantity, 0)}
                    </td>
                    <td className="tm-t-num" style={{ color: "var(--tm-text-mute)" }}>
                      {fmtNum(row.entryPrice, 2)}
                    </td>
                    <td
                      className="tm-t-num"
                      style={{ fontWeight: 600, color: "var(--tm-text-value)" }}
                    >
                      {fmtNum(row.markPrice, 2)}
                    </td>
                    <td
                      className="tm-t-num"
                      style={{ fontSize: 11, color: semanticTone(row.stopLoss, "var(--tm-down-soft)") }}
                    >
                      {fmtNum(row.stopLoss, 2)}
                    </td>
                    <td
                      className="tm-t-num"
                      style={{ fontSize: 11, color: semanticTone(row.takeProfit, "var(--tm-up-soft)") }}
                    >
                      {fmtNum(row.takeProfit, 2)}
                    </td>
                    <td
                      className={`tm-t-num ${priceToneClass(row.unrealizedVnd)}`}
                      style={{ fontWeight: 600 }}
                    >
                      {fmtVndCompactSigned(row.unrealizedVnd)}
                    </td>
                    <td className={`tm-t-num ${priceToneClass(row.unrealizedPct)}`}>
                      {fmtPctSigned(row.unrealizedPct)}
                    </td>
                    <td className={`tm-t-num ${priceToneClass(row.rMultiple)}`}>
                      {row.rMultiple != null
                        ? `${row.rMultiple >= 0 ? "+" : ""}${fmtNum(row.rMultiple, 2)}R`
                        : GAP}
                    </td>
                    <td>
                      <span
                        className="tm-mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: ".05em",
                          color: row.healthColor,
                        }}
                      >
                        {row.healthLabel}
                      </span>
                    </td>
                    <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                      {fmtNum(row.holdingDays, 0)}
                    </td>
                    <td
                      style={{ fontSize: 11, color: "var(--tm-text-mute)", whiteSpace: "nowrap" }}
                    >
                      {row.staleReason ?? row.alert ?? GAP}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="f4__bottom">
          <Panel
            className="f4__closed"
            title="LỆNH ĐÃ ĐÓNG"
            tone="floor"
            meta={
              model.closedRows.length > 0
                ? `· ${fmtNum(model.closedRows.length, 0)} LỆNH`
                : undefined
            }
            body={model.closedRows.length > 0 ? "scroll" : "pad"}
          >
            {model.closedRows.length === 0 ? (
              <EmptyState
                icon="∅"
                tone="var(--tm-floor)"
                title="Chưa có lệnh nào đã đóng"
                note={model.closedEmptyReason ?? "Lịch sử trống."}
                action={
                  <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                    LỆNH VÀO ĐÂY SAU KHI ĐÓNG VỊ THẾ
                  </span>
                }
              />
            ) : (
              <table className="tm-table tm-table--sm">
                <thead>
                  <tr>
                    <th>MÃ</th>
                    <th>VÀO</th>
                    <th>RA</th>
                    <th className="tm-t-num">KL</th>
                    <th className="tm-t-num">GIÁ VÀO</th>
                    <th className="tm-t-num">GIÁ RA</th>
                    <th className="tm-t-num">LÃI/LỖ</th>
                    <th className="tm-t-num">R</th>
                    <th>LÝ DO ĐÓNG</th>
                  </tr>
                </thead>
                <tbody>
                  {model.closedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="tm-row-pick"
                      tabIndex={0}
                      aria-label={`Chi tiết lệnh đã đóng ${row.symbol}`}
                      onClick={() => setClosedTradeId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setClosedTradeId(row.id);
                        }
                      }}
                    >
                      <td className="tm-t-sym" style={{ fontWeight: 600, color: "var(--tm-text-strong)" }}>
                        {row.symbol}
                      </td>
                      <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>
                        {row.entryLabel}
                      </td>
                      <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>
                        {row.exitLabel}
                      </td>
                      <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                        {fmtNum(row.quantity, 0)}
                      </td>
                      <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                        {fmtNum(row.entryPrice, 2)}
                      </td>
                      <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                        {fmtNum(row.exitPrice, 2)}
                      </td>
                      <td
                        className={`tm-t-num ${priceToneClass(row.realizedPnlVnd)}`}
                        style={{ fontWeight: 600 }}
                      >
                        {fmtVndCompactSigned(row.realizedPnlVnd)}
                      </td>
                      <td className={`tm-t-num ${priceToneClass(row.rMultiple)}`}>
                        {row.rMultiple != null
                          ? `${row.rMultiple >= 0 ? "+" : ""}${fmtNum(row.rMultiple, 2)}R`
                          : GAP}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            className="f4__risk"
            title="SỔ NHẬT KÝ RỦI RO"
            tone="accent"
            meta="· mốc mở/đóng và đánh giá sức khoẻ"
            body="none"
          >
            {model.riskLog.length === 0 ? (
              <EmptyState
                icon="◴"
                tone="var(--tm-accent)"
                title="Sổ nhật ký trống"
                note={model.riskLogEmptyReason ?? "Chưa có sự kiện nào."}
                action={
                  <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                    SỰ KIỆN ĐƯỢC GHI KHI MỞ / ĐÓNG LỆNH
                  </span>
                }
              />
            ) : (
              <div className="f4-risk">
                {model.riskLog.map((row) => (
                  <div key={row.id} className="f4-risk__row">
                    <span className="f4-risk__t">{row.time}</span>
                    <span className="f4-risk__m" style={{ color: row.color }}>
                      {row.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {manualOpen ? <ManualTradeModal onClose={() => setManualOpen(false)} /> : null}
      {openRow ? <PositionModal row={openRow} onClose={() => setOpenTradeId(null)} /> : null}
      {closedRow ? (
        <ClosedTradeModal
          row={closedRow}
          exitNote={exitNotesById[closedRow.id] ?? ""}
          onClose={() => setClosedTradeId(null)}
        />
      ) : null}
    </div>
  );
}
