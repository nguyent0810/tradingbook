import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "TradeLog — Setup Intelligence Platform",
  description:
    "TradeLog is a setup intelligence platform: scan the market, surface high-quality setups with the evidence behind each one, and pressure-test every decision before you commit capital.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TradeLog",
    title: "TradeLog — Setup Intelligence Platform",
    description:
      "Know which opportunities deserve your capital. Scan the market, surface high-quality setups with the evidence behind each one, and pressure-test every decision before you commit.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeLog — Setup Intelligence Platform",
    description:
      "Know which opportunities deserve your capital. Evidence-driven decision support for traders.",
  },
};

const YEAR = 2026;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tradelog.app";

// Structured data — factual only (no fabricated ratings, prices, or reviews).
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TradeLog",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "TradeLog is a setup intelligence platform: scan the market, surface high-quality setups with the evidence behind each one, and pressure-test every decision before you commit capital.",
};

function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="cd-landing__brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

/* ── Faithful, static product previews rendered in the app's own language ── */

function DecisionMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Dashboard decision preview: today's read is Trade at normal size, risk-on regime, entry gate open.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Today&apos;s decision</span>
        <span className="cd-mock__chip cd-mock__chip--go">
          <span className="cd-mock__dot" />
          Go · Normal
        </span>
      </div>
      <div className="cd-mock__verdict">Trade — normal size</div>
      <div className="cd-mock__sub">Conviction 68% · risk-on backdrop</div>
      <div className="cd-mock__meter" aria-hidden="true">
        <div className="cd-mock__meter-fill" style={{ width: "68%" }} />
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Market regime</span>
          <span className="cd-mock__row-val">Risk-on</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Entry gate</span>
          <span className="cd-mock__row-val">Open</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-label">Relative strength</span>
          <span className="cd-mock__row-val">Leaders aligned</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        Conditions support new entries at standard size — nothing on watch is blocking.
      </p>
    </div>
  );
}

function SetupsMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Setups preview: ranked candidates FPT ready and MWG watching for a breakout, each with evidence.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Validated pipeline</span>
        <span className="cd-mock__chip cd-mock__chip--cyan">5 candidates</span>
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">FPT</span>
          <span className="cd-mock__chip cd-mock__chip--go">Ready</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">MWG</span>
          <span className="cd-mock__chip cd-mock__chip--watch">Watch · breakout</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">HPG</span>
          <span className="cd-mock__chip cd-mock__chip--watch">Watch · pullback</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        FPT: price in the entry zone · relative strength leading · one confirmation away.
      </p>
    </div>
  );
}

