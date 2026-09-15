import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { PaginationControls } from "@/components/PaginationControls";
import { ProductoMultiSelect, type OpcionMultiSelect } from "@/components/ProductoMultiSelect";
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
// pueden seleccionar a la vez en la comparación (ver MAX_PRODUCTOS_COMPARACION).
//
// El color se asigna por ORDEN DE SELECCIÓN (posición en la lista de
// productos elegidos para comparar), no por la posición del producto en el
// catálogo: el 1er producto marcado es siempre azul, el 2do siempre
// naranja, etc. — cambio de diseño intencional, antes era por catálogo.
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

const MAX_PRODUCTOS_COMPARACION = 10;
const PORPAGINA_MOVIMIENTOS = 15;
const PAGINACION_INICIAL: Paginacion = { pagina: 1, porPagina: PORPAGINA_MOVIMIENTOS, total: 0, totalPaginas: 1 };
const MENSAJE_RANGO_INVALIDO = "La fecha de inicio debe ser anterior a la fecha fin.";

function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

// Todo lo que necesita cada select de Categoría/Marca es su propia lista de
// ids seleccionados (independiente por sección) — el catálogo de opciones
// (categorias/marcas) es el mismo para las dos, solo cambia qué está tildado.
function aOpciones<T>(items: T[], idDe: (item: T) => number, etiquetaDe: (item: T) => string): OpcionMultiSelect[] {
  return items.map((item) => ({ id: String(idDe(item)), etiqueta: etiquetaDe(item) }));
}

// Sin producto(s) elegidos explícitamente: si hay categoría/marca activa,
// el filtro implícito son los productos que coinciden con ellas; si no hay
// ningún filtro, no se restringe nada (el backend trae todo). Elegir
// producto(s) explícitamente siempre gana sobre categoría/marca — ya fueron
// la base para armar esa lista.
function resolverSkusFiltrados(
  seleccionados: string[],
  categoriaSel: string[],
  marcaSel: string[],
  catalogoFiltrado: Repuesto[],
): string[] | undefined {
  if (seleccionados.length > 0) return seleccionados;
  if (categoriaSel.length > 0 || marcaSel.length > 0) return catalogoFiltrado.map((r) => r.sku);
  return undefined;
}

function filtrarCatalogo(catalogo: Repuesto[], categoriaSel: string[], marcaSel: string[]): Repuesto[] {
  return catalogo.filter((repuesto) => {
    if (categoriaSel.length > 0 && !categoriaSel.includes(String(repuesto.categoria?.idCategoria))) return false;
    if (marcaSel.length > 0 && !marcaSel.includes(String(repuesto.marca?.idMarca))) return false;
    return true;
  });
}

