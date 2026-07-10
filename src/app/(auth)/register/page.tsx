import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create Account — TradeLog",
  description: "Create your setup intelligence workspace.",
};

export default function RegisterPage() {
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
        <h1 className="cd-auth__title">Create your account</h1>
        <p className="cd-auth__lead">
          Set up your workspace to surface high-quality setups and validate the edge before you act.
        </p>
      </header>

      <RegisterForm />

      <p className="cd-auth__footer">
        Already have an account?{" "}
        <Link href="/login" className="cd-auth__link">
          Sign in
        </Link>
      </p>
    </>
  );
}
