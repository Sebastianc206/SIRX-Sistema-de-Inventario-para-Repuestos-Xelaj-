import { useCallback, useEffect, useMemo, useState } from "react";
import { UsuarioFormModal } from "@/components/UsuarioFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge, EstadoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterChips, FilterSelect, TableToolbar } from "@/components/ui/TableToolbar";
import { useToast } from "@/components/ui/toastContext";
import { cambiarEstadoUsuario, listarUsuarios, UsuarioApiError, type FiltrosUsuarios } from "@/services/usuarioService";
import { ROLES_DISPONIBLES } from "@/types/usuario";
import type { UsuarioAdmin } from "@/types/usuario";

type ModalState = { modo: "crear" } | { modo: "editar"; usuario: UsuarioAdmin } | null;

export default function UsuariosPage() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltrosUsuarios["estado"]>(undefined);
  const [filtroRol, setFiltroRol] = useState<number | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);
  const [aDesactivar, setADesactivar] = useState<UsuarioAdmin | null>(null);
  const [enProceso, setEnProceso] = useState<number | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await listarUsuarios({ estado: filtroEstado, idRol: filtroRol }));
    } catch (err) {
      setError(err instanceof UsuarioApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroRol]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return usuarios;
    return usuarios.filter((u) => u.username.toLowerCase().includes(termino) || u.nombreCompleto.toLowerCase().includes(termino));
  }, [usuarios, busqueda]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    toast.success(mensajeExito);
    cargarUsuarios();
  }

  async function handleCambiarEstado(fila: UsuarioAdmin) {
    setEnProceso(fila.idColaborador);
    try {
      const actualizado = await cambiarEstadoUsuario(fila.idColaborador, !fila.vigente);
      setUsuarios((actual) => actual.map((u) => (u.idColaborador === actualizado.idColaborador ? actualizado : u)));
      toast.success(actualizado.vigente ? `Se reactivó la cuenta de ${actualizado.username}.` : `Se desactivó la cuenta de ${actualizado.username}.`);
    } catch (err) {
      toast.error(err instanceof UsuarioApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setEnProceso(null);
      setADesactivar(null);
    }
  }

  const columnas: Column<UsuarioAdmin>[] = [
    { key: "username", header: "Usuario", primary: true, sortValue: (u) => u.username, cell: (u) => u.username },
    { key: "nombre", header: "Nombre completo", sortValue: (u) => u.nombreCompleto, cell: (u) => u.nombreCompleto },
    { key: "rol", header: "Rol", sortValue: (u) => u.role, cell: (u) => <Badge tone="brand" dot={false}>{u.role}</Badge> },
    { key: "estado", header: "Estado", sortValue: (u) => (u.vigente ? 1 : 0), cell: (u) => <EstadoBadge activo={u.vigente} /> },
  ];

  const hayFiltros = Boolean(busqueda.trim() || filtroEstado || filtroRol);
  function limpiar() {
    setBusqueda("");
    setFiltroEstado(undefined);
    setFiltroRol(undefined);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Usuarios"
        actions={
          <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>
            Nuevo usuario
          </Button>
        }
      />

      <TableToolbar
        searchLabel="Buscar usuarios"
        searchPlaceholder="Buscar por usuario o nombre..."
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        inlineFilters
        filters={
          <>
            <FilterSelect label="Estado" value={filtroEstado ?? ""} onChange={(v) => setFiltroEstado((v || undefined) as FiltrosUsuarios["estado"])}>
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </FilterSelect>
            <FilterSelect label="Rol" value={filtroRol ? String(filtroRol) : ""} onChange={(v) => setFiltroRol(v ? Number(v) : undefined)}>
              <option value="">Todos</option>
              {ROLES_DISPONIBLES.map((rol) => (
                <option key={rol.idRol} value={rol.idRol}>
                  {rol.descripcion}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />

      <FilterChips
        chips={[
          ...(busqueda.trim() ? [{ id: "q", label: `Búsqueda: ${busqueda.trim()}`, onRemove: () => setBusqueda("") }] : []),
          ...(filtroEstado ? [{ id: "e", label: `Estado: ${filtroEstado === "activo" ? "Activo" : "Inactivo"}`, onRemove: () => setFiltroEstado(undefined) }] : []),
          ...(filtroRol ? [{ id: "r", label: `Rol: ${ROLES_DISPONIBLES.find((r) => r.idRol === filtroRol)?.descripcion ?? filtroRol}`, onRemove: () => setFiltroRol(undefined) }] : []),
        ]}
        onClear={limpiar}
      />

      {error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={cargarUsuarios}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      <Card padded={false} className="table-card">
        <div className="table-card-head">
          <h2>
            {visibles.length} usuario{visibles.length === 1 ? "" : "s"}
          </h2>
        </div>
        <DataTable
          caption="Listado de usuarios"
          columns={columnas}
          rows={visibles}
          rowKey={(u) => u.idColaborador}
          loading={cargando}
          empty={
            error ? null : (
              <EmptyState
                icon="users"
                title="No hay usuarios que coincidan con los filtros seleccionados."
                action={hayFiltros ? <Button variant="secondary" onClick={limpiar}>Limpiar filtros</Button> : <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>Nuevo usuario</Button>}
              />
            )
          }
          rowActions={(fila) => (
            <>
              <IconButton icon="edit" label="Editar" size="sm" onClick={() => setModal({ modo: "editar", usuario: fila })} />
              <IconButton
                icon={fila.vigente ? "power" : "undo"}
                label={fila.vigente ? "Desactivar" : "Activar"}
                variant={fila.vigente ? "danger-ghost" : "ghost"}
                disabled={enProceso === fila.idColaborador}
                onClick={() => (fila.vigente ? setADesactivar(fila) : handleCambiarEstado(fila))}
              />
            </>
          )}
        />
      </Card>

      {modal && <UsuarioFormModal usuario={modal.modo === "editar" ? modal.usuario : null} onClose={() => setModal(null)} onGuardado={handleGuardado} />}

      <ConfirmDialog
        open={aDesactivar !== null}
        title="¿Desactivar esta cuenta?"
        description={`${aDesactivar?.nombreCompleto} (@${aDesactivar?.username}) ya no podrá iniciar sesión. Puedes reactivarla cuando quieras.`}
        confirmLabel="Desactivar cuenta"
        loading={enProceso !== null}
        onConfirm={() => aDesactivar && handleCambiarEstado(aDesactivar)}
        onCancel={() => setADesactivar(null)}
      />
    </div>
  );
}
