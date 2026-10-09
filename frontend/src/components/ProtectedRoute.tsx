import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  // Sin children actúa como ruta de layout y renderiza <Outlet />.
  children?: ReactNode;
  // Si se indica, solo esos roles pueden ver la ruta; el resto se redirige
  // al dashboard (no a /login, ya que sí tienen sesión válida).
  roles?: string[];
}

// Conveniencia de UX: la frontera de seguridad real es la API (cada endpoint
// valida el rol con authorize()). Esto solo evita mostrar pantallas que el
// backend rechazaría igualmente.
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="page-loading" role="status" aria-busy="true">
        <span className="sr-only">Cargando...</span>
        <Skeleton width="14rem" height="2rem" />
        <Skeleton height="10rem" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(usuario.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
