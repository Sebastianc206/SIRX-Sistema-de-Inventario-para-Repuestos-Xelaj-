import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { PaginationControls } from "@/components/PaginationControls";
import { ProductoMultiSelect } from "@/components/ProductoMultiSelect";
import { VentasComparacionChart } from "@/components/VentasComparacionChart";
import { listarMovimientos, obtenerComparacionVentas, MovimientoApiError } from "@/services/movimientoService";
import { listarRepuestos } from "@/services/repuestoService";
import { listarCategorias } from "@/services/categoriaService";
import { listarMarcas } from "@/services/catalogosAuxiliaresService";
import { anularVenta, VentaApiError } from "@/services/ventaService";
import { anularAjuste, AjusteApiError } from "@/services/ajusteService";
import { anularCompra, CompraApiError } from "@/services/compraService";
import { hoyISO, primerDiaDelMesISO } from "@/utils/fechas";
import type { CategoriaMovimiento, MovimientoHistorial, Paginacion, SerieVentas } from "@/types/movimiento";
import type { Repuesto } from "@/types/repuesto";
import type { Categoria } from "@/types/categoria";
import type { Marca } from "@/types/catalogosAuxiliares";

const ETIQUETA_CATEGORIA: Record<CategoriaMovimiento, string> = {
  compra: "Entrada (compra)",
  venta: "Salida (venta)",
  merma: "Salida (merma)",
  ajuste: "Salida (ajuste)",
};

const BADGE_CATEGORIA: Record<CategoriaMovimiento, string> = {
  compra: "stock-badge--en-stock",
  venta: "stock-badge--transito",
  merma: "stock-badge--bajo",
  ajuste: "stock-badge--bajo",
};

// Paleta categórica validada (skill dataviz, references/palette.md — los
// primeros 8 son la paleta de referencia del proyecto; teal y violeta se
// sumaron para llegar a 10 slots, validados con el mismo script contra las
// mismas cotas: separación CVD >= 8 y normal-vision >= 15 entre pares
// adyacentes). Máximo 10 porque ese es también el tope de productos que se
// pueden seleccionar a la vez (ver MAX_PRODUCTOS).
//
// El color se asigna por ORDEN DE SELECCIÓN (posición en `productosSeleccionados`),
// no por la posición del producto en el catálogo: el 1er producto marcado es
// siempre azul, el 2do siempre naranja, etc. — cambio de diseño intencional,
// antes era por catálogo.
const PALETA_CATEGORICA = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
  "#00a3a3", // teal
  "#8a2be2", // violeta azulado
];

const MAX_PRODUCTOS = 10;
const PORPAGINA_MOVIMIENTOS = 15;
const PAGINACION_INICIAL: Paginacion = { pagina: 1, porPagina: PORPAGINA_MOVIMIENTOS, total: 0, totalPaginas: 1 };
const MENSAJE_RANGO_INVALIDO = "La fecha de inicio debe ser anterior a la fecha fin.";

