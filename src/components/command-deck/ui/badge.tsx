import type { StatusTone } from "../types";

const toneClass: Record<StatusTone, string> = {
  danger: "cd-badge--danger",
  warning: "cd-badge--warning",
  success: "cd-badge--success",
  neutral: "cd-badge--neutral",
};

export function Badge({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
}) {
  return (
    <span className={`cd-badge ${toneClass[tone]} ${pulse ? "cd-badge--pulse" : ""}`.trim()}>
      <span className="cd-badge__dot" aria-hidden />
      {children}
    </span>
  );
}
