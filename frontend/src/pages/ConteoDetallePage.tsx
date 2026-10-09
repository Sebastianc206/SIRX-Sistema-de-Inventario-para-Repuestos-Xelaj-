import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConteoCaptura } from "@/components/ConteoCaptura";
import type { ConteoCapturaHandle } from "@/components/ConteoCaptura";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { KpiCard } from "@/components/ui/KpiCard";
import { MoreMenu } from "@/components/ui/MoreMenu";
import type { MoreMenuItem } from "@/components/ui/MoreMenu";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import {
  cancelarConteo,
  cerrarConteo,
  ConteoApiError,
  eliminarConteo,
  guardarLineasConteo,
  obtenerConteo,
  quitarLineaConteo,
} from "@/services/conteoService";
import { descargarReportes, guardarArchivo } from "@/services/reporteService";
import type { Repuesto } from "@/types/repuesto";
import type { Conteo, LineaConteo } from "@/types/conteo";
import type { FormatoReporte } from "@/types/reporte";
import {
  ETIQUETA_ESTADO,
  TONO_ESTADO,
  TONO_NIVEL,
  calcularResumenLocal,
  clasificarDiferencia,
  fechaConteo,
  pct,
  redondear2,
  textoDiferencia,
} from "@/utils/conteo";
import { quetzales } from "@/utils/formato";

const MAX_CANTIDAD = 1_000_000;
const AUTOGUARDADO_MS = 600;

type EstadoGuardado = "ok" | "pendiente" | "guardando" | "error";
type Dialogo = "aplicar" | "cerrar" | "cancelar" | "eliminar" | null;

const TEXTO_GUARDADO: Record<EstadoGuardado, string> = {
  ok: "Guardado",
  pendiente: "Cambios sin guardar...",
  guardando: "Guardando...",
  error: "No se pudo guardar",
};

function conCantidad(l: LineaConteo, contada: number): LineaConteo {
  const diferencia = contada - l.cantidadSistema;
  return {
    ...l,
    cantidadContada: contada,
    diferencia,
    nivel: clasificarDiferencia(diferencia, l.cantidadSistema),
    valorDiferencia: redondear2(diferencia * l.costoUnitario),
  };
}

function lineaNueva(r: Repuesto): LineaConteo {
  return conCantidad(
    {
      sku: r.sku,
      nombre: r.nombre,
      cantidadSistema: r.cantidadInventario,
      cantidadContada: 0,
      diferencia: 0,
      nivel: "exacto",
      costoUnitario: r.precioCosto ?? 0,
      valorDiferencia: 0,
      stockActual: r.cantidadInventario,
      cambioDesdeConteo: false,
      ajusteAplicado: null,
      cantidadAntes: null,
      cantidadDespues: null,
    },
    1,
  );
}

function mensajeDe(err: unknown, respaldo: string): string {
  return err instanceof Error && err.message ? err.message : respaldo;
}

interface CantidadInputProps {
  sku: string;
  valor: number;
  onCambio: (n: number) => void;
  onEnter: () => void;
}

