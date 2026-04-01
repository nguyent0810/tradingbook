import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — TradeLog",
  description: "Sign in to your trading journal.",
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-muted)" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Welcome back
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Sign in to your trading journal
        </p>
      </div>

      <LoginForm />

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Don&apos;t have an account?{" "}
        <a
          href="/register"
          className="font-medium"
          style={{ color: "var(--accent-text)" }}
        >
          Create one
        </a>
      </p>
    </>
  );
}
