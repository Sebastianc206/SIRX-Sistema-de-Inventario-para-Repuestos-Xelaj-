import { Badge } from "@/components/ui/Badge";
import type { CategoriaStock } from "@/services/dashboardDatosService";

interface StockPorCategoriaProps {
  categorias: CategoriaStock[];
  maximoFilas?: number;
}

// Barras horizontales (SVG) de unidades en existencia por categoría. Las
// categorías con SKUs agotados o bajo el mínimo llevan una marca de texto
// ("2 agotados"): el estado nunca depende solo del color de la barra.
export function StockPorCategoria({ categorias, maximoFilas = 7 }: StockPorCategoriaProps) {
  const visibles = categorias.slice(0, maximoFilas);
  const maximo = Math.max(1, ...visibles.map((c) => c.unidades));

  return (
    <figure className="chart chart--hbar">
      <ul className="hbar-list" aria-label="Unidades en existencia por categoría">
        {visibles.map((c) => {
          const pct = (c.unidades / maximo) * 100;
          const alerta = c.agotados + c.bajos > 0;
          return (
            <li key={c.categoria} className="hbar-row">
              <div className="hbar-head">
                <span className="hbar-label" title={c.categoria}>
                  {c.categoria}
                </span>
                <span className="hbar-value tabular">
                  {c.unidades} <span className="muted">u.</span>
                </span>
              </div>
              <svg className="hbar-track" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={`${c.categoria}: ${c.unidades} unidades en ${c.skus} SKUs`}>
                <rect x="0" y="0" width="100" height="10" rx="3" className="hbar-bg" />
                <rect x="0" y="0" width={Math.max(pct, c.unidades > 0 ? 1.5 : 0)} height="10" rx="3" className={`hbar-fill${alerta ? " hbar-fill--alerta" : ""}`} />
              </svg>
              <div className="hbar-meta">
                <span className="muted">
                  {c.skus} SKU{c.skus === 1 ? "" : "s"}
                </span>
                {c.agotados > 0 && <Badge tone="danger">{c.agotados} agotado{c.agotados === 1 ? "" : "s"}</Badge>}
                {c.bajos > 0 && <Badge tone="warning">{c.bajos} con stock bajo</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
      {categorias.length > maximoFilas && (
        <figcaption className="chart-note">Se muestran las {maximoFilas} categorías con más existencias de {categorias.length}.</figcaption>
      )}
    </figure>
  );
}
