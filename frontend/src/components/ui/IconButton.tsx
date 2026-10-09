import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ButtonVariant } from "@/components/ui/Button";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: IconName;
  // Obligatorio: es el nombre accesible Y el texto del tooltip.
  label: string;
  variant?: Exclude<ButtonVariant, "primary" | "secondary"> | "secondary";
  size?: "sm" | "md";
  tooltipSide?: "arriba" | "abajo" | "derecha";
  sinTooltip?: boolean;
}

// Botón de solo ícono (objetivo táctil de 44px) con tooltip y aria-label.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "ghost", size = "md", tooltipSide = "arriba", sinTooltip = false, className, type = "button", ...rest },
  ref,
) {
  const boton = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={["btn", "btn--icon", `btn--${variant}`, `btn--icon-${size}`, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
    </button>
  );
  return sinTooltip ? boton : <Tooltip texto={label} lado={tooltipSide}>{boton}</Tooltip>;
});
