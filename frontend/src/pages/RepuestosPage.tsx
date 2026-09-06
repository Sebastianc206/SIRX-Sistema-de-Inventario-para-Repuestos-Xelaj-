import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { PaginationControls } from "@/components/PaginationControls";
import { RepuestoFormModal } from "@/components/RepuestoFormModal";
import { useAuth } from "@/hooks/useAuth";
import {
  cambiarEstadoRepuesto,
  listarRepuestos,
  RepuestoApiError,
} from "@/services/repuestoService";
import type { FiltrosRepuestos, Paginacion, Repuesto } from "@/types/repuesto";

type ModalState = { modo: "crear" } | { modo: "editar"; repuesto: Repuesto } | null;

const PAGINACION_INICIAL: Paginacion = { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 };

export default function RepuestosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.role === "Administrador";

  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>(PAGINACION_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltrosRepuestos["estado"]>(undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [skuAConfirmar, setSkuAConfirmar] = useState<string | null>(null);
  const [skuEnProceso, setSkuEnProceso] = useState<string | null>(null);

  // Debounce simple: no dispara una petición por cada tecla, espera a que
  // el usuario haga una pausa al escribir en el buscador.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const cargarRepuestos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarRepuestos({
        pagina,
        busqueda: busquedaAplicada || undefined,
        estado: filtroEstado,
      });
      setRepuestos(resultado.articulos);
      setPaginacion(resultado.paginacion);
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo cargar el catálogo");
    } finally {
      setCargando(false);
    }
  }, [pagina, busquedaAplicada, filtroEstado]);

  useEffect(() => {
    cargarRepuestos();
  }, [cargarRepuestos]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    setMensaje(mensajeExito);
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
    <div className="dashboard-page">
      <AppHeader />

      <main className="admin-page">
        <Link to="/" className="admin-volver">
          ← Volver al panel
        </Link>

        <div className="admin-toolbar">
          <h2>Catálogo de repuestos</h2>
          {esAdministrador && (
            <button onClick={() => setModal({ modo: "crear" })}>+ Nuevo repuesto</button>
          )}
        </div>

        <div className="admin-filtros">
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por SKU o nombre..."
            />
          </label>

          <label>
            Estado
            <select
              value={filtroEstado ?? ""}
              onChange={(event) => {
                setFiltroEstado((event.target.value || undefined) as FiltrosRepuestos["estado"]);
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
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

        {cargando ? (
          <p className="admin-estado-vacio">Cargando repuestos...</p>
        ) : repuestos.length === 0 ? (
          <p className="admin-estado-vacio">
            {busquedaAplicada || filtroEstado
              ? "No hay repuestos que coincidan con los filtros."
              : "Todavía no hay repuestos registrados en el catálogo."}
          </p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
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
                  const stockBajo = fila.cantidadInventario < fila.inventarioMinimo;
                  return (
                    <tr key={fila.sku}>
                      <td>{fila.sku}</td>
                      <td>{fila.nombre}</td>
                      <td>{fila.categoria?.descripcion ?? "—"}</td>
                      <td>{fila.marca?.nombre ?? "—"}</td>
                      <td>Q{Number(fila.precioVenta).toFixed(2)}</td>
                      {esAdministrador && (
                        <td>{fila.precioCosto !== undefined ? `Q${Number(fila.precioCosto).toFixed(2)}` : "—"}</td>
                      )}
                      {esAdministrador && <td>{fila.proveedor?.nombre ?? "—"}</td>}
                      <td>
                        <span className={stockBajo ? "estado-badge estado-badge--inactivo" : ""}>
                          {fila.cantidadInventario}
                          {stockBajo && " ⚠"}
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
          </div>
        )}

        <PaginationControls paginacion={paginacion} onCambiarPagina={setPagina} />
      </main>

      {modal && (
        <RepuestoFormModal
          repuesto={modal.modo === "editar" ? modal.repuesto : null}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
