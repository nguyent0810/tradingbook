"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createManualTrade,
  previewManualTradeLevels,
  type ManualTradeLevelsPreview,
  type TradeActionState,
} from "@/app/actions/trades";
import { Button } from "@/components/ui/button";

const STOP_REASON_LABEL: Record<string, string> = {
  swing_low: "Đáy swing gần nhất",
  compression_low: "Đáy giai đoạn co hẹp biến động",
  reclaim_candle_low: "Nến vừa lấy lại MA20/MA50",
  ma20_failure: "Dưới MA20",
  ma50_failure: "Dưới MA50",
  atr_stop_floor: "Sàn theo ATR(14)",
};

const TARGET_REASON_LABEL: Record<string, string> = {
  resistance_cluster: "Cụm kháng cự",
  prior_60d_high: "Đỉnh 60 phiên",
  prior_20d_high: "Đỉnh 20 phiên",
  pivot_high: "Đỉnh pivot",
  congestion_ceiling: "Trần vùng tích lũy",
  atr_floor: "Sàn theo ATR(14)",
  pct_floor: "Sàn tối thiểu 4%",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ManualTradeForm() {
  const [open, setOpen] = useState(false);
  const [symbolInput, setSymbolInput] = useState("");
  const [preview, setPreview] = useState<ManualTradeLevelsPreview | null>(null);
  const [loading, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(createManualTrade, undefined);

  function handlePreview() {
    const symbol = symbolInput.trim();
    if (!symbol) return;
    startTransition(async () => {
      const result = await previewManualTradeLevels(symbol);
      setPreview(result);
    });
  }

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setPreview(null);
      setSymbolInput("");
    }
  }, [state]);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="manual-trade-open">
        + Ghi lệnh thủ công
      </Button>
    );
  }

  return (
    <div className="tosv3-log-trade-panel" data-testid="manual-trade-panel">
      <div className="tosv3-log-trade-panel__header">
        <h4 className="tosv3-log-trade-panel__title">Ghi lệnh thủ công</h4>
        <button
          type="button"
          className="tosv3-log-trade-panel__close"
          onClick={() => {
            setOpen(false);
            setPreview(null);
          }}
          aria-label="Đóng"
        >
          ×
        </button>
      </div>

      {preview == null && (
        <div className="cd-auth-field">
          <label htmlFor="manual-symbol" className="cd-auth-label">
            Mã cổ phiếu
          </label>
          <input
            id="manual-symbol"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePreview();
              }
            }}
            className="cd-auth-input"
            placeholder="VD: HPG"
            maxLength={10}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePreview}
            disabled={loading || !symbolInput.trim()}
          >
            {loading ? "Đang tính…" : "Tính gợi ý cắt lỗ/chốt lãi"}
          </Button>
        </div>
      )}

      {preview != null && !preview.ok && (
        <>
          <p className="tosv3-log-trade-panel__hint">{preview.message}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPreview(null)}>
            Thử mã khác
          </Button>
        </>
      )}

      {preview != null && preview.ok && (
        <form action={formAction} className="cd-auth-form">
          <input type="hidden" name="symbol" value={symbolInput.trim().toUpperCase()} />

          {state?.message && (
            <div
              className="cd-auth-alert"
              role={state.success ? "status" : "alert"}
              style={state.success ? { borderColor: "var(--success)", color: "var(--success)" } : undefined}
            >
              <span>{state.message}</span>
            </div>
          )}

          <dl className="tosv3-setups-metric-strip">
            <div className="tosv3-setups-metric-card">
              <dt>Giá gần nhất</dt>
              <dd className="tabular-nums">{fmt(preview.latestClose)}</dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Cắt lỗ gợi ý</dt>
              <dd className="tabular-nums">{fmt(preview.suggestedStopLoss)}</dd>
              <span className="book-cell-sub">{STOP_REASON_LABEL[preview.stopReason] ?? preview.stopReason}</span>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Chốt lãi gợi ý</dt>
              <dd className="tabular-nums">{fmt(preview.suggestedTakeProfit)}</dd>
              <span className="book-cell-sub">{TARGET_REASON_LABEL[preview.targetReason] ?? preview.targetReason}</span>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>R:R</dt>
              <dd className="tabular-nums">
                {preview.riskRewardRatio != null ? `${preview.riskRewardRatio.toFixed(2)}R` : "—"}
              </dd>
            </div>
          </dl>

          <p className="tosv3-log-trade-panel__hint">
            Tính từ phiên {new Date(preview.asOfBarDate).toLocaleDateString("en-US")} theo công thức kỹ thuật (đáy
            swing/MA/ATR cho cắt lỗ, kháng cự gần nhất cho chốt lãi) — chỉ là gợi ý tham khảo, không phải khuyến nghị
            đầu tư. Toàn bộ các giá trị dưới đây đều có thể sửa lại.
          </p>

          <div className="book-close-form__grid">
            <div className="cd-auth-field">
              <label htmlFor="manual-entryPrice" className="cd-auth-label">
                Giá vào lệnh (nghìn ₫)
              </label>
              <input
                id="manual-entryPrice"
                name="entryPrice"
                type="text"
                inputMode="decimal"
                required
                defaultValue={fmt(preview.latestClose)}
                className="cd-auth-input"
                aria-invalid={state?.errors?.entryPrice ? "true" : undefined}
              />
              {state?.errors?.entryPrice && <p className="cd-auth-error">{state.errors.entryPrice[0]}</p>}
            </div>

            <div className="cd-auth-field">
              <label htmlFor="manual-quantity" className="cd-auth-label">
                Khối lượng (cp)
              </label>
              <input
                id="manual-quantity"
                name="quantity"
                type="text"
                inputMode="decimal"
                required
                defaultValue={preview.suggestedQuantity ?? ""}
                className="cd-auth-input"
                aria-invalid={state?.errors?.quantity ? "true" : undefined}
              />
              {preview.suggestedQuantity != null && (
                <span className="book-cell-sub">
                  Gợi ý theo rủi ro tài khoản: {preview.suggestedQuantity.toLocaleString("en-US")} cp
                </span>
              )}
              {state?.errors?.quantity && <p className="cd-auth-error">{state.errors.quantity[0]}</p>}
            </div>

            <div className="cd-auth-field">
              <label htmlFor="manual-stopLoss" className="cd-auth-label">
                Cắt lỗ (nghìn ₫)
              </label>
              <input
                id="manual-stopLoss"
                name="stopLoss"
                type="text"
                inputMode="decimal"
                required
                defaultValue={fmt(preview.suggestedStopLoss)}
                className="cd-auth-input"
                aria-invalid={state?.errors?.stopLoss ? "true" : undefined}
              />
              {state?.errors?.stopLoss && <p className="cd-auth-error">{state.errors.stopLoss[0]}</p>}
            </div>

            <div className="cd-auth-field">
              <label htmlFor="manual-takeProfit" className="cd-auth-label">
                Chốt lãi (nghìn ₫, tùy chọn)
              </label>
              <input
                id="manual-takeProfit"
                name="takeProfit"
                type="text"
                inputMode="decimal"
                defaultValue={fmt(preview.suggestedTakeProfit)}
                className="cd-auth-input"
              />
            </div>
          </div>

          <div className="cd-auth-field">
            <label htmlFor="manual-notes" className="cd-auth-label">
              Ghi chú (tùy chọn)
            </label>
            <textarea id="manual-notes" name="notes" className="cd-auth-input" rows={2} />
          </div>

          <div className="book-close-form__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Đổi mã khác
            </Button>
            <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
              {pending ? "Đang ghi lệnh…" : "Xác nhận ghi lệnh"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
