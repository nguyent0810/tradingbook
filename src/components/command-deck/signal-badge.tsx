import type { ReactNode } from "react";

export type SignalBadgeVariant =
  | "tier-a"
  | "tier-b"
  | "healthy"
  | "warning"
  | "at-risk"
  | "dead"
  | "ready"
  | "watching"
  | "neutral";

export type SignalBadgeProps = {
  variant: SignalBadgeVariant;
  children: ReactNode;
  className?: string;
  title?: string;
};

const variantClass: Record<SignalBadgeVariant, string> = {
  "tier-a": "signal-badge--tier-a",
  "tier-b": "signal-badge--tier-b",
  healthy: "signal-badge--healthy",
  warning: "signal-badge--warning",
  "at-risk": "signal-badge--at-risk",
  dead: "signal-badge--dead",
  ready: "signal-badge--ready",
  watching: "signal-badge--watching",
  neutral: "signal-badge--neutral",
};

export function SignalBadge({
  variant,
  children,
  className = "",
  title,
}: SignalBadgeProps) {
  const isEmphasis = variant === "at-risk" || variant === "warning" || variant === "dead";

  return (
    <span
      className={`signal-badge ${variantClass[variant]} ${className}`.trim()}
      title={title}
      role={isEmphasis ? "status" : undefined}
    >
      <span className="signal-badge__label">{children}</span>
    </span>
  );
}

export function healthLevelToBadgeVariant(
  level: string
): SignalBadgeVariant {
  switch (level) {
    case "HEALTHY":
      return "healthy";
    case "WARNING":
      return "warning";
    case "AT_RISK":
      return "at-risk";
    case "DEAD":
      return "dead";
    default:
      return "neutral";
  }
}

export function qualityToTierVariant(quality: string): SignalBadgeVariant {
  return quality === "A" ? "tier-a" : "tier-b";
}
