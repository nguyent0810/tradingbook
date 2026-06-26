/** Initial virtual capital per agent (VND). */
export const PAPER_INITIAL_CAPITAL_VND = 500_000_000;

export const PAPER_MAX_PORTFOLIO_EXPOSURE_PCT = 0.7;
export const PAPER_MAX_PER_TRADE_EXPOSURE_PCT = 0.2;
export const PAPER_BASE_RISK_PER_TRADE_PCT = 0.01;
export const PAPER_DEFAULT_FEE_BPS = 15;
export const PAPER_DEFAULT_SLIPPAGE_BPS = 10;
export const PAPER_VN_LIMIT_BAND_PCT = 0.07;
export const PAPER_MAX_NEW_POSITIONS_PER_DAY = 3;

export const PAPER_CONTEXT_SCHEMA_VERSION = "2.0.0" as const;
export const LAB_REGIME_SCHEMA_VERSION = "1.0.0" as const;
export const LAB_CIO_SCHEMA_VERSION = "2.0.0" as const;

export const PAPER_AGENT_SEEDS = [
  { slug: "safe_investor", displayName: "Safe Investor", style: "Defensive" },
  { slug: "aggressive_investor", displayName: "Aggressive Investor", style: "Offensive" },
  { slug: "trend_follower", displayName: "Trend Follower", style: "Trend" },
  { slug: "momentum_investor", displayName: "Momentum Investor", style: "Momentum" },
  { slug: "value_investor", displayName: "Value Investor", style: "Value" },
  { slug: "swing_trader", displayName: "Swing Trader", style: "Swing" },
  { slug: "mean_reversion_trader", displayName: "Mean Reversion Trader", style: "MeanRev" },
  { slug: "risk_manager", displayName: "Risk Manager", style: "Risk" },
  { slug: "devils_advocate", displayName: "Devil's Advocate", style: "Contrarian" },
  { slug: "cio", displayName: "CIO", style: "Meta" },
] as const;

export type PaperAgentSlug = (typeof PAPER_AGENT_SEEDS)[number]["slug"];
