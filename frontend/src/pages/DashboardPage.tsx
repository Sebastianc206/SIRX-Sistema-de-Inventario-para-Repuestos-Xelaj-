import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { obtenerResumenDashboard } from "@/services/dashboardService";
import type { ResumenDashboard } from "@/types/movimiento";

// HU-15: tablero principal con KPIs operativos (y financieros solo para
// Administrador, ver dashboardService.js § ocultarDatosSensibles) y HU-12,
// el panel de alertas de stock bajo.
export default function DashboardPage() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerResumenDashboard()
      .then(setResumen)
      .catch(() => setResumen(null))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="dashboard-content">
        <h2>Bienvenido, {usuario?.nombreCompleto}</h2>
        <p>Usuario: {usuario?.username}</p>

        {cargando ? (
          <p className="admin-estado-vacio">Cargando tablero...</p>
        ) : !resumen ? (
          <p className="admin-estado-vacio">No se pudo cargar el resumen del tablero.</p>
        ) : (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <p className="kpi-card-label">SKUs activos</p>
                <p className="kpi-card-valor">{resumen.skusActivos}</p>
              </div>
              <div className="kpi-card kpi-card--alerta">
                <p className="kpi-card-label">Alertas de stock bajo</p>
                <p className="kpi-card-valor">{resumen.alertasStockBajo.length}</p>
              </div>
              {resumen.ventasHoy && (
                <div className="kpi-card">
                  <p className="kpi-card-label">Ventas de hoy</p>
                  <p className="kpi-card-valor">Q{Number(resumen.ventasHoy.total).toFixed(2)}</p>
                </div>
              )}
            </div>

            <div className="admin-toolbar">
              <h2>Repuestos con stock bajo o agotado</h2>
            </div>

            {resumen.alertasStockBajo.length === 0 ? (
              <p className="admin-estado-vacio">Ningún repuesto activo está por debajo de su stock mínimo.</p>
            ) : (
              <div className="admin-tabla-wrap">
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Stock actual</th>
                      <th>Stock mínimo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.alertasStockBajo.map((alerta) => (
                      <tr key={alerta.sku}>
                        <td>{alerta.sku}</td>
                        <td>{alerta.nombre}</td>
                        <td>{alerta.cantidadInventario}</td>
                        <td>{alerta.inventarioMinimo}</td>
                        <td>
                          <span
                            className={`stock-badge ${alerta.cantidadInventario <= 0 ? "stock-badge--agotado" : "stock-badge--bajo"}`}
                          >
                            {alerta.cantidadInventario <= 0 ? "Agotado" : "Stock bajo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
