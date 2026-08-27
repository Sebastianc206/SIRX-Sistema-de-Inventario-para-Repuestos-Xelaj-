import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  // Si se indica, solo esos roles pueden ver la ruta; el resto se redirige
  // al dashboard (no a /login, ya que sí tienen sesión válida).
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <p>Cargando...</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(usuario.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
