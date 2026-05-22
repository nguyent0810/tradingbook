/**
 * Design token names for programmatic use (CSS vars remain source of truth).
 */
export const designTokens = {
  surface: {
    primary: "var(--bg-primary)",
    secondary: "var(--bg-secondary)",
    tertiary: "var(--bg-tertiary)",
    elevated: "var(--bg-elevated)",
    hover: "var(--bg-hover)",
  },
  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    tertiary: "var(--text-tertiary)",
    muted: "var(--text-muted)",
  },
  border: {
    primary: "var(--border-primary)",
    secondary: "var(--border-secondary)",
    focus: "var(--border-focus)",
  },
  semantic: {
    success: "var(--success)",
    danger: "var(--danger)",
    warning: "var(--warning)",
    info: "var(--info)",
  },
  trade: {
    buy: "var(--buy)",
    sell: "var(--sell)",
    long: "var(--long)",
    short: "var(--short)",
    priceUp: "var(--price-up)",
    priceDown: "var(--price-down)",
    pnlPositive: "var(--pnl-positive)",
    pnlNegative: "var(--pnl-negative)",
  },
  accent: {
    DEFAULT: "var(--accent)",
    hover: "var(--accent-hover)",
    muted: "var(--accent-muted)",
    text: "var(--accent-text)",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
  },
  layout: {
    headerHeight: "var(--app-header-height)",
    maxWidth: "var(--app-max-width)",
  },
} as const;

export type PriceDirection = "up" | "down" | "flat";

export function priceColor(direction: PriceDirection): string {
  if (direction === "up") return designTokens.trade.priceUp;
  if (direction === "down") return designTokens.trade.priceDown;
  return designTokens.text.secondary;
}

export function pnlColor(value: number): string {
  if (value > 0) return designTokens.trade.pnlPositive;
  if (value < 0) return designTokens.trade.pnlNegative;
  return designTokens.text.primary;
}
