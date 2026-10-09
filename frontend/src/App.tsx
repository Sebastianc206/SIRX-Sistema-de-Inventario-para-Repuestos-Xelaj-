import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ToastProvider } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";

// Cada pantalla se carga bajo demanda (code splitting por ruta): el bundle
// inicial solo trae el shell, el login y lo que la ruta actual necesita.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const UsuariosPage = lazy(() => import("@/pages/UsuariosPage"));
const CategoriasPage = lazy(() => import("@/pages/CategoriasPage"));
const RepuestosPage = lazy(() => import("@/pages/RepuestosPage"));
const ProveedoresPage = lazy(() => import("@/pages/ProveedoresPage"));
const ComprasPage = lazy(() => import("@/pages/ComprasPage"));
const VentasPage = lazy(() => import("@/pages/VentasPage"));
const AjustesPage = lazy(() => import("@/pages/AjustesPage"));
const MovimientosPage = lazy(() => import("@/pages/MovimientosPage"));
const ConfiguracionPage = lazy(() => import("@/pages/ConfiguracionPage"));
const ReportesPage = lazy(() => import("@/pages/ReportesPage"));
const ConteosPage = lazy(() => import("@/pages/ConteosPage"));
const ConteoDetallePage = lazy(() => import("@/pages/ConteoDetallePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const SOLO_ADMIN = ["Administrador"];

function PantallaCargando() {
  return (
    <div className="page-loading" role="status" aria-busy="true">
      <span className="sr-only">Cargando...</span>
      <Skeleton width="14rem" height="2rem" />
      <Skeleton height="10rem" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary nivel="global">
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PantallaCargando />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                {/* Shell único: toda ruta autenticada vive dentro de AppLayout
                    y se renderiza vía <Outlet />. */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />

                    {/* HU-04, criterio 5: el listado es consultable por cualquier
                        usuario autenticado — el propio componente/la API deciden
                        qué columnas/acciones mostrar según el rol. */}
                    <Route path="repuestos" element={<RepuestosPage />} />

                    {/* HU-13/14: venta de mostrador es tarea de Operador. */}
                    <Route path="ventas" element={<VentasPage />} />

                    {/* Reportes: cualquier rol autenticado; el catálogo y cada
                        reporte los recorta la API según el rol (Operador solo
                        ve los que no exponen costos, ingresos ni proveedores). */}
                    <Route path="reportes" element={<ReportesPage />} />

                    {/* HU-09: ajustes/mermas, tarea operativa sin datos de costo. */}
                    <Route path="ajustes" element={<AjustesPage />} />

                    {/* Solo Administrador (ProtectedRoute manda al resto al inicio):
                        usuarios, categorías, proveedores (HU-26), compras (HU-08,
                        involucra precioCompra), movimientos (HU-10, auditoría) y
                        configuración (umbral de stock bajo). */}
                    <Route element={<ProtectedRoute roles={SOLO_ADMIN} />}>
                      <Route path="usuarios" element={<UsuariosPage />} />
                      <Route path="categorias" element={<CategoriasPage />} />
                      <Route path="proveedores" element={<ProveedoresPage />} />
                      <Route path="compras" element={<ComprasPage />} />
                      <Route path="movimientos" element={<MovimientosPage />} />
                      <Route path="conteos" element={<ConteosPage />} />
                      <Route path="conteos/:id" element={<ConteoDetallePage />} />
                      <Route path="configuracion" element={<ConfiguracionPage />} />
                    </Route>

                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
