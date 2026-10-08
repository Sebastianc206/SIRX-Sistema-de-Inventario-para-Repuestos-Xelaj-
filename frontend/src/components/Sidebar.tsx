import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Navegación lateral compartida por el dashboard y las pantallas de
// administración (Usuarios, Categorías, Proveedores, Repuestos): mismo
// branding, mismo bloque de sesión, y el menú de navegación entre secciones
// vive en un solo lugar. Reemplaza al antiguo AppHeader horizontal.
export function Sidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const esAdministrador = usuario?.role === "Administrador";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          SX
        </span>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">SIRX</span>
          <span className="sidebar-brand-tag">Repuestos Xelajú</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Secciones">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
        >
          <IconInicio />
          Inicio
        </NavLink>

        {/* Repuestos: cualquier rol autenticado (HU-04, criterio 5). */}
        <NavLink
          to="/repuestos"
          className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
        >
          <IconRepuestos />
          Repuestos
        </NavLink>

        {/* Ventas/Ajustes: HU-09/13/14, abiertos a cualquier rol — venta de
            mostrador es tarea de Operador y ajustes no llevan datos de costo. */}
        <NavLink
          to="/ventas"
          className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
        >
          <IconVentas />
          Ventas
        </NavLink>
        <NavLink
          to="/ajustes"
          className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
        >
          <IconAjustes />
          Ajustes
        </NavLink>

        {esAdministrador && (
          <>
            <p className="sidebar-nav-grupo">Administración</p>
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
            >
              <IconUsuarios />
              Usuarios
            </NavLink>
            <NavLink
              to="/categorias"
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
            >
              <IconCategorias />
              Categorías
            </NavLink>
            <NavLink
              to="/proveedores"
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
            >
              <IconProveedores />
              Proveedores
            </NavLink>
            {/* HU-08: compras involucran precioCompra (dato de costo) —
                exclusivo de Administrador. */}
            <NavLink
              to="/compras"
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
            >
              <IconCompras />
              Compras
            </NavLink>
            {/* HU-10: historial de movimientos + comparación de ventas —
                exclusivo de Administrador (visión de auditoría/reportes). */}
            <NavLink
              to="/movimientos"
              className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--activo" : ""}`}
            >
              <IconMovimientos />
              Movimientos
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <p className="sidebar-user-name">{usuario?.nombreCompleto}</p>
          <span className="dashboard-role-badge">{usuario?.role}</span>
        </div>
        <button type="button" className="sidebar-logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function IconInicio() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRepuestos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4h10l2 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8l2-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5 8h14M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15 8.5a2.5 2.5 0 1 0 0-5M17.5 14c2 .4 3.5 2 3.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCategorias() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconProveedores() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5 12 4l9 6.5M5 10v9h14v-9M10 19v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCompras() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconVentas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="20" r="1.3" fill="currentColor" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" />
      <path
        d="M3 4h2l2.2 11h9.6L19 8H6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAjustes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h4l2-6 4 12 2-6h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMovimientos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7h11l-3-3M17 17H6l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
