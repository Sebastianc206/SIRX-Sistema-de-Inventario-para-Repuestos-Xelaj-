import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface OverlayProps {
  variant: "modal" | "drawer" | "alert" | "palette";
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  size?: "sm" | "md" | "lg";
  onRequestClose: () => void;
  children: ReactNode;
}

// Contador: con diálogos anidados (drawer + confirmación) el scroll del body
// y el atributo inert solo se liberan al cerrar el último.
let abiertos = 0;

function bloquearFondo() {
  abiertos += 1;
  if (abiertos === 1) {
    document.body.style.overflow = "hidden";
    document.getElementById("root")?.setAttribute("inert", "");
  }
}

function liberarFondo() {
  abiertos = Math.max(0, abiertos - 1);
  if (abiertos === 0) {
    document.body.style.overflow = "";
    document.getElementById("root")?.removeAttribute("inert");
  }
}

// Base de Modal, Drawer y ConfirmDialog: portal a <body>, fondo, trampa de
// foco con retorno, cierre con Escape / clic en el fondo y fondo inerte.
export function Overlay({ variant, role = "dialog", labelledBy, describedBy, size = "md", onRequestClose, children }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const clicIniciadoEnFondo = useRef(false);
  const { onKeyDown } = useFocusTrap(panelRef);

  useEffect(() => {
    bloquearFondo();
    return liberarFondo;
  }, []);

  return createPortal(
    <div
      className={`overlay overlay--${variant}`}
      onMouseDown={(e) => {
        clicIniciadoEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && clicIniciadoEnFondo.current) onRequestClose();
      }}
    >
      <div
        ref={panelRef}
        className={`dialog dialog--${variant} dialog--${size}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onRequestClose();
            return;
          }
          onKeyDown(e);
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
