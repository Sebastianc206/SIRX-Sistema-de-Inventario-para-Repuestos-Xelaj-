import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

// Botón único del sistema. type="button" por defecto para no enviar
// formularios por accidente; el submit se declara de forma explícita.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading = false, block = false, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const clases = ["btn", `btn--${variant}`, `btn--${size}`, block ? "btn--block" : "", loading ? "btn--loading" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={clases} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
    </button>
  );
});
