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
    select: {
      accountEquityVnd: true,
      riskPerTradePct: true,
      maxPositionPct: true,
      liquidityCapPct: true,
    },
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
            Configure account-level values used by Dashboard risk guardrails and the Setups
            position-sizing panel.
          </p>
        </div>
      </header>

      <div className="dash-card" style={{ maxWidth: "32rem" }}>
        <div className="dash-card__header">
          <h2 className="dash-card__title">Trading account</h2>
          <p className="dash-card__lead">
            Prefills the recommended position-sizing panel on the Setups page — equity, base risk
            %, max trade %, and liquidity cap (% of a symbol&rsquo;s average daily traded value).
            You can still edit any value on that panel for a what-if scenario. Risk per trade, max
            position size, and liquidity cap are optional — leave blank to use the system default
            for each.
          </p>
        </div>
        <TradingSettingsForm
          currentAccountEquityVnd={settings?.accountEquityVnd ?? null}
          currentRiskPerTradePct={settings?.riskPerTradePct ?? null}
          currentMaxPositionPct={settings?.maxPositionPct ?? null}
          currentLiquidityCapPct={settings?.liquidityCapPct ?? null}
        />
        <p className="dash-exposure__caption text-xs" style={{ color: "var(--text-tertiary)", marginTop: "var(--space-4)" }}>
          Equity falls back to the <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code>{" "}
          environment variable if unset here. Max book (%) is not user-configurable — it&rsquo;s
          driven by today&rsquo;s verdict, on the Dashboard.
        </p>
      </div>
    </div>
  );
}
