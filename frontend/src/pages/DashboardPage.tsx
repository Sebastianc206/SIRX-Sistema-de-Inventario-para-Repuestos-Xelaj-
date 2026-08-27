import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";

export default function DashboardPage() {
  const { usuario } = useAuth();

  return (
    <div className="dashboard-page">
      <AppHeader />

      <main className="dashboard-content">
        <h2>Bienvenido, {usuario?.nombreCompleto}</h2>
        <p>Usuario: {usuario?.username}</p>
      </main>
    </div>
  );
}
