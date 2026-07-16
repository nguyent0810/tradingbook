"use client";

import { useActionState, useEffect, useRef } from "react";
import { login, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    undefined
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.errors?.email) {
      emailRef.current?.focus();
    } else if (state?.errors?.password) {
      passwordRef.current?.focus();
    }
  }, [state?.errors]);

  return (
    <form action={formAction} className="cd-auth-form" data-testid="login-form" noValidate>
      {state?.message && (
        <div className="cd-auth-alert" role="alert" data-testid="login-error">
          <svg
            className="cd-auth-alert__icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{state.message}</span>
        </div>
      )}

      <div className="cd-auth-field">
        <label htmlFor="email" className="cd-auth-label">
          Email <span className="cd-auth-label__required" aria-hidden="true">*</span>
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="cd-auth-input"
          aria-invalid={state?.errors?.email ? "true" : undefined}
          aria-describedby={state?.errors?.email ? "email-error" : undefined}
        />
        {state?.errors?.email && (
          <p id="email-error" className="cd-auth-error" aria-live="polite">
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <div className="cd-auth-field">
        <label htmlFor="password" className="cd-auth-label">
          Password <span className="cd-auth-label__required" aria-hidden="true">*</span>
        </label>
        <PasswordInput
          ref={passwordRef}
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="cd-auth-input"
          aria-invalid={state?.errors?.password ? "true" : undefined}
          aria-describedby={state?.errors?.password ? "password-error" : undefined}
        />
        {state?.errors?.password && (
          <p id="password-error" className="cd-auth-error" aria-live="polite">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="auth"
        disabled={pending}
        aria-busy={pending}
        data-testid="login-submit"
      >
        {pending ? (
          <>
            <svg
              className="cd-auth-btn__spinner"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
            </svg>
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
