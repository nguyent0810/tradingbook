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

  // Load-bearing effect — see manual-trade-form.tsx for the full rationale.
  // `state.message` ("Đã ghi lệnh …", role="status") renders inside the open
  // panel; the effect guarantees a committed render containing it before the
  // panel closes. Doing this in the action would drop it entirely.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    if (state?.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} data-testid={`log-trade-open-${symbolKey}`}>
        Ghi lệnh
      </Button>
    );
  }

  const twoR = preview?.ok
    ? (preview.ticket.targets.find((t) => t.r === preview.ticket.defaultTargetR)?.priceKvnd ?? null)
    : null;

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
              <dt>Vùng vào tham khảo</dt>
              <dd className="tabular-nums">
                {fmt(preview.ticket.entryZone.low)} – {fmt(preview.ticket.entryZone.high)}
              </dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Cắt lỗ (đáy vùng SL)</dt>
              <dd className="tabular-nums">{fmt(preview.ticket.stopKvnd)}</dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Chốt lời {preview.ticket.defaultTargetR}R</dt>
              <dd className="tabular-nums">{twoR != null ? fmt(twoR) : "—"}</dd>
            </div>
            <div className="tosv3-setups-metric-card">
              <dt>Size tham khảo</dt>
              <dd className="tabular-nums">
                {preview.ticket.shares != null ? `${preview.ticket.shares.toLocaleString("vi-VN")} cp` : "—"}
              </dd>
            </div>
          </dl>

          <p className="tosv3-log-trade-panel__hint">
            Gợi ý lệnh tính đến phiên {preview.ticket.asOfSession}, cùng số với màn Setups. Cắt lỗ, chốt lời và khối
            lượng lấy từ gợi ý; chỉ cần xác nhận giá thực khớp. App chỉ ghi vào sổ lệnh, không gửi lệnh.
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
              defaultValue={String(preview.ticket.entryKvnd)}
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
