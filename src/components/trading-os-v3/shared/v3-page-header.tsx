import type { ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  lead: ReactNode;
  actions?: ReactNode;
  testId?: string;
};

export function V3PageHeader({ kicker, title, lead, actions, testId }: Props) {
  return (
    <header className="tosv3-workstation-header" data-testid={testId}>
      <div className="tosv3-workstation-header__copy">
        <p className="tosv3-kicker">{kicker}</p>
        <h1 className="tosv3-workstation-header__title">{title}</h1>
        <p className="tosv3-workstation-header__lead">{lead}</p>
      </div>
      {actions ? <div className="tosv3-workstation-header__actions">{actions}</div> : null}
    </header>
  );
}
