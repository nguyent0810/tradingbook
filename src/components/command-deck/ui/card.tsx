import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  glow?: "danger" | "warning" | "success" | "none";
  "data-testid"?: string;
};

const glowClass: Record<NonNullable<CardProps["glow"]>, string> = {
  danger: "cd-card--glow-danger",
  warning: "cd-card--glow-warning",
  success: "cd-card--glow-success",
  none: "",
};

export function Card({ children, className = "", glow = "none", "data-testid": testId }: CardProps) {
  return (
    <div
      className={`cd-card ${glowClass[glow]} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="cd-card__header">
      <div>
        <p className="cd-kicker">{title}</p>
        {subtitle ? <p className="cd-card__subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
