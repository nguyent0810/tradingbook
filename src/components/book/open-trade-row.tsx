"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { closeTrade, type TradeActionState } from "@/app/actions/trades";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type OpenTradeRowData = {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryDateLabel: string;
  entryPrice: number;
  quantity: string;
  stopLoss: number | null;
  takeProfit: number | null;
  latestCloseLabel: string;
  unrealizedLabel: string;
  unrealizedPctLabel: string;
  rMultipleLabel: string;
  holdingDaysLabel: string;
  staleLabel: string | null;
  priceUnitMismatch: boolean;
  healthLevel: "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD" | null;
  healthAsOfLabel: string | null;
  recommendedAction: string | null;
};

const HEALTH_BADGE: Record<
  NonNullable<OpenTradeRowData["healthLevel"]>,
  { label: string; className: string }
> = {
  HEALTHY: { label: "Khỏe", className: "book-badge book-badge--ok" },
  WARNING: { label: "Cảnh báo", className: "book-badge book-badge--warn" },
  AT_RISK: { label: "Rủi ro", className: "book-badge book-badge--risk" },
  DEAD: { label: "Mất hiệu lực", className: "book-badge book-badge--dead" },
};

const EXIT_REASON_OPTIONS = [
  { value: "", label: "— Không chọn —" },
  { value: "TAKE_PROFIT_HIT", label: "Chạm chốt lãi" },
  { value: "STOP_LOSS_HIT", label: "Chạm cắt lỗ" },
  { value: "ZONE_INVALIDATED", label: "Vùng vào lệnh bị vô hiệu" },
  { value: "STRUCTURE_BROKEN", label: "Cấu trúc bị phá vỡ" },
  { value: "HEALTH_DEGRADED_EOD", label: "Sức khỏe suy yếu cuối phiên" },
  { value: "TIME_STOP", label: "Hết thời gian nắm giữ" },
  { value: "MANUAL_RULE_BASED_EXIT", label: "Thoát theo quy tắc thủ công" },
];

const EXIT_DISCIPLINE_OPTIONS = [
  { value: "", label: "— Không chọn —" },
  { value: "FOLLOWED_PLAN", label: "Theo đúng kế hoạch" },
  { value: "EARLY_EXIT_RULE_BASED", label: "Thoát sớm có quy tắc" },
  { value: "EMOTIONAL_EXIT", label: "Thoát theo cảm xúc" },
  { value: "RULE_VIOLATION", label: "Vi phạm quy tắc" },
];

export function OpenTradeRow({ row }: { row: OpenTradeRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<TradeActionState, FormData>(closeTrade, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Load-bearing effect — see manual-trade-form.tsx for the full rationale.
  // `state.message` ("Đã đóng lệnh …", role="status") renders inside the
  // `expanded` region; the effect guarantees a committed render containing it
  // before the row collapses. Doing this in the action would drop it entirely.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setExpanded(false);
    }
  }, [state]);

  const health = row.healthLevel ? HEALTH_BADGE[row.healthLevel] : null;

  return (
    <>
      <tr className="book-table__row" data-testid={`open-trade-row-${row.symbol}`}>
        <td>
          <span className="book-symbol">{row.symbol}</span>
          <span className="book-direction">{row.direction === "LONG" ? "Mua" : "Bán"}</span>
        </td>
        <td>
          {row.entryPrice.toLocaleString("en-US")}
          <span className="book-cell-sub">{row.entryDateLabel}</span>
        </td>
        <td>{row.quantity}</td>
        <td>
          {row.stopLoss?.toLocaleString("en-US") ?? "—"} / {row.takeProfit?.toLocaleString("en-US") ?? "—"}
        </td>
        <td>
          {row.latestCloseLabel}
          {row.staleLabel && <span className="book-cell-sub book-cell-sub--warn">{row.staleLabel}</span>}
        </td>
        <td className={row.priceUnitMismatch ? "book-cell-muted" : undefined}>
          {row.priceUnitMismatch ? "Đơn vị giá lệch" : row.unrealizedLabel}
          {!row.priceUnitMismatch && <span className="book-cell-sub">{row.unrealizedPctLabel}</span>}
        </td>
        <td>{row.rMultipleLabel}</td>
        <td>{row.holdingDaysLabel}</td>
        <td>
          {health ? (
            <span className={health.className} title={row.healthAsOfLabel ?? undefined}>
              {health.label}
            </span>
          ) : (
            <span className="book-badge book-badge--muted">Chưa đánh giá</span>
          )}
        </td>
        <td>
          <Button size="sm" variant="secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hủy" : "Đóng lệnh"}
          </Button>
        </td>
      </tr>
      {row.recommendedAction && (
        <tr className="book-table__hint-row">
          <td colSpan={10}>{row.recommendedAction}</td>
        </tr>
      )}
      {expanded && (
        <tr className="book-table__form-row">
          <td colSpan={10}>
            <form ref={formRef} action={formAction} className="cd-auth-form book-close-form" noValidate>
              <input type="hidden" name="tradeId" value={row.id} />

              {state?.message && (
                <div
                  className="cd-auth-alert"
                  role={state.success ? "status" : "alert"}
                  style={state.success ? { borderColor: "var(--success)", color: "var(--success)" } : undefined}
                >
                  <span>{state.message}</span>
                </div>
              )}

              <div className="book-close-form__grid">
                <div className="cd-auth-field">
                  <label htmlFor={`exitPrice-${row.id}`} className="cd-auth-label">
                    Giá thoát lệnh (nghìn ₫)
                  </label>
                  <input
                    id={`exitPrice-${row.id}`}
                    name="exitPrice"
                    type="text"
                    inputMode="decimal"
                    required
                    className="cd-auth-input"
                    aria-invalid={state?.errors?.exitPrice ? "true" : undefined}
                  />
                  {state?.errors?.exitPrice && <p className="cd-auth-error">{state.errors.exitPrice[0]}</p>}
                </div>

                <div className="cd-auth-field">
                  <label htmlFor={`exitReason-${row.id}`} className="cd-auth-label">
                    Lý do thoát lệnh
                  </label>
                  <Select id={`exitReason-${row.id}`} name="exitReason" defaultValue="">
                    {EXIT_REASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="cd-auth-field">
                  <label htmlFor={`exitDiscipline-${row.id}`} className="cd-auth-label">
                    Kỷ luật thoát lệnh
                  </label>
                  <Select id={`exitDiscipline-${row.id}`} name="exitDiscipline" defaultValue="">
                    {EXIT_DISCIPLINE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="cd-auth-field">
                <label htmlFor={`exitNote-${row.id}`} className="cd-auth-label">
                  Ghi chú (tùy chọn)
                </label>
                <textarea id={`exitNote-${row.id}`} name="exitNote" className="cd-auth-input" rows={2} />
              </div>

              <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
                {pending ? "Đang đóng lệnh…" : "Xác nhận đóng lệnh"}
              </Button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
