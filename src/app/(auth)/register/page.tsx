import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create Account — TradeLog",
  description: "Create your trading journal account.",
};

export default function RegisterPage() {
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
          Create account
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Start logging your trades
        </p>
      </div>

      <RegisterForm />

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        Already have an account?{" "}
        <a
          href="/login"
          className="font-medium"
          style={{ color: "var(--accent-text)" }}
        >
          Sign in
        </a>
      </p>
    </>
  );
}
