import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface AlertProps {
  tone?: "error" | "success" | "warning" | "info";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const ICONOS = { error: "alert", success: "checkCircle", warning: "alert", info: "info" } as const;

// Aviso en línea (errores de carga, errores de formulario). Los resultados
// de acciones puntuales ("se guardó") van a Toast, no aquí.
export function Alert({ tone = "error", children, action, className }: AlertProps) {
  return (
    <div className={`alert alert--${tone}${className ? ` ${className}` : ""}`} role={tone === "error" || tone === "warning" ? "alert" : "status"}>
      <Icon name={ICONOS[tone]} size={18} />
      <div className="alert-body">{children}</div>
      {action}
    </div>
  );
}
