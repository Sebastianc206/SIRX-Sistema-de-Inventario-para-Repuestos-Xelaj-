import type { ReactNode } from "react";
import { estadoStock } from "@/utils/estadoStock";
import type { EstadoStockApi } from "@/utils/estadoStock";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

interface BadgeProps {
  tone?: BadgeTone;
  // Punto de color + texto: el estado nunca se comunica solo con color.
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = true, className, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}${className ? ` ${className}` : ""}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const TONO_STOCK = {
  "stock-badge--agotado": "danger",
  "stock-badge--bajo": "warning",
  "stock-badge--en-stock": "success",
} as const;

// Badge de stock: el tono sale SIEMPRE de estadoStock (existencia vs umbral
// efectivo, CONTEXTO_SIRX.md §8), nunca se decide por componente. `estado`
// es el que calculó el backend; `minimo` es el umbral efectivo.
export function StockBadge({
  cantidad,
  minimo,
  estado,
  mostrarCantidad = true,
}: {
  cantidad: number;
  minimo: number;
  estado?: EstadoStockApi;
  mostrarCantidad?: boolean;
}) {
  const { clase, texto } = estadoStock(cantidad, minimo, estado);
  const tone = TONO_STOCK[clase as keyof typeof TONO_STOCK] ?? "neutral";
  return (
    <Badge tone={tone}>
      {mostrarCantidad ? `${cantidad} · ${texto}` : texto}
    </Badge>
  );
}

export function EstadoBadge({ activo }: { activo: boolean }) {
  return <Badge tone={activo ? "success" : "neutral"}>{activo ? "Activo" : "Inactivo"}</Badge>;
}
