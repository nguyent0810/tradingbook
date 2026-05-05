import Link from "next/link";
import type { SetupCandidateRow } from "@/lib/scanner/setups-queries";

export type SetupsScanPreviewProps = {
  candidates: SetupCandidateRow[];
  bottleneckKey: string;
  bottleneckLabel: string;
};

export function SetupsScanPreview({
  candidates,
  bottleneckKey,
  bottleneckLabel,
}: SetupsScanPreviewProps) {
  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Scanner setups
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Daily breakout/pullback scan (Gate 1 × Gate 2).
          </p>
        </div>
        <Link
          href="/setups"
          className="text-sm font-medium text-[var(--accent-text)] hover:underline"
        >
          View scanner →
        </Link>
      </div>

      {candidates.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {candidates.slice(0, 5).map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <span className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {c.symbolKey}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                Tier {c.quality} · score {c.rankScore.toFixed(0)} ·{" "}
                {c.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}k close
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          No qualified setups today · Main bottleneck:{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {bottleneckKey === "none_obvious" ? "mixed factors" : bottleneckLabel}
          </span>
        </p>
      )}
    </div>
  );
}
