import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { ProveedorFormModal } from "@/components/ProveedorFormModal";
import { listarProveedores, ProveedorApiError } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

type ModalState = { modo: "crear" } | { modo: "editar"; proveedor: Proveedor } | null;

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

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

  return (
    <div className="dashboard-page">
      <AppHeader />

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
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((fila) => (
                  <tr key={fila.idProveedor}>
                    <td>{fila.nombre}</td>
                    <td>{fila.direccion ?? "—"}</td>
                    <td>{fila.contacto ?? "—"}</td>
                    <td className="admin-acciones">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setModal({ modo: "editar", proveedor: fila })}
                      >
                        Editar
                      </button>
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
