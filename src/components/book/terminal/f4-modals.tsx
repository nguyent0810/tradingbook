"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  closeTrade,
  createManualTrade,
  previewManualTradeLevels,
  updateTradeExitNote,
  updateTradeStopLoss,
  type ManualTradeLevelsPreview,
  type TradeActionState,
} from "@/app/actions/trades";
import {
  GAP,
  fmtNum,
  fmtPctSigned,
  fmtVndCompactSigned,
  priceToneVar,
} from "@/lib/format/vn";
import type { F4ClosedRow, F4OpenRow } from "@/lib/trades/terminal/f4-view-model";

/** Khung lớp phủ dùng chung: ESC đóng, click nền đóng, focus vào nút đóng. */
function ModalFrame({
  title,
  meta,
  tone,
  width,
  onClose,
  children,
  footer,
}: {
  title: string;
  meta?: string;
  tone: string;
  width: number;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
        aria-label={title}
        style={{ width, maxWidth: "100%" }}
      >
        <div className="tm-modal__head">
          <span className="tm-panel__rule" style={{ background: tone }} />
          <span className="tm-panel__title">{title}</span>
          {meta ? <span className="tm-panel__meta">{meta}</span> : null}
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
        <div className="tm-modal__body">{children}</div>
        {footer ? <div className="tm-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

function ActionFeedback({ state }: { state: TradeActionState }) {
  if (!state) return null;
  const lines = [
    ...Object.entries(state.errors ?? {}).map(([field, msgs]) => `${field}: ${msgs.join(" · ")}`),
    ...(state.message && !state.success ? [state.message] : []),
  ];
  if (lines.length === 0) return null;
  return (
    <pre className="tm-evidence" style={{ margin: "0 11px 9px" }}>
      {lines.join("\n")}
    </pre>
  );
}

/** Ghi lệnh tay — cho lệnh khớp ngoài hệ thống (bàn giao §5). */
export function ManualTradeModal({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [preview, setPreview] = useState<ManualTradeLevelsPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(
    createManualTrade,
    undefined
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const suggest = async () => {
    const code = symbol.trim().toUpperCase();
    if (!code) return;
    setLoadingPreview(true);
    const result = await previewManualTradeLevels(code);
    setPreview(result);
    setLoadingPreview(false);
  };

  return (
    <ModalFrame title="GHI LỆNH TAY" tone="var(--tm-floor)" width={560} onClose={onClose}>
      <form action={formAction} id="manual-trade-form">
        <div className="tm-field">
          <div>
            <label className="tm-field__label" htmlFor="manual-symbol">
              MÃ
            </label>
            <div className="tm-field__note" id="manual-symbol-note">
              Mã phải nằm trong vũ trụ hệ thống theo dõi thì mới tính được gợi ý.
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              className="tm-input"
              id="manual-symbol"
              name="symbol"
              aria-describedby="manual-symbol-note"
              value={symbol}
              maxLength={10}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
            <button type="button" className="tm-btn tm-btn--sm" onClick={suggest} disabled={loadingPreview}>
              GỢI Ý
            </button>
          </div>
        </div>

        {preview && !preview.ok ? (
          <pre className="tm-evidence" style={{ margin: "0 11px 9px" }}>
            {preview.message}
          </pre>
        ) : null}

        {preview?.ok ? (
          <div className="tm-note" style={{ margin: "0 11px 9px" }}>
            Gợi ý từ dữ liệu giá tới phiên {preview.asOfBarDate.slice(0, 10)}: giá đóng{" "}
            {fmtNum(preview.latestClose, 2)} · cắt lỗ {fmtNum(preview.suggestedStopLoss, 2)} (
            {preview.stopReason}) · chốt lời {fmtNum(preview.suggestedTakeProfit, 2)} ·{" "}
            {preview.suggestedQuantity != null
              ? `khối lượng ${fmtNum(preview.suggestedQuantity, 0)} cp`
              : // Lý do do SERVER trả về. Trước đây chỗ này đoán "chưa đặt vốn"
                // cho mọi trường hợp — kể cả khi thật ra truy vấn ADV đã hỏng.
                (preview.suggestedQuantityBlockedReason ?? "chưa gợi ý được khối lượng")}
            .
          </div>
        ) : null}

        {[
          { name: "entryPrice", label: "GIÁ VÀO", note: "Nghìn ₫ mỗi cổ phiếu." },
          { name: "quantity", label: "KHỐI LƯỢNG", note: "Số cổ phiếu đã khớp." },
          { name: "stopLoss", label: "CẮT LỖ", note: "Bắt buộc — không có cắt lỗ thì không tính được R." },
          { name: "takeProfit", label: "CHỐT LỜI", note: "Để trống nếu chưa đặt mục tiêu." },
          { name: "fees", label: "PHÍ + THUẾ", note: "Tổng phí và thuế, cùng đơn vị với giá (nghìn ₫)." },
        ].map((field) => (
          <div key={field.name} className="tm-field">
            <div>
              <label className="tm-field__label" htmlFor={`manual-${field.name}`}>
                {field.label}
              </label>
              <div className="tm-field__note" id={`manual-${field.name}-note`}>
                {field.note}
              </div>
            </div>
            <input
              id={`manual-${field.name}`}
              className="tm-input"
              name={field.name}
              aria-describedby={`manual-${field.name}-note`}
              inputMode="decimal"
            />
          </div>
        ))}

        <div className="tm-field">
          <div>
            <label className="tm-field__label" htmlFor="manual-notes">
              GHI CHÚ
            </label>
            <div className="tm-field__note" id="manual-notes-note">
              Vì sao vào lệnh này ngoài hệ thống.
            </div>
          </div>
          <input
            id="manual-notes"
            className="tm-input"
            name="notes"
            aria-describedby="manual-notes-note"
          />
        </div>

        <ActionFeedback state={state} />
      </form>

      <div className="tm-modal__foot">
        <span className="tm-panel__spacer" />
        <button type="button" className="tm-btn" onClick={onClose}>
          HUỶ
        </button>
        <button
          type="submit"
          form="manual-trade-form"
          className="tm-btn tm-btn--primary"
          style={{ ["--tm-btn-tone" as string]: "var(--tm-floor)" }}
          disabled={pending}
        >
          {pending ? "ĐANG GHI…" : "GHI VÀO SỔ"}
        </button>
      </div>
    </ModalFrame>
  );
}

/**
 * Quản lý vị thế. Hai hành động phá vỡ tách bạch (bàn giao §5):
 * cập nhật cắt lỗ (amber) và đóng vị thế (viền đỏ, không phải nút mặc định).
 */
export function PositionModal({ row, onClose }: { row: F4OpenRow; onClose: () => void }) {
  const [stopState, stopAction, stopPending] = useActionState<TradeActionState, FormData>(
    updateTradeStopLoss,
    undefined
  );
  const [closeState, closeAction, closePending] = useActionState<TradeActionState, FormData>(
    closeTrade,
    undefined
  );

  useEffect(() => {
    if (closeState?.success) onClose();
  }, [closeState, onClose]);

  return (
    <ModalFrame
      title={`QUẢN LÝ VỊ THẾ · ${row.symbol}`}
      meta={`${row.direction} · ${fmtNum(row.quantity, 0)} CP`}
      tone={row.healthColor}
      width={620}
      onClose={onClose}
    >
      <div className="f4-modal__summary">
        {[
          // Màu của lãi/lỗ phải theo CHÍNH con số đó, không theo sức khoẻ thiết
          // lập: một vị thế `HEALTHY` đang lỗ vẫn phải hiện đỏ, và một vị thế
          // thiếu bar giá phải hiện "—" màu trung tính chứ không xanh. Bảng F4
          // bên ngoài đã dùng đúng quy ước này — modal thì chưa.
          {
            k: "LÃI/LỖ CHƯA THỰC HIỆN",
            v: fmtVndCompactSigned(row.unrealizedVnd),
            c: priceToneVar(row.unrealizedVnd),
          },
          { k: "%", v: fmtPctSigned(row.unrealizedPct), c: priceToneVar(row.unrealizedPct) },
          {
            k: "R HIỆN TẠI",
            v: row.rMultiple != null ? `${row.rMultiple >= 0 ? "+" : ""}${fmtNum(row.rMultiple, 2)}R` : GAP,
            c: priceToneVar(row.rMultiple),
          },
          { k: "NGÀY GIỮ", v: fmtNum(row.holdingDays, 0), c: "var(--tm-text-value)" },
        ].map((cell) => (
          <div key={cell.k} className="tm-kpi">
            <div className="tm-kpi__k">{cell.k}</div>
            <div className="tm-kpi__v tm-kpi__v--sm" style={{ color: cell.c }}>
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      <form action={stopAction} className="f4-modal__section">
        <label className="f4-modal__section-title" htmlFor="position-stop">
          CẬP NHẬT CẮT LỖ
        </label>
        <input type="hidden" name="tradeId" value={row.id} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tm-field__note" id="position-stop-note" style={{ flex: 1, marginTop: 0 }}>
            Hiện tại {fmtNum(row.stopLoss, 2)} · giá vào {fmtNum(row.entryPrice, 2)} nghìn ₫. Cắt lỗ
            phải thấp hơn giá vào.
          </span>
          <input
            className="tm-input"
            id="position-stop"
            name="stopLoss"
            aria-describedby="position-stop-note"
            inputMode="decimal"
            defaultValue={row.stopLoss ?? ""}
            style={{ width: 130 }}
          />
          <button
            type="submit"
            className="tm-btn tm-btn--primary"
            style={{ ["--tm-btn-tone" as string]: "var(--tm-accent)" }}
            disabled={stopPending}
          >
            {stopPending ? "ĐANG LƯU…" : "DỜI CẮT LỖ"}
          </button>
        </div>
        <ActionFeedback state={stopState} />
        {stopState?.success ? (
          <div className="tm-note" style={{ marginTop: 8 }}>
            {stopState.message}
          </div>
        ) : null}
      </form>

      <form action={closeAction} className="f4-modal__section" style={{ borderBottom: "none" }}>
        <div className="f4-modal__section-title">ĐÓNG VỊ THẾ</div>
        <input type="hidden" name="tradeId" value={row.id} />
        <div className="tm-field">
          <div>
            <label className="tm-field__label" htmlFor="position-exit-price">
              GIÁ THOÁT
            </label>
            <div className="tm-field__note" id="position-exit-price-note">
              Giá khớp thật khi đóng. Giá gần nhất đang là {fmtNum(row.markPrice, 2)}.
            </div>
          </div>
          <input
            className="tm-input"
            id="position-exit-price"
            name="exitPrice"
            aria-describedby="position-exit-price-note"
            inputMode="decimal"
            defaultValue={row.markPrice ?? ""}
          />
        </div>
        <div className="tm-field">
          <div>
            <label className="tm-field__label" htmlFor="position-exit-reason">
              LÝ DO ĐÓNG
            </label>
            <div className="tm-field__note" id="position-exit-reason-note">
              Để trống nếu không thuộc nhóm nào.
            </div>
          </div>
          <select
            id="position-exit-reason"
            className="tm-input"
            name="exitReason"
            aria-describedby="position-exit-reason-note"
            defaultValue=""
          >
            <option value="">—</option>
            <option value="TAKE_PROFIT_HIT">Chạm chốt lời</option>
            <option value="STOP_LOSS_HIT">Chạm cắt lỗ</option>
            <option value="ZONE_INVALIDATED">Vùng mua mất hiệu lực</option>
            <option value="STRUCTURE_BROKEN">Vỡ cấu trúc</option>
            <option value="HEALTH_DEGRADED_EOD">Sức khoẻ xuống cấp</option>
            <option value="TIME_STOP">Hết thời gian giữ</option>
            <option value="MANUAL_RULE_BASED_EXIT">Thoát theo quy tắc</option>
          </select>
        </div>
        <div className="tm-field">
          <div>
            <label className="tm-field__label" htmlFor="position-exit-note">
              GHI CHÚ
            </label>
            <div className="tm-field__note" id="position-exit-note-note">
              Rút kinh nghiệm cho lần sau.
            </div>
          </div>
          <input
            id="position-exit-note"
            className="tm-input"
            name="exitNote"
            aria-describedby="position-exit-note-note"
          />
        </div>
        <ActionFeedback state={closeState} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
          <button type="submit" className="tm-btn tm-btn--danger" disabled={closePending}>
            {closePending ? "ĐANG ĐÓNG…" : "ĐÓNG VỊ THẾ"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

/** Chi tiết lệnh đã đóng — tổng kết + ghi chú sau lệnh (lưu được). */
export function ClosedTradeModal({
  row,
  exitNote,
  onClose,
}: {
  row: F4ClosedRow;
  exitNote: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(
    updateTradeExitNote,
    undefined
  );

  return (
    <ModalFrame
      title={`LỆNH ĐÃ ĐÓNG · ${row.symbol}`}
      meta={`${row.entryLabel} → ${row.exitLabel}`}
      tone={row.color}
      width={620}
      onClose={onClose}
    >
      <div className="f4-modal__summary" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { k: "LÃI/LỖ", v: fmtVndCompactSigned(row.realizedPnlVnd), c: row.color },
          {
            k: "R ĐẠT ĐƯỢC",
            v: row.rMultiple != null ? `${row.rMultiple >= 0 ? "+" : ""}${fmtNum(row.rMultiple, 2)}R` : GAP,
            // Theo chính bội số R, không mượn màu của ô lãi/lỗ bên cạnh: R thiếu
            // dữ liệu phải trung tính kể cả khi lãi/lỗ có số.
            c: priceToneVar(row.rMultiple),
          },
          { k: "KHỐI LƯỢNG", v: `${fmtNum(row.quantity, 0)} cp`, c: "var(--tm-text-value)" },
          { k: "GIÁ VÀO", v: fmtNum(row.entryPrice, 2), c: "var(--tm-text-value)" },
          { k: "GIÁ RA", v: fmtNum(row.exitPrice, 2), c: "var(--tm-text-value)" },
          { k: "LÝ DO ĐÓNG", v: row.reason, c: "var(--tm-text-mute)" },
        ].map((cell) => (
          <div key={cell.k} className="tm-kpi">
            <div className="tm-kpi__k">{cell.k}</div>
            <div className="tm-kpi__v tm-kpi__v--sm" style={{ color: cell.c }}>
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      <form action={formAction} className="f4-modal__section" style={{ borderBottom: "none" }}>
        <label className="f4-modal__section-title" htmlFor="closed-exit-note">
          GHI CHÚ SAU LỆNH
        </label>
        <input type="hidden" name="tradeId" value={row.id} />
        <textarea
          id="closed-exit-note"
          className="tm-input"
          name="exitNote"
          defaultValue={exitNote}
          rows={4}
          style={{ height: "auto", padding: 8, resize: "vertical" }}
        />
        <ActionFeedback state={state} />
        {state?.success ? (
          <div className="tm-note" style={{ marginTop: 8 }}>
            {state.message}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
          <button type="submit" className="tm-btn tm-btn--primary" disabled={pending}>
            {pending ? "ĐANG LƯU…" : "LƯU GHI CHÚ"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
