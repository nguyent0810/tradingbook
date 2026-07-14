export type BadgeTone = "danger" | "warning" | "success" | "neutral" | "info";

const toneClass: Record<BadgeTone, string> = {
  danger: "cd-badge--danger",
  warning: "cd-badge--warning",
  success: "cd-badge--success",
  neutral: "cd-badge--neutral",
  info: "cd-badge--info",
};

export function Badge({
  children,
  tone = "neutral",
  pulse = false,
  size = "default",
  titleCase = false,
  className = "",
  bare = false,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  size?: "default" | "compact";
  titleCase?: boolean;
  className?: string;
  /** Skip the cd-badge base classes/dot -- for a domain component with its
   * own complete styling that renders Badge for structural reuse only. */
  bare?: boolean;
}) {
  if (bare) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span
      className={`cd-badge ${toneClass[tone]} ${size === "compact" ? "cd-badge--compact" : ""} ${titleCase ? "cd-badge--title" : ""} ${pulse ? "cd-badge--pulse" : ""} ${className}`.trim()}
    >
      <span className="cd-badge__dot" aria-hidden />
      {children}
    </span>
  );
}
