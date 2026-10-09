import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePersistentState } from "@/hooks/usePersistentState";
import { encontrarItem } from "@/navigation";

function PaginaCargando() {
  return (
    <div className="page-loading" aria-busy="true">
      <span className="sr-only">Cargando página...</span>
      <Skeleton width="14rem" height="2rem" />
      <div className="page-loading-grid">
        <Skeleton height="6rem" />
        <Skeleton height="6rem" />
        <Skeleton height="6rem" />
      </div>
      <Skeleton height="16rem" />
    </div>
  );
}

// Shell único de la aplicación autenticada: sidebar colapsable (el estado se
// recuerda), topbar con breadcrumbs + paleta de comandos + menú de usuario, y
// el contenido de cada ruta anidada vía <Outlet />.
export function AppLayout() {
  const { pathname } = useLocation();
  const [colapsado, setColapsado] = usePersistentState<boolean>("sirx_sidebar_colapsado", false);
  const [menuMovil, setMenuMovil] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const primeraRuta = useRef(true);

  // Cierre explícito (Escape, X, fondo): el foco vuelve al botón de menú.
  const cerrarMenu = useCallback(() => {
    setMenuMovil(false);
    document.getElementById("menu-toggle")?.focus();
  }, []);

  // Atajo global Ctrl/Cmd+K para la paleta; "/" también cuando no se escribe.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((v) => !v);
        return;
      }
      const el = e.target as HTMLElement | null;
      const escribiendo = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !escribiendo && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setPaleta(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Al navegar: cierra el panel móvil, actualiza el título del documento y
  // mueve el foco al contenido (navegación SPA accesible).
  useEffect(() => {
    setMenuMovil(false);
    const item = encontrarItem(pathname);
    document.title = item ? `${item.label} · SIRX` : "Página no encontrada · SIRX";
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    // Si la pantalla nueva ya enfocó un campo (autoFocus), no se lo quitamos.
    if (!mainRef.current?.contains(document.activeElement)) {
      mainRef.current?.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Escape cierra el panel móvil.
  useEffect(() => {
    if (!menuMovil) return undefined;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuMovil, cerrarMenu]);

  const cerrarPaleta = useCallback(() => setPaleta(false), []);

  return (
    <div className={`app${colapsado ? " app--collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <Sidebar
        collapsed={colapsado}
        onToggleCollapsed={() => setColapsado(!colapsado)}
        mobileOpen={menuMovil}
        onCloseMobile={cerrarMenu}
        onNavigate={() => setMenuMovil(false)}
      />
      <div className="app-main">
        <Topbar onOpenMenu={() => setMenuMovil(true)} menuOpen={menuMovil} onOpenPalette={() => setPaleta(true)} />
        <main id="main-content" ref={mainRef} tabIndex={-1} className="app-content">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PaginaCargando />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {paleta && <CommandPalette onClose={cerrarPaleta} />}
    </div>
  );
}
