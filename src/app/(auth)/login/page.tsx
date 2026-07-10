import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — TradeLog",
  description: "Sign in to your setup intelligence workspace.",
};

export default function LoginPage() {
  return (
    <>
      <header className="cd-auth__brand">
        <span className="cd-auth__mark" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </span>
        <p className="cd-auth__eyebrow">Setup Intelligence</p>
        <h1 className="cd-auth__title">Welcome back</h1>
        <p className="cd-auth__lead">
          Sign in to scan the market, validate high-quality setups, and act with conviction.
        </p>
      </header>

      <LoginForm />

      <p className="cd-auth__footer">
        New to the terminal?{" "}
        <Link href="/register" className="cd-auth__link">
          Create an account
        </Link>
      </p>
    </>
  );
}
