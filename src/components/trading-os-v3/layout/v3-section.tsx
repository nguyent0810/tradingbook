import type { ReactNode } from "react";

export type V3SectionProps = {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
};

/** Compact section header + body — replaces CommandDeckZone on V3 workstation routes. */
export function V3Section({
  eyebrow,
  title,
  lead,
  children,
  testId,
  className = "",
}: V3SectionProps) {
  return (
    <section className={`tosv3-section ${className}`.trim()} data-testid={testId}>
      <header className="tosv3-section__head">
        {eyebrow ? <span className="tosv3-kicker">{eyebrow}</span> : null}
        <h2 className="tosv3-section__title">{title}</h2>
        {lead ? <p className="tosv3-section__lead">{lead}</p> : null}
      </header>
      <div className="tosv3-section__body">{children}</div>
    </section>
  );
}
