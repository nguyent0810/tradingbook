import type { ButtonHTMLAttributes, ReactNode } from "react";

export type TradeButtonVariant = "buy" | "sell" | "primary" | "secondary";

export type TradeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: TradeButtonVariant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  fullWidth?: boolean;
};

const variantClass: Record<TradeButtonVariant, string> = {
  buy: "btn-buy",
  sell: "btn-sell",
  primary: "btn-primary",
  secondary: "btn-secondary",
};

export function TradeButton({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
  children,
  ...props
}: TradeButtonProps) {
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button
      type="button"
      className={`btn ${variantClass[variant]} ${sizeClass} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
