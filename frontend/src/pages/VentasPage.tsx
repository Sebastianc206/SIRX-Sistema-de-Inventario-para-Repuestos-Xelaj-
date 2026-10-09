import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { StockBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { FilterSelect, FilterToggle } from "@/components/ui/TableToolbar";
import { useToast } from "@/components/ui/toastContext";
import { VirtualGrid } from "@/components/ui/VirtualGrid";
import { useCatalogoPos } from "@/hooks/useCatalogoPos";
import { usePersistentState } from "@/hooks/usePersistentState";
import { listarMarcas } from "@/services/catalogosAuxiliaresService";
import { listarCategorias } from "@/services/categoriaService";
import { obtenerRepuesto } from "@/services/repuestoService";
import { crearVenta, VentaApiError } from "@/services/ventaService";
import type { Categoria } from "@/types/categoria";
import type { Marca } from "@/types/catalogosAuxiliares";
import type { Repuesto } from "@/types/repuesto";
import type { VentaFormLinea } from "@/types/movimiento";
import { quetzales } from "@/utils/formato";

// cantidad/precioVenta admiten "" mientras se edita el campo — un number
// input controlado que fuerza Number("") a 0 de inmediato no deja borrar el
// valor para escribir uno nuevo. Se coerciona a number recién al enviar.
interface LineaCarrito {
  sku: string;
  nombre: string;
  marca: string | null;
  cantidad: number | "";
  precioVenta: number | "";
  // Contexto de solo lectura (no se envía al backend).
  stock: number;
}

interface Reciente {
  sku: string;
  nombre: string;
}

const MAX_RECIENTES = 8;
const ALTO_FILA_LISTA = 56;
const SKU_REGEX = /^[A-Za-z0-9._-]+$/;

function leerRecientes(texto: string): Reciente[] {
  try {
    const datos: unknown = JSON.parse(texto);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter((d): d is Reciente => typeof d?.sku === "string" && typeof d?.nombre === "string")
      .slice(0, MAX_RECIENTES);
  } catch {
    return [];
  }
}

// HU-13: venta de mostrador con una o varias líneas — descuenta stock y
// calcula el total. Abierto a ambos roles (CLAUDE.md: "Operador: counter
// sales"). Pantalla tipo punto de venta pensada para catálogos de cientos o
// miles de repuestos: búsqueda y filtros en el servidor (con debounce),
// paginación incremental (scroll infinito), lista virtualizada (solo se
// montan las filas visibles) y atajos de teclado. El carrito queda siempre
// visible a la derecha, con su propio scroll. El contrato con la API no
// cambia: POST /api/ventas { lineas: [{ sku, cantidad, precioVenta }] }. El
// historial/reversión vive en Movimientos (solo Administrador).
export default function VentasPage() {
  const toast = useToast();
  const [consulta, setConsulta] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | undefined>(undefined);
  const [idMarca, setIdMarca] = useState<number | undefined>(undefined);
  const [soloExistencias, setSoloExistencias] = usePersistentState<boolean>("sirx_pos_solo_existencias", false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const idFiltros = useId();
  const [recientesTexto, setRecientesTexto] = usePersistentState<string>("sirx_pos_recientes", "[]");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [activo, setActivo] = useState(-1);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [ultimaVenta, setUltimaVenta] = useState<{ id: number; total: number } | null>(null);
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const inputBusqueda = useRef<HTMLInputElement>(null);
  const tituloCarrito = useRef<HTMLHeadingElement>(null);

  const { items, total: totalResultados, cargando, cargandoMas, error: errorBusqueda, cargarMas, refrescar } = useCatalogoPos({
    consulta,
    idCategoria,
    idMarca,
    soloConExistencias: soloExistencias,
  });

  const recientes = useMemo(() => leerRecientes(recientesTexto), [recientesTexto]);

  // Opciones de los filtros rápidos (catálogos pequeños, accesibles a ambos roles).
  useEffect(() => {
    let vigente = true;
    listarCategorias()
      .then((c) => vigente && setCategorias(c))
      .catch(() => {});
    listarMarcas()
      .then((m) => vigente && setMarcas(m))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  // Cualquier cambio de búsqueda/filtros reinicia la fila activa.
  useEffect(() => {
    setActivo(-1);
  }, [consulta, idCategoria, idMarca, soloExistencias]);

  // "/" enfoca la búsqueda en esta pantalla. El layout usa "/" para abrir la
  // paleta de comandos; este listener en fase de captura corre antes y corta
  // la propagación (Ctrl+K sigue abriendo la paleta).
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const escribiendo = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (escribiendo) return;
      e.preventDefault();
      e.stopPropagation();
      inputBusqueda.current?.focus();
      inputBusqueda.current?.select();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const recordarReciente = useCallback(
    (r: Reciente) => {
      const siguiente = [r, ...leerRecientes(recientesTexto).filter((x) => x.sku !== r.sku)].slice(0, MAX_RECIENTES);
      setRecientesTexto(JSON.stringify(siguiente));
    },
    [recientesTexto, setRecientesTexto],
  );

  const agregar = useCallback(
    (repuesto: Repuesto) => {
      if (repuesto.cantidadInventario <= 0) {
        toast.warning(`"${repuesto.nombre}" está agotado.`);
        return;
      }
      setUltimaVenta(null);
      setCarrito((actual) => {
        const existente = actual.find((l) => l.sku === repuesto.sku);
        if (existente) {
          const siguiente = Number(existente.cantidad || 0) + 1;
          if (siguiente > repuesto.cantidadInventario) {
            toast.warning(`Solo hay ${repuesto.cantidadInventario} en existencia de "${repuesto.nombre}".`);
            return actual;
          }
          return actual.map((l) => (l.sku === repuesto.sku ? { ...l, cantidad: siguiente } : l));
        }
        return [
          ...actual,
          {
            sku: repuesto.sku,
            nombre: repuesto.nombre,
            marca: repuesto.marca?.nombre ?? null,
            cantidad: 1,
            precioVenta: Number(repuesto.precioVenta),
            stock: repuesto.cantidadInventario,
          },
        ];
      });
      recordarReciente({ sku: repuesto.sku, nombre: repuesto.nombre });
      setAnuncio(`Agregado al carrito: ${repuesto.nombre}`);
    },
    [toast, recordarReciente],
  );

  function actualizarLinea(sku: string, cambios: Partial<LineaCarrito>) {
    setCarrito((actual) => actual.map((l) => (l.sku === sku ? { ...l, ...cambios } : l)));
  }

  function cambiarCantidad(linea: LineaCarrito, delta: number) {
    const siguiente = Math.max(1, Number(linea.cantidad || 0) + delta);
    if (siguiente > linea.stock) {
      toast.warning(`Solo hay ${linea.stock} en existencia de "${linea.nombre}".`);
      return;
    }
    actualizarLinea(linea.sku, { cantidad: siguiente });
  }

  function quitar(sku: string) {
    setCarrito((actual) => actual.filter((l) => l.sku !== sku));
    inputBusqueda.current?.focus();
  }

  // Trae un SKU puntual (detalle fresco, con existencias actuales) y lo agrega.
  async function agregarPorSku(sku: string): Promise<boolean> {
    try {
      const r = await obtenerRepuesto(sku);
      if (!r.estado) {
        toast.warning(`"${r.nombre}" está dado de baja.`);
        return false;
      }
      agregar(r);
      return true;
    } catch {
      return false;
    }
  }

  function terminarAgregado() {
    setConsulta("");
    setActivo(-1);
    inputBusqueda.current?.focus();
  }

  // Enter: agrega el resultado resaltado con flechas; si no hay, el SKU
  // exacto (aunque no esté en la página cargada) o el único resultado —
  // flujo de lector de código de barras.
  async function alEnter() {
    const termino = consulta.trim();
    if (activo >= 0 && items[activo]) {
      agregar(items[activo]);
      terminarAgregado();
      return;
    }
    if (!termino) return;
    const exacto = items.find((r) => r.sku.toLowerCase() === termino.toLowerCase());
    if (exacto) {
      agregar(exacto);
      terminarAgregado();
      return;
    }
    if (cargando) return;
    if (SKU_REGEX.test(termino) && (await agregarPorSku(termino))) {
      terminarAgregado();
      return;
    }
    if (items.length === 1) {
      agregar(items[0]);
      terminarAgregado();
    } else if (items.length > 1) {
      toast.info("Hay varios resultados: usa las flechas y Enter, o toca uno de la lista.");
    } else {
      toast.warning(`No hay ningún repuesto con el código "${termino}".`);
    }
  }

  function onKeyDownBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void alEnter();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (items.length === 0) return;
      e.preventDefault();
      setActivo((a) => {
        if (e.key === "ArrowDown") return a < 0 ? 0 : Math.min(items.length - 1, a + 1);
        return Math.max(0, a - 1);
      });
    } else if (e.key === "Home" && e.ctrlKey && items.length > 0) {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === "Escape") {
      if (consulta) {
        e.preventDefault();
        setConsulta("");
      } else {
        inputBusqueda.current?.blur();
      }
    }
  }

  const total = useMemo(() => carrito.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.precioVenta || 0), 0), [carrito]);
  const unidades = carrito.reduce((acc, l) => acc + Number(l.cantidad || 0), 0);
  const enCarrito = useMemo(() => new Map(carrito.map((l) => [l.sku, Number(l.cantidad || 0)])), [carrito]);

  async function cobrar(event?: FormEvent) {
    event?.preventDefault();
    setErrorVenta(null);

    if (carrito.length === 0) return;
    if (carrito.some((l) => l.cantidad === "" || l.precioVenta === "" || Number(l.cantidad) <= 0 || Number(l.precioVenta) <= 0)) {
      setErrorVenta("Completa cantidad y precio de venta (mayores a 0) en cada línea");
      return;
    }

    setEnviando(true);
    try {
      const lineas: VentaFormLinea[] = carrito.map((l) => ({ sku: l.sku, cantidad: Number(l.cantidad), precioVenta: Number(l.precioVenta) }));
      const venta = await crearVenta({ lineas });
      toast.success(`Venta registrada por ${quetzales(venta.montoTotalVenta)}. El stock ya se actualizó.`);
      setUltimaVenta({ id: venta.idVenta, total: Number(venta.montoTotalVenta) });
      setCarrito([]);
      setCarritoAbierto(false);
      refrescar(); // actualiza existencias en los resultados
      inputBusqueda.current?.focus();
    } catch (err) {
      setErrorVenta(err instanceof VentaApiError ? err.message : "No se pudo registrar la venta");
    } finally {
      setEnviando(false);
    }
  }

  function abrirCarrito() {
    setCarritoAbierto(true);
    setTimeout(() => tituloCarrito.current?.focus(), 0);
  }

  function limpiarFiltros() {
    setConsulta("");
    setIdCategoria(undefined);
    setIdMarca(undefined);
    setSoloExistencias(false);
  }

  const hayFiltros = Boolean(consulta || idCategoria || idMarca || soloExistencias);
  const idListado = "pos-resultados";
  const idOpcion = (sku: string) => `pos-op-${sku}`;

  const renderItem = useCallback(
    (r: Repuesto, indice: number) => {
      const agotado = r.cantidadInventario <= 0;
      const cantidadEnCarrito = enCarrito.get(r.sku);
      const esActivo = indice === activo;
      const clases = `pos-item pos-item--fila${esActivo ? " pos-item--activo" : ""}${agotado ? " pos-item--agotado" : ""}`;
      return (
        <div
          id={idOpcion(r.sku)}
          role="option"
          aria-selected={esActivo}
          aria-disabled={agotado || undefined}
          aria-label={`${r.nombre}, ${quetzales(r.precioVenta)}, ${agotado ? "agotado" : `${r.cantidadInventario} en existencia`}`}
          className={clases}
          onClick={() => {
            agregar(r);
            inputBusqueda.current?.focus();
          }}
        >
          <span className="cell-sku pos-item-sku">{r.sku}</span>
          <span className="pos-item-main">
            <span className="pos-item-name">{r.nombre}</span>
            <span className="pos-item-meta">{[r.marca?.nombre, r.categoria?.descripcion].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="pos-item-price tabular">{quetzales(r.precioVenta)}</span>
          <span className="pos-item-stock">
            <StockBadge cantidad={r.cantidadInventario} minimo={r.inventarioMinimo} estado={r.estadoStock} />
          </span>
          <span className="pos-item-qty-wrap">{cantidadEnCarrito ? <span className="pos-tile-qty">×{cantidadEnCarrito}</span> : <Icon name="plus" size={16} />}</span>
        </div>
      );
    },
    [activo, agregar, enCarrito],
  );

  const sinResultados = !cargando && items.length === 0 && !errorBusqueda;

  return (
    <div className="page-stack pos-page">
      <PageHeader title="Ventas" />

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      <div className="pos">
        <section className="pos-catalogo" aria-labelledby="pos-buscar-titulo">
          <h2 id="pos-buscar-titulo" className="sr-only">
            Buscar repuestos
          </h2>
          <div className="pos-searchrow">
            <label className="pos-search">
              <Icon name="search" size={20} />
              <input
                ref={inputBusqueda}
                type="search"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls={idListado}
                aria-activedescendant={activo >= 0 && items[activo] ? idOpcion(items[activo].sku) : undefined}
                aria-autocomplete="list"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={onKeyDownBusqueda}
                placeholder="Escanea o busca por SKU o nombre"
                aria-label="Buscar repuesto por SKU o nombre"
                autoFocus
                autoComplete="off"
              />
            </label>
            <FilterToggle
              open={filtrosAbiertos}
              onToggle={() => setFiltrosAbiertos((v) => !v)}
              count={[idCategoria, idMarca, soloExistencias].filter(Boolean).length}
              controls={idFiltros}
            />
          </div>

          <div id={idFiltros} className="pos-filtros" hidden={!filtrosAbiertos}>
            <FilterSelect label="Categoría" value={idCategoria ? String(idCategoria) : ""} onChange={(v) => setIdCategoria(v ? Number(v) : undefined)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.idCategoria} value={c.idCategoria}>
                  {c.descripcion}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Marca" value={idMarca ? String(idMarca) : ""} onChange={(v) => setIdMarca(v ? Number(v) : undefined)}>
              <option value="">Todas</option>
              {marcas.map((m) => (
                <option key={m.idMarca} value={m.idMarca}>
                  {m.nombre}
                </option>
              ))}
            </FilterSelect>
            <label className={`filter-chip pos-solo-existencias${soloExistencias ? " filter-chip--active" : ""}`}>
              <input type="checkbox" checked={soloExistencias} onChange={(e) => setSoloExistencias(e.target.checked)} />
              <span>Solo con existencias</span>
            </label>
          </div>

          {!consulta && recientes.length > 0 && (
            <div className="pos-recientes">
              <span className="pos-recientes-titulo">Recientes</span>
              <ul>
                {recientes.map((r) => (
                  <li key={r.sku}>
                    <button
                      type="button"
                      className="chip"
                      title={r.nombre}
                      onClick={async () => {
                        if (!(await agregarPorSku(r.sku))) toast.warning(`No se pudo agregar "${r.nombre}".`);
                        inputBusqueda.current?.focus();
                      }}
                    >
                      <span className="cell-sku">{r.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="helper-text pos-hint">
            <span className="pos-count" aria-live="polite">
              {cargando ? "Buscando…" : `${items.length} de ${totalResultados} resultado${totalResultados === 1 ? "" : "s"}`}
            </span>
            <span className="pos-atajos">
              <kbd>Enter</kbd> agrega
            </span>
          </p>

          {errorBusqueda && (
            <div className="alert alert--error" role="alert">
              <Icon name="alert" size={18} />
              <div className="alert-body">{errorBusqueda}</div>
              <Button size="sm" variant="secondary" onClick={refrescar}>
                Reintentar
              </Button>
            </div>
          )}

          {cargando && items.length === 0 ? (
            <div className="pos-skeletons" aria-busy="true">
              <span className="sr-only">Buscando…</span>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} height="3.5rem" />
              ))}
            </div>
          ) : sinResultados ? (
            <EmptyState
              icon="search"
              title={hayFiltros ? "Ningún repuesto coincide" : "No hay repuestos activos"}
              description={hayFiltros ? "Revisa el código, prueba con parte del nombre o quita algún filtro." : "El catálogo activo está vacío."}
              action={hayFiltros ? <Button variant="secondary" onClick={limpiarFiltros}>Limpiar búsqueda y filtros</Button> : undefined}
            />
          ) : (
            <VirtualGrid
              id={idListado}
              role="listbox"
              ariaLabel="Resultados de búsqueda"
              ariaBusy={cargando}
              className={`pos-lista${cargando ? " pos-lista--busy" : ""}`}
              items={items}
              itemKey={(r) => r.sku}
              rowHeight={ALTO_FILA_LISTA}
              gap={4}
              activeIndex={activo}
              onNearEnd={cargarMas}
              renderItem={renderItem}
              footer={
                cargandoMas || items.length < totalResultados ? (
                  <p className="pos-mas" aria-live="polite">
                    {cargandoMas ? "Cargando más…" : `Desplázate para cargar más (${items.length} de ${totalResultados})`}
                  </p>
                ) : null
              }
            />
          )}
        </section>

        <form id="pos-carrito" className={`pos-cart${carritoAbierto ? " pos-cart--open" : ""}`} onSubmit={cobrar} aria-labelledby="pos-carrito-titulo">
          <header className="pos-cart-head">
            <h2 id="pos-carrito-titulo" ref={tituloCarrito} tabIndex={-1}>
              Carrito <span className="pos-cart-count">{unidades}</span>
            </h2>
            <div className="row">
              {carrito.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmandoVaciar(true)} disabled={enviando}>
                  Vaciar
                </Button>
              )}
              <IconButton icon="x" label="Cerrar carrito" className="pos-cart-close" onClick={() => setCarritoAbierto(false)} />
            </div>
          </header>

          <div className="pos-cart-body">
            {carrito.length === 0 ? (
              ultimaVenta ? (
                <div className="pos-done" role="status">
                  <span className="pos-done-icon">
                    <Icon name="checkCircle" size={28} />
                  </span>
                  <p className="pos-done-title">Venta #{ultimaVenta.id} registrada</p>
                  <p className="pos-done-total tabular">{quetzales(ultimaVenta.total)}</p>
                  <p className="muted">El stock ya se actualizó. Puedes iniciar la siguiente venta.</p>
                </div>
              ) : (
                <EmptyState compact icon="cart" title="El carrito está vacío" description="Busca un repuesto y tócalo para agregarlo." />
              )
            ) : (
              <ul className="pos-lines">
                {carrito.map((l) => (
                  <li key={l.sku} className="pos-line">
                    <div className="pos-line-head">
                      <div>
                        <p className="pos-line-name">{l.nombre}</p>
                        <p className="cell-sku">
                          {l.sku}
                          {l.marca ? ` · ${l.marca}` : ""}
                        </p>
                      </div>
                      <IconButton icon="trash" label={`Quitar ${l.nombre}`} variant="danger-ghost" size="sm" onClick={() => quitar(l.sku)} disabled={enviando} />
                    </div>
                    <div className="pos-line-controls">
                      <div className="stepper" role="group" aria-label={`Cantidad de ${l.nombre}`}>
                        <IconButton icon="minus" label="Restar una unidad" size="sm" variant="secondary" sinTooltip onClick={() => cambiarCantidad(l, -1)} disabled={enviando || Number(l.cantidad) <= 1} />
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={l.stock}
                          step="1"
                          value={l.cantidad}
                          disabled={enviando}
                          aria-label={`Cantidad de ${l.nombre}`}
                          onChange={(e) => actualizarLinea(l.sku, { cantidad: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                        <IconButton icon="plus" label="Sumar una unidad" size="sm" variant="secondary" sinTooltip onClick={() => cambiarCantidad(l, 1)} disabled={enviando || Number(l.cantidad) >= l.stock} />
                      </div>
                      <label className="pos-price">
                        <span className="sr-only">Precio de venta de {l.nombre}</span>
                        <span aria-hidden="true">Q</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={l.precioVenta}
                          disabled={enviando}
                          onChange={(e) => actualizarLinea(l.sku, { precioVenta: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      </label>
                      <p className="pos-line-subtotal tabular">{quetzales(Number(l.cantidad || 0) * Number(l.precioVenta || 0))}</p>
                    </div>
                    {Number(l.cantidad) >= l.stock && <p className="helper-text pos-line-warn">Máximo disponible: {l.stock} u.</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="pos-cart-foot">
            {errorVenta && (
              <div className="alert alert--error" role="alert">
                <Icon name="alert" size={18} />
                <div className="alert-body">{errorVenta}</div>
              </div>
            )}
            <dl className="pos-totals">
              <div className="pos-totals-total">
                <dt>Total</dt>
                <dd className="tabular">{quetzales(total)}</dd>
              </div>
            </dl>
            <Button type="submit" size="lg" block loading={enviando} disabled={carrito.length === 0}>
              {enviando ? "Registrando..." : `Registrar venta · ${quetzales(total)}`}
            </Button>
          </footer>
        </form>
      </div>

      {/* Móvil: barra fija con el total que abre el carrito como hoja. */}
      {!carritoAbierto && carrito.length > 0 && (
        <div className="pos-bar">
          <button type="button" className="pos-bar-btn" onClick={abrirCarrito} aria-label={`Ver carrito: ${unidades} unidades, ${quetzales(total)}`}>
            <Icon name="cart" size={20} />
            <span>
              {unidades} u. · {carrito.length} línea{carrito.length === 1 ? "" : "s"}
            </span>
            <strong className="tabular">{quetzales(total)}</strong>
            <Icon name="chevronUp" size={18} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmandoVaciar}
        title="¿Vaciar el carrito?"
        description="Se quitarán todos los repuestos agregados. La venta aún no se ha registrado."
        confirmLabel="Vaciar carrito"
        onConfirm={() => {
          setCarrito([]);
          setConfirmandoVaciar(false);
          inputBusqueda.current?.focus();
        }}
        onCancel={() => setConfirmandoVaciar(false)}
      />
    </div>
  );
}
