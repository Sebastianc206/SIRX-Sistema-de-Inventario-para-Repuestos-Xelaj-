import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { GRUPOS_ORDEN, itemsVisibles } from "@/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/layout/BrandLogo";

interface SidebarProps {
  // Modo "icon-rail" (solo escritorio).
  collapsed: boolean;
  onToggleCollapsed: () => void;
  // Panel deslizable (solo móvil).
  mobileOpen: boolean;
  onCloseMobile: () => void;
  // Cierre por navegación (el foco lo mueve el layout al contenido).
  onNavigate: () => void;
}

// Navegación lateral única del shell. Escritorio: panel fijo colapsable a
// riel de íconos (con tooltips). Móvil: panel deslizable con fondo.
export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, onNavigate }: SidebarProps) {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  // Grupos secundarios plegables: cerrados por defecto, se abren solos si la
  // ruta actual está dentro (así siempre se ve dónde estás).
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const cerrarRef = useRef<HTMLButtonElement>(null);
  // Al abrir el panel móvil el foco entra en él (botón cerrar).
  useEffect(() => {
    if (mobileOpen) cerrarRef.current?.focus();
  }, [mobileOpen]);
  const items = itemsVisibles(usuario?.role);
  const grupos = GRUPOS_ORDEN.map((grupo) => ({ grupo, items: items.filter((i) => i.group === grupo) })).filter((g) => g.items.length > 0);

  const alternar = (grupo: string, abierto: boolean) => setAbiertos((prev) => ({ ...prev, [grupo]: !abierto }));

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />}
      <aside id="sidebar-panel" className={`sidebar${collapsed ? " sidebar--collapsed" : ""}${mobileOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <BrandLogo alto={collapsed ? 40 : 34} compacta={collapsed} className="sidebar-brand-logo" />
          {collapsed && <span className="sr-only">SIRX · Repuestos Xelajú</span>}
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">SIRX</span>
            <span className="sidebar-brand-tag">Repuestos Xelajú</span>
          </div>
          <button ref={cerrarRef} type="button" className="sidebar-close" aria-label="Cerrar menú" onClick={onCloseMobile}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Principal">
          {grupos.map(({ grupo, items: lista }) => {
            const plegable = grupo !== "Principal" && !collapsed;
            const contieneRuta = lista.some((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)));
            const abierto = !plegable || (abiertos[grupo] ?? contieneRuta);
            const idLista = `nav-grupo-${grupo}`;
            return (
              <div key={grupo} className="sidebar-group">
                {plegable && (
                  <button
                    type="button"
                    className="sidebar-group-toggle"
                    aria-expanded={abierto}
                    aria-controls={idLista}
                    onClick={() => alternar(grupo, abierto)}
                  >
                    <span>{grupo}</span>
                    <Icon name={abierto ? "chevronDown" : "chevronRight"} size={16} />
                  </button>
                )}
                <ul id={idLista} hidden={!abierto}>
                  {lista.map((item) => {
                    const enlace = (
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--active" : ""}`}
                        onClick={onNavigate}
                      >
                        <Icon name={item.icon} size={20} />
                        <span className="sidebar-link-label">{item.label}</span>
                      </NavLink>
                    );
                    return (
                      <li key={item.to}>
                        {collapsed ? (
                          <Tooltip texto={item.label} lado="derecha">
                            {enlace}
                          </Tooltip>
                        ) : (
                          enlace
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          >
            <Icon name={collapsed ? "chevronsRight" : "chevronsLeft"} size={20} />
            <span className="sidebar-link-label">Contraer menú</span>
          </button>
        </div>
      </aside>
    </>
  );
}