// HU-10: historial de movimientos — TODO lo que le pasó al stock (compras,
// ventas, mermas, ajustes) de los productos que coincidan con el filtro, no
// de uno solo. Panel de filtros compartido (categoría, marca, producto(s),
// rango de fechas) por la tabla Y la gráfica de comparación de ventas: sin
// filtros, la tabla trae TODO el mes en curso; la gráfica necesita 2+
// productos elegidos explícitamente en el mismo filtro de Producto (sigue
// siendo solo ventas, no ajustes ni compras — regla ya establecida).
export default function MovimientosPage() {
  const [catalogo, setCatalogo] = useState<Repuesto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  const [filtroCategoria, setFiltroCategoria] = useState<number | undefined>(undefined);
  const [filtroMarca, setFiltroMarca] = useState<number | undefined>(undefined);
  const [productosSeleccionados, setProductosSeleccionados] = useState<string[]>([]);
  // Default = mes en curso (día 1 hasta hoy); el usuario puede ampliar el
  // rango libremente.
  const [fechaDesde, setFechaDesde] = useState(primerDiaDelMesISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());

  const [movimientos, setMovimientos] = useState<MovimientoHistorial[]>([]);
  const [paginacionMovimientos, setPaginacionMovimientos] = useState<Paginacion>(PAGINACION_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [series, setSeries] = useState<SerieVentas[] | null>(null);
  const [cargandoComparacion, setCargandoComparacion] = useState(false);
  const [errorComparacion, setErrorComparacion] = useState<string | null>(null);
  // Conjunto de skus "enfocados" en la gráfica — 0, 1 o varios a la vez (ver
  // VentasComparacionChart), independiente de `productosSeleccionados`.
  const [resaltados, setResaltados] = useState<ReadonlySet<string>>(new Set());

  const [idAAnular, setIdAAnular] = useState<string | null>(null);
  const [idEnProceso, setIdEnProceso] = useState<string | null>(null);

  useEffect(() => {
    listarRepuestos({ estado: "activo", porPagina: 100 })
      .then((resultado) => setCatalogo(resultado.articulos))
      .catch(() => setCatalogo([]));
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
    listarMarcas()
      .then(setMarcas)
      .catch(() => setMarcas([]));
  }, []);

  // Solo filtra qué se MUESTRA en el dropdown — `productosSeleccionados` no
  // se toca acá, así que un producto ya marcado no se pierde al cambiar
  // categoría/marca.
  const catalogoFiltrado = useMemo(
    () =>
      catalogo.filter((repuesto) => {
        if (filtroCategoria !== undefined && repuesto.categoria?.idCategoria !== filtroCategoria) return false;
        if (filtroMarca !== undefined && repuesto.marca?.idMarca !== filtroMarca) return false;
        return true;
      }),
    [catalogo, filtroCategoria, filtroMarca],
  );

  // Color por posición en `productosSeleccionados` (orden de selección), no
  // por posición en el catálogo.
  const colorPorSku = useMemo(() => {
    const indicePorSku = new Map(productosSeleccionados.map((sku, indice) => [sku, indice]));
    return (sku: string) => PALETA_CATEGORICA[(indicePorSku.get(sku) ?? 0) % PALETA_CATEGORICA.length];
  }, [productosSeleccionados]);

  function toggleProducto(sku: string) {
    setProductosSeleccionados((actual) =>
      actual.includes(sku)
        ? actual.filter((s) => s !== sku)
        : actual.length < MAX_PRODUCTOS
          ? [...actual, sku]
          : actual,
    );
    setPagina(1);
  }

  function toggleResaltado(skuProducto: string) {
    setResaltados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(skuProducto)) {
        nuevo.delete(skuProducto);
      } else {
        nuevo.add(skuProducto);
      }
      return nuevo;
    });
  }

  // ISO (aaaa-mm-dd) compara lexicográficamente igual que cronológicamente.
  const rangoValido = !fechaDesde || !fechaHasta || fechaDesde <= fechaHasta;

  const cargarMovimientos = useCallback(async () => {
    if (!rangoValido) {
      setError(MENSAJE_RANGO_INVALIDO);
      setMovimientos([]);
      setPaginacionMovimientos(PAGINACION_INICIAL);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarMovimientos({
        skus: productosSeleccionados.length > 0 ? productosSeleccionados : undefined,
        idCategoria: filtroCategoria,
        idMarca: filtroMarca,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        pagina,
        porPagina: PORPAGINA_MOVIMIENTOS,
      });
      setMovimientos(resultado.movimientos);
      setPaginacionMovimientos(resultado.paginacion);
    } catch (err) {
      setError(err instanceof MovimientoApiError ? err.message : "No se pudo cargar el historial de movimientos");
    } finally {
      setCargando(false);
    }
  }, [rangoValido, productosSeleccionados, filtroCategoria, filtroMarca, fechaDesde, fechaHasta, pagina]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  // La gráfica se actualiza sola con el mismo filtro de Producto/fechas — no
  // hace falta un botón "Comparar" aparte.
  const cargarComparacion = useCallback(async () => {
    if (!rangoValido) {
      setErrorComparacion(MENSAJE_RANGO_INVALIDO);
      setSeries(null);
      return;
    }
    if (productosSeleccionados.length < 2) {
      setSeries(null);
      setErrorComparacion(null);
      return;
    }
    setCargandoComparacion(true);
    setErrorComparacion(null);
    try {
      const resultado = await obtenerComparacionVentas(productosSeleccionados, {
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });
      setSeries(resultado.series);
      setResaltados(new Set());
    } catch (err) {
      setErrorComparacion(err instanceof MovimientoApiError ? err.message : "No se pudo cargar la comparación");
    } finally {
      setCargandoComparacion(false);
    }
  }, [rangoValido, productosSeleccionados, fechaDesde, fechaHasta]);

  useEffect(() => {
    cargarComparacion();
  }, [cargarComparacion]);

  // HU-5 (anular desde Movimientos): cada fila de compra/venta/ajuste no
  // anulada llama al endpoint que le corresponde según su categoría —
  // ventas y ajustes comparten SalidaMaestro pero exponen endpoints propios
  // (/api/ventas/:id/anular y /api/ajustes-inventario/:id/anular).
  async function handleAnularMovimiento(mov: MovimientoHistorial) {
    const clave = `${mov.categoria}-${mov.id}`;
    setIdEnProceso(clave);
    setError(null);
    try {
      if (mov.tipo === "entrada") {
        await anularCompra(mov.id);
      } else if (mov.categoria === "venta") {
        await anularVenta(mov.id);
      } else {
        await anularAjuste(mov.id);
      }
      await cargarMovimientos();
    } catch (err) {
      setError(
        err instanceof MovimientoApiError || err instanceof VentaApiError || err instanceof AjusteApiError || err instanceof CompraApiError
          ? err.message
          : "No se pudo anular el movimiento",
      );
    } finally {
      setIdEnProceso(null);
      setIdAAnular(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="admin-page">
        <Link to="/" className="admin-volver">
          ← Volver al panel
        </Link>

        <div className="admin-toolbar">
          <h2>Movimientos de inventario</h2>
        </div>

        <div className="form-card">
          <h3>Filtros</h3>
          <div className="admin-filtros">
            <label>
              Categoría
              <select
                value={filtroCategoria ?? ""}
                onChange={(event) => {
                  setFiltroCategoria(event.target.value ? Number(event.target.value) : undefined);
                  setPagina(1);
                }}
              >
                <option value="">Todas</option>
                {categorias.map((categoria) => (
                  <option key={categoria.idCategoria} value={categoria.idCategoria}>
                    {categoria.descripcion}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Marca
              <select
                value={filtroMarca ?? ""}
                onChange={(event) => {
                  setFiltroMarca(event.target.value ? Number(event.target.value) : undefined);
                  setPagina(1);
                }}
              >
                <option value="">Todas</option>
                {marcas.map((marca) => (
                  <option key={marca.idMarca} value={marca.idMarca}>
                    {marca.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Producto
              <ProductoMultiSelect
                productos={catalogoFiltrado}
                seleccionados={productosSeleccionados}
                onToggle={toggleProducto}
                maximo={MAX_PRODUCTOS}
              />
            </label>
            <label>
              Desde
              <input type="date" value={fechaDesde} onChange={(event) => { setFechaDesde(event.target.value); setPagina(1); }} />
            </label>
            <label>
              Hasta
              <input type="date" value={fechaHasta} onChange={(event) => { setFechaHasta(event.target.value); setPagina(1); }} />
            </label>
          </div>
        </div>

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-toolbar">
          <h2>Historial de movimientos</h2>
        </div>

        {cargando ? (
          <p className="admin-estado-vacio">Cargando movimientos...</p>
        ) : movimientos.length === 0 ? (
          <p className="admin-estado-vacio">No hay movimientos para estos filtros.</p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Detalle</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => {
                  const clave = `${mov.categoria}-${mov.id}`;
                  const segmentos =
                    mov.tipo === "entrada"
                      ? [mov.referencia, mov.proveedor]
                      : mov.categoria === "venta"
                        ? // El motivo de una venta es siempre "Venta" — redundante con la
                          // referencia ("Venta #N"); el precio unitario aporta más.
                          [mov.referencia, mov.precioVenta !== undefined ? `Q${Number(mov.precioVenta).toFixed(2)}` : null]
                        : [mov.referencia, mov.motivo];
                  if (mov.anulada) segmentos.push("Anulada");

                  return (
                    <tr key={clave}>
                      <td>{new Date(mov.fecha).toLocaleDateString("es-GT")}</td>
                      <td>
                        {mov.nombreProducto} <span className="modal-helper-text">({mov.sku})</span>
                      </td>
                      <td>
                        <span className={`stock-badge ${BADGE_CATEGORIA[mov.categoria]}`}>
                          {ETIQUETA_CATEGORIA[mov.categoria]}
                        </span>
                      </td>
                      <td>{mov.cantidad}</td>
                      <td>{segmentos.filter(Boolean).join(" · ")}</td>
                      <td className="admin-acciones">
                        {mov.anulada ? null : idAAnular === clave ? (
                          <>
                            <span className="modal-helper-text">¿Anular?</span>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => handleAnularMovimiento(mov)}
                              disabled={idEnProceso === clave}
                            >
                              {idEnProceso === clave ? "..." : "Confirmar"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setIdAAnular(null)}
                              disabled={idEnProceso === clave}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn-danger" onClick={() => setIdAAnular(clave)}>
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationControls paginacion={paginacionMovimientos} onCambiarPagina={setPagina} etiqueta="movimiento" />

        <div className="admin-toolbar">
          <h2>Comparar ventas entre productos</h2>
        </div>
        <p className="modal-helper-text" style={{ marginBottom: "var(--space-md)" }}>
          Usa el filtro de Producto de arriba para elegir 2 o más y comparar sus ventas (no incluye ajustes ni
          compras) en el rango de fechas seleccionado.
        </p>

        {errorComparacion && (
          <p className="banner banner--error" role="alert">
            {errorComparacion}
          </p>
        )}

        <div className="comparacion-layout">
          <div className="form-card" style={{ margin: 0 }}>
            {productosSeleccionados.length < 2 ? (
              <p className="admin-estado-vacio">Selecciona 2 o más productos en el filtro de arriba.</p>
            ) : cargandoComparacion ? (
              <p className="admin-estado-vacio">Comparando...</p>
            ) : series ? (
              <VentasComparacionChart
                series={series}
                colorPorSku={colorPorSku}
                resaltados={resaltados}
                onToggleResaltado={toggleResaltado}
              />
            ) : null}
          </div>

          <div className="comparacion-panel">
            {series && (
              <>
                <p className="comparacion-panel-titulo">Total vendido</p>
                {series.map((serie) => (
                  <div
                    key={serie.sku}
                    className={`comparacion-panel-item${resaltados.has(serie.sku) ? " comparacion-panel-item--activa" : ""}`}
                  >
                    <span className="comparacion-panel-item-nombre">
                      <span className="comparacion-checklist-swatch" style={{ background: colorPorSku(serie.sku) }} />
                      {serie.nombre}
                    </span>
                    <span className="comparacion-panel-item-total">{serie.total}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
