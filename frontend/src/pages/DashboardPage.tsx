import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="dashboard-page">
      <h1>Bienvenido, {usuario?.username}</h1>
      <p>Rol: {usuario?.role}</p>
      <button onClick={cerrarSesion}>Cerrar sesión</button>
    </div>
  );
}
