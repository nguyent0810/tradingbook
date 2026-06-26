import type { ReactNode } from "react";
import "../paper-lab-command-center.css";

export function PaperLabPanel({
  title,
  titleExtra,
  children,
  testId,
  className = "",
}: {
  title?: string;
  titleExtra?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <section className={`paper-lab-panel ${className}`.trim()} data-testid={testId}>
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
