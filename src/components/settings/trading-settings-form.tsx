"use client";

import { useActionState } from "react";
import { updateTradingSettings, type TradingSettingsState } from "@/app/actions/trading-settings";
import { Button } from "@/components/ui/button";

export type TradingSettingsFormProps = {
  currentAccountEquityVnd: number | null;
  /** Decimal fraction (0.0075 = 0.75%) or null — converted to a whole-percent display value. */
  currentRiskPerTradePct: number | null;
  currentMaxPositionPct: number | null;
  currentLiquidityCapPct: number | null;
};

function toPercentDisplay(fraction: number | null): string {
  return fraction == null ? "" : String(fraction * 100);
}

type PercentFieldProps = {
  name: string;
  label: string;
  defaultValue: string;
  /** System default shown in the placeholder — matches position-sizing-panel.ts DEFAULT_*. */
  systemDefaultPct: string;
  errors: string[] | undefined;
};

function PercentField({ name, label, defaultValue, systemDefaultPct, errors }: PercentFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="cd-auth-field">
      <label htmlFor={name} className="cd-auth-label">
        {label} (%){" "}
        <span className="cd-auth-label__hint">— để trống dùng mặc định, {systemDefaultPct}%</span>
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={systemDefaultPct}
        defaultValue={defaultValue}
        className="cd-auth-input"
        aria-invalid={errors ? "true" : undefined}
        aria-describedby={errors ? errorId : undefined}
      />
      {errors && (
        <p id={errorId} className="cd-auth-error" aria-live="polite">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export function TradingSettingsForm({
  currentAccountEquityVnd,
  currentRiskPerTradePct,
  currentMaxPositionPct,
  currentLiquidityCapPct,
}: TradingSettingsFormProps) {
  const [state, formAction, pending] = useActionState<TradingSettingsState, FormData>(
    updateTradingSettings,
    undefined
  );

  return (
    <form action={formAction} className="cd-auth-form" data-testid="trading-settings-form" noValidate>
      {state?.message && (
        <div
          className="cd-auth-alert"
          role={state.success ? "status" : "alert"}
          data-testid={state.success ? "trading-settings-success" : "trading-settings-error"}
          style={
            state.success
              ? { borderColor: "var(--success)", color: "var(--success)" }
              : undefined
          }
        >
          <span>{state.message}</span>
        </div>
      )}

      <div className="cd-auth-field">
        <label htmlFor="accountEquityVnd" className="cd-auth-label">
          Vốn tài khoản (VND)
        </label>
        <input
          id="accountEquityVnd"
          name="accountEquityVnd"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder="500000000"
          defaultValue={currentAccountEquityVnd ?? ""}
          className="cd-auth-input"
          aria-invalid={state?.errors?.accountEquityVnd ? "true" : undefined}
          aria-describedby={state?.errors?.accountEquityVnd ? "accountEquityVnd-error" : undefined}
        />
        {state?.errors?.accountEquityVnd && (
          <p id="accountEquityVnd-error" className="cd-auth-error" aria-live="polite">
            {state.errors.accountEquityVnd[0]}
          </p>
        )}
      </div>

      <PercentField
        name="riskPerTradePct"
        label="Rủi ro mỗi lệnh"
        defaultValue={toPercentDisplay(currentRiskPerTradePct)}
        systemDefaultPct="1"
        errors={state?.errors?.riskPerTradePct}
      />
      <PercentField
        name="maxPositionPct"
        label="Kích thước vị thế tối đa"
        defaultValue={toPercentDisplay(currentMaxPositionPct)}
        systemDefaultPct="20"
        errors={state?.errors?.maxPositionPct}
      />
      <PercentField
        name="liquidityCapPct"
        label="Trần thanh khoản (% ADV)"
        defaultValue={toPercentDisplay(currentLiquidityCapPct)}
        systemDefaultPct="10"
        errors={state?.errors?.liquidityCapPct}
      />

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Đang lưu…" : "Lưu"}
      </Button>
    </form>
  );
}
