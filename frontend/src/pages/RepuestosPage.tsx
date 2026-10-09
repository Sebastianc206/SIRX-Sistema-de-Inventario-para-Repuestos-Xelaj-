import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CargaMasivaRepuestosModal } from "@/components/CargaMasivaRepuestosModal";
import { PaginationControls } from "@/components/PaginationControls";
import { RepuestoFormModal } from "@/components/RepuestoFormModal";
import { Alert } from "@/components/ui/Alert";
import { EstadoBadge, StockBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { MoreMenu } from "@/components/ui/MoreMenu";
import { BulkBar, FilterChips, FilterSelect, TableToolbar } from "@/components/ui/TableToolbar";
import type { ChipItem } from "@/components/ui/TableToolbar";
import { useToast } from "@/components/ui/toastContext";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { listarCategorias } from "@/services/categoriaService";
import { listarMarcas, listarModelos } from "@/services/catalogosAuxiliaresService";
import { cambiarEstadoRepuesto, eliminarRepuesto, listarRepuestos, RepuestoApiError } from "@/services/repuestoService";
import type { Categoria } from "@/types/categoria";
import type { Marca, Modelo } from "@/types/catalogosAuxiliares";
import type { FiltrosRepuestos, Paginacion, Repuesto } from "@/types/repuesto";
import { quetzales } from "@/utils/formato";

type ModalState = { modo: "crear" } | { modo: "editar"; repuesto: Repuesto } | null;
// Un registro solo puede estar confirmando UNA acción a la vez — "estado"
// (dar de baja/reactivar) o "eliminar" (borrado real, solo visible cuando ya
// está inactivo).
type Confirmacion = { repuesto: Repuesto; accion: "estado" | "eliminar" } | null;

const PAGINACION_INICIAL: Paginacion = { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 };

function csvCelda(valor: string | number | null | undefined): string {
  const texto = String(valor ?? "");
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export default function RepuestosPage() {
  const { usuario } = useAuth();
  const toast = useToast();
  const esAdministrador = usuario?.role === "Administrador";
  const [params, setParams] = useSearchParams();

  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>(PAGINACION_INICIAL);
  const [pagina, setPagina] = useState(1);
  // Deep link: /repuestos?buscar=SKU (paleta de comandos, alertas del tablero).
  const [busqueda, setBusqueda] = useState(() => params.get("buscar") ?? "");
  const [busquedaAplicada, setBusquedaAplicada] = useState(() => params.get("buscar") ?? "");
  const [filtroEstado, setFiltroEstado] = useState<FiltrosRepuestos["estado"]>(undefined);
  const [filtroCategoria, setFiltroCategoria] = useState<number | undefined>(undefined);
  const [filtroMarca, setFiltroMarca] = useState<number | undefined>(undefined);
  const [filtroModelo, setFiltroModelo] = useState<number | undefined>(undefined);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [mostrarCargaMasiva, setMostrarCargaMasiva] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [enProceso, setEnProceso] = useState(false);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string | number>>(new Set());
  const [densidad, setDensidad] = usePersistentState<"comfortable" | "compact">("sirx_densidad", "comfortable");

  // Si ya estamos en el catálogo y llega otro ?buscar= (paleta de comandos),
  // se aplica de inmediato.
  const buscarParam = params.get("buscar");
  useEffect(() => {
    if (buscarParam !== null) {
      setBusqueda(buscarParam);
      setBusquedaAplicada(buscarParam);
      setPagina(1);
    }
  }, [buscarParam]);

  // /repuestos?nuevo=1 abre directamente el formulario de alta (solo admin).
  useEffect(() => {
    if (params.get("nuevo") === "1") {
      if (esAdministrador) setModal({ modo: "crear" });
      const siguiente = new URLSearchParams(params);
      siguiente.delete("nuevo");
      setParams(siguiente, { replace: true });
    }
  }, [params, setParams, esAdministrador]);

  // Debounce simple: no dispara una petición por cada tecla, espera a que el
  // usuario haga una pausa al escribir en el buscador (HU-06, criterio 1).
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  // Catálogos para los filtros (HU-06, criterio 2): se cargan una sola vez.
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

  // La selección es por página: al cambiar de página o de filtros se limpia
  // para que "N seleccionados" siempre sea lo que se ve.
  useEffect(() => {
    setSeleccion(new Set());
  }, [pagina, busquedaAplicada, filtroEstado, filtroCategoria, filtroMarca, filtroModelo]);

  // T-052/criterio 4: cualquier cambio de filtro vuelve a la página 1 y
  // dispara cargarRepuestos vía el useEffect de arriba.
  function handleCambiarFiltro(actualizar: () => void) {
    actualizar();
    setPagina(1);
  }

  function handleGuardado(mensajeExito: string) {
    setModal(null);
    toast.success(mensajeExito);
    cargarRepuestos();
  }

  async function handleCambiarEstado(repuesto: Repuesto) {
    setEnProceso(true);
    try {
      const actualizado = await cambiarEstadoRepuesto(repuesto.sku, !repuesto.estado);
      setRepuestos((actual) => actual.map((r) => (r.sku === actualizado.sku ? actualizado : r)));
      toast.success(
        actualizado.estado ? `Se reactivó el repuesto "${actualizado.nombre}".` : `Se dio de baja el repuesto "${actualizado.nombre}".`,
      );
    } catch (err) {
      toast.error(err instanceof RepuestoApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setEnProceso(false);
      setConfirmacion(null);
    }
  }

  // Eliminación real (opción adicional a la baja lógica): solo para
  // repuestos ya inactivos; el backend además rechaza con 409 si tiene
  // historial asociado, con un mensaje claro que se muestra tal cual.
  async function handleEliminar(repuesto: Repuesto) {
    setEnProceso(true);
    try {
      await eliminarRepuesto(repuesto.sku);
      setRepuestos((actual) => actual.filter((r) => r.sku !== repuesto.sku));
      toast.success(`Se eliminó el repuesto "${repuesto.nombre}".`);
    } catch (err) {
      toast.error(err instanceof RepuestoApiError ? err.message : "No se pudo eliminar el repuesto");
    } finally {
      setEnProceso(false);
      setConfirmacion(null);
    }
  }

  const hayFiltros = Boolean(busquedaAplicada || filtroEstado || filtroCategoria || filtroMarca || filtroModelo);

  function limpiarFiltros() {
    setBusqueda("");
    setBusquedaAplicada("");
    setFiltroEstado(undefined);
    setFiltroCategoria(undefined);
    setFiltroMarca(undefined);
    setFiltroModelo(undefined);
    setPagina(1);
  }

  const chips = useMemo<ChipItem[]>(() => {
    const lista: ChipItem[] = [];
    if (busquedaAplicada) {
      lista.push({
        id: "busqueda",
        label: `Búsqueda: ${busquedaAplicada}`,
        onRemove: () => {
          setBusqueda("");
          setBusquedaAplicada("");
          setPagina(1);
        },
      });
    }
    if (filtroEstado) {
      lista.push({ id: "estado", label: `Estado: ${filtroEstado === "activo" ? "Activo" : "Inactivo"}`, onRemove: () => handleCambiarFiltro(() => setFiltroEstado(undefined)) });
    }
    if (filtroCategoria) {
      lista.push({
        id: "categoria",
        label: `Categoría: ${categorias.find((c) => c.idCategoria === filtroCategoria)?.descripcion ?? filtroCategoria}`,
        onRemove: () => handleCambiarFiltro(() => setFiltroCategoria(undefined)),
      });
    }
    if (filtroMarca) {
      lista.push({
        id: "marca",
        label: `Marca: ${marcas.find((m) => m.idMarca === filtroMarca)?.nombre ?? filtroMarca}`,
        onRemove: () => handleCambiarFiltro(() => setFiltroMarca(undefined)),
      });
    }
    if (filtroModelo) {
      lista.push({
        id: "modelo",
        label: `Modelo: ${modelos.find((m) => m.idModelo === filtroModelo)?.descripcion ?? filtroModelo}`,
        onRemove: () => handleCambiarFiltro(() => setFiltroModelo(undefined)),
      });
    }
    return lista;
    // handleCambiarFiltro solo usa setters estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaAplicada, filtroEstado, filtroCategoria, filtroMarca, filtroModelo, categorias, marcas, modelos]);

  // Exporta a CSV las filas seleccionadas; las columnas de costo/proveedor
  // solo existen para Administrador (el backend ya las omite para Operador).
  function exportarSeleccion() {
    const filas = repuestos.filter((r) => seleccion.has(r.sku));
    const encabezado = ["SKU", "Nombre", "Categoría", "Marca", "Precio venta", ...(esAdministrador ? ["Precio costo", "Proveedor"] : []), "Stock", "Stock mínimo", "Ubicación", "Estado"];
    const lineas = filas.map((r) =>
      [
        r.sku,
        r.nombre,
        r.categoria?.descripcion,
        r.marca?.nombre,
        Number(r.precioVenta).toFixed(2),
        ...(esAdministrador ? [r.precioCosto !== undefined ? Number(r.precioCosto).toFixed(2) : "", r.proveedor?.nombre] : []),
        r.cantidadInventario,
        r.inventarioMinimo,
        r.ubicacion,
        r.estado ? "Activo" : "Inactivo",
      ]
        .map(csvCelda)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [encabezado.map(csvCelda).join(";"), ...lineas].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "repuestos-seleccion.csv";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    toast.success(`Se exportaron ${filas.length} repuesto${filas.length === 1 ? "" : "s"} a CSV.`);
  }

  const columnas: Column<Repuesto>[] = [
    {
      key: "repuesto",
      header: "Repuesto",
      primary: true,
      sortValue: (r) => r.nombre,
      cell: (r) => (
        <div className="cell-repuesto">
          <span className="cell-repuesto-icon">
            <Icon name="package" size={18} />
          </span>
          <span>
            <span className="cell-repuesto-name">
              {r.nombre}
              {!r.estado && <EstadoBadge activo={false} />}
            </span>
            <span className="cell-sku">{r.sku}</span>
          </span>
        </div>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      sortValue: (r) => r.categoria?.descripcion,
      cell: (r) => (
        <span className="cell-stack">
          <span>{r.categoria?.descripcion ?? "—"}</span>
          {r.marca && <span className="cell-sub">{r.marca.nombre}</span>}
        </span>
      ),
    },
    { key: "precioVenta", header: "Precio venta", align: "right", sortValue: (r) => Number(r.precioVenta), cell: (r) => quetzales(r.precioVenta) },
    ...(esAdministrador
      ? ([
          {
            key: "precioCosto",
            header: "Precio costo",
            align: "right",
            sortValue: (r) => (r.precioCosto !== undefined ? Number(r.precioCosto) : null),
            cell: (r) => (r.precioCosto !== undefined ? quetzales(r.precioCosto) : "—"),
          },
          { key: "proveedor", header: "Proveedor", sortValue: (r) => r.proveedor?.nombre, cell: (r) => r.proveedor?.nombre ?? "—" },
        ] as Column<Repuesto>[])
      : []),
    {
      key: "stock",
      header: "Stock",
      sortValue: (r) => r.cantidadInventario,
      cell: (r) => <StockBadge cantidad={r.cantidadInventario} minimo={r.inventarioMinimo} estado={r.estadoStock} />,
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Repuestos"
        actions={
          <>
            <MoreMenu
              items={[
                ...(esAdministrador ? [{ label: "Carga masiva (Excel)", icon: "upload" as const, onSelect: () => setMostrarCargaMasiva(true) }] : []),
                {
                  label: densidad === "compact" ? "Filas cómodas" : "Filas compactas",
                  icon: densidad === "compact" ? ("rows" as const) : ("rowsCompact" as const),
                  onSelect: () => setDensidad(densidad === "compact" ? "comfortable" : "compact"),
                },
              ]}
            />
            {esAdministrador && (
              <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>
                Nuevo repuesto
              </Button>
            )}
          </>
        }
      />

      <TableToolbar
        searchLabel="Buscar en el catálogo"
        searchPlaceholder="Buscar por SKU o nombre..."
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        filters={
          <>
            <FilterSelect label="Estado" value={filtroEstado ?? ""} onChange={(v) => handleCambiarFiltro(() => setFiltroEstado((v || undefined) as FiltrosRepuestos["estado"]))}>
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </FilterSelect>
            <FilterSelect label="Categoría" value={filtroCategoria ? String(filtroCategoria) : ""} onChange={(v) => handleCambiarFiltro(() => setFiltroCategoria(v ? Number(v) : undefined))}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.idCategoria} value={c.idCategoria}>
                  {c.descripcion}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Marca" value={filtroMarca ? String(filtroMarca) : ""} onChange={(v) => handleCambiarFiltro(() => setFiltroMarca(v ? Number(v) : undefined))}>
              <option value="">Todas</option>
              {marcas.map((m) => (
                <option key={m.idMarca} value={m.idMarca}>
                  {m.nombre}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Modelo compatible" value={filtroModelo ? String(filtroModelo) : ""} onChange={(v) => handleCambiarFiltro(() => setFiltroModelo(v ? Number(v) : undefined))}>
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m.idModelo} value={m.idModelo}>
                  {m.descripcion}
                </option>
              ))}
            </FilterSelect>
          </>
        }
        activeFilterCount={[filtroEstado, filtroCategoria, filtroMarca, filtroModelo].filter(Boolean).length}
      />

      <FilterChips chips={chips} onClear={limpiarFiltros} />

      <BulkBar count={seleccion.size} onClear={() => setSeleccion(new Set())}>
        <Button variant="secondary" size="sm" icon="download" onClick={exportarSeleccion}>
          Exportar selección (CSV)
        </Button>
      </BulkBar>

      {error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={cargarRepuestos}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      <Card padded={false} className="table-card">
        <div className="table-card-head">
          <h2>
            {paginacion.total} repuesto{paginacion.total === 1 ? "" : "s"}
          </h2>
        </div>
        <DataTable
          caption="Catálogo de repuestos"
          columns={columnas}
          rows={repuestos}
          rowKey={(r) => r.sku}
          loading={cargando}
          density={densidad}
          selectable
          selected={seleccion}
          onSelectedChange={setSeleccion}
          rowLabel={(r) => r.nombre}
          empty={
            error ? null : hayFiltros ? (
              <EmptyState
                icon="search"
                title="No hay repuestos que coincidan con los filtros."
                description="Prueba con otro término o quita algún filtro."
                action={<Button variant="secondary" onClick={limpiarFiltros}>Limpiar filtros</Button>}
              />
            ) : (
              <EmptyState
                icon="package"
                title="Todavía no hay repuestos registrados en el catálogo."
                description={esAdministrador ? "Agrega el primero o importa tu catálogo completo desde Excel." : "Cuando el administrador cargue el catálogo, aparecerá aquí."}
                action={
                  esAdministrador ? (
                    <div className="row">
                      <Button icon="plus" onClick={() => setModal({ modo: "crear" })}>
                        Nuevo repuesto
                      </Button>
                      <Button variant="secondary" icon="upload" onClick={() => setMostrarCargaMasiva(true)}>
                        Carga masiva
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            )
          }
          rowActions={
            esAdministrador
              ? (fila) => (
                  <>
                    <IconButton icon="edit" label="Editar" size="sm" onClick={() => setModal({ modo: "editar", repuesto: fila })} />
                    <IconButton
                      icon={fila.estado ? "power" : "undo"}
                      label={fila.estado ? "Dar de baja" : "Activar"}
                      size="sm"
                      variant={fila.estado ? "danger-ghost" : "ghost"}
                      onClick={() => setConfirmacion({ repuesto: fila, accion: "estado" })}
                    />
                    {!fila.estado && (
                      <IconButton icon="trash" label="Eliminar" size="sm" variant="danger-ghost" onClick={() => setConfirmacion({ repuesto: fila, accion: "eliminar" })} />
                    )}
                  </>
                )
              : undefined
          }
        />
        <PaginationControls paginacion={paginacion} onCambiarPagina={setPagina} />
      </Card>

      {modal && (
        <RepuestoFormModal repuesto={modal.modo === "editar" ? modal.repuesto : null} onClose={() => setModal(null)} onGuardado={handleGuardado} />
      )}

      {mostrarCargaMasiva && (
        <CargaMasivaRepuestosModal
          onClose={() => setMostrarCargaMasiva(false)}
          onCargaCompleta={() => {
            // El modal se queda abierto mostrando el resumen (T-048); solo se
            // refresca el listado detrás.
            cargarRepuestos();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmacion?.accion === "estado"}
        title={confirmacion?.repuesto.estado ? "¿Dar de baja este repuesto?" : "¿Reactivar este repuesto?"}
        description={
          confirmacion?.repuesto.estado
            ? `"${confirmacion.repuesto.nombre}" dejará de estar disponible para ventas y compras. Su historial se conserva y puedes reactivarlo cuando quieras.`
            : `"${confirmacion?.repuesto.nombre}" volverá a estar disponible en el catálogo activo.`
        }
        confirmLabel={confirmacion?.repuesto.estado ? "Dar de baja" : "Reactivar"}
        tone={confirmacion?.repuesto.estado ? "danger" : "primary"}
        loading={enProceso}
        onConfirm={() => confirmacion && handleCambiarEstado(confirmacion.repuesto)}
        onCancel={() => setConfirmacion(null)}
      />
      <ConfirmDialog
        open={confirmacion?.accion === "eliminar"}
        title="¿Eliminar definitivamente?"
        description={`Se borrará "${confirmacion?.repuesto.nombre}" del sistema. Esta acción no se puede deshacer y solo se permite si no tiene compras, ventas ni modelos asociados.`}
        confirmLabel="Eliminar"
        loading={enProceso}
        onConfirm={() => confirmacion && handleEliminar(confirmacion.repuesto)}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
