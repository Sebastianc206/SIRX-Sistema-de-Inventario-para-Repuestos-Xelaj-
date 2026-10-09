import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoriaFormModal } from "@/components/CategoriaFormModal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { useToast } from "@/components/ui/toastContext";
import { eliminarCategoria, listarCategorias, CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

type ModalState = { modo: "crear" } | { modo: "editar"; categoria: Categoria } | null;

export default function CategoriasPage() {
  const toast = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [aEliminar, setAEliminar] = useState<Categoria | null>(null);
  const [enProceso, setEnProceso] = useState(false);

  const cargarCategorias = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setCategorias(await listarCategorias());
    } catch (err) {
      setError(err instanceof CategoriaApiError ? err.message : "No se pudo cargar el listado");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCategorias();
  }, [cargarCategorias]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return categorias;
    return categorias.filter((c) => c.descripcion.toLowerCase().includes(termino));
  }, [categorias, busqueda]);

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    toast.success(mensajeExito);
    cargarCategorias();
  }

  async function handleEliminar(categoria: Categoria) {
    setEnProceso(true);
    try {
      await eliminarCategoria(categoria.idCategoria);
      setCategorias((actual) => actual.filter((c) => c.idCategoria !== categoria.idCategoria));
      toast.success(`Se eliminó la categoría "${categoria.descripcion}".`);
    } catch (err) {
      toast.error(err instanceof CategoriaApiError ? err.message : "No se pudo eliminar la categoría");
    } finally {
      setEnProceso(false);
      setAEliminar(null);
    }
  }

  const columnas: Column<Categoria>[] = [
    { key: "descripcion", header: "Descripción", primary: true, sortValue: (c) => c.descripcion, cell: (c) => c.descripcion },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Categorías"
        actions={
          <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>
            Nueva categoría
          </Button>
        }
      />

      <TableToolbar
        searchLabel="Buscar categorías"
        searchPlaceholder="Buscar por descripción..."
        searchValue={busqueda}
        onSearchChange={setBusqueda}
      />

      {error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={cargarCategorias}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      <Card padded={false} className="table-card">
        <div className="table-card-head">
          <h2>
            {filtradas.length} categoría{filtradas.length === 1 ? "" : "s"}
          </h2>
        </div>
        <DataTable
          caption="Listado de categorías"
          columns={columnas}
          rows={filtradas}
          rowKey={(c) => c.idCategoria}
          loading={cargando}
          empty={
            error ? null : categorias.length === 0 ? (
              <EmptyState
                icon="tag"
                title="Todavía no hay categorías registradas."
                description="Crea la primera para empezar a clasificar tus repuestos."
                action={<Button icon="plus" onClick={() => setModal({ modo: "crear" })}>Nueva categoría</Button>}
              />
            ) : (
              <EmptyState icon="search" title="No hay categorías que coincidan con la búsqueda." action={<Button variant="secondary" onClick={() => setBusqueda("")}>Limpiar búsqueda</Button>} />
            )
          }
          rowActions={(fila) => (
            <>
              <IconButton icon="edit" label="Editar" size="sm" onClick={() => setModal({ modo: "editar", categoria: fila })} />
              <IconButton icon="trash" label="Eliminar" size="sm" variant="danger-ghost" onClick={() => setAEliminar(fila)} />
            </>
          )}
        />
      </Card>

      {modal && (
        <CategoriaFormModal categoria={modal.modo === "editar" ? modal.categoria : null} onClose={() => setModal(null)} onGuardado={handleGuardado} />
      )}

      <ConfirmDialog
        open={aEliminar !== null}
        title="¿Eliminar esta categoría?"
        description={`Se eliminará la categoría "${aEliminar?.descripcion}". Si tiene repuestos asignados, el sistema no lo permitirá.`}
        confirmLabel="Sí, eliminar"
        loading={enProceso}
        onConfirm={() => aEliminar && handleEliminar(aEliminar)}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
