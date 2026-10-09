import { useCallback, useEffect, useMemo, useState } from "react";
import { ProveedorFormModal } from "@/components/ProveedorFormModal";
import { Alert } from "@/components/ui/Alert";
import { EstadoBadge } from "@/components/ui/Badge";
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
import { cambiarEstadoProveedor, eliminarProveedor, listarProveedores, ProveedorApiError } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

type ModalState = { modo: "crear" } | { modo: "editar"; proveedor: Proveedor } | null;
type Confirmacion = { proveedor: Proveedor; accion: "estado" | "eliminar" } | null;

export default function ProveedoresPage() {
  const toast = useToast();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [enProceso, setEnProceso] = useState(false);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setProveedores(await listarProveedores());
    } catch (err) {
      setError(err instanceof ProveedorApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      if (termino && !p.nombre.toLowerCase().includes(termino)) return false;
      if (filtroEstado === "activo" && !p.vigente) return false;
      if (filtroEstado === "inactivo" && p.vigente) return false;
      return true;
    });
  }, [proveedores, busqueda, filtroEstado]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    toast.success(mensajeExito);
    cargarProveedores();
  }

  // Baja lógica (T-039/HU-26): nunca se borra físicamente, solo se marca vigente.
  async function handleCambiarEstado(proveedor: Proveedor) {
    setEnProceso(true);
    try {
      const actualizado = await cambiarEstadoProveedor(proveedor.idProveedor, !proveedor.vigente);
      setProveedores((actual) => actual.map((p) => (p.idProveedor === actualizado.idProveedor ? actualizado : p)));
      toast.success(actualizado.vigente ? `Se reactivó el proveedor "${actualizado.nombre}".` : `Se dio de baja el proveedor "${actualizado.nombre}".`);
    } catch (err) {
      toast.error(err instanceof ProveedorApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setEnProceso(false);
      setConfirmacion(null);
    }
  }

  // Eliminación real: solo para proveedores ya inactivos; el backend rechaza
  // con 409 si tiene repuestos o compras asociados.
  async function handleEliminar(proveedor: Proveedor) {
    setEnProceso(true);
    try {
      await eliminarProveedor(proveedor.idProveedor);
      setProveedores((actual) => actual.filter((p) => p.idProveedor !== proveedor.idProveedor));
      toast.success(`Se eliminó el proveedor "${proveedor.nombre}".`);
    } catch (err) {
      toast.error(err instanceof ProveedorApiError ? err.message : "No se pudo eliminar el proveedor");
    } finally {
      setEnProceso(false);
      setConfirmacion(null);
    }
  }

  const columnas: Column<Proveedor>[] = [
    { key: "nombre", header: "Nombre", primary: true, sortValue: (p) => p.nombre, cell: (p) => p.nombre },
    { key: "direccion", header: "Dirección", sortValue: (p) => p.direccion, cell: (p) => p.direccion ?? "—" },
    { key: "contacto", header: "Contacto", sortValue: (p) => p.contacto, cell: (p) => p.contacto ?? "—" },
    { key: "estado", header: "Estado", sortValue: (p) => (p.vigente ? 1 : 0), cell: (p) => <EstadoBadge activo={p.vigente} /> },
  ];

  const hayFiltros = Boolean(busqueda.trim() || filtroEstado);
  function limpiar() {
    setBusqueda("");
    setFiltroEstado("");
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Proveedores"
        actions={
          <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>
            Nuevo proveedor
          </Button>
        }
      />

      <TableToolbar
        searchLabel="Buscar proveedores"
        searchPlaceholder="Buscar por nombre..."
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        inlineFilters
        filters={
          <FilterSelect label="Estado" value={filtroEstado} onChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </FilterSelect>
        }
      />

      <FilterChips
        chips={[
          ...(busqueda.trim() ? [{ id: "q", label: `Búsqueda: ${busqueda.trim()}`, onRemove: () => setBusqueda("") }] : []),
          ...(filtroEstado ? [{ id: "e", label: `Estado: ${filtroEstado === "activo" ? "Activo" : "Inactivo"}`, onRemove: () => setFiltroEstado("") }] : []),
        ]}
        onClear={limpiar}
      />

      {error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={cargarProveedores}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      <Card padded={false} className="table-card">
        <div className="table-card-head">
          <h2>
            {filtrados.length} proveedor{filtrados.length === 1 ? "" : "es"}
          </h2>
        </div>
        <DataTable
          caption="Listado de proveedores"
          columns={columnas}
          rows={filtrados}
          rowKey={(p) => p.idProveedor}
          loading={cargando}
          empty={
            error ? null : proveedores.length === 0 ? (
              <EmptyState
                icon="truck"
                title="Todavía no hay proveedores registrados."
                description="Registra a tus proveedores para poder asociarlos a repuestos y compras."
                action={<Button icon="plus" onClick={() => setModal({ modo: "crear" })}>Nuevo proveedor</Button>}
              />
            ) : (
              <EmptyState icon="search" title="No hay proveedores que coincidan con la búsqueda." action={hayFiltros ? <Button variant="secondary" onClick={limpiar}>Limpiar filtros</Button> : undefined} />
            )
          }
          rowActions={(fila) => (
            <>
              <IconButton icon="edit" label="Editar" size="sm" onClick={() => setModal({ modo: "editar", proveedor: fila })} />
              <IconButton
                icon={fila.vigente ? "power" : "undo"}
                label={fila.vigente ? "Dar de baja" : "Activar"}
                variant={fila.vigente ? "danger-ghost" : "ghost"}
                onClick={() => setConfirmacion({ proveedor: fila, accion: "estado" })}
              />
              {!fila.vigente && <IconButton icon="trash" label="Eliminar" size="sm" variant="danger-ghost" onClick={() => setConfirmacion({ proveedor: fila, accion: "eliminar" })} />}
            </>
          )}
        />
      </Card>

      {modal && (
        <ProveedorFormModal proveedor={modal.modo === "editar" ? modal.proveedor : null} onClose={() => setModal(null)} onGuardado={handleGuardado} />
      )}

      <ConfirmDialog
        open={confirmacion?.accion === "estado"}
        title={confirmacion?.proveedor.vigente ? "¿Dar de baja este proveedor?" : "¿Reactivar este proveedor?"}
        description={
          confirmacion?.proveedor.vigente
            ? `"${confirmacion.proveedor.nombre}" dejará de ofrecerse al registrar compras y repuestos. Su historial se conserva.`
            : `"${confirmacion?.proveedor.nombre}" volverá a estar disponible.`
        }
        confirmLabel={confirmacion?.proveedor.vigente ? "Dar de baja" : "Reactivar"}
        tone={confirmacion?.proveedor.vigente ? "danger" : "primary"}
        loading={enProceso}
        onConfirm={() => confirmacion && handleCambiarEstado(confirmacion.proveedor)}
        onCancel={() => setConfirmacion(null)}
      />
      <ConfirmDialog
        open={confirmacion?.accion === "eliminar"}
        title="¿Eliminar definitivamente?"
        description={`Se borrará "${confirmacion?.proveedor.nombre}". No se puede deshacer y solo se permite si no tiene repuestos ni compras asociados.`}
        confirmLabel="Eliminar"
        loading={enProceso}
        onConfirm={() => confirmacion && handleEliminar(confirmacion.proveedor)}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
