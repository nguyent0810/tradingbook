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
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  size?: "default" | "compact";
  titleCase?: boolean;
}) {
  return (
    <span
      className={`cd-badge ${toneClass[tone]} ${size === "compact" ? "cd-badge--compact" : ""} ${titleCase ? "cd-badge--title" : ""} ${pulse ? "cd-badge--pulse" : ""}`.trim()}
    >
      <span className="cd-badge__dot" aria-hidden />
      {children}
    </span>
  );
}
