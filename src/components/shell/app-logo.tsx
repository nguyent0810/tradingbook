import Link from "next/link";

export function AppLogo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
      style={{ color: "var(--text-primary)" }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-muted)", boxShadow: "var(--shadow-sm)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </span>
      TradeLog
    </Link>
  );
}
