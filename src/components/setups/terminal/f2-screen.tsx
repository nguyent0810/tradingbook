"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, Panel, StaleBanner } from "@/components/terminal";
import { fmtNum, fmtPctSigned, priceToneClass } from "@/lib/format/vn";
import type { F2ViewModel } from "@/lib/setups/terminal/f2-view-model";
import { FunnelStrip, Gate2Criteria, ScanLogPanel, SetupProfile, SubList } from "./f2-panels";
import { OrderTicketModal } from "./order-ticket-modal";

export type F2ScreenProps = {
  model: F2ViewModel;
  stale: { sessionLabel: string; consequence: string } | null;
  loadError: string | null;
  equityVnd: number | null;
};

/**
 * Màn F2 · Thiết lập & đường ống bộ quét.
 *
 * Dải phễu trên cùng, rồi ba cột: danh sách ứng viên · hồ sơ mã đang chọn ·
 * nhật ký bộ quét. Mã chọn sẵn lấy từ `?symbol=` để ô TÌM MÃ trên thanh trên và
 * dòng lệnh mở thẳng được vào đúng mã.
 */
export function F2Screen({ model, stale, loadError, equityVnd }: F2ScreenProps) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("symbol")?.toUpperCase() ?? null;

  const initial = useMemo(() => {
    if (requested && model.details[requested]) return requested;
    return model.defaultSymbol;
  }, [requested, model.details, model.defaultSymbol]);

  const [picked, setPicked] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  const selected = picked && model.details[picked] ? picked : initial;
  const detail = selected ? (model.details[selected] ?? null) : null;

  return (
    <div className="f2" data-testid="f2-setups">
      <FunnelStrip cells={model.funnel} scanLabel={model.scanLabel} />

      {stale ? (
        <StaleBanner sessionLabel={stale.sessionLabel} consequence={stale.consequence} />
      ) : null}

      <div className="f2__body">
        <div className="f2__list">
          <Panel
            className="f2__list"
            title="ỨNG VIÊN ĐÃ LỌC"
            tone="up"
            meta={model.candidates.length > 0 ? `· ${fmtNum(model.candidates.length, 0)}` : undefined}
            body="none"
            style={{ flex: 1, minHeight: 0 }}
          >
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {model.candidates.length === 0 ? (
                <EmptyState
                  icon="∅"
                  tone="var(--tm-accent)"
                  title="Không có ứng viên đạt Cổng 2"
                  note={
                    model.candidatesEmptyReason ??
                    "Lần quét gần nhất không đưa mã nào qua đủ tiêu chí Cổng 2."
                  }
                  action={
                    <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                      XEM SUÝT ĐẠT BÊN DƯỚI
                    </span>
                  }
                />
              ) : (
                model.candidates.map((row) => (
                  <button
                    key={row.symbol}
                    type="button"
                    className="f2-cand"
                    aria-pressed={selected === row.symbol}
                    onClick={() => setPicked(row.symbol)}
                  >
                    <span
                      className="tm-tag"
                      style={
                        row.tier === "A"
                          ? { background: "var(--tm-up)", color: "var(--tm-bg-base)" }
                          : undefined
                      }
                    >
                      {row.tier}
                    </span>
                    <span className="f2-cand__body">
                      <span className="f2-cand__head">
                        <span className="f2-cand__sym">{row.symbol}</span>
                        <span
                          className={`tm-mono ${priceToneClass(row.changePct)}`}
                          style={{ fontSize: 10 }}
                        >
                          {fmtPctSigned(row.changePct)}
                        </span>
                      </span>
                      <span className="f2-cand__hint" title={row.hint}>
                        {row.hint}
                      </span>
                    </span>
                    <span className="f2-cand__rank">{fmtNum(row.rankScore, 1)}</span>
                  </button>
                ))
              )}

              <SubList
                title="SUÝT ĐẠT"
                rows={model.nearMiss}
                emptyReason={model.nearMissEmptyReason}
              />
              <SubList
                title="RS DẪN DẮT · TRƯỢT CỔNG 2"
                rows={model.rsWatch}
                emptyReason={model.rsWatchEmptyReason}
              />
            </div>
          </Panel>
        </div>

        <div className="f2__center">
          {loadError ? (
            <ErrorState
              title="Một phần dữ liệu đường ống không nạp được"
              note="Các panel bên dưới có thể trống hoặc thiếu cột."
              evidence={loadError}
            />
          ) : null}

          {detail ? (
            <>
              <SetupProfile
                detail={detail}
                verdictNote={detail.sizingNote ?? model.verdictBlockedReason}
                onLogTrade={() => setTicketOpen(true)}
              />
              <Gate2Criteria rows={detail.gate2} />
            </>
          ) : (
            <Panel title="HỒ SƠ THIẾT LẬP" tone="accent" body="pad" style={{ flex: 1 }}>
              <EmptyState
                icon="◇"
                tone="var(--tm-accent)"
                title="Chưa chọn mã nào"
                note={
                  model.candidates.length === 0
                    ? "Không có ứng viên nào trong lần quét gần nhất để mở hồ sơ."
                    : "Chọn một mã ở cột trái để xem hồ sơ thiết lập và định cỡ vị thế."
                }
                action={
                  <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                    HOẶC GÕ MÃ Ở DÒNG LỆNH
                  </span>
                }
              />
            </Panel>
          )}
        </div>

        <ScanLogPanel rows={model.scanLog} />
      </div>

      {ticketOpen && detail ? (
        <OrderTicketModal
          target={{
            setupId: detail.setupId,
            symbol: detail.symbol,
            tier: detail.tier,
            equityVnd,
          }}
          verdict={model.verdict?.level ?? null}
          onClose={() => setTicketOpen(false)}
        />
      ) : null}
    </div>
  );
}
