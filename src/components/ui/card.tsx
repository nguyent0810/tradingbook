import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: "glass" | "solid";
  glow?: "danger" | "warning" | "success" | "none";
  "data-testid"?: string;
};

const glowClass: Record<NonNullable<CardProps["glow"]>, string> = {
  danger: "cd-card--glow-danger",
  warning: "cd-card--glow-warning",
  success: "cd-card--glow-success",
  none: "",
};

const variantClass: Record<NonNullable<CardProps["variant"]>, string> = {
  glass: "cd-card--glass cd-card--depth",
  solid: "",
};

export function Card({
  children,
  className = "",
  variant = "glass",
  glow = "none",
  "data-testid": testId,
}: CardProps) {
  return (
    <div
      className={`cd-card ${variantClass[variant]} ${glowClass[glow]} ${className}`.trim()}
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
