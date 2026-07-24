"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createTradeFromSetup,
  previewTradeLevelsForSetup,
  type SetupLevelsPreview,
  type TradeActionState,
} from "@/app/actions/trades";
import { Button } from "@/components/ui/button";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LogTradeAction({ setupId, symbolKey }: { setupId: string; symbolKey: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SetupLevelsPreview | null>(null);
  const [loading, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(
    createTradeFromSetup,
    undefined
  );

  useEffect(() => {
    if (open && preview == null) {
      startTransition(async () => {
        const result = await previewTradeLevelsForSetup(setupId);
        setPreview(result);
      });
    }
  }, [open, preview, setupId]);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} data-testid={`log-trade-open-${symbolKey}`}>
        Ghi lệnh
      </Button>
    );
  }

  return (
    <div className="tosv3-log-trade-panel" data-testid={`log-trade-panel-${symbolKey}`}>
      <div className="tosv3-log-trade-panel__header">
        <h4 className="tosv3-log-trade-panel__title">Ghi lệnh {symbolKey}</h4>
        <button
          type="button"
          className="tosv3-log-trade-panel__close"
          onClick={() => setOpen(false)}
          aria-label="Đóng"
        >
          ×
        </button>
      </div>

      {loading || preview == null ? (
        <p className="tosv3-log-trade-panel__hint">Đang tính khoảng giá vào lệnh…</p>
      ) : !preview.ok ? (
        <p className="tosv3-log-trade-panel__hint">{preview.message}</p>
      ) : (
        <form action={formAction} className="cd-auth-form">
          <input type="hidden" name="setupId" value={setupId} />

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
              <dt>Khoảng vào lệnh gợi ý</dt>
              <dd className="tabular-nums">
                {fmt(preview.entryRangeLow)} – {fmt(preview.entryRangeHigh)}
              </dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Cắt lỗ</dt>
              <dd className="tabular-nums">{fmt(preview.stopLoss)}</dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Chốt lãi</dt>
              <dd className="tabular-nums">{preview.takeProfit != null ? fmt(preview.takeProfit) : "—"}</dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>R:R</dt>
              <dd className="tabular-nums">
                {preview.riskRewardRatio != null ? `${preview.riskRewardRatio.toFixed(2)}R` : "—"}
              </dd>
            </div>
          </dl>

          <p className="tosv3-log-trade-panel__hint">
            Tính từ phiên {new Date(preview.asOfBarDate).toLocaleDateString("en-US")} — hệ thống quét qua đêm nên
            đây là khoảng giá gợi ý cho phiên kế tiếp, không phải giá khớp lệnh thời gian thực. Khối lượng, cắt lỗ
            và chốt lãi được tính tự động; chỉ cần xác nhận giá bạn thực sự khớp được.
          </p>

          <div className="cd-auth-field">
            <label htmlFor={`confirmedEntryPrice-${setupId}`} className="cd-auth-label">
              Giá khớp lệnh thực tế (nghìn ₫)
            </label>
            <input
              id={`confirmedEntryPrice-${setupId}`}
              name="confirmedEntryPrice"
              type="text"
              inputMode="decimal"
              required
              defaultValue={fmt(preview.suggestedEntry)}
              className="cd-auth-input"
              aria-invalid={state?.errors?.confirmedEntryPrice ? "true" : undefined}
            />
            {state?.errors?.confirmedEntryPrice && (
              <p className="cd-auth-error">{state.errors.confirmedEntryPrice[0]}</p>
            )}
          </div>

          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
            {pending ? "Đang ghi lệnh…" : "Xác nhận ghi lệnh"}
          </Button>
        </form>
      )}
    </div>
  );
}
