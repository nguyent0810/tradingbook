"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTradeFromSetup,
  previewTradeLevelsForSetup,
  type SetupLevelsPreview,
  type TradeActionState,
} from "@/app/actions/trades";
import { fmtNum, fmtPct, semanticTone } from "@/lib/format/vn";
import { verdictTokens } from "@/lib/terminal/verdict-tokens";
import { evidenceStatus } from "@/lib/terminal/trade-suggestion-display";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { TargetR } from "@/lib/trades/order-ticket-prefill";
import { ticketWorstCaseLossVnd } from "@/lib/trades/worst-case-risk";
import { SuggestionEvidence } from "@/components/terminal/suggestion-evidence";

export type OrderTicketTarget = {
  setupId: string;
  symbol: string;
  tier: "A" | "B";

  equityVnd: number | null;
};

const R_CHOICES: readonly TargetR[] = [1, 2, 3];

/**
 * Phiếu ghi lệnh — ghi một giao dịch vào sổ; app không gửi lệnh (ADR 0003).
 *
 * Mọi con số điền sẵn lấy từ CÙNG gợi ý lệnh mà F1/F2/F7 hiện (#17), qua server
 * action `previewTradeLevelsForSetup`: giá vào = đầu trên vùng vào, cắt lỗ = đáy
 * vùng SL, chốt lời = mốc R đang chọn (mặc định 2R), khối lượng = size tham khảo
 * (đã tính đệm gap và phán quyết phiên). Người dùng sửa được mọi ô trước khi ghi;
 * server tự kiểm lại. Ô RỦI RO tính trên cùng cơ sở với F2: R sau phí + đệm gap.
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
  // Giá trị điền sẵn là **giá trị dẫn xuất** từ `preview`; state chỉ giữ phần
  // người dùng đã sửa. Không cần effect đồng bộ ngược khi dữ liệu về.
  const [entryOverride, setEntryOverride] = useState<string | null>(null);
  const [stopOverride, setStopOverride] = useState<string | null>(null);
  const [takeProfitOverride, setTakeProfitOverride] = useState<string | null>(null);
  const [quantityOverride, setQuantityOverride] = useState<string | null>(null);
  const [targetR, setTargetR] = useState<TargetR | null>(null);
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

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const tokens = verdict ? verdictTokens(verdict) : null;
  const ticket = preview?.ok ? preview.ticket : null;

  const chosenR = targetR ?? ticket?.defaultTargetR ?? 2;
  const chosenTargetKvnd = ticket?.targets.find((t) => t.r === chosenR)?.priceKvnd ?? null;

  const entry = entryOverride ?? (ticket ? String(ticket.entryKvnd) : "");
  const stop = stopOverride ?? (ticket ? String(ticket.stopKvnd) : "");
  const takeProfit = takeProfitOverride ?? (chosenTargetKvnd != null ? String(chosenTargetKvnd) : "");
  const quantity = quantityOverride ?? (ticket?.shares != null ? String(ticket.shares) : "");

  const entryKvnd = Number.parseFloat(entry);
  const stopKvnd = Number.parseFloat(stop);
  const qtyShares = Number.parseInt(quantity, 10);

  const notionalVnd =
    Number.isFinite(entryKvnd) && Number.isFinite(qtyShares) ? entryKvnd * 1000 * qtyShares : null;
  // Cùng hàm size tham khảo dùng: tại số điền sẵn, bằng đúng Rủi ro lệnh của F2.
  const worstCaseLossVnd = ticket
    ? ticketWorstCaseLossVnd({ entryKvnd, stopKvnd, exchange: ticket.exchange, shares: qtyShares })
    : null;

  const removedShares =
    ticket?.sharesBeforeVerdict != null && ticket.shares != null
      ? ticket.sharesBeforeVerdict - ticket.shares
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
                <span className="tm-state__title">Đang nạp gợi ý lệnh…</span>
              </div>
            ) : !preview.ok || !ticket ? (
              <div className="tm-state" role="alert">
                <span className="tm-state__title">Không dựng được phiếu</span>
                <p className="tm-state__note">{preview.ok ? "" : preview.message}</p>
                <pre className="tm-evidence">
                  previewTradeLevelsForSetup({target.setupId})
                </pre>
              </div>
            ) : (
              <>
                <div className="tm-field">
                  <div>
                    <div className="tm-field__note">
                      <SuggestionEvidence
                        evidence={evidenceStatus(ticket.evidence.prospectiveN, ticket.evidence.checkpointN)}
                      />{" "}
                      · tính đến phiên {ticket.asOfSession}
                    </div>
                  </div>
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-entry">
                      GIÁ VÀO
                    </label>
                    <div className="tm-field__note" id="ticket-entry-note">
                      Vùng vào tham khảo {fmtNum(ticket.entryZone.low, 2)}–{fmtNum(ticket.entryZone.high, 2)}{" "}
                      nghìn ₫ · điền sẵn đầu trên (mức khớp xấu nhất mà R tính từ)
                    </div>
                  </div>
                  <input
                    className="tm-input"
                    id="ticket-entry"
                    name="confirmedEntryPrice"
                    inputMode="decimal"
                    aria-describedby="ticket-entry-note"
                    value={entry}
                    onChange={(e) => setEntryOverride(e.target.value)}
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-stop">
                      CẮT LỖ
                    </label>
                    <div className="tm-field__note" id="ticket-stop-note">
                      Vùng SL {fmtNum(ticket.stopZone.low, 2)}–{fmtNum(ticket.stopZone.high, 2)} · điền sẵn
                      đáy vùng
                    </div>
                  </div>
                  <input
                    className="tm-input"
                    id="ticket-stop"
                    name="confirmedStopLoss"
                    inputMode="decimal"
                    aria-describedby="ticket-stop-note"
                    value={stop}
                    onChange={(e) => setStopOverride(e.target.value)}
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-target">
                      CHỐT LỜI
                    </label>
                    <div className="tm-field__note" id="ticket-target-note">
                      <span role="group" aria-label="Mốc chốt theo R">
                        {R_CHOICES.map((r) => {
                          const price = ticket.targets.find((t) => t.r === r)?.priceKvnd;
                          return (
                            <button
                              key={r}
                              type="button"
                              className={`tm-btn tm-btn--sm${r === chosenR ? " tm-btn--primary" : " tm-btn--ghost"}`}
                              aria-pressed={r === chosenR}
                              onClick={() => {
                                setTargetR(r);
                                setTakeProfitOverride(null);
                              }}
                              style={{ marginRight: 4 }}
                            >
                              {r}R {price != null ? fmtNum(price, 2) : "—"}
                            </button>
                          );
                        })}
                      </span>
                    </div>
                  </div>
                  <input
                    className="tm-input"
                    id="ticket-target"
                    name="confirmedTakeProfit"
                    inputMode="decimal"
                    aria-describedby="ticket-target-note"
                    value={takeProfit}
                    onChange={(e) => setTakeProfitOverride(e.target.value)}
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="ticket-qty">
                      KHỐI LƯỢNG (CP)
                    </label>
                    <div className="tm-field__note" id="ticket-qty-note">
                      {ticket.shares == null
                        ? ticket.sizeNote
                        : ticket.sizeNote
                          ? ticket.sizeNote
                          : tokens && removedShares != null && removedShares > 0
                            ? `Size tham khảo (như F2), đã giảm còn ${tokens.sizeLabel}: ${fmtNum(
                                ticket.sharesBeforeVerdict,
                                0
                              )} → ${fmtNum(ticket.shares, 0)} cp. ${tokens.sizeReason}.`
                            : `Size tham khảo (như F2): ${fmtNum(ticket.shares, 0)} cp, tính trên R sau phí + đệm gap.`}
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
                  <div className="tm-kpi" title="R sau phí + đệm gap một biên độ, cùng cơ sở với F2">
                    <div className="tm-kpi__k">RỦI RO XẤU NHẤT</div>
                    <div
                      className="tm-kpi__v tm-kpi__v--sm"
                      style={{ color: semanticTone(worstCaseLossVnd, "var(--tm-accent)") }}
                    >
                      {worstCaseLossVnd != null ? `${fmtNum(worstCaseLossVnd / 1_000_000, 1)} tr ₫` : "—"}
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
            <span className="tm-note">Chỉ ghi vào sổ lệnh — app không gửi lệnh tới broker.</span>
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
                ticket == null ||
                !Number.isFinite(entryKvnd) ||
                !Number.isFinite(stopKvnd) ||
                stopKvnd >= entryKvnd ||
                !Number.isFinite(qtyShares) ||
                qtyShares <= 0
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
