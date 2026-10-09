import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

export interface Tendencia {
  // Variación porcentual; null = sin período previo comparable.
  porcentaje: number | null;
  // Texto de comparación: "vs ayer", "vs 7 días previos".
  contra: string;
}

interface KpiCardProps {
  label: string;
  valor: string;
  tono?: "normal" | "alerta" | "peligro";
  tendencia?: Tendencia;
  nota?: string;
  cargando?: boolean;
}

// Indicador plano: etiqueta, cifra y una línea de contexto (tendencia con
// flecha + signo + texto, o nota). Sin ícono ni gráfica decorativa; el tono
// solo colorea la cifra y la nota.
export function KpiCard({ label, valor, tono = "normal", tendencia, nota, cargando = false }: KpiCardProps) {
  const pct = tendencia?.porcentaje;
  const direccion = pct == null ? "none" : pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return (
    <article className={`kpi kpi--${tono}`} aria-busy={cargando || undefined}>
      <h3 className="kpi-label">{label}</h3>
      {cargando ? <Skeleton width="60%" height="2.2rem" /> : <p className="kpi-value tabular">{valor}</p>}
      <div className="kpi-foot">
        {cargando ? (
          <Skeleton width="40%" height="0.9rem" />
        ) : tendencia ? (
          <span className={`kpi-trend kpi-trend--${direccion}`}>
            {direccion === "up" && <Icon name="trendUp" size={16} />}
            {direccion === "down" && <Icon name="trendDown" size={16} />}
            <strong>{pct == null ? "Sin base previa" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}</strong>
            <span className="kpi-trend-vs">{tendencia.contra}</span>
          </span>
        ) : nota ? (
          <span className="kpi-note">{nota}</span>
        ) : null}
      </div>
    </article>
  );
}

