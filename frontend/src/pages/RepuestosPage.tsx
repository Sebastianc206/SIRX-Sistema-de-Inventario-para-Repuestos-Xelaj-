import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { CargaMasivaRepuestosModal } from "@/components/CargaMasivaRepuestosModal";
import { PaginationControls } from "@/components/PaginationControls";
import { RepuestoFormModal } from "@/components/RepuestoFormModal";
import { useAuth } from "@/hooks/useAuth";
import { listarCategorias } from "@/services/categoriaService";
import { listarMarcas, listarModelos } from "@/services/catalogosAuxiliaresService";
import {
  cambiarEstadoRepuesto,
  listarRepuestos,
  RepuestoApiError,
} from "@/services/repuestoService";
import type { Categoria } from "@/types/categoria";
import type { Marca, Modelo } from "@/types/catalogosAuxiliares";
import type { FiltrosRepuestos, Paginacion, Repuesto } from "@/types/repuesto";
import { estadoStock } from "@/utils/estadoStock";

type ModalState = { modo: "crear" } | { modo: "editar"; repuesto: Repuesto } | null;

const PAGINACION_INICIAL: Paginacion = { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 };

function IconoRepuesto() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4h10l2 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8l2-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5 8h14M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoBuscar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function RepuestosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.role === "Administrador";

  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>(PAGINACION_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltrosRepuestos["estado"]>(undefined);
  const [filtroCategoria, setFiltroCategoria] = useState<number | undefined>(undefined);
  const [filtroMarca, setFiltroMarca] = useState<number | undefined>(undefined);
  const [filtroModelo, setFiltroModelo] = useState<number | undefined>(undefined);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [mostrarCargaMasiva, setMostrarCargaMasiva] = useState(false);
  const [skuAConfirmar, setSkuAConfirmar] = useState<string | null>(null);
  const [skuEnProceso, setSkuEnProceso] = useState<string | null>(null);

  // Debounce simple: no dispara una petición por cada tecla, espera a que
  // el usuario haga una pausa al escribir en el buscador (HU-06, criterio 1).
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  // Catálogos para los filtros (HU-06, criterio 2): se cargan una sola vez,
  // no dependen de la búsqueda ni de la página actual.
  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
    listarMarcas()
      .then(setMarcas)
      .catch(() => setMarcas([]));
    listarModelos()
      .then(setModelos)
      .catch(() => setModelos([]));
  }, []);

  const cargarRepuestos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarRepuestos({
        pagina,
        busqueda: busquedaAplicada || undefined,
        estado: filtroEstado,
        idCategoria: filtroCategoria,
        idMarca: filtroMarca,
        idModelo: filtroModelo,
      });
      setRepuestos(resultado.articulos);
      setPaginacion(resultado.paginacion);
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo cargar el catálogo");
    } finally {
      setCargando(false);
    }
  }, [pagina, busquedaAplicada, filtroEstado, filtroCategoria, filtroMarca, filtroModelo]);

  useEffect(() => {
    cargarRepuestos();
  }, [cargarRepuestos]);

  // T-052/criterio 4: cualquier cambio de filtro vuelve a la página 1 y
  // dispara cargarRepuestos vía el useEffect de arriba — sin recargar la
  // página completa, solo re-fetch del listado.
  function handleCambiarFiltro(actualizar: () => void) {
    actualizar();
    setPagina(1);
  }

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    setMensaje(mensajeExito);
    cargarRepuestos();
  }

  function handleCargaMasivaCompleta() {
    // El modal se queda abierto mostrando el resumen (T-048); solo se
    // refresca el listado detrás para que ya reflejen las filas creadas.
    cargarRepuestos();
  }

  async function handleCambiarEstado(repuesto: Repuesto) {
    setSkuEnProceso(repuesto.sku);
    setError(null);
    try {
      const actualizado = await cambiarEstadoRepuesto(repuesto.sku, !repuesto.estado);
      setRepuestos((actual) => actual.map((r) => (r.sku === actualizado.sku ? actualizado : r)));
      setMensaje(
        actualizado.estado
          ? `Se reactivó el repuesto "${actualizado.nombre}".`
          : `Se dio de baja el repuesto "${actualizado.nombre}".`,
      );
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setSkuEnProceso(null);
      setSkuAConfirmar(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="admin-page admin-page--ancho">
        <Link to="/" className="admin-volver">
          ← Volver al panel
        </Link>

        <div className="admin-toolbar">
          <h2>Catálogo de repuestos</h2>
          {esAdministrador && (
            <div className="admin-toolbar-acciones">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarCargaMasiva(true)}
              >
                Carga masiva (Excel)
              </button>
              <button onClick={() => setModal({ modo: "crear" })}>+ Nuevo repuesto</button>
            </div>
          )}
        </div>

        <div className="admin-filtros">
          <label>
            Estado
            <select
              value={filtroEstado ?? ""}
              onChange={(event) =>
                handleCambiarFiltro(() =>
                  setFiltroEstado((event.target.value || undefined) as FiltrosRepuestos["estado"]),
                )
              }
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>

          <label>
            Categoría
            <select
              value={filtroCategoria ?? ""}
              onChange={(event) =>
                handleCambiarFiltro(() =>
                  setFiltroCategoria(event.target.value ? Number(event.target.value) : undefined),
                )
              }
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
              onChange={(event) =>
                handleCambiarFiltro(() =>
                  setFiltroMarca(event.target.value ? Number(event.target.value) : undefined),
                )
              }
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
            Modelo compatible
            <select
              value={filtroModelo ?? ""}
              onChange={(event) =>
                handleCambiarFiltro(() =>
                  setFiltroModelo(event.target.value ? Number(event.target.value) : undefined),
                )
              }
            >
              <option value="">Todos</option>
              {modelos.map((modelo) => (
                <option key={modelo.idModelo} value={modelo.idModelo}>
                  {modelo.descripcion}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mensaje && (
          <p className="banner banner--success" role="status">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-tabla-wrap">
          <div className="tabla-header">
            <h3>{paginacion.total} repuesto{paginacion.total === 1 ? "" : "s"}</h3>
            <label className="tabla-buscador">
              <IconoBuscar />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por SKU o nombre..."
                aria-label="Buscar en el catálogo"
              />
            </label>
          </div>

          {cargando ? (
            <p className="admin-estado-vacio">Cargando repuestos...</p>
          ) : repuestos.length === 0 ? (
            <p className="admin-estado-vacio">
              {busquedaAplicada || filtroEstado || filtroCategoria || filtroMarca || filtroModelo
                ? "No hay repuestos que coincidan con los filtros."
                : "Todavía no hay repuestos registrados en el catálogo."}
            </p>
          ) : (
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Repuesto</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Precio venta</th>
                  {esAdministrador && <th>Precio costo</th>}
                  {esAdministrador && <th>Proveedor</th>}
                  <th>Stock</th>
                  <th>Estado</th>
                  {esAdministrador && <th aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {repuestos.map((fila) => {
                  const stock = estadoStock(fila.cantidadInventario, fila.inventarioMinimo);
                  return (
                    <tr key={fila.sku}>
                      <td className="admin-tabla-celda-repuesto">
                        <span className="repuesto-icono">
                          <IconoRepuesto />
                        </span>
                        <span>
                          <div>{fila.nombre}</div>
                          <div className="modal-helper-text">{fila.sku}</div>
                        </span>
                      </td>
                      <td>{fila.categoria?.descripcion ?? "—"}</td>
                      <td>{fila.marca?.nombre ?? "—"}</td>
                      <td>Q{Number(fila.precioVenta).toFixed(2)}</td>
                      {esAdministrador && (
                        <td>{fila.precioCosto !== undefined ? `Q${Number(fila.precioCosto).toFixed(2)}` : "—"}</td>
                      )}
                      {esAdministrador && <td>{fila.proveedor?.nombre ?? "—"}</td>}
                      <td>
                        <span className={`stock-badge ${stock.clase}`}>
                          {fila.cantidadInventario} · {stock.texto}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            fila.estado
                              ? "estado-badge estado-badge--activo"
                              : "estado-badge estado-badge--inactivo"
                          }
                        >
                          {fila.estado ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      {esAdministrador && (
                        <td className="admin-acciones">
                          {skuAConfirmar === fila.sku ? (
                            <>
                              <span className="modal-helper-text">
                                {fila.estado ? "¿Dar de baja?" : "¿Reactivar?"}
                              </span>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => handleCambiarEstado(fila)}
                                disabled={skuEnProceso === fila.sku}
                              >
                                {skuEnProceso === fila.sku ? "..." : "Confirmar"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setSkuAConfirmar(null)}
                                disabled={skuEnProceso === fila.sku}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setModal({ modo: "editar", repuesto: fila })}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={fila.estado ? "btn-danger" : "btn-secondary"}
                                onClick={() => setSkuAConfirmar(fila.sku)}
                              >
                                {fila.estado ? "Dar de baja" : "Activar"}
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls paginacion={paginacion} onCambiarPagina={setPagina} />
      </main>

      {modal && (
        <RepuestoFormModal
          repuesto={modal.modo === "editar" ? modal.repuesto : null}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}

      {mostrarCargaMasiva && (
        <CargaMasivaRepuestosModal
          onClose={() => setMostrarCargaMasiva(false)}
          onCargaCompleta={handleCargaMasivaCompleta}
        />
      )}
    </div>
  );
}
