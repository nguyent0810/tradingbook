"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTradeFromSetup,
  previewTradeLevelsForSetup,
  sizeTradeAtEntry,
  type SetupLevelsPreview,
  type SetupSizingAtEntry,
  type TradeActionState,
} from "@/app/actions/trades";
import { fmtNum, fmtPct, semanticTone } from "@/lib/format/vn";
import { verdictTokens } from "@/lib/terminal/verdict-tokens";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";

export type OrderTicketTarget = {
  setupId: string;
  symbol: string;
  tier: "A" | "B";

  equityVnd: number | null;
};

/**
 * Phiếu ghi lệnh.
 *
 * Khối lượng đề xuất **đã nhân theo phân bổ của phán quyết**, và phiếu nói rõ đã
 * giảm bao nhiêu và vì sao (bàn giao §5). Giá và mức lệnh lấy từ server action
 * `previewTradeLevelsForSetup` — phiếu không tự tính lại mức nào.
 */
export function OrderTicketModal({
  target,
  verdict,
  onClose,
}: {
  target: OrderTicketTarget;
  verdict: VerdictUxLevel | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<SetupLevelsPreview | null>(null);
  // Giá và khối lượng là **giá trị dẫn xuất**; state chỉ giữ phần người dùng đã
  // sửa. Giá dẫn xuất từ `preview` (mức giá của thiết lập), khối lượng dẫn xuất
  // từ `sizeTradeAtEntry()` qua `sizingCache` bên dưới. Nhờ vậy không cần effect
  // đồng bộ ngược lại khi dữ liệu về — và ô nhập không nhấp nháy.
  const [entryOverride, setEntryOverride] = useState<string | null>(null);
  const [quantityOverride, setQuantityOverride] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(
    createTradeFromSetup,
    undefined
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    previewTradeLevelsForSetup(target.setupId).then((result) => {
      if (cancelled) return;
      setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [target.setupId]);

  const tokens = verdict ? verdictTokens(verdict) : null;

  const entry = entryOverride ?? (preview?.ok ? String(preview.suggestedEntry) : "");
  const entryNumber = Number.parseFloat(entry);

  // Định cỡ luôn do SERVER tính, TẠI ĐÚNG GIÁ ô nhập đang mang — và đã đi qua đủ
  // chuỗi (định cỡ → làm tròn lô → ràng buộc phán quyết).
  //
  // Người dùng sửa được giá vào, mà nâng giá thì rủi ro mỗi cổ phiếu tăng và trần
  // giảm. Giữ nguyên khối lượng tính ở giá cũ sẽ đề xuất một con số server từ
  // chối. Nên mỗi lần giá đổi là hỏi lại server; trong lúc chờ, nút ghi lệnh khoá.
  // Nhớ kèm GIÁ đã dùng để tính. Nhờ vậy "chưa có kết quả" và "kết quả của giá cũ"
  // là cùng một trạng thái dẫn xuất (`sizing == null`) — không cần state `pending`
  // riêng, và không cần `setState` đồng bộ trong effect (React cấm: gây render dây
  // chuyền).
  const [sizingCache, setSizingCache] = useState<{
    entry: number;
    result: SetupSizingAtEntry;
  } | null>(null);
  const sizing = sizingCache?.entry === entryNumber ? sizingCache.result : null;

  useEffect(() => {
    if (!Number.isFinite(entryNumber) || entryNumber <= 0) return;
    if (sizingCache?.entry === entryNumber) return;
    let cancelled = false;
    // Chờ một nhịp để không bắn một truy vấn cho mỗi phím gõ.
    const timer = setTimeout(() => {
      sizeTradeAtEntry(target.setupId, entryNumber).then((result) => {
        if (!cancelled) setSizingCache({ entry: entryNumber, result });
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target.setupId, entryNumber, sizingCache]);

  // Chưa có số của server thì ô khối lượng để TRỐNG. Điền tạm con số của màn
  // (tính ở đỉnh vùng mua, tức một giá khác) là hiện một khối lượng không ai sẽ
  // chấp nhận — thà trống, và nút ghi lệnh vẫn đang khoá.
  const suggestedShares = sizing ? sizing.quantity : null;
  const blockedReason = sizing?.blockedReason ?? null;
  const baseShares = sizing?.baseQuantity ?? null;
  const removedShares =
    baseShares != null && suggestedShares != null ? baseShares - suggestedShares : null;

  const quantity =
    quantityOverride ?? (suggestedShares != null ? String(suggestedShares) : "");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const qtyNumber = Number.parseInt(quantity, 10);
  const notionalVnd =
    Number.isFinite(entryNumber) && Number.isFinite(qtyNumber)
      ? entryNumber * 1000 * qtyNumber
      : null;
  const riskVnd =
    preview?.ok && Number.isFinite(entryNumber) && Number.isFinite(qtyNumber)
      ? (entryNumber - preview.stopLoss) * 1000 * qtyNumber
      : null;

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
        aria-label={`Phiếu ghi lệnh ${target.symbol}`}
        style={{ width: 540, maxWidth: "100%" }}
      >
        <div className="tm-modal__head">
          <span className="tm-panel__rule" style={{ background: "var(--tm-up)" }} />
          <span className="tm-panel__title">PHIẾU GHI LỆNH · {target.symbol}</span>
          <span className="tm-panel__meta">HẠNG {target.tier}</span>
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

        <form action={formAction}>
          <input type="hidden" name="setupId" value={target.setupId} />

          <div className="tm-modal__body">
            {preview == null ? (
              <div className="tm-state">
                <span className="tm-state__title">Đang nạp mức lệnh…</span>
              </div>
            ) : !preview.ok ? (
              <div className="tm-state" role="alert">
                <span className="tm-state__title">Không dựng được phiếu</span>
                <p className="tm-state__note">{preview.message}</p>
                <pre className="tm-evidence">
                  previewTradeLevelsForSetup({target.setupId})
                </pre>
              </div>
            ) : (
              <>
                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-entry">
                      GIÁ ĐẶT
                    </label>
                    <div className="tm-field__note" id="ticket-entry-note">
                      Vùng đề xuất {fmtNum(preview.entryRangeLow, 2)}–
                      {fmtNum(preview.entryRangeHigh, 2)} nghìn ₫ · tính đến phiên{" "}
                      {preview.asOfBarDate.slice(0, 10)}
                    </div>
                  </div>
                  <input
                    className="tm-input"
                    id="ticket-entry"
                    name="confirmedEntryPrice"
                    inputMode="decimal"
                    aria-describedby="ticket-entry-note"
                    value={entry}
                    onChange={(e) => {
                      setEntryOverride(e.target.value);
                      // Đổi giá là đổi cơ sở định cỡ — bỏ số người dùng đã sửa
                      // để nhận khối lượng mới của server thay vì giữ số cũ.
                      setQuantityOverride(null);
                    }}
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-qty">
                      KHỐI LƯỢNG (CP)
                    </label>
                    <div className="tm-field__note" id="ticket-qty-note">
                      {tokens && baseShares != null && suggestedShares != null
                        ? removedShares != null && removedShares > 0
                          ? `Đã giảm còn ${tokens.sizeLabel} khối lượng chuẩn: ${fmtNum(
                              baseShares,
                              0
                            )} → ${fmtNum(suggestedShares, 0)} cp (bớt ${fmtNum(
                              removedShares,
                              0
                            )}). ${tokens.sizeReason}.`
                          : `Phán quyết ${tokens.code} cho phép khối lượng chuẩn ${fmtNum(
                              suggestedShares,
                              0
                            )} cp.`
                        : "Khối lượng do server tính tại giá vào của phiếu này."}
                    </div>
                  </div>
                  <input
                    className="tm-input"
                    id="ticket-qty"
                    name="confirmedQuantity"
                    inputMode="numeric"
                    aria-describedby="ticket-qty-note"
                    value={quantity}
                    onChange={(e) => setQuantityOverride(e.target.value)}
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <div className="tm-field__label">CẮT LỖ</div>
                    <div className="tm-field__note">
                      Do hệ thống chốt từ thiết lập — không sửa trên phiếu.
                    </div>
                  </div>
                  <span className="tm-num" style={{ color: "var(--tm-down-soft)", fontSize: 12 }}>
                    {fmtNum(preview.stopLoss, 2)}
                  </span>
                </div>

                <div className="tm-field">
                  <div>
                    <div className="tm-field__label">CHỐT LỜI</div>
                    <div className="tm-field__note">
                      R:R {preview.riskRewardRatio != null ? `1:${fmtNum(preview.riskRewardRatio, 1)}` : "—"}
                    </div>
                  </div>
                  <span
                    className="tm-num"
                    style={{
                      color: semanticTone(preview.takeProfit, "var(--tm-up-soft)"),
                      fontSize: 12,
                    }}
                  >
                    {fmtNum(preview.takeProfit, 2)}
                  </span>
                </div>

                <div className="tm-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)", margin: 11 }}>
                  <div className="tm-kpi">
                    <div className="tm-kpi__k">GIÁ TRỊ</div>
                    <div className="tm-kpi__v tm-kpi__v--sm">
                      {notionalVnd != null ? `${fmtNum(notionalVnd / 1_000_000, 1)} tr ₫` : "—"}
                    </div>
                  </div>
                  <div className="tm-kpi">
                    <div className="tm-kpi__k">% NAV</div>
                    <div
                      className="tm-kpi__v tm-kpi__v--sm"
                      style={{
                        color: semanticTone(
                          notionalVnd != null && target.equityVnd ? notionalVnd : null,
                          "var(--tm-floor)"
                        ),
                      }}
                    >
                      {notionalVnd != null && target.equityVnd
                        ? fmtPct((notionalVnd / target.equityVnd) * 100, 1)
                        : "—"}
                    </div>
                  </div>
                  <div className="tm-kpi">
                    <div className="tm-kpi__k">RỦI RO</div>
                    <div
                      className="tm-kpi__v tm-kpi__v--sm"
                      style={{ color: semanticTone(riskVnd, "var(--tm-accent)") }}
                    >
                      {riskVnd != null ? `${fmtNum(riskVnd / 1_000_000, 1)} tr ₫` : "—"}
                    </div>
                  </div>
                </div>

                {state?.errors
                  ? Object.entries(state.errors).map(([field, messages]) => (
                      <pre key={field} className="tm-evidence" style={{ margin: "0 11px 9px" }}>
                        {field}: {messages.join(" · ")}
                      </pre>
                    ))
                  : null}
                {state?.message && !state.success ? (
                  <pre className="tm-evidence" style={{ margin: "0 11px 9px" }}>
                    {state.message}
                  </pre>
                ) : null}
              </>
            )}
          </div>

          <div className="tm-modal__foot">
            {blockedReason ? (
              // Server không cho ghi ⇒ nói thẳng lý do NGAY TẠI PHIẾU. Để người
              // dùng bấm rồi mới nhận từ chối là bắt họ đoán.
              <span className="tm-note" style={{ color: "var(--tm-down)" }}>
                {blockedReason}
              </span>
            ) : null}
            <span className="tm-panel__spacer" />
            <button type="button" className="tm-btn" onClick={onClose}>
              HUỶ
            </button>
            <button
              type="submit"
              className="tm-btn tm-btn--primary"
              style={{ ["--tm-btn-tone" as string]: "var(--tm-up)" }}
              disabled={
                pending ||
                preview == null ||
                !preview.ok ||
                sizing == null ||
                blockedReason != null ||
                !Number.isFinite(qtyNumber) ||
                qtyNumber <= 0
              }
            >
              {pending ? "ĐANG GHI…" : "GHI VÀO SỔ LỆNH"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
