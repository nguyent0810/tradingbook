import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "auth";
export type ButtonSize = "sm" | "default" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
  auth: "cd-auth-btn",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "btn-sm",
  default: "",
  lg: "btn-lg",
};

/** cd-auth-btn is a fully self-contained class from the --cd-* auth
 * design language -- it must not compose with the generic .btn base
 * (different padding/font-size/radius would conflict). */
const standaloneVariants = new Set<ButtonVariant>(["auth"]);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const base = standaloneVariants.has(variant) ? "" : "btn";
  return (
    <button
      type={type}
      className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      {...rest}
    />
  );
}