// Cantidad contada editable. Acepta solo enteros >= 0; mientras se escribe
// algo inválido (vacío, negativo, decimal) no se envía nada y al salir del
// campo vuelve al último valor válido.
function CantidadInput({ sku, valor, onCambio, onEnter }: CantidadInputProps) {
  const [texto, setTexto] = useState(String(valor));
  const enfocado = useRef(false);

  useEffect(() => {
    if (!enfocado.current) setTexto(String(valor));
  }, [valor]);

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_CANTIDAD}
      step={1}
      className="input conteo-cantidad tabular"
      aria-label={`Cantidad contada de ${sku}`}
      value={texto}
      onFocus={(e) => {
        enfocado.current = true;
        e.target.select();
      }}
      onBlur={() => {
        enfocado.current = false;
        setTexto(String(valor));
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_CANTIDAD) onCambio(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

// Detalle y captura de un conteo físico (solo Administrador). En borrador: se
// escanea/busca cada SKU (Enter agrega o suma 1), se edita la cantidad
// contada y todo se guarda solo (autoguardado). Al cerrar se puede aplicar
// el ajuste que corrige Inventario. Reglas: backend/src/services/conteoService.js.
export default function ConteoDetallePage() {
  const { id } = useParams();
  const idConteo = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const captura = useRef<ConteoCapturaHandle>(null);

  const [conteo, setConteo] = useState<Conteo | null>(null);
  const [lineas, setLineas] = useState<LineaConteo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>("ok");
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const lineasRef = useRef<LineaConteo[]>([]);
  const pendientes = useRef(new Map<string, number>());
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const cadena = useRef<Promise<void>>(Promise.resolve());

  const fijarLineas = useCallback((siguiente: LineaConteo[]) => {
    lineasRef.current = siguiente;
    setLineas(siguiente);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const c = await obtenerConteo(idConteo);
      setConteo(c);
      fijarLineas(c.lineas);
      pendientes.current.clear();
      setGuardado("ok");
    } catch (err) {
      setError(mensajeDe(err, "No se pudo cargar el conteo"));
    } finally {
      setCargando(false);
    }
  }, [idConteo, fijarLineas]);

  useEffect(() => {
    if (!Number.isInteger(idConteo) || idConteo < 1) {
      setError("El conteo indicado no es válido");
      setCargando(false);
      return;
    }
    void cargar();
  }, [idConteo, cargar]);

  // Guarda en el servidor los cambios pendientes (en orden, de uno en uno).
  const vaciar = useCallback((): Promise<void> => {
    clearTimeout(temporizador.current);
    cadena.current = cadena.current.then(async () => {
      if (pendientes.current.size === 0) return;
      const lote = Array.from(pendientes.current, ([sku, cantidad]) => ({ sku, cantidad }));
      pendientes.current.clear();
      setGuardado("guardando");
      try {
        const c = await guardarLineasConteo(idConteo, lote);
        const delServidor = new Set(c.lineas.map((l) => l.sku));
        const nuevasLocales = lineasRef.current.filter((l) => pendientes.current.has(l.sku) && !delServidor.has(l.sku));
        const fusion = c.lineas.map((l) => {
          const p = pendientes.current.get(l.sku);
          return p === undefined ? l : conCantidad(l, p);
        });
        setConteo(c);
        fijarLineas([...nuevasLocales, ...fusion]);
        setGuardado(pendientes.current.size > 0 ? "pendiente" : "ok");
      } catch (err) {
        const definitivo = err instanceof ConteoApiError && err.status >= 400 && err.status < 500;
        if (definitivo) {
          // El servidor rechazó el lote (producto no válido, conteo ya cerrado...):
          // se vuelve a la versión guardada para no quedar con datos fantasma.
          toast.error(mensajeDe(err, "No se pudo guardar el conteo"));
          await cargar();
        } else {
          for (const l of lote) if (!pendientes.current.has(l.sku)) pendientes.current.set(l.sku, l.cantidad);
          setGuardado("error");
          toast.error("No se pudo guardar. Tus cantidades siguen en pantalla; reintenta.");
        }
      }
    });
    return cadena.current;
  }, [idConteo, fijarLineas, cargar, toast]);

  function programar() {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void vaciar(), AUTOGUARDADO_MS);
  }

  // Al salir de la pantalla se intenta guardar lo pendiente.
  useEffect(() => {
    const mapa = pendientes.current;
    return () => {
      clearTimeout(temporizador.current);
      if (mapa.size > 0) void vaciar();
    };
  }, [vaciar]);

  useEffect(() => {
    if (guardado === "ok") return undefined;
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [guardado]);

  function cambiarCantidad(sku: string, cantidad: number) {
    fijarLineas(lineasRef.current.map((l) => (l.sku === sku ? conCantidad(l, cantidad) : l)));
    pendientes.current.set(sku, cantidad);
    setGuardado("pendiente");
    programar();
  }

  // Escanear/agregar: producto nuevo = 1 unidad; ya contado = suma 1 y sube al inicio.
  function agregar(r: Repuesto) {
    const actual = lineasRef.current.find((l) => l.sku === r.sku);
    const resto = lineasRef.current.filter((l) => l.sku !== r.sku);
    const linea = actual ? conCantidad(actual, actual.cantidadContada + 1) : lineaNueva(r);
    fijarLineas([linea, ...resto]);
    pendientes.current.set(r.sku, linea.cantidadContada);
    setGuardado("pendiente");
    programar();
  }

  async function quitar(l: LineaConteo) {
    pendientes.current.delete(l.sku);
    fijarLineas(lineasRef.current.filter((x) => x.sku !== l.sku));
    await vaciar();
    try {
      const c = await quitarLineaConteo(idConteo, l.sku);
      setConteo(c);
    } catch (err) {
      // Si la línea nunca llegó al servidor (404) basta con haberla quitado de pantalla.
      if (!(err instanceof ConteoApiError && err.status === 404)) {
        toast.error(mensajeDe(err, "No se pudo quitar el producto"));
        await cargar();
      }
    }
    captura.current?.enfocar();
  }

  async function prepararDialogo(tipo: Exclude<Dialogo, null>) {
    await vaciar();
    if (pendientes.current.size > 0) {
      toast.error("Hay cantidades sin guardar. Reintenta el guardado antes de continuar.");
      return;
    }
    setDialogo(tipo);
  }

  async function ejecutarCierre(aplicar: boolean) {
    if (!conteo) return;
    setTrabajando(true);
    try {
      const c = await cerrarConteo(idConteo, aplicar, aplicar && conteo.cambiosDesdeConteo > 0);
      setConteo(c);
      fijarLineas(c.lineas);
      setDialogo(null);
      toast.success(aplicar ? "Conteo aplicado: el inventario quedó corregido." : "Conteo cerrado. El inventario no se modificó.");
    } catch (err) {
      setDialogo(null);
      toast.error(mensajeDe(err, "No se pudo cerrar el conteo"));
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  async function ejecutarCancelacion() {
    setTrabajando(true);
    try {
      const c = await cancelarConteo(idConteo);
      setConteo(c);
      fijarLineas(c.lineas);
      setDialogo(null);
      toast.success("Conteo cancelado. El inventario no se modificó.");
    } catch (err) {
      setDialogo(null);
      toast.error(mensajeDe(err, "No se pudo cancelar el conteo"));
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  async function ejecutarEliminacion() {
    setTrabajando(true);
    try {
      await eliminarConteo(idConteo);
      toast.success("Conteo eliminado.");
      navigate("/conteos");
    } catch (err) {
      setDialogo(null);
      toast.error(mensajeDe(err, "No se pudo eliminar el conteo"));
    } finally {
      setTrabajando(false);
    }
  }

  async function descargar(formato: FormatoReporte) {
    if (descargando) return;
    setDescargando(true);
    try {
      if (conteo?.estado === "borrador") await vaciar();
      const archivo = await descargarReportes(formato, [{ tipo: "conteo-fisico", filtros: { idConteo: String(idConteo) } }]);
      guardarArchivo(archivo);
      toast.success(`Reporte listo: ${archivo.nombre}`);
    } catch (err) {
      toast.error(mensajeDe(err, "No se pudo generar el reporte"));
    } finally {
      setDescargando(false);
    }
  }

  const esBorrador = conteo?.estado === "borrador";
  const resumen = useMemo(() => (esBorrador ? calcularResumenLocal(lineas) : conteo?.resumen), [esBorrador, lineas, conteo]);
  const conCambioDeStock = useMemo(() => (esBorrador ? lineas.filter((l) => l.cambioDesdeConteo && l.diferencia !== 0).length : 0), [esBorrador, lineas]);
  const visibles = soloDiferencias ? lineas.filter((l) => l.diferencia !== 0) : lineas;
  const sinContar = conteo ? Math.max(0, conteo.alcance.productosEnAlcance - lineas.length) : 0;

  const columnas: Column<LineaConteo>[] = [
    {
      key: "producto",
      header: "Producto",
      primary: true,
      sortValue: (l) => l.sku,
      cell: (l) => (
        <div>
          <strong>{l.sku}</strong>
          <div className="muted conteo-sub">{l.nombre}</div>
        </div>
      ),
    },
    {
      key: "sistema",
      header: "Sistema",
      align: "right",
      sortValue: (l) => l.cantidadSistema,
      cell: (l) => (
        <div className="tabular">
          {l.cantidadSistema}
          {esBorrador && l.cambioDesdeConteo && <div className="conteo-sub conteo-cambio">ahora {l.stockActual}</div>}
        </div>
      ),
    },
    {
      key: "contado",
      header: "Contado",
      align: "right",
      sortValue: (l) => l.cantidadContada,
      cell: (l) =>
        esBorrador ? (
          <CantidadInput sku={l.sku} valor={l.cantidadContada} onCambio={(n) => cambiarCantidad(l.sku, n)} onEnter={() => captura.current?.enfocar()} />
        ) : (
          <span className="tabular">{l.cantidadContada}</span>
        ),
    },
    {
      key: "diferencia",
      header: "Diferencia",
      sortValue: (l) => Math.abs(l.diferencia),
      cell: (l) => (
        <div>
          <Badge tone={TONO_NIVEL[l.nivel]}>{textoDiferencia(l.diferencia)}</Badge>
          {l.diferencia !== 0 && <div className="muted conteo-sub tabular">{quetzales(l.valorDiferencia)} a costo</div>}
        </div>
      ),
    },
  ];
  if (conteo?.estado === "aplicado") {
    columnas.push({
      key: "ajuste",
      header: "Inventario (antes → después)",
      cell: (l) =>
        l.ajusteAplicado === null || l.ajusteAplicado === 0 ? (
          <span className="muted">Sin cambio</span>
        ) : (
          <span className="tabular">
            {l.cantidadAntes} {"→"} <strong>{l.cantidadDespues}</strong>
          </span>
        ),
    });
  }

  if (cargando && !conteo) {
    return (
      <div className="page-stack" aria-busy="true">
        <span className="sr-only">Cargando conteo...</span>
        <Skeleton width="16rem" height="2rem" />
        <Skeleton height="6rem" />
        <Skeleton height="14rem" />
      </div>
    );
  }

  if (error || !conteo || !resumen) {
    return (
      <div className="page-stack">
        <Link to="/conteos" className="conteo-volver">
          <Icon name="arrowLeft" size={16} /> Conteos
        </Link>
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void cargar()}>Reintentar</Button>}>
          {error ?? "No se pudo cargar el conteo"}
        </Alert>
      </div>
    );
  }

  const alcanceTexto = conteo.categoria ? conteo.categoria.descripcion : "Todo el catálogo";
  const itemsReporte: MoreMenuItem[] = [
    { label: "Descargar reporte en Excel", icon: "download", onSelect: () => void descargar("xlsx") },
    { label: "Descargar reporte en CSV", icon: "download", onSelect: () => void descargar("csv") },
  ];
  const menu: MoreMenuItem[] =
    conteo.estado === "borrador"
      ? [
          { label: "Descargar reporte en PDF", icon: "download", onSelect: () => void descargar("pdf") },
          ...itemsReporte,
          { label: "Cerrar sin corregir el inventario", icon: "check", onSelect: () => void prepararDialogo("cerrar"), disabled: lineas.length === 0 },
          { label: "Cancelar conteo", icon: "x", danger: true, onSelect: () => setDialogo("cancelar") },
        ]
      : conteo.estado === "cancelado"
        ? [{ label: "Eliminar conteo", icon: "trash", danger: true, onSelect: () => setDialogo("eliminar") }]
        : itemsReporte;

  const accion =
    conteo.estado === "borrador" ? (
      <Button icon="check" disabled={lineas.length === 0 || guardado === "guardando"} onClick={() => void prepararDialogo("aplicar")}>
        Cerrar y aplicar ajustes
      </Button>
    ) : conteo.estado === "cancelado" ? null : (
      <Button icon="download" loading={descargando} onClick={() => void descargar("pdf")}>
        Descargar reporte
      </Button>
    );

  const unidadesCorregir = resumen.unidadesSobrantes + resumen.unidadesFaltantes;

  return (
    <div className="page-stack conteo-page">
      <Link to="/conteos" className="conteo-volver">
        <Icon name="arrowLeft" size={16} /> Conteos
      </Link>

      <PageHeader
        title={conteo.nombre}
        description={`${alcanceTexto} · ${fechaConteo(conteo.fechaConteo)}${conteo.creador ? ` · creado por ${conteo.creador.nombreCompleto}` : ""}`}
        actions={
          <>
            {accion}
            <MoreMenu items={menu} />
          </>
        }
      />

      <div className="conteo-meta">
        <Badge tone={TONO_ESTADO[conteo.estado]}>{ETIQUETA_ESTADO[conteo.estado]}</Badge>
        {conteo.fechaCierre && conteo.estado !== "borrador" && (
          <span className="muted">
            {conteo.estado === "cancelado" ? "Cancelado" : "Cerrado"} el {fechaConteo(conteo.fechaCierre)}
            {conteo.cierre ? ` por ${conteo.cierre.nombreCompleto}` : ""}
          </span>
        )}
      </div>

      <div className="kpi-grid" aria-label="Resumen del conteo">
        <KpiCard
          label="Exactitud"
          valor={pct(resumen.exactitudPct)}
          nota={resumen.productosContados > 0 ? `${resumen.productosExactos} de ${resumen.productosContados} productos sin diferencia` : "Aún no hay productos contados"}
        />
        <KpiCard
          label="Diferencia agregada"
          valor={pct(resumen.diferenciaPct)}
          tono={resumen.cumpleMeta === false ? "peligro" : "normal"}
          nota={
            resumen.cumpleMeta === null
              ? `Meta: ${resumen.metaPct} % o menos`
              : resumen.cumpleMeta
                ? `Cumple la meta (${resumen.metaPct} % o menos)`
                : `No cumple la meta (${resumen.metaPct} % o menos)`
          }
        />
        <KpiCard label="Unidades con diferencia" valor={String(unidadesCorregir)} nota={`${resumen.unidadesFaltantes} faltan · ${resumen.unidadesSobrantes} sobran`} />
        <KpiCard label="Valor de la diferencia" valor={quetzales(resumen.valorDiferenciaNeto)} nota={`A costo · ${quetzales(resumen.valorDiferenciaAbsoluto)} en total absoluto`} />
      </div>

      {esBorrador && conCambioDeStock > 0 && (
        <Alert tone="warning">
          {conCambioDeStock === 1 ? "1 producto cambió" : `${conCambioDeStock} productos cambiaron`} de stock desde que se contó (ventas, compras o ajustes). Al aplicar, la
          diferencia contada se suma al stock actual; las ventas posteriores no se pierden.
        </Alert>
      )}

      {esBorrador && (
        <div className="conteo-barra">
          <ConteoCaptura ref={captura} idCategoria={conteo.categoria?.idCategoria} onAgregar={agregar} />
          <div className="conteo-guardado" role="status" aria-live="polite">
            <span className={`conteo-guardado-texto conteo-guardado--${guardado}`}>{TEXTO_GUARDADO[guardado]}</span>
            {guardado === "error" && (
              <Button size="sm" variant="secondary" onClick={() => void vaciar()}>
                Reintentar
              </Button>
            )}
          </div>
        </div>
      )}

      {lineas.length > 0 && (
        <div className="conteo-tabla-cabecera">
          <div className="segmented" role="group" aria-label="Mostrar productos">
            <button type="button" className="segmented-btn" aria-pressed={!soloDiferencias} onClick={() => setSoloDiferencias(false)}>
              Todos ({lineas.length})
            </button>
            <button type="button" className="segmented-btn" aria-pressed={soloDiferencias} onClick={() => setSoloDiferencias(true)}>
              Con diferencia ({resumen.productosConDiferencia})
            </button>
          </div>
          {sinContar > 0 && (
            <p className="muted conteo-sin-contar">
              Sin contar: {sinContar} de {conteo.alcance.productosEnAlcance} productos del alcance (no cuentan para la exactitud ni se ajustan).
            </p>
          )}
        </div>
      )}

      <DataTable
        caption={`Productos del conteo ${conteo.nombre}`}
        columns={columnas}
        rows={visibles}
        rowKey={(l) => l.sku}
        rowActions={esBorrador ? (l) => <IconButton icon="trash" label={`Quitar ${l.sku}`} variant="danger-ghost" onClick={() => void quitar(l)} /> : undefined}
        empty={
          lineas.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title={esBorrador ? "Empieza escaneando un producto" : "Este conteo no tiene productos"}
              description={esBorrador ? "Escanea o escribe un SKU y pulsa Enter. Cada Enter suma una unidad; luego puedes corregir la cantidad en la tabla." : undefined}
            />
          ) : (
            <EmptyState
              icon="check"
              title="No hay productos con diferencia"
              action={
                <Button variant="secondary" onClick={() => setSoloDiferencias(false)}>
                  Ver todos
                </Button>
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={dialogo === "aplicar"}
        tone="primary"
        title="¿Cerrar el conteo y corregir el inventario?"
        description={
          <>
            {resumen.productosConDiferencia === 0
              ? "No hay diferencias que corregir: el conteo se cerrará como exacto."
              : `Se corregirá el inventario de ${resumen.productosConDiferencia} producto${resumen.productosConDiferencia === 1 ? "" : "s"}: ${resumen.unidadesSobrantes} ${resumen.unidadesSobrantes === 1 ? "unidad sobrante se sumará" : "unidades sobrantes se sumarán"} y ${resumen.unidadesFaltantes} ${resumen.unidadesFaltantes === 1 ? "faltante se restará" : "faltantes se restarán"}.`}{" "}
            El conteo quedará cerrado y no podrá reabrirse ni aplicarse de nuevo.
            {conCambioDeStock > 0 && ` Atención: ${conCambioDeStock} producto${conCambioDeStock === 1 ? "" : "s"} cambió de stock desde que se contó; se suma la diferencia contada al stock actual.`}
            {sinContar > 0 && ` ${sinContar} productos del alcance no se contaron y no se tocarán.`}
          </>
        }
        confirmLabel="Cerrar y aplicar ajustes"
        loading={trabajando}
        onConfirm={() => void ejecutarCierre(true)}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "cerrar"}
        tone="primary"
        title="¿Cerrar sin corregir el inventario?"
        description="El conteo quedará como informe de diferencias y no se modificará ninguna existencia. No podrá reabrirse ni aplicarse después."
        confirmLabel="Cerrar sin ajustar"
        loading={trabajando}
        onConfirm={() => void ejecutarCierre(false)}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "cancelar"}
        title="¿Cancelar este conteo?"
        description="Se descartan las cantidades registradas y el inventario no se modifica. Un conteo cancelado no puede retomarse."
        confirmLabel="Cancelar conteo"
        cancelLabel="Seguir contando"
        loading={trabajando}
        onConfirm={() => void ejecutarCancelacion()}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "eliminar"}
        title="¿Eliminar este conteo?"
        description="Se borra el conteo cancelado y sus cantidades. El inventario no cambia."
        confirmLabel="Eliminar"
        loading={trabajando}
        onConfirm={() => void ejecutarEliminacion()}
        onCancel={() => setDialogo(null)}
      />
    </div>
  );
}
