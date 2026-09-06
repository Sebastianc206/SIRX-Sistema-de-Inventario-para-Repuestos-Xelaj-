import type { Paginacion } from "@/types/repuesto";

interface PaginationControlsProps {
  paginacion: Paginacion;
  onCambiarPagina: (pagina: number) => void;
}

// Primer uso de paginación real en el proyecto (T-030/T-032): el resto de
// catálogos (categorías, usuarios) son lo bastante pequeños para listarse
// completos, pero el catálogo de repuestos no.
export function PaginationControls({ paginacion, onCambiarPagina }: PaginationControlsProps) {
  const { pagina, totalPaginas, total } = paginacion;

  if (total === 0) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Paginación del listado">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onCambiarPagina(pagina - 1)}
        disabled={pagina <= 1}
      >
        ← Anterior
      </button>

      <span className="pagination-info">
        Página {pagina} de {totalPaginas} · {total} repuesto{total === 1 ? "" : "s"}
      </span>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => onCambiarPagina(pagina + 1)}
        disabled={pagina >= totalPaginas}
      >
        Siguiente →
      </button>
    </nav>
  );
}
