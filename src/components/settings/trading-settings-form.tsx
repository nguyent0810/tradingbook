"use client";

import { useActionState } from "react";
import { updateTradingSettings, type TradingSettingsState } from "@/app/actions/trading-settings";
import { Button } from "@/components/ui/button";

export type TradingSettingsFormProps = {
  currentAccountEquityVnd: number | null;
};

export function TradingSettingsForm({ currentAccountEquityVnd }: TradingSettingsFormProps) {
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
          Account equity (VND)
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

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