// HU-10: historial de movimientos — TODO lo que le pasó al stock (compras,
// ventas, mermas, ajustes) de los productos que coincidan con el filtro, no
// de uno solo — y comparación de ventas entre productos (solo ventas, no
// ajustes ni compras — regla ya establecida). Son dos secciones con estado
// de filtros completamente independiente: cambiar Categoría/Marca/
// Producto/fechas en una no afecta a la otra.
export default function MovimientosPage() {
  const [catalogo, setCatalogo] = useState<Repuesto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

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

  const opcionesCategorias = useMemo(
    () => aOpciones(categorias, (c) => c.idCategoria, (c) => c.descripcion),
    [categorias],
  );
  const opcionesMarcas = useMemo(() => aOpciones(marcas, (m) => m.idMarca, (m) => m.nombre), [marcas]);

  // ---------- Historial de movimientos ----------
  const [hCategoria, setHCategoria] = useState<string[]>([]);
  const [hMarca, setHMarca] = useState<string[]>([]);
  const [hProductos, setHProductos] = useState<string[]>([]);
  // Default = mes en curso (día 1 hasta hoy); el usuario puede ampliar el
  // rango libremente.
  const [hFechaDesde, setHFechaDesde] = useState(primerDiaDelMesISO());
  const [hFechaHasta, setHFechaHasta] = useState(hoyISO());

  const [movimientos, setMovimientos] = useState<MovimientoHistorial[]>([]);
  const [paginacionMovimientos, setPaginacionMovimientos] = useState<Paginacion>(PAGINACION_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idAAnular, setIdAAnular] = useState<string | null>(null);
  const [idEnProceso, setIdEnProceso] = useState<string | null>(null);

  // Solo filtra qué se MUESTRA en el dropdown de producto del historial —
  // `hProductos` no se toca acá, así que un producto ya marcado no se
  // pierde al cambiar categoría/marca.
  const catalogoFiltradoHistorial = useMemo(() => filtrarCatalogo(catalogo, hCategoria, hMarca), [catalogo, hCategoria, hMarca]);
  const opcionesProductoHistorial = useMemo(
    () => catalogoFiltradoHistorial.map((r): OpcionMultiSelect => ({ id: r.sku, etiqueta: r.nombre, detalle: r.sku })),
    [catalogoFiltradoHistorial],
  );

  function cambiarFiltroHistorial<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor);
      setPagina(1);
    };
  }

  // ISO (aaaa-mm-dd) compara lexicográficamente igual que cronológicamente.
  const rangoValidoHistorial = !hFechaDesde || !hFechaHasta || hFechaDesde <= hFechaHasta;

  const cargarMovimientos = useCallback(async () => {
    if (!rangoValidoHistorial) {
      setError(MENSAJE_RANGO_INVALIDO);
      setMovimientos([]);
      setPaginacionMovimientos(PAGINACION_INICIAL);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarMovimientos({
        skus: resolverSkusFiltrados(hProductos, hCategoria, hMarca, catalogoFiltradoHistorial),
        fechaDesde: hFechaDesde || undefined,
        fechaHasta: hFechaHasta || undefined,
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
  }, [rangoValidoHistorial, hProductos, hCategoria, hMarca, catalogoFiltradoHistorial, hFechaDesde, hFechaHasta, pagina]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

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

  // ---------- Comparación de ventas entre productos ----------
  const [cCategoria, setCCategoria] = useState<string[]>([]);
  const [cMarca, setCMarca] = useState<string[]>([]);
  // Sin "Todas" (a diferencia del producto del historial): la comparación
  // siempre necesita productos elegidos uno por uno, hasta el tope de 10 —
  // "seleccionar todas" no es compatible con ese límite en catálogos grandes.
  const [cProductos, setCProductos] = useState<string[]>([]);
  const [cFechaDesde, setCFechaDesde] = useState(primerDiaDelMesISO());
  const [cFechaHasta, setCFechaHasta] = useState(hoyISO());

  const [series, setSeries] = useState<SerieVentas[] | null>(null);
  const [cargandoComparacion, setCargandoComparacion] = useState(false);
  const [errorComparacion, setErrorComparacion] = useState<string | null>(null);
  // Conjunto de skus "enfocados" en la gráfica — 0, 1 o varios a la vez (ver
  // VentasComparacionChart), independiente de `cProductos`.
  const [resaltados, setResaltados] = useState<ReadonlySet<string>>(new Set());

  const catalogoFiltradoComparacion = useMemo(() => filtrarCatalogo(catalogo, cCategoria, cMarca), [catalogo, cCategoria, cMarca]);
  const opcionesProductoComparacion = useMemo(
    () => catalogoFiltradoComparacion.map((r): OpcionMultiSelect => ({ id: r.sku, etiqueta: r.nombre, detalle: r.sku })),
    [catalogoFiltradoComparacion],
  );

  // Color por posición en `cProductos` (orden de selección), no por
  // posición en el catálogo.
  const colorPorSku = useMemo(() => {
    const indicePorSku = new Map(cProductos.map((sku, indice) => [sku, indice]));
    return (sku: string) => PALETA_CATEGORICA[(indicePorSku.get(sku) ?? 0) % PALETA_CATEGORICA.length];
  }, [cProductos]);

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

  const rangoValidoComparacion = !cFechaDesde || !cFechaHasta || cFechaDesde <= cFechaHasta;

  // La gráfica se actualiza sola con su propio filtro de Producto/fechas —
  // no hace falta un botón "Comparar" aparte.
  const cargarComparacion = useCallback(async () => {
    if (!rangoValidoComparacion) {
      setErrorComparacion(MENSAJE_RANGO_INVALIDO);
      setSeries(null);
      return;
    }
    if (cProductos.length < 2) {
      setSeries(null);
      setErrorComparacion(null);
      return;
    }
    setCargandoComparacion(true);
    setErrorComparacion(null);
    try {
      const resultado = await obtenerComparacionVentas(cProductos, {
        fechaDesde: cFechaDesde || undefined,
        fechaHasta: cFechaHasta || undefined,
      });
      setSeries(resultado.series);
      setResaltados(new Set());
    } catch (err) {
      setErrorComparacion(err instanceof MovimientoApiError ? err.message : "No se pudo cargar la comparación");
    } finally {
      setCargandoComparacion(false);
    }
  }, [rangoValidoComparacion, cProductos, cFechaDesde, cFechaHasta]);

  useEffect(() => {
    cargarComparacion();
  }, [cargarComparacion]);

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
          <h3>Historial de movimientos — filtros</h3>
          <div className="admin-filtros">
            <label>
              Categoría
              <ProductoMultiSelect
                ariaLabel="Filtrar historial por categoría"
                opciones={opcionesCategorias}
                seleccionados={hCategoria}
                onCambiarSeleccion={cambiarFiltroHistorial(setHCategoria)}
                conOpcionTodas
                etiquetaBoton={(n) => (n === 0 ? "Todas las categorías" : `${n} ${plural(n, "categoría", "categorías")} seleccionada${plural(n, "", "s")}`)}
                mensajeVacio="No hay categorías registradas."
              />
            </label>
            <label>
              Marca
              <ProductoMultiSelect
                ariaLabel="Filtrar historial por marca"
                opciones={opcionesMarcas}
                seleccionados={hMarca}
                onCambiarSeleccion={cambiarFiltroHistorial(setHMarca)}
                conOpcionTodas
                etiquetaBoton={(n) => (n === 0 ? "Todas las marcas" : `${n} ${plural(n, "marca", "marcas")} seleccionada${plural(n, "", "s")}`)}
                mensajeVacio="No hay marcas registradas."
              />
            </label>
            <label>
              Producto
              <ProductoMultiSelect
                ariaLabel="Filtrar historial por producto"
                opciones={opcionesProductoHistorial}
                seleccionados={hProductos}
                onCambiarSeleccion={cambiarFiltroHistorial(setHProductos)}
                conOpcionTodas
                etiquetaBoton={(n) => (n === 0 ? "Todos los productos" : `${n} ${plural(n, "producto", "productos")} seleccionado${plural(n, "", "s")}`)}
                mensajeVacio="Ningún repuesto coincide con ese filtro."
              />
            </label>
            <label>
              Desde
              <input type="date" value={hFechaDesde} onChange={(event) => cambiarFiltroHistorial(setHFechaDesde)(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={hFechaHasta} onChange={(event) => cambiarFiltroHistorial(setHFechaHasta)(event.target.value)} />
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
                    <tr key={clave} className={mov.anulada ? "admin-tabla-fila-anulada" : undefined}>
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
          <h2>Comparar ventas entre productos — filtros</h2>
        </div>
        <p className="modal-helper-text" style={{ marginBottom: "var(--space-md)" }}>
          Elige 2 o más productos (hasta {MAX_PRODUCTOS_COMPARACION}) para comparar sus ventas (no incluye ajustes ni
          compras) en el rango de fechas seleccionado — filtros independientes del historial de arriba.
        </p>

        <div className="admin-filtros">
          <label>
            Categoría
            <ProductoMultiSelect
              ariaLabel="Filtrar comparación por categoría"
              opciones={opcionesCategorias}
              seleccionados={cCategoria}
              onCambiarSeleccion={setCCategoria}
              conOpcionTodas
              etiquetaBoton={(n) => (n === 0 ? "Todas las categorías" : `${n} ${plural(n, "categoría", "categorías")} seleccionada${plural(n, "", "s")}`)}
              mensajeVacio="No hay categorías registradas."
            />
          </label>
          <label>
            Marca
            <ProductoMultiSelect
              ariaLabel="Filtrar comparación por marca"
              opciones={opcionesMarcas}
              seleccionados={cMarca}
              onCambiarSeleccion={setCMarca}
              conOpcionTodas
              etiquetaBoton={(n) => (n === 0 ? "Todas las marcas" : `${n} ${plural(n, "marca", "marcas")} seleccionada${plural(n, "", "s")}`)}
              mensajeVacio="No hay marcas registradas."
            />
          </label>
          <label>
            Producto
            <ProductoMultiSelect
              ariaLabel="Elegir productos a comparar"
              opciones={opcionesProductoComparacion}
              seleccionados={cProductos}
              onCambiarSeleccion={setCProductos}
              maximo={MAX_PRODUCTOS_COMPARACION}
              mensajeLimite={`Máximo ${MAX_PRODUCTOS_COMPARACION} productos a la vez — quita uno para elegir otro.`}
              etiquetaBoton={(n) => (n === 0 ? "Selecciona productos" : `${n} ${plural(n, "producto", "productos")} seleccionado${plural(n, "", "s")}`)}
              mensajeVacio="Ningún repuesto coincide con ese filtro."
            />
          </label>
          <label>
            Desde
            <input type="date" value={cFechaDesde} onChange={(event) => setCFechaDesde(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={cFechaHasta} onChange={(event) => setCFechaHasta(event.target.value)} />
          </label>
        </div>

        {errorComparacion && (
          <p className="banner banner--error" role="alert">
            {errorComparacion}
          </p>
        )}

        <div className="comparacion-layout">
          <div className="form-card" style={{ margin: 0 }}>
            {cProductos.length < 2 ? (
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
