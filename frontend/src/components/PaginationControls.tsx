import type { Paginacion } from "@/types/repuesto";
import { IconFlechaDerecha, IconFlechaIzquierda } from "@/components/icons";

interface PaginationControlsProps {
  paginacion: Paginacion;
  onCambiarPagina: (pagina: number) => void;
  // Unidad mostrada en el resumen ("N repuesto(s)", "N venta(s)", etc.) —
  // "repuesto" por defecto para no romper los usos existentes.
  etiqueta?: string;
}

// Ventana de números de página alrededor de la página actual; el resto se
// colapsa en "…" para no desbordar con historiales largos (ventas, etc.).
const VENTANA = 2;

function calcularPaginasVisibles(pagina: number, totalPaginas: number): (number | "…")[] {
  const paginas: (number | "…")[] = [];
  const inicio = Math.max(1, pagina - VENTANA);
  const fin = Math.min(totalPaginas, pagina + VENTANA);

  if (inicio > 1) {
    paginas.push(1);
    if (inicio > 2) paginas.push("…");
  }
  for (let p = inicio; p <= fin; p += 1) {
    paginas.push(p);
  }
  if (fin < totalPaginas) {
    if (fin < totalPaginas - 1) paginas.push("…");
    paginas.push(totalPaginas);
  }

  return paginas;
}

// Primer uso de paginación real en el proyecto (T-030/T-032): el resto de
// catálogos (categorías, usuarios) son lo bastante pequeños para listarse
// completos, pero el catálogo de repuestos no.
export function PaginationControls({ paginacion, onCambiarPagina, etiqueta = "repuesto" }: PaginationControlsProps) {
  const { pagina, totalPaginas, total } = paginacion;

  if (total === 0) {
    return null;
  }

  const paginasVisibles = calcularPaginasVisibles(pagina, totalPaginas);

  return (
    <nav className="pagination" aria-label="Paginación del listado">
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onCambiarPagina(pagina - 1)}
        disabled={pagina <= 1}
      >
        <IconFlechaIzquierda />
        Anterior
      </button>

      {totalPaginas > 1 && (
        <span className="pagination-numeros">
          {paginasVisibles.map((p, indice) =>
            p === "…" ? (
              <span key={indice === 0 ? "elipsis-inicio" : "elipsis-fin"} className="pagination-elipsis">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-numero${p === pagina ? " pagination-numero-activo" : ""}`}
                aria-current={p === pagina ? "page" : undefined}
                onClick={() => onCambiarPagina(p)}
              >
                {p}
              </button>
            ),
          )}
        </span>
      )}

      <span className="pagination-info">
        Página {pagina} de {totalPaginas} · {total} {etiqueta}
        {total === 1 ? "" : "s"}
      </span>

      <button
        type="button"
        className="pagination-btn"
        onClick={() => onCambiarPagina(pagina + 1)}
        disabled={pagina >= totalPaginas}
      >
        Siguiente
        <IconFlechaDerecha />
      </button>
    </nav>
  );
}
