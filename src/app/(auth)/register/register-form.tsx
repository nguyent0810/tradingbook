"use client";

import { useActionState } from "react";
import { register, type AuthState } from "@/app/actions/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    register,
    undefined
  );

  return (
    <form action={formAction} className="cd-auth-form" data-testid="register-form" noValidate>
      {state?.message && (
        <div className="cd-auth-alert" role="alert" data-testid="register-error">
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
        <label htmlFor="name" className="cd-auth-label">
          Name <span className="cd-auth-label__hint">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          className="cd-auth-input"
        />
      </div>

      <div className="cd-auth-field">
        <label htmlFor="email" className="cd-auth-label">
          Email
        </label>
        <input
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
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Min. 6 characters"
          className="cd-auth-input"
          aria-invalid={state?.errors?.password ? "true" : undefined}
          aria-describedby={
            state?.errors?.password ? "password-error" : "password-hint"
          }
        />
        {state?.errors?.password ? (
          <p id="password-error" className="cd-auth-error" aria-live="polite">
            {state.errors.password[0]}
          </p>
        ) : (
          <p id="password-hint" className="cd-auth-error" style={{ color: "var(--cd-text-dim)" }}>
            At least 6 characters.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="cd-auth-btn"
        data-testid="register-submit"
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
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </button>
    </form>
  );
}
