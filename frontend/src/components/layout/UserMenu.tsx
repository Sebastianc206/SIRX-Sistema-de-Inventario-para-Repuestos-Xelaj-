import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";

function iniciales(nombre: string | undefined): string {
  if (!nombre) return "?";
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "")).toUpperCase();
}

// Menú de usuario (patrón "menu button" de WAI-ARIA): Escape cierra y
// devuelve el foco al botón, clic fuera cierra, flechas recorren los ítems.
export function UserMenu() {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    // Foco al primer ítem al abrir.
    contenedor.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!abierto) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    } else if (e.key === "Tab") {
      setAbierto(false);
    }
  }

  return (
    <div className="user-menu" ref={contenedor} onKeyDown={onKeyDown}>
      <button
        ref={boton}
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {iniciales(usuario?.nombreCompleto)}
        </span>
        <span className="user-menu-text">
          <span className="user-menu-name">{usuario?.nombreCompleto}</span>
          <span className="user-menu-role">{usuario?.role}</span>
        </span>
        <Icon name="chevronDown" size={16} className="user-menu-caret" />
      </button>

      {abierto && (
        <div id={idMenu} className="menu" role="menu" aria-label="Menú de usuario">
          <div className="menu-header" role="presentation">
            <span className="menu-header-name">{usuario?.nombreCompleto}</span>
            <span className="menu-header-sub">
              @{usuario?.username} · {usuario?.role}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item--danger"
            onClick={() => {
              setAbierto(false);
              cerrarSesion();
            }}
          >
            <Icon name="logout" size={18} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
