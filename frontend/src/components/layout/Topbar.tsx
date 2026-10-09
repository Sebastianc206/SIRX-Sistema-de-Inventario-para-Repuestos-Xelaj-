import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { UserMenu } from "@/components/layout/UserMenu";
import { migasDePan } from "@/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";

interface TopbarProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
  onOpenPalette: () => void;
}

const ES_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const migas = migasDePan(pathname);
  return (
    <nav aria-label="Ruta de navegación" className="breadcrumbs">
      <ol>
        {migas.map((miga, i) => {
          const ultima = i === migas.length - 1;
          return (
            <li key={`${miga.label}-${i}`}>
              {miga.to && !ultima ? (
                <Link to={miga.to}>{miga.label}</Link>
              ) : (
                <span aria-current={ultima ? "page" : undefined} className={ultima ? "breadcrumbs-current" : undefined}>
                  {miga.label}
                </span>
              )}
              {!ultima && <Icon name="chevronRight" size={14} className="breadcrumbs-sep" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Topbar({ onOpenMenu, menuOpen, onOpenPalette }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        id="menu-toggle"
        type="button"
        className="topbar-menu-btn"
        aria-label="Abrir menú de navegación"
        aria-expanded={menuOpen}
        aria-controls="sidebar-panel"
        onClick={onOpenMenu}
      >
        <Icon name="menu" size={22} />
      </button>

      <BrandLogo alto={28} tono="verde" compacta className="topbar-brand" />

      <Breadcrumbs />

      <button type="button" className="topbar-search" onClick={onOpenPalette} aria-haspopup="dialog" aria-label="Buscar o ir a... (atajo Control K)">
        <Icon name="search" size={18} />
        <span className="topbar-search-text">Buscar o ir a…</span>
        <span className="topbar-search-kbd" aria-hidden="true">
          <kbd>{ES_MAC ? "⌘" : "Ctrl"}</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      <UserMenu />
    </header>
  );
}
