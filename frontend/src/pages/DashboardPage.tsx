import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            SX
          </span>
          <div className="login-brand-text">
            <h1>SIRX</h1>
          </div>
        </div>

        {usuario?.role === "Administrador" && (
          <nav className="dashboard-nav">
            <Link to="/usuarios">Usuarios</Link>
          </nav>
        )}

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

      <main className="dashboard-content">
        <h2>Bienvenido, {usuario?.nombreCompleto}</h2>
        <p>Usuario: {usuario?.username}</p>
      </main>
    </div>
  );
}
