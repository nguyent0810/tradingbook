import type { ReactNode } from "react";
import { Input, type InputProps } from "./input";

export type FormFieldProps = {
  id: string;
  label: string;
  error?: string | null;
  helperText?: string;
  children?: ReactNode;
} & Omit<InputProps, "id">;

/**
 * Label + control + error, wired with the aria-invalid/aria-describedby/
 * aria-live pattern already proven in the auth forms. Pass `children` to
 * render a custom control (e.g. Select) in place of the default Input.
 */
export function FormField({
  id,
  label,
  error,
  helperText,
  children,
  ...inputProps
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-field">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children ?? (
        <Input
          id={id}
          invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...inputProps}
        />
      )}
      {helperText ? (
        <p id={helperId} className="form-field__helper">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="form-field__error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
