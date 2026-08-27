import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { CategoriaFormModal } from "@/components/CategoriaFormModal";
import { eliminarCategoria, listarCategorias, CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

type ModalState = { modo: "crear" } | { modo: "editar"; categoria: Categoria } | null;

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [idAEliminar, setIdAEliminar] = useState<number | null>(null);
  const [idEnProceso, setIdEnProceso] = useState<number | null>(null);

  const cargarCategorias = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarCategorias();
      setCategorias(datos);
    } catch (err) {
      setError(err instanceof CategoriaApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCategorias();
  }, [cargarCategorias]);

  const categoriasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return categorias;
    return categorias.filter((c) => c.descripcion.toLowerCase().includes(termino));
  }, [categorias, busqueda]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    setMensaje(mensajeExito);
    cargarCategorias();
  }

  async function handleEliminar(categoria: Categoria) {
    setIdEnProceso(categoria.idCategoria);
    setError(null);
    try {
      await eliminarCategoria(categoria.idCategoria);
      setCategorias((actual) => actual.filter((c) => c.idCategoria !== categoria.idCategoria));
      setMensaje(`Se eliminó la categoría "${categoria.descripcion}".`);
    } catch (err) {
      setError(err instanceof CategoriaApiError ? err.message : "No se pudo eliminar la categoría");
    } finally {
      setIdEnProceso(null);
      setIdAEliminar(null);
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
          <h2>Categorías</h2>
          <button onClick={() => setModal({ modo: "crear" })}>+ Nueva categoría</button>
        </div>

        <div className="admin-filtros">
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por descripción..."
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
          <p className="admin-estado-vacio">Cargando categorías...</p>
        ) : categoriasFiltradas.length === 0 ? (
          <p className="admin-estado-vacio">
            {categorias.length === 0
              ? "Todavía no hay categorías registradas."
              : "No hay categorías que coincidan con la búsqueda."}
          </p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {categoriasFiltradas.map((fila) => (
                  <tr key={fila.idCategoria}>
                    <td>{fila.descripcion}</td>
                    <td className="admin-acciones">
                      {idAEliminar === fila.idCategoria ? (
                        <>
                          <span className="modal-helper-text">¿Eliminar?</span>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleEliminar(fila)}
                            disabled={idEnProceso === fila.idCategoria}
                          >
                            {idEnProceso === fila.idCategoria ? "..." : "Sí, eliminar"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setIdAEliminar(null)}
                            disabled={idEnProceso === fila.idCategoria}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setModal({ modo: "editar", categoria: fila })}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => setIdAEliminar(fila.idCategoria)}
                          >
                            Eliminar
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
        <CategoriaFormModal
          categoria={modal.modo === "editar" ? modal.categoria : null}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
