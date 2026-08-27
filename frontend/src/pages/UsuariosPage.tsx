import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { UsuarioFormModal } from "@/components/UsuarioFormModal";
import {
  cambiarEstadoUsuario,
  listarUsuarios,
  UsuarioApiError,
  type FiltrosUsuarios,
} from "@/services/usuarioService";
import { ROLES_DISPONIBLES } from "@/types/usuario";
import type { UsuarioAdmin } from "@/types/usuario";

type ModalState = { modo: "crear" } | { modo: "editar"; usuario: UsuarioAdmin } | null;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltrosUsuarios["estado"]>(undefined);
  const [filtroRol, setFiltroRol] = useState<number | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);
  const [idEnProceso, setIdEnProceso] = useState<number | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarUsuarios({ estado: filtroEstado, idRol: filtroRol });
      setUsuarios(datos);
    } catch (err) {
      setError(err instanceof UsuarioApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroRol]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    setMensaje(mensajeExito);
    cargarUsuarios();
  }

  async function handleCambiarEstado(fila: UsuarioAdmin) {
    setIdEnProceso(fila.idColaborador);
    setError(null);
    try {
      const actualizado = await cambiarEstadoUsuario(fila.idColaborador, !fila.vigente);
      setUsuarios((actual) =>
        actual.map((u) => (u.idColaborador === actualizado.idColaborador ? actualizado : u)),
      );
      setMensaje(
        actualizado.vigente
          ? `Se reactivó la cuenta de ${actualizado.username}.`
          : `Se desactivó la cuenta de ${actualizado.username}.`,
      );
    } catch (err) {
      setError(err instanceof UsuarioApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setIdEnProceso(null);
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
          <h2>Usuarios</h2>
          <button onClick={() => setModal({ modo: "crear" })}>+ Nuevo usuario</button>
        </div>

        <div className="admin-filtros">
          <label>
            Estado
            <select
              value={filtroEstado ?? ""}
              onChange={(event) =>
                setFiltroEstado((event.target.value || undefined) as FiltrosUsuarios["estado"])
              }
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>

          <label>
            Rol
            <select
              value={filtroRol ?? ""}
              onChange={(event) =>
                setFiltroRol(event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">Todos</option>
              {ROLES_DISPONIBLES.map((rol) => (
                <option key={rol.idRol} value={rol.idRol}>
                  {rol.descripcion}
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

        {cargando ? (
          <p className="admin-estado-vacio">Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <p className="admin-estado-vacio">
            No hay usuarios que coincidan con los filtros seleccionados.
          </p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre completo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((fila) => (
                  <tr key={fila.idColaborador}>
                    <td>{fila.username}</td>
                    <td>{fila.nombreCompleto}</td>
                    <td>
                      <span className="role-badge">{fila.role}</span>
                    </td>
                    <td>
                      <span
                        className={
                          fila.vigente
                            ? "estado-badge estado-badge--activo"
                            : "estado-badge estado-badge--inactivo"
                        }
                      >
                        {fila.vigente ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="admin-acciones">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setModal({ modo: "editar", usuario: fila })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={fila.vigente ? "btn-secondary" : ""}
                        onClick={() => handleCambiarEstado(fila)}
                        disabled={idEnProceso === fila.idColaborador}
                      >
                        {idEnProceso === fila.idColaborador
                          ? "..."
                          : fila.vigente
                            ? "Desactivar"
                            : "Activar"}
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
        <UsuarioFormModal
          usuario={modal.modo === "editar" ? modal.usuario : null}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
