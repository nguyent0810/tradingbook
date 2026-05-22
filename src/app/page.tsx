import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="animate-in w-full max-w-md text-center">
        {/* Logo Mark */}
        <div
          className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-muted)" }}
        >
          <svg
            width="28"
            height="28"
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
          className="mb-3 text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          TradeLog
        </h1>
        <p
          className="mb-10 text-lg leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          A minimal trading journal.
          <br />
          Log. Track. Improve.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className="btn btn-primary btn-lg">
            Sign In
          </Link>
          <Link href="/register" className="btn btn-secondary btn-lg">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
