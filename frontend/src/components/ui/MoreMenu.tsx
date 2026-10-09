import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

export interface MoreMenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  // Acción destructiva: se pinta con el tono de error.
  danger?: boolean;
}

interface MoreMenuProps {
  items: MoreMenuItem[];
  // Texto del botón (por defecto "Más").
  label?: string;
}

// Menú "Más": agrupa las acciones secundarias de una vista (exportar, carga
// masiva, densidad...). Patrón "menu button": Escape cierra y devuelve el
// foco, clic fuera cierra, flechas recorren los ítems.
export function MoreMenu({ items, label = "Más" }: MoreMenuProps) {
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
    contenedor.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
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
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const lista = Array.from(contenedor.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
      const actual = lista.indexOf(document.activeElement as HTMLElement);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      lista[(actual + paso + lista.length) % lista.length]?.focus();
    }
  }

  return (
    <div className="more-menu" ref={contenedor} onKeyDown={onKeyDown}>
      <button
        ref={boton}
        type="button"
        className="btn btn--secondary btn--md"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icon name="more" size={18} strokeWidth={3} />
        {label}
      </button>
      {abierto && (
        <div id={idMenu} className="menu more-menu-list" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item${item.danger ? " menu-item--danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                setAbierto(false);
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
