"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

const CONFIRM_WORD = "XÓA";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    deleteAccount,
    undefined
  );
  const [confirmText, setConfirmText] = useState("");
  const canSubmit = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <form
      action={formAction}
      className="cd-auth-form"
      data-testid="delete-account-form"
      noValidate
    >
      {state?.message && (
        <div className="cd-auth-alert" role="alert" data-testid="delete-account-error">
          <span>{state.message}</span>
        </div>
      )}

      <div className="cd-auth-field">
        <label htmlFor="delete-password" className="cd-auth-label">
          Mật khẩu
        </label>
        <PasswordInput
          id="delete-password"
          name="password"
          autoComplete="current-password"
          required
          className="cd-auth-input"
          aria-invalid={state?.errors?.password ? "true" : undefined}
          aria-describedby={state?.errors?.password ? "delete-password-error" : undefined}
        />
        {state?.errors?.password && (
          <p id="delete-password-error" className="cd-auth-error" aria-live="polite">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <div className="cd-auth-field">
        <label htmlFor="confirmText" className="cd-auth-label">
          Gõ <strong>{CONFIRM_WORD}</strong> để xác nhận
        </label>
        <input
          id="confirmText"
          name="confirmText"
          type="text"
          autoComplete="off"
          required
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="cd-auth-input"
          aria-invalid={state?.errors?.confirmText ? "true" : undefined}
          aria-describedby={state?.errors?.confirmText ? "confirmText-error" : undefined}
        />
        {state?.errors?.confirmText && (
          <p id="confirmText-error" className="cd-auth-error" aria-live="polite">
            {state.errors.confirmText[0]}
          </p>
        )}
      </div>

      <Button type="submit" variant="danger" disabled={pending || !canSubmit} aria-busy={pending}>
        {pending ? "Đang xóa…" : "Xóa tài khoản vĩnh viễn"}
      </Button>
    </form>
  );
}
