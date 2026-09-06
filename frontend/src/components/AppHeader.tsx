import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Encabezado compartido por el dashboard y las pantallas de administración
// (Usuarios, Categorías): mismo branding, mismo bloque de sesión, y el
// menú de navegación entre secciones de Administrador vive en un solo lugar.
export function AppHeader() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <header className="dashboard-header">
      <div className="login-brand">
        <span className="login-brand-mark" aria-hidden="true">
          SX
        </span>
        <div className="login-brand-text">
          <h1>SIRX</h1>
        </div>
      </div>

      <nav className="dashboard-nav">
        {/* Repuestos: cualquier rol autenticado (HU-04, criterio 5). */}
        <Link to="/repuestos">Repuestos</Link>
        {usuario?.role === "Administrador" && (
          <>
            <Link to="/usuarios">Usuarios</Link>
            <Link to="/categorias">Categorías</Link>
          </>
        )}
      </nav>

      <div className="dashboard-user">
        <div className="dashboard-user-info">
          <p className="dashboard-user-name">{usuario?.nombreCompleto}</p>
          <p>
            <span className="dashboard-role-badge">{usuario?.role}</span>
          </p>
        </div>
        <button onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
    </header>
  );
}
