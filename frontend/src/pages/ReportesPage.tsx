import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReporteFiltros } from "@/components/reportes/ReporteFiltros";
import { ReporteVistaPrevia } from "@/components/reportes/ReporteVistaPrevia";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { descargarReportes, guardarArchivo, listarReportes, obtenerVistaPrevia, ReporteApiError } from "@/services/reporteService";
import { filtrosPorDefecto } from "@/utils/reportes";
import type { DefinicionReporte, FiltrosReporte, FormatoReporte, Reporte } from "@/types/reporte";

const FORMATOS: { id: FormatoReporte; etiqueta: string; ayuda: string }[] = [
  { id: "pdf", etiqueta: "PDF", ayuda: "Para imprimir o compartir" },
  { id: "xlsx", etiqueta: "Excel", ayuda: "Para analizar y filtrar" },
  { id: "csv", etiqueta: "CSV", ayuda: "Datos simples" },
];

const DEBOUNCE_MS = 350;

function mensajeDe(err: unknown, respaldo: string): string {
  return err instanceof ReporteApiError || err instanceof Error ? err.message || respaldo : respaldo;
}

// Panel de reportes: galería con descripción y selección múltiple, filtros
// propios por reporte, vista previa (KPIs + gráfica + tabla) y descarga en
// PDF/Excel/CSV. El filtrado por rol vive en la API (el catálogo y cada
// reporte ya llegan recortados); aquí solo se pinta lo recibido.
export default function ReportesPage() {
  const { usuario } = useAuth();
  const toast = useToast();
  const esAdmin = usuario?.role === "Administrador";
  const catalogo = useAsync(listarReportes, [], "No se pudo cargar el catálogo de reportes");
  const defs = useMemo(() => catalogo.data ?? [], [catalogo.data]);

  const [activoId, setActivoId] = useState<string | null>(null);
  const [filtrosPorId, setFiltrosPorId] = useState<Record<string, FiltrosReporte>>({});
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [formatoMulti, setFormatoMulti] = useState<FormatoReporte>("pdf");

  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const activo = defs.find((d) => d.id === activoId) ?? null;

  // El primer reporte se abre solo cuando llega el catálogo.
  useEffect(() => {
    if (activoId === null && defs.length > 0) setActivoId(defs[0].id);
  }, [defs, activoId]);

  const filtrosDe = useCallback(
    (def: DefinicionReporte): FiltrosReporte => filtrosPorId[def.id] ?? filtrosPorDefecto(def.filtros),
    [filtrosPorId],
  );

  const filtrosActivos = activo ? filtrosDe(activo) : null;
  const clave = filtrosActivos ? JSON.stringify(filtrosActivos) : "";
  const rangoInvalido = !!filtrosActivos?.fechaDesde && !!filtrosActivos?.fechaHasta && filtrosActivos.fechaDesde > filtrosActivos.fechaHasta;
  const [version, setVersion] = useState(0);
  // Reporte "Conteo físico": sin conteo elegido no hay nada que mostrar ni descargar.
  const faltaConteo = !!activo?.filtros.includes("idConteo") && !filtrosActivos?.idConteo;

  // Vista previa con debounce; cancela la petición anterior al cambiar filtros.
  const idActivo = activo?.id ?? null;
  const filtrosRef = useRef(filtrosActivos);
  filtrosRef.current = filtrosActivos;
  useEffect(() => {
    if (!idActivo || rangoInvalido || faltaConteo) {
      setCargandoVista(false);
      return undefined;
    }
    const control = new AbortController();
    setCargandoVista(true);
    setErrorVista(null);
    const t = setTimeout(() => {
      obtenerVistaPrevia(idActivo, filtrosRef.current ?? {}, control.signal)
        .then((r) => {
          setReporte(r);
          setCargandoVista(false);
        })
        .catch((err: unknown) => {
          if (control.signal.aborted) return;
          setErrorVista(mensajeDe(err, "No se pudo generar la vista previa"));
          setReporte(null);
          setCargandoVista(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [idActivo, clave, rangoInvalido, faltaConteo, version]);

  function cambiarFiltros(def: DefinicionReporte, cambio: FiltrosReporte) {
    setFiltrosPorId((prev) => ({ ...prev, [def.id]: { ...(prev[def.id] ?? filtrosPorDefecto(def.filtros)), ...cambio } }));
  }

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  async function descargar(formato: FormatoReporte, lista: DefinicionReporte[], etiqueta: string) {
    if (lista.length === 0 || descargando) return;
    setDescargando(etiqueta);
    setAnuncio(lista.length === 1 ? `Generando ${lista[0].titulo}…` : `Generando ${lista.length} reportes…`);
    try {
      const archivo = await descargarReportes(
        formato,
        lista.map((d) => ({ tipo: d.id, filtros: filtrosDe(d) })),
      );
      guardarArchivo(archivo);
      toast.success(`Reporte listo: ${archivo.nombre}`);
      setAnuncio(`Descarga lista: ${archivo.nombre}`);
    } catch (err) {
      const mensaje = mensajeDe(err, "No se pudo generar el reporte");
      toast.error(mensaje);
      setAnuncio(`Error: ${mensaje}`);
    } finally {
      setDescargando(null);
    }
  }

  const seleccionados = defs.filter((d) => seleccion.has(d.id));
  const todosMarcados = defs.length > 0 && seleccionados.length === defs.length;

  return (
    <div className="page-stack rep-page">
      <PageHeader title="Reportes" />

      {/* Anuncios para lectores de pantalla durante la generación. */}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      {catalogo.error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={catalogo.recargar}>Reintentar</Button>}>
          {catalogo.error}
        </Alert>
      )}

      {catalogo.cargando && !catalogo.data ? (
        <div className="rep-lista" aria-busy="true">
          <span className="sr-only">Cargando reportes...</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height="3.5rem" />
          ))}
        </div>
      ) : (
        defs.length > 0 && (
          <div className="rep-layout">
            <section aria-labelledby="rep-galeria-titulo" className="rep-lista-col">
              <div className="rep-galeria-cabecera">
                <h2 id="rep-galeria-titulo" className="rep-subtitulo">
                  Elige un reporte
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSeleccion(todosMarcados ? new Set() : new Set(defs.map((d) => d.id)))}>
                  {todosMarcados ? "Quitar selección" : "Seleccionar todos"}
                </Button>
              </div>

              <ul className="rep-lista">
                {defs.map((d) => {
                  const esActivo = d.id === activoId;
                  const marcado = seleccion.has(d.id);
                  return (
                    <li key={d.id}>
                      <div className={`rep-item${esActivo ? " rep-item--activo" : ""}`}>
                        <label className="rep-item-check">
                          <input type="checkbox" checked={marcado} onChange={() => alternarSeleccion(d.id)} />
                          <span className="sr-only">Seleccionar {d.titulo} para descargar</span>
                        </label>
                        <div className="rep-item-body">
                          <button type="button" className="rep-item-ver" aria-pressed={esActivo} onClick={() => setActivoId(d.id)}>
                            {d.titulo}
                          </button>
                          <p className="rep-item-desc">{d.descripcion}</p>
                          {d.soloAdministrador && <p className="rep-item-meta">Solo administrador</p>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {seleccionados.length > 0 && (
                <div className="rep-seleccion" role="group" aria-label="Descarga de reportes seleccionados">
                  <p className="rep-seleccion-texto" aria-live="polite">
                    {seleccionados.length} reporte{seleccionados.length === 1 ? "" : "s"} seleccionado{seleccionados.length === 1 ? "" : "s"}
                  </p>
                  <div className="segmented" role="group" aria-label="Formato de descarga">
                    {FORMATOS.map((f) => (
                      <button key={f.id} type="button" className="segmented-btn" aria-pressed={formatoMulti === f.id} onClick={() => setFormatoMulti(f.id)}>
                        {f.etiqueta}
                      </button>
                    ))}
                  </div>
                  <Button
                    icon="download"
                    loading={descargando === "multi"}
                    disabled={descargando !== null && descargando !== "multi"}
                    onClick={() => descargar(formatoMulti, seleccionados, "multi")}
                  >
                    Descargar seleccionados
                  </Button>
                  {formatoMulti === "csv" && seleccionados.length > 1 && (
                    <p className="rep-seleccion-ayuda">Con varios reportes, el CSV se entrega en un ZIP con un archivo por reporte.</p>
                  )}
                  {formatoMulti !== "csv" && seleccionados.length > 1 && (
                    <p className="rep-seleccion-ayuda">
                      {formatoMulti === "pdf" ? "Se genera un solo PDF con todos los reportes." : "Se genera un solo libro de Excel con una hoja por reporte."}
                    </p>
                  )}
                </div>
              )}
            </section>

          {activo && filtrosActivos && (
            <Card
              as="section"
              className="rep-detalle"
              aria-labelledby="rep-detalle-titulo"
              title={<span id="rep-detalle-titulo">{activo.titulo}</span>}
              description={activo.descripcion}
              actions={
                <div className="rep-descargas" role="group" aria-label={`Descargar ${activo.titulo}`}>
                  {FORMATOS.map((f) => (
                    <Button
                      key={f.id}
                      variant={f.id === "pdf" ? "primary" : "secondary"}
                      size="sm"
                      icon="download"
                      title={f.ayuda}
                      loading={descargando === `${activo.id}:${f.id}`}
                      disabled={rangoInvalido || faltaConteo || (descargando !== null && descargando !== `${activo.id}:${f.id}`)}
                      onClick={() => descargar(f.id, [activo], `${activo.id}:${f.id}`)}
                    >
                      {f.etiqueta}
                    </Button>
                  ))}
                </div>
              }
            >
              <ReporteFiltros disponibles={activo.filtros} filtros={filtrosActivos} esAdmin={esAdmin} onChange={(c) => cambiarFiltros(activo, c)} />

              <div className="rep-vista" aria-live="polite" aria-busy={cargandoVista}>
                {errorVista ? (
                  <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => setVersion((v) => v + 1)}>Reintentar</Button>}>
                    {errorVista}
                  </Alert>
                ) : rangoInvalido ? (
                  <Alert tone="warning">Corrige el rango de fechas para ver la vista previa.</Alert>
                ) : faltaConteo ? (
                  <EmptyState
                    icon="clipboard"
                    title="Elige un conteo para ver el reporte"
                    description="Los conteos se crean en Gestión > Conteo físico."
                  />
                ) : cargandoVista && (!reporte || reporte.id !== activo.id) ? (
                  <div className="rep-vista-carga">
                    <span className="sr-only">Generando vista previa...</span>
                    <div className="rep-kpis">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} height="6.5rem" />
                      ))}
                    </div>
                    <Skeleton height="12rem" />
                    <Skeleton height="14rem" />
                  </div>
                ) : reporte && reporte.id === activo.id ? (
                  <div className={cargandoVista ? "rep-vista-actualizando" : undefined}>
                    <ReporteVistaPrevia reporte={reporte} />
                  </div>
                ) : null}
              </div>
            </Card>
          )}
          </div>
        )
      )}

      {!catalogo.cargando && !catalogo.error && defs.length === 0 && (
        <Card>
          <EmptyState icon="barChart" title="No hay reportes disponibles para tu rol" description="Consulta con el administrador si necesitas acceso." />
        </Card>
      )}


      <p className="muted rep-nota-legal">Documento operativo: no constituye documento tributario.</p>
    </div>
  );
}
