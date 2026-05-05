import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import { formatDecisionLevelForDisplay } from "@/lib/scanner/trading-decision";

export function SetupsTodaysActionBlock({ decision }: { decision: DailyTradingDecision }) {
  const actionLabel = formatDecisionLevelForDisplay(decision.level);

  return (
    <section
      className="card border-2 p-7 sm:p-8"
      style={{ borderColor: "var(--accent-text)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent-text)" }}>
        Trading stance
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
        Today&apos;s Action: {actionLabel}
      </p>
      <p className="mt-5 text-lg font-medium sm:text-xl" style={{ color: "var(--text-secondary)" }}>
        Max exposure guidance:{" "}
        <span style={{ color: "var(--text-primary)" }}>{decision.allocation}</span>
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed sm:text-sm" style={{ color: "var(--text-tertiary)" }}>
        This is a portfolio-level exposure guide, not a buy signal.
      </p>
      <p className="mt-4 max-w-3xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--text-secondary)" }}>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Reason:{" "}
        </span>
        {decision.explanation}
      </p>
    </section>
  );
}
