import type { SetupCardData } from "../types";

type Props = {
  cards: SetupCardData[];
};

function healthClass(health: SetupCardData["health"]): string {
  if (health === "Healthy") return "tosv3-health--ok";
  if (health === "Warning") return "tosv3-health--warn";
  return "tosv3-health--blocked";
}

function actionClass(actionState: string): string {
  if (actionState.includes("EXECUTE")) return "tosv3-setup__action--execute";
  if (actionState.includes("DO NOT")) return "tosv3-setup__action--blocked";
  if (actionState.includes("WATCH")) return "tosv3-setup__action--watch";
  return "tosv3-setup__action--armed";
}

export function SetupIntelligenceRail({ cards }: Props) {
  return (
    <section className="tosv3-panel tosv3-setup-rail" aria-label="Setup intelligence cards">
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Setup Intelligence</span>
        <p className="tosv3-type-muted">Trigger · risk · action</p>
      </div>
      <div className="tosv3-setup-rail__list">
        {cards.map((card) => (
          <article key={card.symbol} className="tosv3-setup">
            <header className="tosv3-setup__header">
              <div className="tosv3-setup__head-main">
                <strong className="tosv3-setup__symbol">{card.symbol}</strong>
                <span className="tosv3-setup__tier">{card.tier}</span>
              </div>
              <span className={`tosv3-setup__action ${actionClass(card.actionState)}`}>{card.actionState}</span>
            </header>
            <p className="tosv3-setup__type">{card.setupType}</p>
            <dl className="tosv3-setup__metrics">
              <div className="tosv3-setup__metric tosv3-setup__metric--primary">
                <dt>Trigger</dt>
                <dd className="tabular-nums">{card.entry}</dd>
              </div>
              <div className="tosv3-setup__metric">
                <dt>Stop</dt>
                <dd className="tabular-nums">{card.stop}</dd>
              </div>
              <div className="tosv3-setup__metric">
                <dt>R:R</dt>
                <dd className="tabular-nums">{card.riskToReward}</dd>
              </div>
              <div className="tosv3-setup__metric">
                <dt>Conf</dt>
                <dd className="tabular-nums">{card.confidence}%</dd>
              </div>
            </dl>
            <footer className="tosv3-setup__footer">
              <span className={healthClass(card.health)}>{card.health}</span>
              {card.blocker !== "None" ? <p>{card.blocker}</p> : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