function ArenaMock() {
  return (
    <div className="cd-mock" role="img" aria-label="Arena preview: strategies ranked by simulated result before any real capital is committed.">
      <div className="cd-mock__head">
        <span className="cd-mock__eyebrow">Simulation only</span>
        <span className="cd-mock__chip cd-mock__chip--cyan">No real capital</span>
      </div>
      <div className="cd-mock__rows">
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Momentum-A</span>
          <span className="cd-mock__row-val cd-mock__row-val--pos">+12.4%</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Pullback-B</span>
          <span className="cd-mock__row-val cd-mock__row-val--pos">+7.1%</span>
        </div>
        <div className="cd-mock__row">
          <span className="cd-mock__row-sym">Breakout-C</span>
          <span className="cd-mock__row-val">+2.0%</span>
        </div>
      </div>
      <p className="cd-mock__evidence">
        Strategies compete on the same sessions — see what holds up before you back it.
      </p>
    </div>
  );
}

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="cd-landing">
      {/* Static JSON-LD (no user input) — safe use of dangerouslySetInnerHTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <a href="#main" className="cd-landing__skip">
        Skip to content
      </a>
      <header className="cd-landing__header">
        <div className="cd-landing__container cd-landing__header-inner">
          <Link href="/" className="cd-landing__brand" aria-label="TradeLog home">
            <BrandMark />
            TradeLog
          </Link>
          <nav className="cd-landing__nav" aria-label="Account">
            <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost">
              Sign in
            </Link>
            <Link href="/register" className="cd-landing-btn cd-landing-btn--primary">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="cd-landing__main" id="main" tabIndex={-1}>
        {/* Hero */}
        <section className="cd-landing__container cd-landing-hero" aria-labelledby="hero-title">
          <div>
            <span className="cd-landing-hero__eyebrow">Setup Intelligence Platform</span>
            <h1 id="hero-title" className="cd-landing-hero__title">
              Know which opportunities{" "}
              <span className="cd-landing-hero__title-accent">deserve your capital.</span>
            </h1>
            <p className="cd-landing-hero__lead">
              Scan the market, surface high-quality setups with the evidence behind each one,
              and pressure-test every decision before you commit capital.
            </p>
            <div className="cd-landing-hero__cta">
              <Link href="/register" className="cd-landing-btn cd-landing-btn--primary cd-landing-btn--lg">
                Create account
              </Link>
              <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost cd-landing-btn--lg">
                Sign in
              </Link>
            </div>
            <p className="cd-landing-hero__note">
              Decision support — not record-keeping, not a broker. TradeLog never places trades.
            </p>
          </div>
          <div className="cd-landing-hero__visual">
            <DecisionMock />
          </div>
        </section>

        {/* The problem */}
        <section className="cd-landing-section" aria-labelledby="problem-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">The problem</p>
            <h2 id="problem-title" className="cd-landing-section__title">
              The hard part isn&apos;t finding trades. It&apos;s knowing which ones deserve your capital.
            </h2>
            <p className="cd-landing-section__lead">
              Most tools record what you already did or track what you already hold. Neither tells
              you whether today&apos;s setup is worth acting on — so conviction comes from gut feel,
              and the same mistakes repeat.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="cd-landing-section" id="workflow" aria-labelledby="workflow-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">How it works</p>
            <h2 id="workflow-title" className="cd-landing-section__title">
              One workflow, from market open to decision.
            </h2>
            <p className="cd-landing-section__lead">
              Three connected surfaces move you from a read on the day to a decision you can defend.
            </p>
            <ol className="cd-landing-steps">
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">1</span>
                <p className="cd-landing-step__stage">Dashboard</p>
                <h3 className="cd-landing-step__title">Scan the day</h3>
                <p className="cd-landing-step__copy">
                  Start with today&apos;s read — market regime, entry gate, and relative strength in
                  a single verdict. Know whether it&apos;s a day to act.
                </p>
              </li>
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">2</span>
                <p className="cd-landing-step__stage">Setups</p>
                <h3 className="cd-landing-step__title">Validate the edge</h3>
                <p className="cd-landing-step__copy">
                  Work a ranked pipeline of breakout and pullback candidates. Each carries the
                  evidence and the exact condition still to confirm.
                </p>
              </li>
              <li className="cd-landing-step">
                <span className="cd-landing-step__num">3</span>
                <p className="cd-landing-step__stage">Arena</p>
                <h3 className="cd-landing-step__title">Pressure-test it</h3>
                <p className="cd-landing-step__copy">
                  Put strategies through simulated competition before you commit real capital. See
                  what actually holds up.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Three pillars */}
        <section className="cd-landing-section" id="pillars" aria-labelledby="pillars-title">
          <div className="cd-landing__container">
            <p className="cd-landing-section__eyebrow">Inside the platform</p>
            <h2 id="pillars-title" className="cd-landing-section__title">
              Three surfaces, one decision.
            </h2>
            <div className="cd-landing-pillars">
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Dashboard</span>
                <h3 className="cd-landing-pillar__title">Today&apos;s decision, at a glance</h3>
                <p className="cd-landing-pillar__copy">
                  Regime, entry gate, and relative strength resolve into one verdict — so you know
                  if today is a go before you look at a single chart.
                </p>
                <DecisionMock />
              </article>
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Setups</span>
                <h3 className="cd-landing-pillar__title">A pipeline you can trust</h3>
                <p className="cd-landing-pillar__copy">
                  Breakout and pullback candidates, ranked — each with the evidence that qualified
                  it and the one condition still to confirm.
                </p>
                <SetupsMock />
              </article>
              <article className="cd-landing-pillar">
                <span className="cd-landing-pillar__name">Arena</span>
                <h3 className="cd-landing-pillar__title">Proof before capital</h3>
                <p className="cd-landing-pillar__copy">
                  Strategies compete in simulation on the same market sessions — so you back what
                  holds up, not what sounds good.
                </p>
                <ArenaMock />
              </article>
            </div>
          </div>
        </section>

        {/* Evidence-driven decision making */}
        <section className="cd-landing-section" id="evidence" aria-labelledby="evidence-title">
          <div className="cd-landing__container cd-landing-evidence">
            <div>
              <p className="cd-landing-section__eyebrow">Why trust it</p>
              <h2 id="evidence-title" className="cd-landing-section__title">
                Every call shows its work.
              </h2>
              <p className="cd-landing-section__lead">
                No black box. You act on reasoning you can defend — not a mystery score.
              </p>
              <ul className="cd-landing-evidence__list">
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Evidence on every setup</strong> — the exact signals that qualified it.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>The condition still to confirm</strong> — what has to happen before it&apos;s a go.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Relative strength in context</strong> — leaders measured against the benchmark, not in isolation.</span>
                </li>
                <li className="cd-landing-evidence__item">
                  <svg className="cd-landing-evidence__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  <span><strong>Simulated before real</strong> — pressure-tested in the Arena first.</span>
                </li>
              </ul>
            </div>
            <div>
              <SetupsMock />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="cd-landing-section" aria-labelledby="cta-title">
          <div className="cd-landing__container">
            <div className="cd-landing-cta">
              <h2 id="cta-title" className="cd-landing-cta__title">
                Start making decisions you can defend.
              </h2>
              <p className="cd-landing-cta__lead">
                Create an account and put today&apos;s market to the test.
              </p>
              <div className="cd-landing-cta__actions">
                <Link href="/register" className="cd-landing-btn cd-landing-btn--primary cd-landing-btn--lg">
                  Create account
                </Link>
                <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost cd-landing-btn--lg">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cd-landing-footer">
        <div className="cd-landing__container">
          <div className="cd-landing-footer__inner">
            <div className="cd-landing-footer__brand">
              <Link href="/" className="cd-landing__brand" aria-label="TradeLog home">
                <BrandMark />
                TradeLog
              </Link>
              <p className="cd-landing-footer__tagline">
                Setup intelligence for decisive traders — evidence-driven decision support from
                the day&apos;s read to a validated setup.
              </p>
            </div>
            <div className="cd-landing-footer__links">
              <div className="cd-landing-footer__col">
                <span className="cd-landing-footer__col-title">Explore</span>
                <a href="#workflow" className="cd-landing-footer__link">How it works</a>
                <a href="#pillars" className="cd-landing-footer__link">The platform</a>
                <a href="#evidence" className="cd-landing-footer__link">Why trust it</a>
              </div>
              <div className="cd-landing-footer__col">
                <span className="cd-landing-footer__col-title">Account</span>
                <Link href="/login" className="cd-landing-footer__link">Sign in</Link>
                <Link href="/register" className="cd-landing-footer__link">Create account</Link>
              </div>
            </div>
          </div>
          <div className="cd-landing-footer__legal">
            <p className="cd-landing-footer__disclaimer">
              TradeLog provides research and decision-support tools. It is not investment advice
              and does not place trades. Simulated results do not guarantee future outcomes.
            </p>
            <p>© {YEAR} TradeLog</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
