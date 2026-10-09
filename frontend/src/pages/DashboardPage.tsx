import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart } from "@/components/charts/BarChart";
import { StockPorCategoria } from "@/components/charts/StockPorCategoria";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { obtenerActividadVentas, obtenerResumenInventario } from "@/services/dashboardDatosService";
import { obtenerResumenDashboard } from "@/services/dashboardService";
import type { AlertaStockBajo, CategoriaMovimiento } from "@/types/movimiento";
import { haceCuanto, quetzales, saludo, variacion } from "@/utils/formato";

const PERIODOS = [7, 14, 30] as const;
type Periodo = (typeof PERIODOS)[number];

const ICONO_ACTIVIDAD: Record<CategoriaMovimiento, IconName> = { venta: "cart", compra: "receipt", merma: "alert", ajuste: "sliders" };
const TEXTO_ACTIVIDAD: Record<CategoriaMovimiento, string> = { venta: "Venta", compra: "Compra", merma: "Merma", ajuste: "Ajuste" };

function formatoCorto(n: number): string {
  if (n >= 1000) return `Q${(n / 1000).toLocaleString("es-GT", { maximumFractionDigits: 1 })}k`;
  return `Q${Math.round(n)}`;
}

function etiquetaDia(fechaIso: string): string {
  const [, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}`;
}

function sumar(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}

// HU-15 / HU-12: tablero principal. El Operador NO recibe datos financieros:
// el resumen de la API ya omite ventasHoy para ese rol y el historial de
// movimientos (de donde salen ventas por período y actividad) es exclusivo de
// Administrador — para el resto ni se consulta. Los montos de las alertas de
// stock son solo cantidades; nunca costo, margen ni proveedor.
export default function DashboardPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.role === "Administrador";
  const [periodo, setPeriodo] = useState<Periodo>(14);
  const [filtroAlertas, setFiltroAlertas] = useState<"todas" | "agotado" | "bajo">("todas");
  const [verTodas, setVerTodas] = useState(false);

  const resumen = useAsync(obtenerResumenDashboard, [], "No se pudo cargar el resumen del tablero");
  const inventario = useAsync(obtenerResumenInventario, [], "No se pudo calcular el inventario por categoría");
  // Siempre 30 días: el selector solo recorta lo mostrado.
  const ventas = useAsync(
    () => (esAdministrador ? obtenerActividadVentas(30) : Promise.resolve(null)),
    [esAdministrador],
    "No se pudo cargar la actividad de ventas",
  );

  const serie = useMemo(() => ventas.data?.dias ?? [], [ventas.data]);

  // Si los últimos 14 días no tienen ventas pero el último mes sí, se abre
  // directamente en 30 días (una sola vez, sin pisar la elección del usuario).
  const periodoAjustado = useRef(false);
  useEffect(() => {
    if (!ventas.data || periodoAjustado.current) return;
    periodoAjustado.current = true;
    const dias = ventas.data.dias;
    if (sumar(dias.slice(-14).map((d) => d.total)) === 0 && sumar(dias.map((d) => d.total)) > 0) setPeriodo(30);
  }, [ventas.data]);
  const serieMostrada = serie.slice(-periodo);
  const hoy = serie[serie.length - 1];
  const ayer = serie[serie.length - 2];
  const ultimos7 = sumar(serie.slice(-7).map((d) => d.total));
  const previos7 = sumar(serie.slice(-14, -7).map((d) => d.total));
  const totalPeriodo = sumar(serieMostrada.map((d) => d.total));
  const unidadesPeriodo = sumar(serieMostrada.map((d) => d.unidades));

  const alertas: AlertaStockBajo[] = resumen.data?.alertasStockBajo ?? [];
  const agotadas = alertas.filter((a) => a.cantidadInventario <= 0);
  const alertasFiltradas = alertas
    .filter((a) => (filtroAlertas === "todas" ? true : filtroAlertas === "agotado" ? a.cantidadInventario <= 0 : a.cantidadInventario > 0))
    .sort((a, b) => a.cantidadInventario - b.cantidadInventario);
  const alertasVisibles = verTodas ? alertasFiltradas : alertasFiltradas.slice(0, 6);

  const nombre = usuario?.nombreCompleto?.split(" ")[0] ?? "";
  const fechaHoy = new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });

  function recargarTodo() {
    resumen.recargar();
    inventario.recargar();
    ventas.recargar();
  }

  const totalSkus = resumen.data ? `${resumen.data.skusActivos} repuestos activos` : "";
  const descripcion = [`${fechaHoy.charAt(0).toUpperCase()}${fechaHoy.slice(1)}`, totalSkus].filter(Boolean).join(" · ");

  return (
    <div className="page-stack dashboard">
      <PageHeader
        title={`${saludo()}${nombre ? `, ${nombre}` : ""}`}
        description={descripcion}
        actions={
          <>
            <IconButton icon="refresh" label="Actualizar datos" variant="ghost" onClick={recargarTodo} />
            <Link to="/ventas" className="btn btn--primary btn--md">
              Nueva venta
            </Link>
          </>
        }
      />

      <section aria-labelledby="kpis-titulo">
        <h2 id="kpis-titulo" className="sr-only">
          Indicadores
        </h2>
        <div className="kpi-grid">
          {esAdministrador ? (
            <>
              <KpiCard
                label="Ventas de hoy"
                valor={resumen.data?.ventasHoy ? quetzales(resumen.data.ventasHoy.total) : hoy ? quetzales(hoy.total) : "—"}
                cargando={resumen.cargando && ventas.cargando}
                tendencia={hoy && ayer ? { porcentaje: variacion(hoy.total, ayer.total), contra: "vs ayer" } : undefined}
                nota={resumen.data?.ventasHoy ? `${resumen.data.ventasHoy.cantidad} venta${resumen.data.ventasHoy.cantidad === 1 ? "" : "s"}` : undefined}
              />
              <KpiCard
                label="Ventas últimos 7 días"
                valor={ventas.data ? quetzales(ultimos7) : "—"}
                cargando={ventas.cargando}
                tendencia={ventas.data ? { porcentaje: variacion(ultimos7, previos7), contra: "vs 7 días previos" } : undefined}
              />
            </>
          ) : (
            <KpiCard
              label="Unidades en existencia"
              valor={inventario.data ? inventario.data.unidadesTotales.toLocaleString("es-GT") : "—"}
              cargando={inventario.cargando}
              nota={inventario.data?.truncado ? "Cifra parcial (catálogo muy grande)" : "Repuestos activos"}
            />
          )}
          <KpiCard
            label="Alertas de stock"
            tono={agotadas.length > 0 ? "peligro" : alertas.length > 0 ? "alerta" : "normal"}
            valor={resumen.data ? String(alertas.length) : "—"}
            cargando={resumen.cargando}
            nota={resumen.data ? (agotadas.length > 0 ? `${agotadas.length} agotado${agotadas.length === 1 ? "" : "s"} · ${alertas.length - agotadas.length} con stock bajo` : alertas.length > 0 ? "Por debajo del mínimo" : "Todo en orden") : undefined}
          />
        </div>
        {resumen.error && (
          <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={resumen.recargar}>Reintentar</Button>}>
            {resumen.error}
          </Alert>
        )}
      </section>

      <div className="dashboard-grid">
        <Card
          className="dashboard-alertas"
          title="Alertas de stock"
          description="Agotados o en el mínimo"
          actions={
            <div className="segmented" role="group" aria-label="Filtrar alertas">
              {(
                [
                  ["todas", "Todas"],
                  ["agotado", "Agotados"],
                  ["bajo", "Stock bajo"],
                ] as const
              ).map(([clave, texto]) => (
                <button key={clave} type="button" className="segmented-btn" aria-pressed={filtroAlertas === clave} onClick={() => setFiltroAlertas(clave)}>
                  {texto}
                </button>
              ))}
            </div>
          }
        >
          {resumen.cargando ? (
            <div className="stack">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height="3rem" />
              ))}
            </div>
          ) : resumen.error ? null : alertasFiltradas.length === 0 ? (
            <EmptyState
              compact
              icon="checkCircle"
              title={alertas.length === 0 ? "Todo el inventario está en orden" : "Sin alertas en este filtro"}
              description={alertas.length === 0 ? "Ningún repuesto activo llegó a su umbral de stock bajo." : undefined}
            />
          ) : (
            <>
              <ul className="alert-list">
                {alertasVisibles.map((a) => {
                  const agotado = a.cantidadInventario <= 0;
                  return (
                    <li key={a.sku} className="alert-item">
                      <div className="alert-item-main">
                        <Link className="alert-item-name" to={`/repuestos?buscar=${encodeURIComponent(a.sku)}`}>
                          {a.nombre}
                        </Link>
                        <p className="cell-sku">{a.sku}</p>
                      </div>
                      <span className="tabular alert-item-stock">
                        <strong>{a.cantidadInventario}</strong> de {a.inventarioMinimo}
                      </span>
                      <Badge tone={agotado ? "danger" : "warning"}>{agotado ? "Agotado" : "Stock bajo"}</Badge>
                      {esAdministrador && (
                        <Link className="btn btn--secondary btn--sm" to="/compras" aria-label={`Registrar compra para reponer ${a.nombre}`}>
                          Reponer
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              {alertasFiltradas.length > 6 && (
                <div className="alert-more">
                  <Button variant="ghost" size="sm" onClick={() => setVerTodas((v) => !v)}>
                    {verTodas ? "Ver menos" : `Ver las ${alertasFiltradas.length} alertas`}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {esAdministrador && (
          <Card
            className="dashboard-ventas"
            title="Ventas por día"
            description={ventas.data ? `${quetzales(totalPeriodo)} en ${periodo} días · ${unidadesPeriodo} unidades` : undefined}
            actions={
              <div className="segmented" role="group" aria-label="Período de la gráfica de ventas">
                {PERIODOS.map((p) => (
                  <button key={p} type="button" className="segmented-btn" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
                    {p} días
                  </button>
                ))}
              </div>
            }
          >
            {ventas.cargando ? (
              <Skeleton height="15rem" />
            ) : ventas.error ? (
              <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={ventas.recargar}>Reintentar</Button>}>
                {ventas.error}
              </Alert>
            ) : totalPeriodo === 0 ? (
              <EmptyState compact icon="barChart" title="Sin ventas en este período" description="Cuando registres ventas aparecerán aquí día por día." action={<Link to="/ventas" className="btn btn--primary btn--md">Registrar una venta</Link>} />
            ) : (
              <>
                <BarChart
                  datos={serieMostrada.map((d) => ({
                    clave: d.fecha,
                    etiqueta: etiquetaDia(d.fecha),
                    valor: d.total,
                    detalle: `${etiquetaDia(d.fecha)}: ${quetzales(d.total)} en ${d.transacciones} línea${d.transacciones === 1 ? "" : "s"} de venta (${d.unidades} unidades)`,
                  }))}
                  ariaLabel={`Ventas por día de los últimos ${periodo} días`}
                  formatoEje={formatoCorto}
                  columnaValor="Ventas"
                />
                {ventas.data?.truncado && <p className="chart-note">Se analizaron las primeras páginas del historial; el período puede estar incompleto.</p>}
              </>
            )}
          </Card>
        )}

      </div>

      <details className="disclosure">
        <summary>{esAdministrador ? "Stock por categoría y actividad reciente" : "Stock por categoría"}</summary>
        <div className="dashboard-more-grid">
        <Card title="Stock por categoría">
          {inventario.cargando ? (
            <div className="stack">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height="2.4rem" />
              ))}
            </div>
          ) : inventario.error ? (
            <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={inventario.recargar}>Reintentar</Button>}>
              {inventario.error}
            </Alert>
          ) : !inventario.data || inventario.data.categorias.length === 0 ? (
            <EmptyState compact icon="package" title="Aún no hay repuestos activos" description="Agrega repuestos al catálogo para ver su distribución." />
          ) : (
            <StockPorCategoria categorias={inventario.data.categorias} />
          )}
        </Card>

        {esAdministrador && (
          <Card title="Actividad reciente">
            {ventas.cargando ? (
              <div className="stack">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height="2.4rem" />
                ))}
              </div>
            ) : ventas.error ? null : !ventas.data || ventas.data.recientes.length === 0 ? (
              <EmptyState compact icon="clock" title="Sin movimientos recientes" description="Las compras, ventas y ajustes aparecerán aquí." />
            ) : (
              <ul className="activity-list">
                {ventas.data.recientes.map((m) => (
                  <li key={`${m.categoria}-${m.id}-${m.sku}-${m.fecha}`} className="activity-item">
                    <span className={`activity-icon activity-icon--${m.categoria}`}>
                      <Icon name={ICONO_ACTIVIDAD[m.categoria]} size={16} />
                    </span>
                    <div className="activity-text">
                      <p>
                        <strong>{TEXTO_ACTIVIDAD[m.categoria]}</strong> · {m.nombreProducto ?? m.sku}
                      </p>
                      <p className="muted">
                        {m.tipo === "entrada" ? "+" : "−"}
                        {m.cantidad} u. · {haceCuanto(m.fecha)}
                        {m.anulada ? " · Anulada" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="alert-more">
              <Link to="/movimientos" className="btn btn--ghost btn--sm">
                Ver historial completo
              </Link>
            </div>
          </Card>
        )}
        </div>
      </details>
    </div>
  );
}
