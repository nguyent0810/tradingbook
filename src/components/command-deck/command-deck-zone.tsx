import type { ReactNode } from "react";

export type CommandDeckZoneProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  tag?: ReactNode;
  actions?: ReactNode;
  variant?: "primary" | "actionable" | "context" | "quiet";
  testId?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
};

const variantClass: Record<NonNullable<CommandDeckZoneProps["variant"]>, string> = {
  primary: "command-deck-zone--primary",
  actionable: "command-deck-zone--actionable",
  context: "command-deck-zone--context",
  quiet: "command-deck-zone--quiet",
};

export function CommandDeckZone({
  id,
  eyebrow,
  title,
  lead,
  tag,
  actions,
  variant = "context",
  testId,
  ariaLabelledBy,
  children,
  className = "",
}: CommandDeckZoneProps) {
  const headingId = ariaLabelledBy ?? (id ? `${id}-heading` : undefined);

  return (
    <section
      className={`command-deck-zone dash-v2-zone ${variantClass[variant]} ${className}`.trim()}
      data-testid={testId}
      aria-labelledby={headingId}
    >
      <header
        className={`command-deck-zone__header dash-v2-zone-header${actions ? " dash-v2-zone-header--row" : ""}`}
      >
        <div>
          {eyebrow ? <p className="dash-v2-eyebrow">{eyebrow}</p> : null}
          <h2 id={headingId} className="dash-v2-zone-title">
            {title}
          </h2>
          {lead ? <p className="dash-v2-zone-lead">{lead}</p> : null}
        </div>
        {tag ?? null}
        {actions ? (
          <div className="dash-v2-zone-header__actions">{actions}</div>
        ) : null}
      </header>
      <div className="command-deck-zone__body dash-v2-zone__body">{children}</div>
    </section>
  );
}
