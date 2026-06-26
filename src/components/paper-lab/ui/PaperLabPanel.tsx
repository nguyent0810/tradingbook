import type { ReactNode } from "react";
import "../paper-lab-command-center.css";

type PanelTone = "default" | "elevated" | "soft" | "muted";

const TONE_CLASS: Record<PanelTone, string> = {
  default: "",
  elevated: "paper-lab-panel--elevated",
  soft: "paper-lab-panel--soft",
  muted: "paper-lab-panel--muted",
};

export function PaperLabPanel({
  title,
  titleExtra,
  children,
  testId,
  className = "",
  tone = "default",
}: {
  title?: string;
  titleExtra?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
  tone?: PanelTone;
}) {
  const toneClass = TONE_CLASS[tone];
  return (
    <section
      className={`paper-lab-panel ${toneClass} ${className}`.trim()}
      data-testid={testId}
    >
      {title && (
        <div className="paper-lab-panel__title-row">
          <h3 className="paper-lab-panel__title">{title}</h3>
          {titleExtra}
        </div>
      )}
      {children}
    </section>
  );
}
