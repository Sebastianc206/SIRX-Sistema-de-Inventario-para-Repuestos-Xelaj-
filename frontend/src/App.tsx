import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import UsuariosPage from "@/pages/UsuariosPage";
import CategoriasPage from "@/pages/CategoriasPage";
import RepuestosPage from "@/pages/RepuestosPage";
import ProveedoresPage from "@/pages/ProveedoresPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute roles={["Administrador"]}>
                <UsuariosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categorias"
            element={
              <ProtectedRoute roles={["Administrador"]}>
                <CategoriasPage />
              </ProtectedRoute>
            }
          />
          {/* HU-04, criterio 5: el listado es consultable por cualquier
              usuario autenticado, sin restricción de rol a nivel de ruta —
              el propio componente/la API deciden qué columnas/acciones
              mostrar según el rol. */}
          <Route
            path="/repuestos"
            element={
              <ProtectedRoute>
                <RepuestosPage />
              </ProtectedRoute>
            }
          />
          {/* HU-26, criterio 2: solo Administrador — Operador ni siquiera
              puede llegar a esta ruta (ProtectedRoute lo manda al dashboard). */}
          <Route
            path="/proveedores"
            element={
              <ProtectedRoute roles={["Administrador"]}>
                <ProveedoresPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
