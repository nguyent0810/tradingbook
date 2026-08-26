"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, Panel, StaleBanner } from "@/components/terminal";
import { GAP, fmtNum, fmtPctSigned, priceToneClass } from "@/lib/format/vn";
import type { F3BattleDetail, F3ViewModel } from "@/lib/paper-lab/terminal/f3-view-model";
import {
  HallOfFamePanel,
  HumanVsAgentPanel,
  LeaderboardPanel,
  SimulationBanner,
} from "./f3-panels";

/** Chi tiết trận đấu — quyết định từng tác tử, độ tin cậy, kết quả 5 phiên, lập luận. */
function BattleDetailModal({
  detail,
  onClose,
}: {
  detail: F3BattleDetail;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="tm-overlay tm-overlay--center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết trận đấu ${detail.symbol} phiên ${detail.session}`}
        style={{ width: 720, maxWidth: "100%" }}
      >
        <div className="tm-modal__head">
          <span className="tm-panel__rule" style={{ background: "var(--tm-ceil)" }} />
          <span className="tm-panel__title">
            TRẬN ĐẤU · {detail.symbol} · {detail.session}
          </span>
          <span className="tm-panel__meta">
            {detail.status} · CHUẨN 5P {fmtPctSigned(detail.benchmarkPct)}
          </span>
          <span className="tm-panel__spacer" />
          <button
            ref={closeRef}
            type="button"
            className="tm-btn tm-btn--ghost tm-btn--sm"
            onClick={onClose}
          >
            ESC ✕
          </button>
        </div>

        <div className="tm-modal__body">
          {detail.rows.length === 0 ? (
            <EmptyState
              icon="∅"
              tone="var(--tm-accent)"
              title="Trận này chưa có quyết định nào"
              note="Trận được tạo nhưng chưa tác tử nào ghi quyết định cho mã này."
              action={
                <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                  TRẬN {detail.id}
                </span>
              }
            />
          ) : (
            detail.rows.map((row, i) => (
              <div key={`${row.agent}-${i}`} className="f3-battle__row">
                <span className="f3-battle__agent">
                  {row.agent}
                  <span
                    className="tm-mono"
                    style={{
                      display: "block",
                      fontSize: 9,
                      fontWeight: 600,
                      color: row.classColor,
                    }}
                  >
                    {row.classLabel}
                  </span>
                </span>
                <span className="f3-battle__why">{row.reasoning || GAP}</span>
                <span className="f3-battle__cell" style={{ color: "var(--tm-text-value)" }}>
                  {row.action}
                </span>
                <span className="f3-battle__cell" style={{ color: "var(--tm-text-mute)" }}>
                  {fmtNum(row.confidence, 2)}
                </span>
                <span className={`f3-battle__cell ${priceToneClass(row.forwardReturn5dPct)}`}>
                  {fmtPctSigned(row.forwardReturn5dPct)}
                </span>
                <span
                  className="f3-battle__cell"
                  style={{ color: row.verdictColor, width: 108 }}
                >
                  {row.verdict}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export type F3ScreenProps = {
  model: F3ViewModel;
  loadError: string | null;
  /** Số đo bảng xếp hạng thuộc một phiên cũ hơn phiên thị trường gần nhất. */
  stale: { sessionLabel: string; consequence: string } | null;
};

/**
 * Màn F3 · Đấu trường mô phỏng.
 * Băng cảnh báo · bảng xếp hạng + trận đấu (trái) · bảng vàng + người vs tác tử (phải).
 */
export function F3Screen({ model, loadError, stale }: F3ScreenProps) {
  const [openBattleId, setOpenBattleId] = useState<string | null>(null);
  const detail = openBattleId ? (model.battleDetails[openBattleId] ?? null) : null;

  return (
    <div className="f3" data-testid="f3-arena">
      <SimulationBanner
        agentCount={model.disclaimer.agentCount}
        decisionCount={model.disclaimer.decisionCount}
        battleCount={model.disclaimer.battleCount}
      />

      {stale ? (
        <StaleBanner sessionLabel={stale.sessionLabel} consequence={stale.consequence} />
      ) : null}

      <div className="f3__body">
        <div className="f3__main">
          {loadError ? (
            <ErrorState
              title="Một phần dữ liệu đấu trường không nạp được"
              note="Các panel bên dưới có thể trống hoặc thiếu cột."
              evidence={loadError}
            />
          ) : null}

          <LeaderboardPanel rows={model.agents} emptyReason={model.agentsEmptyReason} />

          <Panel
            className="f3__battles"
            title="TRẬN ĐẤU CÙNG MÃ"
            tone="ceil"
            meta={model.battles.length > 0 ? "· ĐỐI CHIẾU VỚI CHUẨN 5 PHIÊN" : undefined}
            body={model.battles.length > 0 ? "scroll" : "pad"}
          >
            {model.battles.length === 0 ? (
              <EmptyState
                icon="◇"
                tone="var(--tm-ceil)"
                title="Chưa có trận đấu nào"
                note={
                  model.battlesEmptyReason ??
                  "Cần tối thiểu 2 tác tử cùng ra quyết định trên một mã trong cùng phiên để tạo trận đấu."
                }
                action={
                  <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                    TRẬN ĐƯỢC TẠO TỰ ĐỘNG SAU MỖI PHIÊN
                  </span>
                }
              />
            ) : (
              <table className="tm-table tm-table--sm">
                <thead>
                  <tr>
                    <th>PHIÊN</th>
                    <th>MÃ</th>
                    <th>TRẠNG THÁI</th>
                    <th className="tm-t-num">SỐ TÁC TỬ</th>
                    <th>THẮNG</th>
                    <th className="tm-t-num">CHUẨN 5P</th>
                    <th>BÀI HỌC</th>
                  </tr>
                </thead>
                <tbody>
                  {model.battles.map((row) => (
                    <tr
                      key={row.id}
                      className="tm-row-pick"
                      tabIndex={0}
                      aria-label={`Mở chi tiết trận ${row.symbol} phiên ${row.session}`}
                      onClick={() => setOpenBattleId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenBattleId(row.id);
                        }
                      }}
                    >
                      <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-soft)" }}>
                        {row.session}
                      </td>
                      <td className="tm-t-sym" style={{ fontWeight: 600 }}>
                        {row.symbol}
                      </td>
                      <td>
                        <span
                          className="tm-mono"
                          style={{ fontSize: 10, fontWeight: 600, color: row.statusColor }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                        {fmtNum(row.agentCount, 0)}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--tm-text-base)" }}>
                        {row.winner ?? GAP}
                      </td>
                      <td
                        className={`tm-t-num ${priceToneClass(row.benchmarkPct)}`}
                        style={{ fontSize: 11 }}
                      >
                        {fmtPctSigned(row.benchmarkPct)}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>
                        {row.insight || GAP}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="f3__rail">
          <HallOfFamePanel rows={model.hof} emptyReason={model.hofEmptyReason} />
          <HumanVsAgentPanel rows={model.humanLog} emptyReason={model.humanLogEmptyReason} />
        </div>
      </div>

      {detail ? <BattleDetailModal detail={detail} onClose={() => setOpenBattleId(null)} /> : null}
    </div>
  );
}
