"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--danger-muted)",
            color: "var(--danger)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="input"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="input"
        />
        {state?.errors?.password && (
          <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full"
        style={{ marginTop: "8px" }}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
            </svg>
            Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
