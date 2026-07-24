"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updatePassword,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    } else if (state?.errors?.currentPassword) {
      currentPasswordRef.current?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="cd-auth-form"
      data-testid="change-password-form"
      noValidate
    >
      {state?.message && (
        <div
          className="cd-auth-alert"
          role={state.success ? "status" : "alert"}
          data-testid={state.success ? "change-password-success" : "change-password-error"}
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
        <label htmlFor="currentPassword" className="cd-auth-label">
          Mật khẩu hiện tại
        </label>
        <PasswordInput
          ref={currentPasswordRef}
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          className="cd-auth-input"
          aria-invalid={state?.errors?.currentPassword ? "true" : undefined}
          aria-describedby={
            state?.errors?.currentPassword ? "currentPassword-error" : undefined
          }
        />
        {state?.errors?.currentPassword && (
          <p id="currentPassword-error" className="cd-auth-error" aria-live="polite">
            {state.errors.currentPassword[0]}
          </p>
        )}
      </div>

      <div className="cd-auth-field">
        <label htmlFor="newPassword" className="cd-auth-label">
          Mật khẩu mới
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          placeholder="Tối thiểu 6 ký tự"
          className="cd-auth-input"
          aria-invalid={state?.errors?.newPassword ? "true" : undefined}
          aria-describedby={state?.errors?.newPassword ? "newPassword-error" : undefined}
        />
        {state?.errors?.newPassword && (
          <p id="newPassword-error" className="cd-auth-error" aria-live="polite">
            {state.errors.newPassword[0]}
          </p>
        )}
      </div>

      <div className="cd-auth-field">
        <label htmlFor="confirmPassword" className="cd-auth-label">
          Xác nhận mật khẩu mới
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          className="cd-auth-input"
          aria-invalid={state?.errors?.confirmPassword ? "true" : undefined}
          aria-describedby={
            state?.errors?.confirmPassword ? "confirmPassword-error" : undefined
          }
        />
        {state?.errors?.confirmPassword && (
          <p id="confirmPassword-error" className="cd-auth-error" aria-live="polite">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Đang đổi…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
