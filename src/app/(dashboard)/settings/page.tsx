import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TradingSettingsForm } from "@/components/settings/trading-settings-form";

export const metadata: Metadata = {
  title: "Settings — TradeLog",
  description: "Account and risk configuration.",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const settings = await prisma.userTradingSettings.findUnique({
    where: { userId: session.userId },
    select: { accountEquityVnd: true },
  });

  return (
    <div
      className="cd-root page-container command-deck dash-cockpit dash-cockpit--v2 pb-10"
      data-testid="settings-page"
    >
      <header className="dash-v2-page-header">
        <div className="dash-v2-page-header__copy">
          <p className="dash-v2-eyebrow">Account</p>
          <h1 className="dash-v2-page-header__title">Settings</h1>
          <p className="dash-v2-page-header__lead">
            Configure account-level values used across Dashboard risk guardrails and position
            sizing.
          </p>
        </div>
      </header>

      <div className="dash-card" style={{ maxWidth: "32rem" }}>
        <div className="dash-card__header">
          <h2 className="dash-card__title">Trading account</h2>
          <p className="dash-card__lead">
            Used to compute book-risk caps and recommended position sizing on the Dashboard.
          </p>
        </div>
        <TradingSettingsForm currentAccountEquityVnd={settings?.accountEquityVnd ?? null} />
        <p className="dash-exposure__caption text-xs" style={{ color: "var(--text-tertiary)", marginTop: "var(--space-4)" }}>
          Falls back to the <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code>{" "}
          environment variable if unset here.
        </p>
      </div>
    </div>
  );
}
