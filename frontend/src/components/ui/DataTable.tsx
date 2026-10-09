import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { SkeletonRows } from "@/components/ui/Skeleton";

export interface Column<T> {
  key: string;
  header: string;
  cell: (fila: T) => ReactNode;
  // Si se define, la columna es ordenable por ese valor.
  sortValue?: (fila: T) => string | number | null | undefined;
  align?: "right" | "center";
  // Celda "título" en la vista de tarjeta (sin etiqueta, tipografía mayor).
  primary?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  // Título accesible de la tabla (<caption>, oculto visualmente).
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (fila: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  rowActions?: (fila: T) => ReactNode;
  rowClassName?: (fila: T) => string | undefined;
  selectable?: boolean;
  selected?: ReadonlySet<string | number>;
  onSelectedChange?: (seleccion: Set<string | number>) => void;
  rowLabel?: (fila: T) => string;
  density?: "comfortable" | "compact";
}

type Orden = { key: string; dir: "asc" | "desc" } | null;

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function comparar(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

// Tabla de datos del sistema: orden por columna (aria-sort), selección con
// "seleccionar todo", acciones por fila, esqueleto de carga, estado vacío y
// vista de tarjetas en móvil (la misma <table> se reordena con CSS y cada
// <td> lleva data-label — una sola fuente de markup para ambas vistas).
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  rowActions,
  rowClassName,
  selectable = false,
  selected,
  onSelectedChange,
  rowLabel,
  density = "comfortable",
}: DataTableProps<T>) {
  const [orden, setOrden] = useState<Orden>(null);

  const filas = useMemo(() => {
    if (!orden) return rows;
    const col = columns.find((c) => c.key === orden.key);
    if (!col?.sortValue) return rows;
    const valor = col.sortValue;
    const factor = orden.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * comparar(valor(a), valor(b)));
  }, [rows, orden, columns]);

  function alternarOrden(key: string) {
    setOrden((actual) => {
      if (!actual || actual.key !== key) return { key, dir: "asc" };
      if (actual.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  if (loading && rows.length === 0) {
    return (
      <div className="dt" data-density={density}>
        <SkeletonRows filas={6} columnas={Math.min(columns.length, 5)} />
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return <div className="dt dt--empty">{empty}</div>;
  }

  const todasMarcadas = selectable && filas.length > 0 && filas.every((f) => selected?.has(rowKey(f)));
  const algunaMarcada = selectable && filas.some((f) => selected?.has(rowKey(f)));

  function alternarTodas() {
    if (!onSelectedChange) return;
    const nueva = new Set(selected);
    if (todasMarcadas) filas.forEach((f) => nueva.delete(rowKey(f)));
    else filas.forEach((f) => nueva.add(rowKey(f)));
    onSelectedChange(nueva);
  }

  function alternarFila(fila: T) {
    if (!onSelectedChange) return;
    const nueva = new Set(selected);
    const k = rowKey(fila);
    if (nueva.has(k)) nueva.delete(k);
    else nueva.add(k);
    onSelectedChange(nueva);
  }

  return (
    <div className={`dt${loading ? " dt--busy" : ""}`} data-density={density} aria-busy={loading || undefined}>
      <div className="dt-scroll">
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="dt-check">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todas las filas"
                    checked={!!todasMarcadas}
                    ref={(el) => {
                      if (el) el.indeterminate = !todasMarcadas && !!algunaMarcada;
                    }}
                    onChange={alternarTodas}
                  />
                </th>
              )}
              {columns.map((col) => {
                const activa = orden?.key === col.key;
                const ariaSort = col.sortValue ? (activa ? (orden?.dir === "asc" ? "ascending" : "descending") : "none") : undefined;
                return (
                  <th key={col.key} scope="col" aria-sort={ariaSort} className={col.align ? `dt-${col.align}` : undefined}>
                    {col.sortValue ? (
                      <button type="button" className={`dt-sort${activa ? " dt-sort--active" : ""}`} onClick={() => alternarOrden(col.key)}>
                        {col.header}
                        <Icon name={activa ? (orden?.dir === "asc" ? "chevronUp" : "chevronDown") : "arrows"} size={14} className={activa ? "" : "dt-sort-idle"} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="dt-actions-head">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const k = rowKey(fila);
              const marcada = selectable && selected?.has(k);
              return (
                <tr key={k} className={`${marcada ? "dt-row--selected " : ""}${rowClassName?.(fila) ?? ""}`.trim() || undefined}>
                  {selectable && (
                    <td className="dt-check" data-label="Seleccionar">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${rowLabel ? rowLabel(fila) : "fila"}`}
                        checked={!!marcada}
                        onChange={() => alternarFila(fila)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      data-label={col.header}
                      className={`${col.align ? `dt-${col.align}` : ""}${col.primary ? " dt-primary" : ""}${col.className ? ` ${col.className}` : ""}`.trim() || undefined}
                    >
                      {col.cell(fila)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="dt-actions" data-label="Acciones">
                      <div className="dt-actions-inner">{rowActions(fila)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
