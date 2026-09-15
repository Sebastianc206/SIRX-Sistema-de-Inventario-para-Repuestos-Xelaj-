import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ProveedorFormModal } from "@/components/ProveedorFormModal";
import {
  cambiarEstadoProveedor,
  listarProveedores,
  ProveedorApiError,
} from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

type ModalState = { modo: "crear" } | { modo: "editar"; proveedor: Proveedor } | null;

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [idAConfirmar, setIdAConfirmar] = useState<number | null>(null);
  const [idEnProceso, setIdEnProceso] = useState<number | null>(null);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarProveedores();
      setProveedores(datos);
    } catch (err) {
      setError(err instanceof ProveedorApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const proveedoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return proveedores;
    return proveedores.filter((p) => p.nombre.toLowerCase().includes(termino));
  }, [proveedores, busqueda]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    setMensaje(mensajeExito);
    cargarProveedores();
  }

  // Baja lógica (T-039/HU-26, mismo patrón de confirmación inline que
  // RepuestosPage): nunca se borra físicamente, solo se marca vigente.
  async function handleCambiarEstado(proveedor: Proveedor) {
    setIdEnProceso(proveedor.idProveedor);
    setError(null);
    try {
      const actualizado = await cambiarEstadoProveedor(proveedor.idProveedor, !proveedor.vigente);
      setProveedores((actual) =>
        actual.map((p) => (p.idProveedor === actualizado.idProveedor ? actualizado : p)),
      );
      setMensaje(
        actualizado.vigente
          ? `Se reactivó el proveedor "${actualizado.nombre}".`
          : `Se dio de baja el proveedor "${actualizado.nombre}".`,
      );
    } catch (err) {
      setError(err instanceof ProveedorApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setIdEnProceso(null);
      setIdAConfirmar(null);
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
          <h2>Proveedores</h2>
          <button onClick={() => setModal({ modo: "crear" })}>+ Nuevo proveedor</button>
        </div>

        <div className="admin-filtros">
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre..."
            />
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
          <p className="admin-estado-vacio">Cargando proveedores...</p>
        ) : proveedoresFiltrados.length === 0 ? (
          <p className="admin-estado-vacio">
            {proveedores.length === 0
              ? "Todavía no hay proveedores registrados."
              : "No hay proveedores que coincidan con la búsqueda."}
          </p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((fila) => (
                  <tr key={fila.idProveedor}>
                    <td>{fila.nombre}</td>
                    <td>{fila.direccion ?? "—"}</td>
                    <td>{fila.contacto ?? "—"}</td>
                    <td>
                      <span
                        className={fila.vigente ? "estado-badge estado-badge--activo" : "estado-badge estado-badge--inactivo"}
                      >
                        {fila.vigente ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="admin-acciones">
                      {idAConfirmar === fila.idProveedor ? (
                        <>
                          <span className="modal-helper-text">
                            {fila.vigente ? "¿Dar de baja?" : "¿Reactivar?"}
                          </span>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleCambiarEstado(fila)}
                            disabled={idEnProceso === fila.idProveedor}
                          >
                            {idEnProceso === fila.idProveedor ? "..." : "Confirmar"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setIdAConfirmar(null)}
                            disabled={idEnProceso === fila.idProveedor}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setModal({ modo: "editar", proveedor: fila })}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={fila.vigente ? "btn-danger" : "btn-secondary"}
                            onClick={() => setIdAConfirmar(fila.idProveedor)}
                          >
                            {fila.vigente ? "Dar de baja" : "Activar"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal && (
        <ProveedorFormModal
          proveedor={modal.modo === "editar" ? modal.proveedor : null}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
