import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface VirtualGridProps<T> {
  items: T[];
  // Alto fijo de cada fila (px) y separación entre filas/columnas (px).
  rowHeight: number;
  gap?: number;
  // Ancho mínimo de columna: 1 columna si se omite (vista de lista); con
  // valor, las columnas se calculan según el ancho disponible (tarjetas).
  minColWidth?: number;
  overscan?: number;
  // Índice a mantener visible (navegación con teclado).
  activeIndex?: number;
  // Llamado cuando el scroll se acerca al final (para cargar más páginas).
  onNearEnd?: () => void;
  onColumnsChange?: (columnas: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T) => string;
  id?: string;
  className?: string;
  role?: string;
  ariaLabel?: string;
  ariaBusy?: boolean;
  // Contenido bajo la última fila (indicador de "cargando más").
  footer?: ReactNode;
}

const ALTO_INICIAL = 480;
const ANCHO_INICIAL = 800;
const FILAS_PARA_CARGAR_MAS = 4;

// Lista/cuadrícula virtualizada de filas de alto fijo: solo se montan las
// filas visibles (+ overscan), así 1000+ elementos no generan cientos de
// nodos en el DOM. El contenedor es el que scrollea (overflow:auto) y debe
// tener altura acotada por CSS.
export function VirtualGrid<T>({
  items,
  rowHeight,
  gap = 8,
  minColWidth,
  overscan = 4,
  activeIndex,
  onNearEnd,
  onColumnsChange,
  renderItem,
  itemKey,
  id,
  className,
  role,
  ariaLabel,
  ariaBusy,
  footer,
}: VirtualGridProps<T>) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [tamano, setTamano] = useState({ ancho: ANCHO_INICIAL, alto: ALTO_INICIAL });
  const rafPendiente = useRef<number | null>(null);

  // Mide el contenedor (y lo observa si el navegador lo permite).
  useLayoutEffect(() => {
    const el = contenedor.current;
    if (!el) return undefined;
    function medir() {
      if (!el) return;
      const ancho = el.clientWidth || ANCHO_INICIAL;
      const alto = el.clientHeight || ALTO_INICIAL;
      setTamano((t) => (t.ancho === ancho && t.alto === alto ? t : { ancho, alto }));
    }
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const columnas = minColWidth ? Math.max(1, Math.floor((tamano.ancho + gap) / (minColWidth + gap))) : 1;
  useEffect(() => {
    onColumnsChange?.(columnas);
  }, [columnas, onColumnsChange]);

  const paso = rowHeight + gap;
  const filasTotales = Math.ceil(items.length / columnas);
  const altoTotal = Math.max(0, filasTotales * paso - gap);

  const alScroll = useCallback(() => {
    if (rafPendiente.current !== null) return;
    rafPendiente.current = requestAnimationFrame(() => {
      rafPendiente.current = null;
      if (contenedor.current) setScrollTop(contenedor.current.scrollTop);
    });
  }, []);

  useEffect(
    () => () => {
      if (rafPendiente.current !== null) cancelAnimationFrame(rafPendiente.current);
    },
    [],
  );

  // Mantiene visible la fila activa (flechas del teclado).
  useEffect(() => {
    const el = contenedor.current;
    if (!el || activeIndex === undefined || activeIndex < 0) return;
    const fila = Math.floor(activeIndex / columnas);
    const arriba = fila * paso;
    const abajo = arriba + rowHeight;
    if (arriba < el.scrollTop) el.scrollTop = arriba;
    else if (abajo > el.scrollTop + el.clientHeight) el.scrollTop = abajo - el.clientHeight;
  }, [activeIndex, columnas, paso, rowHeight]);

  // Si cambia la lista (nueva búsqueda) y quedó más corta que el scroll, vuelve arriba.
  useEffect(() => {
    const el = contenedor.current;
    if (el && el.scrollTop > Math.max(0, altoTotal - el.clientHeight)) {
      el.scrollTop = Math.max(0, altoTotal - el.clientHeight);
      setScrollTop(el.scrollTop);
    }
  }, [altoTotal]);

  // Cerca del final -> pide más (el padre decide si ya no hay).
  const filaVisibleFinal = Math.ceil((scrollTop + tamano.alto) / paso);
  useEffect(() => {
    if (onNearEnd && filasTotales > 0 && filaVisibleFinal >= filasTotales - FILAS_PARA_CARGAR_MAS) onNearEnd();
  }, [filaVisibleFinal, filasTotales, onNearEnd]);

  const primeraFila = Math.max(0, Math.floor(scrollTop / paso) - overscan);
  const ultimaFila = Math.min(filasTotales - 1, Math.ceil((scrollTop + tamano.alto) / paso) + overscan);

  const filas: ReactNode[] = [];
  for (let f = primeraFila; f <= ultimaFila; f += 1) {
    const inicio = f * columnas;
    const celdas = items.slice(inicio, inicio + columnas);
    filas.push(
      <div
        key={f}
        className="vgrid-row"
        role="presentation"
        style={{ top: f * paso, height: rowHeight, gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap }}
      >
        {celdas.map((item, i) => (
          <div key={itemKey(item)} className="vgrid-cell" role="presentation">
            {renderItem(item, inicio + i)}
          </div>
        ))}
      </div>,
    );
  }

  return (
    <div
      ref={contenedor}
      id={id}
      className={`vgrid${className ? ` ${className}` : ""}`}
      role={role}
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
      onScroll={alScroll}
    >
      <div className="vgrid-inner" style={{ height: altoTotal }} role="presentation">
        {filas}
      </div>
      {footer}
    </div>
  );
}
